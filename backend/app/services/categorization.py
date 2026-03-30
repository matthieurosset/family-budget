"""Categorization service: applies mapping rules and Viseca categories to transactions."""

import csv
import io
import re
from datetime import date

from sqlalchemy.orm import Session

from app.models import Category, MappingRule, Transaction, VisecaCategoryMapping


def _get_or_create_transfer_category(db: Session) -> int:
    """Get or create a 'Transferts' category for internal transfers."""
    cat = db.query(Category).filter(Category.name == "Transferts", Category.parent_id.is_(None)).first()
    if cat:
        return cat.id
    cat = Category(name="Transferts", parent_id=None, sort_order=999)
    db.add(cat)
    db.flush()
    return cat.id


def apply_rules(db: Session, transaction_ids: list[int] | None = None) -> dict:
    """Apply mapping rules to uncategorized transactions.

    Also auto-categorizes internal transfers.

    If transaction_ids is provided, only process those transactions.
    Otherwise, process all uncategorized transactions.

    Returns a summary of categorization results.
    """
    # Auto-categorize transfers first
    transfer_cat_id = None
    transfer_query = db.query(Transaction).filter(
        Transaction.category_id.is_(None),
        Transaction.is_transfer == True,
    )
    if transaction_ids:
        transfer_query = transfer_query.filter(Transaction.id.in_(transaction_ids))
    uncategorized_transfers = transfer_query.all()

    transfers_categorized = 0
    if uncategorized_transfers:
        transfer_cat_id = _get_or_create_transfer_category(db)
        for tx in uncategorized_transfers:
            tx.category_id = transfer_cat_id
            transfers_categorized += 1

    # Get rules ordered by priority (higher priority first)
    rules = db.query(MappingRule).order_by(MappingRule.priority.desc()).all()

    # Get remaining uncategorized transactions
    query = db.query(Transaction).filter(Transaction.category_id.is_(None))
    if transaction_ids:
        query = query.filter(Transaction.id.in_(transaction_ids))
    uncategorized = query.all()

    categorized_count = 0
    for tx in uncategorized:
        search_text = ((tx.description or "") + " " + (tx.merchant_name or "")).lower()
        tx_abs_amount = abs(tx.amount)

        for rule in rules:
            # Text match
            if rule.pattern.lower() not in search_text:
                continue
            # Direction filter
            if rule.direction == "expense" and tx.amount > 0:
                continue
            if rule.direction == "income" and tx.amount < 0:
                continue
            # Amount filters
            if rule.min_amount is not None and tx_abs_amount < rule.min_amount:
                continue
            if rule.max_amount is not None and tx_abs_amount > rule.max_amount:
                continue
            # All conditions match
            tx.category_id = rule.category_id
            categorized_count += 1
            break

    db.commit()

    # Auto-split envelope transfers and link expenses
    from app.services.envelope_service import auto_split_envelope_transfers, link_all_expenses_to_envelopes
    split_result = auto_split_envelope_transfers(db)
    envelopes_linked = link_all_expenses_to_envelopes(db)

    return {
        "status": "success",
        "categorized": categorized_count + transfers_categorized,
        "transfers": transfers_categorized,
        "rules_matched": categorized_count,
        "envelope_splits": split_result.get("splits", 0),
        "envelopes_linked": envelopes_linked,
        "total_uncategorized": len(uncategorized) + transfers_categorized,
        "remaining": len(uncategorized) - categorized_count,
    }


def apply_viseca_mappings(db: Session, transaction_ids: list[int] | None = None) -> dict:
    """Apply Viseca category mappings to CC transactions.

    Viseca CC transactions have their category embedded in the description
    as "[Category Name]". This function maps those to our categories.
    """
    mappings = db.query(VisecaCategoryMapping).filter(VisecaCategoryMapping.category_id.is_not(None)).all()
    if not mappings:
        return {"status": "no_mappings", "categorized": 0}

    mapping_dict = {m.viseca_category.lower(): m.category_id for m in mappings}

    query = db.query(Transaction).filter(
        Transaction.category_id.is_(None),
        Transaction.transaction_type == "credit_card",
    )
    if transaction_ids:
        query = query.filter(Transaction.id.in_(transaction_ids))
    uncategorized = query.all()

    categorized_count = 0
    for tx in uncategorized:
        # Extract Viseca category from description: "... [Category Name]"
        match = re.search(r"\[([^\]]+)\]$", tx.description or "")
        if match:
            viseca_cat = match.group(1).lower()
            cat_id = mapping_dict.get(viseca_cat)
            if cat_id:
                tx.category_id = cat_id
                categorized_count += 1

    db.commit()
    return {"status": "success", "categorized": categorized_count, "total": len(uncategorized)}


