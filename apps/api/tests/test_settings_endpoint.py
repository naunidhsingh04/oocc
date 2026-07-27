from app.agents.llm_client import FakeLLMClient
from app.main import app
from app.routers.settings import get_llm_client_for_settings
from fastapi.testclient import TestClient


def test_validate_key_with_no_key_reports_invalid_without_calling_the_model() -> None:
    client = TestClient(app)
    response = client.post("/api/settings/validate-key")

    assert response.status_code == 200
    assert response.json() == {"valid": False, "tokens_used": None, "error": "no_key"}


def test_validate_key_with_a_working_key_reports_valid_and_token_cost() -> None:
    fake = FakeLLMClient(json_responses=[{"ok": True}])
    app.dependency_overrides[get_llm_client_for_settings] = lambda: fake
    try:
        client = TestClient(app)
        response = client.post(
            "/api/settings/validate-key", headers={"X-Provider-Key": "sk-doesnt-matter"}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["tokens_used"] == fake.last_usage_tokens
    assert body["error"] is None


def test_validate_key_with_a_failing_call_reports_invalid_key_not_the_raw_error() -> None:
    class _ExplodingClient:
        last_usage_tokens = None

        async def generate_json(self, **kwargs: object) -> dict:
            raise RuntimeError("401 Unauthorized: bad API key sk-real-secret-value")

        async def stream_text(self, **kwargs: object):  # pragma: no cover - unused here
            yield ""

    app.dependency_overrides[get_llm_client_for_settings] = lambda: _ExplodingClient()
    try:
        client = TestClient(app)
        response = client.post(
            "/api/settings/validate-key", headers={"X-Provider-Key": "sk-doesnt-matter"}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body == {"valid": False, "tokens_used": None, "error": "invalid_key"}
    assert "sk-real-secret-value" not in response.text
