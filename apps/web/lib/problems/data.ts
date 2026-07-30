import type { Problem } from "./types";

/**
 * Static problem seed data (docs/PRD.md §8's `problems` table has no live
 * Postgres in this dev sandbox — same reasoning as Phase 1's fixture-only
 * workspace). Every `fixturePython`/`fixtureCpp` points at an already
 * committed, real trace; "Run"/"Submit" replays that trace rather than
 * executing arbitrary edited code, since the live run pipeline for
 * problem submissions doesn't exist yet either — this is the honest
 * boundary of what's real right now, matching the fixture-backed
 * precedent every earlier phase established.
 */
export const PROBLEMS: Problem[] = [
  {
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "easy",
    tags: ["array", "binary-search"],
    acceptance: 68,
    status: "attempted",
    statementMd: `Given a sorted array of integers \`arr\` and an integer \`target\`, return the index of \`target\` in \`arr\`, or \`-1\` if it isn't present.

Your solution must run in \`O(log n)\` time.

**Example**

\`\`\`
input:  1 3 5 7 9 11 13 15 17 19
        1
output: index: 0
\`\`\`

The array is given on the first stdin line, space-separated; the target is the second line.`,
    fixturePython: "binary_search",
    // Deliberately the buggy variant (\`lo < hi\` instead of \`lo <= hi\`) —
    // this is the flagship demo for "a failing submission drops me at the
    // exact step where my code went wrong." See
    // lib/problems/data/binary-search-submission.json, generated for real
    // via services/executor's own Tracer, not hand-written.
    starterPython: `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


arr = [int(x) for x in input().split()]
target = int(input())

result = binary_search(arr, target)
print("index:", result)
`,
    testCases: [
      { input: "1 3 5 7 9 11 13 15 17 19\n1", expectedOutput: "index: 0" },
      { input: "1 3 5 7 9 11 13 15 17 19\n13", expectedOutput: "index: 6" },
    ],
    hasSubmissionDemo: true,
  },
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    tags: ["array", "hash-map"],
    acceptance: 74,
    status: "solved",
    statementMd: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

Assume exactly one solution exists, and you may not use the same element twice.

**Example**

\`\`\`
input:  2 7 11 15
        9
output: indices: [0, 1]
\`\`\`
(\`nums[0] + nums[1] == 2 + 7 == 9\`)`,
    fixturePython: "two_sum",
    fixtureCpp: "two_sum_cpp",
    starterPython: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []


nums = [int(x) for x in input().split()]
target = int(input())

result = two_sum(nums, target)
print("indices:", result)
`,
    starterCpp: `#include <iostream>
#include <unordered_map>
#include <vector>

std::vector<int> two_sum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < static_cast<int>(nums.size()); i = i + 1) {
        int complement = target - nums[i];
        if (seen.count(complement) > 0) {
            std::vector<int> result;
            result.push_back(seen[complement]);
            result.push_back(i);
            return result;
        }
        seen[nums[i]] = i;
    }
    return std::vector<int>();
}

int main() {
    std::vector<int> nums;
    nums.push_back(2);
    nums.push_back(7);
    nums.push_back(11);
    nums.push_back(15);
    nums.push_back(3);
    int target = 9;

    std::vector<int> result = two_sum(nums, target);

    std::cout << "indices: [" << result[0] << ", " << result[1] << "]\\n";

    return 0;
}
`,
    testCases: [{ input: "2 7 11 15 3\n9", expectedOutput: "indices: [0, 1]" }],
  },
  {
    slug: "bubble-sort",
    title: "Bubble Sort",
    difficulty: "easy",
    tags: ["sorting", "array"],
    acceptance: 81,
    status: "todo",
    statementMd: `Implement bubble sort: repeatedly compare adjacent elements and swap them if they're out of order, until a full pass makes no swaps.

