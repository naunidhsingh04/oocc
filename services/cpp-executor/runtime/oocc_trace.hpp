// OOCC C++ tracer: the step/frame engine and Value/HeapObject JSON encoder.
// Builds directly on oocc_runtime.hpp's arena + address table. Produces a
// trace.schema.json-shaped document identical in spirit to
// services/executor/executor_app/tracer.py's Tracer — same Step shape,
// same full-reachable-heap-per-step snapshot, same changed-path diffing —
// so the frontend never has to know which engine produced a given trace.
//
// Every describe_value()/describe_object_body() call takes a `path`
// argument (the ChangedPath — §3.2's `frame_id.local | oN[index] |
// oN.field | oN{key}` grammar — that this value occupies) and records its
// own JSON fragment into HeapCollector::current_paths keyed by that path.
// This mirrors Tracer._flatten_paths() in the Python engine exactly, but
// built during the same walk that produces the JSON rather than by
// re-parsing it afterward — the two ("what does this look like" and
// "where does this live") have to stay in lockstep or the `changed[]`
// array (every highlight animation's source of truth) goes wrong.
//
// STL pretty-printers (§3.2 heap-type projections) live in
// oocc_stl_printers.hpp, included at the bottom; user-struct field
// enumeration is generated per-type by the instrumentation pass as
// `oocc::Describer<T>` specializations (see pass.py).
#pragma once

#include "oocc_runtime.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <cstdio>
#include <cstdint>

namespace oocc {

// ---------------------------------------------------------------------
// JSON string building. Small, allocation-light helpers rather than a
// streaming writer object — teaching-scale programs never make this a
// bottleneck, and plain string concatenation is far easier to get right.
// ---------------------------------------------------------------------

inline std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 2);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
    return out;
}

inline std::string json_string(const std::string& s) { return "\"" + json_escape(s) + "\""; }

// {"val": <primitive>} — the ValueInline branch of Value.
inline std::string inline_val(const std::string& raw_json) { return "{\"val\":" + raw_json + "}"; }
inline std::string inline_val(const std::string& raw_json, const std::string& repr) {
    return "{\"val\":" + raw_json + ",\"repr\":" + json_string(repr) + "}";
}
inline std::string ref_val(const std::string& oid) { return "{\"ref\":\"" + oid + "\"}"; }

// ---------------------------------------------------------------------
// HeapCollector: accumulates this step's full reachable-heap snapshot AND
// the flattened path->repr map used for changed-path diffing. Mirrors
// Tracer._snapshot()'s `visit()` closure plus _flatten_paths() together.
// `objects.count(oid)` guards re-entering an already-visited object this
// step, so cyclic structures (a circular list, a `prev` back-pointer)
// terminate instead of recursing forever.
// ---------------------------------------------------------------------
struct HeapCollector {
    std::unordered_map<std::string, std::string> objects;       // oid -> HeapObject json
    std::unordered_map<std::string, std::string> current_paths;  // ChangedPath -> repr
    bool truncated = false;
    static constexpr size_t kMaxObjectsPerStep = 5000;

    bool should_start_object(const std::string& oid) {
        if (objects.count(oid)) return false;              // already described this step
        if (objects.size() >= kMaxObjectsPerStep) {
            truncated = true;
            return false;
        }
        objects[oid] = "{\"type\":\"opaque\",\"repr\":\"<pending>\"}";  // cycle guard placeholder
        return true;
    }
    void finish_object(const std::string& oid, std::string json) { objects[oid] = std::move(json); }

    // Records that `path` currently holds Value fragment `value_json` —
    // called once per describe_value() invocation, at every path (a frame
    // local, a container element, a struct field), exactly mirroring one
    // entry of Python's `_flatten_paths` output.
    void record_path(const std::string& path, const std::string& value_json) {
        if (!path.empty()) current_paths[path] = value_json;
    }
};

// Primary template intentionally left undefined — every user struct/class
// type the pass encounters gets a full specialization generated for it
// (field enumeration from the AST; see pass.py's _emit_describer). Using
// an unhandled type here is a compile error today; the teaching-subset
// diagnostics step (PRD §3.5 build step 4) turns that into the specific,
// kind message before it ever reaches this point.
template <class T>
struct Describer;

// ---------------------------------------------------------------------
// describe_value overloads. Each returns a Value fragment: `{"val":...}`
// for primitives, `{"ref":"oN"}` for anything heap-resident — and records
// that fragment at `path` in hc.current_paths as a side effect. Order here
// establishes the overload set that pointer/container/struct overloads in
// oocc_stl_printers.hpp (included below) and pass-generated Describer<T>
// specializations extend via ADL + template partial ordering.
// ---------------------------------------------------------------------

