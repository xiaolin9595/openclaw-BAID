import pytest
from datetime import datetime
from pathlib import Path

from memory.database import Database
from memory.markdown_store import MarkdownMemoryStore
from memory.store import MemoryStore


@pytest.mark.asyncio
async def test_memory_flush_keeps_recent_10_messages(tmp_path):
    db = Database(db_path=str(tmp_path / "test.db"))
    md = MarkdownMemoryStore(tmp_path)
    store = MemoryStore(database=db, md_store=md)
    await store.initialize()

    user = await store.get_or_create_user(999999)

    # Insert 15 very short messages (below char limit)
    for i in range(15):
        await store.db.execute(
            "INSERT INTO conversations (user_id, role, content) VALUES (?, 'user', ?)",
            (user.id, f"msg{i}")
        )

    async def fake_summarizer(text: str, user_id: int = 0, telegram_id: int = 0) -> str:
        return "summary"

    flushed = await store.maybe_flush_conversations(999999, user.id, fake_summarizer)
    # Not flushed because total chars = 15*4 = 60 < 6000
    assert flushed is False

    count = await store.conversation_count(user.id)
    assert count == 15

    await store.close()


@pytest.mark.asyncio
async def test_memory_flush_archives_old_messages(tmp_path):
    db = Database(db_path=str(tmp_path / "test.db"))
    md = MarkdownMemoryStore(tmp_path)
    store = MemoryStore(database=db, md_store=md)
    await store.initialize()

    user = await store.get_or_create_user(888888)

    # Insert 20 long messages to exceed 6000 chars
    long_text = "x" * 400
    for i in range(20):
        await store.db.execute(
            "INSERT INTO conversations (user_id, role, content) VALUES (?, 'user', ?)",
            (user.id, f"{long_text}_{i}")
        )

    async def fake_summarizer(text: str, user_id: int = 0, telegram_id: int = 0) -> str:
        return "conversation summary content"

    flushed = await store.maybe_flush_conversations(888888, user.id, fake_summarizer)
    assert flushed is True

    # Should keep most recent 10
    count = await store.conversation_count(user.id)
    assert count == 10

    # Check log file has summary
    log_text = await md.read_logs_for_dates(888888, [datetime.now().strftime("%Y-%m-%d")])
    assert "conversation summary content" in log_text

    # Check FTS5 has summary
    results = await store.search_history(user.id, "summary")
    assert any("conversation summary content" in r["content"] for r in results)

    await store.close()


@pytest.mark.asyncio
async def test_compress_memory_md(tmp_path):
    db = Database(db_path=str(tmp_path / "test.db"))
    md = MarkdownMemoryStore(tmp_path)
    store = MemoryStore(database=db, md_store=md)
    await store.initialize()

    await store.add_memory_to_md(777777, "a", "value a")
    await store.add_memory_to_md(777777, "b", "value b")

    # Manually write a very long memory.md to trigger compression
    long_para = "x" * 2000
    await md.write_memory_md(777777, f"# 用户记忆\n\n## 很长\n{long_para}\n")

    async def fake_summarizer(text: str, user_id: int = 0, telegram_id: int = 0) -> str:
        return "压缩后的画像"

    compressed = await store.maybe_compress_memory_md(777777, 777777, fake_summarizer)
    assert compressed is True

    content = await md.read_memory_md(777777)
    assert "压缩后的画像" in content

    await store.close()
