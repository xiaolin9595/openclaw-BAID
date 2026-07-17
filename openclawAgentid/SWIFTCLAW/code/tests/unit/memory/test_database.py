"""Unit tests for memory database module."""

import pytest

from memory.database import Database


@pytest.mark.asyncio
async def test_database_creates_tables(tmp_path):
    db = Database(db_path=str(tmp_path / "test.db"))
    await db.connect()

    tables = await db.fetchall(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    table_names = [row[0] for row in tables]

    assert "conversations" in table_names
    assert "log_fts" in table_names
    assert "users" in table_names

    # log_fts is a virtual table and may not appear in type='table' on some SQLite versions,
    # so also check via sqlite_master type filter
    vtables = await db.fetchall(
        "SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table') ORDER BY name"
    )
    vtable_names = [row[0] for row in vtables]
    assert "log_fts" in vtable_names or "log_fts_data" in table_names  # fts5 internal tables confirm existence

    await db.close()
