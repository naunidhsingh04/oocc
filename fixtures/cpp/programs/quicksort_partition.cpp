// OOCC C++ fixture: Lomuto partition + quicksort over std::vector<int> —
// same i/j-sweep the Python fixture's array panel teaches, in a language
// with explicit index arithmetic.
#include <iostream>
#include <vector>

int partition(std::vector<int>& arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j = j + 1) {
        if (arr[j] <= pivot) {
            i = i + 1;
            int tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
    }
    int tmp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = tmp;
    return i + 1;
}

void quicksort(std::vector<int>& arr, int low, int high) {
    if (low < high) {
        int pivot_index = partition(arr, low, high);
        quicksort(arr, low, pivot_index - 1);
        quicksort(arr, pivot_index + 1, high);
    }
}

int main() {
    std::vector<int> numbers;
    numbers.push_back(8);
    numbers.push_back(3);
    numbers.push_back(7);
    numbers.push_back(4);
    numbers.push_back(2);
    numbers.push_back(9);
    numbers.push_back(1);

    quicksort(numbers, 0, static_cast<int>(numbers.size()) - 1);

    std::cout << "sorted: [";
    for (int i = 0; i < static_cast<int>(numbers.size()); i = i + 1) {
        std::cout << numbers[i];
        if (i + 1 < static_cast<int>(numbers.size())) {
            std::cout << ", ";
        }
    }
    std::cout << "]\n";

    return 0;
}
