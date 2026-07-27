import type { Article } from "./types";

/**
 * Twelve article shells (docs/PRD.md Phase 4 frontend brief) — real prose
 * with real embedded traces, wired to already-committed fixtures. "Shell"
 * because the prose itself is deliberately concise: this is the structure
 * and the live-trace wiring Person B's curriculum text and pgvector
 * chunks land on top of, not a finished essay collection.
 */
export const ARTICLES: Article[] = [
  {
    slug: "binary-search",
    title: "Binary Search",
    summary: "Halving the search space — and the two off-by-one bugs everyone writes once.",
    relatedSlugs: ["quicksort-and-partitioning", "recursion-and-fibonacci"],
    bodyMd: `Binary search finds a value in a **sorted** array in \`O(log n)\` time by throwing away half the remaining candidates on every comparison, instead of scanning one element at a time.

## The invariant

At every step, the answer — if it exists — is somewhere in \`arr[lo..hi]\`. Each iteration computes \`mid\`, compares \`arr[mid]\` against the target, and shrinks the range to one side or the other. The loop ends when either the target is found or the range is empty.

\`\`\`trace:binary_search
\`\`\`

Scrub through the trace above. Watch \`lo\` and \`hi\` in the variables panel converge on \`mid\` — that convergence *is* the \`O(log n)\` bound: every iteration at minimum halves \`hi - lo\`.

## The bug almost everyone writes

The loop condition has to be \`lo <= hi\`, not \`lo < hi\`. The difference only matters when the search has narrowed to exactly one candidate (\`lo == hi\`) — with \`<\`, the loop exits before ever checking that last element, and a target sitting there gets reported as missing.

This isn't hypothetical: try it yourself on the [Binary Search problem](/problems/binary-search) — the starter code has exactly this bug, and submitting it lands you on the *exact step* the wrong answer gets produced, with the correct and actual output side by side.

## Related

Binary search is the simplest example of divide-and-conquer: throw away work you can prove is irrelevant. [Quicksort's partition step](/curriculum/quicksort-and-partitioning) is the same idea applied to sorting instead of searching.`,
  },
  {
    slug: "two-sum-and-hash-maps",
    title: "Two Sum and Hash Maps",
    summary: "Trading a second pass for a hash map — O(n²) becomes O(n).",
    relatedSlugs: ["binary-search"],
    bodyMd: `The brute-force way to find two numbers that sum to a target is to check every pair — \`O(n²)\`. A hash map gets this down to a single pass, \`O(n)\`, by remembering what you've already seen.

## The idea

For each number, compute its *complement* (\`target - num\`). If the complement is already in the \`seen\` map, you've found your pair — the map is telling you "this value showed up earlier, at this index." If not, record the current number and move on.

\`\`\`trace:two_sum
\`\`\`

Watch the \`seen\` dict grow one entry per iteration in the heap panel, and notice the function returns the moment a complement is found — it never needs a second loop.

## Why this generalizes

Any "have I seen X before" question is a hash-map candidate. The pattern — populate a lookup structure while scanning once, check membership before inserting — shows up again in cycle detection, duplicate detection, and grouping problems.

## Related

[Binary search](/curriculum/binary-search) is the other classic way to cut an \`O(n²)\` search down — by sorting first instead of hashing.`,
  },
  {
    slug: "bubble-sort",
    title: "Bubble Sort",
    summary: "The simplest sort, and the one early-exit that makes it not-quite-O(n²) on nearly-sorted input.",
    relatedSlugs: ["quicksort-and-partitioning"],
    bodyMd: `Bubble sort repeatedly walks the array, swapping any adjacent pair that's out of order. After one full pass, the largest remaining element has "bubbled" to the end — so each pass needs to check one fewer element than the last.

\`\`\`trace:bubble_sort
\`\`\`

## The early exit

If a full pass makes zero swaps, the array is already sorted — there's no reason to run the remaining passes. Scrub to the last pass in the trace above and watch \`swapped\` stay \`false\` the whole way through; that's the \`break\` firing.

This is why bubble sort's worst case is \`O(n²)\` but its *best* case (an already-sorted array) is \`O(n)\` — the early exit fires on the very first pass.

## Why it's not used in practice

Bubble sort is easy to reason about but does far more swaps than it needs to for random data. [Quicksort's partitioning](/curriculum/quicksort-and-partitioning) does asymptotically better (\`O(n log n)\` average case) by moving elements toward their final position more aggressively per comparison.`,
  },
  {
    slug: "linked-lists-and-pointers",
    title: "Linked Lists and Pointer Rewiring",
    summary: "Reversing a list in place — three pointers, one pass, zero extra memory.",
    relatedSlugs: ["pointers-and-aliasing", "binary-search-trees"],
    bodyMd: `A singly linked list is a chain of nodes, each holding a value and a pointer to the next node. Reversing it in place means walking the chain once, flipping every \`next\` pointer as you go, using only three variables: \`prev\`, \`current\`, and a temporary \`next_node\` to avoid losing the rest of the chain when you overwrite \`current.next\`.

\`\`\`trace:linked_list_reversal
\`\`\`

## Why three pointers

At each step you need to know: where you're going next (\`next_node\`, saved *before* the rewrite), what you're rewiring (\`current\`), and what it should now point back to (\`prev\`). Overwrite \`current.next\` too early — before saving \`next_node\` — and you lose the rest of the list.

Watch the linked-list panel above: each node's arrow flips direction one at a time as \`prev\`/\`current\`/\`next_node\` all shift forward together.

## The same idea in C++

\`\`\`trace:linked_list_reversal_cpp
\`\`\`

Identical algorithm, but the pointers are now real \`Node*\` values instead of Python references — the panel renders it identically either way, which is the whole point of [how OOCC's C++ engine represents pointers](/curriculum/pointers-and-aliasing).`,
  },
  {
    slug: "recursion-and-fibonacci",
    title: "Recursion and the Cost of Recomputation",
    summary: "Naive recursive Fibonacci, and why the same subproblem gets solved over and over.",
    relatedSlugs: ["backtracking-and-n-queens", "dynamic-programming-and-knapsack"],
    bodyMd: `\`fib(n) = fib(n-1) + fib(n-2)\` is the textbook first recursive function — and the textbook first example of exponential blowup from redundant work.

\`\`\`trace:fibonacci_recursion
\`\`\`

## Read the recursion tree

Open the recursion tree panel and pick a call to \`fib(4)\` or higher. Notice \`fib(2)\` gets computed multiple times *within a single top-level call* — once via the \`fib(n-1)\` branch, again via a different \`fib(n-1)\` branch two levels up. Every one of those recomputations does the exact same work.

This is exactly what [dynamic programming](/curriculum/dynamic-programming-and-knapsack) fixes: cache a subproblem's answer the first time you compute it, and every later call becomes an \`O(1)\` lookup instead of a recursive recomputation.

## Related

[Backtracking](/curriculum/backtracking-and-n-queens) is recursion's other big use case — not recomputing the same answer, but exploring a tree of choices and abandoning branches that can't work.`,
  },
  {
    slug: "breadth-first-search",
    title: "Breadth-First Search",
    summary: "Queue in, queue out — visiting a graph level by level.",
    relatedSlugs: ["depth-first-search"],
    bodyMd: `Breadth-first search visits a graph's nodes in order of distance from the start: everything one edge away, then everything two edges away, and so on. The mechanism is entirely a FIFO queue — no recursion, no explicit distance tracking needed.

\`\`\`trace:bfs_graph
\`\`\`

## Why a queue produces "by distance" order

A node only gets pushed onto the queue when it's first discovered, and nodes are popped in the same order they were pushed. So every node at distance \`k\` gets queued before any node at distance \`k+1\` can be discovered (since distance-\`k+1\` nodes are only reachable *through* distance-\`k\` nodes). Watch the queue panel: it never processes a "later" node before an "earlier" one has been fully expanded.

## Related

[Depth-first search](/curriculum/depth-first-search) visits the same graph with a stack (or recursion) instead of a queue — same graph, completely different visit order, because LIFO explores "as deep as possible" before backtracking instead of "one level at a time."`,
  },
  {
    slug: "depth-first-search",
    title: "Depth-First Search",
    summary: "Recurse into the first unvisited neighbor, backtrack when you run out.",
    relatedSlugs: ["breadth-first-search", "recursion-and-fibonacci"],
    bodyMd: `Depth-first search visits a graph by going as deep as possible before backtracking: visit a node, recurse into its first unvisited neighbor, and only return to try a sibling neighbor once that whole subtree is exhausted.

\`\`\`trace:dfs_adjacency_list_cpp
\`\`\`

## The call stack *is* the visited path

Unlike BFS's explicit queue, DFS's "frontier" is implicit — it's whatever's currently on the call stack. Open the call stack panel and watch it grow one frame per recursive call, then shrink one frame per return as the search backtracks. The depth of the stack at any moment is exactly how far the current path has gone from the start.

This C++ trace also shows \`std::vector<bool> visited\` rendered the same way Python's \`set\` would be — the array panel doesn't know or care which language produced the trace.

## Related

[BFS](/curriculum/breadth-first-search) is the queue-driven version of the same idea — same graph, level-by-level instead of path-by-path.`,
  },
  {
    slug: "quicksort-and-partitioning",
    title: "Quicksort and the Partition Step",
    summary: "Pick a pivot, partition around it, recurse on both sides.",
    relatedSlugs: ["binary-search", "bubble-sort"],
    bodyMd: `Quicksort picks a pivot element, partitions the array so everything smaller than the pivot ends up left of it and everything larger ends up right of it, then recursively sorts each side. The partition step is the entire algorithm's engine — get it right and the recursion just works.

\`\`\`trace:quicksort_partition
\`\`\`

## Reading the partition

\`i\` marks the boundary of "elements confirmed smaller than the pivot so far"; \`j\` sweeps through the rest of the range. Every time \`arr[j] <= pivot\`, \`i\` advances and the two elements at \`i\`/\`j\` swap — pulling the small element into the confirmed region. Watch \`i\` and \`j\` in the array panel: \`i\` never gets ahead of \`j\`, and everything between them (exclusive) is provably larger than the pivot at all times.

The pivot itself lands in its final sorted position the moment partitioning finishes (the last swap, \`arr[i+1] <-> arr[high]\`) — that's what makes the recursive calls on each side valid: the pivot never needs to move again.

## Related

[Binary search](/curriculum/binary-search) is divide-and-conquer applied to *searching* instead of sorting — same "provably ignore half the data" idea, one comparison instead of a full partition.`,
  },
  {
    slug: "backtracking-and-n-queens",
    title: "Backtracking and N-Queens",
    summary: "Try a placement, recurse, undo it if it doesn't pan out.",
    relatedSlugs: ["recursion-and-fibonacci", "depth-first-search"],
    bodyMd: `N-Queens asks: how many ways can \`n\` queens be placed on an \`n×n\` board so none attacks another? Backtracking solves it by placing queens one row at a time, recursing into the next row, and *undoing* a placement (\`columns.pop()\`) the moment a branch is exhausted — trying the next option instead.

\`\`\`trace:n_queens
\`\`\`

## Watch a branch die

Open the recursion tree panel and find a call to \`solve\` that returns almost immediately after being entered — that's \`is_safe\` rejecting every remaining column for that row, so the branch has nowhere to go and unwinds. Every one of those short-lived branches is backtracking in action: work attempted, found unproductive, abandoned.

The \`columns.pop()\` right after the recursive call is easy to miss reading the source but impossible to miss in the trace — watch the \`columns\` list shrink by one in the variables panel every time a call returns.

## Related

[Recursion and Fibonacci](/curriculum/recursion-and-fibonacci) is recursion without backtracking — every call contributes to the answer. N-Queens is recursion *with* backtracking — most calls contribute nothing and get abandoned, which is exactly why the recursion tree is worth looking at here.`,
  },
  {
    slug: "dynamic-programming-and-knapsack",
    title: "Dynamic Programming: 0/1 Knapsack",
    summary: "Build the answer to a big problem out of the answers to smaller ones, once each.",
    relatedSlugs: ["recursion-and-fibonacci"],
    bodyMd: `0/1 Knapsack asks: given items with weights and values, and a weight capacity, what's the maximum total value achievable? Dynamic programming solves it by filling a table where \`table[i][w]\` means "the best value achievable using only the first \`i\` items, with capacity \`w\`" — and every cell is computed from cells already filled in.

\`\`\`trace:dp_knapsack
\`\`\`

## Reading the recurrence

Every cell's value is the *better* of two choices: skip the current item (\`table[i-1][w]\`, straight up from the cell below) or take it (\`values[i-1] + table[i-1][w - weights[i-1]]\`, diagonally-ish back by the item's own weight). Scrub through and watch the table panel fill row by row — by the time row \`i\` is being computed, every value it needs from row \`i-1\` already exists.

## Why this beats plain recursion

The naive recursive version of this problem recomputes "best value for the first \`i-1\` items at capacity \`w\`" every time it's needed, exactly like [naive recursive Fibonacci](/curriculum/recursion-and-fibonacci) recomputes \`fib(2)\`. The table computes each \`(i, w)\` pair exactly once and reuses it — the entire idea of dynamic programming in one sentence.`,
  },
  {
    slug: "pointers-and-aliasing",
    title: "Pointers and Aliasing",
    summary: "Two variables, one object — and why C++ makes this visible where Python can't.",
    relatedSlugs: ["linked-lists-and-pointers", "binary-search-trees"],
    bodyMd: `Python has no raw pointers — every name is already a reference, so "two variables pointing at the same object" is the *default*, invisible state of things. C++ makes the pointer itself a value you can see, copy, and reason about explicitly.

\`\`\`trace:pointer_aliasing_cpp
\`\`\`

## Same object, two names

\`Counter* a = new Counter{0}; Counter* b = a;\` — \`b\` doesn't copy the \`Counter\`, it copies the *address*. Watch the variables panel: \`a\` and \`b\` both resolve to the identical heap chip (\`{"ref":"oN"}\` with the same \`oN\`), and mutating through \`increment(b)\` is visible immediately through \`a\` too, because there was only ever one \`Counter\` — just two names for it.

This is the case PRD calls out explicitly: C++ pointers *visualize better* than Python references here, because the aliasing is a fact sitting right there in the source (\`b = a\`) rather than an implicit consequence of how Python's object model works.

## Related

[Linked list reversal](/curriculum/linked-lists-and-pointers) is the productive use of this same mechanism — rewiring which object a pointer names, one link at a time. [Binary search trees](/curriculum/binary-search-trees) use it to link parent and child nodes.`,
  },
  {
    slug: "binary-search-trees",
    title: "Binary Search Trees",
    summary: "Insertion by recursive comparison — left if smaller, right if not.",
    relatedSlugs: ["pointers-and-aliasing", "binary-search"],
    bodyMd: `A binary search tree keeps its invariant — everything in a node's left subtree is smaller, everything in its right subtree is larger — by choosing, at every insertion, which side to recurse into based on a single comparison against the current node.

\`\`\`trace:bst_insert_cpp
\`\`\`

## Watch the tree take shape

The binary-tree panel lays out every node as an actual tree, not a nested-bracket dump — insert a value smaller than the root and watch the recursion head left; insert something larger and it heads right. A \`nullptr\` child is exactly where the next matching insertion will attach a new node.

Because insertion always follows the same "compare, then recurse into exactly one side" pattern as [binary search itself](/curriculum/binary-search), a balanced BST gets you \`O(log n)\` insertion and lookup for the same reason binary search is \`O(log n)\` — each comparison eliminates one whole subtree from consideration.

## Related

Every node's \`left\`/\`right\` fields are the same pointer mechanism [pointer aliasing](/curriculum/pointers-and-aliasing) walks through in isolation — a BST is just two pointers per node instead of a linked list's one.`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
