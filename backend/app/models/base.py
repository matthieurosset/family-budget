from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # checking / savings / credit_card
    iban: Mapped[str | None] = mapped_column(String(34))
    currency: Mapped[str] = mapped_column(String(3), default="CHF")

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    month_shift_days: Mapped[int | None] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    parent: Mapped["Category | None"] = relationship(back_populates="children", remote_side="Category.id")
    children: Mapped[list["Category"]] = relationship(back_populates="parent")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
    mapping_rules: Mapped[list["MappingRule"]] = relationship(back_populates="category")


class VisecaCategoryMapping(Base):
    __tablename__ = "viseca_category_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    viseca_category: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))

    category: Mapped["Category | None"] = relationship()


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / processed / validated
    files: Mapped[str | None] = mapped_column(Text)  # JSON list of filenames

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="import_batch")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[date | None] = mapped_column(Date)
    effective_month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM after shift
    description: Mapped[str] = mapped_column(Text, nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    original_currency: Mapped[str | None] = mapped_column(String(3))
    original_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="CHF")
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    parent_transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"))
    note: Mapped[str | None] = mapped_column(Text)
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False)
    transaction_type: Mapped[str | None] = mapped_column(String(30))  # card_payment, twint, standing_order, salary, transfer, etc.
    bank_reference: Mapped[str | None] = mapped_column(String(100), unique=True)
    import_batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batches.id"))

    account: Mapped["Account"] = relationship(back_populates="transactions")
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    parent_transaction: Mapped["Transaction | None"] = relationship(remote_side="Transaction.id")
    import_batch: Mapped["ImportBatch | None"] = relationship(back_populates="transactions")


class MappingRule(Base):
    __tablename__ = "mapping_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pattern: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual / viseca / claude_code / actual_budget

    category: Mapped["Category"] = relationship(back_populates="mapping_rules")


class AnnualEnvelope(Base):
    __tablename__ = "annual_envelopes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    monthly_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="CHF")
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))

    category: Mapped["Category | None"] = relationship()
    envelope_transactions: Mapped[list["AnnualEnvelopeTransaction"]] = relationship(back_populates="envelope")


class AnnualEnvelopeTransaction(Base):
    __tablename__ = "annual_envelope_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    envelope_id: Mapped[int] = mapped_column(ForeignKey("annual_envelopes.id"), nullable=False)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"))
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # provision / expense
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    envelope: Mapped["AnnualEnvelope"] = relationship(back_populates="envelope_transactions")
    transaction: Mapped["Transaction | None"] = relationship()
