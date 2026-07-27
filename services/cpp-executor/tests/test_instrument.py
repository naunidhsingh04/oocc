"""Tests for cpp_executor.instrument — the libclang-based source-to-source
pass. Runs against the real Apple-bundled libclang (see instrument.py's
docstring on why libclang bindings rather than C++ LibTooling); doesn't
require wasi-sdk since these only exercise parsing/text-splicing, not the
actual wasm compile (see test_compile_service.py for that).
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cpp_executor.instrument import instrument, source_hash  # noqa: E402
from cpp_executor.toolchain import wasi_clang_args  # noqa: E402

SIMPLE_SOURCE = """
int add(int a, int b) {
    int result = a + b;
    return result;
}

int main() {
    int x = add(2, 3);
    return 0;
}
"""

STRUCT_SOURCE = """
struct Node {
    int val;
    Node* next;
};

int main() {
    Node* a = new Node{1, nullptr};
    return 0;
}
"""


def test_instruments_functions_and_returns():
    result = instrument(SIMPLE_SOURCE, run_id="r_test0000000001")
    assert result.ok, result.diagnostics
    src = result.instrumented_source
    assert 'oocc::oocc_enter("add")' in src
    assert 'oocc::oocc_enter("main")' in src
    assert "oocc::oocc_exit(__oocc_rv)" in src
    assert 'oocc::oocc_bind("result", result)' in src
    assert 'oocc::oocc_bind("a", a)' in src  # parameter bound at entry
    assert "#include \"oocc_trace.hpp\"" in src


def test_generates_describer_for_user_structs():
    result = instrument(STRUCT_SOURCE, run_id="r_test0000000002")
    assert result.ok, result.diagnostics
    src = result.instrumented_source
    assert "struct Describer<Node>" in src
    # The Describer must appear *after* the struct's own closing brace —
    # not collected and emitted up front — since it accesses Node's
    # fields and needs Node fully defined first (see instrument.py).
    struct_pos = src.index("struct Node {")
    describer_pos = src.index("struct Describer<Node>")
    assert describer_pos > struct_pos


def test_main_gets_meta_setup_and_finalize():
    result = instrument(SIMPLE_SOURCE, run_id="r_test0000000003")
    assert result.ok
    src = result.instrumented_source
    assert "oocc::oocc_init();" in src
    assert "oocc::oocc_set_meta(::oocc::kRunMetaPrefix);" in src
    assert 'oocc::finalize_and_emit("ok", "")' in src
    # non-main function must NOT get init/meta/finalize
    add_region = src[src.index('oocc_enter("add")') : src.index("int main()")]
    assert "oocc_init" not in add_region
    assert "finalize_and_emit" not in add_region


def test_rewrites_raw_allocator_calls():
    src = """
#include <cstdlib>
int main() {
    int* p = (int*)malloc(sizeof(int));
    free(p);
    return 0;
}
"""
    # Parsed against wasi-sdk's headers, same as real usage (fixtures/cpp/
    # generate.py, the future compile service) — libclang's default
    # search path has no macOS SDK sysroot configured, so a bare parse of
    # anything including <cstdlib> fails independent of this test.
    result = instrument(src, run_id="r_test0000000004", extra_clang_args=wasi_clang_args())
    assert result.ok, result.diagnostics
    assert "oocc_malloc(" in result.instrumented_source
    assert "oocc_free(" in result.instrumented_source
    # A bare (non-oocc_-prefixed) call must no longer be present.
    assert re.search(r"(?<!oocc_)\bmalloc\(", result.instrumented_source) is None
    assert re.search(r"(?<!oocc_)\bfree\(", result.instrumented_source) is None


def test_detects_unsupported_lambda_with_specific_message():
    src = """
int main() {
    auto f = []() { return 1; };
    return f();
}
"""
    result = instrument(src, run_id="r_test0000000005")
    assert not result.ok
    assert any(d.kind == "unsupported_construct" for d in result.diagnostics)
    assert any("lambda" in d.message for d in result.diagnostics)
    # PRD §3.5: "offer to run it untraced rather than refusing outright" —
    # the pass's job is just to name the construct; compile_service.py is
    # what turns this into that offer.
    assert "still compile and run" in result.diagnostics[0].message


def test_detects_parse_error():
    result = instrument("int main( { }", run_id="r_test0000000006")
    assert not result.ok
    assert any(d.kind == "parse_error" for d in result.diagnostics)


def test_class_with_member_function_instruments_and_compiles(tmp_path):
    # PRD §3.5's teaching subset explicitly promises "classes" (not just
    # PODs) — none of the six fixtures exercise a class with a method, so
    # this is the only thing verifying that path actually works, compiles,
    # and produces a correct result (not just that the pass doesn't crash).
    src = """
class Counter {
public:
    int value;

    int increment() {
        value = value + 1;
        return value;
    }
};

int main() {
    Counter c;
    c.value = 0;
    int r1 = c.increment();
    int r2 = c.increment();
    return r1 + r2;
}
"""
    result = instrument(src, run_id="r_test0000000007")
    assert result.ok, result.diagnostics
    assert "struct Describer<Counter>" in result.instrumented_source
    assert 'oocc_enter("increment")' in result.instrumented_source

    runtime_dir = Path(__file__).resolve().parents[1] / "runtime"
    src_path = tmp_path / "class_probe.cpp"
    src_path.write_text(result.instrumented_source)
    binary = tmp_path / "class_probe"
    compile_proc = subprocess.run(
        [
            "clang++", "-std=c++17", f"-I{runtime_dir}", "-Wno-unused-parameter",
            "-O0", str(src_path), "-o", str(binary),
        ],
        capture_output=True,
        text=True,
    )
    assert compile_proc.returncode == 0, compile_proc.stderr
    run_proc = subprocess.run([str(binary)], capture_output=True, text=True)
    assert run_proc.returncode == 3  # r1 + r2 == 1 + 2


def test_source_hash_matches_python_tracer_format():
    h = source_hash("int main() { return 0; }")
    assert h.startswith("sha256:")
    assert len(h) == len("sha256:") + 64
