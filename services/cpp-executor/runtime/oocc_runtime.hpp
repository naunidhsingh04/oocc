// OOCC C++ tracer runtime (docs/PRD.md §3.5).
//
// This header is compiled directly into the user's instrumented program
// (both natively, for fast unit testing, and via wasi-sdk to WASM for real
// runs). It owns:
//   - a static-arena allocator that backs `new`/`delete`/`malloc`/`free`
//     and assigns every heap allocation a stable "oN" id (the address
//     table, PRD §3.5 build step 1),
//   - the frame/binding stack fed by __oocc_enter/__oocc_exit/__oocc_bind,
//   - a JSON writer that serializes the whole thing into a single
//     trace.schema.json-shaped document, matching apps/api's Python
//     Tracer's step/heap/changed semantics exactly (see
//     services/executor/executor_app/tracer.py) so the two engines produce
//     the identical contract.
//
// The finished trace is written, as one write, to fd 1 — the user's own
// `std::cout` output is redirected through a capturing streambuf
// (oocc_engine.hpp's CapturingStreambuf) rather than the real fd 1, so
// fd 1 is free for this single final write; see oocc_engine.hpp's
// kTraceFd comment for why fd 1 rather than a dedicated fd 3.
//
// Nothing in packages/contracts changes for this phase — this file is the
// only place that knows the trace shape on the C++ side, and it must stay
// byte-for-byte compatible with trace.schema.json.
#pragma once

#include <cstdint>
#include <cstddef>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
#include <sstream>
#include <type_traits>

namespace oocc {

// ---------------------------------------------------------------------
// Arena allocator + address table
//
// A from-scratch first-fit free-list allocator over a static arena. This
// sidesteps interposing the platform's real malloc/free (fragile across
// libc versions, especially cross-compiled to wasi-libc) while giving us
// full control of every allocation's address and lifetime, which is what
// the address table actually needs. All of new/delete/new[]/delete[] and
// malloc/free/calloc/realloc route through here, so this covers every
// object the STL's own allocators create too.
// ---------------------------------------------------------------------

constexpr size_t kArenaBytes = 64ull * 1024 * 1024;

struct FreeBlock {
    size_t size;      // payload bytes available, excluding header
    FreeBlock* next;
};

struct AllocHeader {
    size_t size;       // payload bytes
    uint32_t magic;    // corruption / double-free guard
};

constexpr uint32_t kAllocMagic = 0x0C0Cu;

class Arena {
public:
    Arena() { storage_ = raw_backing(); }

    void* allocate(size_t requested) {
        size_t payload = align8(requested == 0 ? 1 : requested);
        size_t total = payload + sizeof(AllocHeader);

        FreeBlock** cursor = &free_list_;
        while (*cursor) {
            FreeBlock* block = *cursor;
            if (block->size >= payload) {
                *cursor = block->next;
                auto* hdr = reinterpret_cast<AllocHeader*>(block);
                hdr->size = block->size;
                hdr->magic = kAllocMagic;
                return reinterpret_cast<unsigned char*>(hdr) + sizeof(AllocHeader);
            }
            cursor = &block->next;
        }

        if (bump_offset_ + total > kArenaBytes) {
            return nullptr;  // arena exhausted; caller reports memory_limit
        }
        auto* hdr = reinterpret_cast<AllocHeader*>(backing() + bump_offset_);
        bump_offset_ += total;
        hdr->size = payload;
        hdr->magic = kAllocMagic;
        return reinterpret_cast<unsigned char*>(hdr) + sizeof(AllocHeader);
    }

    void deallocate(void* ptr) {
        if (!ptr) return;
        auto* hdr = reinterpret_cast<AllocHeader*>(static_cast<unsigned char*>(ptr) - sizeof(AllocHeader));
        if (hdr->magic != kAllocMagic) return;  // not ours / already freed; ignore defensively
        hdr->magic = 0;
        auto* block = reinterpret_cast<FreeBlock*>(hdr);
        block->size = hdr->size;
        block->next = free_list_;
        free_list_ = block;
    }

    size_t payload_size_of(void* ptr) const {
        auto* hdr = reinterpret_cast<AllocHeader*>(static_cast<unsigned char*>(ptr) - sizeof(AllocHeader));
        return hdr->size;
    }

private:
    static size_t align8(size_t n) { return (n + 7) & ~size_t(7); }
    unsigned char* backing() { return storage_; }
    unsigned char* raw_backing() {
        static unsigned char arena[kArenaBytes];
        return arena;
    }

    unsigned char* storage_ = nullptr;
    size_t bump_offset_ = 0;
    FreeBlock* free_list_ = nullptr;
};

// Leaked-singleton idiom (never destructed): operator delete is overridden
// globally below, so it can be invoked by *other* static objects'
// destructors during program teardown, in an order this translation unit
// doesn't control. If Arena/AddressTable had already been destructed by
// then, that's a use-after-destruction crash — observed for real while
// building this. Placement-new over a static byte buffer (never plain
// `new Arena()`, which would recursively re-enter arena() — itself still
// mid-initialization — through the overridden operator new) sidesteps
// both static-destruction order and that recursive-init trap.
inline Arena& arena() {
    alignas(Arena) static unsigned char storage[sizeof(Arena)];
    static Arena* a = new (storage) Arena();
    return *a;
}

// The address table: every arena allocation gets a stable "oN" id the
// moment it's made (by `new`/`malloc`), independent of whether any
// variable has been bound to it yet. A raw `Node*` later resolves through
// this table to {"ref":"oN"} — see resolve_pointer() below.
class AddressTable {
public:
    struct Entry {
        uint64_t id;
        bool alive = true;
        const char* alloc_kind;  // "new", "new[]", "malloc", "calloc"
    };

