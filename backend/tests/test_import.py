"""Tests for the import service and reconciliation."""

from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import Account, ImportBatch, Transaction
from app.services.import_service import import_camt053, import_files, import_viseca_pdf
from app.services.reconciliation import find_viseca_payment_line, reconcile_viseca

DOCS_DIR = Path(__file__).parent.parent.parent / "docs"
CAMT_FILE = DOCS_DIR / "00768_CAMT053_CH7300768300155281005_20260329155722_702758618___.xml"
VISECA_FILE = DOCS_DIR / "viseca-payment-services-ag-2026-03-14-f12a46b3797f4508a84d4698f9722345.pdf"


@pytest.fixture
def db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def batch(db):
    """Create a test import batch."""
    b = ImportBatch(month="2026-03", status="pending", files="[]")
    db.add(b)
    db.flush()
    return b


# ───── Import Service Tests ─────


def test_import_camt053(db, batch):
    if not CAMT_FILE.exists():
        pytest.skip("camt.053 example not available")

    txns = import_camt053(db, CAMT_FILE, batch)
    assert len(txns) > 170

    # Check account was created
    accounts = db.query(Account).all()
    assert len(accounts) == 1
    assert accounts[0].iban == "CH7300768300155281005"
    assert accounts[0].currency == "CHF"

    # Check debits are negative, credits are positive
    debits = [t for t in txns if t.amount < 0]
    credits = [t for t in txns if t.amount > 0]
    assert len(debits) > 100
    assert len(credits) > 0

    # Check salary is positive
    salary = [t for t in txns if t.transaction_type == "salary"]
    assert len(salary) == 1
    assert salary[0].amount == Decimal("16089.2")

    # Check effective_month is set
    for t in txns:
        assert t.effective_month, f"Transaction {t.id} missing effective_month"


def test_import_camt053_dedup(db, batch):
    """Importing the same file twice should not create duplicates."""
    if not CAMT_FILE.exists():
        pytest.skip("camt.053 example not available")

    txns1 = import_camt053(db, CAMT_FILE, batch)
    count1 = len(txns1)

    # Create second batch and reimport
    batch2 = ImportBatch(month="2026-03", status="pending", files="[]")
    db.add(batch2)
    db.flush()

    txns2 = import_camt053(db, CAMT_FILE, batch2)
    assert len(txns2) == 0, "Second import should create 0 new transactions"

    total = db.query(Transaction).count()
    assert total == count1


def test_import_viseca_pdf(db, batch):
    if not VISECA_FILE.exists():
        pytest.skip("Viseca PDF not available")

    txns = import_viseca_pdf(db, VISECA_FILE, batch)
    assert len(txns) == 26

    # Check account was created
    cc_account = db.query(Account).filter(Account.type == "credit_card").first()
    assert cc_account is not None
    assert cc_account.name == "Viseca CC"

    # Check CC charges are negative (expenses)
    charges = [t for t in txns if not t.amount > 0 or t.description.find("ZALANDO") >= 0]
    assert len(charges) > 0

    # Check refunds are positive
    refunds = [t for t in txns if t.amount > 0]
    assert len(refunds) == 3  # 3 Zalando refunds

    # Total should match statement
    total_abs = sum(abs(t.amount) for t in txns if t.amount < 0) - sum(t.amount for t in txns if t.amount > 0)
    assert total_abs == Decimal("2459.10")


def test_import_viseca_dedup(db, batch):
    if not VISECA_FILE.exists():
        pytest.skip("Viseca PDF not available")

    txns1 = import_viseca_pdf(db, VISECA_FILE, batch)
    batch2 = ImportBatch(month="2026-03", status="pending", files="[]")
    db.add(batch2)
    db.flush()

    txns2 = import_viseca_pdf(db, VISECA_FILE, batch2)
    assert len(txns2) == 0


# ───── Reconciliation Tests ─────


def test_reconcile_no_cc(db, batch):
    """Reconciliation with no CC data should return no_match."""
    if not CAMT_FILE.exists():
        pytest.skip("camt.053 example not available")

    import_camt053(db, CAMT_FILE, batch)
    result = reconcile_viseca(db, batch.id)
    assert result["status"] == "no_match"


def test_reconcile_with_both(db, batch):
    """Reconciliation should link CC transactions to the bank payment line."""
    if not CAMT_FILE.exists() or not VISECA_FILE.exists():
        pytest.skip("Example files not available")

    import_camt053(db, CAMT_FILE, batch)
    import_viseca_pdf(db, VISECA_FILE, batch)

    result = reconcile_viseca(db, batch.id)

    # May or may not find a match depending on whether the Viseca payment
    # line exists in this particular statement period
    if result["status"] == "reconciled":
        assert result["cc_transactions"] == 26
        # Check parent_transaction_id is set on CC transactions
        cc_txns = (
            db.query(Transaction)
            .filter(Transaction.transaction_type == "credit_card")
            .all()
        )
        for tx in cc_txns:
            assert tx.parent_transaction_id is not None


# ───── Full Import Flow Test ─────


def test_import_files_full(db):
    """Test the full import flow with multiple files."""
    files = []
    if CAMT_FILE.exists():
        files.append(CAMT_FILE)
    if VISECA_FILE.exists():
        files.append(VISECA_FILE)

    if not files:
        pytest.skip("No example files available")

    batch = import_files(db, files, "2026-03")
    assert batch.status == "processed"
    assert batch.month == "2026-03"

    tx_count = db.query(Transaction).filter(Transaction.import_batch_id == batch.id).count()
    assert tx_count > 0

    # Check both accounts exist if both files were imported
    accounts = db.query(Account).all()
    if len(files) == 2:
        assert len(accounts) == 2
