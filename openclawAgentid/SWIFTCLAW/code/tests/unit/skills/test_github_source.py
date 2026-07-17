"""Unit tests for GitHub skill source."""

import re
from unittest.mock import MagicMock, patch

import httpx
import pytest

from skills.github_source import GitHubSkillSource, ParsedSource


class TestParsedSource:
    """Tests for ParsedSource dataclass."""

    def test_parsed_source_creation(self):
        """Test creating a ParsedSource instance."""
        source = ParsedSource(owner="testuser", repo="testrepo")
        assert source.owner == "testuser"
        assert source.repo == "testrepo"
        assert source.ref is None
        assert source.path is None

    def test_parsed_source_with_all_fields(self):
        """Test creating a ParsedSource with all fields."""
        source = ParsedSource(
            owner="testuser",
            repo="testrepo",
            ref="v1.0.0",
            path="subdir"
        )
        assert source.owner == "testuser"
        assert source.repo == "testrepo"
        assert source.ref == "v1.0.0"
        assert source.path == "subdir"


class TestParseSource:
    """Tests for source string parsing."""

    def setup_method(self):
        """Set up test fixtures."""
        self.source = GitHubSkillSource()

    def test_parse_source_simple(self):
        """Test parsing owner/repo format."""
        result = self.source._parse_source("owner/repo")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "main"
        assert result.path is None

    def test_parse_source_with_version(self):
        """Test parsing owner/repo@v1.0.0 format."""
        result = self.source._parse_source("owner/repo@v1.0.0")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "v1.0.0"
        assert result.path is None

    def test_parse_source_with_branch(self):
        """Test parsing owner/repo#develop format."""
        result = self.source._parse_source("owner/repo#develop")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "develop"
        assert result.path is None

    def test_parse_source_with_path(self):
        """Test parsing owner/repo/path/to/skill format."""
        result = self.source._parse_source("owner/repo/path/to/skill")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "main"
        assert result.path == "path/to/skill"

    def test_parse_source_with_version_and_path(self):
        """Test parsing owner/repo@v1.0.0/path/to/skill format."""
        result = self.source._parse_source("owner/repo@v1.0.0/path/to/skill")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "v1.0.0"
        assert result.path == "path/to/skill"

    def test_parse_source_full_url(self):
        """Test parsing https://github.com/owner/repo format."""
        result = self.source._parse_source("https://github.com/owner/repo")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "main"
        assert result.path is None

    def test_parse_source_full_url_with_ref(self):
        """Test parsing https://github.com/owner/repo/tree/develop format."""
        result = self.source._parse_source("https://github.com/owner/repo/tree/develop")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "develop"
        assert result.path is None

    def test_parse_source_full_url_with_path(self):
        """Test parsing https://github.com/owner/repo/tree/main/subdir format."""
        result = self.source._parse_source("https://github.com/owner/repo/tree/main/subdir")
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "main"
        assert result.path == "subdir"

    def test_parse_source_full_url_with_nested_path(self):
        """Test parsing URL with nested path."""
        result = self.source._parse_source(
            "https://github.com/owner/repo/tree/v1.0.0/path/to/skill"
        )
        assert result.owner == "owner"
        assert result.repo == "repo"
        assert result.ref == "v1.0.0"
        assert result.path == "path/to/skill"

    def test_parse_source_invalid_format(self):
        """Test parsing invalid format raises ValueError."""
        with pytest.raises(ValueError, match="Invalid source format"):
            self.source._parse_source("invalid-format")

    def test_parse_source_empty_string(self):
        """Test parsing empty string raises ValueError."""
        with pytest.raises(ValueError, match="Invalid source format"):
            self.source._parse_source("")

    def test_parse_source_only_owner(self):
        """Test parsing only owner raises ValueError."""
        with pytest.raises(ValueError, match="Invalid source format"):
            self.source._parse_source("owner")


