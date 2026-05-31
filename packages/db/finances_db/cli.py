"""CLI entry points for one-off DB operations.

  uv run finances-enrich         — run the enrichment engine (reads rules from MongoDB)
  uv run finances-uncategorized  — show uncategorized transaction summary
"""
import asyncio

from .client import close
from .enrichment import enrich_all_from_db
from .repository import (
    bulk_set_enrichment,
    get_uncategorized_transactions,
    iter_all_transactions,
)


async def _enrich() -> None:
    txns = await iter_all_transactions()
    print(f"Loaded {len(txns)} transactions.")
    updates = await enrich_all_from_db(txns)
    modified = await bulk_set_enrichment(updates)
    print(f"Enrichment complete: {modified} docs updated ({len(updates)} processed).")
    await close()


async def _show_uncategorized() -> None:
    rows = await get_uncategorized_transactions()
    await close()
    if not rows:
        print("No uncategorized transactions — everything is covered!")
        return
    total_amount = sum(r["total"] for r in rows)
    total_count = sum(r["count"] for r in rows)
    print(f"\n{'Counterparty':<42} {'Txns':>5} {'Total €':>10}  Months")
    print("─" * 75)
    for r in rows:
        name = (r["_id"] or "(no name)")[:41]
        months = ", ".join(sorted(r["months"] or []))
        print(f"{name:<42} {r['count']:>5} {r['total']:>10.2f}  {months}")
    print("─" * 75)
    print(f"{'TOTAL':<42} {total_count:>5} {total_amount:>10.2f}")


def run_enrich() -> None:
    """Entry point for finances-enrich."""
    asyncio.run(_enrich())


def run_uncategorized() -> None:
    """Entry point for finances-uncategorized."""
    asyncio.run(_show_uncategorized())
