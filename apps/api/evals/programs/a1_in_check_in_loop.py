seen = []
values = [3, 1, 4, 1, 5, 9, 2, 6]
unique = []
for v in values:
    if v not in seen:
        unique.append(v)
        seen.append(v)
print(unique)
