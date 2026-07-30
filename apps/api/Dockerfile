# Build context is the repo root (see docker-compose.yml) — apps/api
# depends on packages/contracts/python as a uv workspace member.
#
# Multi-stage: the builder stage has uv + the full repo (needed for uv's
# workspace resolution, which reads every member's pyproject.toml even
# though only oocc-api's own dependency tree gets installed) and produces
# a self-contained virtualenv. The runtime stage copies out only that
# venv plus the two source trees actually imported at run time
# (apps/api, and packages/contracts/python — oocc-contracts is an
# editable workspace install, so its *source* has to be present, not
# just its metadata) — no uv, no build tooling, no other service's code.

FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir uv

WORKDIR /repo
COPY . .

RUN uv sync --package oocc-api --frozen --no-dev

FROM python:3.12-slim AS runtime

# A dedicated, unprivileged user rather than the "nobody" uid/gid trick —
# this image is COPY'd into fresh, so ownership can be set correctly at
# build time instead of hoping the base image's ambient permissions work
# out (see docker-compose.yml's executor service comment on exactly that
# gap never having been runtime-verified there).
RUN groupadd --system --gid 1000 oocc \
    && useradd --system --uid 1000 --gid oocc --create-home --home-dir /home/oocc oocc

WORKDIR /repo
COPY --from=builder /repo/.venv /repo/.venv
COPY --from=builder /repo/apps/api /repo/apps/api
COPY --from=builder /repo/packages/contracts/python /repo/packages/contracts/python

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R oocc:oocc /repo /home/oocc

ENV PATH="/repo/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

USER oocc
EXPOSE 8000

# Render (and most PaaS targets) assign PORT dynamically — the entrypoint
# reads it at container start, not build time, so this image works
# unmodified whether PORT is 8000 (the EXPOSE/local-dev default) or
# whatever the platform assigns.
ENTRYPOINT ["docker-entrypoint.sh"]
