"""API routes for annual expense envelopes."""

from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnnualEnvelope, AnnualEnvelopeTransaction

router = APIRouter(prefix="/api/envelopes", tags=["envelopes"])


class EnvelopeCreate(BaseModel):
    name: str
    monthly_amount: Decimal
    currency: str = "CHF"


class EnvelopeUpdate(BaseModel):
    name: str | None = None
    monthly_amount: Decimal | None = None


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
    currency: str
    total_provisions: str
    total_expenses: str
    balance: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[EnvelopeResponse])
def list_envelopes(db: Session = Depends(get_db)):
    envelopes = db.query(AnnualEnvelope).order_by(AnnualEnvelope.name).all()
    result = []
    for env in envelopes:
        provisions = sum(
            t.amount for t in env.envelope_transactions if t.type == "provision"
        )
        expenses = sum(
            t.amount for t in env.envelope_transactions if t.type == "expense"
        )
        result.append(EnvelopeResponse(
            id=env.id,
            name=env.name,
            monthly_amount=str(env.monthly_amount),
            currency=env.currency,
            total_provisions=str(provisions),
            total_expenses=str(expenses),
            balance=str(provisions - expenses),
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
        currency=env.currency, total_provisions="0", total_expenses="0", balance="0",
    )


@router.put("/{env_id}", response_model=EnvelopeResponse)
def update_envelope(env_id: int, data: EnvelopeUpdate, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Envelope not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(env, field, value)
    db.commit()
    db.refresh(env)
    provisions = sum(t.amount for t in env.envelope_transactions if t.type == "provision")
    expenses = sum(t.amount for t in env.envelope_transactions if t.type == "expense")
    return EnvelopeResponse(
        id=env.id, name=env.name, monthly_amount=str(env.monthly_amount),
        currency=env.currency, total_provisions=str(provisions),
        total_expenses=str(expenses), balance=str(provisions - expenses),
    )


@router.delete("/{env_id}")
def delete_envelope(env_id: int, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Envelope not found")
    db.delete(env)
    db.commit()
    return {"status": "deleted"}


@router.get("/{env_id}/history")
def envelope_history(env_id: int, db: Session = Depends(get_db)):
    env = db.query(AnnualEnvelope).filter(AnnualEnvelope.id == env_id).first()
    if not env:
        raise HTTPException(404, "Envelope not found")
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
        raise HTTPException(404, "Envelope not found")
    from datetime import date as date_type
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
