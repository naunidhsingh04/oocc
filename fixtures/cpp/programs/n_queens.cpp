// OOCC C++ fixture: N-Queens via backtracking over a vector<vector<int>>
// solution set — the recursion-tree panel's abandoned-subtree example,
// same algorithm and column-exploration order as the Python fixture so
// the first solution found matches it exactly.
#include <iostream>
#include <vector>

int abs_int(int x) {
    if (x < 0) {
        return -x;
    }
    return x;
}

bool is_safe(std::vector<int>& columns, int row, int col) {
    for (int placed_row = 0; placed_row < static_cast<int>(columns.size()); placed_row = placed_row + 1) {
        int placed_col = columns[placed_row];
        if (placed_col == col) {
            return false;
        }
        if (abs_int(placed_col - col) == abs_int(placed_row - row)) {
            return false;
        }
    }
    return true;
}

void solve(int n, std::vector<int>& columns, std::vector<std::vector<int>>& solutions) {
    int row = static_cast<int>(columns.size());
    if (row == n) {
        solutions.push_back(columns);
        return;
    }
    for (int col = 0; col < n; col = col + 1) {
        if (is_safe(columns, row, col)) {
            columns.push_back(col);
            solve(n, columns, solutions);
            columns.pop_back();
        }
    }
}

int main() {
    int n = 5;
    std::vector<int> columns;
    std::vector<std::vector<int>> solutions;
    solve(n, columns, solutions);

    std::cout << n << "-queens solutions: " << solutions.size() << "\n";

    std::cout << "first solution: [";
    std::vector<int>& first = solutions[0];
    for (int i = 0; i < static_cast<int>(first.size()); i = i + 1) {
        std::cout << first[i];
        if (i + 1 < static_cast<int>(first.size())) {
            std::cout << ", ";
        }
    }
    std::cout << "]\n";

    return 0;
}
