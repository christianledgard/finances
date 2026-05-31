# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspace with two languages:

```
apps/
  extractor/   Python/FastAPI — EnableBanking AIS feed → MongoDB (port 8000)
  scheduler/   Python one-shot script — POSTs to /sync, runs as Railway cron
  web/         Next.js 16 — dashboard (port 3000)
packages/
  db/          finances_db — shared Python package (Motor async client, Pydantic models, repository)
```

`packages/db` is installed editable into `apps/extractor` via `uv.lock` (`tool.uv.sources`). The extractor imports from `finances_db`; the web app never touches MongoDB directly — it only calls the extractor's HTTP API with an `X-API-Key` header.

## Commands

### Python (extractor + db package)

```bash
# Install Python deps (runs uv sync in each Python app)
pnpm install:py

# Run extractor locally (hot-reload)
pnpm dev                        # or: cd apps/extractor && uv run uvicorn main:app --reload

# One-off CLI tools (from repo root, after install:py)
uv run finances-enrich          # run rule-based enrichment engine over all transactions
```

### Web

```bash
cd apps/web
pnpm dev                        # Next.js dev server
pnpm build                      # production build
```

### Docker (extractor + Mongo together)

```bash
pnpm docker:up                  # docker compose up --build
pnpm docker:down
docker compose run --rm scheduler   # trigger a one-off sync locally
```

## Environment setup

Two `.env` files to copy and fill:

| File | Key variables |
|---|---|
| `apps/extractor/.env` | `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (RS256 PEM), `API_KEY` |
| `apps/web/.env.local` | `GOOGLE_CLIENT_ID/SECRET`, `BETTER_AUTH_SECRET`, `EXTRACTOR_API_KEY`, `EXTRACTOR_URL` |

`API_KEY` (extractor) and `EXTRACTOR_API_KEY` (web) must be the same value.

## Architecture: data flow

```
EnableBanking API
  → POST /sync  (extractor)
  → upsert_transaction()  stores { transaction_id, account_uid, synced_at, openbanking: <raw payload> }
  → POST /enrich  re-runs enrichment.py rules, writes { enrichment: { category, direction, is_transfer, ... } }

Web dashboard
  → getMonthlySummary() / getCategoryBreakdown() / getSavingsTracker() / getSubscriptionsData()
  → fetches extractor HTTP endpoints with X-API-Key
  → rendered by server components in app/page.tsx
```

### Transaction document shape (MongoDB `transactions` collection)

Three disjoint zones — separate flows, disjoint `$set` paths, neither can clobber the other:

| Zone | Owner | Key fields |
|---|---|---|
| Identity | CREATE (sync) | `transaction_id`, `account_uid`, `synced_at` |
| `openbanking` | CREATE (sync) | verbatim EnableBanking payload — **never modified after sync** |
| `enrichment` | ENRICH (rules/AI) | `category`, `subcategory`, `direction` ("in"/"out"), `amount`, `is_transfer`, `is_recurring`, `is_roundup`, `offsets`, `source` ("rule"/"ai"/"manual") |

### Enrichment engine (`packages/db/finances_db/enrichment.py`)

Pure functions, no DB calls — safe to import from any context. Rules are loaded from MongoDB at runtime. First match wins. Call flow: `enrich_all_from_db(txns)` → `classify()` per doc + `detect_recurring()` cross-doc pass → returns `[(transaction_id, enrichment_dict)]` for `bulk_set_enrichment()`.

### Aggregation conventions

- All dashboard aggregations read `openbanking.booking_date` for the month and `enrichment.amount`/`enrichment.direction` for amounts (with fallback to `openbanking.transaction_amount.amount` / `openbanking.credit_debit_indicator` when enrichment hasn't run).
- Transfers (`enrichment.is_transfer == true`) are **always excluded** from income/expense P&L.
- Housing offsets (`enrichment.offsets == "housing"`) are excluded from income — they net against housing expenses.

## Web app conventions

- **Auth**: Google OAuth via Better Auth v1.2.x. Dashboard access requires `role: "admin"` set manually in MongoDB (`db.user.updateOne({email}, {$set: {role:"admin"}})`). Keep better-auth pinned to `~1.2.x` — newer versions break Turbopack.
- **Data fetching**: all extractor calls are server-side only (`import 'server-only'`) in `src/lib/extractor.ts`. Never import these into client components.
- **Charts**: recharts. Color conventions: emerald = income/savings, rose = expenses, indigo = net/primary, amber = negative state. Chart tooltips use `bg-card border-border`.
- **UI**: shadcn/ui (base-ui primitives, nova preset, Tailwind v4). Light/dark theme via `next-themes` — `ThemeProvider` in layout, `ThemeToggle` in `AppNav`, `defaultTheme="dark"`. Use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) instead of raw zinc/color values. The `render` prop (not `asChild`) wires base-ui components to Next.js `<Link>`. Select uses `onValueChange` (not `onChange`). `AppNav` is the shared nav component — pass `breadcrumb` prop on sub-pages.
