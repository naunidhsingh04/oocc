// OOCC C++ fixture: a deliberate out-of-bounds vector write (PRD §3.5
// "crashes are a feature"). `operator[]` doesn't bounds-check; writing far
// enough past a 3-element vector's backing buffer lands outside the WASM
// instance's current linear memory and traps — the browser worker shim
// catches that, and the last good step (everything up through printing
// the message below) stays playable. See runtime/oocc_engine.hpp's file
// docstring for how the trap-recovery buffer makes this possible even
// though the instance dies with no C++-level unwind.
#include <iostream>
#include <vector>

int main() {
    std::vector<int> buffer;
    buffer.push_back(1);
    buffer.push_back(2);
    buffer.push_back(3);

    std::cout << "about to write far past the end of a 3-element vector\n";

    int bad_index = 100000000;
    buffer[bad_index] = 42;

    std::cout << "unreachable\n";
    return 0;
}
