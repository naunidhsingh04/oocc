def average_passing_score(scores, passing_threshold):
    passing = [s for s in scores if s >= passing_threshold]
    total = sum(passing)
    return total / len(passing)


scores = [55, 62, 48, 70, 58]
passing_threshold = 75

print("checking scores:", scores)
average = average_passing_score(scores, passing_threshold)
print("average passing score:", average)
