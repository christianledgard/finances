"""MongoDB connection management."""
import os

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    """Return a lazily-initialised, process-wide Motor client."""
    global _client
    if _client is None:
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        _client = AsyncIOMotorClient(uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    """Return the configured database handle."""
    db_name = os.environ.get("MONGODB_DB", "finances")
    return get_client()[db_name]


async def close() -> None:
    """Close the client (use on app shutdown)."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
