"""Rule-based enrichment engine — pure functions, no DB calls, no FastAPI.

Can be imported by the extractor endpoint, the CLI, or the future AI job.
Rules live in MongoDB at runtime; this module applies them and returns enrichment dicts.
"""
from __future__ import annotations

from .rules import Rule, _amount, _counterparty, _direction, _ob, _remittance_text


def classify(txn: dict, rules: list[Rule]) -> dict:
    """Return an enrichment dict for a single transaction."""
    for rule in rules:
        if rule.matches(txn):
            return {
                "category": rule.category,
                "subcategory": rule.subcategory,
                "amount": _amount(txn),
                "direction": _direction(txn),
                "is_transfer": rule.is_transfer,
                "is_roundup": rule.is_roundup,
                "is_recurring": False,
                "counterparty": _counterparty(txn),
                "offsets": rule.offsets,
                "source": "rule",
                "rule_id": rule.rule_id,
            }

    direction = _direction(txn)
    return {
        "category": "income" if direction == "in" else "uncategorized",
        "subcategory": None,
        "amount": _amount(txn),
        "direction": direction,
        "is_transfer": False,
        "is_roundup": False,
        "is_recurring": False,
        "counterparty": _counterparty(txn),
        "offsets": None,
        "source": "rule",
        "rule_id": "fallback",
    }


def detect_recurring(txns: list[dict]) -> set[str]:
    """Return counterparty names seen as DBIT in ≥3 distinct months."""
    from collections import defaultdict
    months_by_cp: dict[str, set[str]] = defaultdict(set)
    for txn in txns:
        ob = _ob(txn)
        if ob.get("credit_debit_indicator") != "DBIT":
            continue
        ri = _remittance_text(txn)
        if "afronding" in ri:
            continue
        cp = _counterparty(txn)
        if "spaar" in cp:
            continue
        booking = (ob.get("booking_date") or "")[:7]
        if booking:
            months_by_cp[cp].add(booking)
    return {cp for cp, months in months_by_cp.items() if len(months) >= 3}


def enrich_all(txns: list[dict], rules: list[Rule]) -> list[tuple[str, dict]]:
    """Classify all transactions and return (transaction_id, enrichment) pairs."""
    classified = [(txn["transaction_id"], classify(txn, rules)) for txn in txns]
    recurring = detect_recurring(txns)

    result = []
    for tid, enrichment in classified:
        cp = enrichment.get("counterparty", "")
        enrichment["is_recurring"] = (
            cp in recurring
            and not enrichment.get("is_transfer", False)
            and enrichment.get("direction") == "out"
        )
        result.append((tid, enrichment))
    return result


async def enrich_all_from_db(txns: list[dict]) -> list[tuple[str, dict]]:
    """DB-aware wrapper: loads rules from MongoDB then calls the pure enrich_all."""
    from .repository import get_rules_for_engine
    rules = await get_rules_for_engine()
    return enrich_all(txns, rules)


async def enrich_new_from_db() -> int:
    """Enrich only transactions that lack an enrichment object.

    Uses the full transaction set as context for recurring detection but writes
    enrichment only for documents that don't have it yet. Returns docs written.
    """
    from .repository import (
        bulk_set_enrichment,
        iter_all_transactions,
        unenriched_transaction_ids,
    )
    new_ids = await unenriched_transaction_ids()
    if not new_ids:
        return 0
    txns = await iter_all_transactions()
    updates = await enrich_all_from_db(txns)
    to_write = [(tid, e) for tid, e in updates if tid in new_ids]
    return await bulk_set_enrichment(to_write)
