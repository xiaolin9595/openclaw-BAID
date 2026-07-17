"""Tests for FileTool implementation."""

import os
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.file import FileTool


class TestFileToolBasics:
    """Test basic FileTool properties."""

    def test_name(self):
        """Test tool name is correct."""
        tool = FileTool()
        assert tool.name == "file"

    def test_description(self):
        """Test tool description exists."""
        tool = FileTool()
        assert isinstance(tool.description, str)
        assert len(tool.description) > 0
        assert "file" in tool.description.lower()


class TestFileRead:
    """Test file_read functionality."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def tool(self, temp_dir):
        """Create FileTool instance with temp_dir as work_dir."""
        return FileTool(work_dir=temp_dir)

    async def test_read_existing_file(self, tool, temp_dir):
        """Test reading an existing file."""
        test_file = Path(temp_dir) / "test.txt"
        test_content = "Hello, World!"
        test_file.write_text(test_content)

        result = await tool.file_read("test.txt")

        assert result["success"] is True
        assert result["content"] == test_content
        assert "encoding" in result

    async def test_read_nonexistent_file(self, tool, temp_dir):
        """Test reading a file that doesn't exist."""
        result = await tool.file_read("nonexistent.txt")

        assert result["success"] is False
        assert "error" in result

    async def test_read_file_with_different_encoding(self, tool, temp_dir):
        """Test reading file with UTF-8 encoding."""
        test_file = Path(temp_dir) / "utf8.txt"
        test_content = "Hello, 世界!"
        test_file.write_text(test_content, encoding="utf-8")

        result = await tool.file_read("utf8.txt")

        assert result["success"] is True
        assert result["content"] == test_content

    async def test_read_file_size_limit(self, tool, temp_dir):
        """Test file size limit enforcement."""
        test_file = Path(temp_dir) / "large.txt"
        # Create a file larger than 1MB
        test_file.write_bytes(b"x" * (1024 * 1024 + 1))

        result = await tool.file_read("large.txt")

        assert result["success"] is False
        assert "error" in result
        assert "size" in result["error"].lower() or "limit" in result["error"].lower()

    async def test_read_directory_traversal_attempt(self, tool, temp_dir):
        """Test that directory traversal is blocked."""
        # Try to access parent directory
        result = await tool.file_read("../outside.txt")

        assert result["success"] is False
        assert "error" in result

    async def test_read_with_custom_size_limit(self, tool, temp_dir):
        """Test custom size limit."""
        test_file = Path(temp_dir) / "medium.txt"
        test_file.write_bytes(b"x" * 500)  # 500 bytes

        # Should fail with 100 byte limit
        result = await tool.file_read("medium.txt", max_size_bytes=100)
        assert result["success"] is False

        # Should succeed with 1000 byte limit
        result = await tool.file_read("medium.txt", max_size_bytes=1000)
        assert result["success"] is True

    async def test_read_directory_instead_of_file(self, tool, temp_dir):
        """Test reading a directory instead of file."""
        (Path(temp_dir) / "subdir").mkdir()

        result = await tool.file_read("subdir")

        assert result["success"] is False
        assert "error" in result

    async def test_read_with_absolute_path(self, tool, temp_dir):
        """Test reading with absolute path within work_dir."""
        test_file = Path(temp_dir) / "abs_test.txt"
        test_file.write_text("absolute path content")

        # Use absolute path
        result = await tool.file_read(str(test_file))

        assert result["success"] is True
        assert result["content"] == "absolute path content"

    async def test_read_with_gbk_encoding(self, tool, temp_dir):
        """Test reading file with GBK encoding."""
        test_file = Path(temp_dir) / "gbk.txt"
        # Write with GBK encoding
        test_content = "中文内容"
        test_file.write_text(test_content, encoding="gbk")

        result = await tool.file_read("gbk.txt")

        assert result["success"] is True
        assert result["content"] == test_content

    async def test_read_with_latin1_fallback(self, tool, temp_dir):
        """Test reading file that requires latin-1 fallback."""
        test_file = Path(temp_dir) / "binary.txt"
        # Write bytes that are not valid UTF-8 but valid latin-1
        test_file.write_bytes(b"\x80\x81\x82\x83")

        result = await tool.file_read("binary.txt")

        assert result["success"] is True
        assert "encoding" in result

    async def test_read_unexpected_exception(self, tool, temp_dir):
        """Test handling of unexpected exception during read."""
        with patch("pathlib.Path.exists", side_effect=OSError("Mocked error")):
            result = await tool.file_read("test.txt")

        assert result["success"] is False
        assert "error" in result
        assert "Mocked error" in result["error"]


