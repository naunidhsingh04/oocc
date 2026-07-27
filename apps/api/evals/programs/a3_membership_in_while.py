allowed = [2, 4, 6, 8, 10]
candidates = [1, 2, 3, 4, 5, 6]
i = 0
count = 0
while i < len(candidates):
    if candidates[i] in allowed:
        count += 1
    i += 1
print(count)
