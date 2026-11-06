from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, text
from backend.app.services.backup_service import run_database_backup, _dump_via_python_fallback, prune_old_backups


def test_python_dump_fallback_executes():
    """Verify that the fallback Python database dumper generates valid SQL statements."""
    test_eng = create_engine("sqlite:///:memory:")
    with test_eng.connect() as conn:
        conn.execute(text("CREATE TABLE test_las (id TEXT PRIMARY KEY, name TEXT, val REAL)"))
        conn.execute(text("INSERT INTO test_las VALUES ('las_1', 'Well Alpha', 42.5)"))
        conn.commit()

    data = _dump_via_python_fallback(target_engine=test_eng)
    assert isinstance(data, bytes)
    assert b"WellQC Database Fallback SQL Dump" in data
    assert b"test_las" in data
    assert b"Well Alpha" in data


def test_run_database_backup_requires_r2(monkeypatch):
    """Verify that backup raises error gracefully when R2 is disabled."""
    from backend.app.services import r2_storage
    monkeypatch.setattr(r2_storage, "is_enabled", lambda: False)
    monkeypatch.setattr(r2_storage, "_get_client", lambda: None)

    with pytest.raises(RuntimeError, match="Cloudflare R2 is not configured"):
        run_database_backup()


def test_prune_old_backups():
    """Verify pruning logic with mock R2 client."""
    mock_client = MagicMock()
    mock_paginator = MagicMock()
    mock_paginator.paginate.return_value = [{"Contents": []}]
    mock_client.get_paginator.return_value = mock_paginator

    pruned = prune_old_backups(mock_client, "test-bucket", retention_days=30)
    assert pruned == 0
