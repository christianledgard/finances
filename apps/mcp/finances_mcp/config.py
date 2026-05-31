"""Environment configuration for the MCP service."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True, slots=True)
class Settings:
    public_url: str
    google_client_id: str
    google_client_secret: str
    extractor_url: str
    extractor_api_key: str
    jwt_signing_key: str
    storage_encryption_key: str | None
    port: int

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            public_url=_require("PUBLIC_URL").rstrip("/"),
            google_client_id=_require("GOOGLE_CLIENT_ID"),
            google_client_secret=_require("GOOGLE_CLIENT_SECRET"),
            extractor_url=_require("EXTRACTOR_URL").rstrip("/"),
            extractor_api_key=_require("EXTRACTOR_API_KEY"),
            jwt_signing_key=_require("JWT_SIGNING_KEY"),
            storage_encryption_key=os.environ.get("STORAGE_ENCRYPTION_KEY", "").strip() or None,
            port=int(os.environ.get("PORT", "9000")),
        )