class TestFileWrite:
    """Test file_write functionality."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def tool(self, temp_dir):
        """Create FileTool instance with temp_dir as work_dir."""
        return FileTool(work_dir=temp_dir)

    async def test_write_new_file(self, tool, temp_dir):
        """Test writing to a new file."""
        test_content = "New content"

        result = await tool.file_write("new_file.txt", test_content)

        assert result["success"] is True
        assert (Path(temp_dir) / "new_file.txt").read_text() == test_content

    async def test_write_creates_parent_directories(self, tool, temp_dir):
        """Test that parent directories are created automatically."""
        test_content = "Nested content"

        result = await tool.file_write("subdir1/subdir2/file.txt", test_content)

        assert result["success"] is True
        assert (Path(temp_dir) / "subdir1" / "subdir2" / "file.txt").read_text() == test_content

    async def test_write_append_mode(self, tool, temp_dir):
        """Test append mode writing."""
        test_file = Path(temp_dir) / "append.txt"
        test_file.write_text("First line\n")

        result = await tool.file_write("append.txt", "Second line\n", append=True)

        assert result["success"] is True
        content = test_file.read_text()
        assert "First line" in content
        assert "Second line" in content

    async def test_write_overwrite_mode(self, tool, temp_dir):
        """Test overwrite mode (default)."""
        test_file = Path(temp_dir) / "overwrite.txt"
        test_file.write_text("Old content")

        result = await tool.file_write("overwrite.txt", "New content", append=False)

        assert result["success"] is True
        assert test_file.read_text() == "New content"

    async def test_write_directory_traversal_blocked(self, tool):
        """Test that directory traversal is blocked in write."""
        result = await tool.file_write("../outside.txt", "content")

        assert result["success"] is False
        assert "error" in result

    async def test_write_unexpected_exception(self, tool, temp_dir):
        """Test handling of unexpected exception during write."""
        with patch("pathlib.Path.mkdir", side_effect=OSError("Mocked write error")):
            result = await tool.file_write("test.txt", "content")

        assert result["success"] is False
        assert "error" in result
        assert "Mocked write error" in result["error"]


class TestFileList:
    """Test file_list functionality."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory with some files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create some files and directories
            (Path(tmpdir) / "file1.txt").write_text("content1")
            (Path(tmpdir) / "file2.py").write_text("content2")
            (Path(tmpdir) / "subdir").mkdir()
            (Path(tmpdir) / "subdir" / "nested.txt").write_text("nested")
            yield tmpdir

    @pytest.fixture
    def tool(self, temp_dir):
        """Create FileTool instance with temp_dir as work_dir."""
        return FileTool(work_dir=temp_dir)

    async def test_list_directory(self, tool, temp_dir):
        """Test listing directory contents."""
        result = await tool.file_list(".")

        assert result["success"] is True
        assert "items" in result
        assert isinstance(result["items"], list)

        # Should have 3 items: file1.txt, file2.py, subdir
        assert len(result["items"]) == 3

        # Check item structure
        for item in result["items"]:
            assert "name" in item
            assert "type" in item
            assert item["type"] in ["file", "directory"]
            if item["type"] == "file":
                assert "size" in item
            assert "modified" in item

    async def test_list_current_directory_default(self, tool):
        """Test default directory is current directory."""
        result = await tool.file_list()

        assert result["success"] is True
        assert "items" in result

    async def test_list_nonexistent_directory(self, tool):
        """Test listing non-existent directory."""
        result = await tool.file_list("nonexistent")

        assert result["success"] is False
        assert "error" in result

    async def test_list_file_instead_of_directory(self, tool, temp_dir):
        """Test listing a file instead of directory."""
        result = await tool.file_list("file1.txt")

        assert result["success"] is False
        assert "error" in result

    async def test_list_directory_traversal_blocked(self, tool):
        """Test that directory traversal is blocked."""
        result = await tool.file_list("../")

        assert result["success"] is False
        assert "error" in result

    async def test_list_unexpected_exception(self, tool, temp_dir):
        """Test handling of unexpected exception during list."""
        with patch("pathlib.Path.iterdir", side_effect=OSError("Mocked list error")):
            result = await tool.file_list(".")

        assert result["success"] is False
        assert "error" in result
        assert "Mocked list error" in result["error"]


