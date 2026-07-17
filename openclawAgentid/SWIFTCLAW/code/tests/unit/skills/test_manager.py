"""Unit tests for SkillManager."""

import json
import tempfile
from pathlib import Path

import pytest

from skills.database import SkillDatabase
from skills.manager import InstallResult, SkillManager, UpdateResult
from skills.models import Skill


@pytest.fixture
def temp_dirs():
    """Create temporary directories for testing."""
    with tempfile.TemporaryDirectory() as global_dir:
        with tempfile.TemporaryDirectory() as project_dir:
            yield Path(global_dir), Path(project_dir)


@pytest.fixture
async def skill_manager(temp_dirs):
    """Create an initialized SkillManager for testing."""
    global_dir, project_dir = temp_dirs
    manager = SkillManager(
        global_dir=global_dir,
        project_dir=project_dir,
        db_path=":memory:",
    )
    await manager.initialize()
    yield manager
    await manager.close()


@pytest.fixture
def sample_skill_content():
    """Sample skill content for testing."""
    return """---
name: test-skill
description: A test skill for unit testing
version: 1.0.0
author: test-author
tools:
  - tool1
  - tool2
params:
  key1: value1
---

# Test Skill

This is the content of the test skill.

## Usage

Use this skill for testing purposes.
"""


@pytest.fixture
def sample_skill_content_v2():
    """Updated sample skill content for testing."""
    return """---
name: test-skill
description: A test skill for unit testing (updated)
version: 1.1.0
author: test-author
tools:
  - tool1
  - tool2
params:
  key1: value1
---

# Test Skill (Updated)

This is the updated content of the test skill.

## Usage

Use this skill for testing purposes.
"""


class TestInstallResult:
    """Tests for InstallResult dataclass."""

    def test_install_result_creation(self):
        """Test creating an InstallResult."""
        result = InstallResult(
            success=True,
            skill_name="test-skill",
            version="1.0.0",
            is_local=False,
            message="Installation successful",
        )
        assert result.success is True
        assert result.skill_name == "test-skill"
        assert result.version == "1.0.0"
        assert result.is_local is False
        assert result.message == "Installation successful"


class TestUpdateResult:
    """Tests for UpdateResult dataclass."""

    def test_update_result_creation(self):
        """Test creating an UpdateResult."""
        result = UpdateResult(
            success=True,
            skill_name="test-skill",
            old_version="1.0.0",
            new_version="1.1.0",
            message="Update successful",
        )
        assert result.success is True
        assert result.skill_name == "test-skill"
        assert result.old_version == "1.0.0"
        assert result.new_version == "1.1.0"
        assert result.message == "Update successful"


class TestSkillManagerInitialization:
    """Tests for SkillManager initialization."""

    @pytest.mark.asyncio
    async def test_initialize_creates_directories(self, temp_dirs):
        """Test that initialize creates necessary directories."""
        global_dir, project_dir = temp_dirs
        manager = SkillManager(
            global_dir=global_dir,
            project_dir=project_dir,
            db_path=":memory:",
        )

        # Directories should not exist yet
        assert not global_dir.exists()
        assert not project_dir.exists()

        await manager.initialize()

        # Directories should now exist
        assert global_dir.exists()
        assert project_dir.exists()

        await manager.close()

    @pytest.mark.asyncio
    async def test_initialize_creates_database(self, temp_dirs):
        """Test that initialize creates database tables."""
        global_dir, project_dir = temp_dirs
        manager = SkillManager(
            global_dir=global_dir,
            project_dir=project_dir,
            db_path=":memory:",
        )

        await manager.initialize()

        # Database should be accessible
        skills = await manager.list_skills()
        assert skills == []

        await manager.close()

    @pytest.mark.asyncio
    async def test_close_releases_database(self, temp_dirs):
        """Test that close properly releases database connection."""
        global_dir, project_dir = temp_dirs
        manager = SkillManager(
            global_dir=global_dir,
            project_dir=project_dir,
            db_path=":memory:",
        )

        await manager.initialize()
        await manager.close()

        # Operations should fail after close
        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.list_skills()


