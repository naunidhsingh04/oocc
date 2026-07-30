from app.agents.llm_client import FakeLLMClient
from app.main import app
from app.routers.settings import get_llm_client_for_settings
from fastapi.testclient import TestClient
from google.genai.errors import ClientError


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


def _explode_with(exc: BaseException) -> object:
    class _ExplodingClient:
        last_usage_tokens = None

        async def generate_json(self, **kwargs: object) -> dict:
            raise exc

        async def stream_text(self, **kwargs: object):  # pragma: no cover - unused here
            yield ""

    return _ExplodingClient()


def _assert_validate_key_reports(exc: BaseException, expected_error: str) -> None:
    app.dependency_overrides[get_llm_client_for_settings] = lambda: _explode_with(exc)
    try:
        client = TestClient(app)
        response = client.post(
            "/api/settings/validate-key", headers={"X-Provider-Key": "sk-doesnt-matter"}
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body == {"valid": False, "tokens_used": None, "error": expected_error}
    assert "sk-real-secret-value" not in response.text


def test_validate_key_with_a_4xx_from_gemini_reports_invalid_key_not_the_raw_error() -> None:
    exc = ClientError(
        401,
        {
            "error": {
                "message": "API key not valid: sk-real-secret-value",
                "status": "UNAUTHENTICATED",
            }
        },
    )
    _assert_validate_key_reports(exc, "invalid_key")


def test_validate_key_with_a_429_from_gemini_reports_rate_limited_not_invalid() -> None:
    exc = ClientError(
        429, {"error": {"message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}}
    )
    _assert_validate_key_reports(exc, "rate_limited")


def test_validate_key_with_a_non_client_error_reports_upstream_unavailable_not_invalid() -> None:
    # A real key can fail this way for reasons that have nothing to do with
    # the key itself — a network error, Gemini returning 5xx, a timeout.
    # Reporting this identically to a genuinely bad key is the exact bug
    # this distinction exists to avoid.
    _assert_validate_key_reports(RuntimeError("connection reset"), "upstream_unavailable")
