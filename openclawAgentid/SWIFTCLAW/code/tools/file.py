"""File tool implementation for SwiftClaw."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from config.settings import resolve_configured_path
from tools.base import Tool


class FileTool(Tool):
    """Tool for file system operations.

    Provides safe file read, write, and list operations with
    security checks to prevent directory traversal attacks.
    """

    def __init__(self, work_dir: str | Path | None = None) -> None:
        """Initialize FileTool.

        Args:
            work_dir: Working directory for file operations.
                      All paths are resolved relative to this directory.
                      Defaults to current working directory.
        """
        env_work_dir = os.getenv("FILE_WORK_DIR")
        if work_dir:
            self._work_dir = resolve_configured_path(work_dir)
        elif env_work_dir:
            self._work_dir = resolve_configured_path(env_work_dir)
        else:
            self._work_dir = Path.cwd()

    @property
    def name(self) -> str:
        """Return tool name."""
        return "file"

    @property
    def description(self) -> str:
        """Return tool description."""
        return "File system operations including read, write, and list directory contents"

    def _resolve_path(self, path: str | Path) -> Path:
        """Resolve and validate a path.

        Resolves the path relative to work_dir and ensures it doesn't
        escape the work directory (directory traversal protection).

        Args:
            path: The path to resolve.

        Returns:
            Resolved Path object.

        Raises:
            ValueError: If path escapes work directory.
        """
        # Convert to Path and resolve
        target = Path(path)

        # If path is absolute, resolve it directly
        # If relative, resolve relative to work_dir
        if target.is_absolute():
            resolved = target.resolve()
        else:
            resolved = (self._work_dir / target).resolve()

        # Security check: ensure resolved path is within work_dir
        try:
            resolved.relative_to(self._work_dir)
        except ValueError as e:
            raise ValueError(
                f"Path '{path}' escapes work directory '{self._work_dir}'"
            ) from e

        return resolved

    async def file_read(
        self, path: str, max_size_bytes: int = 1024 * 1024
    ) -> dict[str, Any]:
        """Read a text file.

        Args:
            path: Path to the file to read.
            max_size_bytes: Maximum file size in bytes (default 1MB).

        Returns:
            Dict with success status and file content or error message.
        """
        logger.debug(f"Reading file: {path}")

        try:
            # Resolve and validate path
            resolved_path = self._resolve_path(path)

            # Check if file exists
            if not resolved_path.exists():
                return {"success": False, "error": f"File not found: {path}"}

            # Check if it's a file
            if not resolved_path.is_file():
                return {"success": False, "error": f"Not a file: {path}"}

            # Check file size
            file_size = resolved_path.stat().st_size
            if file_size > max_size_bytes:
                return {
                    "success": False,
                    "error": (
                        f"File size ({file_size} bytes) exceeds limit "
                        f"({max_size_bytes} bytes)"
                    ),
                }

            # Read file with encoding detection
            content, encoding = self._read_with_encoding(resolved_path)

            logger.info(f"Successfully read file: {resolved_path}")
            return {
                "success": True,
                "content": content,
                "encoding": encoding,
            }

        except ValueError as e:
            logger.warning(f"Path validation failed: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            return {"success": False, "error": f"Error reading file: {e}"}

    def _read_with_encoding(self, path: Path) -> tuple[str, str]:
        """Read file with encoding detection.

        Tries UTF-8 first, then falls back to other encodings.

        Args:
            path: Path to the file.

        Returns:
            Tuple of (content, encoding).
        """
        # Try UTF-8 first
        try:
            content = path.read_text(encoding="utf-8")
            return content, "utf-8"
        except UnicodeDecodeError:
            pass

        # Try common encodings
        encodings = ["utf-8-sig", "gbk", "gb2312", "gb18030", "big5", "latin-1"]
        for encoding in encodings:
            try:
                content = path.read_text(encoding=encoding)
                return content, encoding
            except UnicodeDecodeError:
                continue

        # Last resort: read as binary and decode with errors='replace'
        content = path.read_bytes().decode("utf-8", errors="replace")
        return content, "utf-8-replace"

    async def file_write(
        self, path: str, content: str, append: bool = False
    ) -> dict[str, Any]:
        """Write content to a file.

        Args:
            path: Path to the file to write.
            content: Content to write.
            append: If True, append to file. If False, overwrite.

        Returns:
            Dict with success status and optional error message.
        """
        logger.debug(f"Writing file: {path} (append={append})")

        try:
            # Resolve and validate path
            resolved_path = self._resolve_path(path)

            # Create parent directories if they don't exist
            resolved_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            mode = "a" if append else "w"
            with open(resolved_path, mode, encoding="utf-8") as f:
                f.write(content)

            logger.info(f"Successfully wrote file: {resolved_path}")
            return {"success": True}

        except ValueError as e:
            logger.warning(f"Path validation failed: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error writing file: {e}")
            return {"success": False, "error": f"Error writing file: {e}"}

    async def file_list(self, directory: str = ".") -> dict[str, Any]:
        """List directory contents.

        Args:
            directory: Directory path to list. Defaults to current directory.

        Returns:
            Dict with success status and list of items or error message.
        """
        logger.debug(f"Listing directory: {directory}")

        try:
            # Resolve and validate path
            resolved_dir = self._resolve_path(directory)

            # Check if directory exists
            if not resolved_dir.exists():
                return {
                    "success": False,
                    "error": f"Directory not found: {directory}",
                }

            # Check if it's a directory
            if not resolved_dir.is_dir():
                return {"success": False, "error": f"Not a directory: {directory}"}

            # List directory contents
            items: list[dict[str, Any]] = []
            for entry in resolved_dir.iterdir():
                stat = entry.stat()
                item: dict[str, Any] = {
                    "name": entry.name,
                    "type": "directory" if entry.is_dir() else "file",
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }
                if entry.is_file():
                    item["size"] = stat.st_size
                items.append(item)

            # Sort items: directories first, then by name
            items.sort(key=lambda x: (x["type"] != "directory", x["name"].lower()))

            logger.info(f"Successfully listed directory: {resolved_dir}")
            return {"success": True, "items": items}

        except ValueError as e:
            logger.warning(f"Path validation failed: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error listing directory: {e}")
            return {"success": False, "error": f"Error listing directory: {e}"}

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute file tool action.

        Args:
            **kwargs: Must include 'action' key with value 'read', 'write', or 'list'.
                     Additional parameters depend on the action.

        Returns:
            Dict with execution result.
        """
        action = kwargs.get("action")

        if action == "read":
            path = kwargs.get("path")
            if not path:
                return {"success": False, "error": "Missing required parameter: path"}
            max_size = kwargs.get("max_size_bytes", 1024 * 1024)
            return await self.file_read(path, max_size)

        elif action == "write":
            path = kwargs.get("path")
            content = kwargs.get("content")
            if path is None or content is None:
                return {
                    "success": False,
                    "error": "Missing required parameters: path and content",
                }
            append = kwargs.get("append", False)
            return await self.file_write(path, content, append)

        elif action == "list":
            directory = kwargs.get("directory", ".")
            return await self.file_list(directory)

        elif action is None:
            return {"success": False, "error": "Missing required parameter: action"}

        else:
            return {"success": False, "error": f"Invalid action: {action}"}
