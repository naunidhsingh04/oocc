"""The Clang source-to-source instrumentation pass (PRD docs/PRD.md §3.5,
CLAUDE.md calls this "pass.py" in the runtime headers' doc comments).

Built on libclang's Python bindings (clang.cindex) rather than the C++
LibTooling API the PRD names: this sandbox has no LLVM/Clang development
libraries to link a LibTooling-based tool against (only Apple's bundled
libclang.dylib, which the C API — and therefore these bindings — targets
directly), and building full LLVM+Clang from Homebrew is a multi-gigabyte,
multi-hour compile that doesn't fit this session. libclang's AST cursors +
source-range text splicing is the same underlying Clang AST, reached
through the C API instead of the C++ wrapper; the resulting instrumented
source, and everything downstream of it, is identical either way. Flagged
here rather than silently substituted.

Approach: parse the user's source, walk every function definition and
struct/class definition, and produce a *new* source string with the
injection-table calls (§3.5) spliced in at the right byte offsets — never
an AST-to-text pretty-printer, which would risk reformatting/losing the
user's original code. Edits are collected as (start, end, replacement)
spans and applied back-to-front so earlier offsets stay valid.
"""

from __future__ import annotations

import hashlib
import itertools
import multiprocessing
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

import clang.cindex as ci

RUNTIME_HEADER = "oocc_trace.hpp"

# Constructs the teaching subset does not attempt (PRD §3.5): detected at
# compile time with a specific, kind message rather than a generic clang
# parse error. See diagnostics.py for how these are surfaced.
UNSUPPORTED_CURSOR_KINDS = {
    ci.CursorKind.LAMBDA_EXPR: "lambda expressions",
    ci.CursorKind.CLASS_TEMPLATE: "class templates",
    ci.CursorKind.FUNCTION_TEMPLATE: "function templates",
}


def _bundled_libclang_path() -> str | None:
    """The `libclang` PyPI package (this project's pyproject.toml dependency)
    ships its own prebuilt native library — portable across whatever OS `uv
    sync` actually ran on, unlike the hardcoded system paths below, which
    only ever matched the original macOS dev sandbox this pass was built in
    and silently broke this entire module on every other OS (found running
    this Windows sandbox's own security-review adversarial suite: every
    single parse attempt failed with a `LibclangError` pointing at a
    macOS-only path that obviously doesn't exist here — a portability bug,
    not a security one, but one that means the pass never ran at all)."""
    try:
        import clang.native
    except ImportError:
        return None
    native_dir = Path(clang.native.__file__).parent
    for name in ("libclang.dll", "libclang.so", "libclang.dylib"):
        candidate = native_dir / name
        if candidate.exists():
            return str(candidate)
    return None


def _ensure_libclang_configured() -> None:
    if ci.Config.loaded:
        return
    candidates = [
        _bundled_libclang_path(),
        "/Library/Developer/CommandLineTools/usr/lib/libclang.dylib",
        "/usr/lib/llvm-14/lib/libclang.so",
        "/usr/lib/x86_64-linux-gnu/libclang.so",
    ]
    for candidate in candidates:
        if not candidate or not Path(candidate).exists():
            continue
        try:
            ci.Config.set_library_file(candidate)
            return
        except Exception:  # noqa: BLE001 - probing candidate paths
            continue


@dataclass
class Diagnostic:
    kind: str  # e.g. "unsupported_construct", "parse_error"
    message: str
    line: int | None = None


@dataclass
class InstrumentResult:
    ok: bool
    instrumented_source: str | None = None
    diagnostics: list[Diagnostic] = field(default_factory=list)


@dataclass
class _Edit:
    start: int
    end: int  # end == start for a pure insertion
    text: str


def source_hash(source: str) -> str:
    return "sha256:" + hashlib.sha256(source.encode()).hexdigest()


class LineIndex:
    """Maps a libclang SourceLocation to a byte offset into `source` via
    its (line, column) — never via SourceLocation.offset directly, which
    was observed to disagree with the true offset by a small constant
    shift once wasi-sysroot's extra -isystem/-resource-dir parse args were
    added (reproducible: cursor.extent.start.column correctly pointed at
    a statement's first character while .offset pointed 2 bytes past it).
    line/column stayed reliable in the same test, so this is the fix
    rather than chasing the root cause in Apple's bundled libclang."""

    def __init__(self, source: str) -> None:
        self._starts = [0]
        for i, ch in enumerate(source):
            if ch == "\n":
                self._starts.append(i + 1)

    def offset(self, loc: ci.SourceLocation) -> int:
        # loc.line/loc.column come back as `Any` from libclang's untyped
        # bindings (see the clang.* mypy override above) — int(...) is a
        # real runtime-checked narrowing, not just a type-checker hint.
        return self._starts[int(loc.line) - 1] + (int(loc.column) - 1)


