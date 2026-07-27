// OOCC C++ tracer: the frame/step engine. Implements the injection-call
// table from PRD §3.5: oocc_step (line), oocc_enter/oocc_exit (call/
// return, depth, stack), oocc_bind (locals), oocc_access (changed +
// comparison events on container elements).
//
// Known, deliberate limitation: a stack-resident container/struct local's
// "oN" identity (assigned via AddressTable::get_or_register_local, keyed
// by its own address) is never invalidated when its owning frame returns.
// For straight-line teaching programs this is invisible; for a recursive
// function whose *own* stack frame happens to reuse the same address for
// a same-shaped container local across two unrelated calls at the same
// depth, it could incorrectly carry the old identity forward instead of
// getting a fresh one. Properly scoping this needs distinguishing
// "address belongs to the current frame's own stack slot" from "address
// was reached by dereferencing a heap pointer" at every nesting level,
// which didn't fit this pass's time budget — noted here rather than
// silently shipped. None of the six Phase 4 fixtures hit it.
//
// Trap survival (§3.5 "crashes are a feature"): a genuine WASM trap kills
// the instance immediately with no C++-level unwind, so finalize_and_emit's
// normal fd-1 write never runs. Every completed step is therefore ALSO
// appended, as it completes, to a flat buffer exposed via
// oocc_trap_buffer_ptr()/oocc_trap_buffer_len() — exported WASM functions
// the browser worker calls after catching a trapped call, to recover
// everything up to the last good step directly from the (still-readable)
// linear memory of the dead instance. The flat buffer only tracks the
// first `keep_head` steps (see push_completed_step); a trap after that
// point is the rare case of a program running cleanly for tens of
// thousands of steps before finally crashing, and degrades to "last good
// step is somewhere in the head" rather than the exact final step.
#pragma once

#include "oocc_trace.hpp"
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <deque>
#include <functional>
#include <iostream>
#include <streambuf>
#include <unistd.h>

namespace oocc {

// ---------------------------------------------------------------------
// Frame / binding model + the leaked TraceState singleton, moved ahead of
// stdout capture below since CapturingStreambuf needs BookkeepingGuard.
// ---------------------------------------------------------------------

struct Binding {
    std::string name;
    std::function<std::string(HeapCollector&, const std::string&)> describe;
};

struct RuntimeFrame {
    std::string frame_id;
    std::string func;
    int line = 0;
    std::vector<Binding> bindings;  // insertion order preserved, like a Python locals dict
    std::vector<std::string> args;  // param names, only for call-pushed frames
    bool has_args = false;
    int call_site_line = -1;
};

struct TraceState {
    std::vector<RuntimeFrame> frame_stack;
    uint64_t next_frame_id = 1;

    std::vector<std::string> head_steps;
    std::deque<std::string> tail_ring;
    size_t keep_head = 40000;
    size_t keep_tail = 10000;
    size_t step_limit = 100000;
    double wall_clock_limit_s = 15.0;

    uint64_t executed_step_count = 0;
    std::unordered_map<std::string, std::string> prev_paths;
    std::vector<std::string> forced_changed_this_step;  // from oocc_access "touch" events

