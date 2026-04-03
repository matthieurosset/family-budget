"""API routes for annual expense envelopes."""

from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnnualEnvelope, AnnualEnvelopeTransaction
from app.services.envelope_service import (
    split_transfer_to_provisions,
)

router = APIRouter(prefix="/api/envelopes", tags=["envelopes"])


class EnvelopeCreate(BaseModel):
    name: str
    monthly_amount: Decimal
    initial_balance: Decimal = Decimal(0)
    currency: str = "CHF"
    category_id: int | None = None


class EnvelopeUpdate(BaseModel):
    name: str | None = None
    monthly_amount: Decimal | None = None
    initial_balance: Decimal | None = None
    category_id: int | None = None


class EnvelopeTransactionCreate(BaseModel):
    type: str  # provision / expense
    amount: Decimal
    date: str  # YYYY-MM-DD
    note: str | None = None
    transaction_id: int | None = None


class EnvelopeResponse(BaseModel):
    id: int
    name: str
    monthly_amount: str
    initial_balance: str
    currency: str
    category_id: int | None
    category_name: str | None
    total_provisions: str
    total_expenses: str
    balance: str


@router.get("", response_model=list[EnvelopeResponse])
def list_envelopes(db: Session = Depends(get_db)):
    envelopes = db.query(AnnualEnvelope).order_by(AnnualEnvelope.name).all()
    result = []
    for env in envelopes:
        provisions = sum(t.amount for t in env.envelope_transactions if t.type == "provision")
        expenses = sum(t.amount for t in env.envelope_transactions if t.type == "expense")
        balance = env.initial_balance + provisions - expenses
        result.append(EnvelopeResponse(
            id=env.id,
            name=env.name,
            monthly_amount=str(env.monthly_amount),
            initial_balance=str(env.initial_balance),
            currency=env.currency,
            category_id=env.category_id,
            category_name=env.category.name if env.category else None,
            total_provisions=str(provisions),
            total_expenses=str(expenses),
            balance=str(balance),
        ))
    return result


@router.post("", response_model=EnvelopeResponse)
def create_envelope(data: EnvelopeCreate, db: Session = Depends(get_db)):
    env = AnnualEnvelope(**data.model_dump())
    db.add(env)
    db.commit()
    db.refresh(env)
    return EnvelopeResponse(
        id=env.id, name=env.name, monthly_amount=str(env.monthly_amount),
        initial_balance=str(env.initial_balance), currency=env.currency,
        category_id=env.category_id, category_name=env.category.name if env.category else None,
        total_provisions="0", total_expenses="0", balance=str(env.initial_balance),
    )


@router.put("/{env_id}", response_model=EnvelopeResponse)
def update_envelope(env_id: int, data: EnvelopeUpdate, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Enveloppe non trouvée")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(env, field, value)
    db.commit()
    db.refresh(env)
    provisions = sum(t.amount for t in env.envelope_transactions if t.type == "provision")
    expenses = sum(t.amount for t in env.envelope_transactions if t.type == "expense")
    balance = env.initial_balance + provisions - expenses
    return EnvelopeResponse(
        id=env.id, name=env.name, monthly_amount=str(env.monthly_amount),
        initial_balance=str(env.initial_balance), currency=env.currency,
        category_id=env.category_id, category_name=env.category.name if env.category else None,
        total_provisions=str(provisions), total_expenses=str(expenses),
        balance=str(balance),
    )


@router.delete("/{env_id}")
def delete_envelope(env_id: int, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Enveloppe non trouvée")
    db.delete(env)
    db.commit()
    return {"status": "deleted"}


@router.get("/{env_id}/history")
def envelope_history(env_id: int, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Enveloppe non trouvée")
    txns = (
        db.query(AnnualEnvelopeTransaction)
        .filter(AnnualEnvelopeTransaction.envelope_id == env_id)
        .order_by(AnnualEnvelopeTransaction.date.desc())
        .all()
    )
    return [
        {
            "id": t.id,
            "type": t.type,
            "amount": str(t.amount),
            "date": t.date.isoformat(),
            "note": t.note,
            "transaction_id": t.transaction_id,
        }
        for t in txns
    ]


@router.post("/{env_id}/transactions")
def add_envelope_transaction(env_id: int, data: EnvelopeTransactionCreate, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Enveloppe non trouvée")
    tx = AnnualEnvelopeTransaction(
        envelope_id=env_id,
        type=data.type,
        amount=data.amount,
        date=date_type.fromisoformat(data.date),
        note=data.note,
        transaction_id=data.transaction_id,
    )
    db.add(tx)
    db.commit()
    return {"id": tx.id, "status": "created"}


@router.delete("/{env_id}/transactions/{tx_id}")
def delete_envelope_transaction(env_id: int, tx_id: int, db: Session = Depends(get_db)):
    entry = (
        db.query(AnnualEnvelopeTransaction)
        .filter(AnnualEnvelopeTransaction.id == tx_id, AnnualEnvelopeTransaction.envelope_id == env_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entrée non trouvée")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}


# ───── Bills Account Transactions ─────


@router.get("/bills-transactions")
def list_bills_transactions(db: Session = Depends(get_db)):
    """List transactions from the bills account, pending envelope assignment."""
    from app.models import Transaction
    txns = (
        db.query(Transaction)
        .filter(Transaction.transaction_type == "bills_account", Transaction.amount < 0)
        .order_by(Transaction.date.desc())
        .all()
    )
    # Check which are already assigned to an envelope
    assigned_tx_ids = {
        row.transaction_id
        for row in db.query(AnnualEnvelopeTransaction.transaction_id)
        .filter(AnnualEnvelopeTransaction.transaction_id.is_not(None))
        .all()
    }
    return [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "description": t.description,
            "merchant_name": t.merchant_name,
            "amount": str(t.amount),
            "assigned": t.id in assigned_tx_ids,
        }
        for t in txns
    ]


@router.post("/assign-transaction/{tx_id}")
def assign_transaction_to_envelope(
    tx_id: int,
    envelope_id: int = Form(...),
    db: Session = Depends(get_db),
):
    """Assign a bills account transaction to an envelope as an expense."""
    from app.models import Transaction
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction non trouvée")
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == envelope_id).first()
    if not env:
        raise HTTPException(404, "Enveloppe non trouvée")

    # Check not already assigned
    existing = (
        db.query(AnnualEnvelopeTransaction)
        .filter(AnnualEnvelopeTransaction.transaction_id == tx_id)
        .first()
    )
    if existing:
        return {"status": "already_assigned", "envelope": existing.envelope_id}

    entry = AnnualEnvelopeTransaction(
        envelope_id=envelope_id,
        transaction_id=tx_id,
        type="expense",
        amount=abs(tx.amount),
        date=tx.date,
        note=tx.merchant_name or tx.description[:50],
    )
    db.add(entry)
    db.commit()
    return {"status": "assigned", "envelope_id": envelope_id}


# ───── Split Transfer ─────


@router.post("/split-transfer/{tx_id}")
def split_transfer(
    tx_id: int,
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    """Split a transfer transaction into individual envelope provisions."""
    return split_transfer_to_provisions(db, tx_id, month)


