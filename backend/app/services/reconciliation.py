"""Reconciliation service: links Viseca CC transactions to the bank statement CC payment line."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Transaction


def find_viseca_payment_line(db: Session, batch_id: int) -> Transaction | None:
    """Find the Viseca CC payment line in the bank statement for a given import batch.

    The Viseca payment appears as a single debit on the bank account matching
    the total of the Viseca CC statement. We identify it by looking for a large
    debit with no category that matches the CC total.
    """
    # Get all Viseca CC transactions from this batch
    cc_txns = (
        db.query(Transaction)
        .filter(
            Transaction.import_batch_id == batch_id,
            Transaction.transaction_type == "credit_card",
        )
        .all()
    )
    if not cc_txns:
        return None

    # Calculate expected CC total (sum of absolute amounts, since CC amounts are stored as negative)
    cc_total = sum(abs(t.amount) for t in cc_txns)

    # Find matching bank debit: a single debit close to the CC total
    # Look in the same batch for bank transactions that could be the CC payment
    bank_debits = (
        db.query(Transaction)
        .filter(
            Transaction.import_batch_id == batch_id,
            Transaction.transaction_type != "credit_card",
            Transaction.amount < 0,  # debit
            Transaction.category_id.is_(None),
        )
        .all()
    )

    # Find the closest match within 1 CHF tolerance
    best_match = None
    best_diff = Decimal("999999")
    for tx in bank_debits:
        diff = abs(abs(tx.amount) - cc_total)
        if diff < best_diff and diff <= Decimal("1.00"):
            best_diff = diff
            best_match = tx

    return best_match


def reconcile_viseca(db: Session, batch_id: int) -> dict:
    """Reconcile Viseca CC transactions with the bank statement.

    Links individual CC transactions as children of the CC payment line
    on the bank statement, effectively replacing the single line with detailed sub-transactions.

    Returns a summary dict with reconciliation results.
    """
    payment_line = find_viseca_payment_line(db, batch_id)
    if not payment_line:
        return {
            "status": "no_match",
            "message": "No matching Viseca payment line found in bank statement",
            "cc_transactions": 0,
            "payment_line_id": None,
        }

    # Get all CC transactions from this batch
    cc_txns = (
        db.query(Transaction)
        .filter(
            Transaction.import_batch_id == batch_id,
            Transaction.transaction_type == "credit_card",
        )
        .all()
    )

    cc_total = sum(abs(t.amount) for t in cc_txns)
    payment_amount = abs(payment_line.amount)
    diff = abs(cc_total - payment_amount)

    # Link CC transactions as children of the payment line
    for tx in cc_txns:
        tx.parent_transaction_id = payment_line.id

    # Mark the payment line as reconciled
    payment_line.transaction_type = "cc_payment_reconciled"
    payment_line.note = (
        f"Reconciled with {len(cc_txns)} Viseca CC transactions. "
        f"CC total: {cc_total} CHF, Bank line: {payment_amount} CHF"
    )

    db.commit()

    return {
        "status": "reconciled",
        "message": f"Linked {len(cc_txns)} CC transactions to payment line",
        "cc_transactions": len(cc_txns),
        "cc_total": str(cc_total),
        "payment_amount": str(payment_amount),
        "difference": str(diff),
        "payment_line_id": payment_line.id,
    }
