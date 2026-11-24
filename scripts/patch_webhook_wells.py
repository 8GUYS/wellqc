"""
CE2-34 — Patch wells.py to fire outbound webhook events.

Hooks:
  - well.created  → after db.commit() in create_well (new well only)
"""
import pathlib

wells_path = pathlib.Path("backend/app/api/wells.py")
text = wells_path.read_text(encoding="utf-8")

# 1. Add import at top (after existing imports)
old_import = "from backend.app.services.comparison import compare_two_wells, WellComparisonResult"
new_import = (
    "from backend.app.services.comparison import compare_two_wells, WellComparisonResult\n"
    "import asyncio as _asyncio\n"
    "from backend.app.services.outbound_webhook import fire_event as _fire_event"
)
assert old_import in text, f"Import anchor not found in wells.py"
text = text.replace(old_import, new_import, 1)

# 2. Hook well.created after db.commit() + db.refresh() in create_well
old_commit = (
    "    db.commit()\n"
    "    db.refresh(well)\n"
    "    invalidate_wells_cache()\n"
    "\n"
    "    return {\"well\": _to_well_list_item(well)}"
)
new_commit = (
    "    db.commit()\n"
    "    db.refresh(well)\n"
    "    invalidate_wells_cache()\n"
    "\n"
    "    # CE2-34: fire well.created outbound webhook (non-blocking)\n"
    "    _asyncio.ensure_future(_fire_event(\n"
    "        \"well.created\",\n"
    "        {\n"
    "            \"wellId\": well.id,\n"
    "            \"apiNo\": well.apiNo,\n"
    "            \"name\": well.name,\n"
    "            \"operatorName\": well.operatorName,\n"
    "            \"qualityGrade\": well.qualityGrade,\n"
    "        },\n"
    "        db,\n"
    "    ))\n"
    "\n"
    "    return {\"well\": _to_well_list_item(well)}"
)
assert old_commit in text, f"Commit anchor not found in wells.py"
text = text.replace(old_commit, new_commit, 1)

wells_path.write_text(text, encoding="utf-8")
print("wells.py patched successfully.")