    uint64_t register_alloc(void* addr, const char* kind) {
        uint64_t id = next_id_++;
        table_[addr] = Entry{id, true, kind};
        return id;
    }

    // Find-or-create identity for a stack/member-resident heap-type value
    // (a container or struct held by value, not behind a pointer). Unlike
    // register_alloc (always fresh — every `new` really is a new object),
    // this reuses the existing id across steps as long as the address is
    // still marked alive, so a variable's identity stays stable for its
    // whole lifetime instead of getting a new "oN" every single step.
    uint64_t get_or_register_local(void* addr, const char* kind) {
        auto it = table_.find(addr);
        if (it != table_.end() && it->second.alive) return it->second.id;
        return register_alloc(addr, kind);
    }

    void unregister(void* addr) {
        auto it = table_.find(addr);
        if (it != table_.end()) it->second.alive = false;
    }

    // Returns the object id string ("oN") if `addr` is a live, tracked
    // allocation; empty string otherwise (caller falls back to describing
    // it as a raw/opaque pointer).
    const Entry* lookup(void* addr) const {
        auto it = table_.find(addr);
        if (it == table_.end() || !it->second.alive) return nullptr;
        return &it->second;
    }

    // Total distinct object ids ever issued (never decremented on free) —
    // matches Python Tracer's `peak_heap_objects = len(obj_keepalive)`,
    // which also never shrinks: it's "how many distinct objects existed
    // over the run's lifetime," not a live-at-once high-water mark.
    uint64_t total_issued() const { return next_id_ - 1; }

private:
    uint64_t next_id_ = 1;
    std::unordered_map<void*, Entry> table_;
};

inline AddressTable& address_table() {
    alignas(AddressTable) static unsigned char storage[sizeof(AddressTable)];
    static AddressTable* t = new (storage) AddressTable();
    return *t;
}

// AddressTable::table_ is itself a std::unordered_map, so inserting into it
// triggers `operator new` for its own node storage — which routes back
// through arena_alloc(). Without this guard that's unbounded recursion
// (each nested new tries to register itself, allocating another node...).
// The guard means the address table's own bookkeeping allocations are
// arena-backed but not registered as trace-visible objects, which is
// exactly right: they aren't anything the user's program created.
inline bool& in_bookkeeping() {
    static bool flag = false;
    return flag;
}

inline void* arena_alloc(size_t n, const char* kind) {
    void* p = arena().allocate(n);
    if (p && !in_bookkeeping()) {
        in_bookkeeping() = true;
        address_table().register_alloc(p, kind);
        in_bookkeeping() = false;
    }
    return p;
}

inline void arena_dealloc(void* p) {
    if (!p) return;
    if (!in_bookkeeping()) {
        in_bookkeeping() = true;
        address_table().unregister(p);
        in_bookkeeping() = false;
    }
    arena().deallocate(p);
}

}  // namespace oocc

// ---------------------------------------------------------------------
// Global operator/libc allocator overrides. Every one of these funnels
// through oocc::arena_alloc/arena_dealloc, so every `new`, `delete`,
// `malloc`, and `free` in the user's program (and everything the STL
// containers allocate on their behalf) is tracked.
// ---------------------------------------------------------------------

void* operator new(size_t n) { return oocc::arena_alloc(n, "new"); }
void* operator new[](size_t n) { return oocc::arena_alloc(n, "new[]"); }
void operator delete(void* p) noexcept { oocc::arena_dealloc(p); }
void operator delete[](void* p) noexcept { oocc::arena_dealloc(p); }
void operator delete(void* p, size_t) noexcept { oocc::arena_dealloc(p); }
void operator delete[](void* p, size_t) noexcept { oocc::arena_dealloc(p); }

// Named oocc_malloc/oocc_free/... rather than overriding the libc symbols
// directly (a global #define would corrupt every <cstdlib>/STL header
// textually included afterward). The instrumentation pass instead rewrites
// the user's own `malloc(`/`free(`/`calloc(`/`realloc(` call sites to these
// names — see pass.py's _rewrite_raw_allocator_calls — so only user code
// that actually calls the raw allocator is redirected through the arena.
extern "C" {
void* oocc_malloc(size_t n) { return oocc::arena_alloc(n, "malloc"); }
void oocc_free(void* p) { oocc::arena_dealloc(p); }
void* oocc_calloc(size_t count, size_t size) {
    size_t n = count * size;
    void* p = oocc::arena_alloc(n, "calloc");
    if (p) std::memset(p, 0, n);
    return p;
}
void* oocc_realloc(void* p, size_t n) {
    if (!p) return oocc::arena_alloc(n, "malloc");
    size_t old_size = oocc::arena().payload_size_of(p);
    void* np = oocc::arena_alloc(n, "malloc");
    if (np) std::memcpy(np, p, old_size < n ? old_size : n);
    oocc::arena_dealloc(p);
    return np;
}
}  // extern "C"
