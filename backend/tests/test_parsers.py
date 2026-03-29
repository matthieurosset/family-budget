"""Tests for camt.053 and Viseca PDF parsers using real example files."""

from decimal import Decimal
from pathlib import Path

import pytest

from app.parsers.camt053 import parse_camt053
from app.parsers.viseca_pdf import parse_viseca_pdf

DOCS_DIR = Path(__file__).parent.parent.parent / "docs"
CAMT_FILE = DOCS_DIR / "00768_CAMT053_CH7300768300155281005_20260329155722_702758618___.xml"
VISECA_FILE = DOCS_DIR / "viseca-payment-services-ag-2026-03-14-f12a46b3797f4508a84d4698f9722345.pdf"


# ───── camt.053 Parser Tests ─────


@pytest.fixture
def camt_statement():
    if not CAMT_FILE.exists():
        pytest.skip("camt.053 example file not available")
    return parse_camt053(CAMT_FILE)


def test_camt_account_info(camt_statement):
    assert camt_statement.iban == "CH7300768300155281005"
    assert camt_statement.currency == "CHF"
    assert "Rosset" in camt_statement.owner_name
    assert "Fribourg" in camt_statement.bank_name


def test_camt_balances(camt_statement):
    assert camt_statement.opening_balance == Decimal("17636.51")
    assert camt_statement.closing_balance == Decimal("16019.19")


def test_camt_date_range(camt_statement):
    assert camt_statement.from_date.year == 2026
    assert camt_statement.to_date.year == 2026


def test_camt_transaction_count(camt_statement):
    # 171 entries, but some batches expand (7 + 8 sub-txns = 15 extra)
    assert len(camt_statement.transactions) > 171


def test_camt_transaction_types(camt_statement):
    types = {t.transaction_type for t in camt_statement.transactions}
    assert "card_payment" in types
    assert "twint" in types
    assert "standing_order" in types
    assert "salary" in types


def test_camt_card_payment_merchant(camt_statement):
    card_txns = [t for t in camt_statement.transactions if t.transaction_type == "card_payment"]
    assert len(card_txns) > 0
    # At least some should have a merchant name extracted
    with_merchant = [t for t in card_txns if t.merchant_name]
    assert len(with_merchant) > 0


def test_camt_twint_merchant(camt_statement):
    twint_txns = [t for t in camt_statement.transactions if t.transaction_type == "twint"]
    assert len(twint_txns) > 0
    with_merchant = [t for t in twint_txns if t.merchant_name]
    assert len(with_merchant) > 0


def test_camt_salary(camt_statement):
    salary_txns = [t for t in camt_statement.transactions if t.transaction_type == "salary"]
    assert len(salary_txns) == 1
    assert salary_txns[0].amount == Decimal("16089.2")
    assert salary_txns[0].is_debit is False


def test_camt_standing_order_batch(camt_statement):
    so_txns = [t for t in camt_statement.transactions if t.transaction_type == "standing_order"]
    # The batch of 7 should produce 7 individual transactions
    assert len(so_txns) >= 7


def test_camt_internal_transfers(camt_statement):
    transfers = [t for t in camt_statement.transactions if t.is_transfer]
    assert len(transfers) > 0


def test_camt_unique_references(camt_statement):
    refs = [t.bank_reference for t in camt_statement.transactions if t.bank_reference]
    assert len(refs) == len(set(refs)), "Non-empty bank references should be unique"


def test_camt_debit_credit_consistency(camt_statement):
    total_debits = sum(t.amount for t in camt_statement.transactions if t.is_debit)
    total_credits = sum(t.amount for t in camt_statement.transactions if not t.is_debit)
    net = total_credits - total_debits
    expected_net = camt_statement.closing_balance - camt_statement.opening_balance
    assert abs(net - expected_net) < Decimal("0.02"), f"Net {net} != expected {expected_net}"


# ───── Viseca PDF Parser Tests ─────


@pytest.fixture
def viseca_statement():
    if not VISECA_FILE.exists():
        pytest.skip("Viseca PDF example file not available")
    return parse_viseca_pdf(VISECA_FILE)


def test_viseca_statement_date(viseca_statement):
    assert viseca_statement.statement_date is not None
    assert viseca_statement.statement_date.year == 2026


def test_viseca_total(viseca_statement):
    assert viseca_statement.total_amount == Decimal("2459.10")


def test_viseca_calculated_total(viseca_statement):
    calculated = sum(t.amount_chf for t in viseca_statement.transactions)
    assert calculated == viseca_statement.total_amount


def test_viseca_two_cards(viseca_statement):
    assert len(viseca_statement.cards) == 2
    cardholders = set(viseca_statement.cards.values())
    assert any("Matthieu" in h for h in cardholders)
    assert any("Natalija" in h for h in cardholders)


def test_viseca_transaction_count(viseca_statement):
    assert len(viseca_statement.transactions) == 26


def test_viseca_categories(viseca_statement):
    categories = {t.viseca_category for t in viseca_statement.transactions if t.viseca_category}
    assert len(categories) > 5  # Should have diverse categories
    # Check some known categories exist
    category_text = " ".join(categories)
    assert "Restaurants" in category_text or "bistros" in category_text


def test_viseca_foreign_currency(viseca_statement):
    foreign = [t for t in viseca_statement.transactions if t.original_currency]
    assert len(foreign) > 0
    jpy_txn = [t for t in foreign if t.original_currency == "JPY"]
    assert len(jpy_txn) == 1
    assert jpy_txn[0].original_amount == Decimal("2280.00")


def test_viseca_refunds(viseca_statement):
    refunds = [t for t in viseca_statement.transactions if t.is_refund]
    assert len(refunds) == 3  # 3 Zalando refunds
    for r in refunds:
        assert r.amount_chf < 0


def test_viseca_per_card_totals(viseca_statement):
    from collections import defaultdict

    by_card = defaultdict(Decimal)
    for t in viseca_statement.transactions:
        by_card[t.card_number] += t.amount_chf

    card_totals = sorted(by_card.values())
    assert Decimal("422.20") in card_totals
    assert Decimal("2036.90") in card_totals
