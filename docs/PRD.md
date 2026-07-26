# OOCC — Product Requirements Document

**Version** 1.0 · **Owner** Naunidh + 1 · **Status** Ready for build
**Purpose of this doc:** hand this to Claude Code / Antigravity as the standing context file. Every build prompt in `OOCC-Build-Prompts.md` assumes this document is in the repo at `/docs/PRD.md` and referenced from `CLAUDE.md`.

---

## 1. Product

OOCC is a visual execution environment for learning computer science. The user writes or pastes their own code, supplies their own inputs, and the platform produces a **step-by-step execution trace** that drives every visualization, explanation, complexity estimate, and tutor response on screen.

**The one rule that defines the product:** nothing is ever animated, explained, or claimed unless it can be pointed back to a specific step index in the trace of the code the user actually ran. No canned demos. No LLM-invented behaviour. The trace is the single source of truth.

### 1.1 Who it is for

| Segment | Primary job | What they need most |
|---|---|---|
| Beginners (sem 1–2) | "Why did my loop do that?" | Variable + line highlighting, plain-language step narration |
| DSA / interview prep | Build intuition for 30 core algorithms | Structure-aware visuals, complexity comparison, pattern naming |
| Educators | Demonstrate live in class | Shareable trace permalinks, projector mode, no login to view |
| Working devs | Debug unfamiliar code | Paste-and-trace, call stack + heap inspection, diff two runs |

### 1.2 Non-goals for v1

- Not a competitive judge (no leaderboards, no contests, no plagiarism detection).
- Not a full IDE (no multi-file projects, no package installs, no filesystem).
- Not a chatbot with a code editor bolted on. The tutor is a panel inside a workspace, never the main surface.

### 1.3 Success criteria

- Trace a 200-line Python program with ≤ 50k steps in under 3 seconds p95.
- Time-to-first-visualization for a new visitor: under 20 seconds, zero signup, zero API key.
- Tutor answers cite at least one step index in ≥ 95% of responses about the user's code.
- Zero sandbox escapes. Non-negotiable.

---

## 2. System architecture

```
┌──────────────────────────────────────────────────────────────┐
│  web (Next.js 15, App Router, TS)                            │
│  editor · trace player · viz engine · tutor · curriculum      │
└───────────────┬───────────────────────────┬──────────────────┘
                │ REST + SSE                │
┌───────────────▼───────────────────────────▼──────────────────┐
│  api (FastAPI)                                               │
│  auth · runs · problems · progress · agent orchestration      │
└───┬──────────────┬─────────────────┬──────────────┬──────────┘
    │              │                 │              │
┌───▼────┐   ┌─────▼──────┐   ┌──────▼──────┐  ┌────▼────────┐
│Postgres│   │Redis        │   │ executor    │  │ agents      │
│+pgvector│  │queue+cache  │   │ (isolated)  │  │ (LangGraph) │
└────────┘   └─────────────┘   └─────────────┘  └──────┬──────┘
                                                        │
                                              ┌─────────▼────────┐
                                              │ Gemini 2.5 Flash │
                                              │ (user's API key) │
                                              └──────────────────┘
```

### 2.1 Stack decisions and why

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind | You already ship Next.js; RSC for content pages, client islands for the workspace |
| Editor | CodeMirror 6 | Half the bundle of Monaco, far better on mobile, easier decorations API for line highlighting |
| Playback state | Zustand + `useSyncExternalStore` | Trace playback is 60fps scrubbing over up to 50k steps; React context will not survive it |
| Animation | Motion (framer-motion) for layout, raw SVG + d3-hierarchy/d3-force for trees and graphs | Layout animations are declarative; graph layout math is not |
| API | FastAPI + Pydantic v2 | Matches your stack; Pydantic models are the contract source |
| Data | Postgres 16 + pgvector | Progress, submissions, and curriculum are relational; pgvector for tutor RAG. Mongo is acceptable but you will regret it at the analytics stage |
| Queue/cache | Redis + RQ (or Celery) | Execution is a job, not a request. Also the trace cache |
| Sandbox | Dedicated container, gVisor (`runsc`) or nsjail | The single largest risk surface in this product |
| Agents | LangGraph | Explicit state graph, native streaming, checkpointing, parallel nodes, easy to inspect. LangChain chains are too loose for this; raw function calls are too rigid |
| LLM | Gemini 2.5 Flash via `google-genai` SDK | User-supplied key; structured output + thinking budget control |

