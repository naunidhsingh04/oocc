"""Magic-link email delivery (brief item 2). Real implementation is SMTP
via the stdlib `smtplib` — a magic-link email is one short plaintext
message, no attachments, no templating engine needed, so pulling in a
provider SDK would be an unnecessary abstraction for what this is. Tests
use `InMemoryMailSender`, which never opens a socket: there is no live SMTP
server reachable from this environment (see CLAUDE.md).
"""

from __future__ import annotations

import asyncio
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol


class MailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


@dataclass(frozen=True)
class SentMail:
    to: str
    subject: str
    body: str


class InMemoryMailSender:
    """Records what would have been sent instead of sending it — the fake
    used by every test, and by local dev when SMTP_HOST is unset."""

    def __init__(self) -> None:
        self.sent: list[SentMail] = []

    async def send(self, *, to: str, subject: str, body: str) -> None:
        self.sent.append(SentMail(to=to, subject=subject, body=body))


class SmtpMailSender:
    """Real sender. `smtplib` is blocking, so every call is pushed to a
    thread via `asyncio.to_thread` — the same reasoning as
    app/storage/trace_store.py's S3TraceStore uses for boto3. Credentials
    come from environment variables, never hard-coded, and never reach
    structlog at all: smtplib takes them directly, so there's nothing to
    redact."""

    def __init__(
        self,
        *,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        sender: str | None = None,
        use_tls: bool = True,
    ) -> None:
        self._host = host or os.environ.get("SMTP_HOST", "localhost")
        self._port = port or int(os.environ.get("SMTP_PORT", "587"))
        self._username = username or os.environ.get("SMTP_USERNAME")
        self._password = password or os.environ.get("SMTP_PASSWORD")
        self._sender = sender or os.environ.get("SMTP_SENDER", "noreply@oocc.dev")
        self._use_tls = use_tls

    async def send(self, *, to: str, subject: str, body: str) -> None:
        await asyncio.to_thread(self._send_sync, to, subject, body)

    def _send_sync(self, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self._sender
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(self._host, self._port) as client:
            if self._use_tls:
                client.starttls()
            if self._username and self._password:
                client.login(self._username, self._password)
            client.send_message(message)
