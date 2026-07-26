graph = {
    0: [1, 2],
    1: [0, 3, 4],
    2: [0, 4],
    3: [1, 5],
    4: [1, 2, 5],
    5: [3, 4],
}


def bfs(graph, start):
    visited = {start}
    order = []
    queue = [start]
    while queue:
        node = queue.pop(0)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order


visit_order = bfs(graph, 0)
print("visit order:", visit_order)