class TestFileToolSecurity:
    """Test security features."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def tool(self, temp_dir):
        """Create FileTool instance with temp_dir as work_dir."""
        return FileTool(work_dir=temp_dir)

    async def test_path_normalization(self, tool, temp_dir):
        """Test that paths are properly normalized."""
        # Create a file
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("content")

        # Try with redundant path components
        result = await tool.file_read("./test.txt")

        assert result["success"] is True
        assert result["content"] == "content"

    async def test_symlink_not_followed(self, tool, temp_dir):
        """Test that symlinks outside work directory are not followed."""
        # Create a file outside temp_dir
        outside_file = Path(temp_dir).parent / f"outside_{os.getpid()}.txt"
        outside_file.write_text("outside content")

        # Create a symlink inside temp_dir pointing outside
        symlink_path = Path(temp_dir) / "link.txt"
        symlink_path.symlink_to(outside_file)

        result = await tool.file_read("link.txt")

        # Should fail as it resolves to outside path
        assert result["success"] is False

        # Cleanup
        outside_file.unlink()


class TestFileToolExecute:
    """Test the execute method."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def tool(self, temp_dir):
        """Create FileTool instance with temp_dir as work_dir."""
        return FileTool(work_dir=temp_dir)

    async def test_execute_read(self, tool, temp_dir):
        """Test execute with read action."""
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("execute test")

        result = await tool.execute(action="read", path="test.txt")

        assert result["success"] is True
        assert result["content"] == "execute test"

    async def test_execute_write(self, tool, temp_dir):
        """Test execute with write action."""
        result = await tool.execute(
            action="write", path="write_test.txt", content="written via execute"
        )

        assert result["success"] is True
        assert (Path(temp_dir) / "write_test.txt").read_text() == "written via execute"

    async def test_execute_list(self, tool, temp_dir):
        """Test execute with list action."""
        (Path(temp_dir) / "item.txt").write_text("item")

        result = await tool.execute(action="list", directory=".")

        assert result["success"] is True
        assert "items" in result
        assert len(result["items"]) == 1

    async def test_execute_invalid_action(self, tool):
        """Test execute with invalid action."""
        result = await tool.execute(action="invalid", path="test.txt")

        assert result["success"] is False
        assert "error" in result
        assert "action" in result["error"].lower() or "invalid" in result["error"].lower()

    async def test_execute_missing_action(self, tool):
        """Test execute without action parameter."""
        result = await tool.execute(path="test.txt")

        assert result["success"] is False
        assert "error" in result

    async def test_execute_read_missing_path(self, tool):
        """Test execute read without path parameter."""
        result = await tool.execute(action="read")

        assert result["success"] is False
        assert "error" in result
        assert "path" in result["error"].lower()

    async def test_execute_write_missing_params(self, tool):
        """Test execute write without required parameters."""
        result = await tool.execute(action="write", path="test.txt")

        assert result["success"] is False
        assert "error" in result
