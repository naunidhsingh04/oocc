from executor_app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_execute_returns_a_schema_valid_trace() -> None:
    response = client.post("/execute", json={"source": "x = 1 + 1\nprint(x)\n"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["meta"]["step_count"] > 0
    assert any(step["event"] == "stdout" for step in body["steps"])


def test_execute_reports_runtime_error() -> None:
    response = client.post("/execute", json={"source": "1 / 0\n"})
    body = response.json()
    assert body["status"] == "runtime_error"
    assert body["error"]["type"] == "ZeroDivisionError"


def test_execute_counters_is_fast_and_scales() -> None:
    source = "n = {n}\ntotal = 0\nfor i in range(n):\n    for j in range(n):\n        total += 1\n"
    small = client.post("/execute/counters", json={"source": source.format(n=10)}).json()
    large = client.post("/execute/counters", json={"source": source.format(n=100)}).json()
    assert small["status"] == "ok"
    assert large["status"] == "ok"
    # O(n^2): a 10x increase in n should be a ~100x increase in steps, not
    # ~10x (linear) or ~3.3x (log-linear) — comfortably distinguishes the
    # shape without pinning the exact constant-overhead-adjusted ratio.
    assert large["step_count"] > small["step_count"] * 50


def test_execute_counters_reports_runtime_error_without_crashing() -> None:
    response = client.post("/execute/counters", json={"source": "1 / 0\n"})
    assert response.status_code == 200
    assert response.json()["status"] == "runtime_error"
