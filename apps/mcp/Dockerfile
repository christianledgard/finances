# Build from the repo root:
#   docker build -f apps/mcp/Dockerfile -t finances-mcp .
FROM python:3.12-slim

WORKDIR /app

COPY apps/mcp/ ./
RUN pip install --no-cache-dir .

EXPOSE ${PORT:-9000}

CMD ["sh", "-c", "exec finances-mcp"]