Trace this one in the Visualize tab and watch the early-exit: once a pass makes zero swaps, the array is already sorted and the algorithm stops without doing the remaining passes.`,
    fixturePython: "bubble_sort",
    starterPython: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


numbers = [5, 2, 9, 1, 5, 6]
sorted_numbers = bubble_sort(numbers)
print("sorted:", sorted_numbers)
`,
    testCases: [{ input: "", expectedOutput: "sorted: [1, 2, 5, 5, 6, 9]" }],
  },
  {
    slug: "vector-sort",
    title: "Sort a Vector (C++)",
    difficulty: "easy",
    tags: ["sorting", "array", "cpp"],
    acceptance: 71,
    status: "todo",
    statementMd: `The same bubble sort, this time over \`std::vector<int>\` — a chance to see the array panel render C++'s vector identically to Python's list, and to watch the element-swap steps in a language with explicit types.`,
    fixturePython: "bubble_sort",
    fixtureCpp: "vector_sort_cpp",
    starterPython: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


numbers = [5, 2, 9, 1, 5, 6]
sorted_numbers = bubble_sort(numbers)
print("sorted:", sorted_numbers)
`,
    starterCpp: `#include <iostream>
#include <vector>

void bubble_sort(std::vector<int>& values) {
    int n = values.size();
    for (int i = 0; i < n; i = i + 1) {
        for (int j = 0; j < n - i - 1; j = j + 1) {
            if (values[j] > values[j + 1]) {
                int tmp = values[j];
                values[j] = values[j + 1];
                values[j + 1] = tmp;
            }
        }
    }
}

int main() {
    std::vector<int> values;
    values.push_back(5);
    values.push_back(2);
    values.push_back(8);
    values.push_back(1);
    values.push_back(4);

    bubble_sort(values);

    for (int i = 0; i < static_cast<int>(values.size()); i = i + 1) {
        std::cout << values[i] << " ";
    }
    std::cout << "\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "1 2 4 5 8 " }],
  },
  {
    slug: "fibonacci-recursion",
    title: "Fibonacci (Recursive)",
    difficulty: "easy",
    tags: ["recursion"],
    acceptance: 79,
    status: "todo",
    statementMd: `Compute \`fib(n)\` recursively for \`n\` in \`0..7\`.

Open the recursion tree panel in Visualize — the call pattern for naive recursive Fibonacci is the textbook example of overlapping subproblems (the same \`fib(2)\` gets recomputed many times), which is exactly the motivation for memoization.`,
    fixturePython: "fibonacci_recursion",
    fixtureCpp: "fibonacci_recursion_cpp",
    starterPython: `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


for i in range(8):
    print(f"fib({i}) =", fib(i))
`,
    starterCpp: `#include <iostream>

int fib(int n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

int main() {
    for (int i = 0; i < 8; i = i + 1) {
        std::cout << "fib(" << i << ") = " << fib(i) << "\\n";
    }
    return 0;
}
`,
    testCases: [
      {
        input: "",
        expectedOutput: "fib(0) = 0\nfib(1) = 1\nfib(2) = 1\nfib(3) = 2\nfib(4) = 3\nfib(5) = 5\nfib(6) = 8\nfib(7) = 13",
      },
    ],
  },
  {
    slug: "linked-list-reversal",
    title: "Reverse a Linked List",
    difficulty: "medium",
    tags: ["linked-list", "pointers"],
    acceptance: 63,
    status: "todo",
    statementMd: `Reverse a singly linked list in place, iteratively, in \`O(n)\` time and \`O(1)\` extra space.

Available in both languages — the C++ version is the one PRD §3.5 uses to prove pointers "visualize better" than Python references: aliasing is explicit in the source, and the linked-list panel renders \`Node*\` the same way it renders Python's \`ListNode\`.`,
    fixturePython: "linked_list_reversal",
    fixtureCpp: "linked_list_reversal_cpp",
    starterPython: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def build_list(values):
    head = None
    for val in reversed(values):
        head = ListNode(val, head)
    return head


def reverse_list(head):
    prev = None
    current = head
    while current is not None:
        next_node = current.next
        current.next = prev
        prev = current
        current = next_node
    return prev


def to_list(head):
    values = []
    while head is not None:
        values.append(head.val)
        head = head.next
    return values


original = build_list([1, 2, 3, 4])
reversed_head = reverse_list(original)
print("reversed:", to_list(reversed_head))
`,
    starterCpp: `#include <iostream>

struct Node {
    int val;
    Node* next;
};

Node* reverse(Node* head) {
    Node* prev = nullptr;
    Node* cur = head;
    while (cur != nullptr) {
        Node* next = cur->next;
        cur->next = prev;
        prev = cur;
        cur = next;
    }
    return prev;
}

int main() {
    Node* a = new Node{1, nullptr};
    Node* b = new Node{2, nullptr};
    Node* c = new Node{3, nullptr};
    Node* d = new Node{4, nullptr};
    a->next = b;
    b->next = c;
    c->next = d;

    Node* head = a;
    Node* new_head = reverse(head);

    Node* cur = new_head;
    while (cur != nullptr) {
        std::cout << cur->val << " ";
        cur = cur->next;
    }
    std::cout << "\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "reversed: [4, 3, 2, 1]" }],
  },
  {
    slug: "bfs-traversal-order",
    title: "BFS Traversal Order",
    difficulty: "medium",
    tags: ["graph", "bfs", "queue"],
    acceptance: 58,
    status: "todo",
    statementMd: `Given an adjacency-list graph and a start node, return the order nodes are first visited by breadth-first search.

Watch the queue panel: BFS's whole behavior is "queue in, queue out" — the visit order falls straight out of FIFO order, unlike DFS's stack-shaped recursion.`,
    fixturePython: "bfs_graph",
    starterPython: `graph = {
    0: [1, 2],
    1: [0, 3, 4],
    2: [0, 4],
    3: [1, 5],
    4: [1, 2, 5],
    5: [3, 4],
}


def bfs(graph, start):
    visited = {start}
    order = []
    queue = [start]
    while queue:
        node = queue.pop(0)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order


visit_order = bfs(graph, 0)
print("visit order:", visit_order)
`,
    testCases: [{ input: "", expectedOutput: "visit order: [0, 1, 2, 3, 4, 5]" }],
  },
  {
    slug: "depth-first-search-adjacency-list",
    title: "DFS on an Adjacency List (C++)",
    difficulty: "medium",
    tags: ["graph", "dfs", "recursion", "cpp"],
    acceptance: 55,
    status: "todo",
    statementMd: `The same traversal idea as BFS, but depth-first and recursive — visit a node, then recurse into its first unvisited neighbor before backtracking. Compare its call-stack shape (deep and narrow) against BFS's queue shape (wide and shallow) directly in Visualize.`,
    fixturePython: "bfs_graph",
    fixtureCpp: "dfs_adjacency_list_cpp",
    starterPython: `graph = {
    0: [1, 2],
    1: [0, 3, 4],
    2: [0, 4],
    3: [1, 5],
    4: [1, 2, 5],
    5: [3, 4],
}


def dfs(graph, node, visited, order):
    visited.add(node)
    order.append(node)
    for neighbor in graph[node]:
        if neighbor not in visited:
            dfs(graph, neighbor, visited, order)


order = []
dfs(graph, 0, set(), order)
print("visit order:", order)
`,
    starterCpp: `#include <iostream>
#include <vector>

void dfs(int node, std::vector<std::vector<int>>& adjacency, std::vector<bool>& visited, std::vector<int>& order) {
    visited[node] = true;
    order.push_back(node);

    std::vector<int> neighbors = adjacency[node];
    for (int i = 0; i < static_cast<int>(neighbors.size()); i = i + 1) {
        int next = neighbors[i];
        if (!visited[next]) {
            dfs(next, adjacency, visited, order);
        }
    }
}

int main() {
    std::vector<std::vector<int>> adjacency;
    std::vector<int> a; a.push_back(1); a.push_back(2); adjacency.push_back(a);
    std::vector<int> b; b.push_back(3); adjacency.push_back(b);
    std::vector<int> c; c.push_back(3); adjacency.push_back(c);
    std::vector<int> d; adjacency.push_back(d);

    std::vector<bool> visited;
    visited.push_back(false); visited.push_back(false);
    visited.push_back(false); visited.push_back(false);

    std::vector<int> order;
    dfs(0, adjacency, visited, order);

    for (int i = 0; i < static_cast<int>(order.size()); i = i + 1) {
        std::cout << order[i] << " ";
    }
    std::cout << "\\n";
    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "0 1 2 3 " }],
  },
  {
    slug: "binary-tree-insert",
    title: "Binary Search Tree Insert (C++)",
    difficulty: "medium",
    tags: ["tree", "recursion", "pointers", "cpp"],
    acceptance: 60,
    status: "todo",
    statementMd: `Insert a value into a binary search tree, recursively, preserving the BST invariant (everything in a left subtree is smaller, everything in a right subtree is larger).

The binary-tree panel lays this out as a real tree, not a nested-brackets dump — watch each insertion recurse left or right based on a single comparison.`,
    fixturePython: "linked_list_reversal",
    fixtureCpp: "bst_insert_cpp",
    starterPython: `# This problem is C++-only for now — switch the language selector to C++.
`,
    starterCpp: `#include <iostream>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
};

TreeNode* insert(TreeNode* root, int val) {
    if (root == nullptr) {
        TreeNode* node = new TreeNode{val, nullptr, nullptr};
        return node;
    }
    if (val < root->val) {
        root->left = insert(root->left, val);
    } else {
        root->right = insert(root->right, val);
    }
    return root;
}

int main() {
    TreeNode* root = nullptr;
    root = insert(root, 8);
    root = insert(root, 3);
    root = insert(root, 10);
    root = insert(root, 1);
    root = insert(root, 6);
    root = insert(root, 14);

    std::cout << root->val << "\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "8" }],
  },
  {
    slug: "quicksort-partition",
    title: "Quicksort Partition",
    difficulty: "medium",
    tags: ["sorting", "recursion", "array"],
    acceptance: 52,
    status: "todo",
    statementMd: `Implement Lomuto partitioning and use it to quicksort an array in place.

Watch \`i\`/\`j\` sweep through the array in the array panel — partitioning is the one place in the whole curriculum where two index variables' relative motion tells the entire story.`,
    fixturePython: "quicksort_partition",
    fixtureCpp: "quicksort_partition_cpp",
    starterPython: `def partition(arr, low, high):
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1


def quicksort(arr, low, high):
    if low < high:
        pivot_index = partition(arr, low, high)
        quicksort(arr, low, pivot_index - 1)
        quicksort(arr, pivot_index + 1, high)


numbers = [8, 3, 7, 4, 2, 9, 1]
quicksort(numbers, 0, len(numbers) - 1)
print("sorted:", numbers)
`,
    starterCpp: `#include <iostream>
#include <vector>

int partition(std::vector<int>& arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j = j + 1) {
        if (arr[j] <= pivot) {
            i = i + 1;
            int tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
    }
    int tmp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = tmp;
    return i + 1;
}

void quicksort(std::vector<int>& arr, int low, int high) {
    if (low < high) {
        int pivot_index = partition(arr, low, high);
        quicksort(arr, low, pivot_index - 1);
        quicksort(arr, pivot_index + 1, high);
    }
}

int main() {
    std::vector<int> numbers;
    numbers.push_back(8);
    numbers.push_back(3);
    numbers.push_back(7);
    numbers.push_back(4);
    numbers.push_back(2);
    numbers.push_back(9);
    numbers.push_back(1);

    quicksort(numbers, 0, static_cast<int>(numbers.size()) - 1);

    std::cout << "sorted: [";
    for (int i = 0; i < static_cast<int>(numbers.size()); i = i + 1) {
        std::cout << numbers[i];
        if (i + 1 < static_cast<int>(numbers.size())) {
            std::cout << ", ";
        }
    }
    std::cout << "]\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "sorted: [1, 2, 3, 4, 7, 8, 9]" }],
  },
  {
    slug: "n-queens",
    title: "N-Queens Count",
    difficulty: "hard",
    tags: ["backtracking", "recursion"],
    acceptance: 41,
    status: "todo",
    statementMd: `Count the number of ways to place \`n\` non-attacking queens on an \`n×n\` board.

The recursion tree panel is the point here: every dead-end branch (a queen placement that turns out unsafe) shows up as a subtree that gets abandoned — backtracking made visible instead of just asserted in prose.`,
    fixturePython: "n_queens",
    fixtureCpp: "n_queens_cpp",
    starterPython: `def is_safe(columns, row, col):
    for placed_row, placed_col in enumerate(columns):
        if placed_col == col:
            return False
        if abs(placed_col - col) == abs(placed_row - row):
            return False
    return True


def solve(n, columns, solutions):
    row = len(columns)
    if row == n:
        solutions.append(list(columns))
        return
    for col in range(n):
        if is_safe(columns, row, col):
            columns.append(col)
            solve(n, columns, solutions)
            columns.pop()


n = 5
solutions = []
solve(n, [], solutions)
print(f"{n}-queens solutions:", len(solutions))
print("first solution:", solutions[0])
`,
    starterCpp: `#include <iostream>
#include <vector>

int abs_int(int x) {
    if (x < 0) {
        return -x;
    }
    return x;
}

bool is_safe(std::vector<int>& columns, int row, int col) {
    for (int placed_row = 0; placed_row < static_cast<int>(columns.size()); placed_row = placed_row + 1) {
        int placed_col = columns[placed_row];
        if (placed_col == col) {
            return false;
        }
        if (abs_int(placed_col - col) == abs_int(placed_row - row)) {
            return false;
        }
    }
    return true;
}

void solve(int n, std::vector<int>& columns, std::vector<std::vector<int>>& solutions) {
    int row = static_cast<int>(columns.size());
    if (row == n) {
        solutions.push_back(columns);
        return;
    }
    for (int col = 0; col < n; col = col + 1) {
        if (is_safe(columns, row, col)) {
            columns.push_back(col);
            solve(n, columns, solutions);
            columns.pop_back();
        }
    }
}

int main() {
    int n = 5;
    std::vector<int> columns;
    std::vector<std::vector<int>> solutions;
    solve(n, columns, solutions);

    std::cout << n << "-queens solutions: " << solutions.size() << "\\n";

    std::cout << "first solution: [";
    std::vector<int>& first = solutions[0];
    for (int i = 0; i < static_cast<int>(first.size()); i = i + 1) {
        std::cout << first[i];
        if (i + 1 < static_cast<int>(first.size())) {
            std::cout << ", ";
        }
    }
    std::cout << "]\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "5-queens solutions: 10\nfirst solution: [0, 2, 4, 1, 3]" }],
  },
  {
    slug: "01-knapsack",
    title: "0/1 Knapsack",
    difficulty: "hard",
    tags: ["dynamic-programming"],
    acceptance: 47,
    status: "todo",
    statementMd: `Given item weights, values, and a capacity, find the maximum total value achievable without exceeding capacity — each item usable at most once.

The DP table panel renders \`table\` as a growing 2D grid; scrub it and watch each cell get filled from the two cells that determine it (\`table[i-1][w]\` and \`table[i-1][w - weight]\`) — the recurrence made literal.`,
    fixturePython: "dp_knapsack",
    fixtureCpp: "dp_knapsack_cpp",
    starterPython: `def knapsack(weights, values, capacity):
    n = len(weights)
    table = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for w in range(capacity + 1):
            without_item = table[i - 1][w]
            if weights[i - 1] <= w:
                with_item = values[i - 1] + table[i - 1][w - weights[i - 1]]
                table[i][w] = max(without_item, with_item)
            else:
                table[i][w] = without_item

    return table[n][capacity]


weights = [2, 3, 4, 5]
values = [3, 4, 5, 6]
capacity = 8

best_value = knapsack(weights, values, capacity)
print("best value:", best_value)
`,
    starterCpp: `#include <iostream>
#include <vector>

int knapsack(std::vector<int>& weights, std::vector<int>& values, int capacity) {
    int n = static_cast<int>(weights.size());
    std::vector<std::vector<int>> table;
    for (int i = 0; i <= n; i = i + 1) {
        std::vector<int> row;
        for (int w = 0; w <= capacity; w = w + 1) {
            row.push_back(0);
        }
        table.push_back(row);
    }

    for (int i = 1; i <= n; i = i + 1) {
        for (int w = 0; w <= capacity; w = w + 1) {
            int without_item = table[i - 1][w];
            if (weights[i - 1] <= w) {
                int with_item = values[i - 1] + table[i - 1][w - weights[i - 1]];
                if (with_item > without_item) {
                    table[i][w] = with_item;
                } else {
                    table[i][w] = without_item;
                }
            } else {
                table[i][w] = without_item;
            }
        }
    }

    return table[n][capacity];
}

int main() {
    std::vector<int> weights;
    weights.push_back(2);
    weights.push_back(3);
    weights.push_back(4);
    weights.push_back(5);

    std::vector<int> values;
    values.push_back(3);
    values.push_back(4);
    values.push_back(5);
    values.push_back(6);

    int capacity = 8;

    int best_value = knapsack(weights, values, capacity);

    std::cout << "best value: " << best_value << "\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "best value: 10" }],
  },
  {
    slug: "pointer-aliasing",
    title: "Pointer Aliasing (C++)",
    difficulty: "medium",
    tags: ["pointers", "cpp"],
    acceptance: 66,
    status: "todo",
    statementMd: `Two pointers, \`a\` and \`b\`, referencing the same heap object — mutating through one is visible through the other.

This is the case Python has no direct equivalent for, and where C++ pointers visualize *better*: both \`a\` and \`b\` resolve to the exact same heap chip in the variables panel, so the aliasing is a fact you can see, not just reason about.`,
    fixturePython: "linked_list_reversal",
    fixtureCpp: "pointer_aliasing_cpp",
    starterPython: `# This problem is C++-only — switch the language selector to C++.
`,
    starterCpp: `#include <iostream>

struct Counter {
    int value;
};

void increment(Counter* c) {
    c->value = c->value + 1;
}

int main() {
    Counter* a = new Counter{0};
    Counter* b = a;

    increment(a);
    increment(b);
    increment(a);

    std::cout << a->value << " " << b->value << "\\n";

    return 0;
}
`,
    testCases: [{ input: "", expectedOutput: "3 3" }],
  },
];

export function getProblem(slug: string): Problem | undefined {
  return PROBLEMS.find((p) => p.slug === slug);
}
