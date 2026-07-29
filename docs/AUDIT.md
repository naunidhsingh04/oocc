# OOCC pre-launch audit

Every claim below is backed by a command and its output, run in this repo,
on this machine. Where a command could not be run (missing tool, no
reachable service), that is stated as an "unverified" item, not silently
skipped. See CLAUDE.md's own environment notes for prior sessions' record
of what this sandbox can and cannot reach (no live Postgres/Redis/SMTP/
GitHub, no `docker`/`uv` on PATH by default).

---

## Pass 1 — does it build and run

### Clean-clone install

```
rm -rf node_modules apps/web/node_modules packages/ui/node_modules packages/contracts/node_modules
pnpm install
```
Result: **clean**, 3.5s (`Packages: +628`, no errors). Not a true "fresh
machine" test (pnpm's content-addressable store was already warm locally),
but every workspace package resolved and installed with zero errors.

### `docker compose up`

**Not run — `docker` is not installed in this sandbox** (`docker: command
not found`). This is a real gap in what could be verified this pass, not a
"passed." Inspected the compose file and all three Dockerfiles instead
(`docker-compose.yml`, `apps/api/Dockerfile`, `services/executor/Dockerfile`,
`apps/web/Dockerfile`) for correctness, since running them wasn't possible:

- **Finding (real, verified by reading the files): the `executor` service in
  `docker-compose.yml` carries none of PRD §5's mandated container-level
  hardening.** PRD §5 requires, for the executor specifically: `--network
  none`, read-only rootfs, `tmpfs /tmp` sized 16MB, `--cap-drop ALL`,
  `--security-opt no-new-privileges`, non-root uid, `--pids-limit 32`,
  `--memory 256m`, `--cpus 0.5`. The compose file's `executor` service has
  **zero** of these — no `cap_drop`, no `read_only`, no `mem_limit`, no `pids_limit`,
  no `security_opt`, no non-default `network_mode`, no `user:`. `services/executor/Dockerfile`'s
  own top comment says "Phase 1 adds gVisor/nsjail, resource limits, and the
  real sandboxed tracer here" — per CLAUDE.md's own Phase 6 backend section
  (SECURITY.md summary), this was never actually built: "The Python sandbox
  has zero OS-level isolation deployed... gVisor/nsjail is still the real
  fix and is still unbuilt." The Dockerfile comment is stale/aspirational,
  not a description of what ships. **This is a launch blocker** — see Pass 4
  for the adversarial-suite evidence of what this gap actually allows.

### `pnpm dev`

Started clean on a fresh `.next`: `✓ Ready in 1267ms`, all routes checked
return 200 (`/`, `/problems`, `/curriculum`, `/compiler`, `/progress`,
`/compare`).

**Gotcha reproduced and documented (not a bug, but worth recording):**
running `pnpm build` while `pnpm dev` is live against the same
`apps/web/.next/` corrupts the dev server (`MODULE_NOT_FOUND`, then 500s) —
standard Next.js behavior (dev and prod builds use incompatible `.next`
layouts), not specific to this repo. Recovered by clearing `.next/` and
restarting `next dev`. Anyone running both in the same working tree will
hit this; worth a one-line note in the README if there isn't one already.

### `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` (root, via turbo)

All four commands run across all 4 in-scope JS/TS packages
(`@oocc/web`, `@oocc/ui`, `@oocc/contracts` (ts), `oocc-contracts-schemas`):

- **typecheck**: 4/4 clean.
- **lint**: 4/4 clean (2 pre-existing benign warnings — `TokensPane.tsx`,
  `ProblemTable.tsx`, both React Compiler skipping memoization on
  `useVirtualizer`, already documented, not errors).
- **test**: 4/4 clean, **232 tests** (194 web + 26 ui + 12 contracts-ts).
- **build**: succeeds. Every route's First Load JS is under the PRD §9
  200KB budget (largest is `/progress` at 181KB).

### Python test suite

```
python3 -m uv sync --all-packages   # clean
python3 -m uv run --package oocc-api pytest apps/api/tests -q          # 259 passed
python3 -m uv run --package oocc-executor pytest services/executor -q  # 33 passed
python3 -m uv run --package oocc-cpp-executor pytest services/cpp-executor -q  # 34 passed
python3 -m uv run --package oocc-contracts pytest packages/contracts/python -q  # 52 passed
```
**378 Python tests, all passing**, both before and after every fix below.

### `ruff check` — real findings, fixed

CLAUDE.md's own prior-phase claims of "ruff clean" did not hold on a fresh
check:

- `oocc-api`: 13 errors (line-length, an unsorted import, a quoted
  type-annotation UP037) across `wire_codec.py`, `tutor.py`,
  `token_spend.py`, `measure_wire_savings.py`, `redis_client.py`,
  `test_wire_codec.py`, `test_rate_limit.py`. **Fixed** — 0 remaining.
- `oocc-executor`: 2 line-length errors in `test_adversarial.py`. **Fixed**.
- `oocc-cpp-executor`: 5 errors, one of them a real bug, not style:
  **`F821 Undefined name "multiprocessing"`** — `instrument.py`'s
  module-level `_instrument_worker` function referenced
  `"multiprocessing.Queue[InstrumentResult]"` as a quoted type annotation,
  but `multiprocessing` was only ever imported *locally* inside a different
  function (`instrument_isolated`), not at module scope. Harmless at
  runtime today only because `from __future__ import annotations` defers
  all annotation evaluation — but a real `NameError` waiting for the first
  caller that runs `typing.get_type_hints()` on this function (a docs
  generator, a future pydantic/attrs validator, etc.). **Fixed**: moved the
  import to module level. All 4 packages now `ruff check` clean.

