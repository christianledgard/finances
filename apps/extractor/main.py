"""EnableBanking (ING NL) extractor — pulls daily bank movements into MongoDB.

Read-only by design: uses the AIS service only. The `access` scope below requests
balances + transactions and nothing that could move money. For the strongest
guarantee, register the application as AIS-only in the EnableBanking console.
"""
import asyncio
import os
import secrets
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Security, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.security import APIKeyHeader

from finances_db import (
    bulk_set_enrichment,
    bulk_upsert_transactions,
    category_breakdown,
    create_rule,
    delete_rule,
    enrich_all_from_db,
    ensure_indexes,
    get_uncategorized_transactions,
    is_admin_user,
    iter_all_transactions,
    list_rule_docs,
    list_sessions,
    list_synced_days_range,
    mark_day_synced,
    monthly_summary_clean,
    monthly_transaction_summary,
    recurring_subscriptions,
    reorder_rules,
    save_session,
    savings_tracker,
    transactions_by_category,
    transactions_raw_for_month,
    update_rule,
    upsert_transaction,
)
from finances_db.repository import _require_rule_predicates
from finances_db.amex_csv import AMEX_ACCOUNT_UID, parse_amex_csv
from pydantic import BaseModel as PydanticBaseModel

load_dotenv()

APP_ID = os.environ["ENABLE_BANKING_APP_ID"]
PRIVATE_KEY = os.environ["ENABLE_BANKING_PRIVATE_KEY"]  # RS256 PEM string
REDIRECT_URI = os.environ.get("REDIRECT_URI", "http://localhost:8000/callback")

BASE_URL = "https://api.enablebanking.com"
CATCHUP_START = os.environ.get("CATCHUP_START", "2026-01-01")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "")

# M2M API key for internal service-to-service calls (web → extractor).
# When unset the endpoint is open (handy for local dev without a web app).
_API_KEY = os.environ.get("API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def _require_api_key(key: str | None = Security(_api_key_header)) -> None:
    if _API_KEY and key != _API_KEY:
        raise HTTPException(401, detail="Invalid or missing API key")

# Per-request CSRF state tokens (in-memory; lost on restart, which is fine here).
_pending_states: dict[str, str] = {}


@dataclass
class SyncJob:
    status: str  # "running" | "done" | "failed"
    total_days: int
    processed: int = 0
    saved: int = 0
    current_day: str | None = None
    synced_dates: list[str] = field(default_factory=list)
    failed_dates: list[str] = field(default_factory=list)
    error: str | None = None


_sync_jobs: dict[str, SyncJob] = {}


def _date_range(start: str, end: str) -> list[str]:
    """Return every YYYY-MM-DD string in [start, end] inclusive."""
    days: list[str] = []
    d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    while d <= end_d:
        days.append(d.isoformat())
        d += timedelta(days=1)
    return days


async def _sync_day(
    client: httpx.AsyncClient, sessions: list[dict], day: str
) -> tuple[int, bool]:
    """Sync all accounts for a single calendar day.

    Returns (saved_count, all_succeeded). all_succeeded is False when any
    account call failed so the caller knows not to mark the day as done.
    """
    saved = 0
    all_ok = True
    for session in sessions:
        for account in session.get("accounts", []):
            uid = account.get("uid")
            if not uid:
                continue
            resp = await client.get(
                f"{BASE_URL}/accounts/{uid}/transactions",
                params={"date_from": day, "date_to": day},
                headers=_auth_headers(),
            )
            if resp.status_code != 200:
                all_ok = False
                continue
            for txn in resp.json().get("transactions", []):
                txn_id = txn.get("transaction_id") or txn.get("entry_reference")
                if not txn_id:
                    continue
                await upsert_transaction(txn_id, uid, txn)
                saved += 1
    return saved, all_ok


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    yield


app = FastAPI(title="ING Finances Extractor", lifespan=lifespan)


def _auth_headers() -> dict:
    """Sign a short-lived JWT with our private key (EnableBanking auth scheme)."""
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": now,
            "exp": now + 3600,
        },
        PRIVATE_KEY,
        algorithm="RS256",
        headers={"kid": APP_ID},
    )
    return {"Authorization": f"Bearer {token}"}


async def _ing_max_validity(client: httpx.AsyncClient) -> timedelta:
    """Ask ING (via EnableBanking) for its maximum consent window."""
    resp = await client.get(
        f"{BASE_URL}/aspsps", params={"country": "NL"}, headers=_auth_headers()
    )
    resp.raise_for_status()
    ing = next(a for a in resp.json()["aspsps"] if a["name"] == "ING")
    # Small margin so we never exceed now + max at the server.
    return timedelta(seconds=ing["maximum_consent_validity"] - 60)