### 2.2 Monorepo layout (this is what keeps two people from colliding)

```
oocc/
├─ CLAUDE.md                 # agent instructions, both of you edit
├─ docs/PRD.md               # this file
├─ packages/
│  └─ contracts/             # ⚠️ SHARED — changes need both people to agree
│     ├─ trace.schema.json   # canonical JSON Schema
│     ├─ viz-plan.schema.json
│     ├─ openapi.json        # generated from FastAPI
│     ├─ python/             # Pydantic models
│     └─ ts/                 # generated TS types (json-schema-to-typescript)
├─ apps/
│  ├─ web/                   # Person A owns
│  └─ api/                   # Person B owns
├─ services/
│  └─ executor/              # Person B owns
└─ fixtures/                 # ⚠️ SHARED — golden traces for 12 programs
```

`fixtures/` is the reason frontend can be built to completion before the backend exists. Twelve committed, hand-verified trace JSON files (bubble sort, binary search, fibonacci recursion, BFS on a graph, linked list reversal, two-sum with a dict, quicksort partition, N-queens backtracking, DP knapsack, a deliberate infinite loop, a program that throws, a program with 40k steps). Frontend develops against these. Backend's job is to emit files that match them byte-for-byte in shape.

---

## 3. The execution trace contract

This is the most important section. Both people implement against it; neither changes it alone.

### 3.1 Format

```jsonc
{
  "schema_version": "1.0",
  "run_id": "r_8f2c...",
  "language": "python",
  "source_hash": "sha256:...",
  "status": "ok" | "runtime_error" | "timeout" | "step_limit" | "memory_limit" | "compile_error",
  "meta": {
    "duration_ms": 412,
    "step_count": 1840,
    "truncated": false,
    "stdin": "5\n1 2 3 4 5",
    "peak_heap_objects": 92
  },
  "error": {
    "type": "ZeroDivisionError",
    "message": "division by zero",
    "line": 12,
    "step": 1839,
    "traceback": ["...frames..."]
  },
  "steps": [ /* Step[] */ ]
}
```

### 3.2 Step object

```jsonc
{
  "i": 412,                       // step index, 0-based, monotonic
  "event": "line" | "call" | "return" | "exception" | "stdout",
  "line": 17,                     // 1-based line in source
  "func": "binary_search",
  "depth": 2,                     // call stack depth
  "stack": [                      // index 0 = outermost frame
    {
      "frame_id": "f0",
      "func": "<module>",
      "line": 34,
      "locals": { "arr": {"ref":"o1"}, "target": {"val": 7} }
    },
    {
      "frame_id": "f7",
      "func": "binary_search",
      "line": 17,
      "locals": { "lo": {"val":0}, "hi": {"val":9}, "mid": {"val":4} },
      "args": ["arr","lo","hi","target"],
      "call_site_line": 34
    }
  ],
  "heap": {                       // full snapshot of reachable non-primitives
    "o1": {"type":"list","len":10,"items":[{"val":1},{"val":3},{"ref":"o5"}]},
    "o5": {"type":"TreeNode","fields":{"val":{"val":8},"left":{"ref":"o6"},"right":null}}
  },
  "stdout_delta": "",
  "changed": ["f7.mid", "o1[4]"], // ⚡ drives every highlight animation
  "returned": {"val": 4}          // present only on event=="return"
}
```

**Value encoding.** Primitives inline as `{"val": <json>}`. Everything else is `{"ref": "oN"}` into `heap`. `null` is `{"val": null}`; a Python `None` is `{"val": null, "repr": "None"}`. Cycles are safe because references are by id.

**Heap object types** the frontend must handle: `list`, `tuple`, `dict`, `set`, `str` (when > 40 chars), `object` (with `fields`), `function`, `instance` of a user class. Anything unknown degrades to `{"type":"opaque","repr":"<...>"}` and renders as a grey chip.