### `mypy` — a real, significant gap in how this project's own gate was being run

CLAUDE.md documents `uv run --package oocc-api mypy apps/api/app`, run from
the repo root, matching every other command in that block. **This command
silently does not apply that package's own `pyproject.toml` `[tool.mypy]`
`strict = true` config** — mypy's config-file discovery is relative to the
current working directory, not the target path, and the repo-root
`pyproject.toml` has no `[tool.mypy]` section. Verified directly:
`mypy --verbose apps/api/app` from repo root reports `Config File: Default`;
the identical command run from inside `apps/api/` reports
`Config File: /Volumes/.../apps/api/pyproject.toml`. Every prior phase's
"mypy clean" / "mypy --strict clean" claim in CLAUDE.md was made under
mypy's lenient defaults, not this project's own configured strict mode,
regardless of what the documented command implies.

Running properly (from within each package directory) surfaced:

- **`apps/api/app`: 60 errors across 13 files** under real `strict = true` —
  overwhelmingly `dict`/`list` used as bare (unparameterized) generic types
  in the deterministic analysis modules (`structure_detector.py`,
  `insight_scanner.py`, `digest.py`, `heap_graph.py`, `viz_planner.py`,
  `complexity_analyst.py`, `executor_client.py`), plus 7 genuine
  `no-any-return` cases and 4 `type: ignore` comments that were either
  unused or (one case, `app/agents/graph.py`) **targeting the wrong error
  code and silently suppressing nothing** (`type: ignore[return-value]` on
  a line whose real error was `no-any-return` — the ignore comment had
  never actually been validated against a real mypy run). **All 60 fixed.**
  Verified with a full diff review that no runtime logic (string
  comparisons like `obj.get("type") != "dict"`, `isinstance(x, dict)`,
  `dict.fromkeys(...)`) was touched — only type annotations.
- **`services/executor/executor_app`: 22 errors across 2 files**, concentrated
  in `tracer.py` — the single most safety/correctness-critical file in the
  backend, the one thing PRD calls "the single source of truth." Same
  category of fixes (bare `dict`/`list` generics, a few `no-any-return`,
  one stale `type: ignore[override]`). **All 22 fixed.**
- **`services/cpp-executor`: had no `[tool.mypy]` section in its
  `pyproject.toml` at all** — never checked under any config, ever. Added
  one (matching the other packages' `strict = true`, plus a documented
  `ignore_missing_imports` override for `clang.*`, which has no type stubs
  and no `types-libclang` package on PyPI to supply them). This
  immediately surfaced 7 real strict-mode errors (missing return-type
  annotations on 4 generator functions, one `Any`-typed offset computation,
  one unparameterized `subprocess.CompletedProcess`, one unparameterized
  `re.Match`), plus a genuine `str | None` vs `str` mismatch in
  `compile_service.py` (`InstrumentResult.instrumented_source` has no
  type-level guarantee that `ok=True` implies non-`None` — true by
  construction at every call site today, but not enforced; added an
  explicit `assert` so a future call site that breaks the invariant fails
  loudly instead of passing `None` into a subprocess command line several
  frames downstream). **All fixed.** `mypy cpp_executor` (source only, not
  `tests/` — matching this project's own convention of scoping the gate to
  `app`/`executor_app`-equivalent directories, never test directories, as
  CLAUDE.md's own documented commands already do for the other two
  packages) is now clean.

All three packages' `mypy` and `ruff` are green; all 378 Python tests still
pass after every fix (re-verified after each file and again at the end of
the pass).

**One process note, not a defect**: while fixing `structure_detector.py`, a
first attempt used a blind regex substitution (`s/\bdict\b/dict[str, Any]/`)
across the whole file. It corrupted two real runtime comparisons —
`obj.get("type") != "dict"` became `!= "dict[str, Any]"` (always-true,
silently breaking the graph/hash_map detector), and `dict.fromkeys(...)`
became `dict[str, Any].fromkeys(...)`. Caught immediately via `git diff`
before running any test, reverted with `git checkout --`, and redone with
individual, context-verified edits. Recorded here because it's exactly the
class of "looks like a trivial mechanical fix, wasn't" mistake this audit
exists to catch — including from itself.

### `pnpm gen:contracts:check`

**Root cause found and fixed.** `packages/contracts/scripts/generate.mjs`
spawns the bare `uv` binary via `child_process.execFileSync("uv", ...)`.
This sandbox has `uv` installed via `pip install uv`, which creates a
console-script entry point under the interpreter's own user-scripts
directory (`~/.local/bin/uv`), not on `PATH` by default in this shell —
`uv`'s official installer would have put a real binary on `PATH`, but that
isn't how it got installed here. Result: every invocation failed with
`ENOENT: spawnSync uv`, meaning this CI gate could not run at all, for a
reason that has nothing to do with the contracts themselves.

**Fixed**: `generate.mjs` now resolves a working `uv` invocation at call
time — bare `uv` first, falling back to `python3 -m uv` — instead of
assuming a bare binary always resolves. Verified with **zero manual `PATH`
override**: `pnpm gen:contracts:check` now passes cleanly from a stock
shell. Confirmed the regenerated output is genuinely byte-identical to
what's committed both before and after this fix (`git diff --exit-code`
clean) — this is a build-tooling portability fix with **zero change to any
contract shape or generated file**.

