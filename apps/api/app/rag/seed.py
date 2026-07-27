"""Seeds `concept_chunks` (docs/PRD.md §8) with curriculum text and their
embeddings. `CURRICULUM_SEED` is deliberately small — one short chunk per
concept the twelve fixtures actually demonstrate — the prompt's own words:
"Seed it with whatever curriculum text exists; it grows in Phase 4." This
is what exists today.

Usage: uv run --package oocc-api python apps/api/scripts/seed_curriculum.py
"""

from __future__ import annotations

from typing import Any

from app.rag.concept_store import ConceptStore
from app.rag.embeddings import Embedder

CURRICULUM_SEED: list[dict[str, str]] = [
    {
        "concept_id": "binary-search",
        "content": (
            "Binary search finds a target in a sorted sequence by repeatedly "
            "halving the search window: compare the target to the middle "
            "element, then discard the half that can't contain it. Each "
            "comparison eliminates half the remaining elements, giving O(log n) "
            "time instead of the O(n) a linear scan needs."
        ),
    },
    {
        "concept_id": "bubble-sort",
        "content": (
            "Bubble sort repeatedly walks the array, swapping adjacent elements "
            "that are out of order, so the largest unsorted element 'bubbles' "
            "to its correct position each pass. It's O(n^2) in the worst case, "
            "but an early-exit flag lets it finish in O(n) on already-sorted "
            "input, since a pass with no swaps means the array is done."
        ),
    },
    {
        "concept_id": "recursion",
        "content": (
            "Recursion solves a problem by calling the same function on a "
            "smaller version of it, until a base case stops the calls. Every "
            "call gets its own stack frame with its own local variables — "
            "recursion depth is exactly how many frames are stacked at once, "
            "which is why unbounded recursion eventually overflows the stack."
        ),
    },
    {
        "concept_id": "bfs",
        "content": (
            "Breadth-first search explores a graph one 'layer' at a time using "
            "a queue: visit a node, enqueue its unvisited neighbors, then move "
            "to the next node already in the queue. Because nodes are "
            "processed in the order they were discovered, BFS finds the "
            "shortest path (in edge count) from the start node to every other "
            "reachable node."
        ),
    },
    {
        "concept_id": "linked-lists",
        "content": (
            "A linked list stores elements as separate nodes, each holding a "
            "value and a pointer to the next node, instead of one contiguous "
            "block of memory. Reversing one means walking the list once, "
            "rewiring each node's `next` pointer to point backward instead of "
            "forward, and tracking the previous node as you go."
        ),
    },
    {
        "concept_id": "hash-maps",
        "content": (
            "A hash map stores key-value pairs by computing a hash of the key "
            "to decide roughly where to store it, giving average O(1) lookup, "
            "insert, and delete regardless of how many entries it holds — the "
            "two-sum pattern uses one to remember 'have I seen the complement "
            "of this number yet?' in a single pass instead of checking every "
            "pair."
        ),
    },
    {
        "concept_id": "quicksort",
        "content": (
            "Quicksort picks a pivot element, partitions the array so smaller "
            "elements land left of the pivot and larger ones land right, then "
            "recursively sorts each side. Partitioning is done in place with "
            "one pass, and the pivot ends the pass in its final sorted "
            "position — nothing else needs to move past it again."
        ),
    },
    {
        "concept_id": "backtracking",
        "content": (
            "Backtracking explores choices one at a time, and the moment a "
            "partial choice can't lead to a valid solution, it undoes ('backs "
            "out of') that choice and tries the next one instead of exploring "
            "further. The N-queens problem places queens row by row, checking "
            "each placement against every queen already placed, and pops the "
            "queen back off as soon as no column works."
        ),
    },
    {
        "concept_id": "dynamic-programming",
        "content": (
            "Dynamic programming solves a problem by breaking it into "
            "overlapping subproblems, solving each one once, and storing the "
            "result in a table so later subproblems can reuse it instead of "
            "recomputing it. The knapsack problem's table cell (i, w) answers "
            "'what's the best value using only the first i items and capacity "
            "w', built up from smaller i and w."
        ),
    },
    {
        "concept_id": "big-o-notation",
        "content": (
            "Big-O notation describes how an algorithm's running time grows as "
            "its input size grows, ignoring constant factors and lower-order "
            "terms — O(n) means doubling the input roughly doubles the work, "
            "O(n^2) means doubling the input roughly quadruples it. OOCC "
            "measures this empirically by actually running the code at "
            "several sizes and fitting a curve to the real step counts, rather "
            "than asking you to guess."
        ),
    },
    {
        "concept_id": "infinite-loops",
        "content": (
            "An infinite (or 'runaway') loop never satisfies its exit "
            "condition, so it keeps running until something external stops it "
            "— a step limit, a timeout, or a crash. The telltale sign in a "
            "trace is a variable the loop condition depends on that never "
            "changes, or a counter that keeps changing forever with no bound "
            "check at all."
        ),
    },
    {
        "concept_id": "call-stacks",
        "content": (
            "The call stack tracks every function call currently in progress, "
            "each as its own 'frame' holding that call's arguments and local "
            "variables, stacked in the order the calls happened. A function "
            "returning pops its frame off the top; the frame just below "
            "becomes active again, resuming exactly where it left off."
        ),
    },
]


