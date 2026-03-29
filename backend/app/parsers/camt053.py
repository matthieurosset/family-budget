"""Parser for camt.053 (ISO 20022) bank statement XML files."""

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

from lxml import etree

NS = {"c": "urn:iso:std:iso:20022:tech:xsd:camt.053.001.04"}

# Patterns for transaction type detection
CARD_PATTERN = re.compile(r"Num[eé]ro de carte", re.IGNORECASE)
TWINT_DEBIT_PATTERN = re.compile(r"D[eé]bit TWINT\s+(.+?)(?:\s+\d{10,})?$", re.IGNORECASE)
TWINT_CREDIT_PATTERN = re.compile(r"Cr[eé]dit TWINT\s+(.+?)(?:\s+\d{10,})?$", re.IGNORECASE)
CARD_MERCHANT_PATTERN = re.compile(
    r"(?:Paiement\s+)?\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\s+(.+?)\s+Num[eé]ro de carte",
    re.IGNORECASE,
)
WITHDRAWAL_PATTERN = re.compile(r"Retrait\s+BM", re.IGNORECASE)
STANDING_ORDER_PATTERN = re.compile(r"Ordre\s+(?:permanent|e-banking)", re.IGNORECASE)


@dataclass
class ParsedTransaction:
    """A single parsed transaction from a camt.053 file."""

    date: date
    value_date: date | None
    amount: Decimal
    currency: str
    is_debit: bool
    description: str
    merchant_name: str | None
    transaction_type: str  # card_payment, twint, standing_order, salary, transfer, withdrawal, e_banking, credit, other
    bank_reference: str
    debtor_name: str | None = None
    creditor_name: str | None = None
    creditor_iban: str | None = None
    is_transfer: bool = False


@dataclass
class ParsedStatement:
    """A parsed camt.053 bank statement."""

    iban: str
    currency: str
    owner_name: str
    bank_name: str
    opening_balance: Decimal
    closing_balance: Decimal
    from_date: date
    to_date: date
    transactions: list[ParsedTransaction] = field(default_factory=list)


def _text(element: etree._Element | None, xpath: str) -> str | None:
    """Extract text from an XPath relative to element."""
    if element is None:
        return None
    nodes = element.xpath(xpath, namespaces=NS)
    if nodes:
        text = nodes[0].text if hasattr(nodes[0], "text") else str(nodes[0])
        return text.strip() if text else None
    return None


def _decimal(element: etree._Element | None, xpath: str) -> Decimal | None:
    """Extract a decimal value from an XPath."""
    text = _text(element, xpath)
    return Decimal(text) if text else None


def _date(element: etree._Element | None, xpath: str) -> date | None:
    """Extract a date from an XPath. Handles both date and datetime strings."""
    text = _text(element, xpath)
    if not text:
        return None
    # Handle datetime strings like '2026-02-27T00:00:00'
    return date.fromisoformat(text[:10])


def _detect_transaction_type(addtl_tx_info: str | None, addtl_ntry_info: str | None, sub_family: str | None) -> str:
    """Detect the transaction type from available description fields."""
    if sub_family == "SALA":
        return "salary"

    info = addtl_tx_info or addtl_ntry_info or ""

    if CARD_PATTERN.search(info):
        return "card_payment"
    if TWINT_DEBIT_PATTERN.search(info) or TWINT_CREDIT_PATTERN.search(info):
        return "twint"
    if WITHDRAWAL_PATTERN.search(info):
        return "withdrawal"
    if STANDING_ORDER_PATTERN.search(info):
        return "standing_order"

    return "other"


def _extract_merchant(tx_type: str, description: str, creditor_name: str | None) -> str | None:
    """Extract the merchant name based on transaction type."""
    if tx_type == "card_payment":
        m = CARD_MERCHANT_PATTERN.search(description)
        if m:
            return m.group(1).strip()

    if tx_type == "twint":
        m = TWINT_DEBIT_PATTERN.search(description)
        if not m:
            m = TWINT_CREDIT_PATTERN.search(description)
        if m:
            merchant = m.group(1).strip()
            # Remove phone numbers and trailing commas
            merchant = re.sub(r",?\s*\+\d[\d\s]*$", "", merchant).strip()
            return merchant

    if tx_type in ("standing_order", "e_banking", "other") and creditor_name and creditor_name != "NOTPROVIDED":
        return creditor_name

    if creditor_name and creditor_name != "NOTPROVIDED":
        return creditor_name

    return None


def _is_internal_transfer(owner_name: str, debtor_name: str | None, creditor_name: str | None) -> bool:
    """Detect if transaction is an internal transfer between own accounts."""
    if not debtor_name or not creditor_name:
        return False
    if debtor_name == "NOTPROVIDED" or creditor_name == "NOTPROVIDED":
        return False
    # Normalize for comparison: the owner name from statement header
    owner_parts = set(owner_name.lower().split())
    debtor_parts = set(debtor_name.lower().split())
    creditor_parts = set(creditor_name.lower().split())
    # If both debtor and creditor share significant words with the owner
    return len(owner_parts & debtor_parts) >= 2 and len(owner_parts & creditor_parts) >= 2


