"""Pydantic models describing what we store in MongoDB."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Account(BaseModel):
    """A bank account as returned by EnableBanking's POST /sessions."""
    model_config = ConfigDict(extra="allow")

    uid: str
    name: str | None = None
    iban: str | None = None
    currency: str | None = None


class Session(BaseModel):
    """A connected EnableBanking session (one bank authorization)."""
    model_config = ConfigDict(extra="allow")

    session_id: str
    accounts: list[Account] = Field(default_factory=list)
    connected_at: datetime | None = None


class Enrichment(BaseModel):
    """Derived fields written by the enrichment engine (rules or AI).

    Stored under the ``enrichment`` key — completely isolated from the raw
    OpenBanking payload so neither flow can accidentally clobber the other.
    """
    model_config = ConfigDict(extra="allow")

    # Classification
    category: str | None = None          # "income", "housing", "groceries", "transfer", …
    subcategory: str | None = None        # "salary", "rent", "roundup", …

    # Normalized scalars (lifted from openbanking for easy aggregation)
    amount: float | None = None           # always positive
    direction: str | None = None          # "in" (CRDT) | "out" (DBIT)

    # Flags
    is_transfer: bool = False             # internal/own-account move; excluded from P&L
    is_roundup: bool = False              # "Afronding" automatic round-up to savings
    is_recurring: bool = False            # creditor/debtor seen in ≥3 distinct months

    # Matching metadata
    counterparty: str | None = None       # normalised creditor or debtor name
    offsets: str | None = None            # "housing" → roommate inflow offsets rent

    # Provenance
    source: str | None = None            # "rule" | "ai" | "manual"
    rule_id: str | None = None
    enriched_at: datetime | None = None


class RuleDoc(BaseModel):
    """An enrichment rule stored in MongoDB (Mongo-shaped: lists, timestamps, order)."""
    model_config = ConfigDict(extra="allow")

    rule_id: str
    order: int = 0
    enabled: bool = True
    category: str
    subcategory: str | None = None
    is_transfer: bool = False
    is_roundup: bool = False
    offsets: str | None = None
    counterparty_contains: list[str] = Field(default_factory=list)
    remittance_contains: list[str] = Field(default_factory=list)
    btc_contains: list[str] = Field(default_factory=list)
    indicator: str | None = None          # "CRDT" | "DBIT" | None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class Transaction(BaseModel):
    """A single bank movement.

    Three disjoint zones owned by separate flows:
      - identity keys (transaction_id, account_uid, synced_at) — CREATE flow
      - openbanking: verbatim EnableBanking payload              — CREATE flow
      - enrichment: derived/classified fields                    — ENRICH flow
    """
    model_config = ConfigDict(extra="allow")

    transaction_id: str
    account_uid: str
    synced_at: datetime | None = None

    openbanking: dict | None = None       # raw EnableBanking payload, never modified after sync
    enrichment: Enrichment | None = None  # written only by the enrichment engine
