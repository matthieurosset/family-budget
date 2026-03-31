"""API routes for categories, mapping rules, and categorization."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, MappingRule, VisecaCategoryMapping
from app.services.actual_budget_migration import migrate_from_actual_budget
from app.services.categorization import (
    apply_month_shifts,
    apply_rules,
    apply_viseca_mappings,
)

router = APIRouter(tags=["categories"])


# ───── Schemas ─────


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    month_shift_days: int | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    month_shift_days: int | None = None
    sort_order: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: int | None
    month_shift_days: int | None
    sort_order: int
    children: list["CategoryResponse"] = []

    class Config:
        from_attributes = True


class RuleCreate(BaseModel):
    pattern: str
    category_id: int
    priority: int = 0
    min_amount: float | None = None
    max_amount: float | None = None
    direction: str | None = None  # "expense" / "income" / null


class RuleResponse(BaseModel):
    id: int
    pattern: str
    category_id: int
    category_name: str
    priority: int
    min_amount: str | None
    max_amount: str | None
    direction: str | None
    source: str

    class Config:
        from_attributes = True


class VisecaMappingUpdate(BaseModel):
    category_id: int | None


# ───── Category Endpoints ─────


@router.get("/api/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """List all categories as a tree."""
    roots = db.query(Category).filter(Category.parent_id.is_(None)).order_by(Category.sort_order).all()

    def build_tree(cat: Category) -> CategoryResponse:
        children = sorted(cat.children, key=lambda c: c.sort_order)
        return CategoryResponse(
            id=cat.id,
            name=cat.name,
            parent_id=cat.parent_id,
            month_shift_days=cat.month_shift_days,
            sort_order=cat.sort_order,
            children=[build_tree(c) for c in children],
        )

    return [build_tree(r) for r in roots]


@router.post("/api/categories", response_model=CategoryResponse)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id, name=cat.name, parent_id=cat.parent_id,
        month_shift_days=cat.month_shift_days, sort_order=cat.sort_order,
    )


@router.put("/api/categories/{cat_id}", response_model=CategoryResponse)
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id, name=cat.name, parent_id=cat.parent_id,
        month_shift_days=cat.month_shift_days, sort_order=cat.sort_order,
    )


@router.delete("/api/categories/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()
    return {"status": "deleted"}


# ───── Mapping Rules Endpoints ─────


@router.get("/api/rules", response_model=list[RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(MappingRule).order_by(MappingRule.priority.desc(), MappingRule.pattern).all()
    return [
        RuleResponse(
            id=r.id, pattern=r.pattern, category_id=r.category_id,
            category_name=r.category.name if r.category else "", priority=r.priority,
            min_amount=str(r.min_amount) if r.min_amount is not None else None,
            max_amount=str(r.max_amount) if r.max_amount is not None else None,
            direction=r.direction, source=r.source,
        )
        for r in rules
    ]


@router.post("/api/rules", response_model=RuleResponse)
def create_rule(data: RuleCreate, db: Session = Depends(get_db)):
    rule = MappingRule(**data.model_dump(), source="manual")
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return RuleResponse(
        id=rule.id, pattern=rule.pattern, category_id=rule.category_id,
        category_name=rule.category.name, priority=rule.priority,
        min_amount=str(rule.min_amount) if rule.min_amount is not None else None,
        max_amount=str(rule.max_amount) if rule.max_amount is not None else None,
        direction=rule.direction, source=rule.source,
    )


@router.put("/api/rules/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, data: RuleCreate, db: Session = Depends(get_db)):
    rule = db.query(MappingRule).filter(MappingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for field, value in data.model_dump().items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return RuleResponse(
        id=rule.id, pattern=rule.pattern, category_id=rule.category_id,
        category_name=rule.category.name, priority=rule.priority,
        min_amount=str(rule.min_amount) if rule.min_amount is not None else None,
        max_amount=str(rule.max_amount) if rule.max_amount is not None else None,
        direction=rule.direction, source=rule.source,
    )


@router.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(MappingRule).filter(MappingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "deleted"}


# ───── Viseca Mappings Endpoints ─────


@router.get("/api/viseca-mappings")
def list_viseca_mappings(db: Session = Depends(get_db)):
    mappings = db.query(VisecaCategoryMapping).all()
    return [
        {
            "id": m.id,
            "viseca_category": m.viseca_category,
            "category_id": m.category_id,
            "category_name": m.category.name if m.category else None,
        }
        for m in mappings
    ]


@router.put("/api/viseca-mappings/{mapping_id}")
def update_viseca_mapping(mapping_id: int, data: VisecaMappingUpdate, db: Session = Depends(get_db)):
    mapping = db.query(VisecaCategoryMapping).filter(VisecaCategoryMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(404, "Mapping not found")
    mapping.category_id = data.category_id
    db.commit()
    return {"status": "updated"}


# ───── Categorization Actions ─────


@router.post("/api/categorize/apply-rules")
def trigger_apply_rules(db: Session = Depends(get_db)):
    """Apply all mapping rules to uncategorized transactions."""
    return apply_rules(db)


@router.post("/api/categorize/apply-viseca")
def trigger_apply_viseca(db: Session = Depends(get_db)):
    """Apply Viseca category mappings to CC transactions."""
    return apply_viseca_mappings(db)


@router.post("/api/categorize/apply-month-shifts")
def trigger_month_shifts(batch_id: int | None = Query(None), db: Session = Depends(get_db)):
    """Recompute effective_month for categorized transactions."""
    updated = apply_month_shifts(db, batch_id)
    return {"updated": updated}


@router.get("/api/transactions/uncategorized/export")
def export_uncategorized(db: Session = Depends(get_db)):
    """Export uncategorized transactions as Excel for Claude Code."""
    from app.services.categorization import export_uncategorized_excel
    content = export_uncategorized_excel(db)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=a_categoriser.xlsx"},
    )


@router.post("/api/transactions/uncategorized/import")
async def import_categorized(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import categorized transactions from Excel (after Claude Code processing)."""
    from app.services.categorization import import_categorized_excel
    content = await file.read()
    return import_categorized_excel(db, content)


# ───── Migration ─────


@router.post("/api/migrate/actual-budget")
async def trigger_migration(
    file: UploadFile = File(..., description="Actual Budget db.sqlite file"),
    db: Session = Depends(get_db),
):
    """Migrate categories and rules from an uploaded Actual Budget SQLite database."""
    import shutil
    import tempfile

    # Save uploaded file to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".sqlite") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = migrate_from_actual_budget(db, tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return result
