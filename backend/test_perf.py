import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import time
from backend.app.core.database import SessionLocal
from backend.app.models.models import Well, LASFile, QualityReport, Curve
from sqlalchemy.orm import selectinload, defer

db = SessionLocal()

t0 = time.time()
query = db.query(Well).options(
    selectinload(Well.lasFiles).options(
        defer(LASFile.rawContent),
        defer(LASFile.rawHeader),
    ).selectinload(LASFile.curves).options(
        defer(Curve.dataJson),
    ),
    selectinload(Well.lasFiles).selectinload(LASFile.reports).options(
        defer(QualityReport.reportJson),
        defer(QualityReport.aiSummary),
        defer(QualityReport.recommendations),
    ),
    selectinload(Well.reports).options(
        defer(QualityReport.reportJson),
        defer(QualityReport.aiSummary),
        defer(QualityReport.recommendations),
    ),
)
wells = query.all()
t1 = time.time()
print(f"Loaded {len(wells)} wells in {t1 - t0:.3f}s")

# Test curve summaries generation from curves
t2 = time.time()
for w in wells:
    latest_las = w.lasFiles[0] if w.lasFiles else None
    if latest_las and latest_las.curves:
        summaries = [
            {
                "mnemonic": c.originalMnemonic,
                "standardMnemonic": c.standardMnemonic or "UNKNOWN",
                "unit": c.unit or "",
                "nullCount": c.nullCount or 0,
                "totalPoints": c.totalPoints or 0,
                "nullPercentage": c.nullPercentage or 0.0,
                "minVal": c.minVal,
                "maxVal": c.maxVal,
                "meanVal": c.meanVal,
                "healthScore": 100,
                "status": "VALID",
                "anomalies": [],
            }
            for c in latest_las.curves
        ]
t3 = time.time()
print(f"Generated all summaries in {t3 - t2:.3f}s. Total time: {t3 - t0:.3f}s")