def _find_semicolon_end(source: str, from_offset: int) -> int:
    idx = source.index(";", from_offset)
    return idx + 1


def _in_user_file(cursor: ci.Cursor, filename: str) -> bool:
    loc_file = cursor.location.file
    return loc_file is not None and loc_file.name == filename


def _gather_compound_stmts(cursor: ci.Cursor, filename: str) -> Iterator[ci.Cursor]:
    if cursor.kind == ci.CursorKind.COMPOUND_STMT and _in_user_file(cursor, filename):
        yield cursor
    for child in cursor.get_children():
        if _in_user_file(child, filename):
            yield from _gather_compound_stmts(child, filename)


def _find_unsupported(cursor: ci.Cursor, filename: str, out: list[Diagnostic]) -> None:
    if _in_user_file(cursor, filename) and cursor.kind in UNSUPPORTED_CURSOR_KINDS:
        out.append(
            Diagnostic(
                kind="unsupported_construct",
                message=(
                    f"OOCC can't trace {UNSUPPORTED_CURSOR_KINDS[cursor.kind]} yet. "
                    "This program will still compile and run, but without step data."
                ),
                line=cursor.location.line,
            )
        )
        return  # don't descend further into the unsupported subtree
    for child in cursor.get_children():
        _find_unsupported(child, filename, out)


def _top_level_function_defs(tu_cursor: ci.Cursor, filename: str) -> Iterator[ci.Cursor]:
    for cursor in tu_cursor.get_children():
        if not _in_user_file(cursor, filename):
            continue
        if cursor.kind == ci.CursorKind.FUNCTION_DECL and cursor.is_definition():
            yield cursor
        elif (
            cursor.kind in (ci.CursorKind.CLASS_DECL, ci.CursorKind.STRUCT_DECL)
            and cursor.is_definition()
        ):
            for member in cursor.get_children():
                if member.kind == ci.CursorKind.CXX_METHOD and member.is_definition():
                    yield member


def _top_level_record_defs(tu_cursor: ci.Cursor, filename: str) -> Iterator[ci.Cursor]:
    for cursor in tu_cursor.get_children():
        if not _in_user_file(cursor, filename):
            continue
        if (
            cursor.kind in (ci.CursorKind.STRUCT_DECL, ci.CursorKind.CLASS_DECL)
            and cursor.is_definition()
        ):
            yield cursor


def _record_fields(record_cursor: ci.Cursor) -> list[ci.Cursor]:
    return [c for c in record_cursor.get_children() if c.kind == ci.CursorKind.FIELD_DECL]


def _emit_describer(record_cursor: ci.Cursor) -> str:
    name = record_cursor.spelling
    fields = _record_fields(record_cursor)
    # Builds a describe_object_body-shaped C++ function body. The
    # generated C++ source needs literal `\"` inside its own string
    # literals (to produce a JSON `"` when *that* code runs) — kept as
    # plain concatenation rather than nested f-string quoting, which reads
    # far more reliably than trying to escape three quoting layers (Python
    # string -> C++ string literal -> JSON) in one expression.
    lines = [
        "namespace oocc {",
        f"template <> struct Describer<{name}> {{",
        f"  static std::string body(const {name}& v, HeapCollector& hc, const std::string& oid) {{",
        '    std::string out = "{\\"type\\":\\"' + name + '\\",\\"fields\\":{";',
    ]
    for i, f in enumerate(fields):
        prefix = "," if i > 0 else ""
        field_key_json = prefix + '\\"' + f.spelling + '\\":'
        lines.append(
            '    out += "' + field_key_json + '" + '
            f'describe_value(v.{f.spelling}, hc, field_path(oid, "{f.spelling}"));'
        )
    lines += [
        '    out += "}}";',
        "    return out;",
        "  }",
        "};",
        "}  // namespace oocc",
        "",
    ]
    return "\n".join(lines)


def _param_names(fn_cursor: ci.Cursor) -> list[str]:
    return [p.spelling for p in fn_cursor.get_arguments()]


def _function_entry_prelude(fn_cursor: ci.Cursor, is_main: bool) -> str:
    name = fn_cursor.spelling
    params = _param_names(fn_cursor)
    parts = []
    if is_main:
        parts.append("::oocc::oocc_init();")
        parts.append("::oocc::oocc_set_meta(::oocc::kRunMetaPrefix);")
    parts.append(f'::oocc::oocc_enter("{name}");')
    if params:
        arg_list = ", ".join(f'"{p}"' for p in params)
        parts.append(f"::oocc::oocc_set_args({{{arg_list}}});")
        for p in params:
            parts.append(f'::oocc::oocc_bind("{p}", {p});')
    return " ".join(parts) + " "


