// Native (non-WASM) smoke test for the arena allocator + address table —
// step 1 of PRD §3.5's build order. Runs as a plain host binary so
// iteration doesn't require a wasi-sdk round trip; the wasm build is
// exercised separately in test_wasm_build.py once the pass exists.
#include "../../runtime/oocc_runtime.hpp"
#include <cassert>
#include <cstdio>
#include <vector>

struct Node {
    int val;
    Node* next;
};

int main() {
    // new gets a stable, distinct id; delete unregisters it.
    Node* a = new Node{1, nullptr};
    Node* b = new Node{2, nullptr};
    a->next = b;

    auto* entry_a = oocc::address_table().lookup(a);
    auto* entry_b = oocc::address_table().lookup(b);
    assert(entry_a && entry_b);
    assert(entry_a->id != entry_b->id);
    assert(std::string(entry_a->alloc_kind) == "new");

    uint64_t id_a = entry_a->id;
    delete a;
    assert(oocc::address_table().lookup(a) == nullptr);  // freed -> no longer live

    // A fresh allocation may reuse the freed address; it must get a NEW id,
    // never id_a again (ids are never reused, matching Python's
    // next_obj_id monotonic counter).
    Node* c = new Node{3, nullptr};
    auto* entry_c = oocc::address_table().lookup(c);
    assert(entry_c);
    assert(entry_c->id != id_a);

    delete b;
    delete c;

    // malloc/free path via the renamed oocc_ entry points (what the pass
    // rewrites raw allocator calls to).
    void* raw = oocc_malloc(64);
    assert(raw != nullptr);
    auto* raw_entry = oocc::address_table().lookup(raw);
    assert(raw_entry && std::string(raw_entry->alloc_kind) == "malloc");
    oocc_free(raw);
    assert(oocc::address_table().lookup(raw) == nullptr);

    // new[] tracked distinctly from new.
    int* arr = new int[10];
    auto* arr_entry = oocc::address_table().lookup(arr);
    assert(arr_entry && std::string(arr_entry->alloc_kind) == "new[]");
    delete[] arr;

    // STL containers allocate through operator new under the hood, so
    // their backing storage is tracked too (not asserted on the container
    // object itself, which usually lives on the stack, but on what it
    // allocates internally).
    {
        std::vector<int> v;
        v.reserve(4);
        v.push_back(1);
        // no crash / no leak-detector needed here; this exercises that
        // std::vector's internal new() calls succeed through our operator
        // new override without corrupting the arena.
    }

    std::printf("test_allocator: all assertions passed\n");
    return 0;
}
