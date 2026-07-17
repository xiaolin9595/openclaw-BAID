"""Skill data models."""

import re
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, field_validator


class Skill(BaseModel):
    """Skill model representing a reusable skill/prompt template."""

    name: str = Field(..., description="Skill name (lowercase, alphanumeric, hyphens only)")
    description: str = Field(..., description="Short description of the skill")
    content: str = Field(..., description="Markdown content of the skill")
    tools: list[str] = Field(default_factory=list, description="List of tool dependencies")
    params: dict[str, Any] = Field(default_factory=dict, description="Parameter definitions")
    version: str = Field(default="0.0.0", description="Semantic version")
    author: str | None = Field(default=None, description="Author name or identifier")
    source_url: str | None = Field(default=None, description="URL to source repository")
    is_local: bool = Field(default=False, description="Whether skill is from local filesystem")
    local_path: Path | None = Field(default=None, description="Local filesystem path if applicable")
    installed_at: datetime = Field(default_factory=datetime.now, description="Installation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate skill name format: lowercase letters, numbers, hyphens only."""
        if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', v):
            raise ValueError(
                "Skill name must contain only lowercase letters, numbers, and hyphens. "
                "Cannot start or end with hyphen."
            )
        return v

    def to_prompt_section(self) -> str:
        """Convert skill to a prompt section format.

        Returns:
            Formatted string: "### {name}\n{description}\n\n{content}"
        """
        return f"### {self.name}\n{self.description}\n\n{self.content}"


class SkillInstallLog(BaseModel):
    """Log entry for skill installation/update/removal operations."""

    id: int | None = Field(default=None, description="Log entry ID")
    skill_name: str = Field(..., description="Name of the skill")
    action: str = Field(..., description="Action performed: install, update, or remove")
    source_url: str | None = Field(default=None, description="Source URL if applicable")
    version: str | None = Field(default=None, description="Version of the skill")
    success: bool = Field(default=True, description="Whether the operation succeeded")
    error_message: str | None = Field(default=None, description="Error message if failed")
    created_at: datetime = Field(default_factory=datetime.now, description="Timestamp")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action is one of the allowed values."""
        allowed = {"install", "update", "remove"}
        if v not in allowed:
            raise ValueError(f"Action must be one of: {allowed}")
        return v


class SkillUsageLog(BaseModel):
    """Log entry for skill usage/invocation."""

    id: int | None = Field(default=None, description="Log entry ID")
    skill_name: str = Field(..., description="Name of the skill used")
    conversation_id: str | None = Field(default=None, description="Associated conversation ID")
    input_preview: str | None = Field(default=None, description="Preview of input data")
    output_preview: str | None = Field(default=None, description="Preview of output data")
    execution_time_ms: int | None = Field(default=None, description="Execution time in milliseconds")
    success: bool = Field(default=True, description="Whether execution succeeded")
    created_at: datetime = Field(default_factory=datetime.now, description="Timestamp")