**`changed`** is the animation contract. Paths are `frame_id.local`, `oN[index]`, `oN.field`, `oN{key}`. If `changed` is wrong, animations are wrong — write property tests for it.

### 3.3 Limits (enforced in the executor, reported in `meta`)

| Limit | Value | Behaviour on breach |
|---|---|---|
| Wall clock | 5s (10s for authed users) | `status: timeout`, return partial trace |
| Steps recorded | 100,000 | `status: step_limit`, `truncated: true`, keep first 40k + last 10k |
| Memory | 256 MB | `status: memory_limit` |
| stdout | 256 KB | truncate with a marker step |
| Heap objects per step | 5,000 | stop deep-snapshotting, mark `heap_truncated` |
| Processes | 1 (pids-limit 32) | kill |
| Network | none | interface removed |

### 3.4 Wire optimisation (Phase 6, not before)

Full heap snapshots per step are simple and correct; they are also large. Ship v1 with full snapshots gzip'd (they compress ~20:1 because consecutive steps are near-identical). In Phase 6, switch to a keyframe scheme: every 50th step is a full snapshot, intervening steps are RFC-6902 JSON Patch deltas. The frontend player reconstructs by walking from the nearest keyframe. Design the frontend store behind a `getStateAt(i)` selector from day one so this swap is invisible to components.

---

### 3.5 Second language: C++ (Phase 4)

Python ships first because `sys.monitoring` hands us line events, frames, and locals for free — it proves the contract in days, not weeks. C++ is the second engine, and it is the one that matters most for the DSA audience. It produces **the same trace contract**; nothing in §3.1–3.3 changes.

C++ has no runtime introspection, so the trace has to be compiled in.

**Rejected: GDB/MI driving.** Correct and language-complete, but 1–5k steps/sec means a bubble sort on 30 elements takes tens of seconds. Wrong latency for a scrubbable player.

**Chosen: Clang source-to-source instrumentation, compiled to WASM.**

```
source.cpp
  └─ [executor] clang LibTooling pass ──▶ instrumented.cpp
  └─ [executor] wasi-sdk / emcc -Os    ──▶ program.wasm   (cached by source_hash)
  └─ [browser worker] execute          ──▶ trace (§3.1)
```

Note what this buys beyond speed: **the server never executes user code**. It runs a compiler on it. Execution happens inside the browser's own WASM sandbox. The §5 risk surface shrinks to "clang on hostile input," which is a far smaller problem than "arbitrary native code on our hardware."

**What the LibTooling pass injects:**

| Injected at | Call | Produces |
|---|---|---|
| Every statement | `__oocc_step(line, col)` | a `line` step |
| Function entry/exit | `__oocc_enter(name, args…)` / `__oocc_exit(ret)` | `call` / `return` steps, `depth`, `stack` |
| Every declaration | `__oocc_bind(name, &var, type_tag)` | frame `locals`, address→name table |
| `new` / `malloc` / `delete` / `free` | interposed allocator | heap object ids (`oN`), lifetime tracking |
| Every `BinaryOperator` on a container element | `__oocc_access(base, index, kind)` | entries in `changed`, and comparison events |

The address→object-id table is what makes pointers work. A raw `Node*` becomes `{"ref":"o7"}` exactly like a Python reference, so the linked-list and binary-tree panels built in Phase 2 render C++ structures with **zero frontend changes**. Pointers actually visualize *better* than Python here, because aliasing is explicit in the source and the learner is already trying to reason about it.

**STL pretty-printers.** Without these, users see `_M_start` and `_M_finish` and the product is worthless. Ship printers that project into §3.2 heap types for: `vector`, `string`, `array`, `pair`, `map`, `unordered_map`, `set`, `unordered_set`, `deque`, `stack`, `queue`, `priority_queue`, `list`, `optional`. Anything else degrades to `{"type":"opaque"}`.

**The teaching subset.** The pass will not survive heavy template metaprogramming, and it should not try. Define a supported subset — C++17, single translation unit, the STL above, classes, structs, references, raw and smart pointers, operator overloading, simple templates — and detect violations at compile time with a specific diagnostic: *"OOCC can't trace variadic templates yet. This program will still compile and run, but without step data."* Offer to run it untraced rather than refusing.

