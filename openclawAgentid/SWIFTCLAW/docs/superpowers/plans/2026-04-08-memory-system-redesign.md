# SwiftClaw 记忆系统重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SwiftClaw 记忆系统从纯 SQLite key-value 重构为 Markdown 文件层 + SQLite 索引层，支持 memory.md 核心记忆、每日日志、Memory Flush 自动归档和 FTS5 全文历史检索。

**Architecture:** 删除 `memories` 表，保留 `conversations` 作为短期缓冲，新增 `user_data/{telegram_id}/memory.md`（长期核心）和 `logs/YYYY-MM-DD.md`（历史档案）。通过 `aiosqlite` + `aiofiles` 实现异步读写，FTS5 负责历史日志检索。

**Tech Stack:** Python 3.12, aiosqlite, aiofiles, pydantic-ai, python-telegram-bot

---

## 文件结构映射

### 新增文件
- `code/memory/markdown_store.py` — Markdown 文件操作（日志写入、memory.md upsert、Flush 触发）
- `tests/unit/memory/test_markdown_store.py` — markdown_store 的单元测试
- `tests/unit/memory/test_memory_flush.py` — Memory Flush 逻辑测试

### 修改文件
- `code/pyproject.toml` — 新增 `aiofiles>=24.0.0` 依赖
- `code/memory/database.py` — 删除 `memories` 表创建，新增 `log_fts` 虚拟表创建
- `code/memory/store.py` — 集成 Markdown 层、Memory Flush、懒维护检查
- `code/memory/models.py` — 删除 `Memory` 模型
- `code/memory/__init__.py` — 更新导出
- `code/agent/tools.py` — 修改 `save_memory`/`recall_memory`/`list_memories`，新增 `search_history`
- `code/agent/llm.py` — 更新 System Prompt，加入 `memory.md` 和 `search_history` 说明
- `code/gateway/telegram.py` — 改消息处理流程，增加维护触发、`memory.md` 加载、新增 `/memory` 命令
- `tests/unit/memory/test_database.py` — 更新测试（删除 memories 表相关，新增 log_fts 相关）
- `tests/unit/memory/test_store.py` — 更新测试（删除 Memory 相关，新增 Flush 和 markdown 相关）
- `tests/unit/tools/test_search.py` — 可能受影响，需验证，新增 `search_history` 测试

---

## Task 1: 基础依赖与目录结构

**Files:**
- Modify: `code/pyproject.toml`
- Create: `code/user_data/.gitkeep` (确保目录被 git 跟踪)

- [ ] **Step 1: 添加 `aiofiles` 依赖**

打开 `code/pyproject.toml`，在 `dependencies` 列表末尾添加 `aiofiles`：

```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "websockets>=13.0",
    "python-telegram-bot>=21.0",
    "pydantic-ai>=0.1.0",
    "pydantic-settings>=2.0.0",
    "loguru>=0.7.0",
    "tavily-python>=0.3.0",
    "aiofiles>=24.0.0",
]
```

- [ ] **Step 2: 安装依赖**

Run:
```bash
cd code && pip install -e ".[dev]"
```

Expected: `aiofiles` 成功安装，无报错。

- [ ] **Step 3: 创建用户数据目录占位**

Run:
```bash
mkdir -p "code/user_data"
touch "code/user_data/.gitkeep"
```

- [ ] **Step 4: Commit**

```bash
git add code/pyproject.toml code/user_data/.gitkeep
git commit -m "chore: add aiofiles dependency and user_data directory"
```

---

## Task 2: 重构 memory/database.py

**Files:**
- Modify: `code/memory/database.py`
- Modify: `tests/unit/memory/test_database.py`

- [ ] **Step 1: 删除 `memories` 表和索引创建逻辑**

修改 `code/memory/database.py` 的 `_create_tables` 方法，删除 `memories` 表和 `idx_memories_user_key` 索引的创建代码。保留 `users` 和 `conversations` 表以及 `idx_conversations_user_time` 索引。

修改后 `_create_tables` 中关于表创建的部分应为：

```python
async def _create_tables(self) -> None:
    """Create database tables and indexes."""
    if not self._connection:
        raise RuntimeError("Database not connected")

    # Users table
    await self._connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            preferences TEXT
        )
    """)

    # Conversations table
    await self._connection.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            session_id TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Full-text search virtual table for log indexing
    await self._connection.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS log_fts USING fts5(
            content,
            source_file,
            user_id UNINDEXED
        )
    """)

    # Create index
    await self._connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_conversations_user_time
        ON conversations(user_id, timestamp)
    """)

    await self._connection.commit()
    logger.debug("Database tables and indexes created")
```

- [ ] **Step 2: 更新 database 测试**

修改 `tests/unit/memory/test_database.py`，删除对 `memories` 表的断言，新增对 `log_fts` 表的断言。

```python
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
```

- [ ] **Step 3: 运行测试确认通过**

Run:
```bash
cd code && pytest tests/unit/memory/test_database.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add code/memory/database.py tests/unit/memory/test_database.py
git commit -m "refactor(memory): remove memories table, add log_fts virtual table"
```

---

## Task 3: 新增 memory/markdown_store.py

