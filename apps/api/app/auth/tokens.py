"""Signed, self-expiring tokens for magic-link auth and session cookies
(docs/PRD.md §8's `users` table; brief item 2). Both token kinds are
`itsdangerous.URLSafeTimedSerializer` payloads signed with `SESSION_SECRET`
— the same signing key, different salts, so a leaked magic-link token can
never be replayed as a session token or vice versa.

**Session mechanism, and why**: a signed, stateless cookie (JWT-shaped, but
itsdangerous rather than a JWT library — no algorithm-confusion surface,
and this repo has no other JWT usage to be consistent with). No
server-side session table: the cookie itself, verified by signature and
expiry on every request, is the full source of truth. That's the simplest
option that satisfies "keep it simple and consistent with this being a
FastAPI app" — revocation-on-demand (e.g. "log out everywhere") would need
a server-side table, but nothing in the brief asks for that, and adding it
speculatively would be exactly the kind of unnecessary abstraction
CLAUDE.md warns against.

Magic-link tokens, by contrast, MUST have server-side state
(`magic_link_tokens.used_at`, app/auth/magic_link_store.py): "single-use"
cannot be enforced by a signature check alone, since the signed payload is
deterministic for a given email + issue time.

Every token type introduced here follows the same discipline as
X-Provider-Key (docs/PRD.md §4.5): never logged. Callers must
`app.logging.bind_sensitive_value(token)` immediately after receiving one
over the wire, before anything else has a chance to log it — see
app/routers/auth.py.
"""

from __future__ import annotations

import hashlib
import os

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

DEFAULT_SESSION_SECRET = "dev-insecure-secret-change-me-in-production"

MAGIC_LINK_SALT = "oocc-magic-link"
SESSION_SALT = "oocc-session"

MAGIC_LINK_MAX_AGE_S = 15 * 60
SESSION_MAX_AGE_S = 30 * 24 * 60 * 60

SESSION_COOKIE_NAME = "oocc_session"
OAUTH_STATE_COOKIE_NAME = "oocc_oauth_state"


def _serializer(salt: str) -> URLSafeTimedSerializer:
    secret = os.environ.get("SESSION_SECRET", DEFAULT_SESSION_SECRET)
    return URLSafeTimedSerializer(secret, salt=salt)


def issue_magic_link_token(email: str) -> str:
    result = _serializer(MAGIC_LINK_SALT).dumps({"email": email})
    assert isinstance(result, str)
    return result


def read_magic_link_token(token: str) -> str | None:
    """Verifies signature and expiry only. Callers still need
    app.auth.magic_link_store.MagicLinkStore.redeem for the single-use
    check — a valid signature just means "genuinely issued by us, not yet
    expired", not "not already spent"."""
    try:
        data = _serializer(MAGIC_LINK_SALT).loads(token, max_age=MAGIC_LINK_MAX_AGE_S)
    except (BadSignature, SignatureExpired):
        return None
    email = data.get("email") if isinstance(data, dict) else None
    return email if isinstance(email, str) else None


def issue_session_token(user_id: str) -> str:
    result = _serializer(SESSION_SALT).dumps({"user_id": user_id})
    assert isinstance(result, str)
    return result


def read_session_token(token: str) -> str | None:
    try:
        data = _serializer(SESSION_SALT).loads(token, max_age=SESSION_MAX_AGE_S)
    except (BadSignature, SignatureExpired):
        return None
    user_id = data.get("user_id") if isinstance(data, dict) else None
    return user_id if isinstance(user_id, str) else None


def hash_token(token: str) -> str:
    """The raw magic-link token is the bearer credential itself and must
    never be persisted — only this hash goes into `magic_link_tokens`,
    mirroring how a password is stored, never the token."""
    return hashlib.sha256(token.encode()).hexdigest()
