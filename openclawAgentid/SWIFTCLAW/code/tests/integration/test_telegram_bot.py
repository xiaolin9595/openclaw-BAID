"""Integration tests for Telegram Bot handler."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram import Update, User, Message, Chat
from telegram.ext import ContextTypes

from gateway.telegram import TelegramBotHandler
from config.settings import Settings


@pytest.fixture
def mock_settings() -> Settings:
    """Create mock settings."""
    settings = MagicMock(spec=Settings)
    settings.anthropic_api_key = None
    settings.moonshot_api_key = "test-api-key"
    settings.moonshot_model = "moonshot-v1-8k"
    settings.telegram_bot_token = "test-token"
    settings.telegram_allowed_users = []
    settings.local_browser_proxy = None
    return settings


@pytest.fixture
def mock_update() -> Update:
    """Create mock Telegram update."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=User)
    update.effective_user.id = 123456
    update.effective_user.username = "testuser"
    update.effective_user.first_name = "Test"
    update.message = MagicMock(spec=Message)
    update.message.text = "Hello bot"
    update.message.chat = MagicMock(spec=Chat)
    update.message.chat.id = 123456
    return update


@pytest.fixture
def mock_context() -> ContextTypes.DEFAULT_TYPE:
    """Create mock Telegram context."""
    context = MagicMock()
    context.bot = MagicMock()
    context.bot.send_message = AsyncMock()
    context.bot.send_chat_action = AsyncMock()
    return context


class TestTelegramBotHandler:
    """Test suite for TelegramBotHandler."""

    @pytest.fixture
    def handler(self, mock_settings: Settings) -> TelegramBotHandler:
        """Create handler instance."""
        return TelegramBotHandler(settings=mock_settings)

    @pytest.mark.asyncio
    async def test_handler_initialization(self, handler: TelegramBotHandler) -> None:
        """Test handler initializes correctly."""
        assert handler.settings.telegram_bot_token == "test-token"
        assert handler.allowed_users == []

    @pytest.mark.asyncio
    async def test_handle_message_authorized_user(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test handling message from authorized user."""
        # Arrange
        mock_update.effective_user.id = 123456
        handler.allowed_users = [123456]

        # Act
        with patch.object(handler, "_process_message", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = "Test response"
            await handler.handle_message(mock_update, mock_context)

        # Assert
        mock_process.assert_called_once()
        call_args = mock_process.call_args
        assert call_args is not None
        assert call_args.args[0] == "Hello bot"
        assert isinstance(call_args.args[1], int)
        assert isinstance(call_args.args[2], int)
        assert isinstance(call_args.args[3], list)
        mock_context.bot.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_message_unauthorized_user(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test handling message from unauthorized user."""
        # Arrange
        mock_update.effective_user.id = 999999
        handler.allowed_users = [123456]  # Different user ID

        # Act
        await handler.handle_message(mock_update, mock_context)

        # Assert
        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "未授权" in call_args[1]["text"] or "unauthorized" in call_args[1]["text"].lower()

    @pytest.mark.asyncio
    async def test_handle_message_no_whitelist(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test that empty whitelist allows all users."""
        # Arrange
        handler.allowed_users = []

        # Act
        with patch.object(handler, "_process_message", new_callable=AsyncMock) as mock_process:
            mock_process.return_value = "Test response"
            await handler.handle_message(mock_update, mock_context)

        # Assert
        mock_process.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_command(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /start command handler."""
        # Act
        await handler.start_command(mock_update, mock_context)

        # Assert
        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "SwiftClaw" in call_args[1]["text"]

    @pytest.mark.asyncio
    async def test_help_command(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /help command handler."""
        # Act
        await handler.help_command(mock_update, mock_context)

        # Assert
        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "帮助" in call_args[1]["text"] or "help" in call_args[1]["text"].lower()

    @pytest.mark.asyncio
    async def test_memory_command_empty_memory(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /memory command when no memory exists."""
        with patch.object(handler.memory_store, "initialize", new_callable=AsyncMock):
            with patch.object(
                handler.memory_store,
                "get_or_create_user",
                new_callable=AsyncMock,
            ) as mock_get_user:
                mock_user = MagicMock()
                mock_user.telegram_id = 123456
                mock_user.id = 1
                mock_get_user.return_value = mock_user

                with patch.object(
                    handler.memory_store,
                    "get_memory_md_content",
                    new_callable=AsyncMock,
                ) as mock_get_memory:
                    mock_get_memory.return_value = ""
                    await handler.memory_command(mock_update, mock_context)

        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "还没有存储核心记忆" in call_args[1]["text"]

    @pytest.mark.asyncio
    async def test_memory_command_with_memory(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /memory command when memory exists."""
        with patch.object(handler.memory_store, "initialize", new_callable=AsyncMock):
            with patch.object(
                handler.memory_store,
                "get_or_create_user",
                new_callable=AsyncMock,
            ) as mock_get_user:
                mock_user = MagicMock()
                mock_user.telegram_id = 123456
                mock_user.id = 1
                mock_get_user.return_value = mock_user

                with patch.object(
                    handler.memory_store,
                    "get_memory_md_content",
                    new_callable=AsyncMock,
                ) as mock_get_memory:
                    mock_get_memory.return_value = "# User memory\n- Name: Test"
                    await handler.memory_command(mock_update, mock_context)

        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "核心记忆" in call_args[1]["text"]
        assert "Markdown" in call_args[1].get("parse_mode", "")

    @pytest.mark.asyncio
    async def test_status_command_without_local_proxy(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /status shows local browser proxy is not configured."""
        await handler.status_command(mock_update, mock_context)

        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "运行位置" in call_args[1]["text"]
        assert "本地浏览器代理" in call_args[1]["text"]
        assert "未配置" in call_args[1]["text"]

    @pytest.mark.asyncio
    async def test_status_command_with_local_proxy(
        self,
        handler: TelegramBotHandler,
        mock_update: Update,
        mock_context: ContextTypes.DEFAULT_TYPE,
    ) -> None:
        """Test /status shows local browser proxy connectivity."""
        handler.settings.local_browser_proxy = "https://example.ngrok-free.app"

        with patch.object(
            handler,
            "_get_local_browser_proxy_status",
            new_callable=AsyncMock,
        ) as mock_proxy_status:
            mock_proxy_status.return_value = "已配置，已连通 (Windows)"
            await handler.status_command(mock_update, mock_context)

        mock_proxy_status.assert_awaited_once()
        mock_context.bot.send_message.assert_called_once()
        call_args = mock_context.bot.send_message.call_args
        assert "运行位置" in call_args[1]["text"]
        assert "已连通" in call_args[1]["text"]

    def test_is_user_authorized_with_whitelist(self, handler: TelegramBotHandler) -> None:
        """Test authorization check with whitelist."""
        handler.allowed_users = [123, 456]

        assert handler._is_user_authorized(123) is True
        assert handler._is_user_authorized(456) is True
        assert handler._is_user_authorized(789) is False

    def test_is_user_authorized_empty_whitelist(self, handler: TelegramBotHandler) -> None:
        """Test that empty whitelist allows all users."""
        handler.allowed_users = []

        assert handler._is_user_authorized(123) is True
        assert handler._is_user_authorized(999) is True