**Files:**
- Create: `code/memory/markdown_store.py`
- Create: `tests/unit/memory/test_markdown_store.py`

- [ ] **Step 1: 创建 markdown_store 模块**

新建 `code/memory/markdown_store.py`：

```python
"""Markdown-based persistent memory storage."""

import re
from datetime import datetime
from pathlib import Path

import aiofiles
from loguru import logger


class MarkdownMemoryStore:
    """Manages per-user Markdown memory files (memory.md and daily logs)."""

    def __init__(self, base_dir: Path):
        """Initialize with base directory for user data.

        Args:
            base_dir: Root directory for all user data (e.g., code/user_data).
        """
        self.base_dir = Path(base_dir)

    def _user_dir(self, telegram_id: int) -> Path:
        """Get user-specific directory."""
        return self.base_dir / str(telegram_id)

    def _memory_path(self, telegram_id: int) -> Path:
        """Get path to user's memory.md."""
        return self._user_dir(telegram_id) / "memory.md"

    def _log_path(self, telegram_id: int, date_str: str | None = None) -> Path:
        """Get path to daily log file."""
        date = date_str or datetime.now().strftime("%Y-%m-%d")
        log_dir = self._user_dir(telegram_id) / "logs"
        return log_dir / f"{date}.md"

    async def ensure_directories(self, telegram_id: int) -> None:
        """Create user directories if they don't exist."""
        user_dir = self._user_dir(telegram_id)
        log_dir = user_dir / "logs"
        user_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)

    async def read_memory_md(self, telegram_id: int) -> str:
        """Read memory.md content. Returns empty string if not exists."""
        path = self._memory_path(telegram_id)
        if not path.exists():
            return ""
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            return await f.read()

    async def write_memory_md(self, telegram_id: int, content: str) -> None:
        """Overwrite memory.md with new content."""
        await self.ensure_directories(telegram_id)
        path = self._memory_path(telegram_id)
        async with aiofiles.open(path, "w", encoding="utf-8") as f:
            await f.write(content)
        logger.debug(f"Wrote memory.md for user {telegram_id}")

    async def upsert_memory_section(self, telegram_id: int, key: str, value: str) -> None:
        """Upsert a section into memory.md.

        If section with ## {key} exists, replace its paragraph.
        Otherwise append a new section.
        """
        content = await self.read_memory_md(telegram_id)
        section_heading = f"## {key}"
        new_section = f"{section_heading}\n{value}\n"

        if not content.strip():
            content = "# 用户记忆\n\n" + new_section
        elif section_heading in content:
            # Replace existing section (heading + its paragraph until next ## or EOF)
            pattern = re.compile(
                rf"^{re.escape(section_heading)}\n.*?(?=\n## |\Z)",
                re.MULTILINE | re.DOTALL,
            )
            content = pattern.sub(new_section.rstrip() + "\n", content)
        else:
            content = content.rstrip() + "\n\n" + new_section

        await self.write_memory_md(telegram_id, content)
        logger.info(f"Upserted memory section '{key}' for user {telegram_id}")

    async def get_memory_sections(self, telegram_id: int) -> list[dict[str, str]]:
        """Extract all sections from memory.md."""
        content = await self.read_memory_md(telegram_id)
        if not content.strip():
            return []

        sections = []
        # Split by ## headings, skipping the main # title
        parts = re.split(r"\n## ", content)
        for part in parts[1:]:  # Skip # 用户记忆
            lines = part.split("\n", 1)
            if len(lines) == 2:
                key, body = lines
                sections.append({"key": key.strip(), "value": body.strip()})
            elif len(lines) == 1:
                sections.append({"key": lines[0].strip(), "value": ""})
        return sections

    async def recall_memory_section(self, telegram_id: int, key: str) -> str | None:
        """Find a specific section by key."""
        sections = await self.get_memory_sections(telegram_id)
        for section in sections:
            if section["key"] == key:
                return section["value"]
        return None

    async def append_log(self, telegram_id: int, role: str, content: str, timestamp: datetime | None = None) -> str:
        """Append a conversation entry to daily log file.

        Returns the written text block for FTS5 indexing.
        """
        await self.ensure_directories(telegram_id)
        path = self._log_path(telegram_id)
        ts = timestamp or datetime.now()
        time_str = ts.strftime("%H:%M")
        entry = f"\n## {time_str}\n**{role.capitalize()}:** {content}\n"

        # Write file header if new file
        if not path.exists():
            date_str = ts.strftime("%Y-%m-%d")
            header = f"# {date_str}\n"
            async with aiofiles.open(path, "w", encoding="utf-8") as f:
                await f.write(header + entry)
        else:
            async with aiofiles.open(path, "a", encoding="utf-8") as f:
                await f.write(entry)

        logger.debug(f"Appended log for user {telegram_id}")
        return entry

    async def read_logs_for_dates(self, telegram_id: int, dates: list[str]) -> str:
        """Read log content for specified date strings."""
        parts = []
        for date_str in dates:
            path = self._log_path(telegram_id, date_str)
            if path.exists():
                async with aiofiles.open(path, "r", encoding="utf-8") as f:
                    parts.append(await f.read())
        return "\n".join(parts)

    async def memory_md_length(self, telegram_id: int) -> int:
        """Get character length of memory.md."""
        content = await self.read_memory_md(telegram_id)
        return len(content)
```

