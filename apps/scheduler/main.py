"""Daily scheduler — triggers the extractor's /sync endpoint, then exits.

This is a one-shot script: it runs to completion and returns an exit code.
Deploy it on an external cron schedule; it is NOT a daemon.
"""
import os
import sys

import httpx

EXTRACTOR_URL = os.environ.get("EXTRACTOR_URL", "http://localhost:8000")


def main() -> int:
    url = f"{EXTRACTOR_URL.rstrip('/')}/sync"
    try:
        resp = httpx.post(url, timeout=120)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        print(f"sync failed: {exc}", file=sys.stderr)
        return 1

    print(f"sync ok: {resp.json()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
