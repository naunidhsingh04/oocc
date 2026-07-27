def process(data):
    list = []
    for item in data:
        list.append(item * 2)
    return list


print(process([1, 2, 3]))
