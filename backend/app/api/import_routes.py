"""API routes for importing bank and CC statements."""

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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
