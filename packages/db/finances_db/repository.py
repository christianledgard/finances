"""Data-access helpers. The extractor talks to Mongo only through these."""
from datetime import datetime, timezone

from pymongo import UpdateOne

from .client import get_db


async def ensure_indexes() -> None:
    """Create the unique indexes the collections rely on. Idempotent."""
    db = get_db()
    await db.sessions.create_index("session_id", unique=True)
    await db.transactions.create_index("transaction_id", unique=True)
    await db.synced_days.create_index("date", unique=True)
    await db.rules.create_index("rule_id", unique=True)
    await db.rules.create_index("order")


async def save_session(session: dict) -> None:
    """Upsert a connected session (including its account uids)."""
    db = get_db()
    await db.sessions.update_one(
        {"session_id": session["session_id"]},
        {"$set": {**session, "connected_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def list_sessions() -> list[dict]:
    """Return all connected sessions (without Mongo's _id)."""
    db = get_db()
    return await db.sessions.find({}, {"_id": 0}).to_list(length=1000)


async def upsert_transaction(transaction_id: str, account_uid: str, txn: dict) -> None:
    """Upsert a single transaction (CREATE flow).

    Stores the raw EnableBanking payload verbatim under ``openbanking``.
    Identity keys (transaction_id, account_uid, synced_at) are set at the top
    level. The ``enrichment`` key is never touched here — the enrich flow owns
    it exclusively, so a re-sync can never clobber enrichment.
    """
    db = get_db()
    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {
            "$set": {
                "transaction_id": transaction_id,
                "account_uid": account_uid,
                "synced_at": datetime.now(timezone.utc),
                "openbanking": txn,
            }
        },
        upsert=True,
    )


async def bulk_upsert_transactions(
    rows: list[tuple[str, str, dict]],
) -> tuple[int, int, int]:
    """Bulk-upsert transactions in one round-trip.

    Args:
        rows: list of (transaction_id, account_uid, txn_dict) tuples.

    Returns (inserted, updated, matched_unchanged).
    """
    if not rows:
        return 0, 0, 0
    db = get_db()
    now = datetime.now(timezone.utc)
    ops = [
        UpdateOne(
            {"transaction_id": tid},
            {
                "$set": {
                    "transaction_id": tid,
                    "account_uid": account_uid,
                    "synced_at": now,
                    "openbanking": txn,
                }
            },
            upsert=True,
        )
        for tid, account_uid, txn in rows
    ]
    result = await db.transactions.bulk_write(ops, ordered=False)
    inserted = result.upserted_count
    updated = result.modified_count
    matched_unchanged = result.matched_count - result.modified_count
    return inserted, updated, max(matched_unchanged, 0)


async def set_enrichment(transaction_id: str, enrichment: dict) -> None:
    """Write enrichment for a single transaction (ENRICH flow).

    Only touches the ``enrichment`` key — never reads or writes ``openbanking``
    or identity fields. Safe to call from rules engine, AI job, or manual edits.
    """
    db = get_db()
    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"enrichment": {**enrichment, "enriched_at": datetime.now(timezone.utc)}}},
    )


async def bulk_set_enrichment(updates: list[tuple[str, dict]]) -> int:
    """Write enrichment for many transactions in one round-trip.

    Args:
        updates: list of (transaction_id, enrichment_dict) pairs.

    Returns the number of documents actually modified.
    """
    if not updates:
        return 0
    db = get_db()
    now = datetime.now(timezone.utc)
    ops = [
        UpdateOne(
            {"transaction_id": tid},
            {"$set": {"enrichment": {**enrichment, "enriched_at": now}}},
        )
        for tid, enrichment in updates
    ]
    result = await db.transactions.bulk_write(ops, ordered=False)
    return result.modified_count + result.upserted_count


async def iter_all_transactions(projection: dict | None = None) -> list[dict]:
    """Return all transactions for the enrichment engine.

    Default projection returns identity + openbanking fields needed by the
    classifier. Pass a custom projection to restrict fields.
    """
    db = get_db()
    proj = projection or {
        "_id": 0,
        "transaction_id": 1,
        "openbanking": 1,
    }
    return await db.transactions.find({}, proj).to_list(length=None)