async def seed_concepts(*, store: ConceptStore, embedder: Embedder) -> int:
    count = 0
    for entry in CURRICULUM_SEED:
        embedding = await embedder.embed(entry["content"])
        await store.add_chunk(
            chunk_id=f"{entry['concept_id']}-0",
            concept_id=entry["concept_id"],
            content=entry["content"],
            embedding=embedding,
        )
        count += 1
    return count


# Full curriculum articles for the `concepts` table (docs/PRD.md §8,
# migrations/0002_accounts_and_progress.sql) — brief item 4: "12 curriculum
# concepts (full articles, body_md, sensible prereq_ids chains)". Every
# `slug` here matches a `concept_id` already seeded into `concept_chunks`
# above by `CURRICULUM_SEED` (all twelve of the fixtures' subjects already
# exist as short retrieval passages); this extends that existing partial
# seed with the fuller article body and prerequisite chain the curriculum
# UI needs, rather than duplicating or replacing it.
#
# `prereq_ids` are a reasoned teaching order, not derived from anything
# mechanical: big-o-notation, call-stacks, infinite-loops, and linked-lists
# have no prerequisites in this set (they're each a standalone foundation);
# everything that reasons about running time assumes big-o-notation first;
# recursion assumes call-stacks (you can't explain a recursive call's
# frame without one); anything built on recursion or sorting lists it as a
# prerequisite in turn.
CONCEPT_ARTICLES: list[dict[str, object]] = [
    {
        "slug": "big-o-notation",
        "title": "Big-O notation",
        "prereq_ids": [],
        "body_md": (
            "# Big-O notation\n\n"
            "Big-O notation describes how an algorithm's running time (or memory "
            "use) grows as its input size grows, ignoring constant factors and "
            "lower-order terms. `O(n)` means doubling the input roughly doubles "
            "the work; `O(n^2)` means doubling the input roughly quadruples it; "
            "`O(log n)` means doubling the input adds only one more unit of "
            "work.\n\n"
            "Most explanations of Big-O ask you to trust an asymptotic argument "
            "about a hypothetical huge input. OOCC does the opposite: it "
            "actually runs your code at several input sizes (10, 50, 100, 500, "
            "1000) and fits a curve to the real, measured step counts "
            "(`complexity_analyst`, docs/PRD.md §4.3). The complexity you see "
            "attached to a run is empirical, not a guess — and the same is true "
            "of every code sample embedded in this article: it's a live trace "
            "you can scrub, not a static snippet.\n\n"
            "Common classes, from fastest-growing work to slowest: `O(1)` "
            "constant, `O(log n)` logarithmic (binary search), `O(n)` linear "
            "(a single pass), `O(n log n)` linearithmic (efficient sorting), "
            "`O(n^2)` quadratic (bubble sort, nested loops over the same "
            "input), `O(2^n)` exponential (naive recursive Fibonacci, "
            "unpruned backtracking).\n\n"
            "Reading a trace for complexity clues: watch the hot-lines count in "
            "the digest (docs/PRD.md §4.3) — a line inside a loop nested inside "
            "another loop over the same collection is the single most common "
            "source of accidental `O(n^2)` work, and the insight scanner flags "
            "it by name."
        ),
    },
    {
        "slug": "call-stacks",
        "title": "Call stacks",
        "prereq_ids": [],
        "body_md": (
            "# Call stacks\n\n"
            "The call stack tracks every function call currently in progress, "
            "each as its own 'frame' holding that call's arguments and local "
            "variables, stacked in the order the calls happened. Calling a "
            "function pushes a new frame on top; a function returning pops its "
            "frame off, and the frame just below becomes active again, resuming "
            "exactly where it left off.\n\n"
            "In an OOCC trace, `step.depth` is exactly how many frames are "
            "stacked at that instant, and `step.stack` is the frames themselves, "
            "index 0 being the outermost (`<module>`). Watching the call stack "
            "panel grow and shrink while scrubbing a trace is the most direct "
            "way to see 'where am I' in a program with more than one function "
            "call — especially once recursion is involved.\n\n"
            "A stack overflow is just this mechanism running out of room: "
            "frames keep getting pushed (a function keeps calling itself, or "
            "calling something else) faster than they're popped, until the "
            "process's stack space is exhausted. Every recursive function needs "
            "a base case that stops pushing new frames, or this is inevitable "
            "no matter how much memory is available."
        ),
    },
    {
        "slug": "infinite-loops",
        "title": "Infinite (runaway) loops",
        "prereq_ids": [],
        "body_md": (
            "# Infinite (runaway) loops\n\n"
            "An infinite loop never satisfies its exit condition, so it keeps "
            "running until something external stops it — a step limit, a "
            "timeout, or a crash. The telltale sign in a trace is a variable the "
            "loop condition depends on that never changes (`while lo <= hi:` "
            "where nothing inside the loop ever updates `lo` or `hi`), or a "
            "counter that keeps changing forever with no bound check at all "
            "(`while True:` with no `break`).\n\n"
            "OOCC's executor caps every run at 100,000 recorded steps "
            "(docs/PRD.md §3.3); a run that hits the cap comes back with "
            '`status: "step_limit"` and `truncated: true`, keeping the first '
            "40k and last 10k steps so you can see both how the loop started "
            "and where it stalled. The insight scanner's 'infinite / runaway "
            "loop' detector looks for exactly this pattern automatically: the "
            "step limit was hit, and some loop variable was unchanged across at "
            "least 500 consecutive steps.\n\n"
            "The fix is almost always visible in the variables panel the moment "
            "you scrub to a step in the stalled region: whichever value the "
            "loop condition reads is sitting still while everything else moves, "
            "or isn't moving at all."
        ),
    },
    {
        "slug": "linked-lists",
        "title": "Linked lists",
        "prereq_ids": [],
        "body_md": (
            "# Linked lists\n\n"
            "A linked list stores elements as separate nodes, each holding a "
            "value and a pointer (`next`) to the next node, instead of one "
            "contiguous block of memory the way an array does. That trade-off "
            "is the whole story: insertion and removal at a known position is "
            "`O(1)` (just rewire two pointers) instead of an array's `O(n)` "
            "shift, but there's no `O(1)` random access by index — reaching the "
            "5th node means walking there one `next` at a time.\n\n"
            "Reversing a linked list means walking it once, rewiring each "
            "node's `next` pointer to point backward instead of forward, and "
            "tracking the previous node as you go, one node at a time, until "
            "the old head becomes the new tail.\n\n"
            'In an OOCC trace, a node is a heap object (`{"type": "instance", '
            '"fields": {"val": ..., "next": {"ref": "oN"}}}`), and the '
            "linked-list panel renders the chain of `ref` pointers directly — "
            "which is also exactly why a bug like accidentally losing the "
            "reference to the rest of the list (overwriting `next` before "
            "saving it) is so visible when scrubbed: the panel's chain just "
            "stops."
        ),
    },
    {
        "slug": "recursion",
        "title": "Recursion",
        "prereq_ids": ["call-stacks"],
        "body_md": (
            "# Recursion\n\n"
            "Recursion solves a problem by calling the same function on a "
            "smaller version of it, until a base case stops the calls. Every "
            "call gets its own stack frame with its own local variables (see "
            "'Call stacks') — recursion depth is exactly how many frames are "
            "stacked at once, which is why unbounded recursion eventually "
            "overflows the stack.\n\n"
            "Two things make recursive code hard to read from source alone: "
            "the same local variable name means something different in every "
            "frame, and control genuinely jumps backward on return, resuming "
            "the caller's frame mid-line. A trace sidesteps both problems: "
            "`step.stack` shows every live frame's own copy of its locals "
            "simultaneously, and `step.depth` renders as vertical offset on the "
            "trace ribbon, so a recursive Fibonacci call tree looks like an "
            "actual mountain range you can see the shape of, not just imagine.\n\n"
            "Recursion's most common efficiency pitfall is redundant "
            "recomputation: naive recursive Fibonacci recomputes `fib(k)` an "
            "exponential number of times because sibling calls don't know "
            "about each other's work. The insight scanner's 'redundant "
            "recomputation' detector flags exactly this — identical call "
            "arguments recurring — as a signal that memoization (see 'Dynamic "
            "programming') would help."
        ),
    },
    {
        "slug": "hash-maps",
        "title": "Hash maps",
        "prereq_ids": ["big-o-notation"],
        "body_md": (
            "# Hash maps\n\n"
            "A hash map stores key-value pairs by computing a hash of the key "
            "to decide roughly where to store it, giving average `O(1)` "
            "lookup, insert, and delete regardless of how many entries it "
            "holds. That average case relies on the hash function spreading "
            "keys out evenly; a pathological input that collides constantly "
            "degrades toward `O(n)` per operation, though Python's dict "
            "implementation makes this rare in practice for normal data.\n\n"
            "The two-sum pattern is the canonical use: instead of checking "
            "every pair of numbers (`O(n^2)`), remember 'have I seen the "
            "complement of this number yet?' in a hash map as you scan once "
            "(`O(n)`). The trade is memory for time — the hash map itself "
            "costs `O(n)` space to hold what a nested-loop approach needed "
            "zero extra space for.\n\n"
            "In a trace, a hash map appears as a `dict` heap object; the "
            "hash_map panel renders its keys and values directly, and the "
            "`changed` field on each step shows exactly which key was just "
            "inserted, updated, or looked up — useful for seeing when a lookup "
            "hits versus when it silently falls through to an `else` branch."
        ),
    },
    {
        "slug": "binary-search",
        "title": "Binary search",
        "prereq_ids": ["big-o-notation"],
        "body_md": (
            "# Binary search\n\n"
            "Binary search finds a target in a sorted sequence by repeatedly "
            "halving the search window: compare the target to the middle "
            "element, then discard the half that can't contain it. Each "
            "comparison eliminates half the remaining elements, giving "
            "`O(log n)` time instead of the `O(n)` a linear scan needs — for a "
            "million-element array, that's about 20 comparisons instead of up "
            "to a million.\n\n"
            "The classic bug is in the boundary update: after checking `mid`, "
            "the next window must exclude `mid` itself (`lo = mid + 1` or `hi "
            "= mid - 1`), or the loop can spin forever comparing the same "
            "element — exactly the 'off-by-one' pattern the insight scanner "
            "looks for at `len(x)`-boundary accesses.\n\n"
            "Scrubbing a binary search trace, the array panel's window "
            "annotation (from `lo` to `hi`) visibly shrinks by half every "
            "iteration — that halving, rendered directly rather than argued "
            "for, is the entire proof of `O(log n)` a learner needs to see "
            "once."
        ),
    },
    {
        "slug": "bubble-sort",
        "title": "Bubble sort",
        "prereq_ids": ["big-o-notation"],
        "body_md": (
            "# Bubble sort\n\n"
            "Bubble sort repeatedly walks the array, swapping adjacent "
            "elements that are out of order, so the largest unsorted element "
            "'bubbles' to its correct position each pass. It's `O(n^2)` in the "
            "worst case — every pass is `O(n)`, and up to `n` passes are "
            "needed — but an early-exit flag lets it finish in `O(n)` on "
            "already-sorted input, since a pass with no swaps means the array "
            "is done.\n\n"
            "Bubble sort is rarely the right choice in production code "
            "(insertion sort and Timsort-style merges beat it in nearly every "
            "case), but it's the clearest possible introduction to sorting "
            "because every comparison and every swap is visible and local: two "
            "neighbors, one comparison, at most one swap. OOCC's complexity "
            "analyst will empirically confirm both halves of the claim above — "
            "measure step counts on a sorted input and a reversed one at the "
            "same size, and the two curves land in visibly different places.\n\n"
            "Compare against quicksort once this is comfortable: quicksort "
            "gets to `O(n log n)` average case by moving many elements toward "
            "their final position per pass instead of one."
        ),
    },
    {
        "slug": "bfs",
        "title": "Breadth-first search",
        "prereq_ids": ["linked-lists", "big-o-notation"],
        "body_md": (
            "# Breadth-first search\n\n"
            "Breadth-first search explores a graph one 'layer' at a time using "
            "a queue: visit a node, enqueue its unvisited neighbors, then move "
            "to the next node already in the queue. Because nodes are "
            "processed in the order they were discovered, BFS finds the "
            "shortest path (in edge count, not edge weight) from the start "
            "node to every other reachable node — this is the whole reason to "
            "reach for BFS instead of DFS when 'shortest' matters.\n\n"
            "The queue is the mechanism that enforces layer-by-layer order; "
            "swap it for a stack and the same skeleton becomes depth-first "
            "search instead, exploring one branch all the way down before "
            "backtracking. In a trace, the queue panel shows exactly which "
            "nodes are waiting to be visited and in what order, which is the "
            "clearest way to see why BFS can't 'jump ahead' the way a "
            "depth-first traversal does.\n\n"
            "A visited-set is essential the moment the graph has a cycle "
            "(including simple back-edges between two nodes): without one, "
            "the same node gets enqueued repeatedly and the traversal never "
            "terminates — the same class of bug the 'infinite / runaway loop' "
            "insight detector is built to catch."
        ),
    },
    {
        "slug": "quicksort",
        "title": "Quicksort",
        "prereq_ids": ["bubble-sort", "recursion"],
        "body_md": (
            "# Quicksort\n\n"
            "Quicksort picks a pivot element, partitions the array so smaller "
            "elements land left of the pivot and larger ones land right, then "
            "recursively sorts each side. Partitioning is done in place with "
            "one pass, and the pivot ends the pass in its final sorted "
            "position — nothing else needs to move past it again.\n\n"
            "Average case is `O(n log n)`: each partition step is `O(n)`, and "
            "a good pivot choice roughly halves the array each level, giving "
            "`O(log n)` levels of recursion (see 'Recursion'). Worst case is "
            "`O(n^2)` — an already-sorted array with a naive 'always pick the "
            "first element' pivot strategy degrades to one element peeled off "
            "per partition, `n` levels deep. OOCC's complexity analyst "
            "measures both empirically across shapes (random, sorted, "
            "reverse), which is exactly how this gap becomes visible rather "
            "than theoretical.\n\n"
            "Watching a quicksort trace, the array panel's partition boundary "
            "annotation moves inward from both sides per call, and the "
            "recursion tree panel shows the call structure directly — a "
            "well-pivoted run looks balanced; a worst-case run looks like a "
            "long, lopsided chain."
        ),
    },
    {
        "slug": "backtracking",
        "title": "Backtracking",
        "prereq_ids": ["recursion"],
        "body_md": (
            "# Backtracking\n\n"
            "Backtracking explores choices one at a time, and the moment a "
            "partial choice can't lead to a valid solution, it undoes ('backs "
            "out of') that choice and tries the next one instead of exploring "
            "further. The N-queens problem places queens row by row, checking "
            "each placement against every queen already placed, and pops the "
            "queen back off as soon as no column works for the current row.\n\n"
            "Backtracking is recursion (see 'Recursion') with an explicit "
            "undo step: the recursive call tries a choice, recurses on the "
            "rest of the problem, and — whether or not that recursive branch "
            "succeeded — the choice is undone on the way back up so the next "
            "sibling choice starts from a clean slate. Skipping that undo step "
            "is the most common backtracking bug, and it shows up in a trace "
            "as state that should have reverted but didn't: a board position, a "
            "visited-set entry, a partial path that's still marked used after "
            "the branch that used it has already returned.\n\n"
            "Without pruning, backtracking is exponential in the worst case — "
            "it's still trying every combination, just skipping the ones it "
            "can prove won't work early. The recursion tree panel makes the "
            "shape of that pruning visible: branches that dead-end quickly "
            "render as short, and the productive path to a solution renders as "
            "the one long branch that reaches full depth."
        ),
    },
    {
        "slug": "dynamic-programming",
        "title": "Dynamic programming",
        "prereq_ids": ["recursion", "big-o-notation"],
        "body_md": (
            "# Dynamic programming\n\n"
            "Dynamic programming solves a problem by breaking it into "
            "overlapping subproblems, solving each one once, and storing the "
            "result in a table so later subproblems can reuse it instead of "
            "recomputing it. 'Overlapping' is the key word: DP earns its "
            "keep only when a naive recursive solution (see 'Recursion') "
            "would call the same subproblem more than once — the knapsack "
            "problem's table cell `(i, w)` answers 'what's the best value "
            "using only the first `i` items and capacity `w`', built up from "
            "smaller `i` and `w`, and every larger cell reuses smaller ones "
            "instead of re-deriving them.\n\n"
            "This is the fix for the 'redundant recomputation' insight the "
            "scanner flags on naive recursive code: memoizing a pure "
            "function's return value by its arguments turns an exponential "
            "call tree into a linear or quadratic one, because each distinct "
            "set of arguments is computed exactly once no matter how many "
            "times it's requested.\n\n"
            "In a trace, a DP table is just a heap object (commonly a "
            "`list<list<int>>` or a `dict`), and the `changed` field shows "
            "exactly which cell was just filled in and in what order — "
            "watching the table fill from a scrubber makes the 'build up from "
            "smaller subproblems' claim concrete instead of abstract."
        ),
    },
]


async def seed_concept_articles(*, store: Any) -> int:
    """Populates the `concepts` table (app/curriculum/articles_store.py).
    `store` is a `ConceptArticleStore` — typed as `Any` here only to avoid
    importing app/curriculum from app/rag (this module's existing home);
    every call site passes a real `ConceptArticleStore`."""
    from app.curriculum.articles_store import ConceptArticle

    count = 0
    for entry in CONCEPT_ARTICLES:
        article = ConceptArticle(
            id=str(entry["slug"]),
            slug=str(entry["slug"]),
            title=str(entry["title"]),
            body_md=str(entry["body_md"]),
            prereq_ids=tuple(entry["prereq_ids"]),  # type: ignore[arg-type]
        )
        await store.upsert(article)
        count += 1
    return count
