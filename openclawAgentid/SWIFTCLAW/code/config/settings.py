"""Configuration management using pydantic-settings."""

import os
import re
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BASE_DIR = Path(__file__).resolve().parent.parent
_WINDOWS_DRIVE_PATH = re.compile(r"^([A-Za-z]):[\\/](.*)$")


def resolve_configured_path(raw_path: str | Path) -> Path:
    """Resolve a configured path across Windows and POSIX sessions.

    On POSIX, Windows drive paths like ``D:\\swiftclaw`` are mapped to common
    mount locations such as ``/mnt/d/swiftclaw`` when available.
    """
    raw_text = str(raw_path).strip()
    if not raw_text:
        raise ValueError("Path cannot be empty")

    if os.name != "nt":
        match = _WINDOWS_DRIVE_PATH.match(raw_text)
        if match:
            drive = match.group(1).lower()
            remainder = match.group(2).replace("\\", "/")
            for base in (
                Path(f"/mnt/{drive}"),
                Path(f"/run/desktop/mnt/host/{drive}"),
                Path(f"/media/{drive}"),
            ):
                if base.exists():
                    return (base / remainder).expanduser().resolve()

            raise ValueError(
                f"Windows path '{raw_text}' is not mounted in this session. "
                "Use a mounted POSIX path such as /mnt/d/swiftclaw, or start SwiftClaw "
                "from the desktop session that can access that drive."
            )

    return Path(raw_text).expanduser().resolve()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Anthropic Claude API (推荐)
    anthropic_api_key: str | None = Field(
        default=None,
        description="Anthropic API key (recommended)"
    )
    anthropic_model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Anthropic model name",
    )
    anthropic_base_url: str | None = Field(
        default=None,
        description="Custom base URL for Anthropic-compatible API endpoints",
    )

    # Moonshot (Kimi) API（备选）
    moonshot_api_key: str | None = Field(
        default=None,
        description="Moonshot API key (alternative)"
    )
    moonshot_model: str = Field(
        default="moonshot-v1-8k",
        description="Moonshot model name",
    )

    # Tavily Search API
    tavily_api_key: str | None = Field(
        default=None,
        description="Tavily Search API key (optional)"
    )

    # Telegram Bot
    telegram_bot_token: str = Field(..., description="Telegram bot token")
    telegram_allowed_users_str: str = Field(
        default="",
        description="Comma-separated list of allowed Telegram user IDs",
    )

    # Server settings
    port: int = Field(default=8000, description="Server port")
    log_level: str = Field(default="INFO", description="Log level")

    # Browser automation settings
    browser_headless: bool = Field(
        default=False,
        description="Run browser in headless mode",
    )
    browser_channel: str = Field(
        default="msedge",
        description="Playwright browser channel to launch, such as msedge",
    )
    browser_executable_path: str | None = Field(
        default=None,
        description="Optional browser executable path",
    )
    local_browser_proxy: str | None = Field(
        default=None,
        description="Optional public URL for a local browser proxy",
    )
    file_work_dir: str | None = Field(
        default=None,
        description="Optional root directory for file operations",
    )

    # Skill system settings
    skill_global_dir: str | None = Field(
        default=None,
        description="Global skill directory path",
    )
    skill_project_dir: str | None = Field(
        default=None,
        description="Project skill directory path",
    )
    skill_db_path: str | None = Field(
        default=None,
        description="Skill database file path",
    )
    skill_github_token: str | None = Field(
        default=None,
        description="GitHub token for skill repository access",
    )

    @property
    def telegram_allowed_users(self) -> list[int]:
        """Parse comma-separated user IDs into list of integers."""
        if not self.telegram_allowed_users_str:
            return []
        return [int(x.strip()) for x in self.telegram_allowed_users_str.split(",") if x.strip()]

    @property
    def resolved_file_work_dir(self) -> Path | None:
        """Resolve the configured file work directory, if any."""
        if not self.file_work_dir:
            return None
        return resolve_configured_path(self.file_work_dir)

    @property
    def resolved_skill_global_dir(self) -> Path:
        """Resolve the configured global skill directory."""
        if self.skill_global_dir:
            return resolve_configured_path(self.skill_global_dir)
        return Path.home() / ".swiftclaw" / "skills"

    @property
    def resolved_skill_project_dir(self) -> Path:
        """Resolve the configured project skill directory."""
        if self.skill_project_dir:
            return resolve_configured_path(self.skill_project_dir)
        return Path.cwd() / "skills"

    @property
    def resolved_skill_db_path(self) -> Path:
        """Resolve the configured skill database path."""
        if self.skill_db_path:
            return resolve_configured_path(self.skill_db_path)
        return Path.home() / ".swiftclaw" / "skills.db"

    @model_validator(mode="after")
    def require_llm_api_key(self) -> "Settings":
        """Require at least one LLM API key to be configured."""
        if not self.anthropic_api_key and not self.moonshot_api_key:
            raise ValueError(
                "moonshot_api_key or anthropic_api_key must be configured"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Returns:
        Settings: Application settings singleton.
    """
    # Support custom env file via ENV_FILE environment variable
    env_file = os.getenv("ENV_FILE")
    if env_file:
        env_path = Path(env_file)
        if not env_path.is_absolute():
            env_path = _BASE_DIR / env_path
    else:
        env_path = _BASE_DIR / ".env"

    return Settings(_env_file=env_path)  # type: ignore[call-arg]
