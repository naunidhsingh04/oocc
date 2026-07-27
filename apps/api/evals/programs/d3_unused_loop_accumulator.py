def stats(values):
    minimum = min(values) if values else 0
    maximum = max(values)
    total = sum(values)
    return total


print(stats([4, 2, 7, 1]))
