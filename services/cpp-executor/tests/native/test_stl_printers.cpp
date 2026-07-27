// Exercises every STL pretty-printer claimed as implemented
// (oocc_stl_printers.hpp) but not otherwise exercised by any of the six
// committed fixtures or the hand-instrumented linked-list test: array,
// pair, list, deque, map, unordered_map, set, unordered_set, optional,
// stack, queue, priority_queue. vector/vector<bool>/string are already
// covered by the real fixtures (vector_sort, dfs_adjacency_list); this
// file exists specifically to catch compile errors or wrong output in
// the untested printers — the pointer-to-member tricks for the container
// adaptors especially, since a mistake there is a compile error at best
// and silent wrong data at worst.
#include "../../runtime/oocc_trace.hpp"
#include <array>
#include <cassert>
#include <cstdio>
#include <deque>
#include <list>
#include <map>
#include <optional>
#include <queue>
#include <set>
#include <stack>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

using namespace oocc;

int main() {
    // array — also exercised through describe_value (the local-object
    // identity path), not just describe_object_body directly.
    {
        std::array<int, 3> a{1, 2, 3};
        HeapCollector hc;
        std::string j = describe_value(a, hc, "f1.a");
        assert(j.substr(0, 6) == "{\"ref\"");
        assert(hc.objects.size() == 1);
        const std::string& body = hc.objects.begin()->second;
        assert(body.find("\"type\":\"list\"") != std::string::npos);
        assert(body.find("\"len\":3") != std::string::npos);
    }

    // pair -> tuple
    {
        std::pair<int, int> p{4, 5};
        HeapCollector hc;
        std::string body = describe_object_body(p, hc, "o1");
        assert(body.find("\"type\":\"tuple\"") != std::string::npos);
        assert(body.find("\"len\":2") != std::string::npos);
    }

    // list
    {
        std::list<int> l{1, 2, 3};
        HeapCollector hc;
        std::string body = describe_object_body(l, hc, "o1");
        assert(body.find("\"type\":\"list\"") != std::string::npos);
        assert(body.find("\"len\":3") != std::string::npos);
    }

    // deque
    {
        std::deque<int> d;
        d.push_back(1);
        d.push_back(2);
        HeapCollector hc;
        std::string body = describe_object_body(d, hc, "o1");
        assert(body.find("\"len\":2") != std::string::npos);
    }

    // map
    {
        std::map<int, int> m;
        m[1] = 10;
        m[2] = 20;
        HeapCollector hc;
        std::string body = describe_object_body(m, hc, "o1");
        assert(body.find("\"type\":\"dict\"") != std::string::npos);
        assert(body.find("\"entries\"") != std::string::npos);
        assert(body.find("\"key\":{\"val\":1}") != std::string::npos);
        assert(body.find("\"value\":{\"val\":10}") != std::string::npos);
    }

    // unordered_map
    {
        std::unordered_map<int, int> m;
        m[7] = 70;
        HeapCollector hc;
        std::string body = describe_object_body(m, hc, "o1");
        assert(body.find("\"type\":\"dict\"") != std::string::npos);
        assert(body.find("\"key\":{\"val\":7}") != std::string::npos);
    }

    // set
    {
        std::set<int> s{3, 1, 2};
        HeapCollector hc;
        std::string body = describe_object_body(s, hc, "o1");
        assert(body.find("\"type\":\"set\"") != std::string::npos);
        assert(body.find("\"len\":3") != std::string::npos);
    }

    // unordered_set
    {
        std::unordered_set<int> s{5, 6};
        HeapCollector hc;
        std::string body = describe_object_body(s, hc, "o1");
        assert(body.find("\"type\":\"set\"") != std::string::npos);
    }

    // optional
    {
        std::optional<int> present = 42;
        std::optional<int> empty;
        HeapCollector hc;
        std::string body_present = describe_object_body(present, hc, "o1");
        std::string body_empty = describe_object_body(empty, hc, "o2");
        assert(body_present.find("\"len\":1") != std::string::npos);
        assert(body_present.find("{\"val\":42}") != std::string::npos);
        assert(body_empty.find("\"len\":0") != std::string::npos);
    }

    // stack (adaptor over deque by default) — the pointer-to-member trick
    {
        std::stack<int> st;
        st.push(1);
        st.push(2);
        st.push(3);
        HeapCollector hc;
        std::string body = describe_object_body(st, hc, "o1");
        assert(body.find("\"type\":\"list\"") != std::string::npos);
        assert(body.find("\"len\":3") != std::string::npos);
    }

    // queue (adaptor over deque by default)
    {
        std::queue<int> q;
        q.push(1);
        q.push(2);
        HeapCollector hc;
        std::string body = describe_object_body(q, hc, "o1");
        assert(body.find("\"len\":2") != std::string::npos);
    }

    // priority_queue (adaptor over vector by default)
    {
        std::priority_queue<int> pq;
        pq.push(3);
        pq.push(1);
        pq.push(4);
        HeapCollector hc;
        std::string body = describe_object_body(pq, hc, "o1");
        assert(body.find("\"len\":3") != std::string::npos);
    }

    std::printf("test_stl_printers: all assertions passed\n");
    return 0;
}