**Crashes are a feature.** An out-of-bounds write becomes a WASM trap. Catch it, return the partial trace with `status: runtime_error`, and land the player on the last good step. Being able to *watch* a buffer overrun walk off the end of a `vector` is a lesson no textbook delivers.

**Targets.** Cold compile ≤ 2s p95, warm (cache hit on `source_hash`) ~0ms. Instrumented execution within 20× of native — for a 30-element sort that is still microseconds. Same 100k step cap as Python.

**Build order inside Phase 4:** allocator interposition and the address table first, then statement/function instrumentation, then STL printers, then diagnostics. Do not start on templates.

---

## 4. The agentic pipeline

### 4.1 Principle

LLMs never see the raw trace. A deterministic **digest** step compresses a 50k-step trace into ~2 KB of structured facts, and agents reason over that. This is what makes the pipeline cheap, fast, and honest.

### 4.2 Graph (LangGraph, `StateGraph`)

```
                          ┌──────────────┐
  trace ────────────────► │  digest      │  deterministic, no LLM
                          └──────┬───────┘
                     ┌───────────┼────────────┬──────────────┐
                     ▼           ▼            ▼              ▼
              ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐
              │structure_ │ │insight_ │ │complexity│ │ algorithm_  │
              │ detector  │ │ scanner │ │ _analyst │ │ classifier  │
              └─────┬─────┘ └────┬────┘ └────┬─────┘ └──────┬──────┘
                    └────────────┴───────────┴──────────────┘
                                        │
                                 ┌──────▼───────┐
                                 │ viz_planner  │  validated against panel registry
                                 └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │  narrator    │  step-range summaries
                                 └──────────────┘

  separate entrypoint, reads the same state:
                                 ┌──────────────┐
  user question ───────────────► │   tutor      │ ──► SSE stream
                                 └──────────────┘
```

### 4.3 Node specifications

**`digest`** — pure Python, no LLM. Produces:
- Loop skeleton: `[{line_range:[4,9], iterations: 12, vars_mutated:["lo","hi","mid"]}]`
- Variable histories, downsampled to ≤ 40 samples each
- Call graph + recursion depth histogram
- Heap shape signature (`list<int>[10]`, `dict<str,int>`, `TreeNode{val,left,right}` → "binary tree, depth 4, 15 nodes")
- Hot lines (execution count per line)
- Terminal state + stdout tail

**`structure_detector`** — deterministic rules first (a class with `left`/`right`/`next` fields, an adjacency dict, a list used with `append`/`pop` only → stack). LLM only as a fallback when rules score below threshold. Output: `[{kind:"binary_tree", root_ref:"o5", confidence:0.94}]`.

**`algorithm_classifier`** — Gemini 2.5 Flash, structured output, `thinking_budget: 0`. Input: digest + source. Output: `{algorithm, family, confidence, evidence_steps:[int]}` where `evidence_steps` must reference real indices — validate and retry once if not.

**`complexity_analyst`** — deterministic core: re-run the program in the executor across generated input sizes (n = 10, 50, 100, 500, 1000), record step counts, fit against candidate curves (1, log n, n, n log n, n², n³, 2ⁿ), report R². LLM only writes the one-paragraph explanation and names the dominant operation. This is the feature that makes OOCC credible — an empirically measured curve, not a guess.

**`insight_scanner`** — deterministic detectors, LLM narration:
| Detector | Signal in trace |
|---|---|
| Infinite / runaway loop | step_limit hit + loop var unchanged across ≥ 500 steps |
| Off-by-one | index access at `len(x)` boundary, or loop touching `len-1` when `len` expected |
| Mutation during iteration | container `changed` while a frame is iterating it |
| Accidental O(n²) | string concat in a loop, `list.insert(0,..)`, `in` on a list inside a loop |
| Shadowed builtin | local name matches a builtin |
| Dead variable | assigned, never read before scope exit |
| Redundant recomputation | identical call args recurring (memoization opportunity) |

**`viz_planner`** — chooses which panels to mount and how to bind them. Must emit only panel types present in a hardcoded registry; validate and drop hallucinated types. Output:

```jsonc
{
  "layout": "primary+stack",
  "panels": [
    {"id":"p1","type":"array","binding":"o1","role":"primary",
     "annotations":[
       {"kind":"pointer","label":"lo","bind":"frame.lo"},
       {"kind":"pointer","label":"hi","bind":"frame.hi"},
       {"kind":"window","from":"frame.lo","to":"frame.hi"}]},
    {"id":"p2","type":"call_stack"},
    {"id":"p3","type":"variables"}
  ]
}
```

Panel registry v1: `array`, `array_2d`, `linked_list`, `binary_tree`, `graph`, `stack`, `queue`, `hash_map`, `call_stack`, `recursion_tree`, `variables`, `heap_objects`, `console`, `timeline`.

**`tutor`** — the only streaming node. Context assembled per question:
1. System prompt (Socratic, refuses to give a full solution unless asked twice)
2. Digest
3. **Step window**: the 5 steps around the user's current scrubber position, rendered as compact text
4. RAG: top-3 curriculum chunks from pgvector
5. Last 6 turns

Output must include `step_refs: number[]`. Frontend renders those as clickable chips that scrub the player. If a response has zero step_refs and the question was about the user's code, retry once with a stronger instruction.

### 4.4 Cost and caching

- Cache key: `sha256(source + stdin + language)` → full trace **and** all deterministic agent outputs, in Redis, 7-day TTL. A returning user on the same program costs zero LLM calls.
- Deterministic nodes (`digest`, `insight_scanner`, `complexity_analyst` core) never call the LLM. Roughly 60% of the pipeline's output is free.
- Gemini 2.5 Flash with `thinking_budget: 0` for classification, `thinking_budget: 1024` for the tutor only.

### 4.5 Bring-your-own key handling

- Key lives in `localStorage`, sent per-request as `X-Provider-Key`.
- Server: request-scoped only. **Never** written to a database, never logged, never included in error reports. Add a logging filter that redacts anything matching the key pattern.
- No key present → deterministic features all still work (trace, visualization, complexity, insight detection). Only the tutor and the narrator degrade. Say so in the UI as an affordance, not a paywall nag.
- Platform-provided demo key: 10 tutor messages/day/IP, rate-limited at the edge.

---

## 5. Sandbox — the risk section

Treat every line of user code as hostile.

- Executor runs as a **separate service**, never in the API process, never in the API container.
- gVisor (`runsc`) runtime, or nsjail inside a minimal container.
- `--network none`, read-only rootfs, `tmpfs /tmp` sized 16 MB, `--cap-drop ALL`, `--security-opt no-new-privileges`, non-root uid, `--pids-limit 32`, `--memory 256m`, `--cpus 0.5`.
- Tracer implemented with `sys.monitoring` (PEP 669, Python 3.12+) — roughly 5× faster than `sys.settrace`. Fall back to `settrace` only if you need 3.11 support.
- Blocklist at import time: `os`, `subprocess`, `socket`, `ctypes`, `importlib`, `builtins.__import__` override. Allowlist: `math`, `random` (seeded), `collections`, `heapq`, `bisect`, `itertools`, `functools`, `string`, `typing`, `dataclasses`, `re`.
- Container is destroyed after every run. No reuse, no warm pool sharing state.
- Write an adversarial test suite in Phase 1: fork bomb, `while True`, 10 GB allocation, deep recursion, `open('/etc/passwd')`, socket connect, `os.system`, unicode bomb, 1e9-element range. Each must fail safely and produce a useful error to the user.

---

## 6. Design direction

The brief says "must not look like a generic AI website." That rules out: purple-to-blue gradients, glassmorphic cards floating on a dark void, a cream background with a big serif headline, orbs, and "✨ Powered by AI" badges.

### 6.1 The concept: a logic analyzer

OOCC's subject world is instrumentation — debuggers, oscilloscopes, logic analyzers, film-editing timelines, telemetry consoles. Things that show you a signal over time and let you scrub it. That is literally what the product does. The interface should feel like a well-built measuring instrument: dense, calm, precise, no chrome that isn't carrying information.

### 6.2 Tokens

**Color** — light mode is primary (people learn on projectors and in bright rooms), dark mode is a first-class second.