async def mark_day_synced(date: str) -> None:
    """Record that a calendar day was fully synced."""
    db = get_db()
    await db.synced_days.update_one(
        {"date": date},
        {"$set": {"date": date, "synced_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def list_synced_days_range(start: str, end: str) -> set[str]:
    """Return the set of date strings (YYYY-MM-DD) that have been fully synced."""
    db = get_db()
    docs = await db.synced_days.find(
        {"date": {"$gte": start, "$lte": end}},
        {"_id": 0, "date": 1},
    ).to_list(length=None)
    return {doc["date"] for doc in docs}


async def monthly_transaction_summary() -> list[dict]:
    """Raw monthly aggregation (kept for debugging/comparison).

    Includes all transactions with no transfer/offset filtering.
    For clean dashboard data use monthly_summary_clean() instead.
    """
    db = get_db()
    pipeline = [
        {"$match": {"openbanking.booking_date": {"$exists": True, "$ne": None}}},
        {
            "$addFields": {
                "month": {"$substr": ["$openbanking.booking_date", 0, 7]},
                "amount_val": {
                    "$convert": {
                        "input": "$openbanking.transaction_amount.amount",
                        "to": "double",
                        "onError": 0.0,
                        "onNull": 0.0,
                    }
                },
            }
        },
        {
            "$group": {
                "_id": "$month",
                "credit": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$openbanking.credit_debit_indicator", "CRDT"]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                "debit": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$openbanking.credit_debit_indicator", "DBIT"]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    docs = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [
        {
            "month": doc["_id"],
            "credit": round(doc["credit"], 2),
            "debit": round(doc["debit"], 2),
            "net": round(doc["credit"] - doc["debit"], 2),
            "count": doc["count"],
        }
        for doc in docs
    ]


def _month_expr() -> dict:
    """Mongo expression to extract YYYY-MM from openbanking.booking_date."""
    return {"$substr": ["$openbanking.booking_date", 0, 7]}


def _amount_expr() -> dict:
    """Mongo expression to coerce enrichment.amount (with openbanking fallback) to double."""
    ob_amount = {
        "$convert": {
            "input": "$openbanking.transaction_amount.amount",
            "to": "double",
            "onError": 0.0,
            "onNull": 0.0,
        }
    }
    enrich_amount = {
        "$convert": {
            "input": "$enrichment.amount",
            "to": "double",
            "onError": 0.0,
            "onNull": 0.0,
        }
    }
    # Use enrichment.amount when available; fall back to raw openbanking field
    return {"$cond": [{"$gt": ["$enrichment.amount", None]}, enrich_amount, ob_amount]}


async def monthly_summary_clean() -> list[dict]:
    """Cleaned monthly aggregation for the dashboard.

      - income  = direction=="in", non-transfer, non-offset (salary etc.)
      - expense = direction=="out", non-transfer  MINUS  housing offset inflows
                  (roommate rent reduces the housing expense so net = rent − roommate)
      - net     = income − expense  (true monthly savings figure)
    """
    db = get_db()
    pipeline = [
        {"$match": {"openbanking.booking_date": {"$exists": True, "$ne": None}}},
        {
            "$addFields": {
                "month": _month_expr(),
                "amount_val": _amount_expr(),
                "is_transfer": {"$ifNull": ["$enrichment.is_transfer", False]},
                "direction": {
                    "$ifNull": [
                        "$enrichment.direction",
                        {
                            "$cond": [
                                {"$eq": ["$openbanking.credit_debit_indicator", "CRDT"]},
                                "in",
                                "out",
                            ]
                        },
                    ]
                },
                "is_offset": {
                    "$eq": [{"$ifNull": ["$enrichment.offsets", None]}, "housing"]
                },
            }
        },
        # Exclude only transfers; keep offsets so we can net them against expenses
        {"$match": {"is_transfer": False, "month": {"$gt": ""}}},
        {
            "$group": {
                "_id": "$month",
                # Clean income: inflows that are not housing offsets
                "credit": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$direction", "in"]},
                                {"$eq": ["$is_offset", False]},
                            ]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                # Gross outflows
                "gross_debit": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "out"]}, "$amount_val", 0]
                    }
                },
                # Housing offset inflows (e.g. roommate rent) — netted against expenses
                "offset_credit": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$direction", "in"]},
                                {"$eq": ["$is_offset", True]},
                            ]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    docs = await db.transactions.aggregate(pipeline).to_list(length=None)
    return [
        {
            "month": doc["_id"],
            "credit": round(doc["credit"], 2),
            # Net expenses = gross outflows − housing offset inflows
            "debit": round(doc["gross_debit"] - doc["offset_credit"], 2),
            "net": round(doc["credit"] - (doc["gross_debit"] - doc["offset_credit"]), 2),
            "count": doc["count"],
        }
        for doc in docs
    ]


async def category_breakdown(month: str | None = None) -> list[dict]:
    """Per-month per-category breakdown excluding internal transfers.

    Housing offsets are folded into the housing category so it shows
    as a net figure (outflows - roommate inflow).
    """
    db = get_db()
    match: dict = {"openbanking.booking_date": {"$exists": True, "$ne": None}}
    if month:
        match["openbanking.booking_date"] = {
            "$regex": f"^{month}",
            "$exists": True,
        }

    pipeline = [
        {"$match": match},
        {
            "$addFields": {
                "month": _month_expr(),
                "amount_val": _amount_expr(),
                "is_transfer": {"$ifNull": ["$enrichment.is_transfer", False]},
                "category": {"$ifNull": ["$enrichment.category", "uncategorized"]},
                "direction": {"$ifNull": ["$enrichment.direction", None]},
                "offsets": {"$ifNull": ["$enrichment.offsets", None]},
            }
        },
        {"$match": {"is_transfer": False, "month": {"$ne": ""}}},
        {
            "$group": {
                "_id": {"month": "$month", "category": "$category"},
                # outflows (positive = money leaving)
                "debit": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "out"]}, "$amount_val", 0]
                    }
                },
                # regular inflows — salary, other income (no offsets key)
                "credit": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$direction", "in"]},
                                {"$eq": ["$offsets", None]},
                            ]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                # inflows that offset a category (e.g. roommate rent payment)
                "offset_credit": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$direction", "in"]},
                                {"$ne": ["$offsets", None]},
                            ]},
                            "$amount_val",
                            0,
                        ]
                    }
                },
                "count": {"$sum": 1},
            }
        },
        {
            "$project": {
                "_id": 0,
                "month": "$_id.month",
                "category": "$_id.category",
                "debit": {"$round": ["$debit", 2]},
                "credit": {"$round": ["$credit", 2]},
                "offset_credit": {"$round": ["$offset_credit", 2]},
                # For expense categories: net = outflows − offset inflows (e.g. housing net)
                # For income categories: net = credit (regular inflows)
                "net": {
                    "$round": [
                        {
                            "$cond": [
                                {"$gt": ["$credit", 0]},
                                "$credit",
                                {"$subtract": ["$debit", "$offset_credit"]},
                            ]
                        },
                        2,
                    ]
                },
                "count": 1,
            }
        },
        {"$sort": {"month": 1, "net": -1}},
    ]
    return await db.transactions.aggregate(pipeline).to_list(length=None)


