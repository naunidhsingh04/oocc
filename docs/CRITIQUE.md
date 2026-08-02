# OOCC critique

Written after actually using the product as a learner would: cold, on the
real dev server, at 1280px and 375px, with no provider key set, timing
myself, screenshotting as I went. Every finding below was reproduced live
this session, not inferred from reading the code. Where I couldn't get
solid enough evidence for a claim, I left it out rather than guess.

---

## WHAT IS ACTUALLY WRONG

Ranked by how much learning the problem destroys, not by how easy it is
to fix.

**1. At the scale PRD itself names as a target case, the ribbon becomes
unreadable, and there is no way to find "when did X change" except
scrubbing by eye.**
Loaded `large_trace_40k` (39,976 steps) at 1280px. The ribbon
(`apps/web/components/ribbon/TraceRibbon.tsx`, tick binning in
`tickBins.ts`) compresses the whole run into ~1270px — one pixel-bin
covers roughly 31 real steps. A single click anywhere on it jumps
~32,000 steps. There is no search box, no "jump to next assignment of
this variable," no filter — I checked for any input with a
search/find-shaped placeholder and found none. A learner trying to
answer "when did `total` become negative" in a run this size has exactly
one tool: click somewhere, read the Variables panel, click again, repeat.
This is the single worst finding because it's the flagship interaction
PRD names by name (§6.3, "this is the thing people will screenshot")
failing at exactly the scale the product's own fixture set is built to
demonstrate.

**2. Two deterministic panels — Complexity and Insights — disappear
completely, with zero message, when they have nothing to report, rather
than saying so.**
Loaded `fibonacci_recursion`: no Complexity panel renders at all, and no
"No complexity measured" fallback text appears anywhere on screen —
confirmed by searching the whole page for that exact string and getting
zero matches, even though that fallback text exists in
`ComplexityPanel.tsx`'s own code; it never runs because
`Workspace.tsx`'s `hasComplexity || hasInsights` gate never mounts the
panel at all when `analysis.complexity` is null. Separately: submitted
the deliberately-buggy binary search on `/problems/binary-search` (0/2
failing, as designed) and opened "Visualize where it went wrong" — zero
Insights panel anywhere, confirmed by checking the page for the literal
string "INSIGHTS" and by checking the panel-registry's own "Add panel"
dropdown, which doesn't even list Insights as something addable (it's a
fixed pane, not a registry panel, so a user who suspects it might help
has no way to summon it either). For a product whose entire premise is
"nothing is claimed unless it's grounded in the trace," a silent absence
is the worst failure mode available: it reads exactly like confirmation
of correctness. A learner has no way to tell "the tool checked and found
nothing" from "the tool never checked."

