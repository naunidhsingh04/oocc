items = [1, 2, 3]
appended = False
for x in items:
    if x == 2 and not appended:
        items.append(99)
        appended = True
print(items)
