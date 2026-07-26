def is_safe(columns, row, col):
    for placed_row, placed_col in enumerate(columns):
        if placed_col == col:
            return False
        if abs(placed_col - col) == abs(placed_row - row):
            return False
    return True


def solve(n, columns, solutions):
    row = len(columns)
    if row == n:
        solutions.append(list(columns))
        return
    for col in range(n):
        if is_safe(columns, row, col):
            columns.append(col)
            solve(n, columns, solutions)
            columns.pop()


n = 5
solutions = []
solve(n, [], solutions)
print(f"{n}-queens solutions:", len(solutions))
print("first solution:", solutions[0])
