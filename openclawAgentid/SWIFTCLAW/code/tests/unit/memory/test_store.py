"""Unit tests for memory store module."""

import json
import tempfile
from pathlib import Path

import pytest

from memory.database import Database
from memory.markdown_store import MarkdownMemoryStore
from memory.store import MemoryStore


class TestMemoryStore:
    """Test suite for MemoryStore class."""

    @pytest.fixture
    async def store(self):
        """Create a temporary memory store for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            database = Database(db_path=str(db_path))
            md = MarkdownMemoryStore(Path(tmpdir) / "user_data")
            memory_store = MemoryStore(database=database, md_store=md)
            await memory_store.initialize()
            yield memory_store
            await memory_store.close()

    @pytest.mark.asyncio
    async def test_initialize_and_close(self):
        """Test store initialization and cleanup."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            database = Database(db_path=str(db_path))
            md = MarkdownMemoryStore(Path(tmpdir) / "user_data")
            store = MemoryStore(database=database, md_store=md)

            await store.initialize()
            assert store.db._connection is not None

            await store.close()

    @pytest.mark.asyncio
    async def test_get_or_create_user_creates_new_user(self, store):
        """Test get_or_create_user creates a new user."""
        user = await store.get_or_create_user(telegram_id=123456)

        assert user.id is not None
        assert user.telegram_id == 123456
        assert user.preferences == {}
        assert user.created_at is not None

    @pytest.mark.asyncio
    async def test_get_or_create_user_returns_existing_user(self, store):
        """Test get_or_create_user returns existing user."""
        # Create user first
        user1 = await store.get_or_create_user(telegram_id=123456)

        # Get the same user
        user2 = await store.get_or_create_user(telegram_id=123456)

        assert user1.id == user2.id
        assert user1.telegram_id == user2.telegram_id

    @pytest.mark.asyncio
    async def test_get_or_create_user_different_users(self, store):
        """Test get_or_create_user creates different users for different IDs."""
        user1 = await store.get_or_create_user(telegram_id=111)
        user2 = await store.get_or_create_user(telegram_id=222)

        assert user1.id != user2.id
        assert user1.telegram_id != user2.telegram_id

    @pytest.mark.asyncio
    async def test_save_message(self, store):
        """Test saving a message."""
        user = await store.get_or_create_user(telegram_id=123456)

        await store.save_message(
            telegram_id=user.telegram_id,
            user_id=user.id,
            role="user",
            content="Hello, assistant!"
        )

        # Verify message was saved
        messages = await store.get_conversation_history(user_id=user.id, limit=10)
        assert len(messages) == 1
        assert messages[0].role == "user"
        assert messages[0].content == "Hello, assistant!"
        assert messages[0].user_id == user.id

    @pytest.mark.asyncio
    async def test_save_message_with_session_id(self, store):
        """Test saving a message with session ID."""
        user = await store.get_or_create_user(telegram_id=123456)

        await store.save_message(
            telegram_id=user.telegram_id,
            user_id=user.id,
            role="assistant",
            content="Hello!",
            session_id="session_123"
        )

        messages = await store.get_conversation_history(user_id=user.id)
        assert len(messages) == 1
        assert messages[0].session_id == "session_123"

    @pytest.mark.asyncio
    async def test_get_conversation_history_order(self, store):
        """Test conversation history is returned in descending time order."""
        user = await store.get_or_create_user(telegram_id=123456)

        # Save messages
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="First")
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="assistant", content="Second")
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="Third")

        # Get history - should be in reverse chronological order
        messages = await store.get_conversation_history(user_id=user.id, limit=10)
        assert len(messages) == 3
        assert messages[0].content == "Third"  # Most recent first
        assert messages[1].content == "Second"
        assert messages[2].content == "First"

    @pytest.mark.asyncio
    async def test_get_conversation_history_limit(self, store):
        """Test conversation history respects limit."""
        user = await store.get_or_create_user(telegram_id=123456)

        # Save 5 messages
        for i in range(5):
            await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content=f"Message {i}")

        # Get only 3
        messages = await store.get_conversation_history(user_id=user.id, limit=3)
        assert len(messages) == 3
        # Should be the 3 most recent
        assert messages[0].content == "Message 4"
        assert messages[1].content == "Message 3"
        assert messages[2].content == "Message 2"

    @pytest.mark.asyncio
    async def test_get_conversation_history_empty(self, store):
        """Test conversation history returns empty list for new user."""
        user = await store.get_or_create_user(telegram_id=123456)

        messages = await store.get_conversation_history(user_id=user.id)
        assert messages == []

    @pytest.mark.asyncio
    async def test_update_preferences_creates_new(self, store):
        """Test updating preferences for the first time."""
        user = await store.get_or_create_user(telegram_id=123456)

        await store.update_preferences(user_id=user.id, preferences={"theme": "dark"})

        prefs = await store.get_preferences(user_id=user.id)
        assert prefs == {"theme": "dark"}

    @pytest.mark.asyncio
    async def test_update_preferences_merges(self, store):
        """Test updating preferences merges with existing."""
        user = await store.get_or_create_user(telegram_id=123456)

        # Set initial preferences
        await store.update_preferences(user_id=user.id, preferences={"theme": "dark"})

        # Update with more preferences
        await store.update_preferences(user_id=user.id, preferences={"language": "zh"})

        prefs = await store.get_preferences(user_id=user.id)
        assert prefs == {"theme": "dark", "language": "zh"}

    @pytest.mark.asyncio
    async def test_update_preferences_overwrites(self, store):
        """Test updating preferences overwrites existing keys."""
        user = await store.get_or_create_user(telegram_id=123456)

        await store.update_preferences(user_id=user.id, preferences={"theme": "dark"})
        await store.update_preferences(user_id=user.id, preferences={"theme": "light"})

        prefs = await store.get_preferences(user_id=user.id)
        assert prefs == {"theme": "light"}

    @pytest.mark.asyncio
    async def test_get_preferences_default_empty(self, store):
        """Test getting preferences returns empty dict by default."""
        user = await store.get_or_create_user(telegram_id=123456)

        prefs = await store.get_preferences(user_id=user.id)
        assert prefs == {}

    @pytest.mark.asyncio
    async def test_clear_session(self, store):
        """Test clearing session messages."""
        user = await store.get_or_create_user(telegram_id=123456)

        # Add messages to different sessions
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="S1 M1", session_id="s1")
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="S1 M2", session_id="s1")
        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="S2 M1", session_id="s2")

        # Clear session s1
        await store.clear_session(user_id=user.id, session_id="s1")

        # Verify only s2 messages remain
        messages = await store.get_conversation_history(user_id=user.id)
        assert len(messages) == 1
        assert messages[0].content == "S2 M1"
        assert messages[0].session_id == "s2"

    @pytest.mark.asyncio
    async def test_clear_session_no_match(self, store):
        """Test clearing non-existent session doesn't affect other messages."""
        user = await store.get_or_create_user(telegram_id=123456)

        await store.save_message(telegram_id=user.telegram_id, user_id=user.id, role="user", content="Message", session_id="s1")

        # Clear non-existent session
        await store.clear_session(user_id=user.id, session_id="nonexistent")

        # Message should still exist
        messages = await store.get_conversation_history(user_id=user.id)
        assert len(messages) == 1
