// STL pretty-printers (PRD §3.5): project each container into the §3.2
// heap-type registry so panels see `{"type":"list",...}` etc., never
// `_M_start`/`_M_finish`. Included from oocc_trace.hpp after describe_value
// / describe_object_body / index_path / field_path / key_path are
// declared. Each container overloads describe_object_body(const
// Container&, HeapCollector&, const std::string& oid) — `oid` is this
// object's own id, used as the base of every child path so `changed[]`
// stays exact down to individual elements (§3.2's ChangedPath grammar).
// describe_value() itself is never overloaded per-container: the generic
// fallback in oocc_trace.hpp already routes any non-pointer, non-primitive
// T through describe_value_as_local_object, which calls
// describe_object_body — one path for every container.
//
// Implemented here: vector (incl. vector<bool>), array, pair, list, deque,
// map, unordered_map, set, unordered_set, optional, stack, queue,
// priority_queue. Anything else still compiles only if the pass generates
// a Describer<T> for it (user types) or degrades to opaque (primitives).
#pragma once

#include <vector>
#include <array>
#include <utility>
#include <list>
#include <deque>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <optional>
#include <stack>
#include <queue>
#include <string>

namespace oocc {

// Renders a key for the `oN{key}` ChangedPath grammar — primitive keys
// only (matches Python's _heap_key_repr, which likewise only special-cases
// str/int/float/bool and falls back to repr() otherwise). The schema's
// ChangedPath pattern for this branch is `oN\{[^{}]*\}` — a string key
// containing a literal `{` or `}` would otherwise produce a path that
// fails schema validation, so those two characters are stripped here.
// (An unlikely key in practice, but a real path a `map<string,int>`
// fixture with attacker- or user-chosen keys could hit.)
template <class K>
std::string key_repr_of(const K& k) {
    return std::to_string(k);
}
inline std::string key_repr_of(const std::string& k) {
    std::string out;
    out.reserve(k.size());
    for (char c : k) {
        if (c != '{' && c != '}') out += c;
    }
    return out;
}

// ---- vector ------------------------------------------------------------
template <class T>
std::string describe_object_body(const std::vector<T>& v, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(v.size()) + ",\"items\":[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) out += ",";
        out += describe_value(v[i], hc, index_path(oid, i));
    }
    out += "]}";
    return out;
}

// bool specialization: std::vector<bool> is a bitset proxy, not a real
// T&-yielding container — the generic loop above can't bind `v[i]` to
// describe_value by reference, so it needs its own overload.
inline std::string describe_object_body(const std::vector<bool>& v, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(v.size()) + ",\"items\":[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) out += ",";
        bool b = v[i];
        out += describe_value(b, hc, index_path(oid, i));
    }
    out += "]}";
    return out;
}

// ---- array (fixed-size) -------------------------------------------------
template <class T, size_t N>
std::string describe_object_body(const std::array<T, N>& v, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(N) + ",\"items\":[";
    for (size_t i = 0; i < N; ++i) {
        if (i) out += ",";
        out += describe_value(v[i], hc, index_path(oid, i));
    }
    out += "]}";
    return out;
}

// ---- pair -> tuple -------------------------------------------------------
template <class A, class B>
std::string describe_object_body(const std::pair<A, B>& v, HeapCollector& hc, const std::string& oid) {
    return "{\"type\":\"tuple\",\"len\":2,\"items\":[" + describe_value(v.first, hc, index_path(oid, 0)) + "," +
           describe_value(v.second, hc, index_path(oid, 1)) + "]}";
}

// ---- list (doubly linked) -> list ---------------------------------------
template <class T>
std::string describe_object_body(const std::list<T>& v, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(v.size()) + ",\"items\":[";
    size_t i = 0;
    bool first = true;
    for (const auto& item : v) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, index_path(oid, i++));
    }
    out += "]}";
    return out;
}

// ---- deque -> list --------------------------------------------------------
template <class T>
std::string describe_object_body(const std::deque<T>& v, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(v.size()) + ",\"items\":[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) out += ",";
        out += describe_value(v[i], hc, index_path(oid, i));
    }
    out += "]}";
    return out;
}