async def transactions_by_category(month: str) -> list[dict]:
    """All transactions with enrichment for the detail view, sorted by amount desc.

    month must be YYYY-MM — full-collection scans are intentionally disallowed.
    """
    db = get_db()
    match: dict = {"openbanking.booking_date": {"$regex": f"^{month}"}}
    pipeline = [
        {"$match": match},
        {
            "$addFields": {
                "amount_val": _amount_expr(),
                "category": {"$ifNull": ["$enrichment.category", "uncategorized"]},
                "direction": {"$ifNull": ["$enrichment.direction", "out"]},
                "counterparty": {"$ifNull": ["$enrichment.counterparty", None]},
                "is_transfer": {"$ifNull": ["$enrichment.is_transfer", False]},
                "is_recurring": {"$ifNull": ["$enrichment.is_recurring", False]},
            }
        },
        {"$sort": {"amount_val": -1}},
        {
            "$project": {
                "_id": 0,
                "transaction_id": 1,
                "date": "$openbanking.booking_date",
                "amount": "$amount_val",
                "direction": 1,
                "category": 1,
                "counterparty": 1,
                "is_transfer": 1,
                "is_recurring": 1,
                "description": {
                    "$arrayElemAt": ["$openbanking.remittance_information", 0]
                },
            }
        },
    ]
    return await db.transactions.aggregate(pipeline).to_list(length=None)


