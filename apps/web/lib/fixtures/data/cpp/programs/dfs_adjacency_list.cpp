// OOCC C++ fixture: recursive depth-first search over an adjacency-list
// graph (vector<vector<int>>) with a visited vector<bool> — exercises
// nested-vector STL printing (a list of lists, like Python's dp_knapsack
// fixture) plus vector<bool>'s bitset-proxy specialization, and recursion
// depth in the call stack panel.
#include <iostream>
#include <vector>

void dfs(int node, std::vector<std::vector<int>>& adjacency, std::vector<bool>& visited, std::vector<int>& order) {
    visited[node] = true;
    order.push_back(node);

    std::vector<int> neighbors = adjacency[node];
    for (int i = 0; i < static_cast<int>(neighbors.size()); i = i + 1) {
        int next = neighbors[i];
        if (!visited[next]) {
            dfs(next, adjacency, visited, order);
        }
    }
}

int main() {
    std::vector<std::vector<int>> adjacency;
    std::vector<int> a;
    a.push_back(1);
    a.push_back(2);
    adjacency.push_back(a);
    std::vector<int> b;
    b.push_back(3);
    adjacency.push_back(b);
    std::vector<int> c;
    c.push_back(3);
    adjacency.push_back(c);
    std::vector<int> d;
    adjacency.push_back(d);

    std::vector<bool> visited;
    visited.push_back(false);
    visited.push_back(false);
    visited.push_back(false);
    visited.push_back(false);

    std::vector<int> order;
    dfs(0, adjacency, visited, order);

    for (int i = 0; i < static_cast<int>(order.size()); i = i + 1) {
        std::cout << order[i] << " ";
    }
    std::cout << "\n";

    return 0;
}
