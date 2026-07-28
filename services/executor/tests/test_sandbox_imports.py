"""app/sandbox_imports.py — the import-allowlist layer (docs/PRD.md §5).
Also the first-ever executor-level adversarial coverage for this
codebase — see repo-root SECURITY.md for the honest, full-severity writeup
of what this does and does not stop."""

from __future__ import annotations

import pytest
from executor_app.tracer import Tracer

BLOCKED_MODULE_SOURCES = {
    "os": "import os\nprint('should not get here')\n",
    "subprocess": "import subprocess\n",
    "socket": "import socket\n",
    "ctypes": "import ctypes\n",
    "importlib": "import importlib\n",
    "shutil": "import shutil\n",  # not PRD-named, but reaches the same fs capability
    "pathlib": "from pathlib import Path\n",
    "multiprocessing": "import multiprocessing\n",
    "pickle": "import pickle\n",
}


@pytest.mark.parametrize("module_name", sorted(BLOCKED_MODULE_SOURCES))
def test_disallowed_modules_fail_safely(module_name: str) -> None:
    trace = Tracer().run(BLOCKED_MODULE_SOURCES[module_name])
    assert trace["status"] == "runtime_error"
    assert trace["error"]["type"] == "SandboxImportError"
    assert module_name in trace["error"]["message"]


@pytest.mark.parametrize("source", [
    "import math\nprint(math.sqrt(4))\n",
    "import random\nprint(random.randint(0, 10))\n",
    "import collections\nprint(collections.Counter('aab'))\n",
    "import heapq\nprint(heapq.nsmallest(1, [3, 1, 2]))\n",
    "import bisect\nprint(bisect.bisect([1, 2, 3], 2))\n",
    "import itertools\nprint(list(itertools.islice(itertools.count(), 3)))\n",
    "import functools\nprint(functools.reduce(lambda a, b: a + b, [1, 2, 3]))\n",
    "import string\nprint(string.ascii_lowercase[:3])\n",
    "import typing\nprint(typing.List)\n",
    "import dataclasses\nprint(dataclasses.field)\n",
    "import re\nprint(re.match(r'a+', 'aaa'))\n",
])
def test_allowed_modules_still_work(source: str) -> None:
    trace = Tracer().run(source)
    assert trace["status"] == "ok"


def test_open_builtin_is_blocked_not_just_module_imports() -> None:
    # PRD §5 names `open('/etc/passwd')` explicitly — `open` is a builtin,
    # not a module, so the `__import__` override alone would never catch it.
    trace = Tracer().run("open('/etc/passwd')\n")
    assert trace["status"] == "runtime_error"
    assert trace["error"]["type"] == "SandboxImportError"


def test_random_is_seeded_deterministically_from_source() -> None:
    source = "import random\nprint([random.randint(0, 1_000_000) for _ in range(5)])\n"
    first = Tracer().run(source)
    second = Tracer().run(source)
    first_stdout = "".join(s.get("stdout_delta", "") for s in first["steps"])
    second_stdout = "".join(s.get("stdout_delta", "") for s in second["steps"])
    assert first_stdout == second_stdout


def test_subclasses_gadget_bypasses_the_import_blocklist() -> None:
    """The known, documented gap (this module's own docstring, SECURITY.md):
    a classic Python-sandbox-escape technique that reaches an arbitrary
    already-loaded class via the object graph, never calling `__import__` —
    this asserts the bypass *does* still work today, so a future fix to
    this layer has a regression test that fails loudly if it's ever
    silently "fixed" by something that doesn't actually close the gap
    (e.g. only closes it for `object`, not for a specific gadget class), and
    so nobody mistakes this test suite's presence for the gap being closed.
    """
    source = (
        "found = None\n"
        "for cls in ().__class__.__bases__[0].__subclasses__():\n"
        "    if cls.__name__ == 'Popen':\n"
        "        found = cls\n"
        "        break\n"
        "print(found)\n"
    )
    trace = Tracer().run(source)
    assert trace["status"] == "ok"
    stdout = "".join(s.get("stdout_delta", "") for s in trace["steps"])
    assert "Popen" in stdout, (
        "expected the subclasses() gadget to still reach subprocess.Popen "
        "without ever importing subprocess -- if this now fails, the "
        "blocklist bypass may have been closed and SECURITY.md's severity "
        "rating for it should be revisited, not just this test"
    )
