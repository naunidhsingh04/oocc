// OOCC C++ fixture: 0/1 knapsack via a growing vector<vector<int>> DP
// table — same recurrence (table[i-1][w] vs table[i-1][w-weight]) the
// Python fixture's DP table panel renders, over an explicitly-typed grid.
#include <iostream>
#include <vector>

int knapsack(std::vector<int>& weights, std::vector<int>& values, int capacity) {
    int n = static_cast<int>(weights.size());
    std::vector<std::vector<int>> table;
    for (int i = 0; i <= n; i = i + 1) {
        std::vector<int> row;
        for (int w = 0; w <= capacity; w = w + 1) {
            row.push_back(0);
        }
        table.push_back(row);
    }

    for (int i = 1; i <= n; i = i + 1) {
        for (int w = 0; w <= capacity; w = w + 1) {
            int without_item = table[i - 1][w];
            if (weights[i - 1] <= w) {
                int with_item = values[i - 1] + table[i - 1][w - weights[i - 1]];
                if (with_item > without_item) {
                    table[i][w] = with_item;
                } else {
                    table[i][w] = without_item;
                }
            } else {
                table[i][w] = without_item;
            }
        }
    }

    return table[n][capacity];
}

int main() {
    std::vector<int> weights;
    weights.push_back(2);
    weights.push_back(3);
    weights.push_back(4);
    weights.push_back(5);

    std::vector<int> values;
    values.push_back(3);
    values.push_back(4);
    values.push_back(5);
    values.push_back(6);

    int capacity = 8;

    int best_value = knapsack(weights, values, capacity);

    std::cout << "best value: " << best_value << "\n";

    return 0;
}
