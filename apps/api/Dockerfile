# Build context is the repo root (see docker-compose.yml) — apps/api
# depends on packages/contracts/python as a uv workspace member.
FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /repo
COPY . .

RUN uv sync --package oocc-api --frozen

EXPOSE 8000
CMD ["uv", "run", "--package", "oocc-api", "uvicorn", "app.main:app", \
     "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8000"]
