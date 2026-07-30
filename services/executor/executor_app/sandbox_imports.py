"""Import allowlisting (docs/PRD.md §5): "Blocklist at import time: os,
subprocess, socket, ctypes, importlib, builtins.__import__ override.
Allowlist: math, random (seeded), collections, heapq, bisect, itertools,
functools, string, typing, dataclasses, re."

Implemented as an allowlist (default-deny), not an enumerated blocklist
(default-allow) of just the five named modules — PRD names those five as
the obviously dangerous ones, but a blocklist only stops the modules someone
thought to name. `shutil`, `pathlib`, `multiprocessing`, `pickle`,
`http.client`, `ftplib`, `webbrowser`, and plenty more all reach the same
filesystem/network/process capabilities `os`/`subprocess`/`socket` do and
aren't on PRD's list. §1.3's "Zero sandbox escapes. Non-negotiable" reads as
requiring the safer of the two shapes, not the one PRD's prose happens to
name second.

This is a Python-level defense-in-depth layer only, not sandboxing on its
own — see this package's own `main.py` docstring and `SECURITY.md` at the
repo root: a classic attribute-walk gadget
(`().__class__.__bases__[0].__subclasses__()`) reaches arbitrary loaded
classes, including ones that can execute code, without ever calling
`__import__` — this module does not and cannot stop that. The only thing
that actually stops it is OS-level isolation (gVisor/nsjail), which remains
unbuilt (`main.py`'s docstring). Ship this anyway: it closes the *laziest*
escape (a program that just types `import os`), it's a real layer even
though it's not the only layer, and "block the easy way in" is still worth
doing while the hard boundary is still on the roadmap.
"""

from __future__ import annotations

import builtins as _builtins_module
from typing import Any

ALLOWED_MODULES = frozenset(
    {
        "math",
        "random",
        "collections",
        "heapq",
        "bisect",
        "itertools",
        "functools",
        "string",
        "typing",
        "dataclasses",
        "re",
    }
)


class SandboxImportError(ImportError):
    """Raised in place of the real ImportError for a disallowed module —
    a distinct type so callers (and tests) can tell "blocked by us" apart
    from "genuinely doesn't exist"."""


def _restricted_import(
    name: str,
    globals: dict[str, Any] | None = None,
    locals: dict[str, Any] | None = None,
    fromlist: tuple[str, ...] = (),
    level: int = 0,
) -> Any:
    top_level = name.split(".", 1)[0]
    if top_level not in ALLOWED_MODULES:
        allowed = ", ".join(sorted(ALLOWED_MODULES))
        raise SandboxImportError(
            f"import of '{name}' isn't allowed here. OOCC's Python sandbox only allows: {allowed}."
        )
    return _builtins_module.__import__(name, globals, locals, fromlist, level)


def _blocked_open(*_args: Any, **_kwargs: Any) -> Any:
    raise SandboxImportError(
        "open() isn't allowed here — OOCC's Python sandbox has no filesystem access."
    )


def restricted_builtins() -> dict[str, Any]:
    """A fresh builtins mapping with `__import__` overridden and `open`
    removed entirely — pass as `exec()`'s `globals["__builtins__"]`. Fresh
    per call (never a shared module-level dict) so nothing about one run's
    exec() can leave a mutated builtins mapping behind for the next.

    `open` isn't a module import, so the `__import__` override alone never
    touches it — PRD's own adversarial list names `open('/etc/passwd')`
    specifically, and none of the twelve fixtures or 40-problem library do
    any legitimate file I/O, so there's no cost to removing it outright
    rather than trying to sandbox a real filesystem view.
    """
    return {**vars(_builtins_module), "__import__": _restricted_import, "open": _blocked_open}
