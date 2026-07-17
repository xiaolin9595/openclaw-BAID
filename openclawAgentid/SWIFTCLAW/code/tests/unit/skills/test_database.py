"""Tests for SkillDatabase operations."""

import pytest
from datetime import datetime
from pathlib import Path

from skills.database import SkillDatabase
from skills.models import Skill, SkillInstallLog


@pytest.fixture
async def db():
    """Create an in-memory database for testing."""
    database = SkillDatabase(":memory:")
    await database.connect()
    yield database
    await database.close()


@pytest.fixture
def sample_skill():
    """Create a sample skill for testing."""
    return Skill(
        name="test-skill",
        description="A test skill",
        content="# Test Skill\n\nThis is a test.",
        tools=["tool1", "tool2"],
        params={"param1": "value1"},
        version="1.0.0",
        author="test-author",
        source_url="https://example.com/skill.yaml",
        is_local=False,
    )


@pytest.fixture
def local_skill():
    """Create a local skill for testing."""
    return Skill(
        name="local-skill",
        description="A local skill",
        content="# Local Skill",
        is_local=True,
        local_path=Path("/path/to/skill.yaml"),
    )


class TestSkillDatabase:
    """Tests for SkillDatabase class."""

    @pytest.mark.asyncio
    async def test_create_skill(self, db, sample_skill):
        """Test creating a skill record."""
        skill_id = await db.create_skill(sample_skill)
        assert skill_id > 0

        # Verify skill was created
        retrieved = await db.get_skill_by_name("test-skill")
        assert retrieved is not None
        assert retrieved.name == "test-skill"
        assert retrieved.description == "A test skill"
        assert retrieved.content == "# Test Skill\n\nThis is a test."
        assert retrieved.tools == ["tool1", "tool2"]
        assert retrieved.params == {"param1": "value1"}
        assert retrieved.version == "1.0.0"
        assert retrieved.author == "test-author"
        assert retrieved.source_url == "https://example.com/skill.yaml"
        assert retrieved.is_local is False
        assert retrieved.local_path is None

    @pytest.mark.asyncio
    async def test_get_skill_by_name(self, db, sample_skill):
        """Test getting a skill by name."""
        await db.create_skill(sample_skill)

        retrieved = await db.get_skill_by_name("test-skill")
        assert retrieved is not None
        assert retrieved.name == "test-skill"

    @pytest.mark.asyncio
    async def test_get_skill_not_found(self, db):
        """Test getting a non-existent skill returns None."""
        retrieved = await db.get_skill_by_name("non-existent")
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_list_skills(self, db, sample_skill, local_skill):
        """Test listing all skills."""
        await db.create_skill(sample_skill)
        await db.create_skill(local_skill)

        skills = await db.list_skills()
        assert len(skills) == 2
        names = {s.name for s in skills}
        assert names == {"test-skill", "local-skill"}

    @pytest.mark.asyncio
    async def test_list_skills_filter_local(self, db, sample_skill, local_skill):
        """Test listing skills filtered by is_local."""
        await db.create_skill(sample_skill)
        await db.create_skill(local_skill)

        local_skills = await db.list_skills(is_local=True)
        assert len(local_skills) == 1
        assert local_skills[0].name == "local-skill"
        assert local_skills[0].is_local is True

        remote_skills = await db.list_skills(is_local=False)
        assert len(remote_skills) == 1
        assert remote_skills[0].name == "test-skill"
        assert remote_skills[0].is_local is False

    @pytest.mark.asyncio
    async def test_delete_skill(self, db, sample_skill):
        """Test deleting a skill."""
        await db.create_skill(sample_skill)

        # Verify skill exists
        assert await db.get_skill_by_name("test-skill") is not None

        # Delete skill
        deleted = await db.delete_skill("test-skill")
        assert deleted is True

        # Verify skill is gone
        assert await db.get_skill_by_name("test-skill") is None

    @pytest.mark.asyncio
    async def test_delete_skill_not_found(self, db):
        """Test deleting a non-existent skill returns False."""
        deleted = await db.delete_skill("non-existent")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_log_install(self, db):
        """Test recording an install log."""
        log_id = await db.log_install(
            skill_name="test-skill",
            action="install",
            source_url="https://example.com/skill.yaml",
            version="1.0.0",
            success=True,
        )
        assert log_id > 0

        logs = await db.get_install_logs("test-skill")
        assert len(logs) == 1
        assert logs[0].skill_name == "test-skill"
        assert logs[0].action == "install"
        assert logs[0].source_url == "https://example.com/skill.yaml"
        assert logs[0].version == "1.0.0"
        assert logs[0].success is True
        assert logs[0].error_message is None

    @pytest.mark.asyncio
    async def test_log_install_failure(self, db):
        """Test recording a failed install log."""
        await db.log_install(
            skill_name="failing-skill",
            action="install",
            source_url="https://example.com/bad.yaml",
            version="1.0.0",
            success=False,
            error_message="Network error",
        )

        logs = await db.get_install_logs("failing-skill")
        assert len(logs) == 1
        assert logs[0].success is False
        assert logs[0].error_message == "Network error"

    @pytest.mark.asyncio
    async def test_get_install_logs_with_limit(self, db):
        """Test getting install logs with limit."""
        # Create multiple logs
        for i in range(5):
            await db.log_install(
                skill_name="test-skill",
                action="install",
                version=f"1.0.{i}",
            )

        logs = await db.get_install_logs("test-skill", limit=3)
        assert len(logs) == 3

    @pytest.mark.asyncio
    async def test_get_install_logs_all_skills(self, db):
        """Test getting install logs for all skills."""
        await db.log_install(skill_name="skill-a", action="install")
        await db.log_install(skill_name="skill-b", action="update")

        logs = await db.get_install_logs()
        assert len(logs) == 2

    @pytest.mark.asyncio
    async def test_skill_with_local_path(self, db, local_skill):
        """Test storing and retrieving a skill with local path."""
        await db.create_skill(local_skill)

        retrieved = await db.get_skill_by_name("local-skill")
        assert retrieved is not None
        assert retrieved.is_local is True
        assert retrieved.local_path == Path("/path/to/skill.yaml")

    @pytest.mark.asyncio
    async def test_skill_timestamps(self, db, sample_skill):
        """Test that skill timestamps are preserved."""
        before = datetime.now()
        await db.create_skill(sample_skill)
        after = datetime.now()

        retrieved = await db.get_skill_by_name("test-skill")
        assert before <= retrieved.installed_at <= after
        assert before <= retrieved.updated_at <= after

    @pytest.mark.asyncio
    async def test_database_not_connected(self):
        """Test that operations fail when not connected."""
        database = SkillDatabase(":memory:")

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.create_skill(sample_skill())

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.get_skill_by_name("test")

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.list_skills()

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.delete_skill("test")

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.log_install(skill_name="test", action="install")

        with pytest.raises(RuntimeError, match="Database not connected"):
            await database.get_install_logs()
