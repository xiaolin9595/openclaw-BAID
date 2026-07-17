import pytest
from datetime import datetime
from pathlib import Path

from memory.markdown_store import MarkdownMemoryStore


@pytest.mark.asyncio
async def test_upsert_and_read_memory_section(tmp_path):
    store = MarkdownMemoryStore(tmp_path)

    await store.upsert_memory_section(123, "编程语言", "用户喜欢 Python")
    assert "## 编程语言\n用户喜欢 Python" in await store.read_memory_md(123)

    await store.upsert_memory_section(123, "编程语言", "用户偏爱 Python 和 Rust")
    content = await store.read_memory_md(123)
    assert content.count("## 编程语言") == 1
    assert "用户偏爱 Python 和 Rust" in content

    await store.upsert_memory_section(123, "工作地点", "深圳")
    sections = await store.get_memory_sections(123)
    assert len(sections) == 2


@pytest.mark.asyncio
async def test_recall_and_list_sections(tmp_path):
    store = MarkdownMemoryStore(tmp_path)

    await store.upsert_memory_section(456, "爱好", "跑步")
    assert await store.recall_memory_section(456, "爱好") == "跑步"
    assert await store.recall_memory_section(456, "不存在") is None

    sections = await store.get_memory_sections(456)
    assert sections[0]["key"] == "爱好"


@pytest.mark.asyncio
async def test_append_log(tmp_path):
    store = MarkdownMemoryStore(tmp_path)
    ts = datetime(2026, 4, 8, 14, 30)

    text = await store.append_log(789, "user", "你好", ts)
    assert "**User:** 你好" in text

    log = await store.read_logs_for_dates(789, ["2026-04-08"])
    assert "# 2026-04-08" in log
    assert "**User:** 你好" in log


@pytest.mark.asyncio
async def test_upsert_multiline_value_with_blank_lines(tmp_path):
    store = MarkdownMemoryStore(tmp_path)
    value = "第一行\n\n第二行\n第三行"
    await store.upsert_memory_section(111, "笔记", value)
    result = await store.recall_memory_section(111, "笔记")
    assert result == value


@pytest.mark.asyncio
async def test_upsert_empty_string_value(tmp_path):
    store = MarkdownMemoryStore(tmp_path)
    await store.upsert_memory_section(222, "空值", "")
    result = await store.recall_memory_section(222, "空值")
    assert result == ""


@pytest.mark.asyncio
async def test_append_log_multiple_entries(tmp_path):
    store = MarkdownMemoryStore(tmp_path)
    ts1 = datetime(2026, 4, 8, 14, 30)
    ts2 = datetime(2026, 4, 8, 14, 35)

    await store.append_log(333, "user", "第一条", ts1)
    await store.append_log(333, "assistant", "第二条", ts2)

    log = await store.read_logs_for_dates(333, ["2026-04-08"])
    assert "**User:** 第一条" in log
    assert "**Assistant:** 第二条" in log
    assert log.count("## ") == 2