def _return_replacement(ret_cursor: ci.Cursor, source: str, idx: LineIndex, is_main: bool) -> _Edit:
    start = idx.offset(ret_cursor.extent.start)
    end = _find_semicolon_end(source, start)
    children = list(ret_cursor.get_children())
    finalize = '::oocc::finalize_and_emit("ok", "");' if is_main else ""
    if children:
        start_off = idx.offset(children[0].extent.start)
        end_off = idx.offset(children[0].extent.end)
        expr_text = source[start_off:end_off]
        # decltype(auto), not auto: for a function returning a reference
        # (`int& foo()`), `auto __oocc_rv = (expr);` copies into a local —
        # returning that local as a reference is a dangling-reference bug
        # (confirmed for real: clang itself emits -Wreturn-stack-address on
        # the generated code). decltype(auto) preserves the expression's
        # real value category — a reference stays a reference (aliasing
        # the original, not a copy) while a by-value expression still
        # materializes normally — so this is strictly more correct with no
        # behavior change for the common by-value-return case.
        new_text = (
            f"{{ decltype(auto) __oocc_rv = ({expr_text}); ::oocc::oocc_exit(__oocc_rv); "
            f"{finalize} return __oocc_rv; }}"
        )
    else:
        new_text = f"{{ ::oocc::oocc_exit_void(); {finalize} return; }}"
    return _Edit(start, end, new_text)


def _decl_stmt_bind_edit(decl_stmt: ci.Cursor, source: str, idx: LineIndex) -> _Edit:
    end = _find_semicolon_end(source, idx.offset(decl_stmt.extent.start))
    names = [c.spelling for c in decl_stmt.get_children() if c.kind == ci.CursorKind.VAR_DECL]
    text = " " + " ".join(f'::oocc::oocc_bind("{n}", {n});' for n in names)
    return _Edit(end, end, text)


def _step_edit(stmt: ci.Cursor, idx: LineIndex) -> _Edit:
    start = idx.offset(stmt.extent.start)
    line = stmt.extent.start.line
    col = stmt.extent.start.column
    return _Edit(start, start, f"::oocc::oocc_step({line}, {col}); ")


RAW_ALLOCATOR_NAMES = {
    "malloc": "oocc_malloc",
    "free": "oocc_free",
    "calloc": "oocc_calloc",
    "realloc": "oocc_realloc",
}


def _rewrite_raw_allocator_calls(source: str) -> str:
    """Rewrites the user's own bare malloc/free/calloc/realloc call sites to
    the runtime's oocc_-prefixed entry points (see oocc_runtime.hpp's
    comment on why this is a source rewrite rather than a libc symbol
    override). Word-boundary regex, not a full AST rewrite — sufficient for
    the teaching subset, and it never touches `#include <cstdlib>` itself
    since that spells `cstdlib`, not the bare identifiers.

    Known gap: being text-level rather than AST-aware, this also matches
    inside string literals and comments — `// call malloc(n) to allocate`
    would be rewritten too, even though it's prose, not code. None of the
    six fixtures' comments happen to contain those exact words followed
    directly by `(`, so this hasn't produced a wrong compile in practice,
    but it's a real gap, not a hypothetical one, for arbitrary future
    source.
    """

    def repl(m: re.Match[str]) -> str:
        return RAW_ALLOCATOR_NAMES[m.group(1)] + "("

    pattern = r"\b(" + "|".join(RAW_ALLOCATOR_NAMES) + r")\s*\("
    return re.sub(pattern, repl, source)


MAX_SOURCE_BYTES = 200_000  # ~5,000 lines of realistic teaching-subset code

