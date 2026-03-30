"""Reconciliation service: links Viseca CC transactions to the bank statement CC payment line."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Transaction

VISECA_KEYWORDS = ["viseca", "carte de crédit", "cumulus", "migros bank"]
HIDDEN_TYPES = ("credit_card", "cc_payment_reconciled", "envelope_transfer_split", "envelope_provision", "bills_account")


def find_viseca_payment_line(db: Session, cc_total: Decimal) -> Transaction | None:
    """Find the bank transaction that matches the Viseca CC payment.

    Strategy (in order):
    1. Keyword match: look for "Viseca" in description among unreconciled debits
    2. Amount match: find a debit within 1 CHF of the CC total

    Returns the best matching transaction, or None.
    """
    candidates = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_type.not_in(HIDDEN_TYPES),
            Transaction.amount < 0,
        )
        .all()
    )

    # Strategy 1: keyword match
    for tx in candidates:
        desc = ((tx.description or "") + " " + (tx.merchant_name or "")).lower()
        if any(kw in desc for kw in VISECA_KEYWORDS):
            return tx

    # Strategy 2: amount match (closest to CC total within 1 CHF)
    best = None
    best_diff = Decimal("999999")
    for tx in candidates:
        diff = abs(abs(tx.amount) - cc_total)
        if diff < best_diff and diff <= Decimal("1.00"):
            best_diff = diff
            best = tx

    return best


def reconcile_viseca(db: Session, batch_id: int) -> dict:
    """Reconcile Viseca CC transactions with the bank statement.

    Finds the bank payment line (by keyword or amount), hides it,
    and links the individual CC transactions as replacements.
    """
    # Get CC transactions from this batch
    cc_txns = (
        db.query(Transaction)
        .filter(
            Transaction.import_batch_id == batch_id,
            Transaction.transaction_type == "credit_card",
        )
        .all()
    )
    if not cc_txns:
        return {
            "status": "no_cc",
            "message": "Aucune transaction CC dans ce batch",
            "cc_transactions": 0,
            "payment_line_id": None,
        }

    # Calculate CC total (net: charges - refunds, as positive)
    cc_total = sum(abs(t.amount) for t in cc_txns if t.amount < 0) - sum(t.amount for t in cc_txns if t.amount > 0)

    # Find matching bank payment line
    payment_line = find_viseca_payment_line(db, cc_total)

    if payment_line:
        # Hide the payment line and link CC transactions
        payment_line.transaction_type = "cc_payment_reconciled"
        payment_line.note = (
            f"Remplacé par {len(cc_txns)} transactions Viseca CC. "
            f"Montant bancaire: {abs(payment_line.amount)} CHF, Total CC: {cc_total} CHF"
        )
        for tx in cc_txns:
            tx.parent_transaction_id = payment_line.id

        db.commit()
        return {
            "status": "reconciled",
            "message": f"Ligne bancaire de {abs(payment_line.amount)} CHF remplacée par {len(cc_txns)} transactions CC",
            "cc_transactions": len(cc_txns),
            "payment_line_id": payment_line.id,
            "payment_amount": str(abs(payment_line.amount)),
            "cc_total": str(cc_total),
        }

    # No match found — CC transactions exist but no bank line to replace
    # This is OK: the bank payment might not be in this statement period yet
    db.commit()
    return {
        "status": "no_match",
        "message": f"{len(cc_txns)} transactions CC importées, aucune ligne bancaire correspondante trouvée ({cc_total} CHF)",
        "cc_transactions": len(cc_txns),
        "payment_line_id": None,
        "cc_total": str(cc_total),
    }