@app.get("/privacy", response_class=HTMLResponse)
async def privacy():
    contact = (
        f'<p>Contact: <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p>'
        if CONTACT_EMAIL
        else ""
    )
    return f"""<!doctype html><html><head><meta charset=utf-8>
<title>Privacy Policy</title></head><body>
<h1>Privacy Policy</h1>
<p>This is a personal, private application used solely by its owner to access
their own bank account data via the EnableBanking API.</p>
<ul>
  <li>No personal data is collected from third parties.</li>
  <li>Bank account data is stored privately in a personal database and is never
      shared, sold, or disclosed to any third party.</li>
  <li>Access tokens are stored only for the duration required to fetch
      transaction data.</li>
  <li>All data is accessed read-only; no payments or account modifications are
      made.</li>
</ul>
{contact}
</body></html>"""


@app.get("/terms", response_class=HTMLResponse)
async def terms():
    contact = (
        f'<p>Contact: <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></p>'
        if CONTACT_EMAIL
        else ""
    )
    return f"""<!doctype html><html><head><meta charset=utf-8>
<title>Terms of Service</title></head><body>
<h1>Terms of Service</h1>
<p>This application is a private tool for personal use only. It is not a
commercial product and is not available to the public.</p>
<ul>
  <li>Access is restricted to the owner of this application.</li>
  <li>The application connects to ING (NL) via the EnableBanking API under the
      owner&rsquo;s own credentials.</li>
  <li>No warranties are provided. Use is entirely at your own risk.</li>
</ul>
{contact}
</body></html>"""


@app.get("/connect")
async def connect():
    """Start ING authorization. Returns the URL to open in a browser."""
    state = secrets.token_urlsafe(16)
    _pending_states[state] = datetime.now(timezone.utc).isoformat()

    async with httpx.AsyncClient() as client:
        valid_until = datetime.now(timezone.utc) + await _ing_max_validity(client)
        resp = await client.post(
            f"{BASE_URL}/auth",
            json={
                "aspsp": {"name": "ING", "country": "NL"},
                "state": state,
                "redirect_url": REDIRECT_URI,
                "psu_type": "personal",
                "access": {
                    # Read-only AIS scope, nothing that can initiate payments.
                    "balances": True,
                    "transactions": True,
                    "valid_until": valid_until.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                },
            },
            headers=_auth_headers(),
        )
        resp.raise_for_status()

    return {"auth_url": resp.json()["url"]}


@app.get("/callback")
async def callback(
    code: str | None = None, state: str | None = None, error: str | None = None
):
    """EnableBanking redirects here after ING authorization."""
    if error:
        raise HTTPException(400, detail=error)
    if not code or not state or state not in _pending_states:
        raise HTTPException(400, detail="Invalid or missing code/state")

    del _pending_states[state]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/sessions", json={"code": code}, headers=_auth_headers()
        )
        resp.raise_for_status()

    session = resp.json()
    await save_session(session)

    return {
        "status": "connected",
        "session_id": session["session_id"],
        "accounts": len(session.get("accounts", [])),
    }


async def _run_sync(job: SyncJob, sessions: list[dict], days: list[str], today: str) -> None:
    try:
        async with httpx.AsyncClient() as client:
            for day in days:
                job.current_day = day
                saved, all_ok = await _sync_day(client, sessions, day)
                job.saved += saved
                job.processed += 1
                if all_ok and day != today:
                    await mark_day_synced(day)
                    job.synced_dates.append(day)
                elif all_ok:
                    job.synced_dates.append(day)
                else:
                    job.failed_dates.append(day)
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        return
    job.status = "done"
    job.current_day = None


@app.post("/sync")
async def sync(date_from: str | None = None, date_to: str | None = None):
    """Fire-and-forget sync. Returns a job_id immediately; poll GET /sync/{job_id}.

    No params — smart catchup: finds every unsynced day from CATCHUP_START up
    to today and syncs them in order.  A day is only marked done when ALL
    account calls for that day succeeded, so gaps caused by auth failures are
    automatically retried on the next run.  Today is never marked as synced so
    it is always re-fetched on the next call (today's transactions are still
    arriving; duplicates are harmless because upsert is idempotent).

    With explicit date_from / date_to — syncs that exact range (clamped to
    today at most).
    """
    running = [jid for jid, j in _sync_jobs.items() if j.status == "running"]
    if running:
        raise HTTPException(409, detail={"message": "A sync is already running", "job_id": running[0]})

    sessions = await list_sessions()
    if not sessions:
        raise HTTPException(404, detail="No connected sessions — visit /connect first")

    today = datetime.now(timezone.utc).date().isoformat()

    if date_from is None and date_to is None:
        already_synced = await list_synced_days_range(CATCHUP_START, today)
        # today is never in already_synced (we never mark it done), so it's
        # always included naturally — no need to force-append it.
        days = [d for d in _date_range(CATCHUP_START, today) if d not in already_synced]
    else:
        effective_from = date_from or today
        effective_to = min(date_to or today, today)
        days = _date_range(effective_from, effective_to)

    job_id = secrets.token_urlsafe(8)
    job = SyncJob(status="running", total_days=len(days))
    _sync_jobs[job_id] = job
    asyncio.create_task(_run_sync(job, sessions, days, today))

    return {"job_id": job_id, "status": "running", "total_days": len(days)}


