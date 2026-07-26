class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def build_list(values):
    head = None
    for val in reversed(values):
        head = ListNode(val, head)
    return head


def reverse_list(head):
    prev = None
    current = head
    while current is not None:
        next_node = current.next
        current.next = prev
        prev = current
        current = next_node
    return prev


def to_list(head):
    values = []
    while head is not None:
        values.append(head.val)
        head = head.next
    return values


original = build_list([1, 2, 3, 4])
reversed_head = reverse_list(original)
print("reversed:", to_list(reversed_head))