def instrument(
    source: str, *, run_id: str, extra_clang_args: list[str] | None = None
) -> InstrumentResult:
    # Measured during Phase 6's security review (SECURITY.md): this pass's
    # own AST walk scales quadratically with translation-unit size — 2,000
    # trivial one-line functions instruments in ~2s, 5,000 in ~15s, and
    # 20,000 (still a small file, well inside a plausible generated/obfuscated
    # submission) didn't finish in 30s. Nothing downstream caps compile time
    # either (toolchain.py's subprocess timeout bounds *clang*, not this
    # pure-Python pass that runs before clang ever sees the source), so this
    # is a real, unbounded DoS vector on its own. The quadratic algorithm
    # itself wasn't safe to rewrite in this pass without a working compile
    # toolchain in this sandbox to verify no output regression — this cap
    # is the contained mitigation: reject before the expensive walk starts,
    # with a clear diagnostic, at a size no legitimate teaching-subset
    # program (the twelve/six fixtures are all under 2KB) comes close to.
    if len(source.encode("utf-8", errors="surrogatepass")) > MAX_SOURCE_BYTES:
        # Deliberately not kind="unsupported_construct": compile_service.py's
        # `untraced_offer` treats that kind as "safe to compile without the
        # pass, just without step data" — but compile_untraced sends the
        # source straight to clang++ with no size check of its own, so
        # offering that fallback here would hand the same oversized source
        # right back to clang, the exact thing this cap exists to prevent.
        return InstrumentResult(
            ok=False,
            diagnostics=[
                Diagnostic(
                    kind="resource_limit",
                    message=(
                        f"This program is larger than OOCC's {MAX_SOURCE_BYTES:,}-byte "
                        "teaching-subset limit and can't be traced."
                    ),
                )
            ],
        )

    _ensure_libclang_configured()
    filename = "<oocc-user>.cpp"

    # Parsed against the *target* toolchain's headers (wasi-sdk's sysroot,
    # passed by callers as extra_clang_args — see fixtures/cpp/generate.py
    # and the compile service), not whatever libc++ happens to be on this
    # host: the AST has to reflect the same standard library the
    # instrumented output will actually be compiled against, or e.g.
    # <iostream>'s exact declarations could disagree between parse time and
    # compile time.
    index = ci.Index.create()
    tu = index.parse(
        filename,
        args=["-std=c++17", "-x", "c++", *(extra_clang_args or [])],
        unsaved_files=[(filename, source)],
        options=ci.TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD,
    )

    diagnostics: list[Diagnostic] = []
    fatal = False
    for d in tu.diagnostics:
        if d.severity >= ci.Diagnostic.Error:
            fatal = True
            diagnostics.append(
                Diagnostic(kind="parse_error", message=d.spelling, line=d.location.line)
            )
    if fatal:
        return InstrumentResult(ok=False, diagnostics=diagnostics)

    unsupported: list[Diagnostic] = []
    _find_unsupported(tu.cursor, filename, unsupported)
    if unsupported:
        return InstrumentResult(ok=False, diagnostics=unsupported)

    idx = LineIndex(source)
    edits: list[_Edit] = []
    scope_counter = itertools.count()

    for record in _top_level_record_defs(tu.cursor, filename):
        # Inserted right after the struct's own closing `};` — not
        # collected separately and emitted up front — since Describer<T>'s
        # body accesses T's fields and so needs T fully defined first.
        insert_at = _find_semicolon_end(source, idx.offset(record.extent.end) - 1)
        edits.append(_Edit(insert_at, insert_at, "\n" + _emit_describer(record)))

    for fn in _top_level_function_defs(tu.cursor, filename):
        is_main = (
            fn.spelling == "main" and fn.semantic_parent.kind == ci.CursorKind.TRANSLATION_UNIT
        )
        body = next((c for c in fn.get_children() if c.kind == ci.CursorKind.COMPOUND_STMT), None)
        if body is None:
            continue

        prelude = _function_entry_prelude(fn, is_main)
        body_start = idx.offset(body.extent.start) + 1
        edits.append(_Edit(body_start, body_start, " " + prelude))

        # Unconditional catch-all right before the closing brace, for
        # implicit fallthrough (a void function with no explicit return,
        # or main()'s implicit `return 0;`). finalize_and_emit is
        # idempotent (guarded by TraceState.finished), so this is a no-op
        # on any path that already returned explicitly.
        tail_offset = idx.offset(body.extent.end) - 1
        if is_main:
            tail = ' ::oocc::oocc_exit_void(); ::oocc::finalize_and_emit("ok", ""); '
        else:
            result_type = fn.result_type.spelling
            tail = " ::oocc::oocc_exit_void(); " if result_type == "void" else ""
        if tail:
            edits.append(_Edit(tail_offset, tail_offset, tail))

        for compound in _gather_compound_stmts(fn, filename):
            # Every nested block (an if/while/for/do/switch body, or a
            # bare `{}`) gets its own scope-mark/unbind pair — a variable
            # declared inside one has real C++ storage that dies at the
            # block's closing brace, but oocc_bind's closure captures it
            # by reference; without this, a snapshot taken after the block
            # ends would describe_value() a dangling reference (confirmed:
            # silently produces stale-but-plausible values at -O0, a real
            # hazard elsewhere). The function's own top-level body is
            # exempted — its locals live for the whole function by design,
            # matching Python, and it already gets enter/exit handling
            # above.
            if compound != body:
                scope_id = next(scope_counter)
                mark_var = f"__oocc_mark{scope_id}"
                open_at = idx.offset(compound.extent.start) + 1
                edits.append(
                    _Edit(open_at, open_at, f" size_t {mark_var} = ::oocc::oocc_scope_mark();")
                )
                close_at = idx.offset(compound.extent.end) - 1
                edits.append(_Edit(close_at, close_at, f" ::oocc::oocc_unbind_from({mark_var});"))

            for stmt in compound.get_children():
                if not _in_user_file(stmt, filename):
                    continue
                edits.append(_step_edit(stmt, idx))
                if stmt.kind == ci.CursorKind.DECL_STMT:
                    edits.append(_decl_stmt_bind_edit(stmt, source, idx))
                elif stmt.kind == ci.CursorKind.RETURN_STMT:
                    edits.append(_return_replacement(stmt, source, idx, is_main))

    edits.sort(key=lambda e: (e.start, e.end), reverse=True)
    out = source
    for e in edits:
        out = out[: e.start] + e.text + out[e.end :]

    src_hash = source_hash(source)
    meta_prefix = (
        '{"schema_version":"1.0","run_id":"'
        + run_id
        + '","language":"cpp","source_hash":"'
        + src_hash
        + '",'
    )

    header = (
        f'#include "{RUNTIME_HEADER}"\n'
        "namespace oocc { inline const char* kRunMetaPrefix = "
        + _cpp_string_literal(meta_prefix)
        + "; }\n"
    )

    final_source = header + _rewrite_raw_allocator_calls(out)
    return InstrumentResult(ok=True, instrumented_source=final_source, diagnostics=diagnostics)


