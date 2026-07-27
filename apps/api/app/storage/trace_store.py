"""Object storage for execution traces (docs/PRD.md §8: "Traces are not
stored in Postgres. Write them to object storage (S3/R2) as gzipped JSON,
keep the URL in `runs.trace_url`"). R2 is S3-compatible, so one boto3
client covers both — point `OOCC_S3_ENDPOINT_URL` at R2's endpoint for that
case and leave it unset for real S3. `InMemoryTraceStore` is the fake used
by every test and by local dev without a bucket configured: same
gzip-then-store shape, a dict instead of a bucket, no network.
"""

from __future__ import annotations

import gzip
import json
import os
import uuid
from typing import Any, Protocol


class TraceStore(Protocol):
    async def put(self, trace_json: dict[str, Any]) -> str: ...
    async def get(self, url: str) -> dict[str, Any]: ...


def _new_key() -> str:
    return f"traces/{uuid.uuid4().hex}.json.gz"


class InMemoryTraceStore:
    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}

    async def put(self, trace_json: dict[str, Any]) -> str:
        key = _new_key()
        self._objects[key] = gzip.compress(json.dumps(trace_json).encode())
        return f"mem://{key}"

    async def get(self, url: str) -> dict[str, Any]:
        key = url.removeprefix("mem://")
        payload = self._objects[key]
        result = json.loads(gzip.decompress(payload))
        assert isinstance(result, dict)
        return result

    def __len__(self) -> int:
        return len(self._objects)


class S3TraceStore:
    """boto3's S3 client is synchronous; every call is pushed to a thread
    via `asyncio.to_thread` so it doesn't block the event loop — the same
    reasoning as `app.auth.mail.SmtpMailSender` uses for `smtplib`.
    Not exercised by any test in this repo (no live S3/R2 endpoint is
    reachable from this environment — see CLAUDE.md); it's exercised only
    by real deployment, the same status as
    `app.rag.concept_store.PostgresConceptStore`. `InMemoryTraceStore`
    carries every test that needs a `TraceStore`.
    """

    def __init__(
        self,
        *,
        bucket: str | None = None,
        endpoint_url: str | None = None,
        region_name: str | None = None,
    ) -> None:
        self._bucket = bucket or os.environ.get("TRACE_BUCKET", "oocc-traces")
        self._endpoint_url = endpoint_url or os.environ.get("OOCC_S3_ENDPOINT_URL")
        self._region_name = region_name or os.environ.get("AWS_REGION", "auto")
        self._client: Any | None = None

    def _boto_client(self) -> Any:
        if self._client is None:
            import boto3  # type: ignore[import-untyped]

            self._client = boto3.client(
                "s3", endpoint_url=self._endpoint_url, region_name=self._region_name
            )
        return self._client

    async def put(self, trace_json: dict[str, Any]) -> str:
        import asyncio

        key = _new_key()
        payload = gzip.compress(json.dumps(trace_json).encode())
        await asyncio.to_thread(
            self._boto_client().put_object,
            Bucket=self._bucket,
            Key=key,
            Body=payload,
            ContentType="application/json",
            ContentEncoding="gzip",
        )
        return f"s3://{self._bucket}/{key}"

    async def get(self, url: str) -> dict[str, Any]:
        import asyncio

        _scheme, _sep, rest = url.partition("s3://")
        bucket, _sep2, key = rest.partition("/")
        response = await asyncio.to_thread(self._boto_client().get_object, Bucket=bucket, Key=key)
        body = await asyncio.to_thread(response["Body"].read)
        result = json.loads(gzip.decompress(body))
        assert isinstance(result, dict)
        return result
