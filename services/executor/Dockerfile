# Build context is the repo root (see docker-compose.yml). A separate
# container from day one (docs/PRD.md §5) — Phase 1 adds gVisor/nsjail,
# resource limits, and the real sandboxed tracer here.
#
# Multi-stage, same reasoning as apps/api/Dockerfile: build with uv +
# the full repo (uv's workspace resolution needs every member's
# pyproject.toml), ship only the resulting venv + the source actually
# imported at run time.

FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir uv

WORKDIR /repo
COPY . .

RUN uv sync --package oocc-executor --frozen --no-dev

FROM python:3.12-slim AS runtime

# Non-root by default even before gVisor/nsjail lands (docs/AUDIT.md,
# SECURITY.md §1.1) — this is defense-in-depth alongside, never a
# replacement for, the real per-run sandbox boundary that's still unbuilt.
RUN groupadd --system --gid 1000 oocc \
    && useradd --system --uid 1000 --gid oocc --create-home --home-dir /home/oocc oocc

WORKDIR /repo
COPY --from=builder /repo/.venv /repo/.venv
COPY --from=builder /repo/services/executor /repo/services/executor
COPY --from=builder /repo/packages/contracts/python /repo/packages/contracts/python

COPY services/executor/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R oocc:oocc /repo /home/oocc

ENV PATH="/repo/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8001

USER oocc
EXPOSE 8001

ENTRYPOINT ["docker-entrypoint.sh"]
