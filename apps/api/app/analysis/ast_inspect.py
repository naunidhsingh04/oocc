"""AST analysis for complexity_analyst: which top-level function is "the
algorithm", which of its parameters carries the input size, and how to
synthesize a fresh call to it at a chosen size/shape (docs/PRD.md §4.3).
Pure syntax analysis — no execution, no LLM.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import TypeGuard

# Secondary-parameter defaults, by common DSA naming convention. Anything
# not matched here defaults to 0 — a reasonable, if imperfect, fallback;
# see complexity_analyst's module docstring for what this trades away.
_ZERO_NAMES = {"low", "lo", "start", "begin", "from_"}
_SENTINEL_NAMES = {"target", "x", "key", "val", "value", "needle"}
UNREACHABLE_SENTINEL = -(10**9)


@dataclass(frozen=True)
class SizeParameter:
    name: str
    kind: str  # "list_int" | "int"


def find_primary_function(source: str) -> ast.FunctionDef | None:
    """The function most likely to *be* the algorithm: called from module
    scope (directly, or from inside a module-level loop), preferring
    whichever candidate contains a loop or recursion and has the largest
    body when several qualify.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    top_level_funcs = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
    if not top_level_funcs:
        return None

    module_stmts = [
        node
        for node in tree.body
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    ]
    module_level_calls: set[str] = set()
    for stmt in module_stmts:
        module_level_calls |= _called_names(stmt)

    roots = [name for name in top_level_funcs if name in module_level_calls]
    if not roots:
        roots = list(top_level_funcs)

    order = list(top_level_funcs)

    def score(name: str) -> tuple[int, int, int]:
        fn = top_level_funcs[name]
        has_loop = 1 if _contains_loop(fn) else 0
        is_recursive = 1 if name in _called_names(fn) else 0
        body_size = sum(1 for _ in ast.walk(fn))
        return (has_loop + is_recursive, body_size, -order.index(name))

    best_name = max(roots, key=score)
    return top_level_funcs[best_name]


def find_size_parameter(fn: ast.FunctionDef, source: str) -> SizeParameter | None:
    """`source` is used to also look inside sibling top-level functions
    (e.g. quicksort's own body never indexes `arr` — only the `partition`
    helper it delegates to does, under the same parameter name): usage
    anywhere in the module under a matching name is still real evidence.
    """
    param_names = [a.arg for a in fn.args.args]
    if not param_names:
        return None

    try:
        tree = ast.parse(source)
    except SyntaxError:
        tree = ast.Module(body=[fn], type_ignores=[])
    search_scope: list[ast.AST] = [
        node for node in tree.body if isinstance(node, ast.FunctionDef)
    ] or [fn]

    container_score = dict.fromkeys(param_names, 0)
    int_score = dict.fromkeys(param_names, 0)

    for scope in search_scope:
        for node in ast.walk(scope):
            if _is_call_to(node, "len") and node.args and _is_name_in(node.args[0], param_names):
                container_score[node.args[0].id] += 3
            elif isinstance(node, ast.Subscript) and _is_name_in(node.value, param_names):
                container_score[node.value.id] += 2
            elif isinstance(node, ast.For) and _is_name_in(node.iter, param_names):
                container_score[node.iter.id] += 2
            elif _is_call_to(node, "range"):
                for arg in node.args:
                    if _is_name_in(arg, param_names):
                        container_score[arg.id] += 1
            elif isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Sub, ast.Add)):
                for side in (node.left, node.right):
                    if _is_name_in(side, param_names):
                        int_score[side.id] += 1
            elif isinstance(node, ast.Compare):
                for side in [node.left, *node.comparators]:
                    if _is_name_in(side, param_names):
                        int_score[side.id] += 1

    best_container = max(param_names, key=lambda p: container_score[p])
    best_int = max(param_names, key=lambda p: int_score[p])

    if (
        container_score[best_container] > 0
        and container_score[best_container] >= int_score[best_int]
    ):
        return SizeParameter(best_container, "list_int")
    if int_score[best_int] > 0:
        return SizeParameter(best_int, "int")
    return None


def build_harness_source(
    source: str, fn: ast.FunctionDef, size_param: SizeParameter, n: int, shape: str
) -> str:
    """Function/class definitions from the original source, verbatim,
    followed by a synthetic call: generated data for the size-bearing
    parameter, name-heuristic defaults for everything else."""
    tree = ast.parse(source)
    defs = [
        node
        for node in tree.body
        if isinstance(
            node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Import, ast.ImportFrom)
        )
    ]
    header = "\n".join(ast.unparse(node) for node in defs)

    lines = [header, ""]
    if size_param.kind == "list_int":
        lines.append(f"{size_param.name} = {_generate_list_literal(n, shape)}")
    else:
        lines.append(f"{size_param.name} = {n}")

    call_args = [
        p.arg if p.arg == size_param.name else _secondary_default(p.arg, size_param)
        for p in fn.args.args
    ]
    lines.append(f"{fn.name}({', '.join(call_args)})")
    return "\n".join(lines) + "\n"


def _secondary_default(param_name: str, size_param: SizeParameter) -> str:
    lower = param_name.lower()
    if lower in _ZERO_NAMES:
        return "0"
    if lower in {"high", "hi", "end", "stop"}:
        return f"len({size_param.name}) - 1" if size_param.kind == "list_int" else "0"
    if lower in _SENTINEL_NAMES:
        return str(UNREACHABLE_SENTINEL)
    return "0"


def _generate_list_literal(n: int, shape: str) -> str:
    if shape == "sorted":
        return f"list(range({n}))"
    if shape == "reverse":
        return f"list(range({n} - 1, -1, -1))"
    if shape == "all_equal":
        return f"[7] * {n}"
    # "random", seeded for reproducibility.
    return f"[__import__('random').Random(42).randint(0, 10**6) for _ in range({n})]"


def _called_names(node: ast.AST) -> set[str]:
    return {
        call.func.id
        for call in ast.walk(node)
        if isinstance(call, ast.Call) and isinstance(call.func, ast.Name)
    }


def _contains_loop(node: ast.AST) -> bool:
    return any(isinstance(n, (ast.For, ast.While)) for n in ast.walk(node))


def _is_call_to(node: ast.AST, name: str) -> TypeGuard[ast.Call]:
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name


def _is_name_in(node: ast.AST | None, names: list[str]) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in names
