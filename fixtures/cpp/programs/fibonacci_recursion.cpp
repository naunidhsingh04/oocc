// OOCC C++ fixture: naive recursive Fibonacci — the recursion-tree panel's
// canonical overlapping-subproblems example, same as the Python fixture.
#include <iostream>

int fib(int n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

int main() {
    for (int i = 0; i < 8; i = i + 1) {
        std::cout << "fib(" << i << ") = " << fib(i) << "\n";
    }
    return 0;
}
