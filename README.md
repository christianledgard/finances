# finances

pnpm monorepo for personal finances. Pulls **ING NL** transactions via
[EnableBanking](https://enablebanking.com) (read-only AIS) and **AMEX NL**
transactions via CSV upload — both land in **MongoDB**, get classified by
rule-based enrichment, and show up in a **Next.js dashboard**.

## Layout

```
finances/
├─ apps/
│  ├─ extractor/        # Python/FastAPI — ING sync, AMEX import, enrichment API (:8000)
│  ├─ scheduler/        # Python one-shot — POSTs /sync (for external cron)
│  ├─ mcp/               # FastMCP + Google OAuth — AI read-only tools (:9000)
│  └─ web/              # Next.js 16 dashboard (:3000)
├─ packages/
│  └─ db/               # finances_db — MongoDB layer, rules, AMEX CSV parser
├─ docker-compose.yml   # mongo + extractor (scheduler opt-in via profile)
└─ pnpm-workspace.yaml
```

## Data sources

### ING (automatic)

Read-only via EnableBanking. No ING password is stored — only a session handle
after you authorize in the ING app.

1. `GET /connect` → open the returned `auth_url` in a browser.
2. ING redirects to `GET /callback` → session + account IDs saved to Mongo.
3. `POST /sync` → fetches transactions day-by-day from EnableBanking and upserts
   them. With no date params it catches up from `CATCHUP_START` (default
   `2026-01-01`) to today; already-synced days are skipped (today is always
   re-fetched).
4. Run `apps/scheduler` on a cron (e.g. daily) to POST `/sync` automatically.

Each transaction is stored as `{ transaction_id, account_uid, openbanking }`.
The raw EnableBanking payload lives under `openbanking` and is never modified
after sync.

### AMEX (manual CSV)

AMEX has no API here. Export a CSV from the AMEX NL site and upload it:

```bash
curl -X POST http://localhost:8000/import/csv/amex \
  -H "X-API-Key: $API_KEY" \
  -F "file=@amex-export.csv"
```

The parser reads Dutch columns (Datum, Bedrag, Omschrijving, Referentie) and
maps them into the same `openbanking` shape as ING so aggregations and rules
work unchanged. Rows are stored under account `amex_csv`. Uploading the same
file twice is safe — `Referentie` is the idempotency key.

### Enrichment (both sources)

After ING sync or AMEX import, run:

```bash
curl -X POST http://localhost:8000/enrich -H "X-API-Key: $API_KEY"
```

Rule-based classification writes an `enrichment` block (category, transfers,
etc.). ING payments to AMEX and AMEX “bedankt voor uw betaling” credits are
marked as transfers so card spend isn't double-counted with the bank payment.

## Local dev

```bash
pnpm install:py                                    # uv sync in Python apps

cp apps/extractor/.env.example apps/extractor/.env
cp apps/web/.env.example apps/web/.env.local       # Google OAuth + API keys

pnpm dev                                           # mprocs TUI: extractor :8000 + web :3000 + mcp :9000
```

MongoDB must be running (`docker compose up mongo -d` or a local install).
`API_KEY` in `apps/extractor/.env` must match `EXTRACTOR_API_KEY` in the web
app. Dashboard access requires `role: "admin"` on your user doc in MongoDB.

Optional CLI (from repo root, after `install:py`):

```bash
uv run finances-enrich        # same as POST /enrich
```

## Docker

```bash
cp apps/extractor/.env.example apps/extractor/.env
pnpm docker:up                 # mongo + extractor

docker compose --profile tools run --rm scheduler   # one-off /sync trigger
```

Set `EXTRACTOR_URL` when running the scheduler outside compose (see
`apps/scheduler/.env.example`).

## Safety

- **Read-only (ING)**: uses EnableBanking's AIS service only. The requested
  `access` scope is `balances` + `transactions` — nothing that can move money.
  For the strongest guarantee, register the app as **AIS-only** in the
  EnableBanking console.
- No ING credentials are ever stored — only an account-scoped session handle.
- Consent auto-expires (ING's `maximum_consent_validity`); re-run `/connect` after.
- AMEX data comes from files you upload yourself — nothing is fetched from AMEX automatically.
- Keep `ENABLE_BANKING_PRIVATE_KEY` out of git (`.gitignore` covers `.env`/`*.pem`).

## Chat with your finances (MCP)

`apps/mcp` is a **remote, read-only** MCP server secured with **Google OAuth +
MongoDB admin role check** (same `role: "admin"` gate as the web dashboard,
via `GET /auth/admin` on the extractor). Claude connects over HTTPS; the MCP
service calls the extractor over HTTP with its own `X-API-Key` (your Google
token is never forwarded). The MCP service has **no direct MongoDB access**.

### Layout addition

```
apps/mcp/   # FastMCP + Google OAuth — AI-facing read-only tools (:9000)
```

### Google OAuth client

Create a separate OAuth 2.0 **Web application** client in Google Cloud Console
(do not reuse the dashboard client):

- Authorized JavaScript origins: `http://localhost:9000` (dev) and your production MCP URL
- Authorized redirect URI: `http://localhost:9000/auth/callback` (dev) and `https://<mcp-domain>/auth/callback` (prod)

### Local dev

```bash
cp apps/mcp/.env.example apps/mcp/.env   # fill Google creds, EXTRACTOR_API_KEY, JWT_SIGNING_KEY

pnpm install:py
pnpm mcp dev                             # http://localhost:9000
```

The extractor must be running (`pnpm dev` or docker compose).

### Connect in Claude

```bash
# Claude Code (after deploy)
claude mcp add --transport http finances https://<mcp-domain>/mcp
```

Claude.ai / Desktop: add a custom connector with the same URL. Sign in with Google;
only users with `role: "admin"` in the Better Auth `user` collection are authorized
(same as the web dashboard — set via `db.user.updateOne({email}, {$set: {role:"admin"}})`).

### Railway deploy

Deploy `apps/mcp` as its own service using `apps/mcp/Dockerfile`. Set:

| Variable | Example |
|---|---|
| `PUBLIC_URL` | `https://finances-mcp.your-domain.com` |
| `EXTRACTOR_URL` | `http://extractor.railway.internal:8000` |
| `EXTRACTOR_API_KEY` | same as extractor `API_KEY` |
| `JWT_SIGNING_KEY` | random 32+ byte secret |

### Security notes

- Read-only tools only (GET endpoints); no sync, rules, or imports.
- Admin role check in MongoDB — Google OAuth alone is not enough.
- Transaction counterparty/description fields are untrusted text (prompt-injection aware).
- Financial data is sent to Claude/Anthropic when you chat — by design for analysis.