// ---- map / unordered_map -> dict ------------------------------------------
template <class K, class V, class... Rest>
std::string describe_object_body(const std::map<K, V, Rest...>& m, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"dict\",\"len\":" + std::to_string(m.size()) + ",\"entries\":[";
    bool first = true;
    for (const auto& kv : m) {
        if (!first) out += ",";
        first = false;
        std::string kp = key_path(oid, key_repr_of(kv.first));
        // The key is rendered for display only, at "" (never recorded into
        // hc.current_paths — see HeapCollector::record_path's own
        // empty-path guard, oocc_trace.hpp): §3.2's ChangedPath grammar has
        // no `oN{key}.key` form, only the entry's value at `oN{key}` is a
        // real addressable path. Passing `kp` here instead (found for real
        // instrumenting the first program to ever exercise this printer,
        // `two_sum.cpp` — none of the six prior C++ fixtures use
        // map/unordered_map) clobbered the value's own current_paths entry
        // with the key's JSON, and `kp + ".key"` produced a path the
        // schema rejects outright, failing trace validation the moment a
        // map's key participates in `changed[]`.
        out += "{\"key\":" + describe_value(kv.first, hc, "") +
               ",\"value\":" + describe_value(kv.second, hc, kp) + "}";
    }
    out += "]}";
    return out;
}
template <class K, class V, class... Rest>
std::string describe_object_body(const std::unordered_map<K, V, Rest...>& m, HeapCollector& hc,
                                  const std::string& oid) {
    std::string out = "{\"type\":\"dict\",\"len\":" + std::to_string(m.size()) + ",\"entries\":[";
    bool first = true;
    for (const auto& kv : m) {
        if (!first) out += ",";
        first = false;
        std::string kp = key_path(oid, key_repr_of(kv.first));
        // See the std::map overload above for why the key is described at
        // "" rather than `kp + ".key"`.
        out += "{\"key\":" + describe_value(kv.first, hc, "") +
               ",\"value\":" + describe_value(kv.second, hc, kp) + "}";
    }
    out += "]}";
    return out;
}

// ---- set / unordered_set -> set --------------------------------------------
template <class T, class... Rest>
std::string describe_object_body(const std::set<T, Rest...>& s, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"set\",\"len\":" + std::to_string(s.size()) + ",\"items\":[";
    bool first = true;
    for (const auto& item : s) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, key_path(oid, key_repr_of(item)));
    }
    out += "]}";
    return out;
}
template <class T, class... Rest>
std::string describe_object_body(const std::unordered_set<T, Rest...>& s, HeapCollector& hc, const std::string& oid) {
    std::string out = "{\"type\":\"set\",\"len\":" + std::to_string(s.size()) + ",\"items\":[";
    bool first = true;
    for (const auto& item : s) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, key_path(oid, key_repr_of(item)));
    }
    out += "]}";
    return out;
}

// ---- optional -> tuple of 0 or 1 items (no dedicated schema type; a
// length-0/1 list is the closest honest projection, keeping "has a value"
// visually distinct from a null pointer rather than collapsing both to the
// same opaque blob) ----------------------------------------------------------
template <class T>
std::string describe_object_body(const std::optional<T>& v, HeapCollector& hc, const std::string& oid) {
    if (!v.has_value()) return "{\"type\":\"list\",\"len\":0,\"items\":[]}";
    return "{\"type\":\"list\",\"len\":1,\"items\":[" + describe_value(*v, hc, index_path(oid, 0)) + "]}";
}

// ---- stack / queue / priority_queue ----------------------------------------
// libstdc++/libc++ both name the underlying container's protected member
// `c`; container adaptors have no public iteration API, so reaching it via
// a derived class's pointer-to-member (legal: protected members are
// accessible from a derived class, including in a pointer-to-member
// expression) is the standard way to introspect one — the same technique
// GDB's own STL pretty-printers use.
template <class T, class Container>
std::string describe_object_body(const std::stack<T, Container>& s, HeapCollector& hc, const std::string& oid) {
    struct StackPeek : std::stack<T, Container> {
        static Container std::stack<T, Container>::* ptr() { return &StackPeek::c; }
    };
    const Container& underlying = s.*StackPeek::ptr();
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(underlying.size()) + ",\"items\":[";
    size_t i = 0;
    bool first = true;
    for (const auto& item : underlying) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, index_path(oid, i++));
    }
    out += "]}";
    return out;
}

template <class T, class Container>
std::string describe_object_body(const std::queue<T, Container>& q, HeapCollector& hc, const std::string& oid) {
    struct QueuePeek : std::queue<T, Container> {
        static Container std::queue<T, Container>::* ptr() { return &QueuePeek::c; }
    };
    const Container& underlying = q.*QueuePeek::ptr();
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(underlying.size()) + ",\"items\":[";
    size_t i = 0;
    bool first = true;
    for (const auto& item : underlying) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, index_path(oid, i++));
    }
    out += "]}";
    return out;
}

template <class T, class Container, class Compare>
std::string describe_object_body(const std::priority_queue<T, Container, Compare>& pq, HeapCollector& hc,
                                  const std::string& oid) {
    struct PqPeek : std::priority_queue<T, Container, Compare> {
        static Container std::priority_queue<T, Container, Compare>::* ptr() { return &PqPeek::c; }
    };
    // Internal heap array order, not sorted order — an honest reflection
    // of what's actually stored, same tradeoff GDB's printer makes.
    const Container& underlying = pq.*PqPeek::ptr();
    std::string out = "{\"type\":\"list\",\"len\":" + std::to_string(underlying.size()) + ",\"items\":[";
    size_t i = 0;
    bool first = true;
    for (const auto& item : underlying) {
        if (!first) out += ",";
        first = false;
        out += describe_value(item, hc, index_path(oid, i++));
    }
    out += "]}";
    return out;
}

}  // namespace oocc