async def get_uncategorized_transactions() -> list[dict]:
    """Grouped summary of transactions with enrichment.category == 'uncategorized'.

    Returns rows sorted by total descending so the biggest offenders surface first.
    """
    db = get_db()
    pipeline = [
        {"$match": {"enrichment.category": "uncategorized"}},
        {
            "$group": {
                "_id": "$enrichment.counterparty",
                "total": {"$sum": "$enrichment.amount"},
                "count": {"$sum": 1},
                "months": {"$addToSet": {"$substr": ["$openbanking.booking_date", 0, 7]}},
                "sample_remittance": {
                    "$first": {
                        "$arrayElemAt": ["$openbanking.remittance_information", 0]
                    }
                },
            }
        },
        {"$sort": {"total": -1}},
    ]
    return await db.transactions.aggregate(pipeline).to_list(length=None)


async def savings_tracker() -> dict:
    """Savings flow: deposits, withdrawals, round-ups, and savings rate per month."""
    db = get_db()

    # --- savings transfers per month ---
    savings_pipeline = [
        {
            "$match": {
                "openbanking.booking_date": {"$exists": True, "$ne": None},
                "enrichment.is_transfer": True,
            }
        },
        {
            "$addFields": {
                "month": _month_expr(),
                "amount_val": _amount_expr(),
                "direction": {"$ifNull": ["$enrichment.direction", None]},
                "is_roundup": {"$ifNull": ["$enrichment.is_roundup", False]},
            }
        },
        {
            "$group": {
                "_id": "$month",
                "deposits": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "out"]}, "$amount_val", 0]
                    }
                },
                "withdrawals": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "in"]}, "$amount_val", 0]
                    }
                },
                "roundup_total": {
                    "$sum": {
                        "$cond": ["$is_roundup", "$amount_val", 0]
                    }
                },
                "roundup_count": {
                    "$sum": {"$cond": ["$is_roundup", 1, 0]}
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]
    savings_docs = await db.transactions.aggregate(savings_pipeline).to_list(length=None)

    # --- clean income per month (for savings rate) ---
    income_pipeline = [
        {
            "$match": {
                "openbanking.booking_date": {"$exists": True, "$ne": None},
                "enrichment.is_transfer": {"$ne": True},
                "enrichment.offsets": {"$exists": False},
                "enrichment.direction": "in",
            }
        },
        {
            "$addFields": {
                "month": _month_expr(),
                "amount_val": _amount_expr(),
            }
        },
        {
            "$group": {
                "_id": "$month",
                "income": {"$sum": "$amount_val"},
            }
        },
    ]
    income_docs = await db.transactions.aggregate(income_pipeline).to_list(length=None)
    income_by_month = {d["_id"]: d["income"] for d in income_docs}

    # Build trend with cumulative deposits (always positive, motivating) + rates
    trend = []
    cumulative_deposits = 0.0   # total moved TO savings — never decreases
    roundups_by_month = []
    roundup_grand_total = 0.0
    total_withdrawals = 0.0

    for doc in savings_docs:
        m = doc["_id"]
        deposits = round(doc["deposits"], 2)
        withdrawals = round(doc["withdrawals"], 2)
        net_saved = round(deposits - withdrawals, 2)
        # Cumulative deposits only: shows savings building up, never undercut by
        # ad-hoc withdrawals that would push the line to zero or negative.
        cumulative_deposits = round(cumulative_deposits + deposits, 2)
        total_withdrawals = round(total_withdrawals + withdrawals, 2)
        income = income_by_month.get(m, 0.0)
        savings_rate = round(deposits / income, 4) if income > 0 else None

        trend.append({
            "month": m,
            "deposits": deposits,
            "withdrawals": withdrawals,
            "net_saved": net_saved,
            "cumulative_deposits": cumulative_deposits,
            "savings_rate": savings_rate,
        })
        roundups_by_month.append({
            "month": m,
            "total": round(doc["roundup_total"], 2),
            "count": doc["roundup_count"],
        })
        roundup_grand_total += doc["roundup_total"]

    return {
        "trend": trend,
        "roundups": roundups_by_month,
        "roundup_grand_total": round(roundup_grand_total, 2),
        "total_deposited": cumulative_deposits,
        "total_withdrawn": total_withdrawals,
    }


