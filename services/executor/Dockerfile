# Build context is the repo root (see docker-compose.yml). A separate
# container from day one (docs/PRD.md §5) — Phase 1 adds gVisor/nsjail,
# resource limits, and the real sandboxed tracer here.
FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /repo
COPY . .

RUN uv sync --package oocc-executor --frozen

EXPOSE 8001
CMD ["uv", "run", "--package", "oocc-executor", "uvicorn", "app.main:app", \
     "--app-dir", "services/executor", "--host", "0.0.0.0", "--port", "8001"]
