"""Database connection and initialization for memory system."""

from pathlib import Path
from typing import Any

import aiosqlite
from loguru import logger

_DEFAULT_DB_PATH = str(Path(__file__).resolve().parent.parent / "memory_data" / "swiftclaw.db")


class Database:
    """SQLite database manager for memory system.

    Handles connection management, table creation, and basic query operations.
    """

    def __init__(self, db_path: str = _DEFAULT_DB_PATH):
        """Initialize database with path.

        Args:
            db_path: Path to SQLite database file.
        """
        self.db_path = Path(db_path)
        self._connection: aiosqlite.Connection | None = None

    async def connect(self) -> aiosqlite.Connection:
        """Connect to database and create tables if needed.

        Returns:
            Active database connection.
        """
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row
        await self._create_tables()
        logger.debug(f"Connected to database: {self.db_path}")
        return self._connection

    async def close(self) -> None:
        """Close database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.debug("Database connection closed")

    async def _create_tables(self) -> None:
        """Create database tables and indexes."""
        if not self._connection:
            raise RuntimeError("Database not connected")

        # Users table
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                preferences TEXT
            )
        """)

        # Conversations table
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Full-text search virtual table for log indexing
        await self._connection.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS log_fts USING fts5(
                content,
                source_file,
                user_id UNINDEXED
            )
        """)

        # Create index
        await self._connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversations_user_time
            ON conversations(user_id, timestamp)
        """)

        await self._connection.commit()
        logger.debug("Database tables and indexes created")

    async def execute(self, sql: str, parameters: tuple[Any, ...] = ()) -> aiosqlite.Cursor:
        """Execute SQL statement.

        Args:
            sql: SQL statement to execute.
            parameters: Parameters for the SQL statement.

        Returns:
            Cursor object.

        Raises:
            RuntimeError: If database is not connected.
        """
        if not self._connection:
            raise RuntimeError("Database not connected")
        cursor = await self._connection.execute(sql, parameters)
        await self._connection.commit()
        return cursor

    async def fetchone(self, sql: str, parameters: tuple[Any, ...] = ()) -> tuple[Any, ...] | None:
        """Execute query and return first row.

        Args:
            sql: SQL query to execute.
            parameters: Parameters for the SQL query.

        Returns:
            First row as tuple, or None if no results.

        Raises:
            RuntimeError: If database is not connected.
        """
        if not self._connection:
            raise RuntimeError("Database not connected")
        async with self._connection.execute(sql, parameters) as cursor:
            row = await cursor.fetchone()
            return tuple(row) if row else None

    async def fetchall(self, sql: str, parameters: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
        """Execute query and return all rows.

        Args:
            sql: SQL query to execute.
            parameters: Parameters for the SQL query.

        Returns:
            List of rows as tuples.

        Raises:
            RuntimeError: If database is not connected.
        """
        if not self._connection:
            raise RuntimeError("Database not connected")
        async with self._connection.execute(sql, parameters) as cursor:
            rows = await cursor.fetchall()
            return [tuple(row) for row in rows]