**3. The off-by-one detector does not catch the exact bug shape PRD's own
test scenario asks for.**
`apps/api/app/analysis/insight_scanner.py`'s `_detect_off_by_one`. Directly
reproduced above — the deliberately-buggy `while lo < hi:` (should be
`while lo <= hi:`) produces zero insights. Per CLAUDE.md's own detector
table this rule is shaped for array-index/length-boundary access, not
while-loop-guard comparisons — arguably the *more* common shape of
off-by-one in exactly this class of algorithm. The panels still make the
bug findable (see "what's already good," #1) — but the one feature PRD
built specifically to name bugs for the learner is silent on the most
canonical example of the bug class it claims to detect.

**4. The problem workspace does not collapse to a single column at
375px — it's a structurally different layout that never got the same
treatment as the main workspace.**
`apps/web/components/problemWorkspace/` vs.
`apps/web/components/workspace/NarrowWorkspace.tsx` (which *does* collapse
correctly — verified live, screenshot below). At 375px on
`/problems/binary-search`, even inside the "Visualize" tab (which does
show its own internal Code/Visual/Tutor sub-tabs), the problem-statement
column stays permanently visible at roughly 40% of the 375px width,
squeezing the actual code/ribbon into ~210px. Source lines truncate
mid-token: `def binary_searc…`, `while lo < h…`. PRD §9's "workspace
collapses to a tabbed single column... at 375px" holds for one surface
and silently doesn't hold for a second, structurally similar surface that
PRD's own persona table (§1.1, "DSA / interview prep") names as a primary
use case — arguably the page this exact persona spends the most time on.

**5. The onboarding tour fires on first trace-load with no awareness of
what the user was just doing, and can sit directly on top of the thing
they just asked to see.**
`apps/web/components/workspace/OnboardingTour.tsx`. Reproduced: clicking
"Visualize where it went wrong" from a failed submission — a deliberate,
purposeful jump to a specific step — triggers the tour on its first
trigger condition (first trace load this browser session) and its
callout card sits over the source/panel area for as long as it takes to
click through or dismiss. Lower severity than the above four (it's
transient, dismissible, one-time) but it directly undercuts a
purpose-built "land exactly where the bug is" feature with a feature that
has zero model of user intent.

---

## WHERE THE INTERFACE FIGHTS THE PRD

The literal refusal list (gradients, `backdrop-blur`, emoji) is genuinely
clean — grepped it again this session, zero hits, consistent with every
prior check. The drift from §6.1's "instrument, dense, quiet" intent is
subtler than a token violation:

- **The onboarding tour is a generic-SaaS-product pattern, full stop, in
  form if not in color.** A floating spotlight callout with "1/4, Skip
  tour, Next" is the exact shape of onboarding used by nearly every
  consumer SaaS product built in the last five years. It doesn't violate
  any named refusal (no gradient, no blur, correct type tokens), but the
  *pattern itself* is the single most "looks like every other product"
  moment in the whole app, on the screen a brand-new user is guaranteed
  to see.
- **The top nav clips at 375px with no acknowledgment.** `Compiler` (and
  presumably anything after it) is cut off flush against the viewport
  edge with no hamburger menu, no scroll affordance, no truncation
  indicator — screenshotted directly. An instrument panel doesn't hide a
  third of its own controls and give no sign they exist; it either fits
  them or collapses them into a menu on purpose.
- **The same silent-absence problem from finding #2 is also a §6.1
  violation, not just a UX one.** A real instrument shows its dial even
  when the needle reads zero — a tachometer doesn't unscrew itself from
  the dashboard because the engine's off. Removing the whole panel
  because there's nothing to show is the interface behaving like a
  chatbot response that has nothing to say, not like an instrument.
- Ruled out, explicitly, so it isn't mistaken for a product issue later:
  the small circular "N" badge in the bottom-left of every screenshot is
  Next.js's own dev-mode devtools indicator, not app UI — it won't exist
  in a production build.

---

## THE FIRST SIXTY SECONDS

Timed and screenshotted live, cold browser, no prior interaction.

**0.0s** — `/` loads. Toolbar already shows "BUBBLE_SORT," a language
badge, a complexity badge, a Run button, a fixture dropdown. Below it,
briefly: an empty editor and "NO FIXTURE LOADED" — real, but brief on a
warm dev server (roughly half a second; unverified on a cold production
first-load).

**~0.6s–2s** — A real bubble-sort trace begins auto-playing: array bars
animating, the ribbon ticking forward, call stack and variables filling
in. This is the product doing exactly what PRD §9's landing-page
requirement asks — genuinely working, verified.

**~2s** — The onboarding tour interrupts: "1. YOUR CODE — This is a real
trace already running — edit it and OOCC re-traces every step." This is
the single most important sentence of onboarding in the entire product —
it's the only place, anywhere, that a new user is told the code is theirs
to change. The user now has to choose, with zero context: read the tour,
or read the code it's talking about — both compete for the same visual
region.

**A fork in what happens next:**
- If they click through all four steps, they get one sentence each about
  source, ribbon, panels, and tutor — reasonable content, delivered as a
  forced, one-directional sequence they can't reorder or revisit.
- If they skip (a very common, very human reflex, and the tour explicitly
  invites it with a same-weight "Skip tour" button right next to "Next")
  — they land on a live-playing bubble sort with no further guidance, and
  they have now permanently lost the one sentence that told them the code
  is editable. It never appears again anywhere in the static UI —
  confirmed by looking for any persistent hint text near the editor, the
  Run button, or the toolbar, and finding none. The tour is
  localStorage-gated to show exactly once per browser, by design.

**Where they'd stall**: immediately after skipping, staring at a running
demo with no visible next action beyond "watch it play" or "pick a
different canned fixture from the dropdown."

**Where they'd guess wrong**: assuming the fixture dropdown is the *only*
way to see different code, never discovering the editor is theirs —
because that fact lived in exactly one sentence, inside a tour they
skipped.

**Where they'd leave**: if their actual goal was "trace my own code" and
they skip the tour, there is a real chance they conclude — correctly,
given what the static UI tells them — that the product only shows canned
demos, and bounce before ever finding out otherwise.

This is the section that matters most, and the finding is structural, not
cosmetic: **the single most important fact about how this product works
is taught exactly once, to users who don't reflexively skip a tour.**

---

## FRICTION THAT IS NOT UGLY, JUST SLOW

- **The 40k-step "find when X changed" problem (see wrong #1) is also a
  speed problem for any trace bigger than a couple hundred steps**, not
  just the extreme case. Keyboard stepping is one step (or ten, with
  Shift) at a time — there's no "jump to next call," "jump to next
  comparison," or "jump to next time this variable is touched." For a
  200-step trace this is mildly annoying; for anything bigger it's the
  only tool available, full stop.
- **The onboarding tour is strictly linear** — "Next" and "Skip tour" are
  the only two controls; there's no way to jump to step 3 directly or
  revisit step 1 after moving past it without restarting the whole
  browser's localStorage state. Low cost given it's one-time, but a real
  papercut for anyone testing or re-checking it (screenshotted: only two
  buttons visible, no step indicator you can click).
- **The dev-only fixture picker is explicitly marked "not meant to ship"**
  (its own docstring says so) — meaning in a real deployment, there is no
  fast way to switch between example algorithms from the home page at
  all; a user has to navigate to `/problems` or `/curriculum` and back.
  Not a bug — a real, load-bearing gap in the fast-comparison experience
  that a shipped product doesn't currently have an answer for.

---

## THE FIVE HIGHEST-LEVERAGE CHANGES

Chosen by learning-per-hour-of-work, not visibility.

**1. Make Complexity and Insights always render, with an honest empty
state, instead of unmounting.**
*Change*: `Workspace.tsx`'s panel-gating logic; the empty-state text
already exists in `ComplexityPanel.tsx`, it just needs to always be
reachable rather than conditionally mounted upstream.
*Effort*: small — a few hours, no new detection logic, just always
rendering what already exists.
*Buys*: closes the single most-repeated, most-damaging pattern found this
session (silent absence reading as confirmation).
*Risk*: very low — additive UI only.

**2. Add a while-loop-guard boundary-condition variant to the off-by-one
detector.**
*Change*: a new static-analysis rule in `insight_scanner.py` for
`<`-vs-`<=` loop-guard patterns adjacent to a binary-search-shaped
structure.
*Effort*: medium — needs its own eval-suite coverage before shipping.
*Buys*: closes the gap in the exact canonical bug this product is asked
to teach.
*Risk*: medium — a poorly-tuned heuristic could false-positive on
deliberately exclusive-bound loops; needs real eval coverage, not a quick
patch, before it ships.

**3. Give the problem workspace the same 375px collapse the main
workspace already has.**
*Change*: apply `NarrowWorkspace.tsx`'s established pattern to
`components/problemWorkspace/`.
*Effort*: medium — the technique already exists and works; this is reuse,
not invention.
*Buys*: closes a full PRD §9 gap on one of two named core-persona
surfaces.
*Risk*: low-medium — the statement panel needs its own tab treatment,
which wasn't designed for this the first time.

**4. Add a "jump to next/previous change of this variable" control.**
*Change*: a small affordance on each Variables-panel row / channel Chip,
backed by a linear scan over the already-loaded trace's `changed[]` —
no new backend work.
*Effort*: medium-large — mostly UI, the data's already correct and
present client-side.
*Buys*: the single highest-leverage fix for the product's actual reason
to exist — understanding a real trace — and the direct answer to the
worst finding in this document.
*Risk*: low on correctness; the real risk is scope-creeping into a bigger
"search" feature if not kept deliberately minimal.

**5. Say "you can edit this code" somewhere that isn't the one-time
tour.**
*Change*: one line of persistent copy near the editor or Run button.
*Effort*: tiny.
*Buys*: protects the single most important onboarding fact from being
permanently lost to a reflexive tour-skip — which is not a hypothetical,
it's the default behavior for a large fraction of real users.
*Risk*: none — copy only.

---

## WHAT TO DELETE

1. **Tour step 4 (Tutor) for a no-key session**, or at minimum don't
   spend a full linear step explaining a feature that's visibly disabled
   at that exact moment — screenshotted: at the point the tour would
   describe the tutor, the tutor input already reads "Add a Gemini API
   key in settings to ask the tutor…." Explaining a grayed-out control is
   spending the user's limited tour-attention on something they can't yet
   use.
2. **The three-icon cluster on every panel** (retype dropdown, maximize,
   remove) is a lot of permanent chrome for "dense, quiet, nothing that
   isn't carrying information." The retype dropdown in particular — change
   what this panel shows, as opposed to adding a new one via the global
   "+ Add panel" control — is two different mental models for a
   similar-sounding action, present on every single panel, all the time,
   whether or not anyone's about to use it.
3. **Raw internal fixture identifiers in the dev picker's dropdown**
   (`dp_knapsack`, `n_queens`, `linked_list_reversal_cpp`,
   `out_of_bounds_write_cpp`) — snake_case internal names, not learner
   language, the literal opposite of §6.6's "sentence case, active verbs"
   voice. Scoped as dev-only and not meant to ship, but it's the first
   thing a tester or contributor sees, and it sets the tone for what
   "real" fixture-picking should look like once it does ship.

---

## WHAT IS ALREADY GOOD AND MUST NOT BE TOUCHED

- **Call Stack + Variables at the exact bug moment in binary search.**
  `lo: 0, hi: 0` sitting directly beside `while lo < hi:` at the `return
  -1` line, with zero explanation needed, is the product's core promise
  working exactly as designed — verified live. Don't touch
  `VariablesPanel.tsx` / `CallStackPanel.tsx`'s frame/local rendering
  while fixing anything nearby.
- **"Visualize where it went wrong."** Verified live: lands exactly at
  step 17/23, line 11 — the precise divergence point, not an
  approximation. This cross-surface handoff (grading result → exact wrong
  step in a live trace) is a genuinely rare feature most tools in this
  space don't have at all. Don't touch the jump-then-switch-tab sequencing
  in `ResultPanel`/`jumpToStepRef`.
- **The channel-color system holds up everywhere it was checked** —
  ribbon ticks, Variables chips, editor gutter dots, all the same color
  for the same variable, exactly as PRD §6.2 promises. Foundational; any
  new panel that skips importing from `lib/player/channels.ts` breaks
  this silently.
- **`REDUNDANT_RECOMPUTATION` firing correctly and specifically** — "fib
  called with identical arguments 21 times" is exactly the right answer
  to "why is this slow," delivered without the learner having to ask.
  Don't touch this detector while fixing the off-by-one gap next to it.
- **The main workspace's 375px collapse** (Code/Visual/Tutor tabs, ribbon
  pinned, a trace genuinely playing) is real, working, and verified live
  — screenshotted directly. Don't let a fix for the *problem* workspace's
  375px gap (highest-leverage change #3) regress `NarrowWorkspace.tsx`,
  which already does this correctly.