    std::string flat_trap_buffer;   // ND-JSON of completed steps, head-only — see file docstring
    std::string run_meta_prefix;    // `{"schema_version":...,"run_id":...,"language":"cpp","source_hash":...,` — set once by oocc_set_meta
    std::chrono::steady_clock::time_point start_time;
    bool finished = false;
};

inline TraceState& trace_state() {
    alignas(TraceState) static unsigned char storage[sizeof(TraceState)];
    static TraceState* t = new (storage) TraceState();
    return *t;
}

// Every runtime-internal container mutation (frame stack, bindings,
// pending_stdout, trace buffers) happens while this guard is held, so
// none of it is mistaken for a user allocation by the address table (see
// oocc_runtime.hpp's in_bookkeeping()). describe_value() calls made on
// *user* bindings while building a step's snapshot still correctly assign
// object identities even under this guard: identity assignment
// (AddressTable::register_alloc / get_or_register_local) is a direct
// table mutation, not gated by in_bookkeeping — only the address table's
// own internal std::unordered_map allocations are.
struct BookkeepingGuard {
    bool already;
    BookkeepingGuard() : already(in_bookkeeping()) { in_bookkeeping() = true; }
    ~BookkeepingGuard() { in_bookkeeping() = already; }
};

// ---------------------------------------------------------------------
// stdout capture: std::cout's streambuf is swapped for one that buffers
// into `pending_stdout()` instead of writing immediately. oocc_step()
// flushes whatever accumulated since the last statement as its own
// "stdout" step before recording the new line — the same interleaving
// Tracer._on_stdout_write produces in the Python engine. Raw C stdio
// (printf) isn't intercepted in this first cut (documented scope cut);
// the teaching subset's idiomatic path is std::cout.
// ---------------------------------------------------------------------

inline std::string& pending_stdout() {
    alignas(std::string) static unsigned char storage[sizeof(std::string)];
    static std::string* s = new (storage) std::string();
    return *s;
}

class CapturingStreambuf : public std::streambuf {
protected:
    std::streamsize xsputn(const char* s, std::streamsize n) override {
        BookkeepingGuard g;
        pending_stdout().append(s, static_cast<size_t>(n));
        return n;
    }
    int overflow(int c) override {
        if (c != EOF) {
            BookkeepingGuard g;
            pending_stdout().push_back(static_cast<char>(c));
        }
        return c;
    }
};

inline void install_stdout_capture() {
    static CapturingStreambuf buf;
    std::cout.rdbuf(&buf);
}

// ---------------------------------------------------------------------
// Trap-recovery + clean-exit output
// ---------------------------------------------------------------------

extern "C" {
const char* oocc_trap_buffer_ptr() { return trace_state().flat_trap_buffer.c_str(); }
size_t oocc_trap_buffer_len() { return trace_state().flat_trap_buffer.size(); }
}

// fd 1, not a separate fd: std::cout is redirected through
// CapturingStreambuf above and never touches the real fd 1 itself, so fd 1
// is free for the trace's own single final write. This sidesteps every
// WASI host needing bespoke "open an extra output fd" setup (Node's
// node:wasi has no simple way to hand a wasm instance a raw writable fd
// beyond 0/1/2 without preopening a directory) — any WASI runtime,
// including the custom browser worker shim, already implements fd 1's
// fd_write on day one. Raw C stdio (printf) isn't captured (documented
// scope cut in the file docstring above) and would race this if a program
// used it — acceptable since none of the six Phase 4 fixtures do.
constexpr int kTraceFd = 1;

inline void write_all_to_fd(int fd, const std::string& s) {
    size_t off = 0;
    while (off < s.size()) {
        ssize_t n = ::write(fd, s.data() + off, s.size() - off);
        if (n <= 0) break;
        off += static_cast<size_t>(n);
    }
}

inline void oocc_set_meta(const std::string& run_meta_prefix) {
    BookkeepingGuard g;
    trace_state().run_meta_prefix = run_meta_prefix;
}

// Called once, at normal program exit or when a step/wall-clock limit is
// hit. Assembles the properly head+tail-truncated step array and writes
// the complete trace.schema.json envelope to fd 1 in one shot (see the
// kTraceFd comment above for why fd 1, not a dedicated fd 3).
inline void finalize_and_emit(const std::string& status, const std::string& error_json_or_empty) {
    BookkeepingGuard g;
    auto& st = trace_state();
    if (st.finished) return;
    st.finished = true;

    bool truncated = st.executed_step_count > st.keep_head + st.keep_tail;

    std::string steps_json = "[";
    bool first = true;
    for (const auto& s : st.head_steps) {
        if (!first) steps_json += ",";
        first = false;
        steps_json += s;
    }
    for (const auto& s : st.tail_ring) {
        if (!first) steps_json += ",";
        first = false;
        steps_json += s;
    }
    steps_json += "]";

    size_t kept = st.head_steps.size() + st.tail_ring.size();
    double duration_ms =
        std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - st.start_time).count();

    std::string out = st.run_meta_prefix;
    out += "\"status\":" + json_string(status) + ",";
    out += "\"meta\":{\"duration_ms\":" + std::to_string(duration_ms) + ",\"step_count\":" + std::to_string(kept) +
           ",\"truncated\":" + (truncated ? "true" : "false") +
           ",\"stdin\":\"\",\"peak_heap_objects\":" + std::to_string(address_table().total_issued()) + "}";
    if (!error_json_or_empty.empty()) out += ",\"error\":" + error_json_or_empty;
    out += ",\"steps\":" + steps_json + "}";

    write_all_to_fd(kTraceFd, out);
}

inline void abort_and_exit(const std::string& status) {
    finalize_and_emit(status, "");
    std::_Exit(0);
}

// ---------------------------------------------------------------------
// Step recording
// ---------------------------------------------------------------------

inline void push_completed_step(const std::string& step_json) {
    auto& st = trace_state();
    if (st.head_steps.size() < st.keep_head) {
        st.head_steps.push_back(step_json);
        st.flat_trap_buffer += step_json;
        st.flat_trap_buffer += "\n";
    } else {
        if (st.tail_ring.size() >= st.keep_tail) st.tail_ring.pop_front();
        st.tail_ring.push_back(step_json);
    }
}

