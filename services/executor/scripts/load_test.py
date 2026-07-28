"""Phase 6 operations load test — docs/RUNBOOK.md §4. Fires N concurrent
POST /execute requests at a *running* executor server and reports
latency/throughput. Doesn't start the server itself: point it at one you
already started, e.g.

    uv run --package oocc-executor uvicorn executor_app.main:app \\
        --app-dir services/executor --port 8090 &
    uv run --package oocc-executor python services/executor/scripts/load_test.py --concurrency 100

The result recorded in docs/RUNBOOK.md §4 (100 concurrent requests, single
uvicorn worker, ~59s wall time, 93/100 client-side timeouts, the server
still processing the backlog for over a minute afterward — including
`/health` not responding) came from exactly this script against this
repo's actual `services/executor/executor_app/main.py`.
"""

from __future__ import annotations

import argparse
import asyncio
import time

import httpx

SOURCE = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

numbers = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0]
print(bubble_sort(numbers))
"""


async def one_request(client: httpx.AsyncClient, url: str, timeout: float) -> dict:
    start = time.monotonic()
    try:
        resp = await client.post(url, json={"source": SOURCE}, timeout=timeout)
        return {"ok": resp.status_code == 200, "elapsed": time.monotonic() - start}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e), "elapsed": time.monotonic() - start}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8090/execute")
    parser.add_argument("--concurrency", type=int, default=100)
    parser.add_argument("--client-timeout", type=float, default=30.0)
    args = parser.parse_args()

    async with httpx.AsyncClient() as client:
        start = time.monotonic()
        results = await asyncio.gather(
            *[one_request(client, args.url, args.client_timeout) for _ in range(args.concurrency)]
        )
        total_wall = time.monotonic() - start

    errors = [r for r in results if not r["ok"]]
    latencies = sorted(r["elapsed"] for r in results)
    p50 = latencies[len(latencies) // 2]
    p95 = latencies[int(len(latencies) * 0.95)]

    print(f"concurrency: {args.concurrency}")
    print(f"total wall time: {total_wall:.2f}s")
    print(f"errors/timeouts (client-side {args.client_timeout}s budget): {len(errors)}")
    print(f"latency p50={p50:.3f}s p95={p95:.3f}s min={latencies[0]:.3f}s max={latencies[-1]:.3f}s")
    print(f"throughput: {args.concurrency / total_wall:.2f} requests/sec")


if __name__ == "__main__":
    asyncio.run(main())