inline std::string describe_value(std::nullptr_t, HeapCollector& hc, const std::string& path) {
    std::string j = inline_val("null", "nullptr");
    hc.record_path(path, j);
    return j;
}

#define OOCC_INLINE_PRIMITIVE(TYPE, TO_JSON)                                              \
    inline std::string describe_value(TYPE v, HeapCollector& hc, const std::string& path) { \
        std::string j = inline_val(TO_JSON);                                              \
        hc.record_path(path, j);                                                          \
        return j;                                                                         \
    }
OOCC_INLINE_PRIMITIVE(bool, (v ? "true" : "false"))
OOCC_INLINE_PRIMITIVE(char, std::to_string(static_cast<int>(v)))
OOCC_INLINE_PRIMITIVE(signed char, std::to_string(static_cast<int>(v)))
OOCC_INLINE_PRIMITIVE(unsigned char, std::to_string(static_cast<unsigned>(v)))
OOCC_INLINE_PRIMITIVE(short, std::to_string(v))
OOCC_INLINE_PRIMITIVE(unsigned short, std::to_string(v))
OOCC_INLINE_PRIMITIVE(int, std::to_string(v))
OOCC_INLINE_PRIMITIVE(unsigned int, std::to_string(v))
OOCC_INLINE_PRIMITIVE(long, std::to_string(v))
OOCC_INLINE_PRIMITIVE(unsigned long, std::to_string(v))
OOCC_INLINE_PRIMITIVE(long long, std::to_string(v))
OOCC_INLINE_PRIMITIVE(unsigned long long, std::to_string(v))
OOCC_INLINE_PRIMITIVE(float, std::to_string(v))
OOCC_INLINE_PRIMITIVE(double, std::to_string(v))
#undef OOCC_INLINE_PRIMITIVE

constexpr size_t kMaxInlineStrLen = 40;  // matches Tracer.MAX_INLINE_STR_LEN for cross-language consistency

inline std::string describe_value(const std::string& s, HeapCollector& hc, const std::string& path) {
    if (s.size() <= kMaxInlineStrLen) {
        std::string j = inline_val(json_string(s));
        hc.record_path(path, j);
        return j;
    }
    void* addr = static_cast<void*>(const_cast<std::string*>(&s));
    uint64_t id = address_table().get_or_register_local(addr, "string");
    std::string oid = "o" + std::to_string(id);
    if (hc.should_start_object(oid)) {
        hc.finish_object(
            oid, "{\"type\":\"str\",\"len\":" + std::to_string(s.size()) + ",\"value\":" + json_string(s) + "}");
    }
    std::string j = ref_val(oid);
    hc.record_path(path, j);
    return j;
}
inline std::string describe_value(const char* s, HeapCollector& hc, const std::string& path) {
    return describe_value(std::string(s ? s : ""), hc, path);
}

template <class T>
std::string describe_object_body(const T& v, HeapCollector& hc, const std::string& oid);

// Raw pointers: resolve through the address table. A pointer into a
// tracked allocation (new/malloc, or a stack-resident container/struct
// that has itself been assigned an identity) becomes {"ref":"oN"} exactly
// like a Python reference — this is what lets linked_list/binary_tree
// panels built for Python render C++ pointer structures unmodified. A
// pointer that resolves to nothing tracked (points at an ordinary
// primitive local, or is dangling/wild) degrades to an inline description
// rather than fabricating a heap object the schema has no type for.
template <class T>
std::string describe_value(T* const& p, HeapCollector& hc, const std::string& path) {
    if (p == nullptr) {
        std::string j = inline_val("null", "nullptr");
        hc.record_path(path, j);
        return j;
    }
    const AddressTable::Entry* entry = address_table().lookup(static_cast<void*>(const_cast<T*>(p)));
    if (entry != nullptr) {
        std::string oid = "o" + std::to_string(entry->id);
        if (hc.should_start_object(oid)) hc.finish_object(oid, describe_object_body(*p, hc, oid));
        std::string j = ref_val(oid);
        hc.record_path(path, j);
        return j;
    }
    char buf[32];
    std::snprintf(buf, sizeof(buf), "0x%llx", static_cast<unsigned long long>(reinterpret_cast<uintptr_t>(p)));
    std::string j = inline_val(json_string(std::string(buf)), std::string("<untracked pointer>"));
    hc.record_path(path, j);
    return j;
}

