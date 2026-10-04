import hashlib
import math
import re
import secrets
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.app.models.models import Well


def infer_basin(location: Optional[str], field_name: str) -> str:
    """Infer geological basin based on location and field name."""
    haystack = f"{location or ''} {field_name}".upper()
    if "NIGER" in haystack or "DELTA" in haystack or "OML" in haystack or "OPL" in haystack:
        return "Niger Delta Basin"
    if "PERMIAN" in haystack or "MIDLAND" in haystack or "DELAWARE" in haystack:
        return "Permian Basin"
    if "NORTH SEA" in haystack or "BRENT" in haystack or "FORTIES" in haystack:
        return "North Sea Basin"
    if "GULF" in haystack or "GOM" in haystack:
        return "Gulf of Mexico"
    return "Uploaded Wells Basin"


def convert_depth_to_feet(depth: float, unit: str) -> float:
    """Standardize depth measurement to feet if given in meters."""
    return depth * 3.28084 if unit.upper() == "M" else depth


def sanitize_well_and_file_name(
    file_name: Optional[str],
    raw_well_name: Optional[str],
) -> Tuple[str, str]:
    """
    Sanitize file_name and well_name:
    Never allow bare digits like "2" or generic "UNKNOWN" to pollute the catalog.
    """
    clean_file_name = (file_name or "").strip()
    clean_stem = (
        clean_file_name.rsplit(".", 1)[0].strip()
        if "." in clean_file_name
        else clean_file_name
    )
    clean_stem = clean_stem.strip("\"' /\\")

    clean_raw_wn = (raw_well_name or "").strip()
    clean_raw_wn = re.sub(r"\s+", " ", clean_raw_wn).strip()

    if (
        not clean_raw_wn
        or clean_raw_wn.isdigit()
        or clean_raw_wn.upper() in ("UNKNOWN", "UNKNOWN_WELL", "NULL", "2")
    ):
        if (
            clean_stem
            and not clean_stem.isdigit()
            and clean_stem.upper() not in ("UNKNOWN", "NULL", "2")
        ):
            well_name = clean_stem
        else:
            well_name = clean_raw_wn or clean_stem or "Uploaded Well"
    else:
        well_name = clean_raw_wn

    if (
        not clean_file_name
        or clean_stem.isdigit()
        or clean_stem.upper() in ("UNKNOWN", "NULL", "2")
    ):
        clean_file_name = f"{well_name}.las"

    return well_name, clean_file_name


def generate_unique_api_no(
    raw_api: Optional[str],
    well_name: str,
    user_id: str,
    db: Session,
) -> str:
    """
    Determine unique API/UWI number:
    Avoid collisions across users when generic or missing API numbers are parsed.
    """
    clean_raw_api = (raw_api or "").strip()
    if not clean_raw_api or clean_raw_api in ("API-12345", "API-", "UNKNOWN", "NULL"):
        safe_slug = re.sub(r"[^A-Za-z0-9]", "", well_name).upper()[:10] or "WELL"
        u_hash = hashlib.md5(f"{user_id}-{well_name}".encode()).hexdigest()[:6].upper()
        api_no = f"API-{safe_slug}-{u_hash}"
    else:
        api_no = clean_raw_api

    well = db.query(Well).filter(Well.apiNo == api_no, Well.ownerId == user_id).first()
    if not well:
        # Check if apiNo is already taken by another user; if so, assign unique suffix
        conflict = db.query(Well).filter(Well.apiNo == api_no).first()
        if conflict:
            api_no = f"{api_no}-{secrets.token_hex(2).upper()}"

    return api_no


def downsample_curve_series(
    depths: List[float],
    values: List[float],
    null_value: float,
    max_points: int = 3000,
) -> List[Dict[str, Any]]:
    """
    Downsample a curve series to a maximum point count for efficient frontend rendering,
    guaranteeing that the final depth point is always preserved.
    """
    total_pts = len(depths)
    step_ds = max(1, math.ceil(total_pts / max_points)) if total_pts > max_points else 1

    sampled: List[Dict[str, Any]] = []
    for i in range(0, total_pts, step_ds):
        sampled.append({
            "depth": depths[i],
            "value": values[i] if i < len(values) else null_value,
        })

    if step_ds > 1 and total_pts > 0 and (total_pts - 1) % step_ds != 0:
        sampled.append({
            "depth": depths[-1],
            "value": values[-1] if values else null_value,
        })

    return sampled
