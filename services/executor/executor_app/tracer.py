"""The real Python tracer — a separate service from the API process
(docs/PRD.md §5), never imported in-process by apps/api. `Tracer` produces
trace.schema.json-shaped dicts; `CounterTracer` is a fast, snapshot-free mode
used only by complexity_analyst to measure step counts across many
generated inputs, where frame/heap capture would dominate the cost.

This shares its design with fixtures/generator/tracer.py (that one is a
throwaway, Phase 0 script frozen against the twelve golden fixtures; this is
the real, evolving service) — see that module's docstring for the two
sys.monitoring correctness rules that matter everywhere below:
  1. Every callback filters on `code.co_filename == USER_CODE_FILENAME`.
  2. Monitoring must be off before any of this module's own post-run code
     (e.g. `import traceback`) runs, or that code gets traced too.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import random
import sys
import time
import traceback as traceback_module
import types
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from executor_app.sandbox_imports import restricted_builtins

USER_CODE_FILENAME = "<oocc-user>"
TOOL_ID = 3  # PEP 669: ids 0-5 exist; 0,1,2,5 are conventional names for
# well-known tool kinds (debugger/coverage/profiler/optimizer) but aren't
# reserved by the interpreter itself. 3 and 4 have no conventional owner.
MAX_INLINE_STR_LEN = 40
SCHEMA_VERSION = "1.0"


class StepLimitReached(Exception):
    """Internal control-flow signal — not part of the trace contract."""


def _heap_key_repr(key: Any) -> str:
    if isinstance(key, str):
        return key
    if isinstance(key, (int, float, bool)):
        return str(key)
    return repr(key)


@dataclass
class _Frame:
    frame_id: str
    func: str
    live_frame: Any  # the real Python frame object, kept only while on the stack
    line: int = 0
    args: list[str] | None = None
    call_site_line: int | None = None


@dataclass
class _TraceState:
    # `head_steps` holds up to keep_head steps; once full, every further
    # step goes into `tail_buffer`, a deque(maxlen=keep_tail) that evicts
    # its oldest entry in O(1) as new ones arrive. This keeps "first
    # keep_head + last keep_tail" without ever doing an O(n) mid-list
    # delete, which matters at the real 100k-step scale (§3.3).
    head_steps: list[dict] = field(default_factory=list)
    tail_buffer: deque[dict] = field(default_factory=lambda: deque(maxlen=0))
    executed_step_count: int = 0
    frame_stack: list[_Frame] = field(default_factory=list)
    next_frame_id: int = 0
    next_obj_id: int = 1
    obj_ids: dict[int, str] = field(default_factory=dict)
    obj_keepalive: dict[str, Any] = field(default_factory=dict)
    prev_paths: dict[str, str] = field(default_factory=dict)
    seen_exception_ids: set[int] = field(default_factory=set)
    stdout_total_bytes: int = 0
    heap_object_cap_hit_ever: bool = False


class Tracer:
    """Runs one program to completion (or to a limit/error) and returns a
    trace.schema.json-shaped dict. One Tracer instance is single-use.
    """

    def __init__(
        self,
        *,
        step_limit: int = 100_000,
        keep_head: int = 40_000,
        keep_tail: int = 10_000,
        max_heap_objects_per_step: int = 5_000,
        wall_clock_limit_s: float = 15.0,
        stdout_limit_bytes: int = 256_000,
    ) -> None:
        self.step_limit = step_limit
        self.keep_head = keep_head
        self.keep_tail = keep_tail
        self.max_heap_objects_per_step = max_heap_objects_per_step
        self.wall_clock_limit_s = wall_clock_limit_s
        self.stdout_limit_bytes = stdout_limit_bytes
        self._state = _TraceState()
        self._state.tail_buffer = deque(maxlen=keep_tail)
        self._start_time = 0.0
        self._stdout_marker_emitted = False

    # -- public entrypoint ----------------------------------------------

    def run(self, source: str, *, stdin: str = "") -> dict:
        source_hash = "sha256:" + hashlib.sha256(source.encode()).hexdigest()
        code = compile(source, USER_CODE_FILENAME, "exec")
        run_globals: dict[str, Any] = {
            "__name__": "__main__",
            "__doc__": None,
            "__builtins__": restricted_builtins(),
        }
        # Seeded, not left to the real OS entropy source: docs/PRD.md §5's
        # "random (seeded)" and, separately, what the deterministic-output
        # cache (apps/api/app/cache.py) already assumes — a cache hit serves
        # a previous run's trace back for identical (source, stdin), which
        # is only honest if the same source actually produces the same
        # trace every time. Seeded from the source text itself so different
        # programs still get different-looking sequences.
        random.seed(source_hash)

        events = sys.monitoring.events
        sys.monitoring.use_tool_id(TOOL_ID, "oocc-executor-tracer")
        sys.monitoring.register_callback(TOOL_ID, events.LINE, self._on_line)
        sys.monitoring.register_callback(TOOL_ID, events.PY_START, self._on_call)
        sys.monitoring.register_callback(TOOL_ID, events.PY_RETURN, self._on_return)
        sys.monitoring.register_callback(TOOL_ID, events.PY_UNWIND, self._on_unwind)
        sys.monitoring.register_callback(TOOL_ID, events.RAISE, self._on_raise)

        status = "ok"
        error_obj: dict | None = None
        self._start_time = time.monotonic()

        stdout_capture = _CapturingWriter(self._on_stdout_write)
        stdin_stream = io.StringIO(stdin)
        real_stdin = sys.stdin

        try:
            sys.monitoring.set_events(
                TOOL_ID,
                events.LINE | events.PY_START | events.PY_RETURN | events.PY_UNWIND | events.RAISE,
            )
            try:
                sys.stdin = stdin_stream
                with contextlib.redirect_stdout(stdout_capture):
                    exec(code, run_globals)
            except StepLimitReached:
                status = "step_limit"
            except BaseException as exc:  # noqa: BLE001 - deliberately broad: this *is* the sandbox boundary
                status = "runtime_error"
                error_obj = self._build_error(exc)
            finally:
                sys.stdin = real_stdin
        finally:
            # Turn monitoring off before anything else (including imports)
            # runs, or that code gets traced too. See module docstring.
            sys.monitoring.set_events(TOOL_ID, events.NO_EVENTS)
            sys.monitoring.free_tool_id(TOOL_ID)

        duration_ms = (time.monotonic() - self._start_time) * 1000
        truncated = self._state.executed_step_count > self.keep_head + self.keep_tail
        kept_steps = self._state.head_steps + list(self._state.tail_buffer)

        trace: dict[str, Any] = {
            "schema_version": SCHEMA_VERSION,
            "run_id": "r_"
            + hashlib.sha256((source_hash + str(id(self))).encode()).hexdigest()[:16],
            "language": "python",
            "source_hash": source_hash,
            "status": status,
            "meta": {
                "duration_ms": round(duration_ms, 3),
                "step_count": len(kept_steps),
                "truncated": truncated,
                "stdin": stdin,
                "peak_heap_objects": len(self._state.obj_keepalive),
            },
            "steps": kept_steps,
        }
        if error_obj is not None:
            trace["error"] = error_obj
        return trace

    # -- sys.monitoring callbacks -----------------------------------------

    def _on_line(self, code: Any, line_number: int) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        frame = sys._getframe(1)
        if self._state.frame_stack:
            self._state.frame_stack[-1].line = line_number
            self._state.frame_stack[-1].live_frame = frame
        self._record_step("line")

    def _on_call(self, code: Any, instruction_offset: int) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        # PY_START also fires once for the outermost module frame itself
        # (nobody "called" the module — it just started); track it, but
        # don't emit a bogus "call" step with no meaningful line yet.
        is_module_entry = len(self._state.frame_stack) == 0
        frame = sys._getframe(1)
        caller = frame.f_back
        call_site_line = (
            caller.f_lineno
            if caller is not None and caller.f_code.co_filename == USER_CODE_FILENAME
            else None
        )
        args = [] if is_module_entry else list(code.co_varnames[: code.co_argcount])

        self._state.frame_stack.append(
            _Frame(
                frame_id=f"f{self._state.next_frame_id}",
                func=code.co_name,
                live_frame=frame,
                line=frame.f_lineno,
                args=None if is_module_entry else args,
                call_site_line=call_site_line,
            )
        )
        self._state.next_frame_id += 1
        if not is_module_entry:
            self._record_step("call")

    def _on_return(self, code: Any, instruction_offset: int, retval: Any) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        is_module_exit = len(self._state.frame_stack) == 1
        if self._state.frame_stack:
            self._state.frame_stack[-1].live_frame = sys._getframe(1)
        if not is_module_exit:
            returned_value = self._to_value(retval)
            self._record_step("return", returned=returned_value)
        if self._state.frame_stack:
            self._state.frame_stack.pop()

    def _on_unwind(self, code: Any, instruction_offset: int, exc: BaseException) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        if self._state.frame_stack:
            self._state.frame_stack.pop()

    def _on_raise(self, code: Any, instruction_offset: int, exc: BaseException) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        if id(exc) in self._state.seen_exception_ids:
            return  # same exception re-appearing while propagating through outer frames
        self._state.seen_exception_ids.add(id(exc))
        frame = sys._getframe(1)
        if self._state.frame_stack:
            self._state.frame_stack[-1].line = frame.f_lineno
            self._state.frame_stack[-1].live_frame = frame
        self._record_step("exception")

    def _on_stdout_write(self, text: str) -> None:
        if not text:
            return
        self._state.stdout_total_bytes += len(text.encode("utf-8", errors="replace"))
        if self._state.stdout_total_bytes > self.stdout_limit_bytes:
            if not self._stdout_marker_emitted:
                self._stdout_marker_emitted = True
                self._record_step("stdout", stdout_delta="\n[stdout truncated: exceeded 256 KB]\n")
            return
        self._record_step("stdout", stdout_delta=text)

    # -- step construction --------------------------------------------------

    def _record_step(self, event: str, *, returned: Any = None, stdout_delta: str = "") -> None:
        if time.monotonic() - self._start_time > self.wall_clock_limit_s:
            raise StepLimitReached

        self._state.executed_step_count += 1
        i = self._state.executed_step_count - 1

        top = self._state.frame_stack[-1] if self._state.frame_stack else None
        stack_json, heap_json, heap_truncated = self._snapshot()
        current_paths = self._flatten_paths(stack_json, heap_json)
        changed = sorted(
            p for p in current_paths if current_paths[p] != self._state.prev_paths.get(p)
        )
        self._state.prev_paths = current_paths

        step: dict[str, Any] = {
            "i": i,
            "event": event,
            "line": top.line if top else 0,
            "func": top.func if top else "<module>",
            "depth": len(self._state.frame_stack),
            "stack": stack_json,
            "heap": heap_json,
            "stdout_delta": stdout_delta,
            "changed": changed,
        }
        if event == "return":
            step["returned"] = returned
        if heap_truncated:
            step["heap_truncated"] = True

        if len(self._state.head_steps) < self.keep_head:
            self._state.head_steps.append(step)
        else:
            self._state.tail_buffer.append(step)  # O(1): evicts oldest once full

        if self._state.executed_step_count >= self.step_limit:
            raise StepLimitReached

    def _snapshot(self) -> tuple[list[dict], dict[str, dict], bool]:
        state = self._state
        heap: dict[str, dict] = {}
        heap_truncated = False

        def visit(obj: Any) -> dict | None:
            nonlocal heap_truncated
            oid = state.obj_ids.get(id(obj))
            if oid is not None:
                if oid not in heap and oid in state.obj_keepalive:
                    if len(heap) >= self.max_heap_objects_per_step:
                        heap_truncated = True
                        return {"ref": oid}
                    heap[oid] = self._encode_heap_object(state.obj_keepalive[oid], visit)
                return {"ref": oid}
            if not _is_heap_type(obj):
                return None  # caller will inline it instead

            if len(heap) >= self.max_heap_objects_per_step:
                heap_truncated = True
                return None

            oid = f"o{state.next_obj_id}"
            state.next_obj_id += 1
            state.obj_ids[id(obj)] = oid
            state.obj_keepalive[oid] = obj
            heap[oid] = self._encode_heap_object(obj, visit)
            return {"ref": oid}

        def encode_value(obj: Any) -> dict | None:
            ref = visit(obj)
            if ref is not None:
                return ref
            return self._encode_inline(obj)

        stack_json = []
        for f in state.frame_stack:
            locals_dict = {}
            try:
                live_locals = dict(f.live_frame.f_locals)
            except Exception:  # noqa: BLE001 - defensive; frame introspection is best-effort
                live_locals = {}
            for name, value in live_locals.items():
                if name.startswith("__") and name.endswith("__"):
                    continue
                locals_dict[name] = encode_value(value)
            frame_json: dict[str, Any] = {
                "frame_id": f.frame_id,
                "func": f.func,
                "line": f.line,
                "locals": locals_dict,
            }
            if f.args is not None:
                frame_json["args"] = f.args
            if f.call_site_line is not None:
                frame_json["call_site_line"] = f.call_site_line
            stack_json.append(frame_json)

        # encode_value can add heap entries while stack_json is being built,
        # and heap objects can reference other heap objects (e.g. tree
        # nodes) - `visit` recurses directly, so `heap` is complete here.
        return stack_json, heap, heap_truncated

    def _encode_heap_object(self, obj: Any, visit: Any) -> dict:
        if isinstance(obj, str):
            return {"type": "str", "len": len(obj), "value": obj}
        if isinstance(obj, list):
            return {
                "type": "list",
                "len": len(obj),
                "items": [self._encode_or_ref(x, visit) for x in obj],
            }
        if isinstance(obj, tuple):
            return {
                "type": "tuple",
                "len": len(obj),
                "items": [self._encode_or_ref(x, visit) for x in obj],
            }
        if isinstance(obj, dict):
            return {
                "type": "dict",
                "len": len(obj),
                "entries": [
                    {"key": self._encode_or_ref(k, visit), "value": self._encode_or_ref(v, visit)}
                    for k, v in obj.items()
                ],
            }
        if isinstance(obj, (set, frozenset)):
            return {
                "type": "set",
                "len": len(obj),
                "items": [self._encode_or_ref(x, visit) for x in obj],
            }
        if isinstance(obj, type):
            # A class object itself (e.g. a `Node` class bound at module
            # scope), not an instance of it. Classes are callable too, so
            # this must be checked before the function branch below, or a
            # class would be mislabeled as a function. Not in the §3.2
            # heap-type registry, so it degrades honestly to opaque rather
            # than claiming a type it isn't.
            return {"type": "opaque", "repr": _safe_repr(obj)}
        if isinstance(obj, types.ModuleType):
            # `import random` binds `random` as a local — without this,
            # the generic `hasattr(obj, "__dict__")` branch below walks the
            # *entire* module namespace (every function, every submodule,
            # `__builtins__`, `__loader__`'s importlib internals...), which
            # is deep enough to blow Python's default recursion limit before
            # it ever finishes (found by this file's own adversarial test
            # suite — see SECURITY.md). A module is never one of §3.2's
            # heap types anyway; nobody visualizes a module's internals.
            return {"type": "opaque", "repr": f"<module '{obj.__name__}'>"}
        if callable(obj) and (hasattr(obj, "__name__")):
            return {
                "type": "function",
                "name": getattr(obj, "__name__", "?"),
                "qualname": getattr(obj, "__qualname__", getattr(obj, "__name__", "?")),
            }
        if hasattr(obj, "__dict__"):
            fields = {}
            for name, value in vars(obj).items():
                if name.startswith("__") and name.endswith("__"):
                    continue
                fields[name] = self._encode_or_ref(value, visit)
            return {"type": type(obj).__name__, "fields": fields}
        return {"type": "opaque", "repr": _safe_repr(obj)}

    def _encode_or_ref(self, obj: Any, visit: Any) -> dict | None:
        ref = visit(obj)
        if ref is not None:
            return ref
        return self._encode_inline(obj)

    def _encode_inline(self, obj: Any) -> dict | None:
        if obj is None:
            return {"val": None, "repr": "None"}
        if isinstance(obj, bool):
            return {"val": obj, "repr": "True" if obj else "False"}
        if isinstance(obj, (int, float)):
            return {"val": obj}
        if isinstance(obj, str):
            return {"val": obj}
        return {"val": _safe_repr(obj), "repr": _safe_repr(obj)}

    def _to_value(self, obj: Any) -> dict | None:
        """Encode a standalone value (e.g. a return value) that isn't
        necessarily reachable from any frame's locals, adding it to the
        heap keepalive table if it's a heap type."""
        state = self._state
        if _is_heap_type(obj):
            oid = state.obj_ids.get(id(obj))
            if oid is None:
                oid = f"o{state.next_obj_id}"
                state.next_obj_id += 1
                state.obj_ids[id(obj)] = oid
                state.obj_keepalive[oid] = obj
            return {"ref": oid}
        return self._encode_inline(obj)

    def _flatten_paths(self, stack_json: list[dict], heap_json: dict[str, dict]) -> dict[str, str]:
        paths: dict[str, str] = {}
        for frame_json in stack_json:
            fid = frame_json["frame_id"]
            for name, value in frame_json["locals"].items():
                paths[f"{fid}.{name}"] = repr(value)
        for oid, obj in heap_json.items():
            t = obj["type"]
            if t in ("list", "tuple", "set"):
                for idx, item in enumerate(obj["items"]):
                    paths[f"{oid}[{idx}]"] = repr(item)
            elif t == "dict":
                for entry in obj["entries"]:
                    key_repr = _heap_key_repr_from_value(entry["key"])
                    paths[f"{oid}{{{key_repr}}}"] = repr(entry["value"])
            elif t in ("str", "function", "opaque"):
                pass
            else:  # instance
                for name, value in obj.get("fields", {}).items():
                    paths[f"{oid}.{name}"] = repr(value)
        return paths

    def _build_error(self, exc: BaseException) -> dict:
        # extract_tb() includes this tracer's own `exec(code, run_globals)`
        # frame (it's genuinely part of the real call stack) — drop it so
        # `traceback` reads as the user's program, not our harness.
        user_frames = [
            fs
            for fs in traceback_module.extract_tb(exc.__traceback__)
            if fs.filename == USER_CODE_FILENAME
        ]
        tb_lines = ["Traceback (most recent call last):\n"]
        tb_lines += traceback_module.format_list(user_frames)
        tb_lines += traceback_module.format_exception_only(type(exc), exc)
        line = user_frames[-1].lineno if user_frames else None
        return {
            "type": type(exc).__name__,
            "message": str(exc),
            **({"line": line} if line is not None else {}),
            "step": max(self._state.executed_step_count - 1, 0),
            "traceback": tb_lines,
        }


