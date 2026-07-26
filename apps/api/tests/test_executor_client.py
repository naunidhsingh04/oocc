"""Confirms the ASGI-transport test fixture actually reaches the real
services/executor code (no real network, no second process) — see
conftest.py and app/executor_client.py."""

import pytest
from app.executor_client import ExecutorClient

pytestmark = pytest.mark.anyio


async def test_execute_reaches_the_real_executor(executor_client: ExecutorClient) -> None:
    trace = await executor_client.execute("x = 1 + 1\nprint(x)\n")
    assert trace["status"] == "ok"
    assert trace["meta"]["step_count"] > 0


async def test_execute_counters_reaches_the_real_executor(executor_client: ExecutorClient) -> None:
    result = await executor_client.execute_counters("for i in range(50):\n    pass\n")
    assert result["status"] == "ok"
    assert result["step_count"] > 0