async def recurring_subscriptions() -> dict:
    """Recurring non-transfer outgoing payments grouped by counterparty."""
    db = get_db()
    pipeline = [
        {
            "$match": {
                "openbanking.booking_date": {"$exists": True, "$ne": None},
                "enrichment.is_recurring": True,
                "enrichment.is_transfer": {"$ne": True},
                "enrichment.direction": "out",
            }
        },
        {
            "$addFields": {
                "month": _month_expr(),
                "amount_val": _amount_expr(),
                "counterparty": {"$ifNull": ["$enrichment.counterparty", "unknown"]},
                "category": {"$ifNull": ["$enrichment.category", "uncategorized"]},
            }
        },
        {
            "$group": {
                "_id": {"counterparty": "$counterparty", "category": "$category"},
                "total": {"$sum": "$amount_val"},
                "count": {"$sum": 1},
                "months_seen": {"$addToSet": "$month"},
                "last_date": {"$max": "$openbanking.booking_date"},
                "last_amount": {"$last": "$amount_val"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "counterparty": "$_id.counterparty",
                "category": "$_id.category",
                "total": {"$round": ["$total", 2]},
                "count": 1,
                "months_seen": {"$size": "$months_seen"},
                "last_date": 1,
                "last_amount": {"$round": ["$last_amount", 2]},
                "avg_amount": {
                    "$round": [
                        {"$divide": ["$total", {"$size": "$months_seen"}]},
                        2,
                    ]
                },
            }
        },
        {"$sort": {"avg_amount": -1}},
    ]
    items = await db.transactions.aggregate(pipeline).to_list(length=None)
    monthly_total = round(sum(i["avg_amount"] for i in items), 2)
    return {
        "items": items,
        "monthly_total": monthly_total,
        "annualized_total": round(monthly_total * 12, 2),
    }


# ---------------------------------------------------------------------------
# Rules CRUD
# ---------------------------------------------------------------------------

async def list_rule_docs(include_disabled: bool = True) -> list[dict]:
    """Return all rule documents sorted by order ascending."""
    db = get_db()
    query: dict = {} if include_disabled else {"enabled": True}
    return await db.rules.find(query, {"_id": 0}).sort("order", 1).to_list(length=None)


async def get_rules_for_engine():
    """Return enabled rules as pure Rule dataclass objects, sorted by order."""
    from .rules import rule_from_doc
    docs = await list_rule_docs(include_disabled=False)
    return [rule_from_doc(doc) for doc in docs]


async def create_rule(doc: dict) -> dict:
    """Insert a new rule. Assigns order=max+1000 if not provided.

    Raises ValueError on duplicate rule_id.
    """
    from .models import RuleDoc
    from pymongo.errors import DuplicateKeyError
    validated = RuleDoc(**doc)
    db = get_db()
    now = datetime.now(timezone.utc)

    order = doc.get("order")
    if order is None:
        max_doc = await db.rules.find_one({}, {"order": 1}, sort=[("order", -1)])
        order = (max_doc["order"] + 1000) if max_doc else 1000

    insert_doc = {
        **validated.model_dump(exclude={"created_at", "updated_at", "order"}),
        "order": order,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db.rules.insert_one(insert_doc)
    except DuplicateKeyError:
        raise ValueError(f"Rule '{validated.rule_id}' already exists")
    return await db.rules.find_one({"rule_id": validated.rule_id}, {"_id": 0})


async def update_rule(rule_id: str, patch: dict) -> dict | None:
    """Patch an existing rule by rule_id. Returns the updated doc or None if not found."""
    db = get_db()
    patch = {k: v for k, v in patch.items() if k not in ("_id", "rule_id")}
    patch["updated_at"] = datetime.now(timezone.utc)
    result = await db.rules.update_one({"rule_id": rule_id}, {"$set": patch})
    if result.matched_count == 0:
        return None
    return await db.rules.find_one({"rule_id": rule_id}, {"_id": 0})


async def delete_rule(rule_id: str) -> bool:
    """Delete a rule by rule_id. Returns True if it existed."""
    db = get_db()
    result = await db.rules.delete_one({"rule_id": rule_id})
    return result.deleted_count == 1


async def reorder_rules(ordered_rule_ids: list[str]) -> int:
    """Renumber rules to order=(idx+1)*1000 based on the given id sequence."""
    if not ordered_rule_ids:
        return 0
    db = get_db()
    now = datetime.now(timezone.utc)
    ops = [
        UpdateOne(
            {"rule_id": rule_id},
            {"$set": {"order": (idx + 1) * 1000, "updated_at": now}},
        )
        for idx, rule_id in enumerate(ordered_rule_ids)
    ]
    result = await db.rules.bulk_write(ops, ordered=False)
    return result.modified_count
