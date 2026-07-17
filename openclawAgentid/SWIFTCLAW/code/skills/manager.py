"""Skill manager for installing, removing, and managing skills."""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from skills.database import SkillDatabase
from skills.github_source import GitHubSkillSource
from skills.models import Skill
from skills.parser import SkillParser


@dataclass
class InstallResult:
    """Result of a skill installation operation."""

    success: bool
    skill_name: str
    version: str
    is_local: bool
    message: str


@dataclass
class UpdateResult:
    """Result of a skill update operation."""

    success: bool
    skill_name: str
    old_version: str
    new_version: str
    message: str


class SkillManager:
    """Manager for skill installation, removal, and retrieval."""

    def __init__(
        self,
        global_dir: str | Path,
        project_dir: str | Path,
        db_path: str | Path = ":memory:",
        github_token: str | None = None,
    ) -> None:
        """Initialize the skill manager.

        Args:
            global_dir: Directory for global skills.
            project_dir: Directory for project-local skills.
            db_path: Path to SQLite database file.
            github_token: Optional GitHub token for private repositories.
        """
        self.global_dir = Path(global_dir)
        self.project_dir = Path(project_dir)
        self.db_path = db_path
        self.github_token = github_token

        self._db: SkillDatabase | None = None
        self._github_source: GitHubSkillSource | None = None
        self._parser = SkillParser()

    async def initialize(self) -> None:
        """Initialize database and directories."""
        # Create directories if they don't exist
        self.global_dir.mkdir(parents=True, exist_ok=True)
        self.project_dir.mkdir(parents=True, exist_ok=True)

        # Initialize database
        self._db = SkillDatabase(self.db_path)
        await self._db.connect()

        # Initialize GitHub source
        self._github_source = GitHubSkillSource()

    async def close(self) -> None:
        """Close database connection."""
        if self._db:
            await self._db.close()
            self._db = None

    async def install(self, source: str, is_local: bool = False) -> InstallResult:
        """Install a skill from a source.

        Args:
            source: Source reference (GitHub repo or local path).
            is_local: If True, install to project_dir; otherwise to global_dir.

        Returns:
            InstallResult with installation status and details.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        try:
            # Fetch skill from source
            if is_local:
                # Parse local file
                skill = self._parser.parse_file(Path(source))
                skill.is_local = True
                skill.local_path = Path(source)
            else:
                # Fetch from GitHub
                if not self._github_source:
                    raise RuntimeError("GitHub source not initialized")
                skill = self._github_source.fetch(source)
                skill.is_local = False
                skill.local_path = None

            # Check if skill already exists
            existing = await self._db.get_skill_by_name(skill.name)
            if existing:
                return InstallResult(
                    success=False,
                    skill_name=skill.name,
                    version=skill.version,
                    is_local=is_local,
                    message=f"Skill '{skill.name}' already exists (version {existing.version}). Use update() to update.",
                )

            # Determine target directory
            target_dir = self.project_dir if is_local else self.global_dir
            skill_dir = target_dir / skill.name
            skill_dir.mkdir(parents=True, exist_ok=True)

            # Write skill.md file
            skill_file = skill_dir / "skill.md"
            skill_content = self._build_skill_file_content(skill)
            skill_file.write_text(skill_content, encoding="utf-8")

            # Update local path
            skill.local_path = skill_file

            # Save to database
            await self._db.create_skill(skill)

            # Log installation
            await self._db.log_install(
                skill_name=skill.name,
                action="install",
                source_url=skill.source_url,
                version=skill.version,
                success=True,
            )

            return InstallResult(
                success=True,
                skill_name=skill.name,
                version=skill.version,
                is_local=is_local,
                message=f"Successfully installed skill '{skill.name}' (version {skill.version})",
            )

        except Exception as e:
            # Try to extract skill name from error context if possible
            skill_name = "unknown"
            error_msg = str(e)

            # Log failed installation
            if self._db:
                await self._db.log_install(
                    skill_name=skill_name,
                    action="install",
                    source_url=source if not is_local else None,
                    version=None,
                    success=False,
                    error_message=error_msg,
                )

            return InstallResult(
                success=False,
                skill_name=skill_name,
                version="0.0.0",
                is_local=is_local,
                message=f"Failed to install skill: {error_msg}",
            )

    async def remove(self, name: str) -> bool:
        """Remove a skill by name.

        Args:
            name: Name of the skill to remove.

        Returns:
            True if skill was removed, False if not found.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        # Get skill to find its location
        skill = await self._db.get_skill_by_name(name)
        if not skill:
            return False

        # Remove from filesystem if local_path exists
        if skill.local_path and skill.local_path.exists():
            # Remove the skill.md file
            skill.local_path.unlink()
            # Remove parent directory if empty
            parent_dir = skill.local_path.parent
            if parent_dir.exists() and not any(parent_dir.iterdir()):
                parent_dir.rmdir()

        # Remove from database
        deleted = await self._db.delete_skill(name)

        # Log removal
        if deleted:
            await self._db.log_install(
                skill_name=name,
                action="remove",
                version=skill.version,
                success=True,
            )

        return deleted

    async def update(self, name: str) -> UpdateResult:
        """Update a skill to the latest version.

        Args:
            name: Name of the skill to update.

        Returns:
            UpdateResult with update status and details.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        # Get existing skill
        existing = await self._db.get_skill_by_name(name)
        if not existing:
            return UpdateResult(
                success=False,
                skill_name=name,
                old_version="0.0.0",
                new_version="0.0.0",
                message=f"Skill '{name}' not found",
            )

        old_version = existing.version

        # Cannot update local skills (no source to fetch from)
        if existing.is_local:
            return UpdateResult(
                success=False,
                skill_name=name,
                old_version=old_version,
                new_version=old_version,
                message=f"Cannot update local skill '{name}'. Local skills must be updated manually.",
            )

        # Cannot update without source URL
        if not existing.source_url:
            return UpdateResult(
                success=False,
                skill_name=name,
                old_version=old_version,
                new_version=old_version,
                message=f"Cannot update skill '{name}': no source URL available",
            )

        try:
            # Fetch updated skill from source
            if not self._github_source:
                raise RuntimeError("GitHub source not initialized")

            # Reconstruct source from source_url
            source = self._extract_source_from_url(existing.source_url)
            new_skill = self._github_source.fetch(source)

            # Check if version changed
            if new_skill.version == old_version:
                return UpdateResult(
                    success=True,
                    skill_name=name,
                    old_version=old_version,
                    new_version=old_version,
                    message=f"Skill '{name}' is already up to date (version {old_version})",
                )

            # Update skill file
            if existing.local_path:
                skill_content = self._build_skill_file_content(new_skill)
                existing.local_path.write_text(skill_content, encoding="utf-8")
                new_skill.local_path = existing.local_path

            # Update in database (delete old, create new)
            await self._db.delete_skill(name)
            new_skill.is_local = False
            new_skill.updated_at = datetime.now()
            await self._db.create_skill(new_skill)

            # Log update
            await self._db.log_install(
                skill_name=name,
                action="update",
                source_url=new_skill.source_url,
                version=new_skill.version,
                success=True,
            )

            return UpdateResult(
                success=True,
                skill_name=name,
                old_version=old_version,
                new_version=new_skill.version,
                message=f"Successfully updated skill '{name}' from {old_version} to {new_skill.version}",
            )

        except Exception as e:
            error_msg = str(e)

            # Log failed update
            await self._db.log_install(
                skill_name=name,
                action="update",
                version=old_version,
                success=False,
                error_message=error_msg,
            )

            return UpdateResult(
                success=False,
                skill_name=name,
                old_version=old_version,
                new_version=old_version,
                message=f"Failed to update skill '{name}': {error_msg}",
            )

    async def list_skills(self, is_local: bool | None = None) -> list[Skill]:
        """List installed skills.

        Args:
            is_local: If provided, filter by local status.

        Returns:
            List of Skill models.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        return await self._db.list_skills(is_local)

    async def get_skill(self, name: str) -> Skill | None:
        """Get a skill by name.

        Args:
            name: Skill name to look up.

        Returns:
            Skill model if found, None otherwise.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        return await self._db.get_skill_by_name(name)

    async def build_skills_prompt(self) -> str:
        """Build the agent prompt section with available skills.

        Returns:
            Formatted prompt string with all installed skills.
        """
        if not self._db:
            raise RuntimeError("SkillManager not initialized. Call initialize() first.")

        skills = await self._db.list_skills()

        if not skills:
            return "## 可用 Skills\n\nNo skills installed."

        lines = ["## 可用 Skills", ""]

        for skill in skills:
            lines.append(f"### {skill.name}")
            lines.append(skill.description)
            lines.append("")
            lines.append(skill.content)
            lines.append("")

        return "\n".join(lines).strip()

    def _build_skill_file_content(self, skill: Skill) -> str:
        """Build the content for a skill.md file.

        Args:
            skill: Skill model to serialize.

        Returns:
            Formatted skill file content with YAML frontmatter.
        """
        lines = ["---"]
        lines.append(f"name: {skill.name}")
        lines.append(f"description: {skill.description}")
        lines.append(f"version: {skill.version}")

        if skill.tools:
            lines.append("tools:")
            for tool in skill.tools:
                lines.append(f"  - {tool}")

        if skill.params:
            lines.append("params:")
            for key, value in skill.params.items():
                lines.append(f"  {key}: {value}")

        if skill.author:
            lines.append(f"author: {skill.author}")

        if skill.source_url:
            lines.append(f"source_url: {skill.source_url}")

        lines.append("---")
        lines.append("")
        lines.append(skill.content)

        return "\n".join(lines)

    def _extract_source_from_url(self, source_url: str) -> str:
        """Extract a source reference from a source URL.

        Args:
            source_url: The source URL (e.g., https://github.com/owner/repo).

        Returns:
            Short source reference (e.g., owner/repo).
        """
        # Remove protocol and domain
        if source_url.startswith("https://github.com/"):
            return source_url[len("https://github.com/"):]
        if source_url.startswith("http://github.com/"):
            return source_url[len("http://github.com/"):]
        return source_url