// Any locally/member-declared (non-pointer) heap type — a container or a
// user struct held by value, e.g. `std::vector<int> v;` or a `Node` field
// embedded by value in a parent struct — needs its own identity too, so it
// renders as its own heap chip exactly like Python's by-reference model,
// even though C++ gave it stack/inline storage. Its own address is stable
// for its lifetime, so it doubles as that identity, the same way pointer
// targets use their allocation address. describe_object_body() overloads
// (primitives, containers in oocc_stl_printers.hpp, user structs via
// Describer<T>) supply the HeapObject JSON body for whichever T this is
// instantiated with.
template <class T>
std::string describe_value_as_local_object(const T& v, HeapCollector& hc, const std::string& path, const char* kind) {
    void* addr = static_cast<void*>(const_cast<T*>(&v));
    uint64_t id = address_table().get_or_register_local(addr, kind);
    std::string oid = "o" + std::to_string(id);
    if (hc.should_start_object(oid)) hc.finish_object(oid, describe_object_body(v, hc, oid));
    std::string j = ref_val(oid);
    hc.record_path(path, j);
    return j;
}

// Fallback for any non-pointer, non-primitive T reached directly (a bound
// local or a struct field held by value) — a container or user struct.
// Least specialized of the describe_value overload set, so the concrete
// primitive overloads above and the more specific container/pointer
// templates all win partial ordering over this one.
template <class T>
std::string describe_value(const T& v, HeapCollector& hc, const std::string& path) {
    return describe_value_as_local_object(v, hc, path, "local");
}

// ---------------------------------------------------------------------
// describe_object_body: produces the *body* of a HeapObject (never
// wrapped in {"ref":...} — the caller above already did that), given the
// object's own oid as the base path for its children. Primitives reached
// only through a raw heap pointer (`int* p = new int(5);`) have no richer
// schema type to project into, so they degrade to `opaque` with their
// current value as `repr` — schema-legal, honest, and consistent with
// "anything else degrades to opaque" (§3.5). Containers (in
// oocc_stl_printers.hpp) and user structs (Describer<T>, pass-generated)
// override this generic behavior with more specific overloads.
// ---------------------------------------------------------------------

template <class T>
std::string describe_object_body(const T& v, HeapCollector& hc, const std::string& oid) {
    return Describer<T>::body(v, hc, oid);
}

#define OOCC_OPAQUE_PRIMITIVE_BODY(TYPE)                                                          \
    inline std::string describe_object_body(TYPE v, HeapCollector&, const std::string&) {         \
        return "{\"type\":\"opaque\",\"repr\":" + json_string(std::to_string(v)) + "}";            \
    }
OOCC_OPAQUE_PRIMITIVE_BODY(bool)
OOCC_OPAQUE_PRIMITIVE_BODY(int)
OOCC_OPAQUE_PRIMITIVE_BODY(long)
OOCC_OPAQUE_PRIMITIVE_BODY(long long)
OOCC_OPAQUE_PRIMITIVE_BODY(unsigned)
OOCC_OPAQUE_PRIMITIVE_BODY(unsigned long)
OOCC_OPAQUE_PRIMITIVE_BODY(unsigned long long)
OOCC_OPAQUE_PRIMITIVE_BODY(float)
OOCC_OPAQUE_PRIMITIVE_BODY(double)
#undef OOCC_OPAQUE_PRIMITIVE_BODY
inline std::string describe_object_body(char v, HeapCollector&, const std::string&) {
    return "{\"type\":\"opaque\",\"repr\":" + json_string(std::to_string(static_cast<int>(v))) + "}";
}

// A raw pointer discovered as the *pointee* of another tracked allocation
// (e.g. `Node** pp = new Node*(...)`) — pointer-to-pointer is outside the
// teaching subset's core focus; represent it minimally rather than
// recursing into a second dispatch layer.
template <class T>
std::string describe_object_body(T* const& v, HeapCollector& hc, const std::string& oid) {
    std::string inner = describe_value(v, hc, oid + ".*");
    return "{\"type\":\"opaque\",\"repr\":" + json_string(inner) + "}";
}

// Path-building helpers shared by every container printer.
inline std::string index_path(const std::string& oid, size_t i) { return oid + "[" + std::to_string(i) + "]"; }
inline std::string field_path(const std::string& oid, const std::string& field) { return oid + "." + field; }
inline std::string key_path(const std::string& oid, const std::string& key_repr) { return oid + "{" + key_repr + "}"; }

}  // namespace oocc

#include "oocc_stl_printers.hpp"
#include "oocc_engine.hpp"
