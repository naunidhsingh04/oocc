def is_prime(n):
    if n < 2:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return True


def count_primes_twice(limit):
    count1 = sum(1 for i in range(limit) if is_prime(i))
    count2 = sum(1 for i in range(limit) if is_prime(i))
    return count1 + count2


print(count_primes_twice(15))
