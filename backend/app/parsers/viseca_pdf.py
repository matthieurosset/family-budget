"""Parser for Viseca credit card PDF statements."""

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

import pdfplumber

# Regex patterns
DATE_PAIR = re.compile(r"^(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(.+)")
CARD_HEADER = re.compile(r"^(\d{4}\s+\d{2}XX\s+XXXX\s+\d{4})\s+Carte de cr.dit.*?,\s*(.+)")
CARD_TOTAL = re.compile(r"^Total carte\s+.+\s+([\d']+\.\d{2})")
REPORT_LINE = re.compile(r"^(?:Report total|Total interm.diaire(?:\s+de la carte)?)\s+([\d']+\.\d{2})")
GRAND_TOTAL = re.compile(r"^Montant total de la facture.+\s+([\d']+\.\d{2})")
PREVIOUS_BALANCE = re.compile(r"^.+Montant total dernier relev.\s+([\d']+\.\d{2})")
PAYMENT_LINE = re.compile(r"^.+Votre paiement.+\s+([\d']+\.\d{2})-?")
CONVERSION_LINE = re.compile(r"^Taux de conversion")
FLIGHT_INFO = re.compile(r"^(?:Num.ro du billet|Passager|Date de d.part|Lieu de d.part|Destination|Point de vente)")
AMOUNT_PATTERN = re.compile(r"([\d']+\.\d{2})-?$")

# Known 2-letter country codes that appear at end of merchant line
COUNTRY_CODES = {
    "CH", "DE", "FR", "IT", "AT", "US", "GB", "NL", "SE", "JP", "IE",
    "ES", "PT", "BE", "LU", "CA", "AU", "NO", "DK", "FI", "PL", "CZ",
}

# Currency codes (3 letters) for foreign transactions
CURRENCY_CODES = {
    "EUR", "USD", "GBP", "JPY", "SEK", "NOK", "DKK", "PLN", "CZK",
    "CAD", "AUD", "CHF", "CNY", "HKD", "SGD", "THB", "INR", "BRL",
}


@dataclass
class VisecaTransaction:
    """A single parsed transaction from a Viseca PDF statement."""

    transaction_date: date
    value_date: date
    description: str  # merchant + location
    merchant_name: str
    country_code: str
    viseca_category: str
    amount_chf: Decimal
    original_currency: str | None = None  # None if CHF
    original_amount: Decimal | None = None
    cardholder: str = ""
    card_number: str = ""
    is_refund: bool = False


@dataclass
class VisecaStatement:
    """A parsed Viseca credit card statement."""

    statement_date: date | None = None
    total_amount: Decimal = Decimal(0)
    transactions: list[VisecaTransaction] = field(default_factory=list)
    cards: dict[str, str] = field(default_factory=dict)  # card_number -> cardholder


def _parse_amount(text: str) -> Decimal:
    """Parse Swiss-formatted amount (e.g., '1\\'667.20' or '58.00-')."""
    clean = text.replace("'", "").replace("\u2019", "").strip()
    is_negative = clean.endswith("-")
    if is_negative:
        clean = clean[:-1]
    amount = Decimal(clean)
    return -amount if is_negative else amount


def _parse_date(text: str, century: int = 2000) -> date:
    """Parse DD.MM.YY date format."""
    parts = text.split(".")
    day, month, year = int(parts[0]), int(parts[1]), century + int(parts[2])
    return date(year, month, day)


def _extract_amount_and_currency(detail_part: str) -> tuple[str, str, Decimal, str | None, Decimal | None]:
    """Extract merchant description, country, CHF amount, optional currency and foreign amount.

    Returns: (merchant_desc, country_code, amount_chf, original_currency, original_amount)
    """
    parts = detail_part.rstrip().split()
    if not parts:
        return detail_part, "", Decimal(0), None, None

    # Find the CHF amount (always last, possibly with trailing -)
    amount_chf = Decimal(0)
    amount_str = parts[-1].replace("'", "").replace("\u2019", "")
    is_negative = amount_str.endswith("-")
    if is_negative:
        amount_str = amount_str[:-1]

    try:
        amount_chf = Decimal(amount_str)
        if is_negative:
            amount_chf = -amount_chf
        remaining = parts[:-1]
    except Exception:
        return detail_part, "", Decimal(0), None, None

    # Check for foreign currency: ... COUNTRY CURRENCY FOREIGN_AMOUNT CHF_AMOUNT
    # After removing CHF_AMOUNT, remaining ends with: ... COUNTRY CURRENCY FOREIGN_AMOUNT
    original_currency = None
    original_amount = None
    country_code = ""

    if len(remaining) >= 2:
        potential_foreign = remaining[-1].replace("'", "").replace("\u2019", "")
        potential_currency = remaining[-2]

        if potential_currency in CURRENCY_CODES:
            try:
                original_amount = Decimal(potential_foreign)
                original_currency = potential_currency
                remaining = remaining[:-2]
            except Exception:
                pass

    # Country code is the last remaining token if it's a 2-letter code
    if remaining and remaining[-1] in COUNTRY_CODES:
        country_code = remaining[-1]
        remaining = remaining[:-1]

    merchant_desc = " ".join(remaining)
    return merchant_desc, country_code, amount_chf, original_currency, original_amount


