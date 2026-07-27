"""40 seeded problems (docs/PRD.md §7 Phase 5: "40-problem library"; brief
item 4). Each entry's `reference_solution` defines a single `solve`
function; `tests` is a list of `{"args": [...], "expected": <json>}`
covering the normal case plus edge cases (empty input, zero, negatives,
duplicates, single-element). `apps/api/tests/problems/test_reference_solutions.py`
`exec`s every reference solution and runs every one of its tests, so a
wrong reference solution fails CI — this file is the thing that test
verifies, not a claim taken on faith.

Grading a *learner's* submission never uses `exec` in-process (that would
run untrusted code outside the sandbox) — see app/problems/grading.py,
which runs learner code through services/executor instead. Running our
own, already-reviewed reference solutions in-process at CI time is the one
deliberate exception, spelled out in that module's docstring.

Usage: uv run --package oocc-api python apps/api/scripts/seed_problems.py
"""

from __future__ import annotations

from app.problems.problem_store import Problem, ProblemStore

PROBLEMS: list[dict[str, object]] = [
    {
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "easy",
        "tags": ["array", "hash-map"],
        "statement_md": (
            "Given a list of integers `nums` and an integer `target`, return the "
            "indices of the first two numbers (in the order they're discovered "
            "scanning left to right, checking each number's complement against "
            "numbers already seen) that add up to `target`. If no such pair "
            "exists, return an empty list.\n\n"
            "`def solve(nums, target):`"
        ),
        "starter_code": "def solve(nums, target):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums, target):\n"
            "    seen = {}\n"
            "    for i, n in enumerate(nums):\n"
            "        complement = target - n\n"
            "        if complement in seen:\n"
            "            return [seen[complement], i]\n"
            "        seen[n] = i\n"
            "    return []\n"
        ),
        "tests": [
            {"args": [[2, 7, 11, 15], 9], "expected": [0, 1]},
            {"args": [[3, 2, 4], 6], "expected": [1, 2]},
            {"args": [[3, 3], 6], "expected": [0, 1]},
            {"args": [[1, 2, 3, 4, 5], 9], "expected": [3, 4]},
            {"args": [[-3, 4, 3, 90], 0], "expected": [0, 2]},
            {"args": [[0, 4, 3, 0], 0], "expected": [0, 3]},
            {"args": [[], 5], "expected": []},
            {"args": [[5], 5], "expected": []},
        ],
    },
    {
        "slug": "reverse-string",
        "title": "Reverse String",
        "difficulty": "easy",
        "tags": ["string"],
        "statement_md": "Given a string `s`, return it reversed.\n\n`def solve(s):`",
        "starter_code": "def solve(s):\n    # TODO: implement\n    pass\n",
        "reference_solution": "def solve(s):\n    return s[::-1]\n",
        "tests": [
            {"args": ["hello"], "expected": "olleh"},
            {"args": [""], "expected": ""},
            {"args": ["a"], "expected": "a"},
            {"args": ["ab"], "expected": "ba"},
            {"args": ["racecar"], "expected": "racecar"},
            {"args": ["Hello, World!"], "expected": "!dlroW ,olleH"},
            {"args": [" "], "expected": " "},
            {"args": ["12345"], "expected": "54321"},
        ],
    },
    {
        "slug": "is-palindrome-string",
        "title": "Palindrome String",
        "difficulty": "easy",
        "tags": ["string"],
        "statement_md": (
            "Given a string `s`, return whether it reads the same forwards and "
            "backwards. Comparison is exact (case-sensitive, no cleaning of "
            "punctuation or whitespace).\n\n`def solve(s):`"
        ),
        "starter_code": "def solve(s):\n    # TODO: implement\n    pass\n",
        "reference_solution": "def solve(s):\n    return s == s[::-1]\n",
        "tests": [
            {"args": ["racecar"], "expected": True},
            {"args": ["hello"], "expected": False},
            {"args": [""], "expected": True},
            {"args": ["a"], "expected": True},
            {"args": ["ab"], "expected": False},
            {"args": ["abba"], "expected": True},
            {"args": ["abcba"], "expected": True},
            {"args": ["Aba"], "expected": False},
        ],
    },
    {
        "slug": "fizzbuzz",
        "title": "FizzBuzz",
        "difficulty": "easy",
        "tags": ["basics"],
        "statement_md": (
            "Given an integer `n`, return a list of strings for `1..n` where "
            'multiples of 3 are `"Fizz"`, multiples of 5 are `"Buzz"`, '
            'multiples of both are `"FizzBuzz"`, and everything else is the '
            "number itself as a string.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    result = []\n"
            "    for i in range(1, n + 1):\n"
            "        if i % 15 == 0:\n"
            "            result.append('FizzBuzz')\n"
            "        elif i % 3 == 0:\n"
            "            result.append('Fizz')\n"
            "        elif i % 5 == 0:\n"
            "            result.append('Buzz')\n"
            "        else:\n"
            "            result.append(str(i))\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [1], "expected": ["1"]},
            {"args": [3], "expected": ["1", "2", "Fizz"]},
            {"args": [5], "expected": ["1", "2", "Fizz", "4", "Buzz"]},
            {
                "args": [15],
                "expected": [
                    "1",
                    "2",
                    "Fizz",
                    "4",
                    "Buzz",
                    "Fizz",
                    "7",
                    "8",
                    "Fizz",
                    "Buzz",
                    "11",
                    "Fizz",
                    "13",
                    "14",
                    "FizzBuzz",
                ],
            },
            {"args": [0], "expected": []},
            {
                "args": [16],
                "expected": [
                    "1",
                    "2",
                    "Fizz",
                    "4",
                    "Buzz",
                    "Fizz",
                    "7",
                    "8",
                    "Fizz",
                    "Buzz",
                    "11",
                    "Fizz",
                    "13",
                    "14",
                    "FizzBuzz",
                    "16",
                ],
            },
            {"args": [6], "expected": ["1", "2", "Fizz", "4", "Buzz", "Fizz"]},
            {
                "args": [20],
                "expected": [
                    "1",
                    "2",
                    "Fizz",
                    "4",
                    "Buzz",
                    "Fizz",
                    "7",
                    "8",
                    "Fizz",
                    "Buzz",
                    "11",
                    "Fizz",
                    "13",
                    "14",
                    "FizzBuzz",
                    "16",
                    "17",
                    "Fizz",
                    "19",
                    "Buzz",
                ],
            },
        ],
    },
    {
        "slug": "factorial",
        "title": "Factorial",
        "difficulty": "easy",
        "tags": ["math", "recursion"],
        "statement_md": "Given a non-negative integer `n`, return `n!`.\n\n`def solve(n):`",
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    result = 1\n"
            "    for i in range(2, n + 1):\n"
            "        result *= i\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [0], "expected": 1},
            {"args": [1], "expected": 1},
            {"args": [2], "expected": 2},
            {"args": [3], "expected": 6},
            {"args": [5], "expected": 120},
            {"args": [6], "expected": 720},
            {"args": [10], "expected": 3628800},
            {"args": [7], "expected": 5040},
        ],
    },
    {
        "slug": "fibonacci",
        "title": "Fibonacci Number",
        "difficulty": "easy",
        "tags": ["math", "recursion"],
        "statement_md": (
            "Given `n`, return the `n`th Fibonacci number, 0-indexed "
            "(`fib(0) = 0`, `fib(1) = 1`).\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    a, b = 0, 1\n"
            "    for _ in range(n):\n"
            "        a, b = b, a + b\n"
            "    return a\n"
        ),
        "tests": [
            {"args": [0], "expected": 0},
            {"args": [1], "expected": 1},
            {"args": [2], "expected": 1},
            {"args": [3], "expected": 2},
            {"args": [5], "expected": 5},
            {"args": [10], "expected": 55},
            {"args": [15], "expected": 610},
            {"args": [20], "expected": 6765},
        ],
    },
    {
        "slug": "gcd",
        "title": "Greatest Common Divisor",
        "difficulty": "easy",
        "tags": ["math"],
        "statement_md": (
            "Given two non-negative integers `a` and `b`, return their GCD.\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(a, b):\n"
            "    a, b = abs(a), abs(b)\n"
            "    while b:\n"
            "        a, b = b, a % b\n"
            "    return a\n"
        ),
        "tests": [
            {"args": [12, 18], "expected": 6},
            {"args": [7, 13], "expected": 1},
            {"args": [0, 5], "expected": 5},
            {"args": [5, 0], "expected": 5},
            {"args": [0, 0], "expected": 0},
            {"args": [48, 18], "expected": 6},
            {"args": [100, 75], "expected": 25},
            {"args": [17, 5], "expected": 1},
        ],
    },
    {
        "slug": "lcm",
        "title": "Least Common Multiple",
        "difficulty": "easy",
        "tags": ["math"],
        "statement_md": (
            "Given two non-negative integers `a` and `b`, return their LCM. "
            "`lcm(0, x) = 0`.\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def _gcd(a, b):\n"
            "    a, b = abs(a), abs(b)\n"
            "    while b:\n"
            "        a, b = b, a % b\n"
            "    return a\n\n"
            "def solve(a, b):\n"
            "    if a == 0 or b == 0:\n"
            "        return 0\n"
            "    return abs(a * b) // _gcd(a, b)\n"
        ),
        "tests": [
            {"args": [4, 6], "expected": 12},
            {"args": [3, 5], "expected": 15},
            {"args": [0, 5], "expected": 0},
            {"args": [7, 7], "expected": 7},
            {"args": [6, 8], "expected": 24},
            {"args": [21, 6], "expected": 42},
            {"args": [1, 1], "expected": 1},
            {"args": [10, 15], "expected": 30},
        ],
    },
    {
        "slug": "is-prime",
        "title": "Prime Check",
        "difficulty": "easy",
        "tags": ["math"],
        "statement_md": "Given an integer `n`, return whether it is prime.\n\n`def solve(n):`",
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    if n < 2:\n"
            "        return False\n"
            "    if n < 4:\n"
            "        return True\n"
            "    if n % 2 == 0:\n"
            "        return False\n"
            "    i = 3\n"
            "    while i * i <= n:\n"
            "        if n % i == 0:\n"
            "            return False\n"
            "        i += 2\n"
            "    return True\n"
        ),
        "tests": [
            {"args": [2], "expected": True},
            {"args": [1], "expected": False},
            {"args": [0], "expected": False},
            {"args": [-5], "expected": False},
            {"args": [17], "expected": True},
            {"args": [18], "expected": False},
            {"args": [97], "expected": True},
            {"args": [100], "expected": False},
        ],
    },
    {
        "slug": "max-subarray-sum",
        "title": "Maximum Subarray Sum",
        "difficulty": "medium",
        "tags": ["array", "dynamic-programming"],
        "statement_md": (
            "Given a non-empty list of integers `nums`, return the largest sum "
            "of any contiguous subarray (Kadane's algorithm).\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    best = nums[0]\n"
            "    current = nums[0]\n"
            "    for x in nums[1:]:\n"
            "        current = max(x, current + x)\n"
            "        best = max(best, current)\n"
            "    return best\n"
        ),
        "tests": [
            {"args": [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], "expected": 6},
            {"args": [[1]], "expected": 1},
            {"args": [[-1]], "expected": -1},
            {"args": [[5, 4, -1, 7, 8]], "expected": 23},
            {"args": [[-2, -3, -1]], "expected": -1},
            {"args": [[1, 2, 3, 4]], "expected": 10},
            {"args": [[-1, -2, -3, -4]], "expected": -1},
            {"args": [[3, -2, 5, -1]], "expected": 6},
        ],
    },
    {
        "slug": "merge-sorted-lists",
        "title": "Merge Two Sorted Lists",
        "difficulty": "easy",
        "tags": ["array", "two-pointers"],
        "statement_md": (
            "Given two ascending-sorted lists `a` and `b`, return them merged "
            "into one ascending-sorted list.\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(a, b):\n"
            "    result = []\n"
            "    i = j = 0\n"
            "    while i < len(a) and j < len(b):\n"
            "        if a[i] <= b[j]:\n"
            "            result.append(a[i])\n"
            "            i += 1\n"
            "        else:\n"
            "            result.append(b[j])\n"
            "            j += 1\n"
            "    result.extend(a[i:])\n"
            "    result.extend(b[j:])\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [[1, 3, 5], [2, 4, 6]], "expected": [1, 2, 3, 4, 5, 6]},
            {"args": [[], [1, 2]], "expected": [1, 2]},
            {"args": [[1, 2], []], "expected": [1, 2]},
            {"args": [[], []], "expected": []},
            {"args": [[1, 1, 1], [1, 1]], "expected": [1, 1, 1, 1, 1]},
            {"args": [[-5, 0, 5], [-3, 2, 10]], "expected": [-5, -3, 0, 2, 5, 10]},
            {"args": [[1], [2]], "expected": [1, 2]},
            {"args": [[2], [1]], "expected": [1, 2]},
        ],
    },
    {
        "slug": "binary-search",
        "title": "Binary Search",
        "difficulty": "easy",
        "tags": ["array", "binary-search"],
        "statement_md": (
            "Given an ascending-sorted list `arr` and a `target`, return the "
            "index of `target`, or `-1` if it isn't present.\n\n`def solve(arr, target):`"
        ),
        "starter_code": "def solve(arr, target):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(arr, target):\n"
            "    lo, hi = 0, len(arr) - 1\n"
            "    while lo <= hi:\n"
            "        mid = (lo + hi) // 2\n"
            "        if arr[mid] == target:\n"
            "            return mid\n"
            "        if arr[mid] < target:\n"
            "            lo = mid + 1\n"
            "        else:\n"
            "            hi = mid - 1\n"
            "    return -1\n"
        ),
        "tests": [
            {"args": [[1, 3, 5, 7, 9], 5], "expected": 2},
            {"args": [[1, 3, 5, 7, 9], 1], "expected": 0},
            {"args": [[1, 3, 5, 7, 9], 9], "expected": 4},
            {"args": [[1, 3, 5, 7, 9], 4], "expected": -1},
            {"args": [[], 5], "expected": -1},
            {"args": [[5], 5], "expected": 0},
            {"args": [[5], 3], "expected": -1},
            {"args": [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10], "expected": 9},
        ],
    },
    {
        "slug": "bubble-sort",
        "title": "Bubble Sort",
        "difficulty": "easy",
        "tags": ["array", "sorting"],
        "statement_md": (
            "Given a list of integers `arr`, return it sorted ascending using "
            "bubble sort.\n\n`def solve(arr):`"
        ),
        "starter_code": "def solve(arr):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(arr):\n"
            "    arr = list(arr)\n"
            "    n = len(arr)\n"
            "    for i in range(n):\n"
            "        swapped = False\n"
            "        for j in range(n - 1 - i):\n"
            "            if arr[j] > arr[j + 1]:\n"
            "                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n"
            "                swapped = True\n"
            "        if not swapped:\n"
            "            break\n"
            "    return arr\n"
        ),
        "tests": [
            {"args": [[5, 3, 1, 4, 2]], "expected": [1, 2, 3, 4, 5]},
            {"args": [[]], "expected": []},
            {"args": [[1]], "expected": [1]},
            {"args": [[2, 1]], "expected": [1, 2]},
            {"args": [[1, 1, 1]], "expected": [1, 1, 1]},
            {"args": [[5, 4, 3, 2, 1]], "expected": [1, 2, 3, 4, 5]},
            {"args": [[-3, 5, -1, 0]], "expected": [-3, -1, 0, 5]},
            {
                "args": [[10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
                "expected": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            },
        ],
    },
    {
        "slug": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "easy",
        "tags": ["stack", "string"],
        "statement_md": (
            "Given a string `s` of `()[]{}` characters, return whether every "
            "bracket is closed in the correct order.\n\n`def solve(s):`"
        ),
        "starter_code": "def solve(s):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(s):\n"
            "    pairs = {')': '(', ']': '[', '}': '{'}\n"
            "    stack = []\n"
            "    for ch in s:\n"
            "        if ch in '([{':\n"
            "            stack.append(ch)\n"
            "        elif ch in pairs:\n"
            "            if not stack or stack.pop() != pairs[ch]:\n"
            "                return False\n"
            "    return not stack\n"
        ),
        "tests": [
            {"args": ["()"], "expected": True},
            {"args": ["()[]{}"], "expected": True},
            {"args": ["(]"], "expected": False},
            {"args": ["([)]"], "expected": False},
            {"args": ["{[]}"], "expected": True},
            {"args": [""], "expected": True},
            {"args": ["("], "expected": False},
            {"args": ["]"], "expected": False},
        ],
    },
    {
        "slug": "is-anagram",
        "title": "Valid Anagram",
        "difficulty": "easy",
        "tags": ["string", "hash-map"],
        "statement_md": (
            "Given two strings `a` and `b`, return whether `b` is an anagram of "
            "`a` (same characters, same counts, case-sensitive).\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(a, b):\n"
            "    if len(a) != len(b):\n"
            "        return False\n"
            "    counts = {}\n"
            "    for ch in a:\n"
            "        counts[ch] = counts.get(ch, 0) + 1\n"
            "    for ch in b:\n"
            "        counts[ch] = counts.get(ch, 0) - 1\n"
            "    return all(v == 0 for v in counts.values())\n"
        ),
        "tests": [
            {"args": ["anagram", "nagaram"], "expected": True},
            {"args": ["rat", "car"], "expected": False},
            {"args": ["", ""], "expected": True},
            {"args": ["a", "ab"], "expected": False},
            {"args": ["listen", "silent"], "expected": True},
            {"args": ["aabbcc", "abcabc"], "expected": True},
            {"args": ["ab", "ba"], "expected": True},
            {"args": ["abc", "abd"], "expected": False},
        ],
    },
    {
        "slug": "missing-number",
        "title": "Missing Number",
        "difficulty": "easy",
        "tags": ["array", "math"],
        "statement_md": (
            "Given a list `nums` of `n` distinct numbers taken from `0..n`, "
            "return the one missing number.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    n = len(nums)\n"
            "    expected = n * (n + 1) // 2\n"
            "    return expected - sum(nums)\n"
        ),
        "tests": [
            {"args": [[3, 0, 1]], "expected": 2},
            {"args": [[0, 1]], "expected": 2},
            {"args": [[9, 6, 4, 2, 3, 5, 7, 0, 1]], "expected": 8},
            {"args": [[0]], "expected": 1},
            {"args": [[1]], "expected": 0},
            {"args": [[1, 2]], "expected": 0},
            {"args": [[0, 1, 2, 3, 4, 5, 6, 7, 9]], "expected": 8},
            {"args": [[2, 0]], "expected": 1},
        ],
    },
    {
        "slug": "single-number",
        "title": "Single Number",
        "difficulty": "easy",
        "tags": ["array", "bit-manipulation"],
        "statement_md": (
            "Given a list `nums` where every element appears twice except one, "
            "return that one element.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    result = 0\n"
            "    for n in nums:\n"
            "        result ^= n\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [[2, 2, 1]], "expected": 1},
            {"args": [[4, 1, 2, 1, 2]], "expected": 4},
            {"args": [[1]], "expected": 1},
            {"args": [[1, 1, 2, 2, 3]], "expected": 3},
            {"args": [[5, 3, 5]], "expected": 3},
            {"args": [[7, 7, 9, 9, 10]], "expected": 10},
            {"args": [[0, 0, 1]], "expected": 1},
            {"args": [[8, 2, 8, 2, 6]], "expected": 6},
        ],
    },
    {
        "slug": "majority-element",
        "title": "Majority Element",
        "difficulty": "easy",
        "tags": ["array"],
        "statement_md": (
            "Given a list `nums`, return the element that appears more than "
            "`len(nums) // 2` times (Boyer-Moore voting).\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    count = 0\n"
            "    candidate = None\n"
            "    for n in nums:\n"
            "        if count == 0:\n"
            "            candidate = n\n"
            "        count += 1 if n == candidate else -1\n"
            "    return candidate\n"
        ),
        "tests": [
            {"args": [[3, 2, 3]], "expected": 3},
            {"args": [[2, 2, 1, 1, 1, 2, 2]], "expected": 2},
            {"args": [[1]], "expected": 1},
            {"args": [[1, 1, 2]], "expected": 1},
            {"args": [[6, 5, 5]], "expected": 5},
            {"args": [[4, 4, 4, 2, 2]], "expected": 4},
            {"args": [[10, 9, 9, 9, 9, 8]], "expected": 9},
            {"args": [[1, 1, 1, 1, 2, 2, 2]], "expected": 1},
        ],
    },
    {
        "slug": "move-zeroes",
        "title": "Move Zeroes",
        "difficulty": "easy",
        "tags": ["array", "two-pointers"],
        "statement_md": (
            "Given a list `nums`, return it with all zeroes moved to the end, "
            "preserving the relative order of non-zero elements.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    result = [n for n in nums if n != 0]\n"
            "    result.extend([0] * (len(nums) - len(result)))\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [[0, 1, 0, 3, 12]], "expected": [1, 3, 12, 0, 0]},
            {"args": [[0]], "expected": [0]},
            {"args": [[1, 2, 3]], "expected": [1, 2, 3]},
            {"args": [[0, 0, 0]], "expected": [0, 0, 0]},
            {"args": [[]], "expected": []},
            {"args": [[1, 0, 2, 0, 3]], "expected": [1, 2, 3, 0, 0]},
            {"args": [[0, 1]], "expected": [1, 0]},
            {"args": [[4, 0, 0, 5, 0, 6]], "expected": [4, 5, 6, 0, 0, 0]},
        ],
    },
    {
        "slug": "remove-duplicates-sorted",
        "title": "Remove Duplicates from Sorted Array",
        "difficulty": "easy",
        "tags": ["array", "two-pointers"],
        "statement_md": (
            "Given an ascending-sorted list `nums`, return the unique elements "
            "in order.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    result = []\n"
            "    for n in nums:\n"
            "        if not result or result[-1] != n:\n"
            "            result.append(n)\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [[1, 1, 2]], "expected": [1, 2]},
            {"args": [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], "expected": [0, 1, 2, 3, 4]},
            {"args": [[]], "expected": []},
            {"args": [[1]], "expected": [1]},
            {"args": [[1, 1, 1, 1]], "expected": [1]},
            {"args": [[-3, -3, -1, 0, 0, 5]], "expected": [-3, -1, 0, 5]},
            {"args": [[1, 2, 3]], "expected": [1, 2, 3]},
            {"args": [[5, 5, 5, 5, 5, 5]], "expected": [5]},
        ],
    },
    {
        "slug": "rotate-array",
        "title": "Rotate Array",
        "difficulty": "medium",
        "tags": ["array"],
        "statement_md": (
            "Given a list `nums` and an integer `k`, return `nums` rotated "
            "right by `k` steps.\n\n`def solve(nums, k):`"
        ),
        "starter_code": "def solve(nums, k):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums, k):\n"
            "    n = len(nums)\n"
            "    if n == 0:\n"
            "        return []\n"
            "    k = k % n\n"
            "    return nums[-k:] + nums[:-k] if k else list(nums)\n"
        ),
        "tests": [
            {"args": [[1, 2, 3, 4, 5, 6, 7], 3], "expected": [5, 6, 7, 1, 2, 3, 4]},
            {"args": [[1, 2], 1], "expected": [2, 1]},
            {"args": [[1], 5], "expected": [1]},
            {"args": [[], 3], "expected": []},
            {"args": [[1, 2, 3], 0], "expected": [1, 2, 3]},
            {"args": [[1, 2, 3, 4], 4], "expected": [1, 2, 3, 4]},
            {"args": [[1, 2, 3, 4], 6], "expected": [3, 4, 1, 2]},
            {"args": [[-1, -100, 3, 99], 2], "expected": [3, 99, -1, -100]},
        ],
    },
    {
        "slug": "contains-duplicate",
        "title": "Contains Duplicate",
        "difficulty": "easy",
        "tags": ["array", "hash-map"],
        "statement_md": (
            "Given a list `nums`, return whether any value appears more than "
            "once.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": "def solve(nums):\n    return len(nums) != len(set(nums))\n",
        "tests": [
            {"args": [[1, 2, 3, 1]], "expected": True},
            {"args": [[1, 2, 3, 4]], "expected": False},
            {"args": [[]], "expected": False},
            {"args": [[1]], "expected": False},
            {"args": [[1, 1]], "expected": True},
            {"args": [[0, 0, 0, 0]], "expected": True},
            {"args": [[-1, -2, -3, -1]], "expected": True},
            {"args": [[5, 6, 7, 8, 9]], "expected": False},
        ],
    },
    {
        "slug": "best-time-to-buy-sell-stock",
        "title": "Best Time to Buy and Sell Stock",
        "difficulty": "medium",
        "tags": ["array", "dynamic-programming"],
        "statement_md": (
            "Given a list `prices` where `prices[i]` is the price on day `i`, "
            "return the maximum profit from a single buy followed by a later "
            "sell (0 if no profit is possible).\n\n`def solve(prices):`"
        ),
        "starter_code": "def solve(prices):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(prices):\n"
            "    if not prices:\n"
            "        return 0\n"
            "    min_price = prices[0]\n"
            "    best = 0\n"
            "    for p in prices[1:]:\n"
            "        best = max(best, p - min_price)\n"
            "        min_price = min(min_price, p)\n"
            "    return best\n"
        ),
        "tests": [
            {"args": [[7, 1, 5, 3, 6, 4]], "expected": 5},
            {"args": [[7, 6, 4, 3, 1]], "expected": 0},
            {"args": [[]], "expected": 0},
            {"args": [[1]], "expected": 0},
            {"args": [[1, 2]], "expected": 1},
            {"args": [[2, 1]], "expected": 0},
            {"args": [[3, 2, 6, 5, 0, 3]], "expected": 4},
            {"args": [[1, 2, 3, 4, 5]], "expected": 4},
        ],
    },
    {
        "slug": "plus-one",
        "title": "Plus One",
        "difficulty": "easy",
        "tags": ["array", "math"],
        "statement_md": (
            "Given a list of digits `digits` representing a non-negative "
            "integer (most significant digit first), return the digits of "
            "that number plus one.\n\n`def solve(digits):`"
        ),
        "starter_code": "def solve(digits):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(digits):\n"
            "    digits = list(digits)\n"
            "    i = len(digits) - 1\n"
            "    while i >= 0:\n"
            "        if digits[i] < 9:\n"
            "            digits[i] += 1\n"
            "            return digits\n"
            "        digits[i] = 0\n"
            "        i -= 1\n"
            "    return [1] + digits\n"
        ),
        "tests": [
            {"args": [[1, 2, 3]], "expected": [1, 2, 4]},
            {"args": [[4, 3, 2, 1]], "expected": [4, 3, 2, 2]},
            {"args": [[9]], "expected": [1, 0]},
            {"args": [[9, 9]], "expected": [1, 0, 0]},
            {"args": [[0]], "expected": [1]},
            {"args": [[1, 9, 9]], "expected": [2, 0, 0]},
            {"args": [[8, 9, 9, 9]], "expected": [9, 0, 0, 0]},
            {"args": [[9, 9, 9, 9]], "expected": [1, 0, 0, 0, 0]},
        ],
    },
    {
        "slug": "integer-sqrt",
        "title": "Integer Square Root",
        "difficulty": "easy",
        "tags": ["math", "binary-search"],
        "statement_md": (
            "Given a non-negative integer `n`, return `floor(sqrt(n))` without "
            "using a float square-root function.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    if n < 2:\n"
            "        return n\n"
            "    lo, hi = 1, n\n"
            "    while lo <= hi:\n"
            "        mid = (lo + hi) // 2\n"
            "        if mid * mid <= n:\n"
            "            lo = mid + 1\n"
            "        else:\n"
            "            hi = mid - 1\n"
            "    return hi\n"
        ),
        "tests": [
            {"args": [0], "expected": 0},
            {"args": [1], "expected": 1},
            {"args": [4], "expected": 2},
            {"args": [8], "expected": 2},
            {"args": [9], "expected": 3},
            {"args": [15], "expected": 3},
            {"args": [16], "expected": 4},
            {"args": [99], "expected": 9},
        ],
    },
    {
        "slug": "is-power-of-two",
        "title": "Power of Two",
        "difficulty": "easy",
        "tags": ["bit-manipulation"],
        "statement_md": (
            "Given an integer `n`, return whether it is a power of two.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": "def solve(n):\n    return n > 0 and (n & (n - 1)) == 0\n",
        "tests": [
            {"args": [1], "expected": True},
            {"args": [2], "expected": True},
            {"args": [3], "expected": False},
            {"args": [4], "expected": True},
            {"args": [0], "expected": False},
            {"args": [-4], "expected": False},
            {"args": [1024], "expected": True},
            {"args": [1023], "expected": False},
        ],
    },
    {
        "slug": "count-set-bits",
        "title": "Count Set Bits",
        "difficulty": "easy",
        "tags": ["bit-manipulation"],
        "statement_md": (
            "Given a non-negative integer `n`, return the number of `1` bits in "
            "its binary representation.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    count = 0\n"
            "    while n:\n"
            "        count += n & 1\n"
            "        n >>= 1\n"
            "    return count\n"
        ),
        "tests": [
            {"args": [0], "expected": 0},
            {"args": [1], "expected": 1},
            {"args": [2], "expected": 1},
            {"args": [3], "expected": 2},
            {"args": [7], "expected": 3},
            {"args": [8], "expected": 1},
            {"args": [255], "expected": 8},
            {"args": [1023], "expected": 10},
        ],
    },
    {
        "slug": "hamming-distance",
        "title": "Hamming Distance",
        "difficulty": "easy",
        "tags": ["bit-manipulation"],
        "statement_md": (
            "Given two non-negative integers `a` and `b`, return the number of "
            "bit positions at which they differ.\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(a, b):\n"
            "    x = a ^ b\n"
            "    count = 0\n"
            "    while x:\n"
            "        count += x & 1\n"
            "        x >>= 1\n"
            "    return count\n"
        ),
        "tests": [
            {"args": [1, 4], "expected": 2},
            {"args": [3, 1], "expected": 1},
            {"args": [0, 0], "expected": 0},
            {"args": [0, 1], "expected": 1},
            {"args": [5, 5], "expected": 0},
            {"args": [255, 0], "expected": 8},
            {"args": [1, 2], "expected": 2},
            {"args": [1024, 0], "expected": 1},
        ],
    },
    {
        "slug": "reverse-integer",
        "title": "Reverse Integer",
        "difficulty": "easy",
        "tags": ["math"],
        "statement_md": (
            "Given an integer `n`, return its digits reversed, keeping the "
            "original sign and dropping any leading zero the reversal "
            "introduces.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    sign = -1 if n < 0 else 1\n"
            "    reversed_digits = str(abs(n))[::-1].lstrip('0') or '0'\n"
            "    return sign * int(reversed_digits)\n"
        ),
        "tests": [
            {"args": [123], "expected": 321},
            {"args": [-123], "expected": -321},
            {"args": [120], "expected": 21},
            {"args": [0], "expected": 0},
            {"args": [5], "expected": 5},
            {"args": [-5], "expected": -5},
            {"args": [1000], "expected": 1},
            {"args": [7893], "expected": 3987},
        ],
    },
    {
        "slug": "is-palindrome-number",
        "title": "Palindrome Number",
        "difficulty": "easy",
        "tags": ["math"],
        "statement_md": (
            "Given an integer `n`, return whether it reads the same forwards "
            "and backwards (negative numbers are never palindromes).\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    if n < 0:\n"
            "        return False\n"
            "    s = str(n)\n"
            "    return s == s[::-1]\n"
        ),
        "tests": [
            {"args": [121], "expected": True},
            {"args": [-121], "expected": False},
            {"args": [10], "expected": False},
            {"args": [0], "expected": True},
            {"args": [1], "expected": True},
            {"args": [12321], "expected": True},
            {"args": [123], "expected": False},
            {"args": [1001], "expected": True},
        ],
    },
    {
        "slug": "roman-to-int",
        "title": "Roman to Integer",
        "difficulty": "medium",
        "tags": ["string", "math"],
        "statement_md": (
            "Given a Roman numeral string `s`, return its integer value.\n\n`def solve(s):`"
        ),
        "starter_code": "def solve(s):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(s):\n"
            "    values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n"
            "    total = 0\n"
            "    for i, ch in enumerate(s):\n"
            "        value = values[ch]\n"
            "        if i + 1 < len(s) and values[s[i + 1]] > value:\n"
            "            total -= value\n"
            "        else:\n"
            "            total += value\n"
            "    return total\n"
        ),
        "tests": [
            {"args": ["III"], "expected": 3},
            {"args": ["IV"], "expected": 4},
            {"args": ["IX"], "expected": 9},
            {"args": ["LVIII"], "expected": 58},
            {"args": ["MCMXCIV"], "expected": 1994},
            {"args": ["XL"], "expected": 40},
            {"args": ["MMXXIV"], "expected": 2024},
            {"args": ["CD"], "expected": 400},
        ],
    },
    {
        "slug": "int-to-roman",
        "title": "Integer to Roman",
        "difficulty": "medium",
        "tags": ["string", "math"],
        "statement_md": (
            "Given an integer `n` (1-3999), return its Roman numeral.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    values = [\n"
            "        (1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'),\n"
            "        (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),\n"
            "        (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I'),\n"
            "    ]\n"
            "    result = []\n"
            "    for value, symbol in values:\n"
            "        while n >= value:\n"
            "            result.append(symbol)\n"
            "            n -= value\n"
            "    return ''.join(result)\n"
        ),
        "tests": [
            {"args": [3], "expected": "III"},
            {"args": [4], "expected": "IV"},
            {"args": [9], "expected": "IX"},
            {"args": [58], "expected": "LVIII"},
            {"args": [1994], "expected": "MCMXCIV"},
            {"args": [40], "expected": "XL"},
            {"args": [2024], "expected": "MMXXIV"},
            {"args": [400], "expected": "CD"},
        ],
    },
    {
        "slug": "longest-common-prefix",
        "title": "Longest Common Prefix",
        "difficulty": "easy",
        "tags": ["string"],
        "statement_md": (
            "Given a list of strings `strs`, return the longest common prefix "
            'of all of them, or `""` if there isn\'t one.\n\n`def solve(strs):`'
        ),
        "starter_code": "def solve(strs):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(strs):\n"
            "    if not strs:\n"
            "        return ''\n"
            "    prefix = strs[0]\n"
            "    for s in strs[1:]:\n"
            "        while not s.startswith(prefix):\n"
            "            prefix = prefix[:-1]\n"
            "            if not prefix:\n"
            "                return ''\n"
            "    return prefix\n"
        ),
        "tests": [
            {"args": [["flower", "flow", "flight"]], "expected": "fl"},
            {"args": [["dog", "racecar", "car"]], "expected": ""},
            {"args": [[""]], "expected": ""},
            {"args": [["a"]], "expected": "a"},
            {"args": [[]], "expected": ""},
            {
                "args": [["interspecies", "interstellar", "interstate"]],
                "expected": "inters",
            },
            {"args": [["throne", "throne"]], "expected": "throne"},
            {"args": [["ab", "a"]], "expected": "a"},
        ],
    },
    {
        "slug": "first-unique-char",
        "title": "First Unique Character",
        "difficulty": "easy",
        "tags": ["string", "hash-map"],
        "statement_md": (
            "Given a string `s`, return the index of the first character that "
            "doesn't repeat, or `-1` if every character repeats.\n\n`def solve(s):`"
        ),
        "starter_code": "def solve(s):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(s):\n"
            "    counts = {}\n"
            "    for ch in s:\n"
            "        counts[ch] = counts.get(ch, 0) + 1\n"
            "    for i, ch in enumerate(s):\n"
            "        if counts[ch] == 1:\n"
            "            return i\n"
            "    return -1\n"
        ),
        "tests": [
            {"args": ["leetcode"], "expected": 0},
            {"args": ["loveleetcode"], "expected": 2},
            {"args": ["aabb"], "expected": -1},
            {"args": [""], "expected": -1},
            {"args": ["z"], "expected": 0},
            {"args": ["abcabcde"], "expected": 6},
            {"args": ["swiss"], "expected": 1},
            {"args": ["abcd"], "expected": 0},
        ],
    },
    {
        "slug": "intersection-of-two-arrays",
        "title": "Intersection of Two Arrays",
        "difficulty": "easy",
        "tags": ["array", "hash-map"],
        "statement_md": (
            "Given two lists `a` and `b`, return the sorted list of unique "
            "values present in both.\n\n`def solve(a, b):`"
        ),
        "starter_code": "def solve(a, b):\n    # TODO: implement\n    pass\n",
        "reference_solution": "def solve(a, b):\n    return sorted(set(a) & set(b))\n",
        "tests": [
            {"args": [[1, 2, 2, 1], [2, 2]], "expected": [2]},
            {"args": [[4, 9, 5], [9, 4, 9, 8, 4]], "expected": [4, 9]},
            {"args": [[], [1, 2]], "expected": []},
            {"args": [[1, 2, 3], []], "expected": []},
            {"args": [[1, 1, 1], [1, 1]], "expected": [1]},
            {"args": [[1, 2, 3], [4, 5, 6]], "expected": []},
            {"args": [[5, 3, 1], [3, 1, 5]], "expected": [1, 3, 5]},
            {"args": [[-1, -2, -2], [-2, -3]], "expected": [-2]},
        ],
    },
    {
        "slug": "merge-intervals",
        "title": "Merge Intervals",
        "difficulty": "medium",
        "tags": ["array", "intervals"],
        "statement_md": (
            "Given a list of `[start, end]` intervals (possibly unsorted, "
            "possibly overlapping), return the merged, sorted, non-overlapping "
            "set of intervals.\n\n`def solve(intervals):`"
        ),
        "starter_code": "def solve(intervals):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(intervals):\n"
            "    if not intervals:\n"
            "        return []\n"
            "    ordered = sorted(intervals, key=lambda pair: pair[0])\n"
            "    merged = [list(ordered[0])]\n"
            "    for start, end in ordered[1:]:\n"
            "        if start <= merged[-1][1]:\n"
            "            merged[-1][1] = max(merged[-1][1], end)\n"
            "        else:\n"
            "            merged.append([start, end])\n"
            "    return merged\n"
        ),
        "tests": [
            {
                "args": [[[1, 3], [2, 6], [8, 10], [15, 18]]],
                "expected": [[1, 6], [8, 10], [15, 18]],
            },
            {"args": [[[1, 4], [4, 5]]], "expected": [[1, 5]]},
            {"args": [[[1, 4], [0, 4]]], "expected": [[0, 4]]},
            {"args": [[]], "expected": []},
            {"args": [[[1, 4]]], "expected": [[1, 4]]},
            {"args": [[[1, 4], [2, 3]]], "expected": [[1, 4]]},
            {"args": [[[1, 10], [2, 3], [4, 5], [6, 7]]], "expected": [[1, 10]]},
            {
                "args": [[[5, 6], [1, 2], [3, 4]]],
                "expected": [[1, 2], [3, 4], [5, 6]],
            },
        ],
    },
    {
        "slug": "climbing-stairs",
        "title": "Climbing Stairs",
        "difficulty": "easy",
        "tags": ["dynamic-programming"],
        "statement_md": (
            "Given `n` stairs, and steps of 1 or 2 stairs at a time, return "
            "the number of distinct ways to reach the top.\n\n`def solve(n):`"
        ),
        "starter_code": "def solve(n):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(n):\n"
            "    if n == 0:\n"
            "        return 1\n"
            "    a, b = 1, 1\n"
            "    for _ in range(n - 1):\n"
            "        a, b = b, a + b\n"
            "    return b\n"
        ),
        "tests": [
            {"args": [1], "expected": 1},
            {"args": [2], "expected": 2},
            {"args": [3], "expected": 3},
            {"args": [4], "expected": 5},
            {"args": [5], "expected": 8},
            {"args": [6], "expected": 13},
            {"args": [10], "expected": 89},
            {"args": [0], "expected": 1},
        ],
    },
    {
        "slug": "house-robber",
        "title": "House Robber",
        "difficulty": "medium",
        "tags": ["dynamic-programming"],
        "statement_md": (
            "Given a list `nums` of non-negative amounts of money at each "
            "house, return the maximum sum obtainable without robbing two "
            "adjacent houses.\n\n`def solve(nums):`"
        ),
        "starter_code": "def solve(nums):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(nums):\n"
            "    prev, curr = 0, 0\n"
            "    for n in nums:\n"
            "        prev, curr = curr, max(curr, prev + n)\n"
            "    return curr\n"
        ),
        "tests": [
            {"args": [[1, 2, 3, 1]], "expected": 4},
            {"args": [[2, 7, 9, 3, 1]], "expected": 12},
            {"args": [[]], "expected": 0},
            {"args": [[5]], "expected": 5},
            {"args": [[5, 1]], "expected": 5},
            {"args": [[2, 1, 1, 2]], "expected": 4},
            {"args": [[1, 2, 3, 4, 5]], "expected": 9},
            {"args": [[10, 1, 1, 10]], "expected": 20},
        ],
    },
    {
        "slug": "coin-change-min-coins",
        "title": "Coin Change (Minimum Coins)",
        "difficulty": "medium",
        "tags": ["dynamic-programming"],
        "statement_md": (
            "Given a list of coin denominations `coins` and a target `amount`, "
            "return the minimum number of coins needed to make `amount`, or "
            "`-1` if it can't be made.\n\n`def solve(coins, amount):`"
        ),
        "starter_code": "def solve(coins, amount):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(coins, amount):\n"
            "    INF = float('inf')\n"
            "    dp = [0] + [INF] * amount\n"
            "    for a in range(1, amount + 1):\n"
            "        for c in coins:\n"
            "            if c <= a and dp[a - c] + 1 < dp[a]:\n"
            "                dp[a] = dp[a - c] + 1\n"
            "    return dp[amount] if dp[amount] != INF else -1\n"
        ),
        "tests": [
            {"args": [[1, 2, 5], 11], "expected": 3},
            {"args": [[2], 3], "expected": -1},
            {"args": [[1], 0], "expected": 0},
            {"args": [[1], 1], "expected": 1},
            {"args": [[1, 2, 5], 0], "expected": 0},
            {"args": [[1, 3, 4], 6], "expected": 2},
            {"args": [[5], 5], "expected": 1},
            {"args": [[3, 7], 12], "expected": 4},
        ],
    },
    {
        "slug": "power-fast-exponentiation",
        "title": "Fast Exponentiation",
        "difficulty": "medium",
        "tags": ["math", "bit-manipulation"],
        "statement_md": (
            "Given an integer `base` and a non-negative integer `exp`, return "
            "`base ** exp` using fast (binary) exponentiation rather than "
            "`exp` repeated multiplications.\n\n`def solve(base, exp):`"
        ),
        "starter_code": "def solve(base, exp):\n    # TODO: implement\n    pass\n",
        "reference_solution": (
            "def solve(base, exp):\n"
            "    result = 1\n"
            "    b = base\n"
            "    e = exp\n"
            "    while e > 0:\n"
            "        if e & 1:\n"
            "            result *= b\n"
            "        b *= b\n"
            "        e >>= 1\n"
            "    return result\n"
        ),
        "tests": [
            {"args": [2, 10], "expected": 1024},
            {"args": [3, 0], "expected": 1},
            {"args": [5, 3], "expected": 125},
            {"args": [2, 0], "expected": 1},
            {"args": [0, 5], "expected": 0},
            {"args": [1, 100], "expected": 1},
            {"args": [2, 20], "expected": 1048576},
            {"args": [7, 4], "expected": 2401},
        ],
    },
]


def _problem_id(slug: str) -> str:
    return f"p_{slug}"


async def seed_problems(*, store: ProblemStore) -> int:
    count = 0
    for entry in PROBLEMS:
        problem = Problem(
            id=_problem_id(str(entry["slug"])),
            slug=str(entry["slug"]),
            title=str(entry["title"]),
            difficulty=str(entry["difficulty"]),
            tags=tuple(entry["tags"]),  # type: ignore[arg-type]
            statement_md=str(entry["statement_md"]),
            starter_code=str(entry["starter_code"]),
            tests=tuple(entry["tests"]),  # type: ignore[arg-type]
        )
        await store.upsert(problem)
        count += 1
    return count


async def _main() -> None:
    from app.db import get_pool
    from app.problems.problem_store import PostgresProblemStore

    store = PostgresProblemStore(await get_pool())
    count = await seed_problems(store=store)
    print(f"seeded {count} problems")


if __name__ == "__main__":
    import asyncio

    asyncio.run(_main())
