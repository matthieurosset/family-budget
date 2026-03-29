"""Migration service: imports categories and rules from Actual Budget SQLite database."""

import json
import sqlite3
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Category, MappingRule


def migrate_from_actual_budget(db: Session, ab_db_path: str | Path) -> dict:
    """Migrate categories and rules from an Actual Budget SQLite database.

    Creates parent categories from category_groups and child categories
    from categories. Extracts text-based matching rules.

    Returns a summary of what was migrated.
    """
    conn = sqlite3.connect(str(ab_db_path))
    c = conn.cursor()

    # Check if we already migrated (avoid duplicates)
    existing = db.query(Category).count()
    if existing > 0:
        return {"status": "skipped", "message": "Categories already exist, migration skipped"}

    # ── Step 1: Migrate category groups as parent categories ──
    c.execute("""
        SELECT id, name, is_income, sort_order
        FROM category_groups
        WHERE tombstone = 0 AND hidden = 0
        ORDER BY sort_order
    """)
    groups = c.fetchall()

    group_id_map: dict[str, int] = {}  # AB group UUID -> our category ID
    sort_idx = 0

    for ab_id, name, is_income, sort_order in groups:
        # Skip empty groups (no active children)
        c.execute(
            "SELECT COUNT(*) FROM categories WHERE cat_group = ? AND tombstone = 0 AND hidden = 0",
            (ab_id,),
        )
        child_count = c.fetchone()[0]
        if child_count == 0:
            continue

        parent = Category(name=name, parent_id=None, sort_order=sort_idx)
        db.add(parent)
        db.flush()
        group_id_map[ab_id] = parent.id
        sort_idx += 1

    # ── Step 2: Migrate categories as children ──
    c.execute("""
        SELECT id, name, cat_group, sort_order
        FROM categories
        WHERE tombstone = 0 AND hidden = 0
        ORDER BY sort_order
    """)
    categories = c.fetchall()

    cat_id_map: dict[str, int] = {}  # AB category UUID -> our category ID
    for ab_id, name, cat_group, sort_order in categories:
        parent_id = group_id_map.get(cat_group)
        if parent_id is None:
            continue  # Group was skipped (empty or hidden)

        child = Category(
            name=name,
            parent_id=parent_id,
            sort_order=int(sort_order) if sort_order else 0,
        )
        db.add(child)
        db.flush()
        cat_id_map[ab_id] = child.id

    # ── Step 3: Extract and migrate text-based rules ──
    c.execute("""
        SELECT conditions, actions, conditions_op
        FROM rules
        WHERE tombstone = 0
    """)
    rules = c.fetchall()

    rules_created = 0
    for conds_json, acts_json, conds_op in rules:
        conds = json.loads(conds_json)
        acts = json.loads(acts_json)

        # Extract text patterns
        patterns = []
        for cond in conds:
            if cond.get("field") == "imported_description" and cond.get("op") == "contains":
                patterns.append(cond["value"])

        if not patterns:
            continue

        # Extract target category
        target_cat_id = None
        for act in acts:
            if act.get("field") == "category" and act.get("op") == "set":
                ab_cat_id = act["value"]
                target_cat_id = cat_id_map.get(ab_cat_id)
                break

        if not target_cat_id:
            continue

        # Create one rule per pattern (simpler matching engine)
        for pattern in patterns:
            existing_rule = (
                db.query(MappingRule)
                .filter(MappingRule.pattern == pattern, MappingRule.category_id == target_cat_id)
                .first()
            )
            if not existing_rule:
                rule = MappingRule(
                    pattern=pattern,
                    category_id=target_cat_id,
                    priority=0,
                    source="actual_budget",
                )
                db.add(rule)
                rules_created += 1

    db.commit()
    conn.close()

    return {
        "status": "success",
        "groups_created": len(group_id_map),
        "categories_created": len(cat_id_map),
        "rules_created": rules_created,
    }
