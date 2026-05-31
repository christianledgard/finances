# Build from the repo root so the shared db package is in context:
#   docker build -f apps/extractor/Dockerfile -t finances-extractor .
FROM python:3.12-slim

WORKDIR /app

# Install the shared db package first for better layer caching.
COPY packages/db /packages/db
RUN pip install --no-cache-dir /packages/db

# Install the extractor. finances-db is already satisfied above, so pip
# won't try to fetch it from PyPI (the [tool.uv.sources] path dep is uv-only).
COPY apps/extractor/ ./
RUN pip install --no-cache-dir .

EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
