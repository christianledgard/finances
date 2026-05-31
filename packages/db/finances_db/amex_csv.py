"""Pure CSV parser for AMEX NL export files — no DB calls, no FastAPI."""
import csv
import hashlib
import io
from datetime import datetime

AMEX_ACCOUNT_UID = "amex_csv"


def _parse_date(raw: str) -> str:
    """MM/DD/YYYY → YYYY-MM-DD."""
    return datetime.strptime(raw.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")


def _parse_amount(raw: str) -> tuple[float, str]:
    """Returns (abs_float, credit_debit_indicator).

    AMEX NL convention: positive Bedrag = expense (DBIT), negative = payment/credit (CRDT).
    Comma is the decimal separator (e.g. "13,11" or "-436,25").
    """
    normalised = raw.strip().replace(",", ".")
    amount = float(normalised)
    if amount >= 0:
        return amount, "DBIT"
    return abs(amount), "CRDT"


def _make_transaction_id(referentie: str, date_iso: str, description: str, amount_str: str) -> str:
    """Primary key from Referentie; SHA-256 hash fallback when Referentie is absent."""
    ref = referentie.strip("'").strip()
    if ref:
        return ref
    key = f"{date_iso}|{description.strip().lower()}|{amount_str}"
    return "amex-" + hashlib.sha256(key.encode()).hexdigest()[:16]


def parse_amex_csv(content: str) -> list[dict]:
    """Parse AMEX NL CSV text into a list of transaction dicts.

    Returns list of {"transaction_id": str, "openbanking": dict}, where the
    openbanking dict uses the same field names as ING/EnableBanking docs so the
    existing enrichment engine and aggregation pipelines work without changes.
    """
    reader = csv.DictReader(io.StringIO(content))
    results = []
    for row in reader:
        datum = row.get("Datum", "").strip()
        if not datum:
            continue

        date_iso = _parse_date(datum)
        bedrag = row.get("Bedrag", "0").strip() or "0"
        amount_abs, indicator = _parse_amount(bedrag)
        amount_str = f"{amount_abs:.2f}"

        description = row.get("Omschrijving", "").strip()
        referentie = row.get("Referentie", "").strip()
        aanvullend = row.get("Aanvullende informatie", "").strip()

        transaction_id = _make_transaction_id(referentie, date_iso, description, amount_str)

        ob: dict = {
            "booking_date": date_iso,
            "transaction_amount": {
                "amount": amount_str,
                "currency": "EUR",
            },
            "credit_debit_indicator": indicator,
            "remittance_information": [description] if description else [],
            "entry_reference": referentie.strip("'").strip(),
            "bank_transaction_code": {"description": aanvullend},
            "source": "amex_csv",
        }

        if indicator == "DBIT":
            ob["creditor"] = {"name": description}
        else:
            ob["debtor"] = {"name": description}

        results.append({"transaction_id": transaction_id, "openbanking": ob})

    return results
