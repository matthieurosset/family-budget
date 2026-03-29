"""Tests for Actual Budget migration, categorization engine, and export/reimport."""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Category, ImportBatch, MappingRule, Transaction, Account, VisecaCategoryMapping
from app.services.actual_budget_migration import migrate_from_actual_budget
from app.services.categorization import (
    apply_month_shifts,
    apply_rules,
    apply_viseca_mappings,
    export_uncategorized_csv,
    import_categorized_csv,
)

DOCS_DIR = Path(__file__).parent.parent.parent / "docs"
AB_DB = DOCS_DIR / "2026-03-29-My Finances" / "db.sqlite"


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


# ───── Actual Budget Migration ─────


def test_migrate_categories(db):
    if not AB_DB.exists():
        pytest.skip("Actual Budget DB not available")

    result = migrate_from_actual_budget(db, AB_DB)
    assert result["status"] == "success"
    assert result["groups_created"] > 8
    assert result["categories_created"] > 30
    assert result["rules_created"] > 15

    # Check hierarchy
    roots = db.query(Category).filter(Category.parent_id.is_(None)).all()
    assert len(roots) == result["groups_created"]

    # Check some known categories exist
    all_cats = db.query(Category).all()
    cat_names = {c.name for c in all_cats}
    assert "Courses" in cat_names
    assert "Restaurants" in cat_names
    assert "Salaire" in cat_names

    # Check rules were created
    rules = db.query(MappingRule).all()
    assert len(rules) == result["rules_created"]
    rule_patterns = {r.pattern for r in rules}
    assert "Coop" in rule_patterns
    assert "Migros" in rule_patterns


def test_migrate_idempotent(db):
    if not AB_DB.exists():
        pytest.skip("Actual Budget DB not available")

    result1 = migrate_from_actual_budget(db, AB_DB)
    assert result1["status"] == "success"

    result2 = migrate_from_actual_budget(db, AB_DB)
    assert result2["status"] == "skipped"


# ───── Rule Application ─────


@pytest.fixture
def seeded_db(db):
    """DB with categories, rules, and sample transactions."""
    # Create categories
    food = Category(name="Alimentation", sort_order=0)
    db.add(food)
    db.flush()
    courses = Category(name="Courses", parent_id=food.id, sort_order=0)
    restaurants = Category(name="Restaurants", parent_id=food.id, sort_order=1)
    db.add_all([courses, restaurants])
    db.flush()

    transport = Category(name="Mobilite", sort_order=1)
    db.add(transport)
    db.flush()
    tc = Category(name="Transports en commun", parent_id=transport.id, sort_order=0)
    db.add(tc)
    db.flush()

    # Create rules
    db.add_all([
        MappingRule(pattern="Coop", category_id=courses.id, source="actual_budget"),
        MappingRule(pattern="Migros", category_id=courses.id, source="actual_budget"),
        MappingRule(pattern="Restaurant", category_id=restaurants.id, source="actual_budget"),
        MappingRule(pattern="Sbb", category_id=tc.id, source="actual_budget"),
    ])

    # Create account and transactions
    account = Account(name="Test", type="checking", currency="CHF")
    db.add(account)
    db.flush()

    batch = ImportBatch(month="2026-03", status="processed", files="[]")
    db.add(batch)
    db.flush()

    txns = [
        Transaction(
            account_id=account.id, date=date(2026, 3, 1), effective_month="2026-03",
            description="Paiement Coop Pronto Granges-Paccot", merchant_name="Coop Pronto",
            amount=Decimal("-45.80"), currency="CHF", import_batch_id=batch.id,
        ),
        Transaction(
            account_id=account.id, date=date(2026, 3, 2), effective_month="2026-03",
            description="Paiement Migros MM Agy Est", merchant_name="Migros MM",
            amount=Decimal("-32.10"), currency="CHF", import_batch_id=batch.id,
        ),
        Transaction(
            account_id=account.id, date=date(2026, 3, 3), effective_month="2026-03",
            description="Restaurant Le Mondial", merchant_name="Le Mondial",
            amount=Decimal("-55.00"), currency="CHF", import_batch_id=batch.id,
        ),
        Transaction(
            account_id=account.id, date=date(2026, 3, 4), effective_month="2026-03",
            description="SBB Mobile Ticket", merchant_name="SBB",
            amount=Decimal("-12.00"), currency="CHF", import_batch_id=batch.id,
        ),
        Transaction(
            account_id=account.id, date=date(2026, 3, 5), effective_month="2026-03",
            description="Unknown merchant xyz", merchant_name="xyz",
            amount=Decimal("-99.00"), currency="CHF", import_batch_id=batch.id,
        ),
    ]
    db.add_all(txns)
    db.commit()
    return db