class CounterTracer:
    """Fast, snapshot-free counting mode for complexity_analyst: no frame or
    heap capture, only a running total of executed LINE events (proportional
    to work done, sufficient to tell O(n) from O(n^2) from O(log n) — see
    docs/PRD.md §4.3 complexity_analyst). Registers only the LINE event, so
    there's no per-step dict/repr construction at all.
    """

    def __init__(self, *, step_limit: int = 3_000_000, wall_clock_limit_s: float = 5.0) -> None:
        self.step_limit = step_limit
        self.wall_clock_limit_s = wall_clock_limit_s
        self._count = 0
        self._start_time = 0.0

    def run(self, source: str, *, stdin: str = "") -> dict:
        code = compile(source, USER_CODE_FILENAME, "exec")
        run_globals: dict[str, Any] = {
            "__name__": "__main__",
            "__doc__": None,
            "__builtins__": restricted_builtins(),
        }
        random.seed(hashlib.sha256(source.encode()).hexdigest())

        events = sys.monitoring.events
        sys.monitoring.use_tool_id(TOOL_ID, "oocc-executor-counter")
        sys.monitoring.register_callback(TOOL_ID, events.LINE, self._on_line)

        status = "ok"
        self._start_time = time.monotonic()
        stdin_stream = io.StringIO(stdin)
        real_stdin = sys.stdin
        devnull = io.StringIO()

        try:
            sys.monitoring.set_events(TOOL_ID, events.LINE)
            try:
                sys.stdin = stdin_stream
                with contextlib.redirect_stdout(devnull):
                    exec(code, run_globals)
            except StepLimitReached:
                status = "step_limit"
            except BaseException:  # noqa: BLE001 - deliberately broad: this *is* the sandbox boundary
                status = "runtime_error"
            finally:
                sys.stdin = real_stdin
        finally:
            sys.monitoring.set_events(TOOL_ID, events.NO_EVENTS)
            sys.monitoring.free_tool_id(TOOL_ID)

        duration_ms = (time.monotonic() - self._start_time) * 1000
        return {"status": status, "step_count": self._count, "duration_ms": round(duration_ms, 3)}

    def _on_line(self, code: Any, line_number: int) -> None:
        if code.co_filename != USER_CODE_FILENAME:
            return
        self._count += 1
        if self._count >= self.step_limit:
            raise StepLimitReached
        # time.monotonic() has real per-call overhead; checking every 4096
        # events keeps the wall-clock cap responsive without dominating cost.
        if (
            self._count % 4096 == 0
            and time.monotonic() - self._start_time > self.wall_clock_limit_s
        ):
            raise StepLimitReached


