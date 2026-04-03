"""API routes for importing bank and CC statements."""

import shutil
from pathlib import Path

from decimal import Decimal

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import ImportBatch, Transaction
from app.services.import_service import import_files
from app.services.reconciliation import reconcile_viseca

router = APIRouter(prefix="/api/import", tags=["import"])


class ImportResponse(BaseModel):
    batch_id: int
    month: str
    status: str
    files: list[str]
    transactions_created: int
    reconciliation: dict | None = None


class BatchSummary(BaseModel):
    id: int
    month: str
    status: str
    imported_at: str
    files: list[str]
    transaction_count: int


@router.post("/upload", response_model=ImportResponse)
async def upload_and_import(
    account_type: str = Form("salary", description="Account type: salary, bills, or credit_card"),
    files: list[UploadFile] = File(..., description="camt.053 XML and/or Viseca PDF files"),
    db: Session = Depends(get_db),
):
    """Upload bank statement files and import them."""
    from datetime import date
    month = f"{date.today().year}-{date.today().month:02d}"

    # Save uploaded files to disk
    upload_dir = settings.upload_dir / month
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[Path] = []
    file_names: list[str] = []
    for upload in files:
        if not upload.filename:
            continue
        dest = upload_dir / upload.filename
        with open(dest, "wb") as f:
            shutil.copyfileobj(upload.file, f)
        saved_paths.append(dest)
        file_names.append(upload.filename)

    if not saved_paths:
        raise HTTPException(400, "No valid files uploaded")

    # Import all files
    try:
        batch = import_files(db, saved_paths, month)
    except Exception as e:
        raise HTTPException(422, f"Import failed: {e}")

    # If bills account: mark all transactions as hidden (envelope-only)
    if account_type == "bills":
        txns = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).all()
        for tx in txns:
            tx.transaction_type = "bills_account"
        db.commit()

    # Count transactions created
    tx_count = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).count()

    # Try reconciliation if we have both bank and CC data
    recon_result = reconcile_viseca(db, batch.id)

    return ImportResponse(
        batch_id=batch.id,
        month=month,
        status=batch.status,
        files=file_names,
        transactions_created=tx_count,
        reconciliation=recon_result if recon_result["status"] != "no_match" else None,
    )


@router.get("/batches", response_model=list[BatchSummary])
def list_batches(db: Session = Depends(get_db)):
    """List all import batches."""
    batches = db.query(ImportBatch).order_by(ImportBatch.imported_at.desc()).all()
    result = []
    for b in batches:
        tx_count = db.query(Transaction).filter(Transaction.import_batch_id == b.id).count()
        import json as json_mod

        files = json_mod.loads(b.files) if b.files else []
        result.append(
            BatchSummary(
                id=b.id,
                month=b.month,
                status=b.status,
                imported_at=b.imported_at.isoformat() if b.imported_at else "",
                files=files,
                transaction_count=tx_count,
            )
        )
    return result


@router.post("/batches/{batch_id}/reconcile")
def trigger_reconciliation(batch_id: int, db: Session = Depends(get_db)):
    """Manually trigger reconciliation for a specific batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")
    return reconcile_viseca(db, batch_id)


@router.post("/batches/{batch_id}/reconcile-manual")
def manual_reconciliation(
    batch_id: int,
    payment_line_id: int = Form(..., description="ID of the bank transaction to link"),
    db: Session = Depends(get_db),
):
    """Manually link CC transactions to a specific bank transaction."""
    payment_line = db.query(Transaction).filter(Transaction.id == payment_line_id).first()
    if not payment_line:
        raise HTTPException(404, "Transaction non trouvée")

    cc_txns = (
        db.query(Transaction)
        .filter(Transaction.import_batch_id == batch_id, Transaction.transaction_type == "credit_card")
        .all()
    )

    cc_total = sum(abs(t.amount) for t in cc_txns if t.amount < 0) - sum(t.amount for t in cc_txns if t.amount > 0)
    payment_amount = abs(payment_line.amount)

    # If amounts match → auto-reconcile all
    if abs(cc_total - payment_amount) <= 1:
        payment_line.transaction_type = "cc_payment_reconciled"
        payment_line.note = f"Réconcilié avec {len(cc_txns)} transactions CC"
        for tx in cc_txns:
            tx.parent_transaction_id = payment_line.id
        db.commit()
        return {
            "status": "reconciled",
            "cc_transactions": len(cc_txns),
            "payment_line_id": payment_line.id,
        }

    # Amounts differ → return CC lines for detailed reconciliation
    cc_list = [
        {"id": t.id, "date": t.date.isoformat(), "description": t.description[:60], "merchant_name": t.merchant_name, "amount": str(t.amount)}
        for t in cc_txns
    ]
    return {
        "status": "need_detail",
        "payment_line_id": payment_line.id,
        "payment_amount": str(payment_amount),
        "cc_total": str(cc_total),
        "cc_lines": cc_list,
    }


class ReconcileIncluded(BaseModel):
    id: int
    amount: float


class ReconcileDetailRequest(BaseModel):
    payment_line_id: int
    included: list[ReconcileIncluded]
    excluded: list[int]


@router.post("/batches/{batch_id}/reconcile-detail")
def detail_reconciliation(
    batch_id: int,
    data: ReconcileDetailRequest,
    db: Session = Depends(get_db),
):
    """Reconcile CC transactions with line-by-line selection and amount edits."""
    payment_line = db.query(Transaction).filter(Transaction.id == data.payment_line_id).first()
    if not payment_line:
        raise HTTPException(404, "Ligne bancaire non trouvée")

    included_ids = {item.id for item in data.included}
    amount_overrides = {item.id: Decimal(str(item.amount)) for item in data.included}

    # Mark payment line as reconciled
    payment_line.transaction_type = "cc_payment_reconciled"
    payment_line.note = f"Réconcilié avec {len(data.included)} transactions CC sur {len(data.included) + len(data.excluded)}"

    # Process included transactions
    for tx_id in included_ids:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if tx:
            tx.parent_transaction_id = payment_line.id
            new_amount = amount_overrides.get(tx_id)
            if new_amount is not None and new_amount != abs(tx.amount):
                tx.amount = -abs(new_amount) if tx.amount < 0 else abs(new_amount)

    # Process excluded transactions (pending for next statement)
    for tx_id in data.excluded:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if tx:
            tx.transaction_type = "credit_card_pending"

    db.commit()
    return {
        "status": "reconciled",
        "included": len(data.included),
        "excluded": len(data.excluded),
        "payment_line_id": payment_line.id,
    }
