data = [10, 20, 30]
n = len(data)
result = []
for i in range(n):
    result.append(data[i] - data[i + 1])
print(result)
