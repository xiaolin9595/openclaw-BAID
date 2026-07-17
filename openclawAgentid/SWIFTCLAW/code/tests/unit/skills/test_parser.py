"""Tests for SkillParser."""

import pytest
from pathlib import Path
from skills.parser import SkillParser
from skills.models import Skill


class TestSkillParser:
    """Test cases for SkillParser."""

    def test_parse_valid_skill(self):
        """Test parsing a valid skill with all required fields."""
        content = """---
name: test-skill
description: A test skill
tools:
  - tool1
  - tool2
params:
  key: value
version: "1.0.0"
author: test-author
---

# Skill Content

This is the markdown content of the skill.
"""
        parser = SkillParser()
        skill = parser.parse(content, source_url="https://example.com/skill.md")

        assert isinstance(skill, Skill)
        assert skill.name == "test-skill"
        assert skill.description == "A test skill"
        assert skill.content == "# Skill Content\n\nThis is the markdown content of the skill.\n"
        assert skill.tools == ["tool1", "tool2"]
        assert skill.params == {"key": "value"}
        assert skill.version == "1.0.0"
        assert skill.author == "test-author"
        assert skill.source_url == "https://example.com/skill.md"

    def test_parse_missing_required_fields(self):
        """Test that parsing fails when required fields are missing."""
        content = """---
name: test-skill
---

# Skill Content
"""
        parser = SkillParser()
        with pytest.raises(ValueError, match="Missing required field"):
            parser.parse(content)

    def test_parse_invalid_yaml(self):
        """Test that parsing fails with invalid YAML."""
        content = """---
name: test-skill
description: [invalid: yaml: here
---

# Skill Content
"""
        parser = SkillParser()
        with pytest.raises(ValueError, match="Invalid YAML"):
            parser.parse(content)

    def test_parse_no_frontmatter(self):
        """Test that parsing fails when there is no frontmatter."""
        content = """# Skill Content

This skill has no frontmatter.
"""
        parser = SkillParser()
        with pytest.raises(ValueError, match="No YAML frontmatter found"):
            parser.parse(content)

    def test_parse_file(self, tmp_path: Path):
        """Test parsing a skill from a file."""
        skill_file = tmp_path / "test-skill.md"
        skill_file.write_text("""---
name: file-skill
description: A skill from file
---

# File Skill Content
""")
        parser = SkillParser()
        skill = parser.parse_file(skill_file)

        assert isinstance(skill, Skill)
        assert skill.name == "file-skill"
        assert skill.description == "A skill from file"
        assert skill.is_local is True
        assert skill.local_path == skill_file

    def test_parse_minimal_skill(self):
        """Test parsing a skill with only required fields."""
        content = """---
name: minimal-skill
description: Minimal skill
---

Content here.
"""
        parser = SkillParser()
        skill = parser.parse(content)

        assert skill.name == "minimal-skill"
        assert skill.description == "Minimal skill"
        assert skill.content == "Content here.\n"
        assert skill.tools == []
        assert skill.params == {}
        assert skill.version == "0.0.0"
