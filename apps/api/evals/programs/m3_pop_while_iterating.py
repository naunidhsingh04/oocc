queue = [1, 2, 3, 4, 5]
for x in queue:
    if x % 2 == 1:
        queue.pop(0)
print(queue)
