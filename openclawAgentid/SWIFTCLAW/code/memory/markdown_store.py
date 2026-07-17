"""Markdown-based persistent memory storage."""

import asyncio
import re
from datetime import datetime
from pathlib import Path

import aiofiles
from loguru import logger


class MarkdownMemoryStore:
    """Manages per-user Markdown memory files (memory.md and daily logs)."""

    def __init__(self, base_dir: Path):
        """Initialize with base directory for user data.

        Args:
            base_dir: Root directory for all user data (e.g., code/user_data).
        """
        self.base_dir = Path(base_dir)
        self._locks: dict[int, asyncio.Lock] = {}

    def _user_dir(self, telegram_id: int) -> Path:
        """Get user-specific directory."""
        return self.base_dir / str(telegram_id)

    def _memory_path(self, telegram_id: int) -> Path:
        """Get path to user's memory.md."""
        return self._user_dir(telegram_id) / "memory.md"

    def _log_path(self, telegram_id: int, date_str: str | None = None) -> Path:
        """Get path to daily log file."""
        date = date_str or datetime.now().strftime("%Y-%m-%d")
        log_dir = self._user_dir(telegram_id) / "logs"
        return log_dir / f"{date}.md"

    async def ensure_directories(self, telegram_id: int) -> None:
        """Create user directories if they don't exist."""
        user_dir = self._user_dir(telegram_id)
        log_dir = user_dir / "logs"
        user_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)

    async def read_memory_md(self, telegram_id: int) -> str:
        """Read memory.md content. Returns empty string if not exists."""
        path = self._memory_path(telegram_id)
        if not path.exists():
            return ""
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            return await f.read()

    def _get_lock(self, telegram_id: int) -> asyncio.Lock:
        if telegram_id not in self._locks:
            self._locks[telegram_id] = asyncio.Lock()
        return self._locks[telegram_id]

    async def write_memory_md(self, telegram_id: int, content: str) -> None:
        """Overwrite memory.md with new content."""
        async with self._get_lock(telegram_id):
            await self.ensure_directories(telegram_id)
            path = self._memory_path(telegram_id)
            async with aiofiles.open(path, "w", encoding="utf-8") as f:
                await f.write(content)
        logger.debug(f"Wrote memory.md for user {telegram_id}")

    async def upsert_memory_section(self, telegram_id: int, key: str, value: str) -> None:
        """Upsert a section into memory.md.

        If section with ## {key} exists, replace its paragraph.
        Otherwise append a new section.
        """
        async with self._get_lock(telegram_id):
            content = await self.read_memory_md(telegram_id)
            section_heading = f"## {key}"
            new_section = f"{section_heading}\n{value}\n"

            if not content.strip():
                content = "# 用户记忆\n\n" + new_section
            elif section_heading in content:
                # Replace existing section (heading + its paragraph until next ## or EOF)
                pattern = re.compile(
                    rf"^{re.escape(section_heading)}\n.*?(?=\n## |\Z)",
                    re.MULTILINE | re.DOTALL,
                )
                content = pattern.sub(new_section.rstrip() + "\n", content)
            else:
                content = content.rstrip() + "\n\n" + new_section

            await self.ensure_directories(telegram_id)
            path = self._memory_path(telegram_id)
            async with aiofiles.open(path, "w", encoding="utf-8") as f:
                await f.write(content)
        logger.info(f"Upserted memory section '{key}' for user {telegram_id}")

    async def get_memory_sections(self, telegram_id: int) -> list[dict[str, str]]:
        """Extract all sections from memory.md."""
        content = await self.read_memory_md(telegram_id)
        if not content.strip():
            return []

        sections = []
        # Split by ## headings, skipping the main # title
        parts = re.split(r"\n## ", content)
        for part in parts[1:]:  # Skip # 用户记忆
            lines = part.split("\n", 1)
            if len(lines) == 2:
                key, body = lines
                sections.append({"key": key.strip(), "value": body.strip()})
            elif len(lines) == 1:
                sections.append({"key": lines[0].strip(), "value": ""})
        return sections

    async def recall_memory_section(self, telegram_id: int, key: str) -> str | None:
        """Find a specific section by key."""
        sections = await self.get_memory_sections(telegram_id)
        for section in sections:
            if section["key"] == key:
                return section["value"]
        return None

    async def append_log(self, telegram_id: int, role: str, content: str, timestamp: datetime | None = None) -> str:
        """Append a conversation entry to daily log file.

        Returns the written text block for FTS5 indexing.
        """
        await self.ensure_directories(telegram_id)
        ts = timestamp or datetime.now()
        path = self._log_path(telegram_id, ts.strftime("%Y-%m-%d"))
        time_str = ts.strftime("%H:%M")
        entry = f"\n## {time_str}\n**{role.capitalize()}:** {content}\n"

        # Write file header if new file
        if not path.exists():
            date_str = ts.strftime("%Y-%m-%d")
            header = f"# {date_str}\n"
            async with aiofiles.open(path, "w", encoding="utf-8") as f:
                await f.write(header + entry)
        else:
            async with aiofiles.open(path, "a", encoding="utf-8") as f:
                await f.write(entry)

        logger.debug(f"Appended log for user {telegram_id}")
        return entry

    async def append_to_log(self, telegram_id: int, raw_text: str, date_str: str | None = None) -> None:
        """Append raw text to daily log file safely."""
        async with self._get_lock(telegram_id):
            await self.ensure_directories(telegram_id)
            path = self._log_path(telegram_id, date_str)
            if not path.exists():
                date = date_str or datetime.now().strftime("%Y-%m-%d")
                header = f"# {date}\n"
                async with aiofiles.open(path, "w", encoding="utf-8") as f:
                    await f.write(header + raw_text)
            else:
                async with aiofiles.open(path, "a", encoding="utf-8") as f:
                    await f.write(raw_text)

    async def read_logs_for_dates(self, telegram_id: int, dates: list[str]) -> str:
        """Read log content for specified date strings."""
        parts = []
        for date_str in dates:
            path = self._log_path(telegram_id, date_str)
            if path.exists():
                async with aiofiles.open(path, "r", encoding="utf-8") as f:
                    parts.append(await f.read())
        return "\n".join(parts)

    async def memory_md_length(self, telegram_id: int) -> int:
        """Get character length of memory.md."""
        content = await self.read_memory_md(telegram_id)
        return len(content)
