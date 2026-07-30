N = 10  # fixtures/generator/run_all.py replaces this with a calibrated value

total = 0
for i in range(N):
    total += i * i
print("total:", total)