class TestBuildRawUrl:
    """Tests for raw URL building."""

    def setup_method(self):
        """Set up test fixtures."""
        self.source = GitHubSkillSource()

    def test_build_raw_url_simple(self):
        """Test building raw URL with minimal parsed source."""
        parsed = ParsedSource(owner="owner", repo="repo", ref="main")
        url = self.source._build_raw_url(parsed)
        assert url == "https://raw.githubusercontent.com/owner/repo/main/skill.md"

    def test_build_raw_url_with_path(self):
        """Test building raw URL with path."""
        parsed = ParsedSource(owner="owner", repo="repo", ref="v1.0.0", path="subdir")
        url = self.source._build_raw_url(parsed)
        assert url == "https://raw.githubusercontent.com/owner/repo/v1.0.0/subdir/skill.md"

    def test_build_raw_url_with_nested_path(self):
        """Test building raw URL with nested path."""
        parsed = ParsedSource(
            owner="owner", repo="repo", ref="develop", path="skills/github"
        )
        url = self.source._build_raw_url(parsed)
        assert url == "https://raw.githubusercontent.com/owner/repo/develop/skills/github/skill.md"

    def test_build_raw_url_strips_leading_slash(self):
        """Test that leading slashes in path are stripped."""
        parsed = ParsedSource(owner="owner", repo="repo", ref="main", path="/subdir")
        url = self.source._build_raw_url(parsed)
        assert url == "https://raw.githubusercontent.com/owner/repo/main/subdir/skill.md"

    def test_build_raw_url_strips_trailing_slash(self):
        """Test that trailing slashes in path are stripped."""
        parsed = ParsedSource(owner="owner", repo="repo", ref="main", path="subdir/")
        url = self.source._build_raw_url(parsed)
        assert url == "https://raw.githubusercontent.com/owner/repo/main/subdir/skill.md"


class TestFetch:
    """Tests for fetch method with mocked HTTP."""

    def setup_method(self):
        """Set up test fixtures."""
        self.source = GitHubSkillSource()
        self.valid_skill_content = """---
name: test-skill
description: A test skill
version: 1.0.0
---

# Test Skill

This is a test skill content.
"""

    @patch("skills.github_source.httpx.Client")
    def test_fetch_success(self, mock_client_class):
        """Test successful fetch returns Skill."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = self.valid_skill_content

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        skill = source.fetch("owner/repo")

        assert skill.name == "test-skill"
        assert skill.description == "A test skill"
        assert skill.version == "1.0.0"
        assert skill.source_url == "https://github.com/owner/repo"

        mock_client.get.assert_called_once()
        call_args = mock_client.get.call_args[0][0]
        assert "raw.githubusercontent.com" in call_args
        assert "owner/repo" in call_args

    @patch("skills.github_source.httpx.Client")
    def test_fetch_not_found(self, mock_client_class):
        """Test 404 response raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        with pytest.raises(ValueError, match="Skill not found"):
            source.fetch("owner/nonexistent")

    @patch("skills.github_source.httpx.Client")
    def test_fetch_server_error(self, mock_client_class):
        """Test 500 response raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        with pytest.raises(ValueError, match="Failed to fetch skill: HTTP 500"):
            source.fetch("owner/repo")

    @patch("skills.github_source.httpx.Client")
    def test_fetch_network_error(self, mock_client_class):
        """Test network error raises ValueError."""
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.NetworkError("Connection failed")
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        with pytest.raises(ValueError, match="Network error fetching skill"):
            source.fetch("owner/repo")

    @patch("skills.github_source.httpx.Client")
    def test_fetch_timeout(self, mock_client_class):
        """Test timeout raises ValueError."""
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.TimeoutException("Request timed out")
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        with pytest.raises(ValueError, match="Timeout fetching skill"):
            source.fetch("owner/repo")

    @patch("skills.github_source.httpx.Client")
    def test_fetch_with_version(self, mock_client_class):
        """Test fetch with specific version."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = self.valid_skill_content

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        skill = source.fetch("owner/repo@v1.0.0")

        call_args = mock_client.get.call_args[0][0]
        assert "v1.0.0" in call_args

    @patch("skills.github_source.httpx.Client")
    def test_fetch_with_path(self, mock_client_class):
        """Test fetch with subdirectory path."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = self.valid_skill_content

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        skill = source.fetch("owner/repo/subdir")

        call_args = mock_client.get.call_args[0][0]
        assert "subdir/skill.md" in call_args

    @patch("skills.github_source.httpx.Client")
    def test_fetch_full_url(self, mock_client_class):
        """Test fetch with full GitHub URL."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = self.valid_skill_content

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        skill = source.fetch("https://github.com/owner/repo/tree/develop/skills")

        call_args = mock_client.get.call_args[0][0]
        assert "develop" in call_args
        assert "skills/skill.md" in call_args

    @patch("skills.github_source.httpx.Client")
    def test_fetch_invalid_skill_content(self, mock_client_class):
        """Test fetch with invalid skill content raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "Invalid content without frontmatter"

        mock_client = MagicMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client

        source = GitHubSkillSource()
        with pytest.raises(ValueError, match="No YAML frontmatter found"):
            source.fetch("owner/repo")