def parse_viseca_pdf(file_path: str | Path) -> VisecaStatement:
    """Parse a Viseca credit card PDF statement."""
    statement = VisecaStatement()

    all_lines: list[str] = []
    with pdfplumber.open(str(file_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                all_lines.extend(text.split("\n"))

    # Extract statement date from header
    for line in all_lines:
        if "Facture du" in line:
            m = re.search(r"Facture du (\d{2}\.\d{2}\.\d{4})", line)
            if m:
                parts = m.group(1).split(".")
                statement.statement_date = date(int(parts[2]), int(parts[1]), int(parts[0]))
            break

    # Parse transactions
    current_card_number = ""
    current_cardholder = ""
    i = 0
    while i < len(all_lines):
        line = all_lines[i].strip()

        # Card header
        card_match = CARD_HEADER.match(line)
        if card_match:
            current_card_number = card_match.group(1).replace(" ", "")
            current_cardholder = card_match.group(2).strip()
            statement.cards[current_card_number] = current_cardholder
            i += 1
            continue

        # Skip non-transaction lines
        if (
            CARD_TOTAL.match(line)
            or REPORT_LINE.match(line)
            or PREVIOUS_BALANCE.match(line)
            or PAYMENT_LINE.match(line)
            or CONVERSION_LINE.match(line)
            or FLIGHT_INFO.match(line)
            or GRAND_TOTAL.match(line)
        ):
            i += 1
            continue

        # Transaction line: DD.MM.YY DD.MM.YY details
        date_match = DATE_PAIR.match(line)
        if date_match:
            tx_date_str = date_match.group(1)
            val_date_str = date_match.group(2)
            detail_part = date_match.group(3)

            tx_date = _parse_date(tx_date_str)
            val_date = _parse_date(val_date_str)

            merchant_desc, country, amount_chf, orig_curr, orig_amt = _extract_amount_and_currency(detail_part)

            # Next line should be the category (unless it's a special line)
            category = ""
            if i + 1 < len(all_lines):
                next_line = all_lines[i + 1].strip()
                if (
                    not DATE_PAIR.match(next_line)
                    and not CARD_HEADER.match(next_line)
                    and not CARD_TOTAL.match(next_line)
                    and not REPORT_LINE.match(next_line)
                    and not CONVERSION_LINE.match(next_line)
                    and not GRAND_TOTAL.match(next_line)
                    and not FLIGHT_INFO.match(next_line)
                    and not next_line.startswith("Page ")
                    and not next_line.startswith("Banque Migros")
                    and not next_line.startswith("Limite de carte")
                    and next_line
                ):
                    category = next_line
                    i += 1  # skip category line

            # Extract merchant name (before location comma)
            merchant_name = merchant_desc.split(",")[0].strip() if merchant_desc else ""

            statement.transactions.append(
                VisecaTransaction(
                    transaction_date=tx_date,
                    value_date=val_date,
                    description=merchant_desc,
                    merchant_name=merchant_name,
                    country_code=country,
                    viseca_category=category,
                    amount_chf=amount_chf,
                    original_currency=orig_curr,
                    original_amount=orig_amt,
                    cardholder=current_cardholder,
                    card_number=current_card_number,
                    is_refund=amount_chf < 0,
                )
            )

        i += 1

    # Extract grand total
    for line in all_lines:
        m = GRAND_TOTAL.match(line.strip())
        if m:
            statement.total_amount = _parse_amount(m.group(1))
            break

    return statement