class TestSkillManagerInstall:
    """Tests for SkillManager install method."""

    @pytest.mark.asyncio
    async def test_install_local_skill(self, skill_manager, sample_skill_content, temp_dirs):
        """Test installing a skill from a local file."""
        global_dir, project_dir = temp_dirs

        # Create a temporary skill file
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)

        # Install the skill
        result = await skill_manager.install(str(skill_file), is_local=True)

        assert result.success is True
        assert result.skill_name == "test-skill"
        assert result.version == "1.0.0"
        assert result.is_local is True
        assert "Successfully installed" in result.message

        # Verify skill was saved to database
        skill = await skill_manager.get_skill("test-skill")
        assert skill is not None
        assert skill.name == "test-skill"
        assert skill.is_local is True

        # Verify skill file was created in project_dir
        installed_file = project_dir / "test-skill" / "skill.md"
        assert installed_file.exists()

    @pytest.mark.asyncio
    async def test_install_global_skill(self, skill_manager, sample_skill_content, temp_dirs):
        """Test installing a skill to global directory."""
        global_dir, project_dir = temp_dirs

        # Create a temporary skill file
        skill_file = global_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)

        # Install the skill (is_local=False means global)
        result = await skill_manager.install(str(skill_file), is_local=False)

        assert result.success is True
        assert result.is_local is False

        # Verify skill file was created in global_dir
        installed_file = global_dir / "test-skill" / "skill.md"
        assert installed_file.exists()

    @pytest.mark.asyncio
    async def test_install_duplicate_skill(self, skill_manager, sample_skill_content, temp_dirs):
        """Test installing a skill that already exists."""
        global_dir, project_dir = temp_dirs

        # Create and install first skill
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)

        result1 = await skill_manager.install(str(skill_file), is_local=True)
        assert result1.success is True

        # Try to install again
        result2 = await skill_manager.install(str(skill_file), is_local=True)
        assert result2.success is False
        assert "already exists" in result2.message

    @pytest.mark.asyncio
    async def test_install_invalid_skill_file(self, skill_manager, temp_dirs):
        """Test installing an invalid skill file."""
        global_dir, project_dir = temp_dirs

        # Create an invalid skill file (no frontmatter)
        skill_file = project_dir / "invalid.md"
        skill_file.write_text("No frontmatter here")

        result = await skill_manager.install(str(skill_file), is_local=True)
        assert result.success is False
        assert "No YAML frontmatter" in result.message


class TestSkillManagerRemove:
    """Tests for SkillManager remove method."""

    @pytest.mark.asyncio
    async def test_remove_existing_skill(self, skill_manager, sample_skill_content, temp_dirs):
        """Test removing an existing skill."""
        global_dir, project_dir = temp_dirs

        # Install a skill first
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        # Remove the skill
        result = await skill_manager.remove("test-skill")
        assert result is True

        # Verify skill is gone
        skill = await skill_manager.get_skill("test-skill")
        assert skill is None

    @pytest.mark.asyncio
    async def test_remove_nonexistent_skill(self, skill_manager):
        """Test removing a skill that doesn't exist."""
        result = await skill_manager.remove("nonexistent-skill")
        assert result is False

    @pytest.mark.asyncio
    async def test_removes_filesystem_files(self, skill_manager, sample_skill_content, temp_dirs):
        """Test that remove also deletes skill files."""
        global_dir, project_dir = temp_dirs

        # Install a skill
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        installed_file = project_dir / "test-skill" / "skill.md"
        assert installed_file.exists()

        # Remove the skill
        await skill_manager.remove("test-skill")

        # Verify file is gone
        assert not installed_file.exists()


class TestSkillManagerUpdate:
    """Tests for SkillManager update method."""

    @pytest.mark.asyncio
    async def test_update_nonexistent_skill(self, skill_manager):
        """Test updating a skill that doesn't exist."""
        result = await skill_manager.update("nonexistent-skill")

        assert result.success is False
        assert "not found" in result.message

    @pytest.mark.asyncio
    async def test_update_local_skill_fails(self, skill_manager, sample_skill_content, temp_dirs):
        """Test that updating a local skill fails appropriately."""
        global_dir, project_dir = temp_dirs

        # Install a local skill
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        # Try to update
        result = await skill_manager.update("test-skill")

        assert result.success is False
        assert "Cannot update local skill" in result.message