def _is_heap_type(obj: Any) -> bool:
    if obj is None or isinstance(obj, (bool, int, float)):
        return False
    if isinstance(obj, str):
        return len(obj) > MAX_INLINE_STR_LEN
    return True


def _heap_key_repr_from_value(value: dict | None) -> str:
    if value is None:
        return "None"
    if "ref" in value:
        return value["ref"]
    return _heap_key_repr(value.get("val"))


def _safe_repr(obj: Any) -> str:
    try:
        return repr(obj)
    except Exception:  # noqa: BLE001 - repr() itself can raise for pathological objects
        return f"<{type(obj).__name__} object>"


class _CapturingWriter(io.TextIOBase):
    def __init__(self, on_write: Any) -> None:
        super().__init__()
        self._on_write = on_write

    def write(self, s: str) -> int:  # type: ignore[override]
        self._on_write(s)
        return len(s)

    def flush(self) -> None:
        pass


def run_source(source: str, *, stdin: str = "", **tracer_kwargs: Any) -> dict:
    return Tracer(**tracer_kwargs).run(source, stdin=stdin)


def run_source_counters_only(source: str, *, stdin: str = "", **tracer_kwargs: Any) -> dict:
    return CounterTracer(**tracer_kwargs).run(source, stdin=stdin)
