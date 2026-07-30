"""Fail-loud startup checks for production misconfiguration that would
otherwise be silent security holes rather than crashes — the difference
matters because every default in this codebase is deliberately permissive
for local dev (see app/auth/tokens.py, app/main.py's ALLOWED_ORIGINS
default): the same fallback that makes `uv run uvicorn ...` work with
zero setup also makes a deploy with a forgotten env var *look* like it's
working while actually being forgeable/wide open, or — for a misspelled/
wrong CORS env var name specifically — just silently broken with no
error anywhere, since a browser's CORS rejection never reaches this
server's logs at all. Gated on `ENVIRONMENT=production` (set by every
Dockerfile/DEPLOY.md in this repo) so local dev and tests never trip
these.
"""

from __future__ import annotations

import os


def is_production() -> bool:
    return os.environ.get("ENVIRONMENT", "development") == "production"


def check_production_config(*, allowed_origins: list[str]) -> None:
    if not is_production():
        return

    from app.auth.tokens import DEFAULT_SESSION_SECRET

    if os.environ.get("SESSION_SECRET", DEFAULT_SESSION_SECRET) == DEFAULT_SESSION_SECRET:
        raise RuntimeError(
            "SESSION_SECRET is unset (or equals the publicly-known dev default) while "
            "ENVIRONMENT=production. Refusing to start: every session/magic-link token "
            "would be signed with a secret anyone can read in this repo's source, so "
            "anyone could forge a valid login cookie. Set SESSION_SECRET to a real "
            "random value (see .env.example)."
        )

    if not allowed_origins or "*" in allowed_origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS is unset, empty, or contains '*' while ENVIRONMENT=production. "
            "Refusing to start: this API allows credentialed requests (cookies), and a "
            "wildcard origin combined with credentials is a real CSRF-style exposure, not "
            "just a lint rule. Set ALLOWED_ORIGINS to your exact frontend origin(s), "
            "comma-separated (see .env.example)."
        )
