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


