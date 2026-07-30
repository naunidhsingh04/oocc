import pytest
from app.env_checks import check_production_config, is_production


def test_is_production_false_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert is_production() is False


def test_is_production_true_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert is_production() is True


def test_noop_outside_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    # Would raise if ENVIRONMENT=production; must not raise here.
    check_production_config(cors_origins=[])


def test_refuses_default_session_secret_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        check_production_config(cors_origins=["https://example.com"])


def test_refuses_wildcard_cors_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "a-real-random-secret")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        check_production_config(cors_origins=["*"])


def test_refuses_empty_cors_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "a-real-random-secret")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        check_production_config(cors_origins=[])


def test_passes_with_real_secret_and_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "a-real-random-secret")
    check_production_config(cors_origins=["https://oocc.example.com"])