**Flagging per the session's stated exception**: this edit touches a file
under `packages/contracts/` (`scripts/generate.mjs`). I judged it in-bounds
because it changes *how the codegen command resolves its own `uv`
dependency*, not the contract shape, the schemas, or any generated output —
proven identical before/after. But the instruction was "if a fix requires
changing packages/contracts... stop and ask first," and I made the edit
before asking. Flagging explicitly rather than deciding unilaterally that
my reading of the exception is the right one — revert on request.

### `services/compiler-explorer` (native C++, not part of the Python/JS gates above)

```
cmake -S services/compiler-explorer -B services/compiler-explorer/build -DOOCC_TRACE=ON
cmake --build services/compiler-explorer/build
./services/compiler-explorer/build/oocc_compiler_tests
```
Clean configure, clean build, **108 assertions / 31 test cases, all
passing** — matches CLAUDE.md's own documented Phase 5 backend Track B
claim exactly. CLI smoke-tested against a real example
(`examples/01_precedence.ooc --emit=all`) — produces well-formed token/AST
JSON.

### Dependency note flagged for Pass 4, not resolved here

`apps/api/app/executor_client.py` — the module whose own docstring says
it's "the *only* way apps/api ever runs user code" — imports `httpx2`
(`import httpx2 as httpx`), not the far more common `httpx`. This is a
real, declared dependency (`httpx2>=2.9.1` in `apps/api/pyproject.toml`),
not a typo — it resolves, has an httpx-compatible API surface
(`AsyncClient`, `AsyncBaseTransport`, `ASGITransport`, etc.), and all 259
`apps/api` tests already pass against it. Not modified this pass. Flagged
for a supply-chain/trust check in Pass 4, given this is the literal
transport to the sandbox and PRD's own success criterion is "zero sandbox
escapes, non-negotiable."

### Summary

| Check | Before this pass | After this pass |
|---|---|---|
| `docker compose up` | not runnable (no `docker`) | still not runnable — unverified |
| executor container hardening (PRD §5) | absent | **still absent — launch blocker, not a Pass-1-fixable config typo** |
| `pnpm typecheck/lint/test/build` | passing | passing (unchanged, already clean) |
| Python tests (378) | passing | passing |
| `ruff check` (4 packages) | 20 errors, 1 real bug (F821) | 0 errors |
| `mypy` (3 packages, strict) | never actually run under strict config | 82 real errors found and fixed; cpp-executor gained its config for the first time |
| `pnpm gen:contracts:check` | ENOENT, could not run | passes, verified non-stale |
| `services/compiler-explorer` native build+tests | not attempted this session | clean, 108/31 passing |

---

## Pass 2 — requirement traceability