@app.get("/sync/{job_id}")
async def sync_status(job_id: str):
    """Poll the status of a background sync job."""
    job = _sync_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="Unknown job_id")
    return {
        "job_id": job_id,
        "status": job.status,
        "total_days": job.total_days,
        "processed": job.processed,
        "current_day": job.current_day,
        "saved": job.saved,
        "synced_dates": job.synced_dates,
        "failed_dates": job.failed_dates,
        "error": job.error,
    }


@app.post("/enrich", dependencies=[Depends(_require_api_key)])
async def reenrich():
    """Re-run the deterministic rule engine over all transactions.

    Reads rules from MongoDB (via enrich_all_from_db).  Idempotent — safe to
    call any time rules change.
    """
    txns = await iter_all_transactions()
    updates = await enrich_all_from_db(txns)
    modified = await bulk_set_enrichment(updates)
    return {"processed": len(txns), "enriched": modified}


@app.get("/auth/admin", dependencies=[Depends(_require_api_key)])
async def check_admin(email: str):
    """M2M admin check for the MCP service (Better Auth user.role == admin)."""
    if not email.strip():
        raise HTTPException(400, detail="email is required")
    return {"is_admin": await is_admin_user(email)}


@app.get("/transactions/monthly", dependencies=[Depends(_require_api_key)])
async def transactions_monthly(raw: bool = False):
    """Monthly aggregates for the dashboard.

    Default: cleaned numbers (transfers excluded, housing offsets netted).
    Pass ?raw=true to get the original unfiltered aggregation for debugging.
    """
    if raw:
        months = await monthly_transaction_summary()
    else:
        months = await monthly_summary_clean()
    return {"months": months}


@app.get("/transactions/categories", dependencies=[Depends(_require_api_key)])
async def transactions_categories(month: str | None = None):
    """Per-category breakdown, optionally filtered to a single YYYY-MM month."""
    rows = await category_breakdown(month=month)
    return {"categories": rows}


@app.get("/transactions/detail", dependencies=[Depends(_require_api_key)])
async def transactions_detail(month: str):
    """All transactions with enrichment, sorted by amount desc, for the detail view.

    ?month=YYYY-MM is required — full-collection scans are intentionally disallowed.
    """
    rows = await transactions_by_category(month=month)
    return {"transactions": rows}


@app.get("/savings", dependencies=[Depends(_require_api_key)])
async def get_savings():
    """Savings tracker: monthly deposits/withdrawals, round-up totals, savings rates."""
    data = await savings_tracker()
    return data


@app.get("/subscriptions", dependencies=[Depends(_require_api_key)])
async def get_subscriptions():
    """Recurring non-transfer outgoing payments with monthly averages."""
    data = await recurring_subscriptions()
    return data


# ---------------------------------------------------------------------------
# Rules CRUD endpoints
# ---------------------------------------------------------------------------

class RuleCreate(PydanticBaseModel):
    rule_id: str
    category: str
    subcategory: str | None = None
    is_transfer: bool = False
    is_roundup: bool = False
    offsets: str | None = None
    counterparty_contains: list[str] = []
    remittance_contains: list[str] = []
    btc_contains: list[str] = []
    indicator: str | None = None
    enabled: bool = True
    order: int | None = None


class RuleUpdate(PydanticBaseModel):
    category: str | None = None
    subcategory: str | None = None
    is_transfer: bool | None = None
    is_roundup: bool | None = None
    offsets: str | None = None
    counterparty_contains: list[str] | None = None
    remittance_contains: list[str] | None = None
    btc_contains: list[str] | None = None
    indicator: str | None = None
    enabled: bool | None = None
    order: int | None = None


class ReorderBody(PydanticBaseModel):
    ordered_rule_ids: list[str]


@app.get("/rules", dependencies=[Depends(_require_api_key)])
async def get_rules():
    """List all enrichment rules ordered by priority."""
    rules = await list_rule_docs(include_disabled=True)
    return {"rules": rules}


