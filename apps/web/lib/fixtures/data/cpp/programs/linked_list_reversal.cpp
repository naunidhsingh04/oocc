// OOCC C++ fixture: iterative singly-linked-list reversal. Mirrors the
// Python linked_list_reversal fixture's shape (user-class heap instances,
// pointer rewiring) — this is the fixture the Phase 4 done-criterion
// targets: it must render in the existing linked_list panel with zero
// frontend changes, since a raw `Node*` resolves to `{"ref":"oN"}` exactly
// like a Python reference (see runtime/oocc_trace.hpp).
#include <iostream>

struct Node {
    int val;
    Node* next;
};

Node* reverse(Node* head) {
    Node* prev = nullptr;
    Node* cur = head;
    while (cur != nullptr) {
        Node* next = cur->next;
        cur->next = prev;
        prev = cur;
        cur = next;
    }
    return prev;
}

int main() {
    Node* a = new Node{1, nullptr};
    Node* b = new Node{2, nullptr};
    Node* c = new Node{3, nullptr};
    Node* d = new Node{4, nullptr};
    a->next = b;
    b->next = c;
    c->next = d;

    Node* head = a;
    Node* new_head = reverse(head);

    Node* cur = new_head;
    while (cur != nullptr) {
        std::cout << cur->val << " ";
        cur = cur->next;
    }
    std::cout << "\n";

    return 0;
}
