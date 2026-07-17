"""Tests for Skill data models."""

import pytest
from datetime import datetime
from pathlib import Path

from skills.models import Skill, SkillInstallLog, SkillUsageLog


class TestSkill:
    """Tests for Skill model."""

    def test_skill_creation_with_required_fields(self):
        """Test creating a Skill with required fields."""
        skill = Skill(
            name="test-skill",
            description="A test skill",
            content="# Test Skill\n\nThis is a test skill."
        )
        assert skill.name == "test-skill"
        assert skill.description == "A test skill"
        assert skill.content == "# Test Skill\n\nThis is a test skill."
        assert skill.tools == []
        assert skill.params == {}
        assert skill.version == "0.0.0"
        assert skill.author is None
        assert skill.source_url is None
        assert skill.is_local is False
        assert skill.local_path is None
        assert isinstance(skill.installed_at, datetime)
        assert isinstance(skill.updated_at, datetime)

    def test_skill_name_validation_valid(self):
        """Test valid skill names pass validation."""
        valid_names = [
            "test-skill",
            "my-skill-123",
            "skill123",
            "a-b-c",
            "simple"
        ]
        for name in valid_names:
            skill = Skill(name=name, description="Test", content="Test")
            assert skill.name == name

    def test_skill_name_validation_invalid(self):
        """Test invalid skill names fail validation."""
        invalid_names = [
            "TestSkill",  # uppercase
            "my_skill",   # underscore
            "my skill",   # space
            "-skill",     # starts with hyphen
            "skill-",     # ends with hyphen
            "",           # empty
        ]
        for name in invalid_names:
            with pytest.raises(ValueError):
                Skill(name=name, description="Test", content="Test")

    def test_skill_to_prompt_section(self):
        """Test to_prompt_section method returns correct format."""
        skill = Skill(
            name="test-skill",
            description="A test skill",
            content="# Content\n\nDetails here."
        )
        expected = "### test-skill\nA test skill\n\n# Content\n\nDetails here."
        assert skill.to_prompt_section() == expected


class TestSkillInstallLog:
    """Tests for SkillInstallLog model."""

    def test_install_log_creation(self):
        """Test creating an install log entry."""
        log = SkillInstallLog(
            skill_name="test-skill",
            action="install",
            source_url="https://example.com/skill.yaml",
            version="1.0.0",
            success=True
        )
        assert log.skill_name == "test-skill"
        assert log.action == "install"
        assert log.source_url == "https://example.com/skill.yaml"
        assert log.version == "1.0.0"
        assert log.success is True
        assert log.error_message is None
        assert isinstance(log.created_at, datetime)

    def test_install_log_failure(self):
        """Test creating a failed install log."""
        log = SkillInstallLog(
            skill_name="test-skill",
            action="install",
            success=False,
            error_message="Network error"
        )
        assert log.success is False
        assert log.error_message == "Network error"


class TestSkillUsageLog:
    """Tests for SkillUsageLog model."""

    def test_usage_log_creation(self):
        """Test creating a usage log entry."""
        log = SkillUsageLog(
            skill_name="test-skill",
            conversation_id="conv-123",
            input_preview="input...",
            output_preview="output...",
            execution_time_ms=150,
            success=True
        )
        assert log.skill_name == "test-skill"
        assert log.conversation_id == "conv-123"
        assert log.input_preview == "input..."
        assert log.output_preview == "output..."
        assert log.execution_time_ms == 150
        assert log.success is True
        assert isinstance(log.created_at, datetime)

    def test_usage_log_minimal(self):
        """Test creating a minimal usage log."""
        log = SkillUsageLog(skill_name="test-skill")
        assert log.skill_name == "test-skill"
        assert log.conversation_id is None
        assert log.execution_time_ms is None
        assert log.success is True
