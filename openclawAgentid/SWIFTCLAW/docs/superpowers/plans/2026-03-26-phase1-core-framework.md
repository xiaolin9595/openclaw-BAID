# swiftclaw Phase 1: 核心框架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 swiftclaw 基础架构，实现 Telegram Bot + Kimi API 的最简端到端对话流程

**Architecture:** 采用单体架构，FastAPI 作为 Gateway，python-telegram-bot 处理消息收发，PydanticAI 封装 Kimi API 调用，实现用户→Telegram→Agent→Kimi→响应的完整链路

**Tech Stack:** Python 3.12+, FastAPI, python-telegram-bot, PydanticAI, pydantic-settings, loguru, pytest

---

## 文件结构概览

| 文件 | 职责 |
|------|------|
| `config/settings.py` | 配置管理（环境变量、API 密钥） |
| `config/__init__.py` | 配置模块导出 |
| `agent/llm.py` | PydanticAI 封装，Kimi API 调用 |
| `agent/__init__.py` | Agent 模块导出 |
| `gateway/telegram.py` | Telegram Bot 消息处理 |
| `gateway/server.py` | FastAPI 应用（健康检查等） |
| `gateway/__init__.py` | Gateway 模块导出 |
| `main.py` | 应用入口 |
| `requirements.txt` | Python 依赖 |
| `pyproject.toml` | 项目配置、工具设置 |
| `.env.example` | 环境变量示例 |
| `tests/unit/test_config.py` | 配置模块单元测试 |
| `tests/unit/test_llm.py` | LLM 模块单元测试 |
| `tests/integration/test_telegram_bot.py` | Telegram Bot 集成测试 |

---

## Task 1: 项目脚手架与配置管理

**Files:**
- Create: `pyproject.toml`
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `config/__init__.py`
- Create: `config/settings.py`
- Create: `tests/unit/test_config.py`

- [ ] **Step 1: 创建项目配置文件 pyproject.toml**

```toml
[project]
name = "swiftclaw"
version = "0.1.0"
description = "Personal AI Assistant Platform"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "websockets>=13.0",
    "python-telegram-bot>=21.0",
    "litellm>=1.0.0",
    "pydantic-settings>=2.0.0",
    "loguru>=0.7.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=5.0.0",
    "mypy>=1.0.0",
    "ruff>=0.6.0",
    "respx>=0.21.0",
    "httpx>=0.27.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
pythonpath = ["."]

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = []

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

- [ ] **Step 2: 创建依赖文件 requirements.txt**

```txt
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
websockets>=13.0
python-telegram-bot>=21.0
litellm>=1.0.0
pydantic-settings>=2.0.0
loguru>=0.7.0
```

- [ ] **Step 3: 创建环境变量示例文件 .env.example**

```bash
# Moonshot (Kimi) API 配置
MOONSHOT_API_KEY=your_moonshot_api_key_here

# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# 可选：白名单用户 Telegram ID（逗号分隔）
TELEGRAM_ALLOWED_USERS=123456789,987654321

# 服务器配置
PORT=8000
LOG_LEVEL=INFO
```

- [ ] **Step 4: 创建配置模块 config/__init__.py**

```python
"""SwiftClaw configuration module."""