inline std::string build_stack_and_heap(HeapCollector& hc, std::string& stack_json_out) {
    auto& st = trace_state();
    stack_json_out = "[";
    bool first_frame = true;
    for (auto& f : st.frame_stack) {
        if (!first_frame) stack_json_out += ",";
        first_frame = false;
        std::string locals_json = "{";
        bool first_local = true;
        for (auto& b : f.bindings) {
            if (!first_local) locals_json += ",";
            first_local = false;
            locals_json += json_string(b.name) + ":" + b.describe(hc, f.frame_id + "." + b.name);
        }
        locals_json += "}";
        stack_json_out += "{\"frame_id\":" + json_string(f.frame_id) + ",\"func\":" + json_string(f.func) +
                           ",\"line\":" + std::to_string(f.line) + ",\"locals\":" + locals_json;
        if (f.has_args) {
            stack_json_out += ",\"args\":[";
            for (size_t i = 0; i < f.args.size(); ++i) {
                if (i) stack_json_out += ",";
                stack_json_out += json_string(f.args[i]);
            }
            stack_json_out += "]";
        }
        if (f.call_site_line >= 0) stack_json_out += ",\"call_site_line\":" + std::to_string(f.call_site_line);
        stack_json_out += "}";
    }
    stack_json_out += "]";

    std::string heap_json = "{";
    bool first_obj = true;
    for (auto& kv : hc.objects) {
        if (!first_obj) heap_json += ",";
        first_obj = false;
        heap_json += json_string(kv.first) + ":" + kv.second;
    }
    heap_json += "}";
    return heap_json;
}

// `returned_json` is "" for a line/call/stdout step, and a precomputed
// Value fragment (already built by the caller, see oocc_exit<T> below)
// for a return step.
inline void record_step(const char* event, const std::string& returned_json, const std::string& stdout_delta) {
    BookkeepingGuard g;
    auto& st = trace_state();

    st.executed_step_count++;
    uint64_t i = st.executed_step_count - 1;

    HeapCollector hc;
    std::string stack_json;
    std::string heap_json = build_stack_and_heap(hc, stack_json);

    std::vector<std::string> changed;
    for (auto& kv : hc.current_paths) {
        auto it = st.prev_paths.find(kv.first);
        if (it == st.prev_paths.end() || it->second != kv.second) changed.push_back(kv.first);
    }
    for (auto& p : st.forced_changed_this_step) {
        if (hc.current_paths.count(p) && std::find(changed.begin(), changed.end(), p) == changed.end())
            changed.push_back(p);
    }
    st.forced_changed_this_step.clear();
    std::sort(changed.begin(), changed.end());
    st.prev_paths = std::move(hc.current_paths);

    RuntimeFrame* top = st.frame_stack.empty() ? nullptr : &st.frame_stack.back();

    std::string step = "{\"i\":" + std::to_string(i) + ",\"event\":" + json_string(event) +
                        ",\"line\":" + std::to_string(top ? top->line : 0) +
                        ",\"func\":" + json_string(top ? top->func : "<module>") +
                        ",\"depth\":" + std::to_string(st.frame_stack.size()) + ",\"stack\":" + stack_json +
                        ",\"heap\":" + heap_json + ",\"stdout_delta\":" + json_string(stdout_delta) +
                        ",\"changed\":[";
    for (size_t k = 0; k < changed.size(); ++k) {
        if (k) step += ",";
        step += json_string(changed[k]);
    }
    step += "]";
    if (!returned_json.empty()) step += ",\"returned\":" + returned_json;
    if (hc.truncated) step += ",\"heap_truncated\":true";
    step += "}";

    push_completed_step(step);

    if (st.executed_step_count >= st.step_limit) {
        abort_and_exit("step_limit");
    } else if (st.executed_step_count % 2048 == 0) {
        double elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - st.start_time).count();
        if (elapsed > st.wall_clock_limit_s) abort_and_exit("timeout");
    }
}

inline void flush_pending_stdout() {
    if (!pending_stdout().empty()) {
        std::string text;
        {
            BookkeepingGuard g;
            text.swap(pending_stdout());
        }
        record_step("stdout", "", text);
    }
}

inline void finish_frame_pop() {
    auto& st = trace_state();
    if (!st.frame_stack.empty()) st.frame_stack.pop_back();
}

// ---------------------------------------------------------------------
// Public injection API (PRD §3.5's table)
// ---------------------------------------------------------------------

inline void oocc_init() {
    BookkeepingGuard g;
    trace_state().start_time = std::chrono::steady_clock::now();
    install_stdout_capture();
}

inline void oocc_step(int line, int /*col*/) {
    flush_pending_stdout();
    {
        BookkeepingGuard g;
        if (!trace_state().frame_stack.empty()) trace_state().frame_stack.back().line = line;
    }
    record_step("line", "", "");
}

