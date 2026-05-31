FROM python:3.12-slim

WORKDIR /app

COPY apps/scheduler/pyproject.toml ./
RUN pip install --no-cache-dir httpx

COPY apps/scheduler/main.py ./

CMD ["python", "main.py"]
