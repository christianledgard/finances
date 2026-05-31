"""Read-only HTTP client for the extractor API (server-to-server)."""
from __future__ import annotations

from typing import Any

import httpx

from .config import Settings

_HEADERS = {"Accept": "application/json"}


class ExtractorClient:
    """Thin async client — only GET endpoints, never passes user OAuth tokens."""

    def __init__(self, settings: Settings) -> None:
        self._base = settings.extractor_url
        self._headers = {**_HEADERS, "X-API-Key": settings.extractor_api_key}

    async def _get(self, path: str, params: dict[str, str] | None = None) -> Any:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self._base}{path}",
                headers=self._headers,
                params=params,
            )
            resp.raise_for_status()
            return resp.json()

    async def monthly_summary(self) -> list[dict]:
        data = await self._get("/transactions/monthly")
        return data.get("months") or []

    async def category_breakdown(self, month: str | None = None) -> list[dict]:
        params = {"month": month} if month else None
        data = await self._get("/transactions/categories", params=params)
        return data.get("categories") or []

    async def transactions_detail(self, month: str) -> list[dict]:
        data = await self._get("/transactions/detail", params={"month": month})
        return data.get("transactions") or []

    async def savings(self) -> dict:
        return await self._get("/savings")

    async def subscriptions(self) -> dict:
        return await self._get("/subscriptions")

    async def uncategorized(self) -> list[dict]:
        data = await self._get("/transactions/uncategorized")
        return data.get("items") or []

    async def is_admin(self, email: str) -> bool:
        data = await self._get("/auth/admin", params={"email": email})
        return bool(data.get("is_admin"))
