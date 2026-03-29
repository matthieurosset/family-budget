"""Service for importing bank statements and CC statements into the database."""

import json
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Account, ImportBatch, Transaction
from app.parsers.camt053 import ParsedStatement, ParsedTransaction, parse_camt053
from app.parsers.viseca_pdf import VisecaStatement, VisecaTransaction, parse_viseca_pdf


def identify_file(file_path: Path) -> str:
    """Identify file type: 'camt053' or 'viseca_pdf'."""
    suffix = file_path.suffix.lower()
    if suffix == ".xml":
        return "camt053"
    if suffix == ".pdf":
        return "viseca_pdf"
    raise ValueError(f"Unsupported file type: {suffix}")


def _compute_effective_month(tx_date: date, month_shift_days: int | None) -> str:
    """Compute the effective month for a transaction, applying category-based shift.

    If month_shift_days is set and the transaction falls within the first N days
    of a month, attribute it to the previous month.
    """
    if month_shift_days and tx_date.day <= month_shift_days:
        # Shift to previous month
        if tx_date.month == 1:
            return f"{tx_date.year - 1}-12"
        return f"{tx_date.year}-{tx_date.month - 1:02d}"
    return f"{tx_date.year}-{tx_date.month:02d}"


def _get_or_create_account(db: Session, name: str, account_type: str, iban: str | None, currency: str) -> Account:
    """Get existing account by IBAN/name or create a new one."""
    if iban:
        account = db.query(Account).filter(Account.iban == iban).first()
        if account:
            return account
    account = db.query(Account).filter(Account.name == name).first()
    if account:
        return account
    account = Account(name=name, type=account_type, iban=iban, currency=currency)
    db.add(account)
    db.flush()
    return account


def import_camt053(db: Session, file_path: Path, batch: ImportBatch) -> list[Transaction]:
    """Parse and import a camt.053 XML file into the database.

    Returns the list of newly created Transaction objects.
    """
    stmt = parse_camt053(file_path)

    account = _get_or_create_account(
        db,
        name=f"BCF - {stmt.iban[-4:]}",
        account_type="checking",
        iban=stmt.iban,
        currency=stmt.currency,
    )

    created: list[Transaction] = []
    for parsed_tx in stmt.transactions:
        # Generate synthetic reference for transactions without one
        ref = parsed_tx.bank_reference
        if not ref:
            ref = f"SYNTH-{stmt.iban[-4:]}-{parsed_tx.date}-{parsed_tx.amount}-{parsed_tx.description[:30]}"

        # Skip duplicates by bank_reference
        existing = db.query(Transaction).filter(Transaction.bank_reference == ref).first()
        if existing:
            continue

        signed_amount = -parsed_tx.amount if parsed_tx.is_debit else parsed_tx.amount
        effective_month = _compute_effective_month(parsed_tx.date, None)  # shift applied later by category

        tx = Transaction(
            account_id=account.id,
            date=parsed_tx.date,
            value_date=parsed_tx.value_date,
            effective_month=effective_month,
            description=parsed_tx.description,
            merchant_name=parsed_tx.merchant_name,
            amount=signed_amount,
            currency=parsed_tx.currency,
            is_transfer=parsed_tx.is_transfer,
            transaction_type=parsed_tx.transaction_type,
            bank_reference=ref,
            import_batch_id=batch.id,
        )
        db.add(tx)
        created.append(tx)

    db.flush()
    return created


def import_viseca_pdf(db: Session, file_path: Path, batch: ImportBatch) -> list[Transaction]:
    """Parse and import a Viseca PDF statement into the database.

    Returns the list of newly created Transaction objects.
    """
    stmt = parse_viseca_pdf(file_path)

    account = _get_or_create_account(
        db,
        name="Viseca CC",
        account_type="credit_card",
        iban=None,
        currency="CHF",
    )

    created: list[Transaction] = []
    for i, parsed_tx in enumerate(stmt.transactions):
        # Build a unique reference for dedup: statement_date + card + index
        ref_parts = [
            str(stmt.statement_date),
            parsed_tx.card_number,
            str(parsed_tx.transaction_date),
            parsed_tx.merchant_name[:30] if parsed_tx.merchant_name else "",
            str(parsed_tx.amount_chf),
        ]
        bank_ref = f"VISECA-{'-'.join(ref_parts)}"

        existing = db.query(Transaction).filter(Transaction.bank_reference == bank_ref).first()
        if existing:
            continue

        # Negate: charges (positive from parser) become negative (expense),
        # refunds (negative from parser) become positive (money back)
        signed_amount = -parsed_tx.amount_chf
        effective_month = _compute_effective_month(parsed_tx.transaction_date, None)

        tx = Transaction(
            account_id=account.id,
            date=parsed_tx.transaction_date,
            value_date=parsed_tx.value_date,
            effective_month=effective_month,
            description=f"{parsed_tx.description} [{parsed_tx.viseca_category}]" if parsed_tx.viseca_category else parsed_tx.description,
            merchant_name=parsed_tx.merchant_name,
            amount=signed_amount,
            currency="CHF",
            original_currency=parsed_tx.original_currency,
            original_amount=parsed_tx.original_amount,
            is_transfer=False,
            transaction_type="credit_card",
            bank_reference=bank_ref,
            import_batch_id=batch.id,
        )
        db.add(tx)
        created.append(tx)

    db.flush()
    return created


def import_files(db: Session, file_paths: list[Path], month: str) -> ImportBatch:
    """Import multiple files in a single batch.

    Args:
        db: Database session
        file_paths: List of file paths to import
        month: The month this import covers (YYYY-MM)

    Returns:
        The ImportBatch with all transactions imported.
    """
    batch = ImportBatch(
        month=month,
        status="pending",
        files=json.dumps([p.name for p in file_paths]),
    )
    db.add(batch)
    db.flush()

    all_transactions: list[Transaction] = []

    for file_path in file_paths:
        file_type = identify_file(file_path)
        if file_type == "camt053":
            txns = import_camt053(db, file_path, batch)
        elif file_type == "viseca_pdf":
            txns = import_viseca_pdf(db, file_path, batch)
        else:
            continue
        all_transactions.extend(txns)

    batch.status = "processed"
    db.commit()
    return batch
