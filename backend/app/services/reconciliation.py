"""Reconciliation service: links Viseca CC transactions to the bank statement CC payment line."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Transaction

VISECA_KEYWORDS = ["viseca", "carte de crédit", "cumulus", "migros bank"]


def find_viseca_payment_lines(db: Session, batch_id: int | None = None) -> list[Transaction]:
    """Find Viseca CC payment lines in the bank statement by name matching.

    Searches ALL unreconciled bank transactions (not just current batch)
    for lines containing Viseca-related keywords.
    """
    query = db.query(Transaction).filter(
        Transaction.transaction_type != "credit_card",
        Transaction.transaction_type != "cc_payment_reconciled",
        Transaction.amount < 0,
    )
    if batch_id:
        query = query.filter(Transaction.import_batch_id == batch_id)

    candidates = query.all()
    matches = []
    for tx in candidates:
        desc = ((tx.description or "") + " " + (tx.merchant_name or "")).lower()
        if any(kw in desc for kw in VISECA_KEYWORDS):
            matches.append(tx)

    return matches


def reconcile_viseca(db: Session, batch_id: int) -> dict:
    """Reconcile Viseca CC transactions with the bank statement.

    Strategy:
    1. Find all Viseca payment lines in the bank statement (by keyword matching)
    2. Mark them as reconciled (cc_payment_reconciled) so they don't appear as expenses
    3. Link CC transactions from the PDF as children

    The amounts may not match because the bank payment covers the PREVIOUS CC statement
    while the imported PDF is the CURRENT statement. Both are valid — the key is to
    avoid double-counting by hiding the lump-sum bank line.
    """
    # Find CC transactions from this batch
    cc_txns = (
        db.query(Transaction)
        .filter(
            Transaction.import_batch_id == batch_id,
            Transaction.transaction_type == "credit_card",
        )
        .all()
    )

    # Find Viseca payment lines in bank transactions (any batch)
    payment_lines = find_viseca_payment_lines(db)

    if not payment_lines and not cc_txns:
        return {
            "status": "no_match",
            "message": "Aucune transaction Viseca trouvée",
            "cc_transactions": 0,
            "payment_lines_reconciled": 0,
        }

    # Reconcile payment lines
    for pl in payment_lines:
        pl.transaction_type = "cc_payment_reconciled"
        if not pl.note:
            pl.note = "Paiement Viseca — remplacé par les transactions CC détaillées"

    # Link CC transactions to the first payment line (if exists)
    parent_id = payment_lines[0].id if payment_lines else None
    if parent_id:
        for tx in cc_txns:
            tx.parent_transaction_id = parent_id

    db.commit()

    return {
        "status": "reconciled",
        "message": f"{len(payment_lines)} ligne(s) Viseca reconciliée(s), {len(cc_txns)} transactions CC liées",
        "cc_transactions": len(cc_txns),
        "payment_lines_reconciled": len(payment_lines),
    }
