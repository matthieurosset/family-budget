"""API routes for transaction listing, search, and editing."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Transaction

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionResponse(BaseModel):
    id: int
    date: str
    value_date: str | None
    effective_month: str
    description: str
    merchant_name: str | None
    amount: str
    currency: str
    original_currency: str | None
    original_amount: str | None
    category_id: int | None
    category_name: str | None
    parent_category_name: str | None
    note: str | None
    is_transfer: bool
    transaction_type: str | None
    account_id: int

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    note: str | None = None


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    month: str | None = Query(None, description="Filter by effective_month YYYY-MM"),
    account_id: int | None = Query(None),
    category_id: int | None = Query(None),
    uncategorized: bool = Query(False, description="Only show uncategorized"),
    search: str | None = Query(None, description="Search in description/merchant"),
    transaction_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)

    if month:
        query = query.filter(Transaction.effective_month == month)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if uncategorized:
        query = query.filter(Transaction.category_id.is_(None))
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Transaction.description.ilike(pattern)) | (Transaction.merchant_name.ilike(pattern))
        )
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)

    # Exclude reconciled CC payment lines from normal view
    query = query.filter(
        Transaction.transaction_type.not_in(["cc_payment_reconciled", "credit_card_pending", "envelope_transfer_split", "bills_account"]),
    )

    total = query.count()
    items = query.order_by(Transaction.date.desc(), Transaction.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Build category lookup
    cat_cache: dict[int, tuple[str, str | None]] = {}

    def get_cat_info(cat_id: int | None) -> tuple[str | None, str | None]:
        if not cat_id:
            return None, None
        if cat_id not in cat_cache:
            cat = db.query(Category).filter(Category.id == cat_id).first()
            if cat:
                parent = db.query(Category).filter(Category.id == cat.parent_id).first() if cat.parent_id else None
                cat_cache[cat_id] = (cat.name, parent.name if parent else None)
            else:
                cat_cache[cat_id] = ("?", None)
        return cat_cache[cat_id]

    response_items = []
    for t in items:
        cat_name, parent_name = get_cat_info(t.category_id)
        response_items.append(TransactionResponse(
            id=t.id,
            date=t.date.isoformat(),
            value_date=t.value_date.isoformat() if t.value_date else None,
            effective_month=t.effective_month,
            description=t.description,
            merchant_name=t.merchant_name,
            amount=str(t.amount),
            currency=t.currency,
            original_currency=t.original_currency,
            original_amount=str(t.original_amount) if t.original_amount else None,
            category_id=t.category_id,
            category_name=cat_name,
            parent_category_name=parent_name,
            note=t.note,
            is_transfer=t.is_transfer,
            transaction_type=t.transaction_type,
            account_id=t.account_id,
        ))

    return TransactionListResponse(items=response_items, total=total, page=page, page_size=page_size)


@router.patch("/{tx_id}")
def update_transaction(tx_id: int, data: TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(404, "Transaction not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    return {"status": "updated", "id": tx_id}


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    from app.models import Account
    accounts = db.query(Account).all()
    return [{"id": a.id, "name": a.name, "type": a.type, "iban": a.iban, "currency": a.currency} for a in accounts]
