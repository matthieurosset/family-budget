"""API routes for dashboard, analytics, and transaction search."""

from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Account, Category, Transaction

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class MonthlySummary(BaseModel):
    month: str
    total_expenses: str
    total_income: str
    total_transfers: str
    net: str
    by_account: list[dict]


class CategoryBreakdown(BaseModel):
    category_id: int | None
    category_name: str
    parent_name: str | None
    total: str
    count: int


class AnomalyItem(BaseModel):
    category_name: str
    current_month_total: str
    average_total: str
    deviation_pct: str
    direction: str  # "up" or "down"


@router.get("/summary", response_model=MonthlySummary)
def monthly_summary(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    """Get monthly summary: totals for expenses, income, transfers."""
    txns = db.query(Transaction).filter(Transaction.effective_month == month).all()

    expenses = sum(t.amount for t in txns if t.amount < 0 and not t.is_transfer and t.transaction_type != "cc_payment_reconciled")
    income = sum(t.amount for t in txns if t.amount > 0 and not t.is_transfer)
    transfers = sum(abs(t.amount) for t in txns if t.is_transfer)

    # Per account
    by_account = {}
    for t in txns:
        acct_id = t.account_id
        if acct_id not in by_account:
            acct = db.query(Account).filter(Account.id == acct_id).first()
            by_account[acct_id] = {"account": acct.name if acct else "?", "expenses": Decimal(0), "income": Decimal(0)}
        if t.amount < 0 and not t.is_transfer:
            by_account[acct_id]["expenses"] += t.amount
        elif t.amount > 0 and not t.is_transfer:
            by_account[acct_id]["income"] += t.amount

    return MonthlySummary(
        month=month,
        total_expenses=str(expenses),
        total_income=str(income),
        total_transfers=str(transfers),
        net=str(income + expenses),
        by_account=[
            {"account": v["account"], "expenses": str(v["expenses"]), "income": str(v["income"])}
            for v in by_account.values()
        ],
    )


@router.get("/categories", response_model=list[CategoryBreakdown])
def category_breakdown(
    from_month: str = Query(..., description="Start YYYY-MM"),
    to_month: str = Query(..., description="End YYYY-MM"),
    db: Session = Depends(get_db),
):
    """Get expense breakdown by category for a date range."""
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.effective_month >= from_month,
            Transaction.effective_month <= to_month,
            Transaction.amount < 0,
            Transaction.is_transfer == False,
            Transaction.transaction_type != "cc_payment_reconciled",
        )
        .all()
    )

    # Group by category
    by_cat: dict[int | None, list[Transaction]] = {}
    for t in txns:
        by_cat.setdefault(t.category_id, []).append(t)

    result = []
    for cat_id, cat_txns in sorted(by_cat.items(), key=lambda x: sum(t.amount for t in x[1])):
        total = sum(t.amount for t in cat_txns)
        if cat_id:
            cat = db.query(Category).filter(Category.id == cat_id).first()
            cat_name = cat.name if cat else "?"
            parent = db.query(Category).filter(Category.id == cat.parent_id).first() if cat and cat.parent_id else None
            parent_name = parent.name if parent else None
        else:
            cat_name = "Non catégorisé"
            parent_name = None

        result.append(CategoryBreakdown(
            category_id=cat_id,
            category_name=cat_name,
            parent_name=parent_name,
            total=str(total),
            count=len(cat_txns),
        ))

    return result


@router.get("/comparison")
def period_comparison(
    period1_from: str = Query(...),
    period1_to: str = Query(...),
    period2_from: str = Query(...),
    period2_to: str = Query(...),
    db: Session = Depends(get_db),
):
    """Compare expenses between two periods by category."""

    def get_totals(from_m: str, to_m: str) -> dict[str, Decimal]:
        txns = (
            db.query(Transaction)
            .filter(
                Transaction.effective_month >= from_m,
                Transaction.effective_month <= to_m,
                Transaction.amount < 0,
                Transaction.is_transfer == False,
                Transaction.transaction_type != "cc_payment_reconciled",
            )
            .all()
        )
        totals: dict[str, Decimal] = {}
        for t in txns:
            if t.category_id:
                cat = db.query(Category).filter(Category.id == t.category_id).first()
                name = cat.name if cat else "?"
            else:
                name = "Non catégorisé"
            totals[name] = totals.get(name, Decimal(0)) + t.amount
        return totals

    totals1 = get_totals(period1_from, period1_to)
    totals2 = get_totals(period2_from, period2_to)

    all_cats = set(totals1.keys()) | set(totals2.keys())
    return [
        {
            "category": cat,
            "period1": str(totals1.get(cat, Decimal(0))),
            "period2": str(totals2.get(cat, Decimal(0))),
            "diff": str(totals2.get(cat, Decimal(0)) - totals1.get(cat, Decimal(0))),
        }
        for cat in sorted(all_cats)
    ]