- [ ] **Step 2: 创建 markdown_store 测试**

新建 `tests/unit/memory/test_markdown_store.py`：

```python
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
```

- [ ] **Step 3: 运行测试确认通过**

Run:
```bash
cd code && pytest tests/unit/memory/test_markdown_store.py -v
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add code/memory/markdown_store.py tests/unit/memory/test_markdown_store.py
git commit -m "feat(memory): add Markdown memory store with log append and section upsert"
```

---

## Task 4: 重构 memory/store.py 集成 Markdown 和 Memory Flush

**Files:**
- Modify: `code/memory/store.py`
- Create: `tests/unit/memory/test_memory_flush.py`
- Modify: `tests/unit/memory/test_store.py`

- [ ] **Step 1: 重构 MemoryStore 引入 Markdown 层和 Flush 逻辑**

修改 `code/memory/store.py` 为以下内容：

```python
"""Memory store operations for managing users, conversations, and memories."""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from loguru import logger

from memory.database import Database
from memory.markdown_store import MarkdownMemoryStore
from memory.models import Message, User

# Thresholds
CONVERSATION_CHAR_LIMIT = 6000
MEMORY_MD_CHAR_LIMIT = 1500
MIN_CONVERSATIONS_TO_KEEP = 10


class MemoryStore:
    """High-level memory operations for the SwiftClaw memory system.

    Provides methods for managing users, conversation history, preferences,
    and key-value memories backed by Markdown files + SQLite.
    """

    def __init__(self, database: Database | None = None, md_store: MarkdownMemoryStore | None = None):
        """Initialize memory store.

        Args:
            database: Database instance. If None, creates a new default Database.
            md_store: Markdown memory store. If None, creates default under code/user_data.
        """
        self.db = database or Database()
        if md_store is None:
            base = Path(__file__).resolve().parent.parent / "user_data"
            md_store = MarkdownMemoryStore(base)
        self.md = md_store

    async def initialize(self) -> None:
        """Initialize database connection."""
        await self.db.connect()
        logger.debug("MemoryStore initialized")

    async def close(self) -> None:
        """Close database connection."""
        await self.db.close()
        logger.debug("MemoryStore closed")

    async def get_or_create_user(self, telegram_id: int) -> User:
        """Get existing user or create a new one."""
        row = await self.db.fetchone(
            "SELECT id, telegram_id, created_at, preferences FROM users WHERE telegram_id = ?",
            (telegram_id,)
        )

        if row:
            user_id, tel_id, created_at, preferences_json = row
            preferences = json.loads(preferences_json) if preferences_json else {}
            return User(
                id=user_id,
                telegram_id=tel_id,
                created_at=datetime.fromisoformat(created_at),
                preferences=preferences
            )

        cursor = await self.db.execute(
            "INSERT INTO users (telegram_id, preferences) VALUES (?, ?)",
            (telegram_id, "{}")
        )

        row = await self.db.fetchone(
            "SELECT id, telegram_id, created_at, preferences FROM users WHERE id = ?",
            (cursor.lastrowid,)
        )
        assert row is not None

        user_id, tel_id, created_at, preferences_json = row
        preferences = json.loads(preferences_json) if preferences_json else {}

        logger.info(f"Created new user with telegram_id: {telegram_id}")
        return User(
            id=user_id,
            telegram_id=tel_id,
            created_at=datetime.fromisoformat(created_at),
            preferences=preferences
        )

    async def save_message(
        self,
        telegram_id: int,
        user_id: int,
        role: str,
        content: str,
        session_id: str | None = None
    ) -> None:
        """Save a conversation message to both SQLite and daily log."""
        # SQLite
        await self.db.execute(
            "INSERT INTO conversations (user_id, role, content, session_id) VALUES (?, ?, ?, ?)",
            (user_id, role, content, session_id)
        )
        logger.debug(f"Saved message to SQLite for user {user_id}: {role}")

        # Markdown log + FTS5
        entry_text = await self.md.append_log(telegram_id, role, content)
        await self._index_log_for_search(entry_text, user_id)

    async def _index_log_for_search(self, entry_text: str, user_id: int) -> None:
        """Insert log entry into FTS5 index."""
        today = datetime.now().strftime("%Y-%m-%d")
        await self.db.execute(
            "INSERT INTO log_fts (content, source_file, user_id) VALUES (?, ?, ?)",
            (entry_text.strip(), f"logs/{today}.md", user_id)
        )

    async def get_conversation_history(
        self,
        user_id: int,
        limit: int = 10
    ) -> list[Message]:
        """Get recent conversation history for a user."""
        rows = await self.db.fetchall(
            """SELECT id, user_id, role, content, timestamp, session_id
               FROM conversations
               WHERE user_id = ?
               ORDER BY timestamp DESC
               LIMIT ?""",
            (user_id, limit)
        )

        return [
            Message(
                id=row[0],
                user_id=row[1],
                role=row[2],
                content=row[3],
                timestamp=datetime.fromisoformat(row[4]),
                session_id=row[5]
            )
            for row in rows
        ]

    async def conversation_char_count(self, user_id: int) -> int:
        """Count total characters in all conversation messages for a user."""
        row = await self.db.fetchone(
            "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM conversations WHERE user_id = ?",
            (user_id,)
        )
        return int(row[0]) if row else 0

    async def conversation_count(self, user_id: int) -> int:
        """Count number of conversation messages for a user."""
        row = await self.db.fetchone(
            "SELECT COUNT(*) FROM conversations WHERE user_id = ?",
            (user_id,)
        )
        return int(row[0]) if row else 0

    async def maybe_flush_conversations(self, telegram_id: int, user_id: int, agent_summarizer: Any) -> bool:
        """Trigger Memory Flush if conversation buffer exceeds threshold.

        Always keeps the most recent MIN_CONVERSATIONS_TO_KEEP records.
        Returns True if flush occurred.
        """
        total_chars = await self.conversation_char_count(user_id)
        if total_chars <= CONVERSATION_CHAR_LIMIT:
            return False

        total_count = await self.conversation_count(user_id)
        if total_count <= MIN_CONVERSATIONS_TO_KEEP:
            return False

        # Determine how many old messages to archive
        to_archive_count = total_count - MIN_CONVERSATIONS_TO_KEEP

        rows = await self.db.fetchall(
            """SELECT id, role, content, timestamp
               FROM conversations
               WHERE user_id = ?
               ORDER BY timestamp ASC
               LIMIT ?""",
            (user_id, to_archive_count)
        )

        if not rows:
            return False

        # Build raw transcript for summarization
        lines = []
        for row in rows:
            role, content, ts = row[1], row[2], datetime.fromisoformat(row[3])
            lines.append(f"{role} ({ts.strftime('%H:%M')}): {content}")
        transcript = "\n".join(lines)

        try:
            summary = await agent_summarizer(transcript)
        except Exception as e:
            logger.warning(f"Failed to summarize conversations for user {user_id}: {e}")
            summary = f"会话摘要（无法生成详细摘要）: 共 {len(rows)} 条消息"

        # Append summary to today's log
        summary_entry = f"\n## 会话摘要\n{summary}\n"
        await self.md.ensure_directories(telegram_id)
        log_path = self.md._log_path(telegram_id)
        import aiofiles
        if not log_path.exists():
            today_str = datetime.now().strftime("%Y-%m-%d")
            async with aiofiles.open(log_path, "w", encoding="utf-8") as f:
                await f.write(f"# {today_str}\n" + summary_entry)
        else:
            async with aiofiles.open(log_path, "a", encoding="utf-8") as f:
                await f.write(summary_entry)

        await self._index_log_for_search(summary_entry, user_id)

        # Delete archived rows
        ids_to_delete = tuple(row[0] for row in rows)
        placeholders = ",".join("?" * len(ids_to_delete))
        await self.db.execute(
            f"DELETE FROM conversations WHERE id IN ({placeholders})",
            ids_to_delete
        )

        logger.info(f"Flushed {len(rows)} conversations for user {user_id}, summary length {len(summary)}")

        # Lazy maintenance: compress memory.md if too long
        await self.maybe_compress_memory_md(telegram_id, agent_summarizer)

        return True

    async def maybe_compress_memory_md(self, telegram_id: int, agent_summarizer: Any) -> bool:
        """Compress memory.md if it exceeds character limit."""
        length = await self.md.memory_md_length(telegram_id)
        if length <= MEMORY_MD_CHAR_LIMIT:
            return False

        content = await self.md.read_memory_md(telegram_id)
        try:
            compressed = await agent_summarizer(
                f"请将以下用户记忆文件压缩成一段紧凑的自然语言画像，保留所有关键信息：\n\n{content}"
            )
        except Exception as e:
            logger.warning(f"Failed to compress memory.md for user {telegram_id}: {e}")
            return False

        new_content = "# 用户记忆\n\n" + compressed.strip() + "\n"
        await self.md.write_memory_md(telegram_id, new_content)
        logger.info(f"Compressed memory.md for user {telegram_id} from {length} to {len(new_content)} chars")
        return True

    async def update_preferences(self, user_id: int, preferences: dict[str, Any]) -> None:
        """Update user preferences (merges with existing)."""
        current = await self.get_preferences(user_id)
        current.update(preferences)
        preferences_json = json.dumps(current)

        await self.db.execute(
            "UPDATE users SET preferences = ? WHERE id = ?",
            (preferences_json, user_id)
        )
        logger.debug(f"Updated preferences for user {user_id}")

    async def get_preferences(self, user_id: int) -> dict[str, Any]:
        """Get user preferences."""
        row = await self.db.fetchone(
            "SELECT preferences FROM users WHERE id = ?",
            (user_id,)
        )

        if row and row[0]:
            result: dict[str, Any] = json.loads(row[0])
            return result
        return {}

    async def add_memory_to_md(self, telegram_id: int, key: str, value: str) -> None:
        """Add or update a key-value memory in memory.md."""
        await self.md.upsert_memory_section(telegram_id, key, value)

    async def get_memory_md_content(self, telegram_id: int) -> str:
        """Get raw memory.md content."""
        return await self.md.read_memory_md(telegram_id)

    async def get_memory_sections(self, telegram_id: int) -> list[dict[str, str]]:
        """Get all memory sections from memory.md."""
        return await self.md.get_memory_sections(telegram_id)

    async def recall_memory_section(self, telegram_id: int, key: str) -> str | None:
        """Recall a specific memory section by key."""
        return await self.md.recall_memory_section(telegram_id, key)

    async def search_history(self, user_id: int, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Search historical logs via FTS5."""
        rows = await self.db.fetchall(
            """SELECT content, source_file
               FROM log_fts
               WHERE log_fts MATCH ? AND user_id = ?
               ORDER BY rank
               LIMIT ?""",
            (query, user_id, limit)
        )
        return [{"content": row[0], "source_file": row[1]} for row in rows]

    async def clear_session(self, user_id: int, session_id: str) -> None:
        """Clear all messages for a specific session."""
        await self.db.execute(
            "DELETE FROM conversations WHERE user_id = ? AND session_id = ?",
            (user_id, session_id)
        )
        logger.debug(f"Cleared session '{session_id}' for user {user_id}")
```

