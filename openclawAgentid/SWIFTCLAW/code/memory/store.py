"""Memory store operations for managing users, conversations, and memories."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

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

    async def maybe_flush_conversations(
        self,
        telegram_id: int,
        user_id: int,
        agent_summarizer: Callable[[str, int, int], Awaitable[str]],
    ) -> bool:
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
            summary = await agent_summarizer(transcript, user_id, telegram_id)
        except Exception as e:
            logger.warning(f"Failed to summarize conversations for user {user_id}: {e}")
            summary = f"会话摘要（无法生成详细摘要）: 共 {len(rows)} 条消息"

        summary_entry = f"\n## 会话摘要\n{summary}\n"
        await self.md.append_to_log(telegram_id, summary_entry)
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
        await self.maybe_compress_memory_md(telegram_id, user_id, agent_summarizer)

        return True

    async def maybe_compress_memory_md(
        self,
        telegram_id: int,
        user_id: int,
        agent_summarizer: Callable[[str, int, int], Awaitable[str]],
    ) -> bool:
        """Compress memory.md if it exceeds character limit."""
        length = await self.md.memory_md_length(telegram_id)
        if length <= MEMORY_MD_CHAR_LIMIT:
            return False

        content = await self.md.read_memory_md(telegram_id)
        try:
            compressed = await agent_summarizer(
                f"请将以下用户记忆文件压缩成一段紧凑的自然语言画像，保留所有关键信息：\n\n{content}",
                user_id,
                telegram_id,
            )
        except Exception as e:
            logger.warning(f"Failed to compress memory.md for user {telegram_id}: {e}")
            return False

        compressed_clean = compressed.strip()
        new_content = "# 用户记忆\n\n" + compressed_clean + "\n"

        if len(new_content) >= length:
            logger.warning(
                f"Compression rejected for user {telegram_id}: "
                f"compressed length ({len(new_content)}) >= original length ({length})"
            )
            return False

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