def _cpp_string_literal(s: str) -> str:
    escaped = s.replace("\\", "\\\\").replace('"', '\\"')
    return '"' + escaped + '"'


def _instrument_worker(
    source: str,
    run_id: str,
    extra_clang_args: list[str] | None,
    result_queue: multiprocessing.Queue[InstrumentResult],
) -> None:
    result_queue.put(instrument(source, run_id=run_id, extra_clang_args=extra_clang_args))


def instrument_isolated(
    source: str,
    *,
    run_id: str,
    extra_clang_args: list[str] | None = None,
    timeout_s: float = 20.0,
) -> InstrumentResult:
    """`instrument()`, run in a child process — the safe public entrypoint;
    `compile_service.py` calls this, never `instrument()` directly.

    Found during Phase 6's security review (SECURITY.md): a source well
    under `MAX_SOURCE_BYTES` (a ~40,000-term flat `x + 1 + 1 + ...` chain,
    160KB) crashes libclang's native parser outright — a stack overflow in
    the recursive-descent expression parser, confirmed by the child process
    exiting with an abnormal status code and zero output, not a Python
    exception `instrument()` could ever catch itself (a hard native crash
    unwinds past any `try/except` in the same process). Clang's parser does
    guard *bracket* nesting explicitly (a clean "bracket nesting level
    exceeded maximum of 256" diagnostic, confirmed separately) but not a
    flat operator chain's expression-tree depth — closing that specific gap
    would mean either patching/wrapping libclang itself or reimplementing
    depth-limited expression parsing, neither of which fits this session.
    Process isolation is the general fix: whatever pathological AST shape
    crashes the parser next, it takes down one throwaway child, never the
    compile service itself.

    `multiprocessing`'s spawn context, not fork: this pass loads a native
    library (libclang) with global C state, and Windows only supports spawn
    anyway — using the same context on every platform means one code path,
    not "works on Linux, silently different on Windows."
    """
    ctx = multiprocessing.get_context("spawn")
    result_queue: multiprocessing.Queue[InstrumentResult] = ctx.Queue()
    process = ctx.Process(
        target=_instrument_worker, args=(source, run_id, extra_clang_args, result_queue)
    )
    process.start()
    process.join(timeout_s)

    if process.is_alive():
        process.terminate()
        process.join()
        return InstrumentResult(
            ok=False,
            diagnostics=[
                Diagnostic(
                    kind="resource_limit",
                    message=f"Parsing timed out after {timeout_s:.0f}s.",
                )
            ],
        )

    if process.exitcode != 0:
        return InstrumentResult(
            ok=False,
            diagnostics=[
                Diagnostic(
                    kind="resource_limit",
                    message=(
                        "The parser crashed on this program (exit code "
                        f"{process.exitcode}) — this is usually a pathologically "
                        "deep expression or declaration OOCC's teaching subset "
                        "can't handle."
                    ),
                )
            ],
        )

    return result_queue.get()