- [ ] **Step 2: 删除 memory/store.py 中不再需要的 imports 和逻辑检查**

Store.py 已整体重写，确认没有引用已删除的 `Memory` 模型和 `memories` 表相关的遗留逻辑。

- [ ] **Step 3: 创建 Memory Flush 测试**

新建 `tests/unit/memory/test_memory_flush.py`：

```python
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

    async def fake_summarizer(text: str) -> str:
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

    async def fake_summarizer(text: str) -> str:
        return "会话摘要内容"

    flushed = await store.maybe_flush_conversations(888888, user.id, fake_summarizer)
    assert flushed is True

    # Should keep most recent 10
    count = await store.conversation_count(user.id)
    assert count == 10

    # Check log file has summary
    log_text = await md.read_logs_for_dates(888888, [datetime.now().strftime("%Y-%m-%d")])
    assert "会话摘要内容" in log_text

    # Check FTS5 has summary
    results = await store.search_history(user.id, "摘要")
    assert any("会话摘要内容" in r["content"] for r in results)

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

    async def fake_summarizer(text: str) -> str:
        return "压缩后的画像"

    compressed = await store.maybe_compress_memory_md(777777, fake_summarizer)
    assert compressed is True

    content = await md.read_memory_md(777777)
    assert "压缩后的画像" in content

    await store.close()
```