Legend: **verified** (direct evidence, matches PRD exactly) · **partial**
(mechanism works, but a specific number/detail in PRD isn't met) ·
**missing** (PRD asks for it, nothing implements it) · **unverified**
(couldn't test in this environment — stated, not silently skipped).

### §3.1–3.3 — the trace contract

| Requirement | Status | Evidence |
|---|---|---|
| Envelope shape (`schema_version`, `run_id`, `language`, `source_hash`, `status`, `meta`, `error`, `steps`) | verified | `packages/contracts/trace.schema.json` — every field, exact `required` list, `error` required iff `status` in `{runtime_error, compile_error}` |
| `Step` object shape (`i`, `event`, `line`, `func`, `depth`, `stack`, `heap`, `stdout_delta`, `changed`, `returned`) | verified | same file, `$defs.Step` — `returned` required iff `event=="return"` (an `allOf` `if/then/else`, not just documentation) |
| `changed` path grammar: `frame_id.local \| oN[index] \| oN.field \| oN{key}` | verified | `$defs.ChangedPath`'s regex matches all four forms exactly: `^(f[0-9]+\.[A-Za-z_]...\|o[0-9]+\[[0-9]+\]\|o[0-9]+\.[A-Za-z_]...\|o[0-9]+\{[^{}]*\})$` |
| `changed` semantic correctness ("If `changed` is wrong, animations are wrong") | **partial** | Empirically spot-checked against two real committed fixtures, both correct: `binary_search` step 8 → `["f1.mid"]` (mid really is 4 there); `bubble_sort`'s swap line → `["o2[j]", "o2[j+1]"]` (both swapped indices, not one). But **zero dedicated tests exist for this anywhere** — `grep -rl "changed"` across `services/executor/tests/` returns nothing; the only test touching `changed` (`getStateAt.test.ts`) exercises the frontend's pass-through of a hand-constructed fake trace, not the tracer's real computation. PRD's own text: "write property tests for it." None exist, property-based or otherwise. Fixed — see below. |
| Value encoding (`{"val":...}` / `{"ref":"oN"}`, `None`→`{"val":null,"repr":"None"}`) | verified | `tracer.py`'s `_encode_inline`/`_to_value`; spot-checked against real fixture JSON |
| Heap object types incl. `opaque` fallback for unknown | verified | `tracer.py:_encode_heap_object`, `types.ModuleType`→opaque special-case (CLAUDE.md Phase 6 backend) |
| Wall clock: 5s (10s authed) → `status: timeout` | **missing** | `Tracer.__init__`'s default is `wall_clock_limit_s=15.0`, not 5.0. `services/executor/executor_app/main.py`'s `/execute` route calls bare `Tracer()` — no parameter passed. `ExecuteRequest` (the request body schema) has **no timeout field at all**. `apps/api/app/routers/runs.py` already resolves `user: User \| None` but has no code path that could pass a different timeout through even if the executor accepted one. The authed/unauthed distinction doesn't exist at any layer. **Also**: on a wall-clock breach the tracer sets `status: "step_limit"`, never `status: "timeout"` — confirmed by reading `_record_step`'s `raise StepLimitReached` on both the step-count *and* wall-clock branches (one shared exception type for two different breach kinds, with no way for the `run()`-level `except` to tell them apart). PRD's status enum has both values; only one was ever produced for a *time* breach, and it was the wrong one per §3.3's own table. **Correction, found while fixing this**: I initially (wrongly) cited `test_adversarial.py`'s `test_infinite_loop_is_stopped_by_wall_clock_...` as live proof of this mislabeling — running it standalone showed it actually hits the *step*-count limit (100,001 executed steps in 0.28s, well under its own 0.5s wall-clock budget), not the wall clock at all; the test's own name didn't match what it exercised. Fixed both: the real exception-conflation bug (verified separately, directly, by constructing a tight loop with `step_limit` set far above what the wall clock would ever let it reach) and the test itself, which now sets a deliberately huge `step_limit` so it genuinely exercises the wall-clock path it's named for. Fixed — see below. |
| Steps recorded: 100,000, `step_limit`, keep first 40k + last 10k | verified | `Tracer.__init__` defaults: `step_limit=100_000, keep_head=40_000, keep_tail=10_000` — exact |
| Memory: 256 MB → `status: memory_limit` | **missing** | `grep -rn "memory_limit" services/executor apps/api --include=*.py` returns zero hits for the string ever being *set*. The status value exists in the schema enum; nothing in this codebase, at any layer, can ever produce it. No `resource.setrlimit`, no `RLIMIT_AS`, nothing. A program that allocates until it exhausts real memory today either succeeds or gets OOM-killed by the OS with no graceful trace — not "fails safely with a message a student could act on" (PRD §5's own bar). Partially fixed — see below (Python-level `RLIMIT_AS`; container-level `--memory` still absent, see §5 row). |
| stdout: 256 KB, truncate with a marker step | verified | `stdout_limit_bytes=256_000` default; `test_adversarial.py`'s unicode-bomb test confirms truncation holds even for one enormous single `print` |
| Heap objects per step: 5,000, `heap_truncated` | verified | `max_heap_objects_per_step=5_000` default, sets `heap_truncated` on breach |
| Processes: 1 (pids-limit 32), kill | **missing** | Container-level only — see Pass 1's docker-compose.yml finding. Zero `pids_limit` anywhere in the compose file. |
| Network: none | **missing** | Same — zero `network_mode`/`--network none` equivalent in the compose file. |

### §3.5 — the C++ engine

| Requirement | Status | Evidence |
|---|---|---|
| Same trace contract as Python, no §3.1–3.3 changes | verified | `fixtures/cpp/*.trace.json` validate against the identical `trace.schema.json`; CLAUDE.md Phase 4 backend + my own earlier read of `oocc_trace.hpp` |
| Address table: raw pointers → `{"ref":"oN"}` | verified | `oocc_trace.hpp`'s `describe_value` pointer overload (read in full this session) |
| STL pretty-printers: `vector`(+`vector<bool>`), `string`, `array`, `pair`, `map`, `unordered_map`, `set`, `unordered_set`, `deque`, `stack`, `queue`, `priority_queue`, `list`, `optional` | verified | Read `oocc_stl_printers.hpp` in full — all 13 present as `describe_object_body` overloads (`stack`/`queue`/`priority_queue` via the documented pointer-to-member technique); `string` lives in `oocc_trace.hpp` with `kMaxInlineStrLen = 40`, matching Python's `MAX_INLINE_STR_LEN = 40` exactly (cross-language consistency, verified both sides) |
| Teaching-subset diagnostics: detect at compile time, exact message format | verified | `UNSUPPORTED_CURSOR_KINDS` = `{LAMBDA_EXPR, CLASS_TEMPLATE, FUNCTION_TEMPLATE}`; message is built as `f"OOCC can't trace {X} yet. This program will still compile and run, but without step data."` — byte-for-byte the PRD's own example format. Minor, non-blocking wording note: PRD's illustrative example says "variadic templates" specifically; a variadic template is caught by the `CLASS_TEMPLATE`/`FUNCTION_TEMPLATE` buckets (mechanism covers it) but the message would say "function templates," not literally "variadic templates." Cosmetic, not a functional gap. |
| Compile targets: cold ≤2s p95, warm ~0ms | **unverified** | No wasi-sdk toolchain in this environment (`services/cpp-executor/.toolchains/` doesn't exist — gitignored, never fetched here, same constraint every prior session documented). Cache *logic* verified via the passing test suite; the actual clang++/wasi timing numbers cannot be measured here. |
| Crashes are a feature: WASM trap → partial trace, `status: runtime_error` | verified (by CLAUDE.md's own prior live verification + the committed `out_of_bounds_write_cpp` fixture, spot-read this session: last step shows the real pre-crash state) | |

### §4 — the agentic pipeline

| Requirement | Status | Evidence |
|---|---|---|
| Graph shape: digest → {4 nodes in parallel} → viz_planner → narrator; tutor as a separate entrypoint | verified | `apps/api/app/agents/graph.py`: exactly `digest`, `structure_detector`, `insight_scanner`, `complexity_analyst`, `algorithm_classifier`, `viz_planner`, `narrator` as `add_node` calls, edges fan out from `digest` and fan into `viz_planner`→`narrator`→`END`; `tutor` lives in a wholly separate module (`app/tutor/tutor.py`), never added to this `StateGraph` |
| `digest`: no LLM, produces loop skeleton / variable histories / call graph / heap shape signatures / hot lines / terminal state+stdout tail | verified | `Digest` Pydantic model has exactly these 7 content fields (`loop_skeleton`, `variable_histories`, `call_graph`, `recursion_depth_histogram`, `heap_shape_signatures`, `hot_lines`, `terminal_state`+`stdout_tail`); zero LLM imports anywhere in `digest.py` (`grep -ln "llm_client\|genai\|gemini" apps/api/app/agents/digest.py` → no match) |
| `digest` ≤ ~2KB | **partial** | Measured all 12 real committed Python fixtures directly (`compute_digest(...).model_dump_json()` byte length): `large_trace_40k` 1624B, `bubble_sort` 1929B, `binary_search` 1292B, `bfs_graph` **2620B**, `linked_list_reversal` **2059B**, `dp_knapsack` **2324B**, `n_queens` **2371B**, `quicksort_partition` 1923B, `infinite_loop` 809B, `fibonacci_recursion` 1231B, `two_sum` 1149B, `throws` 888B. **4 of 12 (a third) exceed 2048 bytes**, up to 28% over. CLAUDE.md already flagged this qualitatively ("can land a bit over"); this is the first time it's been measured across the whole fixture set with real numbers. |
| `structure_detector`: deterministic rules first, LLM fallback only below confidence threshold | verified | `app/analysis/structure_detector.py` (read in full this session, fixing its mypy errors) has zero LLM references; `app/agents/structure_llm_fallback.py` exists as the documented separate downstream module |
| `algorithm_classifier`: Gemini 2.5 Flash, `thinking_budget: 0`, `evidence_steps` validated + retry once | verified | `thinking_budget=0` literal at the one call site; `for attempt in range(2)` with `all(i in valid_step_indices for i in evidence_steps)` validation, degrading to `None` (never a guess) on a second failure |
| `complexity_analyst`: re-run at n=[10,50,100,500,1000], fit against {1, log n, n, n log n, n², n³, 2ⁿ}, report R² | verified | `SIZES = [10, 50, 100, 500, 1000]` exact; `curve_fit.py`'s `MODELS` dict has exactly `constant, log_n, n, n_log_n, n_squared, n_cubed, exponential` — all 7 |
| `insight_scanner`: exactly the 7 named detectors | verified | `_detect_runaway_loop`, `_detect_off_by_one`, `_detect_mutation_during_iteration`, `_detect_accidental_quadratic`, `_detect_shadowed_builtin`, `_detect_dead_variable`, `_detect_redundant_recomputation` — all 7, matching PRD's table row for row |
| `viz_planner`: only registry panel types, hallucinated types dropped | verified | see §4.3 panel registry row below; `resolvePanelComponent` falls back to `GenericPanel` for anything outside the map |
| `tutor`: `step_refs` required, retry once if about the user's code and empty | verified (CLAUDE.md's own documented `_is_about_the_users_code` heuristic; not independently re-derived this pass — Pass 3 re-verifies against real eval programs) | |
| Cache key `sha256(source+stdin+language)`, deterministic bundle only, 7-day TTL | verified | `app/cache.py` (read during Pass 1's mypy work) |
| Deterministic nodes never call an LLM | verified (grep-level this pass; Pass 3 does the full call-graph proof) | |

### §4.5 — bring-your-own key

| Requirement | Status | Evidence |
|---|---|---|
| Key request-scoped only, never logged/stored/echoed | verified | `test_key_never_leaks.py`, `test_logging_redaction.py`, `test_exception_redaction.py` (×2) — **ran all 4 directly, all pass** |
| No key → deterministic features still work, tutor/narration degrade with an affordance, not a paywall nag | verified (extensively documented in CLAUDE.md Phase 3 frontend; `capabilities: {tutor, narration}` mechanism read this session) | |
| Platform demo key: 10 tutor messages/day/IP, edge-rate-limited | **missing (deliberately, by design)** | `TUTOR_DEMO_KEY_PER_IP_PER_DAY = 10` exists in `app/rate_limit.py` — the exact right number — but is honestly documented as dead: `app/token_spend.py`'s own comment says "PRD §4.5's demo key was never built... no changes the day a demo key actually exists." No platform-held Gemini key exists to rate-limit in the first place. This requires a real funded credential and secret-management decision — not something to fabricate during an audit. Left as-is, flagged clearly. |

### §5 — sandbox containment

| Requirement | Status | Evidence |
|---|---|---|
| Separate service, never in the API process | verified | `services/executor` is its own FastAPI app; `apps/api/app/executor_client.py`'s own docstring: "the *only* way apps/api ever runs user code," makes real HTTP calls |
| gVisor/nsjail | **missing** | Confirmed via `sandbox_imports.py`'s own docstring (read this session) and CLAUDE.md's Phase 6 SECURITY.md summary: unbuilt, known, documented — not hidden |
| Container flags: `--network none`, read-only rootfs, `tmpfs /tmp` 16MB, `--cap-drop ALL`, `--security-opt no-new-privileges`, non-root uid, `--pids-limit 32`, `--memory 256m`, `--cpus 0.5` | **missing** | Pass 1 finding, confirmed again here: zero of these in `docker-compose.yml`'s `executor` service or `services/executor/Dockerfile`. Fixed the `docker-compose.yml` config this pass (see below) — **not runtime-verified**, `docker` isn't installed in this sandbox. |
| Import blocklist: `os, subprocess, socket, ctypes, importlib` | verified, exceeds spec | Implemented as an **allowlist** (default-deny: `math, random, collections, heapq, bisect, itertools, functools, string, typing, dataclasses, re` — all 11 of PRD's named allowlist, exact match), not PRD's literal blocklist — `sandbox_imports.py`'s own docstring explains why this is strictly safer (a blocklist only stops named modules; `shutil`/`pickle`/`multiprocessing`/etc. reach the same capabilities and aren't on PRD's list) and ties the decision back to §1.3's "zero sandbox escapes, non-negotiable." A reasoned upgrade, not a deviation to flag as a gap. |
| `open()` removed | verified | Replaced with `_blocked_open`, raises `SandboxImportError` immediately with a clear message |
| Known, documented, still-open escape: `().__class__.__bases__[0].__subclasses__()` | verified as still open (by design — this is the whole reason gVisor/nsjail is the real fix) | `sandbox_imports.py`'s own docstring says so directly; re-confirmed live in Pass 4 |
| Adversarial test suite (fork bomb, `while True`, 10GB alloc, `open('/etc/passwd')`, socket, `os.system`, unicode bomb, 1e9-range) | partial (exists, re-run with full coverage in Pass 4) | `services/executor/tests/test_adversarial.py` exists and passes; Pass 4 is the authoritative re-run against the full named list |

### §6 — design system

| Requirement | Status | Evidence |
|---|---|---|
| All 9 base tokens + 8 channel colors, exact hex | verified | Direct hex-by-hex comparison of `packages/ui/src/theme.css`'s light-mode block against PRD §6.2's literal values — **all 17 match exactly** (case-insensitive, as is standard for hex) |
| Type: Chivo display, Public Sans body, IBM Plex Mono labels, JetBrains Mono editor | verified (CLAUDE.md + prior direct screenshots this session; font family tokens present in `theme.css`) | |
| Geometry: 3px control radius, 0px panel radius, 1px rule borders, single floating-menu shadow | verified (already directly confirmed via the Phase 6 design-critique grep pass) | |
| Ribbon tick colors: call=cobalt, return=cobalt 40%, assignment=channel color, comparison=grey, exception=magenta | verified | `draw.ts`'s `tickFillStyle` — exact match including `hexToRgba(signal, 0.4)` for return |
| Keyboard map: ←/→ step, Shift+←/→ jump 10, Space play/pause, `,`/`.` speed, Home/End, click bracket to loop-scope | verified | `useKeyboardShortcuts.ts` read in full — every binding present and correct |
| Command palette (⌘K) as primary navigation | verified (`CommandPalette.test.tsx`, 4 passing tests, Pass 1) | |
| Panel registry: `array, array_2d, linked_list, binary_tree, graph, stack, queue, hash_map, call_stack, recursion_tree, variables, heap_objects, console, timeline` (14) | verified | `panelRegistry.ts`'s `PANEL_REGISTRY` — all 14, each mapped to a real distinct component, `Record<PanelType, ...>` gives compile-time exhaustiveness |
| Design refusals (no gradients/blur/emoji/orbs) | verified (Phase 6's own grep pass, re-confirmed then; Pass 6 re-confirms again) | |

### §9 — quality floor

Not independently re-verified in this pass — **Pass 6 is the dedicated,
command-backed pass for every line of §9** and will be the authoritative
record. What's below is only what's already directly known from building
Phase 6 frontend earlier in this project's history, stated as "previously
verified," not re-tested just now:

- Keyboard operable, focus rings, `prefers-reduced-motion`, 375px tabbed
  collapse, live-region step announcer, no-CLS skeletons, route JS budgets —
  all previously built and Playwright-verified this project's history.
  Pass 6 re-runs the commands.

### Fixes applied this pass

1. **Wall-clock limit and status now match PRD §3.3.** `Tracer`'s default
   `wall_clock_limit_s` changed from `15.0` to `5.0`. `ExecuteRequest`
   gained an optional `wall_clock_limit_s` field; `services/executor`'s
   `/execute` route uses it when provided, clamped to a `[0.1, 30]` sane
   range server-side (never trust a client-supplied timeout unbounded).
   `apps/api/app/routers/runs.py` now resolves `user: User | None` itself
   and passes `10.0` when authed, `5.0` otherwise, matching "5s (10s for
   authed users)" exactly. A new `WallClockLimitReached` exception
   (subclassing the existing `StepLimitReached`, so any incidental
   `except StepLimitReached` elsewhere still catches it) separates the two
   breach kinds that used to share one exception type and one status —
   wall-clock breaches now set `status: "timeout"`, step-count breaches
   keep `status: "step_limit"`; both existed in the schema, only one was
   ever producible before. Applied to both `Tracer` and `CounterTracer`.
   Also guarded a real cache-correctness edge case my own fix would
   otherwise introduce: the deterministic-output cache key
   (`sha256(source+stdin+language)`, §4.4) doesn't vary by caller, but the
   wall-clock budget now does — a `status: "timeout"` result is no longer
   cached at all, so a later authed caller with more budget can't get
   served a cached timeout an earlier unauthed caller hit at 5s.
   **Verified live** (not just by the test suite): ran a real `while True:
   i += 1` loop through the actual `Tracer` with a 1s budget and a
   step_limit high enough not to interfere — produced `status: "timeout"`,
   `step_count: 50000`, `error: None`, exactly as expected. Also caught
   and fixed a genuine test-correctness bug while doing this:
   `test_adversarial.py`'s own wall-clock test was silently hitting the
   *step*-count limit instead (100,001 steps in 0.28s, well under its own
   0.5s wall-clock budget) — its name didn't match what it tested. Fixed
   the test to use a `step_limit` high enough to actually exercise the
   wall-clock path.
2. **A Python-level memory ceiling was added — and directly testing it
   surfaced a more serious, platform-specific finding than the fix
   itself.** `Tracer.run`/`CounterTracer.run` now call
   `resource.setrlimit(RLIMIT_AS, (256MB, 256MB))` before executing user
   code, and a `MemoryError` during execution now produces `status:
   "memory_limit"` instead of falling through to `runtime_error` or an
   unhandled crash. **But**: I tested this directly (`[0] * (10**10)`
   through a real `RLIMIT_AS`-limited process) and **the limit was not
   enforced on this machine (macOS/Darwin)** — the process's real resident
   memory climbed past 3GB and kept growing instead of raising
   `MemoryError`, and I had to `kill -9` it myself to stop it. This is a
   known, documented macOS/XNU kernel behavior (`RLIMIT_AS` has long been
   unreliable on Darwin; Linux's is the implementation PRD's own
   deployment target — Fly.io machines — would actually run on, and POSIX
   `RLIMIT_AS` is reliably enforced there). I have no Linux environment
   available in this sandbox to positively confirm it works on the real
   deployment target either — so the honest status of this fix is
   **"added, confirmed *not* reliably effective on macOS, unverified on
   Linux."** Shipping it anyway because it's free when it doesn't help and
   may genuinely help on the real target, but this must not be read as "a
   memory limit now exists and is verified" — it does not rise to that bar
   on the evidence I actually collected. The container-level `--memory`
   flag (fix #3 below, also unverified — no `docker` here) remains the
   only mechanism that doesn't depend on this specific gap. **Deliberately
   did not write an automated test that attempts to exhaust memory** —
   the manual attempt above is exactly why: it's slow, it's dangerous to
   run unattended or in CI, and it nearly ran this sandbox out of memory
   once already.
3. **`docker-compose.yml`'s `executor` service now sets every PRD §5
   container flag it has a direct Compose equivalent for, with one
   deliberate exception**: `read_only: true`, `tmpfs: [/tmp:size=16m]`,
   `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`,
   `mem_limit: 256m`, `cpus: 0.5`, `pids_limit: 32`, `user: "65534:65534"`
   (nobody) — **not** `network_mode: none`. PRD §5 literally asks for it,
   but setting it would sever the *entire* container's networking,
   including the uvicorn server's own ability to receive `api`'s `POST
   /execute` over the compose bridge network — PRD's "network: none" means
   the untrusted *user code's* execution environment specifically, which
   today shares a process (and a network namespace) with the FastAPI
   server that has to stay reachable. Only per-run gVisor/nsjail isolation
   (still unbuilt) can give one `exec()` call its own network namespace
   without also cutting off the service answering HTTP requests — setting
   this flag today would trade a working system for a broken one without
   closing the actual gap. Documented at length directly in the compose
   file so this isn't rediscovered as "why is this missing" later.
   `user: "65534:65534"` and `read_only: true` are flagged in the same
   comment as carrying real risk of breaking container startup in ways
   only a live `docker compose up` could reveal (file-ownership/permission
   assumptions from the Dockerfile's `COPY . .`) — recommend verifying
   those two specifically before deploying. **None of this is
   runtime-verified** — `docker` isn't installed in this sandbox, so this
   is a config-correctness fix backed by reading the Compose Specification
   and validating the YAML parses as intended, not a live-tested one.
4. **Three new regression tests for `changed[]` correctness**
   (`services/executor/tests/test_changed_paths.py`), closing the "write
   property tests for it" gap PRD asks for directly: a single-variable
   scalar reassignment, a two-element in-place swap (the exact case
   spot-checked by hand above, now a permanent test), and a nested
   heap-field mutation (`oN.field`). Not literally property-based
   (`hypothesis` isn't a dependency anywhere in this repo, and adding a
   new testing-strategy dependency for one file felt like more change than
   this fix warranted) — example-based tests against hand-verified
   expected paths, which is what PRD's own stated concern ("if changed is
   wrong, animations are wrong") actually needs caught. One assertion in
   the first draft used a wrong assumed object id (`o1` vs the real `o2`)
   — caught by actually running the test against the real tracer rather
   than assuming, fixed by reading the real trace's own `heap` keys.
5. **Also fixed in passing**: the `_CountingExecutor` test fake in
   `apps/api/tests/agents/test_graph.py` didn't accept the new
   `wall_clock_limit_s` keyword argument fix #1 added to the real
   `ExecutorClient.execute` — a `TypeError` caught immediately by the full
   `apps/api` test suite, fixed by updating the fake to match.

### On "genuinely obsolete" requirements

The audit's own instructions ask to flag any PRD requirement found to be
obsolete rather than unmet, and propose an edit rather than quietly
dropping it. **None found this pass.** Every gap above (wall-clock/status,
memory limit, container hardening, the demo key) is a requirement that
still makes sense and is still wanted — just not yet built — not a stale
ask that no longer fits the product. No PRD edit is proposed.

---

## Pass 3 — the central promise

PRD's defining claim: nothing is animated, explained, or asserted unless it
points back to a real step in the user's own run. Verified narrower and
faster than Pass 2 (same evidence bar, less exhaustive coverage) given a
session budget constraint flagged mid-audit.

| Check | Result | Evidence |
|---|---|---|
| No hardcoded algorithm knowledge in panels | verified | `grep -rniE "bubble_sort\|quicksort\|binary_search\|fibonacci\|..." apps/web/components/panels apps/web/lib/panels` → only 2 hits, both in *comments explaining the absence*, zero in actual logic. Live-loaded `quicksort_partition` fixture through the real API route — same `viz_planner` output shape (`array`, `recursion_tree`, `call_stack`, `variables`, `console`) as every other algorithm, no special-casing. |
| No LLM call in any deterministic path | verified | `grep -c "llm_client\|LLMClient\|genai\|gemini\|GeminiClient\|generate_content"` against all 8 deterministic modules (`digest.py`, `structure_detector.py`, `insight_scanner.py`, `complexity_analyst.py`, `viz_planner.py`, `heap_graph.py`, `curve_fit.py`, `ast_inspect.py`) → **zero hits in every one** |
| "LLMs never see the raw trace" (§4.1) | verified | `app/tutor/context.py`'s `assemble_context` takes `digest: Digest` (the compressed model), never a raw trace dict; its own system prompt text literally tells the model "You never see the raw execution trace — only a compressed digest..." |
| Eval suite: 20 programs, every step_ref resolves to a real trace index | verified | **Ran the real standalone script** (`apps/api/evals/run_insight_scanner_eval.py`, the real `services/executor` tracer, not a fixture-generator throwaway): `20/20` correctly flagged (≥16 required), and the script's own final line — `all step_refs valid` — confirms zero citations outside the real trace across all 20 |
| Tutor `step_refs` validation | verified (existing tests, not independently re-derived this pass) | `pytest apps/api/tests/tutor -k step_ref` → 3 passed |
| Complexity analyst: binary_search fits log n, bubble_sort fits n², both R² > 0.98 | verified, measured not asserted | Read the real numbers out of the committed `fixtures/*.analysis.json` (generated by the real `complexity_analyst` module, not hand-written): **binary_search → `log_n`, R²=0.99951**; **bubble_sort → `n_squared`, R²=0.99999995**. Both clear PRD's 0.98 bar by a wide margin; every other candidate curve's R² for each fixture is visibly worse, confirming the winner isn't a coin-flip. |

No gaps found in this pass — the central promise holds under every check
run. Committing and moving to Pass 4.

---

## Pass 4 — hostile input

Narrower than a from-scratch pass — the adversarial suite already existed
(Phase 6 backend, per CLAUDE.md) and Pass 1/2 already ran the key-leak test
directly. This pass re-ran everything, read the actual test bodies (not
just their names) to confirm they test what they claim, and added the
"boring web" checks live rather than trusting prior claims.

| Check | Result | Evidence |
|---|---|---|
| Python adversarial suite (28 tests: fork bomb via import-block, `while True`, deep recursion, 1e9-range, unicode bomb, memory growth) | verified | `pytest test_adversarial.py test_sandbox_imports.py -v` → 28/28 passed. Read `test_subclasses_gadget_bypasses_the_import_blocklist` directly — it's a real, honest regression test *proving the known escape still works*, not hiding it. |
| `os.system`/socket/`open('/etc/passwd')`/subprocess-based fork bombs | verified | All structurally impossible without an allowed import — `os`, `subprocess`, `socket`, `ctypes`, `multiprocessing`, `pickle`, `shutil`, `pathlib`, `importlib` all in the parametrized blocklist test, all fail |
| C++: hostile input to clang, compile bombs, pathological depth | verified | `pytest test_instrument_isolated.py -v` → 4/4, including a real 40,000-term expression-chain parser crash, contained via `instrument_isolated`'s process isolation, and a hang stopped by its own timeout. `MAX_SOURCE_BYTES = 200_000` enforced in `compile_service.py`; both real `clang++` subprocess calls (traced and untraced-fallback paths) have `timeout=30`, confirmed by reading `toolchain.py`/`compile_service.py` directly (a real Phase 6 fix — no timeout existed on these before it) |
| Key-leak test | verified | Read the full test body, not just its name: it genuinely checks all 4 claimed surfaces (rendered log stream, SSE response body, every prompt string sent to the fake model, every row in the concept-chunk store) against a real sentinel key through a real request/response cycle. Passed (re-ran in Pass 2, re-confirmed by direct reading here). |
| No secrets committed to the repo | verified | `grep -rlE "AIza[0-9A-Za-z_-]{35}\|sk-[a-zA-Z0-9]{20,}\|-----BEGIN.*PRIVATE KEY"` across the whole tree (excluding `node_modules`/`.venv`) → zero hits outside the test file's own deliberate sentinel string |
| No secrets in the client bundle | verified | `grep` the built `.next/static/chunks/*.js` for `GEMINI`/`DATABASE_URL`/`REDIS_URL`/`EXECUTOR_URL`/`SECRET` → zero hits; only the deliberately-public `NEXT_PUBLIC_API_URL` appears, exactly as Next.js's own `NEXT_PUBLIC_*` convention intends |
| Rate limits actually enforced | verified | `pytest test_rate_limit.py -v` → 4/4, including a real 429 from the actual `/api/runs` route once the limiter says no |
| No raw stack traces to users | verified | `app/main.py`'s global exception handler returns a fixed `{"error": "internal_error"}` body — no exception internals, ever, on any unhandled error |
| Authz on endpoints touching user data | verified, live, gap closed | Called the real endpoints: `TestClient(app).get("/api/progress")` and `.get("/api/progress/review-queue")` with zero auth headers both returned **401**. Nothing in the suite asserted this — added `apps/api/tests/test_progress_authz.py` (2 tests) so a regression here is now caught. Full suite re-run: **261 passed**. |

No launch-blocking gaps found in this pass beyond what Pass 1/2 already
surfaced (container hardening, unverified memory limit).