```
--paper        #EDF0F3   cool grey-blue ground, not cream
--panel        #FFFFFF
--rule         #D2D9E0   1px hairlines, the main structural device
--ink          #0E1116
--ink-soft     #5A6572
--signal       #1B4DE4   cobalt — interactive, current step, focus rings
--mutate       #D6006E   magenta — the value that just changed. Used ONLY for that.
--ok           #0B7A4B
--warn         #B45309
```

**Channel colors** — the one place with real chroma. Every variable in a trace is assigned a stable channel color the way a logic analyzer assigns colors to probes. Same variable = same color in the editor gutter, the variables panel, the array bars, and the timeline. This is not decoration; it is the mechanism that lets the eye follow one value across four panels.

```
ch1 #1B4DE4  ch2 #D6006E  ch3 #0B7A4B  ch4 #B45309
ch5 #6D28D9  ch6 #0E7490  ch7 #BE123C  ch8 #4D7C0F
```

**Type**

- Display: **Chivo** (600/700) — grotesque with engineering flatness. Used at large sizes only, tight tracking (-0.02em).
- Body/UI: **Public Sans** 400/500.
- Data & labels: **IBM Plex Mono** 500, uppercase, 11px, +0.06em tracking. All panel headers, step counters, and complexity notation use this.
- Editor: **JetBrains Mono** 400/14px/1.6.

Not Inter everywhere. Not a serif display. The mono-for-labels choice is what gives the whole thing its instrument feel.

**Geometry**: 3px radius on controls, 0px on panels. 1px `--rule` borders everywhere; no shadows except a single 0 1px 2px on floating menus. 4px spacing base. Panels butt directly against each other with a shared hairline — like a rack-mounted instrument, not floating cards.

### 6.3 The signature element: the Trace Ribbon

A full-width horizontal ribbon pinned to the bottom of the workspace. Every execution step is a 2px tick. Ticks are colored by event: call (cobalt), return (cobalt 40%), assignment (channel color of the variable changed), comparison (grey), exception (magenta). Loop iterations render as nested brackets above the ticks; a 12-iteration loop reads as 12 visible repeating blocks. Recursion depth renders as vertical offset, so a recursive fibonacci looks like a mountain range.

Scrub it and every panel snaps to that step. Hover shows a mini-tooltip with line number and the changed value. Interaction: `←/→` step, `Shift+←/→` jump 10, `Space` play/pause, `,`/`.` speed, `Home/End`, click a bracket to loop-scope playback.

This is the thing people will screenshot. Everything around it stays quiet.

### 6.4 Layout

```
┌───────────────────────────────────────────────────────────────────┐
│ OOCC   run ▸   python ▾        binary_search · O(log n)  ⌘K │  40px bar
├──────────────────────────┬────────────────────────────────────────┤
│  1  def binary_search(   │  ┌──────────────────────────────────┐  │
│  2      lo, hi = 0, n-1  │  │ ARRAY · o1                       │  │
│▸ 3      while lo <= hi:  │  │  ▁▃▅█▅▃▁   lo↑      ↑hi          │  │
│  4          mid = ...    │  └──────────────────────────────────┘  │
│                          │  ┌───────────────┬──────────────────┐  │
│  gutter shows channel    │  │ CALL STACK    │ VARIABLES        │  │
│  color dots for vars     │  │ binary_search │ lo 0  hi 9  mid 4│  │
│  live on this line       │  │ <module>      │                  │  │
├──────────────────────────┴──┴───────────────┴──────────────────┴──┤
│ TRACE RIBBON  ▏▎▍▌▋▊▉█▉▊▋▌▍▎▏  step 412/1840    ◂ ▸ ⏵ 1×        │
├───────────────────────────────────────────────────────────────────┤
│ TUTOR  ▸ why does mid keep landing on 4?          [step 412] [418]│
└───────────────────────────────────────────────────────────────────┘
```

Resizable panes (`react-resizable-panels`), layout persisted. Command palette (`⌘K`) is the primary navigation — this is a tool, not a website.

### 6.5 What we take from LeetCode and GeeksForGeeks

