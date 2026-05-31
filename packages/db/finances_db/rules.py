"""Transaction classification rules — pure data, no DB calls.

Rules are stored in MongoDB and loaded at runtime via rule_from_doc().
"""
from __future__ import annotations

from dataclasses import dataclass, field


def _ob(txn: dict) -> dict:
    return txn.get("openbanking") or {}


def _counterparty(txn: dict) -> str:
    """Normalised creditor (DBIT) or debtor (CRDT) name, lowercased."""
    ob = _ob(txn)
    indicator = ob.get("credit_debit_indicator", "")
    if indicator == "DBIT":
        name = (ob.get("creditor") or {}).get("name") or ""
    else:
        name = (ob.get("debtor") or {}).get("name") or ""
    if not name:
        name = (ob.get("creditor") or {}).get("name") or (ob.get("debtor") or {}).get("name") or ""
    return name.strip().lower()


def _remittance_text(txn: dict) -> str:
    ob = _ob(txn)
    parts = ob.get("remittance_information") or []
    return " ".join(str(p) for p in parts).lower()


def _btc_description(txn: dict) -> str:
    ob = _ob(txn)
    return ((ob.get("bank_transaction_code") or {}).get("description") or "").lower()


def _amount(txn: dict) -> float:
    ob = _ob(txn)
    try:
        return float((ob.get("transaction_amount") or {}).get("amount") or 0)
    except (TypeError, ValueError):
        return 0.0


def _direction(txn: dict) -> str:
    """'in' for CRDT, 'out' for DBIT."""
    ob = _ob(txn)
    return "in" if ob.get("credit_debit_indicator") == "CRDT" else "out"


@dataclass
class Rule:
    rule_id: str
    category: str
    subcategory: str | None = None
    is_transfer: bool = False
    is_roundup: bool = False
    offsets: str | None = None          # "housing" → offsets that category's expense

    # Match predicates — ALL provided predicates must match (ANY value in tuple)
    counterparty_contains: tuple[str, ...] = field(default_factory=tuple)
    remittance_contains: tuple[str, ...] = field(default_factory=tuple)
    btc_contains: tuple[str, ...] = field(default_factory=tuple)
    indicator: str | None = None        # "CRDT" | "DBIT" | None = both

    def matches(self, txn: dict) -> bool:
        ob = _ob(txn)
        if self.indicator and ob.get("credit_debit_indicator") != self.indicator:
            return False
        cp = _counterparty(txn)
        if self.counterparty_contains and not any(s in cp for s in self.counterparty_contains):
            return False
        ri = _remittance_text(txn)
        if self.remittance_contains and not any(s in ri for s in self.remittance_contains):
            return False
        btc = _btc_description(txn)
        if self.btc_contains and not any(s in btc for s in self.btc_contains):
            return False
        return True


def rule_from_doc(doc: dict) -> Rule:
    """Convert a MongoDB rule document to the pure Rule dataclass."""
    return Rule(
        rule_id=doc["rule_id"],
        category=doc["category"],
        subcategory=doc.get("subcategory"),
        is_transfer=doc.get("is_transfer", False),
        is_roundup=doc.get("is_roundup", False),
        offsets=doc.get("offsets"),
        counterparty_contains=tuple(doc.get("counterparty_contains") or ()),
        remittance_contains=tuple(doc.get("remittance_contains") or ()),
        btc_contains=tuple(doc.get("btc_contains") or ()),
        indicator=doc.get("indicator"),
    )