class TestSkillManagerListAndGet:
    """Tests for SkillManager list_skills and get_skill methods."""

    @pytest.mark.asyncio
    async def test_list_skills_empty(self, skill_manager):
        """Test listing skills when none are installed."""
        skills = await skill_manager.list_skills()
        assert skills == []

    @pytest.mark.asyncio
    async def test_list_skills_with_filter(self, skill_manager, sample_skill_content, temp_dirs):
        """Test listing skills with is_local filter."""
        global_dir, project_dir = temp_dirs

        # Install a local skill
        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        # Install a global skill (modify name to avoid conflict)
        global_content = sample_skill_content.replace("name: test-skill", "name: global-skill")
        global_file = global_dir / "global-skill.md"
        global_file.write_text(global_content)
        await skill_manager.install(str(global_file), is_local=False)

        # List all skills
        all_skills = await skill_manager.list_skills()
        assert len(all_skills) == 2

        # List only local skills
        local_skills = await skill_manager.list_skills(is_local=True)
        assert len(local_skills) == 1
        assert local_skills[0].name == "test-skill"

        # List only global skills
        global_skills = await skill_manager.list_skills(is_local=False)
        assert len(global_skills) == 1
        assert global_skills[0].name == "global-skill"

    @pytest.mark.asyncio
    async def test_get_skill_existing(self, skill_manager, sample_skill_content, temp_dirs):
        """Test getting an existing skill."""
        global_dir, project_dir = temp_dirs

        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        skill = await skill_manager.get_skill("test-skill")
        assert skill is not None
        assert skill.name == "test-skill"
        assert skill.description == "A test skill for unit testing"

    @pytest.mark.asyncio
    async def test_get_skill_nonexistent(self, skill_manager):
        """Test getting a skill that doesn't exist."""
        skill = await skill_manager.get_skill("nonexistent")
        assert skill is None


class TestSkillManagerBuildPrompt:
    """Tests for SkillManager build_skills_prompt method."""

    @pytest.mark.asyncio
    async def test_build_prompt_empty(self, skill_manager):
        """Test building prompt with no skills."""
        prompt = await skill_manager.build_skills_prompt()
        assert "## 可用 Skills" in prompt
        assert "No skills installed" in prompt

    @pytest.mark.asyncio
    async def test_build_prompt_with_skills(self, skill_manager, sample_skill_content, temp_dirs):
        """Test building prompt with installed skills."""
        global_dir, project_dir = temp_dirs

        skill_file = project_dir / "test-skill.md"
        skill_file.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file), is_local=True)

        prompt = await skill_manager.build_skills_prompt()

        assert "## 可用 Skills" in prompt
        assert "### test-skill" in prompt
        assert "A test skill for unit testing" in prompt
        assert "# Test Skill" in prompt

    @pytest.mark.asyncio
    async def test_build_prompt_multiple_skills(self, skill_manager, sample_skill_content, temp_dirs):
        """Test building prompt with multiple skills."""
        global_dir, project_dir = temp_dirs

        # Install first skill
        skill_file1 = project_dir / "test-skill.md"
        skill_file1.write_text(sample_skill_content)
        await skill_manager.install(str(skill_file1), is_local=True)

        # Install second skill
        skill2_content = sample_skill_content.replace("name: test-skill", "name: another-skill")
        skill2_content = skill2_content.replace("description: A test skill", "description: Another skill")
        skill_file2 = project_dir / "another-skill.md"
        skill_file2.write_text(skill2_content)
        await skill_manager.install(str(skill_file2), is_local=True)

        prompt = await skill_manager.build_skills_prompt()

        assert "### test-skill" in prompt
        assert "### another-skill" in prompt


class TestSkillManagerErrorHandling:
    """Tests for SkillManager error handling."""

    @pytest.mark.asyncio
    async def test_operations_before_initialize(self, temp_dirs):
        """Test that operations fail before initialize is called."""
        global_dir, project_dir = temp_dirs
        manager = SkillManager(
            global_dir=global_dir,
            project_dir=project_dir,
            db_path=":memory:",
        )

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.list_skills()

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.get_skill("test")

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.install("test")

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.remove("test")

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.update("test")

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.build_skills_prompt()