def apply_month_shifts(db: Session, batch_id: int | None = None) -> int:
    """Recompute effective_month for transactions based on category month_shift_days.

    Returns the number of transactions updated.
    """
    query = db.query(Transaction).filter(Transaction.category_id.is_not(None))
    if batch_id:
        query = query.filter(Transaction.import_batch_id == batch_id)

    transactions = query.all()
    updated = 0

    # Cache category shifts
    shift_cache: dict[int, int | None] = {}
    for tx in transactions:
        if tx.category_id not in shift_cache:
            cat = db.query(Category).filter(Category.id == tx.category_id).first()
            shift_cache[tx.category_id] = cat.month_shift_days if cat else None

        shift_days = shift_cache[tx.category_id]
        if shift_days and tx.date.day <= shift_days:
            if tx.date.month == 1:
                new_month = f"{tx.date.year - 1}-12"
            else:
                new_month = f"{tx.date.year}-{tx.date.month - 1:02d}"
        else:
            new_month = f"{tx.date.year}-{tx.date.month:02d}"

        if tx.effective_month != new_month:
            tx.effective_month = new_month
            updated += 1

    db.commit()
    return updated


def export_uncategorized_csv(db: Session) -> str:
    """Export uncategorized transactions as CSV for Claude Code processing.

    Returns CSV content as a string.
    """
    uncategorized = (
        db.query(Transaction)
        .filter(Transaction.category_id.is_(None))
        .order_by(Transaction.date)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "date", "description", "merchant_name", "amount", "currency", "transaction_type"])

    for tx in uncategorized:
        writer.writerow([
            tx.id,
            tx.date.isoformat(),
            tx.description,
            tx.merchant_name or "",
            str(tx.amount),
            tx.currency,
            tx.transaction_type or "",
        ])

    return output.getvalue()


def import_categorized_csv(db: Session, csv_content: str) -> dict:
    """Import categorized transactions from CSV (after Claude Code processing).

    Expected CSV format: id,category,new_rule_pattern,new_rule_category
    - id: transaction ID to categorize
    - category: category name to assign
    - new_rule_pattern: optional pattern for a new mapping rule
    - new_rule_category: optional category name for the new rule

    Returns a summary of imports.
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    categorized = 0
    rules_created = 0

    # Build category name -> ID lookup
    categories = db.query(Category).all()
    cat_lookup: dict[str, int] = {}
    for cat in categories:
        cat_lookup[cat.name.lower()] = cat.id

    for row in reader:
        tx_id = int(row["id"])
        category_name = row.get("category", "").strip()
        new_pattern = row.get("new_rule_pattern", "").strip()
        new_rule_cat = row.get("new_rule_category", "").strip()

        # Assign category to transaction
        if category_name:
            cat_id = cat_lookup.get(category_name.lower())
            if cat_id:
                tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
                if tx:
                    tx.category_id = cat_id
                    categorized += 1

        # Create new rule if specified
        if new_pattern and new_rule_cat:
            rule_cat_id = cat_lookup.get(new_rule_cat.lower())
            if rule_cat_id:
                existing = (
                    db.query(MappingRule)
                    .filter(MappingRule.pattern == new_pattern, MappingRule.category_id == rule_cat_id)
                    .first()
                )
                if not existing:
                    rule = MappingRule(
                        pattern=new_pattern,
                        category_id=rule_cat_id,
                        source="claude_code",
                    )
                    db.add(rule)
                    rules_created += 1

    db.commit()
    return {"categorized": categorized, "rules_created": rules_created}