@app.post("/rules", dependencies=[Depends(_require_api_key)], status_code=201)
async def add_rule(body: RuleCreate):
    """Create a new enrichment rule."""
    try:
        rule = await create_rule(body.model_dump())
    except ValueError as exc:
        raise HTTPException(409, detail=str(exc))
    return {"rule": rule}


@app.put("/rules/{rule_id}", dependencies=[Depends(_require_api_key)])
async def edit_rule(rule_id: str, body: RuleUpdate):
    """Update an existing rule (partial update)."""
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        rule = await update_rule(rule_id, patch)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))
    if rule is None:
        raise HTTPException(404, detail=f"Rule '{rule_id}' not found")
    return {"rule": rule}


@app.delete("/rules/{rule_id}", dependencies=[Depends(_require_api_key)])
async def remove_rule(rule_id: str):
    """Delete an enrichment rule."""
    deleted = await delete_rule(rule_id)
    if not deleted:
        raise HTTPException(404, detail=f"Rule '{rule_id}' not found")
    return {"deleted": True}


@app.post("/rules/reorder", dependencies=[Depends(_require_api_key)])
async def reorder(body: ReorderBody):
    """Reorder rules by providing the full ordered list of rule_ids."""
    n = await reorder_rules(body.ordered_rule_ids)
    return {"reordered": n}


class RulePreviewBody(PydanticBaseModel):
    month: str                              # required YYYY-MM
    counterparty_contains: list[str] = []
    remittance_contains: list[str] = []
    btc_contains: list[str] = []
    indicator: str | None = None


@app.post("/rules/preview", dependencies=[Depends(_require_api_key)])
async def preview_rule(body: RulePreviewBody):
    """Dry-run a draft rule against one month of transactions. Nothing is persisted.

    Returns the transactions that would be matched — use this to validate predicates
    before calling POST /rules to create the real rule.
    """
    from finances_db.rules import Rule, _counterparty, _amount, _direction

    try:
        _require_rule_predicates(body.model_dump())
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    rule = Rule(
        rule_id="__preview__",
        category="preview",
        counterparty_contains=tuple(body.counterparty_contains),
        remittance_contains=tuple(body.remittance_contains),
        btc_contains=tuple(body.btc_contains),
        indicator=body.indicator,
    )

    txns = await transactions_raw_for_month(body.month)
    matches = []
    for txn in txns:
        if rule.matches(txn):
            matches.append({
                "transaction_id": txn.get("transaction_id"),
                "date": (txn.get("openbanking") or {}).get("booking_date"),
                "amount": _amount(txn),
                "direction": _direction(txn),
                "counterparty": _counterparty(txn),
            })

    return {
        "month": body.month,
        "matched_count": len(matches),
        "total_in_month": len(txns),
        "matches": matches,
    }


@app.get("/transactions/uncategorized", dependencies=[Depends(_require_api_key)])
async def uncategorized_transactions():
    """Grouped summary of uncategorized transactions for the rules admin UI."""
    rows = await get_uncategorized_transactions()
    items = [
        {
            "counterparty": r["_id"],
            "total": round(r["total"], 2),
            "count": r["count"],
            "months": sorted(r.get("months") or []),
            "sample_remittance": r.get("sample_remittance"),
        }
        for r in rows
    ]
    return {"items": items}


@app.post("/import/csv/amex", dependencies=[Depends(_require_api_key)])
async def import_amex_csv(file: UploadFile = File(...)):
    """Import AMEX NL CSV transactions.

    Accepts multipart/form-data with a single file field named 'file'.
    Idempotent: uploading the same CSV twice produces no duplicate documents.

    Call POST /enrich afterwards to classify the imported transactions.
    """
    raw = (await file.read()).decode("utf-8-sig")
    try:
        parsed = parse_amex_csv(raw)
    except Exception as exc:
        raise HTTPException(400, detail=f"CSV parse error: {exc}")

    if not parsed:
        return {"inserted": 0, "updated": 0, "skipped_duplicate": 0, "total_rows": 0}

    seen: set[str] = set()
    rows: list[tuple[str, str, dict]] = []
    skipped = 0
    for item in parsed:
        tid = item["transaction_id"]
        if tid in seen:
            skipped += 1
            continue
        seen.add(tid)
        rows.append((tid, AMEX_ACCOUNT_UID, item["openbanking"]))

    inserted, updated, _ = await bulk_upsert_transactions(rows)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_duplicate": skipped,
        "total_rows": len(parsed),
        "note": "Call POST /enrich to classify the imported transactions.",
    }
