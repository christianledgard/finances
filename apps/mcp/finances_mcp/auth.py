"""Google OAuth provider and extractor-backed admin authorization middleware."""
from __future__ import annotations

from fastmcp.server.auth.providers.google import GoogleProvider
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext
from key_value.aio.stores.memory import MemoryStore
from mcp import McpError
from mcp.types import ErrorData

from .config import Settings
from .extractor_client import ExtractorClient

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _client_storage(settings: Settings):
    store = MemoryStore()
    if not settings.storage_encryption_key:
        return store

    from cryptography.fernet import Fernet
    from key_value.aio.wrappers.encryption import FernetEncryptionWrapper

    return FernetEncryptionWrapper(
        key_value=store,
        fernet=Fernet(settings.storage_encryption_key.encode()),
    )


def build_google_provider(settings: Settings) -> GoogleProvider:
    return GoogleProvider(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        base_url=settings.public_url,
        required_scopes=GOOGLE_SCOPES,
        jwt_signing_key=settings.jwt_signing_key,
        client_storage=_client_storage(settings),
    )


class AdminOnlyMiddleware(Middleware):
    """Reject authenticated users who are not admins (checked via extractor HTTP API)."""

    def __init__(self, extractor: ExtractorClient) -> None:
        self._extractor = extractor

    async def on_request(self, context: MiddlewareContext, call_next):
        if context.method in {"initialize"}:
            return await call_next(context)

        token = get_access_token()
        if token is None:
            raise McpError(
                ErrorData(
                    code=-32001,
                    message="Authentication required",
                )
            )

        email = (token.claims.get("email") or "").strip()
        if not email or not await self._extractor.is_admin(email):
            raise McpError(
                ErrorData(
                    code=-32003,
                    message="Access denied: admin role required",
                )
            )

        return await call_next(context)
