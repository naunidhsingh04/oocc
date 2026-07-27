// OOCC C++ fixture: bubble sort over std::vector<int> — exercises the
// vector STL pretty-printer (oocc_stl_printers.hpp) end to end: element
// reads/writes, in-place swaps, and the length-0-safe last pass.
#include <iostream>
#include <vector>

void bubble_sort(std::vector<int>& values) {
    int n = values.size();
    for (int i = 0; i < n; i = i + 1) {
        for (int j = 0; j < n - i - 1; j = j + 1) {
            if (values[j] > values[j + 1]) {
                int tmp = values[j];
                values[j] = values[j + 1];
                values[j + 1] = tmp;
            }
        }
    }
}

int main() {
    std::vector<int> values;
    values.push_back(5);
    values.push_back(2);
    values.push_back(8);
    values.push_back(1);
    values.push_back(4);

    bubble_sort(values);

    for (int i = 0; i < static_cast<int>(values.size()); i = i + 1) {
        std::cout << values[i] << " ";
    }
    std::cout << "\n";

    return 0;
}
