// OOCC C++ fixture: pointer aliasing — two variables referencing the same
// heap object, and a mutation through one becoming visible through the
// other. This is the case Python has no direct equivalent for and where
// C++'s explicit pointers actually visualize *better* (PRD §3.5): `a` and
// `b` both resolve to the identical {"ref":"oN"}, so the panel shows one
// heap chip with two incoming labels rather than two separate copies.
#include <iostream>

struct Counter {
    int value;
};

void increment(Counter* c) {
    c->value = c->value + 1;
}

int main() {
    Counter* a = new Counter{0};
    Counter* b = a;

    increment(a);
    increment(b);
    increment(a);

    std::cout << a->value << " " << b->value << "\n";

    return 0;
}
