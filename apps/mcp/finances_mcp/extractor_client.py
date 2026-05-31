"""HTTP client for the extractor API (server-to-server)."""
from __future__ import annotations

from typing import Any

import httpx

from .config import Settings

_HEADERS = {"Accept": "application/json"}


class ExtractorClient:
    """Thin async client — never passes user OAuth tokens downstream."""

    def __init__(self, settings: Settings) -> None:
        self._base = settings.extractor_url
        self._headers = {**_HEADERS, "X-API-Key": settings.extractor_api_key}

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        json: Any = None,
    ) -> Any:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method,
                f"{self._base}{path}",
                headers=self._headers,
                params=params,
                json=json,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                # Surface the extractor's error detail rather than a raw HTTP error.
                try:
                    detail = exc.response.json().get("detail") or str(exc)
                except Exception:
                    detail = str(exc)
                raise ValueError(detail) from exc
            return resp.json()

    async def _get(self, path: str, params: dict[str, str] | None = None) -> Any:
        return await self._request("GET", path, params=params)

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

    # ------------------------------------------------------------------
    # Rules endpoints
    # ------------------------------------------------------------------

    async def list_rules(self) -> list[dict]:
        data = await self._get("/rules")
        return data.get("rules") or []

    async def create_rule(self, body: dict) -> dict:
        data = await self._request("POST", "/rules", json=body)
        return data.get("rule") or data

    async def update_rule(self, rule_id: str, patch: dict) -> dict:
        data = await self._request("PUT", f"/rules/{rule_id}", json=patch)
        return data.get("rule") or data

    async def delete_rule(self, rule_id: str) -> bool:
        data = await self._request("DELETE", f"/rules/{rule_id}")
        return bool(data.get("deleted"))

    async def reorder_rules(self, ordered_rule_ids: list[str]) -> int:
        data = await self._request("POST", "/rules/reorder", json={"ordered_rule_ids": ordered_rule_ids})
        return int(data.get("reordered") or 0)

    async def reenrich(self) -> dict:
        return await self._request("POST", "/enrich")

    async def preview_rule(self, month: str, body: dict) -> dict:
        return await self._request("POST", "/rules/preview", json={"month": month, **body})