- **LeetCode**: the split-pane workspace, the problem list with difficulty/tag/acceptance columns, sticky "Run" affordance, keyboard-first. Reject: the cramped 12px UI, the modal-heavy premium nagging, the tab overload.
- **GeeksForGeeks**: the article-plus-runnable-example pattern, deep interlinking between concepts, breadth of topic coverage. Reject: ad density, banner stacking, inconsistent typography, five CTAs per screen.
- **The gap neither fills**: on both, the explanation and the code are static text. In OOCC, every code block inside an article is a live trace you can scrub. That is the product's whole reason to exist — an article about quicksort has the actual partition steps embedded, running on your inputs.

### 6.6 Voice

Sentence case. Active verbs. Labels name what the user controls. Errors state what happened and what to do:
> "Execution stopped at 100,000 steps — line 8's loop never changes `i`. Jump to step 4,120 to see where it stalls."

Not "Oops! Something went wrong ✨".

---

## 7. Feature scope by release

| Phase | Backend | Frontend | Ships |
|---|---|---|---|
| 0 | contracts, fixtures, repo | design system, app shell | Nothing user-facing |
| 1 | Python executor + tracer + sandbox | editor, player, ribbon, array panel | A working trace |
| 2 | structure detection, complexity, run API | all 14 panels, layout engine | The visualization product |
| 3 | LangGraph pipeline, BYO key | tutor, insights, narration UI | The AI product |
| 4 | **C++ engine** (§3.5) | problems, curriculum, articles | The DSA product |
| 5 | accounts, progress, OOCC Lang emitters | dashboard, compare view, compiler explorer | The learning product |
| 6 | wire optimisation (§3.4), deploy | a11y, performance, landing | v1 |

**v1 surface:** Python and C++. Editor, trace, ribbon, all 14 panels, empirical complexity, insight scanner, tutor with BYO key, 40-problem library, 12 curriculum articles with embedded live traces, shareable run permalinks, progress dashboard, compare-two-runs, and the compiler explorer.

**The compiler explorer** (`/compiler`) exposes a full pipeline as a learning object: source → tokens → AST → bytecode → stack VM, with all five panes cross-highlighted, so hovering an opcode lights up its AST node, its token range, and its source characters. It rides on an existing stack-based VM in C++ — lexer, recursive-descent parser, AST, bytecode compiler, opcode-driven execution — so the work is instrumentation, not implementation: emit JSON at each stage behind an `OOCC_TRACE` build flag, tag every instruction with the AST node id that produced it and every AST node with its source span, compile to WASM so editing feels live. It sits in Phase 5 because it needs nothing from Phases 1–4 except the player, and because "why is `a + b * c` not `(a + b) * c`" is a lesson nobody else on the market teaches visually.

**Deliberately after v1:** JavaScript (Babel-instrumented), classroom mode (teacher broadcasts scrubber position), embeddable trace widget for blogs.

---

## 8. Data model (Postgres, abbreviated)

```
users(id, handle, email, created_at, settings jsonb)
runs(id, user_id?, source_hash, language, status, trace_url, meta jsonb, created_at)
problems(id, slug, title, difficulty, tags[], statement_md, starter_code, tests jsonb)
submissions(id, user_id, problem_id, run_id, passed, created_at)
concepts(id, slug, title, body_md, prereq_ids[])
concept_chunks(id, concept_id, content, embedding vector(768))
progress(user_id, concept_id, mastery real, last_seen_at, next_review_at)
insights(id, run_id, kind, severity, step_refs int[], message)
```

Traces are **not** stored in Postgres. Write them to object storage (S3/R2) as gzipped JSON, keep the URL in `runs.trace_url`, cache hot ones in Redis.

---

## 9. Quality floor

Non-negotiable for every phase's definition of done:

- Keyboard operable end-to-end; visible focus rings on `--signal`.
- `prefers-reduced-motion` respected — animations become instant state changes, not removed features.
- Responsive to 375px: workspace collapses to a tabbed single column (Code / Visual / Tutor), ribbon stays pinned.
- Screen reader: the current step announces as "Step 412, line 17, mid changed to 4" via a polite live region.
- No layout shift on trace load; skeleton panels reserve their space.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for the channel colors against `--panel`.
