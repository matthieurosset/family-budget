"""API routes for transaction listing, search, and editing."""

from fastapi import APIRouter, Depends, Form, Query
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
    date: str | None = None
    description: str | None = None
    merchant_name: str | None = None
    amount: float | None = None
    category_id: int | None = None
    note: str | None = None


class TransactionCreate(BaseModel):
    date: str
    description: str
    merchant_name: str | None = None
    amount: float
    currency: str = "CHF"
    category_id: int | None = None
    note: str | None = None
    account_id: int | None = None


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
        Transaction.transaction_type.not_in(["cc_payment_reconciled", "credit_card_pending", "envelope_transfer_split", "bills_account", "split_parent"]),
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
    from datetime import date as date_type
    from decimal import Decimal
    from fastapi import HTTPException
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    updates = data.model_dump(exclude_unset=True)
    if "date" in updates and updates["date"]:
        tx.date = date_type.fromisoformat(updates.pop("date"))
        from app.services.import_service import _compute_effective_month
        tx.effective_month = _compute_effective_month(tx.date)
    if "amount" in updates and updates["amount"] is not None:
        tx.amount = Decimal(str(updates.pop("amount")))
    for field, value in updates.items():
        setattr(tx, field, value)
    db.commit()
    return {"status": "updated", "id": tx_id}


@router.post("", status_code=201)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    from datetime import date as date_type
    from decimal import Decimal
    from app.services.import_service import _compute_effective_month
    from app.models import Account

    tx_date = date_type.fromisoformat(data.date)
    account_id = data.account_id
    if not account_id:
        account = db.query(Account).first()
        account_id = account.id if account else 1

    tx = Transaction(
        account_id=account_id,
        date=tx_date,
        effective_month=_compute_effective_month(tx_date),
        description=data.description,
        merchant_name=data.merchant_name,
        amount=Decimal(str(data.amount)),
        currency=data.currency,
        category_id=data.category_id,
        note=data.note,
        transaction_type="manual",
    )
    db.add(tx)
    db.commit()
    return {"status": "created", "id": tx.id}


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    db.delete(tx)
    db.commit()
    return {"status": "deleted"}


class SplitLine(BaseModel):
    category_id: int
    amount: float
    note: str | None = None


@router.post("/{tx_id}/split")
def split_transaction(tx_id: int, lines: list[SplitLine], db: Session = Depends(get_db)):
    """Split a transaction into multiple sub-transactions with different categories."""
    from decimal import Decimal
    from fastapi import HTTPException
    from app.services.import_service import _compute_effective_month

    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")

    # Validate total
    total = sum(Decimal(str(l.amount)) for l in lines)
    if abs(total - abs(tx.amount)) > Decimal("0.02"):
        raise HTTPException(400, f"Le total des lignes ({total}) ne correspond pas au montant ({abs(tx.amount)})")

    # Create children
    for line in lines:
        child = Transaction(
            account_id=tx.account_id,
            date=tx.date,
            value_date=tx.value_date,
            effective_month=tx.effective_month,
            description=tx.description,
            merchant_name=tx.merchant_name,
            amount=-Decimal(str(line.amount)) if tx.amount < 0 else Decimal(str(line.amount)),
            currency=tx.currency,
            category_id=line.category_id,
            parent_transaction_id=tx.id,
            note=line.note,
            transaction_type="split_child",
            import_batch_id=tx.import_batch_id,
        )
        db.add(child)

    # Mark parent
    tx.transaction_type = "split_parent"
    db.commit()
    return {"status": "split", "children": len(lines)}


@router.delete("/{tx_id}/unsplit")
def unsplit_transaction(tx_id: int, db: Session = Depends(get_db)):
    """Remove all split children and restore the parent transaction."""
    from fastapi import HTTPException

    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")

    children = db.query(Transaction).filter(Transaction.parent_transaction_id == tx_id, Transaction.transaction_type == "split_child").all()
    for child in children:
        db.delete(child)

    tx.transaction_type = None
    tx.category_id = None
    db.commit()
    return {"status": "unsplit", "children_removed": len(children)}


@router.get("/{tx_id}/children")
def get_split_children(tx_id: int, db: Session = Depends(get_db)):
    """Get split children of a transaction."""
    children = db.query(Transaction).filter(
        Transaction.parent_transaction_id == tx_id,
        Transaction.transaction_type == "split_child",
    ).all()
    return [
        {"id": c.id, "category_id": c.category_id, "amount": str(abs(c.amount)), "note": c.note}
        for c in children
    ]


@router.get("/untagged-transfers")
def list_untagged_transfers(db: Session = Depends(get_db)):
    """List transfers that haven't been tagged as savings or bills."""
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.is_transfer == True,
            Transaction.transfer_target.is_(None),
            Transaction.transaction_type.not_in(["envelope_transfer_split", "bills_account"]),
        )
        .order_by(Transaction.date.desc())
        .all()
    )
    return [
        {"id": t.id, "date": t.date.isoformat(), "amount": str(t.amount), "description": t.description[:60], "merchant_name": t.merchant_name}
        for t in txns
    ]


@router.patch("/{tx_id}/transfer-target")
def tag_transfer(tx_id: int, target: str = Form(..., description="savings or bills"), db: Session = Depends(get_db)):
    """Tag a transfer as going to savings or bills account."""
    from fastapi import HTTPException
    if target not in ("savings", "bills"):
        raise HTTPException(400, "Target must be 'savings' or 'bills'")
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    tx.transfer_target = target
    db.commit()
    return {"status": "tagged", "id": tx_id, "target": target}


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    from app.models import Account
    accounts = db.query(Account).all()
    return [{"id": a.id, "name": a.name, "type": a.type, "iban": a.iban, "currency": a.currency} for a in accounts]
