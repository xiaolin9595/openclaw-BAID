"""Integration tests for the skill system.

Tests the complete workflow of skill installation, database storage,
and prompt building with proper mocking of external dependencies.
"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from skills.manager import InstallResult, SkillManager
from skills.models import Skill


@pytest.fixture
async def temp_skill_manager(tmp_path):
    """Create a temporary SkillManager for integration testing."""
    manager = SkillManager(
        global_dir=str(tmp_path / "skills"),
        project_dir=str(tmp_path / "project" / "skills"),
        db_path=str(tmp_path / "test.db"),
    )
    await manager.initialize()
    yield manager
    await manager.close()


@pytest.fixture
def test_skill_data():
    """Return test skill data for mocking."""
    return {
        "name": "test-repo",
        "description": "A test skill from GitHub repository",
        "content": "# Test Skill Content\n\nThis is the test skill content.\n\n## Usage\n\nUse this skill for testing purposes.",
        "version": "1.0.0",
        "author": "test-author",
        "tools": ["bash", "file"],
        "params": {"param1": "value1"},
    }


class TestFullInstallFlow:
    """Test the complete skill installation flow with mocked GitHub source."""

    @pytest.mark.asyncio
    async def test_full_install_flow(self, temp_skill_manager, tmp_path, test_skill_data):
        """Test complete installation flow with mocked GitHub source.

        Verifies:
        - InstallResult.success is True
        - Skill exists in database
        - skill.md file is written to filesystem
        """
        manager = temp_skill_manager

        # Create a mock skill to be returned by GitHubSkillSource.fetch()
        mock_skill = Skill(
            name=test_skill_data["name"],
            description=test_skill_data["description"],
            content=test_skill_data["content"],
            version=test_skill_data["version"],
            author=test_skill_data["author"],
            tools=test_skill_data["tools"],
            params=test_skill_data["params"],
            source_url="https://github.com/test/repo",
        )

        # Mock GitHubSkillSource.fetch() to return test skill
        with patch.object(manager._github_source, "fetch", return_value=mock_skill):
            # Call manager.install("test/repo")
            result = await manager.install("test/repo")

        # Verify InstallResult.success is True
        assert result.success is True, f"Expected success=True, got message: {result.message}"
        assert result.skill_name == "test-repo"
        assert result.version == "1.0.0"
        assert result.is_local is False
        assert "Successfully installed" in result.message

        # Verify skill exists in database
        skill = await manager.get_skill("test-repo")
        assert skill is not None, "Skill should exist in database"
        assert skill.name == "test-repo"
        assert skill.description == test_skill_data["description"]
        assert skill.content == test_skill_data["content"]
        assert skill.version == "1.0.0"
        assert skill.author == "test-author"
        assert skill.tools == ["bash", "file"]
        assert skill.params == {"param1": "value1"}

        # Verify skill.md file is written to filesystem
        skill_file = Path(manager.global_dir) / "test-repo" / "skill.md"
        assert skill_file.exists(), f"Skill file should exist at {skill_file}"

        # Verify file content contains expected data
        file_content = skill_file.read_text(encoding="utf-8")
        assert "name: test-repo" in file_content
        assert "description: A test skill from GitHub repository" in file_content
        assert "version: 1.0.0" in file_content
        assert "# Test Skill Content" in file_content


class TestSkillInjectionIntoPrompt:
    """Test skill injection into agent prompt."""

    @pytest.mark.asyncio
    async def test_skill_injection_into_prompt(self, temp_skill_manager, test_skill_data):
        """Test that installed skills are properly injected into prompt.

        Verifies:
        - Prompt contains "## 可用 Skills"
        - Prompt contains skill name and description
        - Prompt contains skill content
        """
        manager = temp_skill_manager

        # Create and install a test skill
        mock_skill = Skill(
            name=test_skill_data["name"],
            description=test_skill_data["description"],
            content=test_skill_data["content"],
            version=test_skill_data["version"],
            author=test_skill_data["author"],
            tools=test_skill_data["tools"],
            params=test_skill_data["params"],
            source_url="https://github.com/test/repo",
        )

        with patch.object(manager._github_source, "fetch", return_value=mock_skill):
            await manager.install("test/repo")

        # Call manager.build_skills_prompt()
        prompt = await manager.build_skills_prompt()

        # Verify prompt contains "## 可用 Skills"
        assert "## 可用 Skills" in prompt, "Prompt should contain '## 可用 Skills' header"

        # Verify prompt contains skill name and description
        assert "### test-repo" in prompt, "Prompt should contain skill name as section header"
        assert test_skill_data["description"] in prompt, "Prompt should contain skill description"

        # Verify prompt contains skill content
        assert "# Test Skill Content" in prompt, "Prompt should contain skill content"
        assert "Use this skill for testing purposes" in prompt, "Prompt should contain full skill content"

    @pytest.mark.asyncio
    async def test_multiple_skills_in_prompt(self, temp_skill_manager):
        """Test prompt building with multiple installed skills."""
        manager = temp_skill_manager

        # Install first skill
        skill1 = Skill(
            name="skill-one",
            description="First test skill",
            content="# Skill One\n\nContent for skill one.",
            version="1.0.0",
            source_url="https://github.com/test/skill1",
        )

        with patch.object(manager._github_source, "fetch", return_value=skill1):
            await manager.install("test/skill1")

        # Install second skill
        skill2 = Skill(
            name="skill-two",
            description="Second test skill",
            content="# Skill Two\n\nContent for skill two.",
            version="2.0.0",
            source_url="https://github.com/test/skill2",
        )

        with patch.object(manager._github_source, "fetch", return_value=skill2):
            await manager.install("test/skill2")

        # Build prompt
        prompt = await manager.build_skills_prompt()

        # Verify both skills are in prompt
        assert "## 可用 Skills" in prompt
        assert "### skill-one" in prompt
        assert "### skill-two" in prompt
        assert "First test skill" in prompt
        assert "Second test skill" in prompt
        assert "# Skill One" in prompt
        assert "# Skill Two" in prompt

    @pytest.mark.asyncio
    async def test_empty_skills_prompt(self, temp_skill_manager):
        """Test prompt building when no skills are installed."""
        manager = temp_skill_manager

        prompt = await manager.build_skills_prompt()

        assert "## 可用 Skills" in prompt
        assert "No skills installed" in prompt


class TestInstallFlowErrorHandling:
    """Test error handling in the installation flow."""

    @pytest.mark.asyncio
    async def test_install_with_github_fetch_failure(self, temp_skill_manager):
        """Test handling of GitHub fetch failure."""
        manager = temp_skill_manager

        # Mock GitHubSkillSource.fetch() to raise an exception
        with patch.object(
            manager._github_source, "fetch", side_effect=ValueError("Network error")
        ):
            result = await manager.install("test/repo")

        # Verify failure is handled gracefully
        assert result.success is False
        assert "Failed to install" in result.message
        assert "Network error" in result.message

        # Verify no skill was created
        skill = await manager.get_skill("unknown")
        assert skill is None

    @pytest.mark.asyncio
    async def test_install_duplicate_skill(self, temp_skill_manager, test_skill_data):
        """Test installing a skill that already exists."""
        manager = temp_skill_manager

        mock_skill = Skill(
            name="test-repo",
            description=test_skill_data["description"],
            content=test_skill_data["content"],
            version="1.0.0",
            source_url="https://github.com/test/repo",
        )

        # First installation
        with patch.object(manager._github_source, "fetch", return_value=mock_skill):
            result1 = await manager.install("test/repo")
        assert result1.success is True

        # Second installation should fail
        with patch.object(manager._github_source, "fetch", return_value=mock_skill):
            result2 = await manager.install("test/repo")

        assert result2.success is False
        assert "already exists" in result2.message


class TestSkillPersistence:
    """Test skill persistence across manager sessions."""

    @pytest.mark.asyncio
    async def test_skill_persisted_to_database(self, tmp_path, test_skill_data):
        """Test that skills are persisted and can be retrieved in new session."""
        db_path = tmp_path / "persistent.db"
        global_dir = tmp_path / "skills"
        project_dir = tmp_path / "project" / "skills"

        # Create first manager instance and install skill
        manager1 = SkillManager(
            global_dir=str(global_dir),
            project_dir=str(project_dir),
            db_path=str(db_path),
        )
        await manager1.initialize()

        mock_skill = Skill(
            name="persistent-skill",
            description="A persistent skill",
            content="# Persistent\n\nThis skill should persist.",
            version="1.0.0",
            source_url="https://github.com/test/persistent",
        )

        with patch.object(manager1._github_source, "fetch", return_value=mock_skill):
            await manager1.install("test/persistent")

        await manager1.close()

        # Create second manager instance with same database
        manager2 = SkillManager(
            global_dir=str(global_dir),
            project_dir=str(project_dir),
            db_path=str(db_path),
        )
        await manager2.initialize()

        # Verify skill is still available
        skill = await manager2.get_skill("persistent-skill")
        assert skill is not None
        assert skill.name == "persistent-skill"
        assert skill.description == "A persistent skill"

        # Verify prompt includes the skill
        prompt = await manager2.build_skills_prompt()
        assert "### persistent-skill" in prompt

        await manager2.close()