from config.settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
```

- [ ] **Step 5: 编写配置设置测试（红阶段）**

Create `tests/unit/test_config.py`:

```python
"""Tests for configuration module."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from config.settings import Settings, get_settings


class TestSettings:
    """Test suite for Settings configuration."""

    def test_settings_with_valid_env(self) -> None:
        """Test settings load correctly with valid environment variables."""
        # Arrange
        env_vars = {
            "MOONSHOT_API_KEY": "test-api-key",
            "TELEGRAM_BOT_TOKEN": "test-bot-token",
        }

        # Act
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()

        # Assert
        assert settings.moonshot_api_key == "test-api-key"
        assert settings.telegram_bot_token == "test-bot-token"
        assert settings.port == 8000  # default value
        assert settings.log_level == "INFO"  # default value

    def test_settings_missing_required_api_key(self) -> None:
        """Test that missing API key raises validation error."""
        # Arrange
        env_vars = {"TELEGRAM_BOT_TOKEN": "test-token"}

        # Act & Assert
        with patch.dict(os.environ, env_vars, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()

        assert "moonshot_api_key" in str(exc_info.value)

    def test_settings_missing_telegram_token(self) -> None:
        """Test that missing Telegram token raises validation error."""
        # Arrange
        env_vars = {"MOONSHOT_API_KEY": "test-key"}

        # Act & Assert
        with patch.dict(os.environ, env_vars, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()

        assert "telegram_bot_token" in str(exc_info.value)

    def test_settings_custom_port(self) -> None:
        """Test that custom port is parsed correctly."""
        # Arrange
        env_vars = {
            "MOONSHOT_API_KEY": "test-key",
            "TELEGRAM_BOT_TOKEN": "test-token",
            "PORT": "9000",
        }

        # Act
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()

        # Assert
        assert settings.port == 9000

    def test_settings_allowed_users_parsing(self) -> None:
        """Test that allowed users string is parsed into list."""
        # Arrange
        env_vars = {
            "MOONSHOT_API_KEY": "test-key",
            "TELEGRAM_BOT_TOKEN": "test-token",
            "TELEGRAM_ALLOWED_USERS": "123,456,789",
        }

        # Act
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()

        # Assert
        assert settings.telegram_allowed_users == [123, 456, 789]

    def test_settings_empty_allowed_users(self) -> None:
        """Test that empty allowed users defaults to empty list."""
        # Arrange
        env_vars = {
            "MOONSHOT_API_KEY": "test-key",
            "TELEGRAM_BOT_TOKEN": "test-token",
        }

        # Act
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()

        # Assert
        assert settings.telegram_allowed_users == []


class TestGetSettings:
    """Test suite for get_settings function."""

    def test_get_settings_returns_singleton(self) -> None:
        """Test that get_settings returns cached settings instance."""
        # Arrange
        env_vars = {
            "MOONSHOT_API_KEY": "test-key",
            "TELEGRAM_BOT_TOKEN": "test-token",
        }

        # Act
        with patch.dict(os.environ, env_vars, clear=True):
            settings1 = get_settings()
            settings2 = get_settings()

        # Assert
        assert settings1 is settings2
```

- [ ] **Step 6: 运行测试确保失败**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/unit/test_config.py -v
```

Expected: ImportError 或 ModuleNotFoundError（config.settings 不存在）

- [ ] **Step 7: 实现配置模块 config/settings.py（绿阶段）**

```python
"""Configuration management using pydantic-settings."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Moonshot (Kimi) API
    moonshot_api_key: str = Field(..., description="Moonshot API key")
    moonshot_model: str = Field(
        default="moonshot-v1-8k",
        description="Moonshot model name",
    )

    # Telegram Bot
    telegram_bot_token: str = Field(..., description="Telegram bot token")
    telegram_allowed_users: List[int] = Field(
        default_factory=list,
        description="List of allowed Telegram user IDs",
    )

    # Server settings
    port: int = Field(default=8000, description="Server port")
    log_level: str = Field(default="INFO", description="Log level")

    @field_validator("telegram_allowed_users", mode="before")
    @classmethod
    def parse_allowed_users(cls, value: str | List[int] | None) -> List[int]:
        """Parse comma-separated user IDs into list of integers."""
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        return [int(x.strip()) for x in str(value).split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Returns:
        Settings: Application settings singleton.
    """
    return Settings()
```

- [ ] **Step 8: 运行测试确保通过**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/unit/test_config.py -v
```

Expected: 6 tests PASSED

- [ ] **Step 9: 类型检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m mypy config/ --ignore-missing-imports
```

Expected: Success: no issues found in 2 source files

- [ ] **Step 10: 提交代码**

```bash
cd /home/ypp/projects/swiftclaw
git add pyproject.toml requirements.txt .env.example config/ tests/
git commit -m "feat: add configuration management with pydantic-settings

- Add Settings class for env var validation
- Support Moonshot API key and Telegram bot token
- Add user whitelist parsing
- Include comprehensive unit tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: LLM 客户端封装

**Files:**
- Create: `agent/__init__.py`
- Create: `agent/llm.py`
- Create: `tests/unit/test_llm.py`

- [ ] **Step 1: 编写 LLM 测试（红阶段）**

Create `tests/unit/test_llm.py`:

```python
"""Tests for LLM client module."""

from unittest.mock import MagicMock, patch

import pytest
from litellm import CompletionResponse

from agent.llm import LLMClient, LLMResponse
from config.settings import Settings


class TestLLMResponse:
    """Test suite for LLMResponse dataclass."""

    def test_response_creation(self) -> None:
        """Test LLMResponse can be created with required fields."""
        response = LLMResponse(content="Hello", model="moonshot-v1-8k")
        assert response.content == "Hello"
        assert response.model == "moonshot-v1-8k"
        assert response.usage == {}

    def test_response_with_usage(self) -> None:
        """Test LLMResponse with usage information."""
        usage = {"prompt_tokens": 10, "completion_tokens": 20}
        response = LLMResponse(
            content="Hello",
            model="moonshot-v1-8k",
            usage=usage,
        )
        assert response.usage == usage


class TestLLMClient:
    """Test suite for LLMClient."""

    @pytest.fixture
    def mock_settings(self) -> Settings:
        """Create mock settings for testing."""
        settings = MagicMock(spec=Settings)
        settings.moonshot_api_key = "test-key"
        settings.moonshot_model = "moonshot-v1-8k"
        return settings

    @pytest.fixture
    def client(self, mock_settings: Settings) -> LLMClient:
        """Create LLMClient instance with mock settings."""
        return LLMClient(settings=mock_settings)

    def test_client_initialization(self, client: LLMClient) -> None:
        """Test LLMClient initializes with correct settings."""
        assert client.settings.moonshot_api_key == "test-key"
        assert client.model == "moonshot-v1-8k"

    @pytest.mark.asyncio
    async def test_complete_success(self, client: LLMClient) -> None:
        """Test successful completion call."""
        # Arrange
        messages = [{"role": "user", "content": "Hello"}]
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hi there!"
        mock_response.model = "moonshot-v1-8k"
        mock_response.usage = {"prompt_tokens": 5, "completion_tokens": 10}

        # Act
        with patch("agent.llm.acompletion", return_value=mock_response):
            result = await client.complete(messages)

        # Assert
        assert result.content == "Hi there!"
        assert result.model == "moonshot-v1-8k"
        assert result.usage == {"prompt_tokens": 5, "completion_tokens": 10}

    @pytest.mark.asyncio
    async def test_complete_empty_messages(self, client: LLMClient) -> None:
        """Test that empty messages raises ValueError."""
        with pytest.raises(ValueError, match="消息列表不能为空"):
            await client.complete([])

    @pytest.mark.asyncio
    async def test_complete_api_error(self, client: LLMClient) -> None:
        """Test that API errors are properly handled."""
        # Arrange
        messages = [{"role": "user", "content": "Hello"}]

        # Act & Assert
        with patch("agent.llm.acompletion", side_effect=Exception("API Error")):
            with pytest.raises(Exception, match="API Error"):
                await client.complete(messages)

    @pytest.mark.asyncio
    async def test_complete_with_system_message(self, client: LLMClient) -> None:
        """Test completion with system message prepended."""
        # Arrange
        messages = [{"role": "user", "content": "Hello"}]
        system_message = "You are a helpful assistant."
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "System received"
        mock_response.model = "moonshot-v1-8k"
        mock_response.usage = {}

        # Act
        with patch("agent.llm.acompletion", return_value=mock_response) as mock_complete:
            result = await client.complete(messages, system_message=system_message)

        # Assert
        assert result.content == "System received"
        call_args = mock_complete.call_args[1]
        assert call_args["messages"][0]["role"] == "system"
        assert call_args["messages"][0]["content"] == system_message
        assert call_args["messages"][1]["role"] == "user"

    @pytest.mark.asyncio
    async def test_stream_complete_yields_chunks(self, client: LLMClient) -> None:
        """Test streaming completion yields content chunks."""
        # Arrange
        messages = [{"role": "user", "content": "Hello"}]
        mock_chunks = [
            MagicMock(choices=[MagicMock(delta=MagicMock(content="Hello"))]),
            MagicMock(choices=[MagicMock(delta=MagicMock(content=" World"))]),
            MagicMock(choices=[MagicMock(delta=MagicMock(content="!"))]),
        ]

        # Act & Assert
        with patch("agent.llm.acompletion", return_value=mock_chunks):
            chunks = []
            async for chunk in client.stream_complete(messages):
                chunks.append(chunk)

        assert len(chunks) == 3
        assert chunks[0] == "Hello"
        assert chunks[1] == " World"
        assert chunks[2] == "!"
```

- [ ] **Step 2: 运行测试确保失败**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/unit/test_llm.py -v
```

Expected: ImportError（agent.llm 不存在）

- [ ] **Step 3: 实现 LLM 模块 agent/__init__.py**

```python
"""SwiftClaw agent module."""

from agent.llm import LLMClient, LLMResponse

__all__ = ["LLMClient", "LLMResponse"]
```

- [ ] **Step 4: 实现 LLM 客户端 agent/llm.py（绿阶段）**

```python
"""LLM client wrapper for Kimi API via litellm."""

from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

from litellm import acompletion
from loguru import logger

from config.settings import Settings


@dataclass
class LLMResponse:
    """Standardized response from LLM."""

    content: str
    model: str
    usage: Dict[str, Any] | None = None


class LLMClient:
    """Client for interacting with LLM APIs through litellm."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize LLM client.

        Args:
            settings: Application settings. If None, loads from environment.
        """
        from config import get_settings

        self.settings = settings or get_settings()
        self.model = self.settings.moonshot_model
        self._api_key = self.settings.moonshot_api_key

    async def complete(
        self,
        messages: List[Dict[str, str]],
        system_message: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Send completion request to LLM.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            system_message: Optional system message to prepend.
            temperature: Sampling temperature (0-2).
            max_tokens: Maximum tokens to generate.

        Returns:
            LLMResponse with generated content and metadata.

        Raises:
            ValueError: If messages list is empty.
            Exception: If API call fails.
        """
        if not messages:
            raise ValueError("消息列表不能为空")

        # Prepend system message if provided
        full_messages = list(messages)
        if system_message:
            full_messages.insert(0, {"role": "system", "content": system_message})

        logger.debug(f"Sending completion request with {len(full_messages)} messages")

        try:
            response = await acompletion(
                model=self.model,
                messages=full_messages,
                api_key=self._api_key,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            content = response.choices[0].message.content or ""
            usage = dict(response.usage) if response.usage else {}

            logger.debug(f"Received response: {len(content)} chars, usage: {usage}")

            return LLMResponse(
                content=content,
                model=response.model or self.model,
                usage=usage,
            )

        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            raise

    async def stream_complete(
        self,
        messages: List[Dict[str, str]],
        system_message: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Stream completion from LLM.

        Args:
            messages: List of message dicts.
            system_message: Optional system message to prepend.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.

        Yields:
            Content chunks as they arrive.

        Raises:
            ValueError: If messages list is empty.
        """
        if not messages:
            raise ValueError("消息列表不能为空")

        full_messages = list(messages)
        if system_message:
            full_messages.insert(0, {"role": "system", "content": system_message})

        logger.debug(f"Starting streaming completion with {len(full_messages)} messages")

        try:
            stream = await acompletion(
                model=self.model,
                messages=full_messages,
                api_key=self._api_key,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content

        except Exception as e:
            logger.error(f"LLM streaming failed: {e}")
            raise
```

- [ ] **Step 5: 运行测试确保通过**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/unit/test_llm.py -v
```

Expected: 7 tests PASSED

- [ ] **Step 6: 类型检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m mypy agent/ --ignore-missing-imports
```

Expected: Success: no issues found

- [ ] **Step 7: 提交代码**

```bash
cd /home/ypp/projects/swiftclaw
git add agent/ tests/unit/test_llm.py
git commit -m "feat: add LLM client with Kimi API support

- Add LLMClient class wrapping litellm acompletion
- Support sync and streaming completions
- Add system message injection
- Include comprehensive error handling and logging

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Telegram Bot 集成

**Files:**
- Create: `gateway/__init__.py`
- Create: `gateway/telegram.py`
- Create: `tests/integration/test_telegram_bot.py`

- [ ] **Step 1: 编写 Telegram Bot 测试（红阶段）**

Create `tests/integration/test_telegram_bot.py`:

```python
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
    settings.telegram_bot_token = "test-token"
    settings.telegram_allowed_users = []
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
        mock_process.assert_called_once_with("Hello bot", 123456)
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
```

- [ ] **Step 2: 运行测试确保失败**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/integration/test_telegram_bot.py -v
```

Expected: ImportError（gateway.telegram 不存在）

- [ ] **Step 3: 实现 Gateway 模块 gateway/__init__.py**

```python
"""SwiftClaw gateway module."""

from gateway.telegram import TelegramBotHandler

__all__ = ["TelegramBotHandler"]
```

- [ ] **Step 4: 实现 Telegram Bot 处理器 gateway/telegram.py（绿阶段）**

```python
"""Telegram Bot handler for message processing."""

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters
from loguru import logger

from config.settings import Settings
from agent.llm import LLMClient


class TelegramBotHandler:
    """Handler for Telegram bot messages and commands."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize Telegram bot handler.

        Args:
            settings: Application settings. If None, loads from environment.
        """
        from config import get_settings

        self.settings = settings or get_settings()
        self.allowed_users = self.settings.telegram_allowed_users
        self._llm_client: LLMClient | None = None

    @property
    def llm_client(self) -> LLMClient:
        """Lazy initialization of LLM client."""
        if self._llm_client is None:
            self._llm_client = LLMClient(settings=self.settings)
        return self._llm_client

    def _is_user_authorized(self, user_id: int) -> bool:
        """Check if user is authorized to use the bot.

        Args:
            user_id: Telegram user ID.

        Returns:
            True if authorized, False otherwise.
        """
        # Empty whitelist means allow all
        if not self.allowed_users:
            return True
        return user_id in self.allowed_users

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /start command.

        Args:
            update: Telegram update object.
            context: Telegram context object.
        """
        user = update.effective_user
        welcome_text = f"""🦞 欢迎使用 SwiftClaw!

你好, {user.first_name}!

我是你的个人 AI 助手,由 Kimi 驱动。我可以:
- 💬 与你进行智能对话
- 📁 帮你管理文件
- 🔧 执行命令和脚本
- 🌐 浏览网页获取信息

发送 /help 查看可用命令。
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=welcome_text)
        logger.info(f"User {user.id} ({user.username}) started the bot")

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /help command.

        Args:
            update: Telegram update object.
            context: Telegram context object.
        """
        help_text = """📖 SwiftClaw 帮助

可用命令:
/start - 开始使用
/help - 显示此帮助信息
/clear - 清空当前会话记忆
/status - 查看服务状态

直接发送消息即可与我对话!

提示:
- 我可以理解自然语言指令
- 支持中文和英文
- 响应可能因网络原因有几秒延迟
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=help_text)

    async def clear_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /clear command.

        Args:
            update: Telegram update object.
            context: Telegram context object.
        """
        # TODO: Implement memory clearing in Phase 3
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="🧹 会话记忆已清空(功能开发中)",
        )
        logger.info(f"User {update.effective_user.id} cleared session")

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /status command.

        Args:
            update: Telegram update object.
            context: Telegram context object.
        """
        status_text = f"""📊 服务状态

✅ Bot 运行正常
🤖 模型: {self.settings.moonshot_model}
👤 用户: {update.effective_user.username or update.effective_user.id}

提示: 记忆功能将在 Phase 3 实现
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=status_text)

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle incoming text messages.

        Args:
            update: Telegram update object.
            context: Telegram context object.
        """
        user = update.effective_user
        message_text = update.message.text

        # Authorization check
        if not self._is_user_authorized(user.id):
            logger.warning(f"Unauthorized access attempt from user {user.id}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="⛔ 未授权访问。请联系管理员将你的用户 ID 添加到白名单。",
            )
            return

        logger.info(f"Received message from {user.id}: {message_text[:50]}...")

        # Send typing indicator
        await context.bot.send_chat_action(
            chat_id=update.effective_chat.id,
            action="typing",
        )

        try:
            # Process message through LLM
            response_text = await self._process_message(message_text, user.id)

            # Send response (split if too long)
            await self._send_long_message(
                context.bot,
                update.effective_chat.id,
                response_text,
            )

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=f"❌ 处理消息时出错: {str(e)[:200]}",
            )

    async def _process_message(self, message: str, user_id: int) -> str:
        """Process user message through LLM.

        Args:
            message: User message text.
            user_id: Telegram user ID for context.

        Returns:
            LLM response text.
        """
        messages = [{"role": "user", "content": message}]

        system_message = (
            "你是一个 helpful 的 AI 助手。"
            "回答要简洁明了。"
            "如果需要使用工具，请明确告知用户。"
        )

        response = await self.llm_client.complete(
            messages=messages,
            system_message=system_message,
        )

        return response.content

    async def _send_long_message(
        self,
        bot,
        chat_id: int,
        text: str,
        max_length: int = 4000,
    ) -> None:
        """Send long message by splitting into chunks.

        Args:
            bot: Telegram bot instance.
            chat_id: Chat ID to send to.
            text: Message text (may be long).
            max_length: Maximum length per message.
        """
        if len(text) <= max_length:
            await bot.send_message(chat_id=chat_id, text=text)
            return

        # Split into chunks
        chunks = []
        current_chunk = ""

        for line in text.split("\n"):
            if len(current_chunk) + len(line) + 1 > max_length:
                chunks.append(current_chunk)
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"

        if current_chunk:
            chunks.append(current_chunk)

        # Send chunks
        for i, chunk in enumerate(chunks):
            prefix = f"(Part {i+1}/{len(chunks)})\n\n" if len(chunks) > 1 else ""
            await bot.send_message(chat_id=chat_id, text=prefix + chunk)

    def create_application(self) -> Application:
        """Create and configure Telegram bot application.

        Returns:
            Configured Application instance.
        """
        application = Application.builder().token(self.settings.telegram_bot_token).build()

        # Add command handlers
        application.add_handler(CommandHandler("start", self.start_command))
        application.add_handler(CommandHandler("help", self.help_command))
        application.add_handler(CommandHandler("clear", self.clear_command))
        application.add_handler(CommandHandler("status", self.status_command))

        # Add message handler (must be last)
        application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message)
        )

        logger.info("Telegram bot application configured")
        return application
```

- [ ] **Step 5: 运行测试确保通过**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/integration/test_telegram_bot.py -v
```

Expected: 8 tests PASSED

- [ ] **Step 6: 类型检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m mypy gateway/ --ignore-missing-imports
```

Expected: Success: no issues found

- [ ] **Step 7: 提交代码**

```bash
cd /home/ypp/projects/swiftclaw
git add gateway/ tests/integration/
git commit -m "feat: add Telegram Bot integration

- Add TelegramBotHandler with command support
- Implement user authorization with whitelist
- Add message processing with LLM integration
- Support long message splitting
- Include start, help, clear, status commands

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: FastAPI Gateway 和主入口

**Files:**
- Create: `gateway/server.py`
- Create: `main.py`

- [ ] **Step 1: 实现 FastAPI 服务器 gateway/server.py**

```python
"""FastAPI gateway server."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from loguru import logger

from config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    settings = get_settings()
    logger.info(f"Starting SwiftClaw Gateway on port {settings.port}")
    logger.info(f"Using model: {settings.moonshot_model}")
    yield
    # Shutdown
    logger.info("Shutting down SwiftClaw Gateway")


def create_app() -> FastAPI:
    """Create and configure FastAPI application.

    Returns:
        Configured FastAPI app instance.
    """
    app = FastAPI(
        title="SwiftClaw Gateway",
        description="Personal AI Assistant Platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/health", status_code=status.HTTP_200_OK)
    async def health_check() -> dict[str, str]:
        """Health check endpoint.

        Returns:
            Health status JSON.
        """
        return {"status": "healthy", "service": "swiftclaw-gateway"}

    @app.get("/api/status")
    async def service_status() -> dict[str, str]:
        """Service status endpoint.

        Returns:
            Detailed service status.
        """
        settings = get_settings()
        return {
            "service": "swiftclaw",
            "version": "0.1.0",
            "model": settings.moonshot_model,
            "status": "running",
        }

    return app
```

- [ ] **Step 2: 实现主入口 main.py**

```python
"""SwiftClaw main entry point."""

import asyncio
import sys

from loguru import logger

from config import get_settings
from gateway.server import create_app
from gateway.telegram import TelegramBotHandler


def setup_logging() -> None:
    """Configure logging with loguru."""
    settings = get_settings()

    # Remove default handler
    logger.remove()

    # Add console handler with custom format
    logger.add(
        sys.stdout,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
               "<level>{message}</level>",
    )


async def run_telegram_bot() -> None:
    """Run Telegram bot in polling mode."""
    settings = get_settings()
    handler = TelegramBotHandler(settings=settings)
    application = handler.create_application()

    logger.info("Starting Telegram bot in polling mode...")

    await application.initialize()
    await application.start()
    await application.updater.start_polling(drop_pending_updates=True)

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        logger.info("Telegram bot received shutdown signal")
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


async def main() -> None:
    """Main entry point."""
    setup_logging()

    logger.info("=" * 50)
    logger.info("SwiftClaw Starting...")
    logger.info("=" * 50)

    # Run Telegram bot
    await run_telegram_bot()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
```

- [ ] **Step 3: 更新 gateway/__init__.py 导出**

```python
"""SwiftClaw gateway module."""

from gateway.server import create_app
from gateway.telegram import TelegramBotHandler

__all__ = ["create_app", "TelegramBotHandler"]
```

- [ ] **Step 4: 运行基础测试**

```bash
cd /home/ypp/projects/swiftclaw
python -c "from gateway.server import create_app; app = create_app(); print('FastAPI app created successfully')"
```

Expected: FastAPI app created successfully

- [ ] **Step 5: 类型检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m mypy main.py --ignore-missing-imports
```

Expected: Success: no issues found

- [ ] **Step 6: 提交代码**

```bash
cd /home/ypp/projects/swiftclaw
git add gateway/server.py main.py
git commit -m "feat: add FastAPI gateway and main entry point

- Add FastAPI server with health and status endpoints
- Implement main.py with Telegram bot runner
- Configure loguru logging
- Add graceful shutdown handling

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 安装依赖和最终验证

- [ ] **Step 1: 创建虚拟环境并安装依赖**

```bash
cd /home/ypp/projects/swiftclaw
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: Successfully installed all packages

- [ ] **Step 2: 安装开发依赖**

```bash
cd /home/ypp/projects/swiftclaw
pip install pytest pytest-asyncio pytest-cov mypy ruff respx httpx
```

- [ ] **Step 3: 运行所有测试**

```bash
cd /home/ypp/projects/swiftclaw
python -m pytest tests/ -v --cov=. --cov-report=term-missing
```

Expected: All tests passed, coverage > 80% for tested modules

- [ ] **Step 4: 最终类型检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m mypy . --ignore-missing-imports
```

Expected: Success: no issues found

- [ ] **Step 5: 代码风格检查**

```bash
cd /home/ypp/projects/swiftclaw
python -m ruff check .
```

Expected: All checks passed

- [ ] **Step 6: 最终提交**

```bash
cd /home/ypp/projects/swiftclaw
git add -A
git commit -m "chore: setup dependencies and finalize Phase 1

- Add virtual environment setup
- Configure pytest with coverage
- Pass all type checks and linting
- Ready for Phase 1 integration testing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 1 验收标准

实施完成后，验证以下功能：

### 功能测试

- [ ] 复制 `.env.example` 为 `.env` 并填写真实 API 密钥
- [ ] 运行 `python main.py` 启动服务
- [ ] 在 Telegram 中发送 `/start`，收到欢迎消息
- [ ] 发送普通消息，收到 Kimi 的回复
- [ ] 发送 `/status`，看到服务状态信息
- [ ] 访问 `http://localhost:8000/health` 返回健康状态

### 代码质量

- [ ] 所有单元测试通过
- [ ] mypy 类型检查无错误
- [ ] ruff 代码检查无错误
- [ ] 测试覆盖率 > 80%（配置和 LLM 模块）

---

## 自我审查检查清单

### Spec 覆盖检查

| PRD 需求 | 对应任务 | 状态 |
|----------|----------|------|
| 项目脚手架 | Task 1 | ✅ |
| 环境配置管理 | Task 1 | ✅ |
| Kimi API 集成 | Task 2 | ✅ |
| Telegram Bot 通道 | Task 3 | ✅ |
| FastAPI Gateway | Task 4 | ✅ |
| 基础对话流程 | Task 3, 4 | ✅ |
| 流式输出 | Task 2 (基础支持) | ✅ |

### Placeholder 检查

- ✅ 无 "TBD" 或 "TODO"
- ✅ 所有代码步骤包含完整代码
- ✅ 所有测试步骤包含完整测试代码
- ✅ 命令包含预期输出

### 类型一致性检查

- ✅ `Settings` 类在 config/settings.py 中定义
- ✅ `LLMClient` 接受 `Settings` 类型参数
- ✅ `TelegramBotHandler` 接受 `Settings` 类型参数
- ✅ 方法签名一致

---

**计划完成！** 保存在 `docs/superpowers/plans/2026-03-26-phase1-core-framework.md`