@router.get("/anomalies", response_model=list[AnomalyItem])
def detect_anomalies(
    month: str = Query(..., description="YYYY-MM to check"),
    threshold_pct: float = Query(30, description="Deviation % to flag"),
    db: Session = Depends(get_db),
):
    """Detect categories with anomalous spending vs their historical average."""
    # Get all months with data
    months_query = (
        db.query(Transaction.effective_month)
        .filter(Transaction.amount < 0, Transaction.is_transfer == False)
        .distinct()
        .all()
    )
    all_months = sorted(set(m[0] for m in months_query))

    if month not in all_months or len(all_months) < 2:
        return []

    # Historical months (exclude current)
    hist_months = [m for m in all_months if m != month]

    # Get current month by category
    current_txns = (
        db.query(Transaction)
        .filter(
            Transaction.effective_month == month,
            Transaction.amount < 0,
            Transaction.is_transfer == False,
            Transaction.category_id.is_not(None),
            Transaction.transaction_type != "cc_payment_reconciled",
        )
        .all()
    )
    current_by_cat: dict[int, Decimal] = {}
    for t in current_txns:
        current_by_cat[t.category_id] = current_by_cat.get(t.category_id, Decimal(0)) + abs(t.amount)

    # Get historical averages by category
    hist_txns = (
        db.query(Transaction)
        .filter(
            Transaction.effective_month.in_(hist_months),
            Transaction.amount < 0,
            Transaction.is_transfer == False,
            Transaction.category_id.is_not(None),
            Transaction.transaction_type != "cc_payment_reconciled",
        )
        .all()
    )
    hist_by_cat_month: dict[int, dict[str, Decimal]] = {}
    for t in hist_txns:
        hist_by_cat_month.setdefault(t.category_id, {})
        m = t.effective_month
        hist_by_cat_month[t.category_id][m] = hist_by_cat_month[t.category_id].get(m, Decimal(0)) + abs(t.amount)

    anomalies = []
    for cat_id, current_total in current_by_cat.items():
        month_totals = hist_by_cat_month.get(cat_id, {})
        if not month_totals:
            continue
        avg = sum(month_totals.values()) / len(month_totals)
        if avg == 0:
            continue

        deviation = ((current_total - avg) / avg) * 100
        if abs(deviation) >= Decimal(str(threshold_pct)):
            cat = db.query(Category).filter(Category.id == cat_id).first()
            anomalies.append(AnomalyItem(
                category_name=cat.name if cat else "?",
                current_month_total=str(current_total),
                average_total=str(round(avg, 2)),
                deviation_pct=str(round(deviation, 1)),
                direction="up" if deviation > 0 else "down",
            ))

    return sorted(anomalies, key=lambda a: abs(Decimal(a.deviation_pct)), reverse=True)


@router.get("/trends")
def category_trends(
    category_id: int = Query(...),
    months: int = Query(12, description="Number of months to show"),
    db: Session = Depends(get_db),
):
    """Get monthly spending trend for a specific category."""
    all_months = (
        db.query(Transaction.effective_month)
        .filter(Transaction.category_id == category_id)
        .distinct()
        .order_by(Transaction.effective_month.desc())
        .limit(months)
        .all()
    )

    result = []
    for (m,) in reversed(all_months):
        total = (
            db.query(func.sum(Transaction.amount))
            .filter(Transaction.category_id == category_id, Transaction.effective_month == m)
            .scalar()
        ) or Decimal(0)
        result.append({"month": m, "total": str(total)})

    return result
