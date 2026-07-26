def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []


nums = [int(x) for x in input().split()]
target = int(input())

result = two_sum(nums, target)
print("indices:", result)
