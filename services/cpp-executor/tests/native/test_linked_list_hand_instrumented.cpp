// Hand-written stand-in for what the instrumentation pass (pass.py) will
// generate from a plain linked-list-reversal source file. Exists to
// validate the runtime engine (oocc_engine.hpp) end-to-end — allocator,
// address table, describe_value/describe_object_body, step/changed
// diffing, finalize/emit — before writing the actual libclang pass, so
// runtime bugs and pass bugs aren't both in flight at once.
#include "../../runtime/oocc_trace.hpp"
#include <cstdio>

struct Node {
    int val;
    Node* next;
};

namespace oocc {
template <>
struct Describer<Node> {
    static std::string body(const Node& v, HeapCollector& hc, const std::string& oid) {
        std::string out = "{\"type\":\"Node\",\"fields\":{";
        out += "\"val\":" + describe_value(v.val, hc, field_path(oid, "val")) + ",";
        out += "\"next\":" + describe_value(v.next, hc, field_path(oid, "next"));
        out += "}}";
        return out;
    }
};
}  // namespace oocc

// -- instrumented reverse(Node* head) -> Node* ---------------------------
Node* reverse(Node* head) {
    oocc::oocc_enter("reverse");
    oocc::oocc_set_args({"head"});
    oocc::oocc_bind("head", head);

    oocc::oocc_step(21, 1);
    Node* prev = nullptr;
    oocc::oocc_bind("prev", prev);

    oocc::oocc_step(22, 1);
    Node* cur = head;
    oocc::oocc_bind("cur", cur);

    for (;;) {
        oocc::oocc_step(23, 1);
        if (!(cur != nullptr)) break;

        oocc::oocc_step(24, 1);
        Node* next = cur->next;
        oocc::oocc_bind("next", next);

        oocc::oocc_step(25, 1);
        cur->next = prev;

        oocc::oocc_step(26, 1);
        prev = cur;

        oocc::oocc_step(27, 1);
        cur = next;
    }

    oocc::oocc_exit(prev);
    return prev;
}

int main() {
    oocc::oocc_init();
    oocc::oocc_set_meta(
        "{\"schema_version\":\"1.0\",\"run_id\":\"r_test0000000000\",\"language\":\"cpp\","
        "\"source_hash\":\"sha256:" +
        std::string(64, '0') + "\",");
    oocc::oocc_enter("main");

    oocc::oocc_step(33, 1);
    Node* a = new Node{1, nullptr};
    oocc::oocc_bind("a", a);
    oocc::oocc_step(34, 1);
    Node* b = new Node{2, nullptr};
    oocc::oocc_bind("b", b);
    oocc::oocc_step(35, 1);
    Node* c = new Node{3, nullptr};
    oocc::oocc_bind("c", c);
    oocc::oocc_step(36, 1);
    a->next = b;
    oocc::oocc_step(37, 1);
    b->next = c;

    oocc::oocc_step(38, 1);
    Node* head = a;
    oocc::oocc_bind("head", head);

    oocc::oocc_step(39, 1);
    Node* new_head = reverse(head);
    oocc::oocc_bind("new_head", new_head);

    oocc::oocc_exit_void();
    oocc::finalize_and_emit("ok", "");
    return 0;
}
