"""cpp_executor.instrument.instrument_isolated — the process-isolated
parse entrypoint compile_service.py actually calls. Phase 6's security
review (SECURITY.md) found that a source well under MAX_SOURCE_BYTES (a
long flat operator chain) crashes libclang's native parser outright — a
stack overflow, not a catchable Python exception — which would take down
whatever process ran `instrument()` directly. These tests run each case in
its own real subprocess (matching how it actually runs), not a mock, so a
regression that silently removes the isolation shows up as this file
itself hanging or crashing, not just a unit assertion failing.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cpp_executor.instrument import instrument_isolated  # noqa: E402

SIMPLE_SOURCE = "int main() { int x = 1 + 2 * 3; return x; }\n"

# A flat, deeply left-associative expression chain — confirmed (Phase 6
# security review) to crash libclang's native recursive-descent expression
# parser via a genuine stack overflow, not raise a Python exception.
CRASHING_SOURCE = "int main() { int x = 0; x = x" + " + 1" * 40_000 + "; return x; }\n"


def test_normal_source_parses_successfully() -> None:
    result = instrument_isolated(SIMPLE_SOURCE, run_id="r_test0000000000")
    assert result.ok
    assert result.instrumented_source is not None


def test_unsupported_construct_still_reported_normally() -> None:
    source = "template<typename T> T identity(T x) { return x; }\nint main() { return identity(1); }\n"
    result = instrument_isolated(source, run_id="r_test0000000000")
    assert not result.ok
    assert result.diagnostics[0].kind == "unsupported_construct"


def test_a_parser_crashing_input_is_contained_not_propagated() -> None:
    result = instrument_isolated(CRASHING_SOURCE, run_id="r_test0000000000", timeout_s=20)
    assert not result.ok
    assert result.diagnostics[0].kind == "resource_limit"
    assert "crashed" in result.diagnostics[0].message


def test_a_hanging_parse_is_stopped_by_the_timeout() -> None:
    # A real infinite loop isn't reachable inside libclang's C++ parser from
    # Python-supplied source, so this proves the timeout path itself works
    # by setting an impossibly small budget against ordinary input rather
    # than needing a genuinely-hanging construct.
    result = instrument_isolated(SIMPLE_SOURCE, run_id="r_test0000000000", timeout_s=0.001)
    assert not result.ok
    assert result.diagnostics[0].kind == "resource_limit"
    assert "timed out" in result.diagnostics[0].message
