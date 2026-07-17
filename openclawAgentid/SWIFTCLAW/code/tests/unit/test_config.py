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
            "TELEGRAM_ALLOWED_USERS_STR": "123,456,789",
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
