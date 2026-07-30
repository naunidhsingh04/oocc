def knapsack(weights, values, capacity):
    n = len(weights)
    table = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for w in range(capacity + 1):
            without_item = table[i - 1][w]
            if weights[i - 1] <= w:
                with_item = values[i - 1] + table[i - 1][w - weights[i - 1]]
                table[i][w] = max(without_item, with_item)
            else:
                table[i][w] = without_item

    return table[n][capacity]


weights = [2, 3, 4, 5]
values = [3, 4, 5, 6]
capacity = 8

best_value = knapsack(weights, values, capacity)
print("best value:", best_value)
