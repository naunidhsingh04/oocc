"""Seeds `concept_chunks` (docs/PRD.md §8) with curriculum text and their
embeddings. `CURRICULUM_SEED` is deliberately small — one short chunk per
concept the twelve fixtures actually demonstrate — the prompt's own words:
"Seed it with whatever curriculum text exists; it grows in Phase 4." This
is what exists today.

Usage: uv run --package oocc-api python apps/api/scripts/seed_curriculum.py
"""

from __future__ import annotations

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