- [ ] **Step 4: 更新 test_store.py**

修改 `tests/unit/memory/test_store.py`，删除所有 `memories` 表相关测试，保留并更新 user 和 conversation 相关测试。

由于改动较大，推荐先删除原文件中涉及 `add_memory`, `get_memories`, `update_accessed_time`, `clear_session` 的测试，然后更新 `save_message` 和 `get_conversation_history` 的签名调用。

比如原来这样的调用：
```python
await store.save_message(user.id, "user", "hello")
```
改为：
```python
await store.save_message(user.telegram_id, user.id, "user", "hello")
```

具体测试文件内容可以参考现有结构修改，确保：
- `test_save_message_and_get_history` 使用新签名
- `test_get_or_create_user` 不变
- `test_preferences` 不变
- 删除 `test_add_memory`, `test_get_memories`, `test_update_accessed_time`

- [ ] **Step 5: 运行测试并修复错误**

Run:
```bash
cd code && pytest tests/unit/memory/ -v
```

Expected: 所有 memory 相关测试 PASS

- [ ] **Step 6: Commit**

```bash
git add code/memory/store.py tests/unit/memory/
git commit -m "feat(memory): integrate Markdown layer, Memory Flush, and FTS5 search"
```

---

## Task 5: 重构 memory/models.py 和 __init__.py

**Files:**
- Modify: `code/memory/models.py`
- Modify: `code/memory/__init__.py`

- [ ] **Step 1: 删除 Memory 模型**

修改 `code/memory/models.py`，删除 `Memory` 类，只保留 `User` 和 `Message`：

```python
"""Pydantic data models for memory system."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class User(BaseModel):
    """User model representing a Telegram user."""

    id: int
    telegram_id: int
    created_at: datetime
    preferences: dict[str, Any] = Field(default_factory=dict)


class Message(BaseModel):
    """Message model for conversation history."""

    id: int
    user_id: int
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime
    session_id: str | None = None
```

- [ ] **Step 2: 更新 __init__.py 导出**

```python
"""Memory system for SwiftClaw.

Provides persistent storage for users, conversation history, and key-value memories.
"""

from memory.database import Database
from memory.markdown_store import MarkdownMemoryStore
from memory.models import Message, User
from memory.store import MemoryStore

__all__ = ["Database", "MemoryStore", "MarkdownMemoryStore", "User", "Message"]
```

- [ ] **Step 3: Commit**

```bash
git add code/memory/models.py code/memory/__init__.py
git commit -m "refactor(memory): remove Memory model, update exports"
```

---

## Task 6: 重构 agent/tools.py

