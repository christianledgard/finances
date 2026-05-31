"""finances_db — shared MongoDB layer for the finances monorepo."""
from .authz import AUTHORIZED_ROLE, is_admin_user
from .client import close, get_client, get_db
from .enrichment import enrich_all_from_db
from .models import Account, Enrichment, RuleDoc, Session, Transaction
from .repository import (
    bulk_set_enrichment,
    bulk_upsert_transactions,
    category_breakdown,
    create_rule,
    delete_rule,
    ensure_indexes,
    get_rules_for_engine,
    get_uncategorized_transactions,
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
    set_enrichment,
    transactions_by_category,
    transactions_raw_for_month,
    update_rule,
    upsert_transaction,
)

__all__ = [
    # authz
    "AUTHORIZED_ROLE",
    "is_admin_user",
    # client
    "get_client",
    "get_db",
    "close",
    # models
    "Account",
    "Enrichment",
    "RuleDoc",
    "Session",
    "Transaction",
    # enrichment (DB-aware)
    "enrich_all_from_db",
    # repository — transactions
    "bulk_set_enrichment",
    "bulk_upsert_transactions",
    "category_breakdown",
    "ensure_indexes",
    "get_uncategorized_transactions",
    "iter_all_transactions",
    "list_sessions",
    "list_synced_days_range",
    "mark_day_synced",
    "monthly_summary_clean",
    "monthly_transaction_summary",
    "recurring_subscriptions",
    "save_session",
    "savings_tracker",
    "set_enrichment",
    "transactions_by_category",
    "transactions_raw_for_month",
    "upsert_transaction",
    # repository — rules
    "create_rule",
    "delete_rule",
    "get_rules_for_engine",
    "list_rule_docs",
    "reorder_rules",
    "update_rule",
]
