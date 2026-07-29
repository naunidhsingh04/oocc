"""docs/PRD.md §3.2: "`changed` is the animation contract... If `changed`
is wrong, animations are wrong — write property tests for it." No test
anywhere in this repo (Python or TypeScript) exercised the real tracer's
`changed[]` computation before this file — found during the pre-launch
audit's PRD traceability pass (docs/AUDIT.md Pass 2). Not literally
property-based (`hypothesis` isn't a dependency anywhere in this repo, and
adding a new testing-strategy dependency for one file is more change than
this gap warrants) — these are example-based tests against hand-verified
expected paths, covering the three shapes PRD's own grammar names:
`frame_id.local`, `oN[index]`, and `oN.field`. `oN{key}` (dict-key paths)
already has direct coverage via `insight_scanner`'s own tests reading real
`changed` output for dict mutations.
"""

from __future__ import annotations

from executor_app.tracer import Tracer


def _changed_by_line(trace: dict, line: int) -> list[list[str]]:
    """Every `changed` list from a step landing on `line`, in step order —
    a source line can execute more than once (a loop), and each specific
    step's `changed` still has to be exactly right."""
    return [step["changed"] for step in trace["steps"] if step["line"] == line]


def test_scalar_reassignment_produces_exactly_one_local_path() -> None:
    trace = Tracer().run("x = 1\nx = 2\n")
    # Step landing on line 2 (the second assignment) records what changed
    # *getting there*, i.e. the effect of line 1 — the tracer's LINE event
    # fires before a line executes, matching sys.monitoring's own semantics
    # (confirmed against the committed binary_search fixture during the
    # audit: `mid`'s new value is `changed` at the step *after* its
    # assignment line, not on it).
    changed_on_line_2 = _changed_by_line(trace, 2)
    assert changed_on_line_2 == [["f0.x"]]


def test_in_place_swap_changes_exactly_the_two_swapped_indices() -> None:
    source = "arr = [1, 2, 3]\narr[0], arr[1] = arr[1], arr[0]\nz = 0\n"
    trace = Tracer().run(source)
    # The swap is on line 2; its effect shows up in `changed` at the next
    # recorded step (line 3) — same "line event fires before the line
    # runs" rule as above. Exactly the two swapped indices, nothing else
    # (not a third phantom entry, not just one of the two).
    changed_after_swap = _changed_by_line(trace, 3)
    assert changed_after_swap == [["o1[0]", "o1[1]"]]


def test_nested_field_mutation_uses_the_field_path_form() -> None:
    source = (
        "class Node:\n"
        "    def __init__(self, val):\n"
        "        self.val = val\n"
        "node = Node(1)\n"
        "node.val = 2\n"
        "z = 0\n"
    )
    trace = Tracer().run(source)
    # o1 is the `Node` class object itself (bound to the module-level name
    # `Node` the moment the class statement executes); o2 is the instance
    # `Node(1)` creates — verified against the trace's own `heap` keys, not
    # assumed.
    changed_after_mutation = _changed_by_line(trace, 6)
    assert changed_after_mutation == [["o2.val"]]
