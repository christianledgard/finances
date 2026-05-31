"""Authorization helpers for Better Auth users stored in MongoDB."""
from __future__ import annotations

import re

from .client import get_db

AUTHORIZED_ROLE = "admin"


async def is_admin_user(email: str) -> bool:
    """Return True when email belongs to a Better Auth user with role admin."""
    normalized = email.strip()
    if not normalized:
        return False

    db = get_db()
    doc = await db.user.find_one(
        {"email": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}},
        {"role": 1},
    )
    return doc is not None and doc.get("role") == AUTHORIZED_ROLE