def test_apply_rules(seeded_db):
    result = apply_rules(seeded_db)
    assert result["categorized"] == 4  # Coop, Migros, Restaurant, Sbb
    assert result["remaining"] == 1  # Unknown


def test_apply_rules_idempotent(seeded_db):
    apply_rules(seeded_db)
    result2 = apply_rules(seeded_db)
    assert result2["categorized"] == 0
    assert result2["total_uncategorized"] == 1


# ───── Viseca Category Mapping ─────


def test_apply_viseca_mappings(db):
    food = Category(name="Alimentation", sort_order=0)
    db.add(food)
    db.flush()
    courses = Category(name="Courses", parent_id=food.id, sort_order=0)
    db.add(courses)
    db.flush()

    db.add(VisecaCategoryMapping(viseca_category="Supermarchés, alimentation", category_id=courses.id))

    account = Account(name="CC", type="credit_card", currency="CHF")
    db.add(account)
    db.flush()

    tx = Transaction(
        account_id=account.id, date=date(2026, 3, 1), effective_month="2026-03",
        description="Coop-2562 Granges- [Supermarchés, alimentation]",
        amount=Decimal("-21.05"), currency="CHF", transaction_type="credit_card",
    )
    db.add(tx)
    db.commit()

    result = apply_viseca_mappings(db)
    assert result["categorized"] == 1
    assert tx.category_id == courses.id


# ───── Month Shift ─────


def test_apply_month_shifts(db):
    cat = Category(name="Factures", month_shift_days=5, sort_order=0)
    db.add(cat)
    db.flush()

    account = Account(name="Test", type="checking", currency="CHF")
    db.add(account)
    db.flush()

    # Transaction on 3rd of April -> should shift to March
    tx1 = Transaction(
        account_id=account.id, date=date(2026, 4, 3), effective_month="2026-04",
        description="Facture", amount=Decimal("-100"), currency="CHF", category_id=cat.id,
    )
    # Transaction on 10th of April -> stays in April
    tx2 = Transaction(
        account_id=account.id, date=date(2026, 4, 10), effective_month="2026-04",
        description="Facture", amount=Decimal("-200"), currency="CHF", category_id=cat.id,
    )
    db.add_all([tx1, tx2])
    db.commit()

    updated = apply_month_shifts(db)
    assert updated == 1
    assert tx1.effective_month == "2026-03"
    assert tx2.effective_month == "2026-04"


def test_month_shift_january(db):
    """Shift from January -> December of previous year."""
    cat = Category(name="Factures", month_shift_days=5, sort_order=0)
    db.add(cat)
    db.flush()

    account = Account(name="Test", type="checking", currency="CHF")
    db.add(account)
    db.flush()

    tx = Transaction(
        account_id=account.id, date=date(2026, 1, 2), effective_month="2026-01",
        description="Facture", amount=Decimal("-100"), currency="CHF", category_id=cat.id,
    )
    db.add(tx)
    db.commit()

    apply_month_shifts(db)
    assert tx.effective_month == "2025-12"


# ───── Export/Reimport Workflow ─────


def test_export_uncategorized(seeded_db):
    csv_content = export_uncategorized_csv(seeded_db)
    lines = csv_content.strip().split("\n")
    assert len(lines) == 6  # header + 5 uncategorized transactions
    assert "id,date,description" in lines[0]


def test_import_categorized(seeded_db):
    courses = seeded_db.query(Category).filter(Category.name == "Courses").first()

    csv_content = (
        "id,category,new_rule_pattern,new_rule_category\n"
        f"5,Courses,xyz,Courses\n"
    )
    # Get ID of the unknown transaction
    unknown = seeded_db.query(Transaction).filter(Transaction.description.contains("Unknown")).first()
    csv_content = f"id,category,new_rule_pattern,new_rule_category\n{unknown.id},Courses,xyz,Courses\n"

    result = import_categorized_csv(seeded_db, csv_content)
    assert result["categorized"] == 1
    assert result["rules_created"] == 1

    # Check the rule was created
    rule = seeded_db.query(MappingRule).filter(MappingRule.pattern == "xyz").first()
    assert rule is not None
    assert rule.source == "claude_code"
    assert rule.category_id == courses.id
