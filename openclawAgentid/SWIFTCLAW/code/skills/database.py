"""Skill database operations using SQLite."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite

from skills.models import Skill, SkillInstallLog


class SkillDatabase:
    """Database interface for skill storage and retrieval."""

    def __init__(self, db_path: str | Path = ":memory:"):
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file. Use ':memory:' for in-memory DB.
        """
        self.db_path = db_path
        self._connection: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        """Connect to SQLite database and create tables."""
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row
        await self._create_tables()

    async def close(self) -> None:
        """Close database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None

    async def _create_tables(self) -> None:
        """Create database tables and indexes."""
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        # Create skills table
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                content TEXT NOT NULL,
                tools TEXT NOT NULL DEFAULT '[]',
                params TEXT NOT NULL DEFAULT '{}',
                version TEXT NOT NULL DEFAULT '0.0.0',
                author TEXT,
                source_url TEXT,
                is_local INTEGER NOT NULL DEFAULT 0,
                local_path TEXT,
                installed_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Create skill_install_logs table
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS skill_install_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_name TEXT NOT NULL,
                action TEXT NOT NULL,
                source_url TEXT,
                version TEXT,
                success INTEGER NOT NULL DEFAULT 1,
                error_message TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # Create indexes
        await self._connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)
        """)
        await self._connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_install_logs_skill ON skill_install_logs(skill_name)
        """)

        await self._connection.commit()

    def _skill_to_row(self, skill: Skill) -> dict[str, Any]:
        """Convert Skill model to database row dict."""
        return {
            "name": skill.name,
            "description": skill.description,
            "content": skill.content,
            "tools": json.dumps(skill.tools),
            "params": json.dumps(skill.params),
            "version": skill.version,
            "author": skill.author,
            "source_url": skill.source_url,
            "is_local": 1 if skill.is_local else 0,
            "local_path": str(skill.local_path) if skill.local_path else None,
            "installed_at": skill.installed_at.isoformat(),
            "updated_at": skill.updated_at.isoformat(),
        }

    def _row_to_skill(self, row: aiosqlite.Row) -> Skill:
        """Convert database row to Skill model."""
        return Skill(
            name=row["name"],
            description=row["description"],
            content=row["content"],
            tools=json.loads(row["tools"]),
            params=json.loads(row["params"]),
            version=row["version"],
            author=row["author"],
            source_url=row["source_url"],
            is_local=bool(row["is_local"]),
            local_path=Path(row["local_path"]) if row["local_path"] else None,
            installed_at=datetime.fromisoformat(row["installed_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def _row_to_install_log(self, row: aiosqlite.Row) -> SkillInstallLog:
        """Convert database row to SkillInstallLog model."""
        return SkillInstallLog(
            id=row["id"],
            skill_name=row["skill_name"],
            action=row["action"],
            source_url=row["source_url"],
            version=row["version"],
            success=bool(row["success"]),
            error_message=row["error_message"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    async def create_skill(self, skill: Skill) -> int:
        """Create a new skill record.

        Args:
            skill: Skill model to create.

        Returns:
            ID of the created skill.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        row = self._skill_to_row(skill)
        cursor = await self._connection.execute("""
            INSERT INTO skills (
                name, description, content, tools, params, version,
                author, source_url, is_local, local_path, installed_at, updated_at
            ) VALUES (
                :name, :description, :content, :tools, :params, :version,
                :author, :source_url, :is_local, :local_path, :installed_at, :updated_at
            )
        """, row)
        await self._connection.commit()
        return cursor.lastrowid

    async def get_skill_by_name(self, name: str) -> Skill | None:
        """Get a skill by its name.

        Args:
            name: Skill name to look up.

        Returns:
            Skill model if found, None otherwise.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        async with self._connection.execute(
            "SELECT * FROM skills WHERE name = ?", (name,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return self._row_to_skill(row)
            return None

    async def list_skills(self, is_local: bool | None = None) -> list[Skill]:
        """List all skills, optionally filtered by is_local.

        Args:
            is_local: If provided, filter by local status.

        Returns:
            List of Skill models.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        if is_local is None:
            async with self._connection.execute("SELECT * FROM skills") as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._connection.execute(
                "SELECT * FROM skills WHERE is_local = ?", (1 if is_local else 0,)
            ) as cursor:
                rows = await cursor.fetchall()

        return [self._row_to_skill(row) for row in rows]

    async def delete_skill(self, name: str) -> bool:
        """Delete a skill by name.

        Args:
            name: Skill name to delete.

        Returns:
            True if a skill was deleted, False otherwise.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        cursor = await self._connection.execute(
            "DELETE FROM skills WHERE name = ?", (name,)
        )
        await self._connection.commit()
        return cursor.rowcount > 0

    async def log_install(
        self,
        skill_name: str,
        action: str,
        source_url: str | None = None,
        version: str | None = None,
        success: bool = True,
        error_message: str | None = None,
    ) -> int:
        """Record a skill installation operation.

        Args:
            skill_name: Name of the skill.
            action: Action performed (install, update, remove).
            source_url: Source URL if applicable.
            version: Version of the skill.
            success: Whether the operation succeeded.
            error_message: Error message if failed.

        Returns:
            ID of the created log entry.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        created_at = datetime.now().isoformat()
        cursor = await self._connection.execute("""
            INSERT INTO skill_install_logs (
                skill_name, action, source_url, version, success, error_message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            skill_name,
            action,
            source_url,
            version,
            1 if success else 0,
            error_message,
            created_at,
        ))
        await self._connection.commit()
        return cursor.lastrowid

    async def get_install_logs(
        self,
        skill_name: str | None = None,
        limit: int = 100,
    ) -> list[SkillInstallLog]:
        """Get installation logs, optionally filtered by skill name.

        Args:
            skill_name: If provided, filter by skill name.
            limit: Maximum number of logs to return.

        Returns:
            List of SkillInstallLog models.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")

        if skill_name:
            async with self._connection.execute(
                """SELECT * FROM skill_install_logs
                   WHERE skill_name = ?
                   ORDER BY created_at DESC
                   LIMIT ?""",
                (skill_name, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._connection.execute(
                """SELECT * FROM skill_install_logs
                   ORDER BY created_at DESC
                   LIMIT ?""",
                (limit,),
            ) as cursor:
                rows = await cursor.fetchall()

        return [self._row_to_install_log(row) for row in rows]