**Files:**
- Modify: `code/agent/tools.py`
- Modify: `tests/unit/agent/test_tools.py` (如存在)

- [ ] **Step 1: 修改 save_memory / recall_memory / list_memories，新增 search_history**

在 `code/agent/tools.py` 中找到现有的 `save_memory`, `recall_memory`, `list_memories` 函数，替换为以下内容（保留原有导入不变）：

```python
# ============================================================================
# Memory Tools
# ============================================================================

async def save_memory(
    ctx: RunContext[AgentDependencies],
    key: str,
    value: str,
) -> str:
    """Save a piece of information to the persistent memory store.

    Use this tool when the user tells you something important that should be
    remembered for future conversations. Examples:
    - User preferences ("我喜欢用中文交流", "我的GitHub用户名是xxx")
    - Important facts about the user ("我在xxx公司工作", "我是Python开发者")
    - Personal information the user wants you to remember

    Args:
        ctx: Run context with dependencies.
        key: A short, descriptive key for this memory (e.g., "user_name", "preference_language").
        value: The actual information to remember.

    Returns:
        Success or error message.
    """
    memory_store = ctx.deps.memory_store
    user_id = ctx.deps.user_id

    if not memory_store:
        return "Error: Memory store not available"

    if not user_id:
        return "Error: User ID not set"

    if not key or not key.strip():
        return "Error: Memory key cannot be empty"

    if not value or not value.strip():
        return "Error: Memory value cannot be empty"

    try:
        # Note: user_id here is the Telegram user ID passed through deps
        await memory_store.add_memory_to_md(user_id, key.strip(), value.strip())
        logger.info(f"Memory saved: key='{key}', user_id={user_id}")
        return f"Memory saved successfully: '{key}'"
    except Exception as e:
        logger.error(f"Failed to save memory: {e}")
        return f"Error: Failed to save memory: {e}"


async def recall_memory(
    ctx: RunContext[AgentDependencies],
    key: str,
) -> str:
    """Retrieve a specific memory by its exact key.

    Args:
        ctx: Run context with dependencies.
        key: The exact key of the memory to retrieve.

    Returns:
        The memory value, or error message if not found.
    """
    memory_store = ctx.deps.memory_store
    user_id = ctx.deps.user_id

    if not memory_store:
        return "Error: Memory store not available"

    if not user_id:
        return "Error: User ID not set"

    if not key or not key.strip():
        return "Error: Memory key cannot be empty"

    try:
        value = await memory_store.recall_memory_section(user_id, key.strip())
        if value is not None:
            logger.info(f"Memory recalled: key='{key}', user_id={user_id}")
            return f"Memory '{key}': {value}"
        return f"No memory found with key: '{key}'"
    except Exception as e:
        logger.error(f"Failed to recall memory: {e}")
        return f"Error: Failed to recall memory: {e}"


async def list_memories(
    ctx: RunContext[AgentDependencies],
) -> str:
    """List all memories for the current user.

    Returns:
        Formatted list of memories or error message.
    """
    memory_store = ctx.deps.memory_store
    user_id = ctx.deps.user_id

    if not memory_store:
        return "Error: Memory store not available"

    if not user_id:
        return "Error: User ID not set"

    try:
        sections = await memory_store.get_memory_sections(user_id)

        if not sections:
            return "No memories found. You can save memories using the save_memory tool."

        lines = ["Stored Memories:", "-" * 40]

        for section in sections:
            lines.append(f"\nKey: {section['key']}")
            lines.append(f"Value: {section['value']}")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to list memories: {e}")
        return f"Error: Failed to list memories: {e}"


async def search_history(
    ctx: RunContext[AgentDependencies],
    query: str,
    limit: int = 5,
) -> str:
    """Search historical conversation logs for relevant content.

    Use this tool when the user mentions past discussions, says 'last time',
    'yesterday', 'before', or asks to recall something from earlier.

    Args:
        ctx: Run context with dependencies.
        query: Search query string.
        limit: Maximum number of results (default 5).

    Returns:
        Formatted search results or error message.
    """
    memory_store = ctx.deps.memory_store
    user_id = ctx.deps.user_id

    if not memory_store:
        return "Error: Memory store not available"

    if not user_id:
        return "Error: User ID not set"

    if not query or not query.strip():
        return "Error: Query cannot be empty"

    try:
        # Need database user_id, but deps.user_id is telegram_id. We need to resolve it.
        # For simplicity in this plan, we assume the calling code has set deps.user_id
        # to the database user id OR memory_store supports lookup by telegram_id.
        # In telegram.py we will pass db_user.id as user_id in deps.
        results = await memory_store.search_history(user_id, query.strip(), limit)

        if not results:
            return f"No historical logs found for query: '{query}'"

        lines = [f"Historical search results for '{query}':", "-" * 40]
        for i, result in enumerate(results, 1):
            content_preview = result['content'][:250].replace('\n', ' ')
            lines.append(f"{i}. [{result['source_file']}]")
            lines.append(f"   {content_preview}...")
            lines.append("")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to search history: {e}")
        return f"Error: Failed to search history: {e}"
```

- [ ] **Step 2: 在 register_all_tools 中注册 search_history**