inline void oocc_enter(const char* func_name) {
    flush_pending_stdout();
    bool is_module_entry;
    {
        BookkeepingGuard g;
        auto& st = trace_state();
        is_module_entry = st.frame_stack.empty();
        int call_site_line = is_module_entry ? -1 : st.frame_stack.back().line;
        RuntimeFrame f;
        f.frame_id = "f" + std::to_string(st.next_frame_id++);
        f.func = func_name;
        // Schema requires line >= 1. The callee's own first oocc_step()
        // hasn't run yet at the moment the "call" step itself is
        // recorded, so seed with the call site's line (or 1 for the
        // outermost module frame, which has no caller) rather than 0.
        f.line = call_site_line > 0 ? call_site_line : 1;
        f.call_site_line = call_site_line;
        st.frame_stack.push_back(std::move(f));
    }
    if (!is_module_entry) record_step("call", "", "");
}

// Records the parameter names for the frame just pushed by oocc_enter —
// the pass emits this right after entering, before the per-parameter
// oocc_bind calls that actually populate their values.
inline void oocc_set_args(std::initializer_list<const char*> names) {
    BookkeepingGuard g;
    auto& st = trace_state();
    if (st.frame_stack.empty()) return;
    RuntimeFrame& f = st.frame_stack.back();
    f.has_args = true;
    for (const char* n : names) f.args.emplace_back(n);
}

template <class T>
void oocc_exit(const T& retval) {
    flush_pending_stdout();
    bool is_module_exit;
    {
        BookkeepingGuard g;
        is_module_exit = trace_state().frame_stack.size() == 1;
    }
    if (!is_module_exit) {
        HeapCollector hc;
        std::string returned_json = describe_value(retval, hc, "");
        record_step("return", returned_json, "");
    }
    BookkeepingGuard g;
    finish_frame_pop();
}

inline void oocc_exit_void() {
    flush_pending_stdout();
    bool is_module_exit;
    {
        BookkeepingGuard g;
        is_module_exit = trace_state().frame_stack.size() == 1;
    }
    if (!is_module_exit) record_step("return", "{\"val\":null,\"repr\":\"void\"}", "");
    BookkeepingGuard g;
    finish_frame_pop();
}

template <class T>
void oocc_bind(const char* name, T& var) {
    BookkeepingGuard g;
    auto& st = trace_state();
    if (st.frame_stack.empty()) return;
    RuntimeFrame& f = st.frame_stack.back();
    auto describe_fn = [&var](HeapCollector& hc, const std::string& path) { return describe_value(var, hc, path); };
    for (auto& b : f.bindings) {
        if (b.name == name) {
            b.describe = describe_fn;
            return;
        }
    }
    f.bindings.push_back(Binding{name, describe_fn});
}

// Scope tracking: a variable declared inside a nested block (an `if`/
// `while`/`for` body, or a bare `{}`) has real C++ storage that dies when
// that block exits — but oocc_bind's closure captures it by reference, so
// if the binding just stayed in f.bindings for the rest of the *function*
// (matching Python's function-level locals model), any snapshot taken
// after the block ends would call describe_value on a dangling reference:
// undefined behavior, silently "working" at -O0 (stale-but-plausible
// values) and a real hazard elsewhere. Confirmed for real building this —
// see scope_probe.cpp in the tests directory for the reproduction.
//
// The pass (instrument.py) injects `oocc_scope_mark()` right after every
// nested block's opening `{` and `oocc_unbind_from(mark)` right before its
// closing `}`, so a block-scoped binding is removed the moment its real
// C++ lifetime ends — while the function's *own* top-level body (handled
// separately via the enter/exit prelude, not this mechanism) still keeps
// its top-level locals for the whole function, matching Python.
inline size_t oocc_scope_mark() {
    BookkeepingGuard g;
    auto& st = trace_state();
    if (st.frame_stack.empty()) return 0;
    return st.frame_stack.back().bindings.size();
}

inline void oocc_unbind_from(size_t mark) {
    BookkeepingGuard g;
    auto& st = trace_state();
    if (st.frame_stack.empty()) return;
    auto& bindings = st.frame_stack.back().bindings;
    if (mark < bindings.size()) bindings.resize(mark);
}

// Marks that `container[index]` was read/compared/written this step, so
// it shows up in `changed[]` even when its value happens not to differ
// from last step — the signal sort-visualization panels use to flash
// "these two elements are being compared right now."
template <class T>
void oocc_access(const T& container, size_t index, const char* /*kind*/) {
    BookkeepingGuard g;
    void* addr = static_cast<void*>(const_cast<T*>(&container));
    const AddressTable::Entry* entry = address_table().lookup(addr);
    if (!entry) return;  // not yet bound/identified — nothing to attribute the touch to
    std::string oid = "o" + std::to_string(entry->id);
    trace_state().forced_changed_this_step.push_back(index_path(oid, index));
}

}  // namespace oocc
