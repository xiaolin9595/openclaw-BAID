"""Skill file parser for extracting YAML frontmatter and markdown content."""

import re
from pathlib import Path
from typing import Any

import yaml

from skills.models import Skill


class SkillParser:
    """Parser for skill files with YAML frontmatter and markdown content."""

    # Regex pattern to match YAML frontmatter between --- markers
    FRONTMATTER_PATTERN = re.compile(
        r'^---\s*\n(.*?)\n---\s*\n(.*)$',
        re.DOTALL
    )

    def parse(self, content: str, source_url: str | None = None) -> Skill:
        """Parse skill content with YAML frontmatter.

        Args:
            content: The skill file content with YAML frontmatter.
            source_url: Optional URL to the source repository.

        Returns:
            Skill: A Skill instance populated from the parsed content.

        Raises:
            ValueError: If frontmatter is missing, YAML is invalid, or required fields are missing.
        """
        match = self.FRONTMATTER_PATTERN.match(content)
        if not match:
            raise ValueError("No YAML frontmatter found. Expected format: ---\n<yaml>\n---\n<content>")

        yaml_content = match.group(1)
        markdown_content = match.group(2)

        try:
            metadata: dict[str, Any] = yaml.safe_load(yaml_content) or {}
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML in frontmatter: {e}")

        # Validate required fields
        required_fields = ["name", "description"]
        missing_fields = [f for f in required_fields if f not in metadata or not metadata[f]]
        if missing_fields:
            raise ValueError(f"Missing required field(s): {', '.join(missing_fields)}")

        # Build Skill instance
        return Skill(
            name=metadata["name"],
            description=metadata["description"],
            content=markdown_content,
            tools=metadata.get("tools", []),
            params=metadata.get("params", {}),
            version=metadata.get("version", "0.0.0"),
            author=metadata.get("author"),
            source_url=source_url,
        )

    def parse_file(self, file_path: Path, source_url: str | None = None) -> Skill:
        """Parse a skill from a file.

        Args:
            file_path: Path to the skill file.
            source_url: Optional URL to the source repository.

        Returns:
            Skill: A Skill instance populated from the file.

        Raises:
            ValueError: If parsing fails.
            FileNotFoundError: If the file does not exist.
        """
        file_path = Path(file_path)
        content = file_path.read_text(encoding="utf-8")

        skill = self.parse(content, source_url=source_url)
        skill.is_local = True
        skill.local_path = file_path

        return skill