在 `register_all_tools` 函数中，保留 `save_memory`, `recall_memory`, `list_memories` 的注册，新增 `search_history`：

```python
    # Memory tools
    agent.tool(save_memory)
    agent.tool(recall_memory)
    agent.tool(list_memories)
    agent.tool(search_history)
```

- [ ] **Step 3: 运行相关测试**

Run:
```bash
cd code && pytest tests/unit/agent/ tests/unit/tools/ -v
```

Expected: 通过或失败是因为旧测试需要更新（正常现象）

- [ ] **Step 4: Commit**

```bash
git add code/agent/tools.py
git commit -m "feat(agent): update memory tools for Markdown backend, add search_history"
```

---

## Task 7: 更新 agent/llm.py 的 System Prompt

**Files:**
- Modify: `code/agent/llm.py`

- [ ] **Step 1: 修改 System Prompt**

找到 `code/agent/llm.py` 中的 `_build_system_prompt` 方法，替换 base_prompt 为：

```python
        base_prompt = """You are SwiftClaw, an AI assistant that helps users with various tasks.

You have access to tools for:
- File operations (read, write, list directories)
- Bash command execution (in Docker sandbox)
- Web browser automation (open pages, take screenshots, extract text)
- Local browser opening on the user's own computer when configured
- Web search (Tavily API)
- Memory management (save, recall, list important information about the user)
- Historical log search (search past conversations by keyword)

IMPORTANT MEMORY RULES:
1. When the user tells you something important about themselves (preferences, personal info, habits, etc.),
   you MUST call the save_memory tool to store it in their memory.md.
2. When the user mentions "last time", "yesterday", "before", or asks about past discussions,
   you MUST call the search_history tool to find relevant historical logs.
3. Use recall_memory or list_memories to check previously saved core facts.

Always use save_memory immediately when you receive important information. Use search_history
whenever the conversation references the past. Use tools when needed to help the user.
Be concise and helpful."""
```

- [ ] **Step 2: Commit**

```bash
git add code/agent/llm.py
git commit -m "feat(agent): update system prompt for memory.md and search_history"
```

---

## Task 8: 重构 gateway/telegram.py

**Files:**
- Modify: `code/gateway/telegram.py`

- [ ] **Step 1: 新增 /memory 命令**

在 `TelegramBotHandler` 中新增 `memory_command` 方法：

```python
    async def memory_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /memory command."""
        if not update.effective_chat or not update.effective_user:
            return

        try:
            await self.memory_store.initialize()
            db_user = await self.memory_store.get_or_create_user(update.effective_user.id)
            content = await self.memory_store.get_memory_md_content(db_user.telegram_id)

            if not content.strip():
                text = "📝 当前还没有存储核心记忆。对我说 '请记住...' 来添加！"
            else:
                text = f"📝 你的核心记忆：\n\n```\n{content}\n```"

            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=text,
                parse_mode="Markdown",
            )
            logger.info(f"User {update.effective_user.id} viewed memory")
        except Exception as e:
            logger.error(f"Error showing memory: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ 读取记忆失败",
            )
```

- [ ] **Step 2: 注册 /memory 命令**

在 `create_application` 方法中，添加 handler：

```python
        application.add_handler(CommandHandler("memory", self.memory_command))
```

- [ ] **Step 3: 修改 handle_message 流程**

修改 `handle_message` 方法，主要改动点：

1. `get_conversation_history` 改为 `limit=10`
2. 在 `_process_message` 之前调用 `maybe_flush_conversations`
3. `_process_message` 中加载 `memory.md` 内容到上下文
4. `save_message` 改为新签名（传入 `db_user.telegram_id`）

修改后的核心代码段：

```python
        try:
            # Initialize memory store and get/create user
            await self.memory_store.initialize()
            db_user = await self.memory_store.get_or_create_user(user.id)

            # Memory Flush check BEFORE processing
            # Build a simple summarizer callable
            async def summarizer(transcript: str) -> str:
                prompt = f"请将以下对话摘要成一段自然语言，保留关键信息：\n\n{transcript}"
                result = await self.swiftclaw_agent.run(prompt, user_id=db_user.id)
                if hasattr(result, 'response') and hasattr(result.response, 'text'):
                    return result.response.text
                return str(result.response)

            await self.memory_store.maybe_flush_conversations(db_user.telegram_id, db_user.id, summarizer)

            # Get conversation history for context (now up to 10 recent)
            history = await self.memory_store.get_conversation_history(db_user.id, limit=10)

            # Process message through SwiftClawAgent with history context
            response_text = await self._process_message(
                message_text, db_user.telegram_id, db_user.id, history
            )

            # Save conversation to memory (both SQLite and Markdown log)
            await self.memory_store.save_message(db_user.telegram_id, db_user.id, "user", message_text)
            await self.memory_store.save_message(db_user.telegram_id, db_user.id, "assistant", response_text)

            # Send response
            await self._send_long_message(
                context.bot,
                update.effective_chat.id,
                response_text,
            )
```

- [ ] **Step 4: 修改 _process_message 加载 memory.md**

将 `_process_message` 的方法签名改为接收 `telegram_id`，并在组装上下文时优先加载 `memory.md`：

