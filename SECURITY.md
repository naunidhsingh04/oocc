# OOCC security review — Phase 6

**Date:** 2026-07-28. **Scope:** the adversarial re-review docs/PRD.md §5
calls for at Phase 6, extended to the C++ path (§3.5), which had never had
one. Every result below was actually run in this session, against this
repo's real code, not inferred from reading it — see the test files cited
next to each finding. Severity is my own honest judgment, not a formal
scoring system.

**Headline: the Python sandbox has no OS-level isolation deployed yet, and
one class of C++-path bug (documented below) can crash the compile process
outright.** Neither is new information hidden from the rest of this repo —
`services/executor/executor_app/main.py`'s own docstring already said "not
this" about isolation before this session touched anything — but it had
never been verified end-to-end with real adversarial input, and Phase 1's
CLAUDE.md entry claimed a test suite that didn't exist. This document is
that gap closed, honestly, including what's still open.

---

## 1. Python sandbox (docs/PRD.md §5)

### 1.1 What's actually deployed today: no OS-level isolation

`services/executor/executor_app/main.py` runs `Tracer().run(source)` as a
plain in-process `exec()` call — no gVisor/nsjail, no container-per-run, no
`--network none`, no cgroup memory/CPU/pids limits, no separate OS user. The
module's own docstring already said this before this session:

> "gVisor/nsjail, resource limits, and the adversarial test suite are
> deployment-time hardening on top of this same boundary and remain
> unbuilt — nothing here should be mistaken for that."

This review confirms that statement is accurate and still true. **Zero
sandbox escapes is a non-negotiable success criterion (PRD §1.3) that this
deployment does not currently meet** if "escape" includes reading the
executor process's own filesystem, opening sockets, or exhausting its
memory/CPU — all of which are process-level capabilities available to any
submitted Python program today, bounded only by the mitigations in §1.2
below (which are real, but are a second layer, not the boundary itself).

**This is the top-priority follow-up from this entire review**: put the
executor behind gVisor (`runsc`) or nsjail, one container per run, before
this ships to real users. Everything else in this document is
defense-in-depth on top of a boundary that doesn't exist yet.

### 1.2 What this session added (Python-level defense-in-depth)

None of this existed before this session — the tracer had *zero*
protections beyond the step-count/wall-clock/heap-object/stdout limits
already in `tracer.py` (§3.3, unaffected by this review). `services/
executor/executor_app/sandbox_imports.py` is new:

- **Import allowlist, not a blocklist.** PRD's own wording ("Blocklist at
  import time: os, subprocess, socket, ctypes, importlib") names five
  modules; implemented here as an allowlist instead (`math`, `random`,
  `collections`, `heapq`, `bisect`, `itertools`, `functools`, `string`,
  `typing`, `dataclasses`, `re` — PRD's exact list) because a named
  blocklist only stops the modules someone thought to name, and `shutil`,
  `pathlib`, `multiprocessing`, `pickle` all reach filesystem/process
  capability PRD's five don't cover. Tested for real
  (`services/executor/tests/test_sandbox_imports.py`): all nine blocked
  imports (the five PRD names plus four not named) fail safely with a
  clear `SandboxImportError`; all eleven allowed imports still work.
- **`open()` itself is removed from builtins**, not just module imports —
  PRD's own adversarial list names `open('/etc/passwd')` specifically, and
  `open` is a builtin, not a module, so the import override alone would
  never have caught it. Confirmed this was a real gap before the fix (an
  unmodified builtins dict has a working `open`); confirmed closed after.
- **`random` is seeded from the source hash**, both for PRD's own "random
  (seeded)" line and because the deterministic-output cache
  (`app/cache.py`) already assumes identical `(source, stdin)` produces an
  identical trace — true only if nothing inside is nondeterministic.
  Verified: two runs of the same random-using source produce byte-identical
  stdout.

### 1.3 Confirmed, honest limitation: the import allowlist doesn't stop the classic bypass

`services/executor/tests/test_sandbox_imports.py::
test_subclasses_gadget_bypasses_the_import_blocklist` proves that this
still works, with the allowlist fully in place:

```python
found = None
for cls in ().__class__.__bases__[0].__subclasses__():
    if cls.__name__ == 'Popen':
        found = cls
        break
print(found)   # <class 'subprocess.Popen'>
```

This walks the live object graph (`object` → every loaded subclass) to
reach `subprocess.Popen` without ever calling `__import__`. It works because
`subprocess` (or something that imports it) is already loaded somewhere in
the *executor process* by the time user code runs — a structural property
of "no OS isolation, shared interpreter," not a bug in the allowlist logic.
**No Python-level fix closes this in general** — it's the reason §1.1's
OS-level sandbox isn't optional. This test is a deliberate regression guard:
if it ever starts failing, don't read that as "the gap is closed" without
checking why (see the test's own comment) — it's more likely a different
loaded-class-graph shape than a real fix.

### 1.4 Adversarial suite: results (`services/executor/tests/test_adversarial.py`)

PRD §5 asked for this in Phase 1. It didn't exist until this session. Every
case below was run for real against the current in-process `Tracer`, not
reasoned about from reading the code:

| Case | Result | Mechanism |
|---|---|---|
| `while True: i += 1` | Fails safely (`status: step_limit`) in <1s | Tracer's own `wall_clock_limit_s`, independent of OS sandboxing |
| Deep recursion (`f(n): return f(n+1)`) | Fails safely (`RecursionError`, useful step index) | CPython's own recursion limit |
| `for i in range(10**9): ...` | Bounded by `step_limit`, not by actually finishing | Tracer's own step counter |
| `print('☃' * 5_000_000)` (unicode bomb) | Truncated at the 256KB stdout cap | Existing `stdout_limit_bytes` logic |
| `import os` / `subprocess` / `socket` / `ctypes` / `importlib` / `shutil` / `pathlib` / `multiprocessing` / `pickle` | All blocked, clear error | New import allowlist (§1.2) |
| `open('/etc/passwd')` | Blocked, clear error | New `open` removal (§1.2) |
| `os.system(...)` / `socket.connect(...)` | Blocked (can't even import the module) | New import allowlist |
| subclasses-gadget bypass | **Succeeds** — reaches `subprocess.Popen` | Confirmed open gap, §1.3 |
| ~1M-element list, single step | Times out (`status: step_limit`) *before* revealing anything about memory — see below | Wall-clock limit, incidentally |
| 8MB single string allocation | **Succeeds**, `status: ok`, no limit enforced | Confirmed open gap — see below |

**Two things not run at hostile scale, deliberately, and why:**

- **A real 10GB allocation.** This session runs inside a shared sandbox on
  the developer's actual machine with no OS-level memory isolation (§1.1) —
  actually exhausting memory here risks crashing or degrading a real
  person's machine, not a disposable test VM. The 8MB-string test above
  proves the same point (no memory limit exists in `Tracer` at any scale)
  without the risk. **Do not run this at real hostile scale outside a
  properly isolated environment** (a disposable container/VM with its own
  memory cgroup) — and once gVisor/nsjail (§1.1) is in place, the 256MB
  `--memory` limit from PRD §3.3 makes this moot at the OS level regardless
  of what the tracer itself does or doesn't check.
- **A real fork bomb.** Python has no `os.fork()` on Windows (this dev
  sandbox), and `os`/`multiprocessing` are both blocked by the import
  allowlist regardless of platform — so the two ways this could plausibly
  work are both already closed. Not worth constructing a POSIX-specific
  repro to prove a point the import-allowlist tests already cover from a
  different angle.

**Incidental finding, not a new mitigation:** a large single-step
allocation (e.g. a 1M-element *list*, as opposed to one big string) makes
`_snapshot()`'s full per-step heap walk slow enough to trip the wall-clock
limit on its own, before any loop even runs. This means the wall-clock
check is accidentally also a rough memory/complexity backstop for *this*
specific shape of attack — but it's incidental, not designed, and shouldn't
be relied on as the real mitigation (a shape that allocates a lot of memory
without it being *walked* every step, e.g. one giant string, sails through
untouched, per the row above).

### 1.5 A real, unrelated bug this review found and fixed: module objects crash the tracer

While testing "are the allowlisted modules actually usable" (not itself an
adversarial case), `import random; random.randint(...)` — and five of the
other ten allowlisted modules — failed with `RecursionError` before this
session's fix. Root cause (found by removing the tracer's own error
swallowing to see the real traceback): binding a module as a local
(`import random` → `random` in scope) made `_encode_heap_object` try to
walk the *entire* module `__dict__` as a generic object's fields — every
function, submodule, `__loader__`'s importlib internals, `__builtins__` —
deep and wide enough to blow Python's default recursion limit before ever
finishing. Not a true infinite cycle (the heap-id dedup means a real cycle
back to an already-visited object resolves as a `{"ref": ...}`), just a
tree far deeper than any real user data structure. Fixed in
`services/executor/executor_app/tracer.py` by special-casing
`types.ModuleType` to `{"type": "opaque", "repr": "<module 'random'>"}`
before the generic walk, matching how a class object is already handled one
branch above it. This wasn't a security bug on its own, but it meant the
import allowlist's own allowed modules were mostly unusable — a real
product-correctness bug this security pass happened to surface.

---

## 2. C++ path (docs/PRD.md §3.5)

No adversarial coverage existed for this path before this session either.
Two constraints shaped what could actually be tested here:

- **No wasi-sdk in this Windows dev sandbox.** `toolchain.py`'s
  `WASI_SDK_DIR` is hardcoded to a macOS arm64 release tarball path from
  wherever this was originally built — genuinely absent here, not a
  configuration oversight to fix in this session. This means the actual
  wasm *compile* step (both the instrumented path and the "untraced"
  fallback) could not be exercised end-to-end. `services/cpp-executor/
  tests`' 11 pre-existing failures needing this toolchain are unrelated to
  this session's changes (confirmed: identical 16-failing baseline on
  `main` before this session touched anything, now 11 after a portability
  fix — §2.1 — recovered 5 of them).
- **libclang parsing itself is fully testable** without wasi-sdk, since
  `instrument()`'s pass only needs libclang to parse and text-splice, not
  compile. Everything in §2.2–§2.4 was run for real against this session's
  actual `instrument()`/`instrument_isolated()`.

### 2.1 A real, unrelated bug this review found and fixed: libclang never loaded on this OS

Every single parse attempt failed instantly with `LibclangError: Could not
find module '.../libclang.dylib'` — `instrument.py`'s own
`_ensure_libclang_configured()` only ever probed hardcoded macOS/Linux
system paths, with no fallback to the `libclang` PyPI package's own bundled,
portable native library (already a project dependency, already present at
`.venv/Lib/site-packages/clang/native/libclang.dll` on this machine). Fixed
by trying the bundled package's own library first, and checking each
candidate actually exists before calling `Config.set_library_file` (which
doesn't itself validate — it happily "succeeds" pointing at a nonexistent
path, and only fails later, confusingly, inside `Index.create()`). This is
a portability bug, not a security one, but it meant this entire code path
had never actually run outside its original macOS sandbox — 5 previously-
failing tests in `test_instrument.py` now pass as a direct result.

### 2.2 Hostile input to clang — results (ad hoc scripts this session, not yet a committed test file beyond §2.4's regression suite)

| Case | Result |
|---|---|
| Deep template instantiation (`Fib<35>` via recursive template) | Rejected at parse time with a clear diagnostic ("class templates" unsupported) — the teaching-subset design working as intended |
| Deeply nested parens (3,000 deep) | Rejected by **clang's own** parser guard: `"bracket nesting level exceeded maximum of 256"` |
| Deeply nested blocks (2,000 deep) | Same clang guard, same message |
| Malformed/garbage source | Clean `parse_error` diagnostics, no crash |
| Unicode bomb in a string literal | Handled as ordinary (very long) source text |

### 2.3 Compile bombs — a real, measured, quadratic-time vulnerability, mitigated

A translation unit of trivial one-line functions (no templates, no
recursion — just many functions) instruments in time that scales
**quadratically** with function count, measured directly:

| Function count | Time |
|---|---|
| 2,000 | 2.1s |
| 5,000 | 15.2s |
| 20,000 | did not finish in 30s (timed out) |

Nothing downstream bounded this before this session: `toolchain.py`'s
`subprocess.run` calls for the actual clang++ compile had **no timeout at
all** (fixed — see §2.5), and `instrument()` itself had no source-size
cap. **Mitigated, not fixed**: added `MAX_SOURCE_BYTES = 200_000` (~5,000
lines) to `instrument.py`, checked before any parsing starts, in both
`compile_source` and `compile_untraced` (independently — `compile_untraced`
is its own public entrypoint and shouldn't rely on `compile_source`'s check
running first). This bounds the *worst* case but not the ordinary one — a
147KB file (comfortably under the cap) still took ~10-15s to instrument in
this testing, well past PRD §3.5's "cold compile ≤2s p95" target. The
quadratic algorithm itself (somewhere in `instrument()`'s AST walk) is the
real fix and wasn't safe to attempt in this session without a working
end-to-end compile toolchain in this sandbox to verify no output
regression — flagged as the top C++-path follow-up.

### 2.4 The most severe finding of this review: a small, well-under-cap source crashes the parser process outright

A flat, 40,000-term left-associative expression chain (`x = x + 1 + 1 +
... `, 160KB — comfortably under the 200KB cap from §2.3) does not raise a
Python exception. It crashes the process:

```
$ (parse this source directly, no isolation)
returncode: 2147483649    # an abnormal Windows exit status, not a Python exit code
stdout: (empty)
stderr: (empty)
```

Root cause: clang's recursive-descent expression parser recurses once per
operator in a flat chain like this, and — unlike the *bracket*-nesting
guard that caught the deeply-nested-parens case cleanly (§2.2) — has no
equivalent depth guard for a flat operator chain. 40,000 levels of native
recursion overflows the parser's own C++ call stack: a hard segfault-class
crash that unwinds straight past any Python `try/except`, because the
fault is in the native library, not in Python.

**This is worse than a hang.** If `instrument()` ran directly inside a
shared compile-service process (which it did, before this fix), one
crafted submission takes down every other in-flight request sharing that
process, not just its own.

**Fixed with process isolation**, not a heuristic patch: `instrument_isolated()`
(new, `instrument.py`) runs the actual parse in a child process
(`multiprocessing`, spawn context — required on Windows anyway, and safer
here regardless of platform since libclang holds global native state a
forked child would inherit in a possibly-corrupted way). A crashed or
timed-out child is observed as an abnormal exit code / a join timeout and
reported as an ordinary `resource_limit` diagnostic — the parent process
never crashes. `compile_service.py` now calls `instrument_isolated`
exclusively; `instrument()` itself is unchanged and still directly testable
without process overhead (`test_instrument.py`).

Verified for real, both directions:

- The crashing input above: contained, returns a clean diagnostic in 0.81s
  (`test_instrument_isolated.py::test_a_parser_crashing_input_is_contained_not_propagated`).
  the same input run *without* isolation still crashes the process, as a
  live regression check that the fix is actually doing something.
- Ordinary sources and the already-working "unsupported construct"
  diagnostics: unaffected (`test_instrument_isolated.py`'s other two tests).

**Deliberately not attempted this session**: closing this at the root — an
explicit expression-depth check before/during clang's own parse, or
patching libclang. Process isolation is the general answer for "some AST
shape we haven't found yet also crashes the parser," which a
one-construct patch wouldn't be.

### 2.5 Other C++-path fixes made during this review

- **`toolchain.py`'s `compile_to_wasm` and `compile_service.py`'s
  `compile_untraced`**: both `subprocess.run` calls to clang++ had no
  `timeout=`. Added (30s, generous over the ≤2s p95 target). Both callers
  now handle `subprocess.TimeoutExpired` as an ordinary compile error
  instead of an unbounded hang.
- **`compile_to_wasm` had `check=True`** — meaning a failing compile would
  raise `CalledProcessError` instead of ever reaching the caller's own
  `if proc.returncode != 0:` handling, which was consequently dead code.
  Removed `check=True`; the existing caller-side check now actually runs.
  (Not exercised by a live test in this sandbox — no wasi-sdk to trigger a
  real compile failure with — but the bug was visible by inspection and the
  fix is a one-line, low-risk removal of a redundant check.)

### 2.6 What's still unverified

Everything requiring an actual wasm compile — "enormous generated WASM,"
whether the STL pretty-printers or the runtime's arena allocator hold up
under adversarial input, whether a genuinely huge (but under-cap) source
compiles within reasonable *wall-clock* time end-to-end — needs a real
wasi-sdk toolchain, which this session's environment doesn't have. This is
an environment gap, not a "didn't get to it" gap: flag it for the next
session that runs on a machine with the toolchain available (CLAUDE.md's
Phase 5 backend Track B notes already record a working MinGW/cmake/
emscripten setup on this same Windows sandbox via `scoop`, for reference —
wasi-sdk specifically still needs its own manual download, per
`toolchain.py`'s own error message).

---

## 3. Everything else in this document is unchanged by this session

Rate limits, backups, deploy topology, and the operational runbook are
covered in `docs/RUNBOOK.md`, not here — this file is scoped to the
adversarial/sandbox review PRD §5 and the task that requested this session
asked for. `CLAUDE.md`'s Phase 6 section records the wire-optimisation and
operations work done alongside this review.