def _parse_entry_transactions(
    entry: etree._Element,
    owner_name: str,
    booking_date: date,
    value_date: date | None,
    is_debit: bool,
    entry_currency: str,
    entry_ref: str,
    addtl_ntry_info: str | None,
    sub_family: str | None,
) -> list[ParsedTransaction]:
    """Parse transactions from a single Ntry element, handling batches."""
    transactions = []
    tx_details_list = entry.xpath("c:NtryDtls/c:TxDtls", namespaces=NS)

    if not tx_details_list:
        # No TxDtls (e.g., salary batch without details) — create one tx from entry-level data
        tx_type = _detect_transaction_type(None, addtl_ntry_info, sub_family)
        amount = _decimal(entry, "c:Amt") or Decimal(0)
        description = addtl_ntry_info or ""

        transactions.append(
            ParsedTransaction(
                date=booking_date,
                value_date=value_date,
                amount=amount,
                currency=entry_currency,
                is_debit=is_debit,
                description=description,
                merchant_name=None,
                transaction_type=tx_type,
                bank_reference=entry_ref,
            )
        )
        return transactions

    for tx_dtls in tx_details_list:
        tx_ref = _text(tx_dtls, "c:Refs/c:AcctSvcrRef") or entry_ref
        tx_amount = _decimal(tx_dtls, "c:Amt") or _decimal(entry, "c:Amt") or Decimal(0)
        tx_currency = _text(tx_dtls, "c:Amt/@Ccy") or entry_currency
        tx_is_debit = (_text(tx_dtls, "c:CdtDbtInd") or ("DBIT" if is_debit else "CRDT")) == "DBIT"

        debtor_name = _text(tx_dtls, "c:RltdPties/c:Dbtr/c:Nm")
        creditor_name = _text(tx_dtls, "c:RltdPties/c:Cdtr/c:Nm")
        creditor_iban = _text(tx_dtls, "c:RltdPties/c:CdtrAcct/c:Id/c:IBAN")

        addtl_tx_info = _text(tx_dtls, "c:AddtlTxInf")
        rmt_ustrd = _text(tx_dtls, "c:RmtInf/c:Ustrd")
        description = addtl_tx_info or rmt_ustrd or addtl_ntry_info or ""

        tx_type = _detect_transaction_type(addtl_tx_info, addtl_ntry_info, sub_family)
        merchant = _extract_merchant(tx_type, description, creditor_name)
        is_transfer = _is_internal_transfer(owner_name, debtor_name, creditor_name)

        transactions.append(
            ParsedTransaction(
                date=booking_date,
                value_date=value_date,
                amount=tx_amount,
                currency=tx_currency,
                is_debit=tx_is_debit,
                description=description,
                merchant_name=merchant,
                transaction_type=tx_type,
                bank_reference=tx_ref,
                debtor_name=debtor_name,
                creditor_name=creditor_name,
                creditor_iban=creditor_iban,
                is_transfer=is_transfer,
            )
        )

    return transactions


def parse_camt053(file_path: str | Path) -> ParsedStatement:
    """Parse a camt.053 XML file and return a structured statement."""
    tree = etree.parse(str(file_path))
    stmt = tree.xpath("//c:Stmt", namespaces=NS)[0]

    # Account info
    iban = _text(stmt, "c:Acct/c:Id/c:IBAN") or ""
    currency = _text(stmt, "c:Acct/c:Ccy") or "CHF"
    owner_name = _text(stmt, "c:Acct/c:Ownr/c:Nm") or ""
    bank_name = _text(stmt, "c:Acct/c:Svcr/c:FinInstnId/c:Nm") or ""

    # Balances
    opening_balance = Decimal(0)
    closing_balance = Decimal(0)
    for bal in stmt.xpath("c:Bal", namespaces=NS):
        bal_type = _text(bal, "c:Tp/c:CdOrPrtry/c:Cd")
        bal_amount = _decimal(bal, "c:Amt") or Decimal(0)
        if bal_type == "OPBD":
            opening_balance = bal_amount
        elif bal_type == "CLBD":
            closing_balance = bal_amount

    # Date range
    from_date = _date(stmt, "c:FrToDt/c:FrDtTm") or _date(stmt, "c:FrToDt/c:FrDt") or date.min
    to_date = _date(stmt, "c:FrToDt/c:ToDtTm") or _date(stmt, "c:FrToDt/c:ToDt") or date.max

    # Parse all entries
    all_transactions: list[ParsedTransaction] = []
    for entry in stmt.xpath("c:Ntry", namespaces=NS):
        booking_date = _date(entry, "c:BookgDt/c:Dt") or from_date
        val_date = _date(entry, "c:ValDt/c:Dt")
        entry_currency = _text(entry, "c:Amt/@Ccy") or currency
        is_debit = _text(entry, "c:CdtDbtInd") == "DBIT"
        entry_ref = _text(entry, "c:AcctSvcrRef") or ""
        addtl_ntry_info = _text(entry, "c:AddtlNtryInf")

        sub_family = _text(entry, "c:BkTxCd/c:Domn/c:Fmly/c:SubFmlyCd")

        txns = _parse_entry_transactions(
            entry=entry,
            owner_name=owner_name,
            booking_date=booking_date,
            value_date=val_date,
            is_debit=is_debit,
            entry_currency=entry_currency,
            entry_ref=entry_ref,
            addtl_ntry_info=addtl_ntry_info,
            sub_family=sub_family,
        )
        all_transactions.extend(txns)

    return ParsedStatement(
        iban=iban,
        currency=currency,
        owner_name=owner_name,
        bank_name=bank_name,
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        from_date=from_date,
        to_date=to_date,
        transactions=all_transactions,
    )