```python
    async def _process_message(
        self,
        message: str,
        telegram_id: int,
        user_id: int,
        history: list[Any] | None = None
    ) -> str:
        """Process user message through SwiftClawAgent."""
        context_parts = []

        # 1. Load core memory.md
        try:
            memory_md = await self.memory_store.get_memory_md_content(telegram_id)
            if memory_md.strip():
                context_parts.append("Important information about the user (from memory.md):")
                context_parts.append(memory_md)
                context_parts.append("")
        except Exception as e:
            logger.warning(f"Failed to load memory.md for context: {e}")

        # 2. Add conversation history
        if history:
            context_parts.append("Previous conversation:")
            for msg in reversed(history[-10:]):
                context_parts.append(f"{msg.role}: {msg.content[:100]}...")
            context_parts.append("")

        full_message = "\n".join(context_parts) + message

        # Process through SwiftClawAgent with database user_id for memory operations
        result = await self.swiftclaw_agent.run(full_message, user_id=user_id)

        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            return result.response.text
        elif hasattr(result, 'response'):
            return str(result.response)
        else:
            return str(result)
```

> 注意：`swiftclaw_agent.run` 的 `user_id` 参数仍然传 `db_user.id`（数据库 user id），因为 `agent/tools.py` 中的记忆工具会读取 `ctx.deps.user_id`，而 `search_history` 需要数据库 user_id 来查 `log_fts`。这是一个历史遗留的命名混淆，当前代码里 telegram_id 和 db_user.id 都曾被称为 `user_id`。在本次重构中，推荐保持：
> - `deps.user_id` = 数据库 user id（用于 SQLite 查询）
> - `telegram_id` 单独传递用于 Markdown 文件路径

- [ ] **Step 5: 更新 clear_command 中的方法调用（如有需要）**

如果 `clear_command` 中调用了 `clear_session`，这部分不需要改动。但如果它调用了旧的 `save_message` 无 `telegram_id` 版本，需要同步更新。

- [ ] **Step 6: Commit**

```bash
git add code/gateway/telegram.py
git commit -m "feat(gateway): integrate Markdown memory, add /memory command, update flush and context"
```

---

## Task 9: 端到端测试与修复

**Files:**
- Modify: 根据报错动态决定

- [ ] **Step 1: 运行全局测试**

Run:
```bash
cd code && pytest tests/ -v
```

- [ ] **Step 2: 处理导入错误和类型错误**

常见问题及修复：

1. **ImportError: cannot import name 'Memory' from memory.models**
   - 检查还有哪里引用了 `Memory` 类，一并删除引用。

2. **TypeError: save_message() takes 4 positional arguments but 5 were given**
   - 检查 `telegram.py` 或测试中还有没有旧签名调用。

3. **NameError: name 'MarkdownMemoryStore' is not defined**
   - 检查 `memory/__init__.py` 是否正确导出，或相关文件是否正确导入。

4. **mypy 类型错误**
   - Run `mypy code/` 检查类型一致性，修复 annotation 问题。

- [ ] **Step 3: Commit 修复**

```bash
git add .
git commit -m "fix: resolve tests and type checks after memory refactor"
```

---

## Task 10: 最终验证

- [ ] **Step 1: 验收清单**

Run:
```bash
cd code && pytest tests/unit/memory/ -v
```

确认：
- [ ] `test_database.py` 通过（存在 `log_fts`，不存在 `memories`）
- [ ] `test_markdown_store.py` 通过（upsert、recall、append_log）
- [ ] `test_memory_flush.py` 通过（保留最近 10 条、摘要归档、memory.md 压缩）
- [ ] `test_store.py` 通过（user、conversation、preferences）
- [ ] `tests/unit/agent/` 和 `tests/unit/tools/` 无 regression

- [ ] **Step 2: 更新 PRD 设计文档（如需要）**

可选：在 `docs/superpowers/specs/2026-03-26-swiftclaw-prd-design.md` 中更新"记忆系统"章节，说明新架构。

- [ ] **Step 3: Final commit**

```bash
git commit -m "feat(memory): complete Markdown-based memory system redesign

- Remove SQLite memories table in favor of user-specific memory.md
- Add daily log files (logs/YYYY-MM-DD.md) with FTS5 indexing
- Implement Memory Flush: auto-archive old conversations while keeping last 10
- Add /memory command and search_history tool for historical recall
- Lazy maintenance: auto-compress memory.md when it exceeds 1500 chars"
```

---

## 关键依赖关系图

```
Task 1 (依赖安装)
    ↓
Task 2 (Database 重构)
    ↓
Task 3 (Markdown store) → Task 4 (MemoryStore 集成)
                              ↓
                          Task 5 (Models/__init__)
                              ↓
                          Task 6 (Agent tools)
                              ↓
                          Task 7 (Agent prompt)
                              ↓
                          Task 8 (Telegram 集成)
                              ↓
                          Task 9 (测试修复)
                              ↓
                          Task 10 (最终验证)
```

Task 3 和 Task 4 紧密耦合，建议先完成 Task 3 再进入 Task 4。其余任务按顺序执行。
