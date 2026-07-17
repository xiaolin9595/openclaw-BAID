"""Unit tests for BashTool."""

from unittest.mock import MagicMock, patch

import pytest

from tools.bash import BashTool


class TestBashTool:
    """Test cases for BashTool."""

    @pytest.fixture
    def bash_tool(self) -> BashTool:
        """Create a BashTool instance for testing."""
        return BashTool()

    def test_name(self, bash_tool: BashTool) -> None:
        """Test that tool has correct name."""
        assert bash_tool.name == "bash"

    def test_description(self, bash_tool: BashTool) -> None:
        """Test that tool has description."""
        assert bash_tool.description
        assert "bash" in bash_tool.description.lower()

    @pytest.mark.asyncio
    async def test_successful_execution(self, bash_tool: BashTool) -> None:
        """Test successful command execution."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.side_effect = [
            b"hello world",  # stdout
            b"",  # stderr
        ]
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            # Mock asyncio.to_thread to call the function directly
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            result = await bash_tool.execute(command="echo hello world")

        assert result["success"] is True
        assert result["stdout"] == "hello world"
        assert result["stderr"] == ""
        assert result["exit_code"] == 0
        assert "execution_time" in result

    @pytest.mark.asyncio
    async def test_execution_with_stderr(self, bash_tool: BashTool) -> None:
        """Test command that outputs to stderr."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 1}
        mock_container.logs.side_effect = [
            b"",  # stdout
            b"error message",  # stderr
        ]
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            result = await bash_tool.execute(command="ls /nonexistent")

        assert result["success"] is False
        assert result["exit_code"] == 1

    @pytest.mark.asyncio
    async def test_execution_timeout(self, bash_tool: BashTool) -> None:
        """Test command timeout handling."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.return_value = b""
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
            patch("asyncio.wait_for") as mock_wait_for,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread

            # Simulate timeout on wait_for
            mock_wait_for.side_effect = TimeoutError()

            result = await bash_tool.execute(command="sleep 100", timeout=1)

        assert result["success"] is False
        assert "timed out" in result["error"].lower()
        mock_container.kill.assert_called_once_with(signal="SIGKILL")

    @pytest.mark.asyncio
    async def test_dangerous_command_blocked(self, bash_tool: BashTool) -> None:
        """Test that dangerous commands are blocked."""
        dangerous_commands = [
            "rm -rf /",
            "rm -rf /*",
            "mkfs.ext4 /dev/sda",
            "dd if=/dev/zero of=/dev/sda",
            "> /dev/sda",
        ]

        for cmd in dangerous_commands:
            result = await bash_tool.execute(command=cmd)
            assert result["success"] is False
            assert "dangerous" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_output_truncation(self, bash_tool: BashTool) -> None:
        """Test that large outputs are truncated to 10KB."""
        large_output = b"x" * (20 * 1024)  # 20KB

        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.side_effect = [large_output, b""]
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            result = await bash_tool.execute(command="cat large_file")

        assert result["success"] is True
        assert len(result["stdout"]) <= 10 * 1024 + 3  # +3 for "..."
        assert result["stdout"].endswith("...")

    @pytest.mark.asyncio
    async def test_custom_working_dir(self, bash_tool: BashTool) -> None:
        """Test execution with custom working directory."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.return_value = b""
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            await bash_tool.execute(command="pwd", working_dir="/tmp")

        call_args = mock_docker.containers.run.call_args
        assert call_args is not None
        volumes = call_args.kwargs.get("volumes", {})
        assert "/tmp" in str(volumes)

    @pytest.mark.asyncio
    async def test_docker_not_available(self, bash_tool: BashTool) -> None:
        """Test handling when Docker is not available."""
        with (
            patch(
                "tools.bash.docker.from_env",
                side_effect=Exception("Docker not found"),
            ),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            result = await bash_tool.execute(command="echo test")

        assert result["success"] is False
        assert "docker" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_container_cleanup_on_error(self, bash_tool: BashTool) -> None:
        """Test that containers are cleaned up even on errors."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.side_effect = [b"output", b""]
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            await bash_tool.execute(command="echo test")

        mock_container.remove.assert_called_once_with(force=True)

    @pytest.mark.asyncio
    async def test_network_isolation(self, bash_tool: BashTool) -> None:
        """Test that network isolation is applied."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.return_value = b""
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            await bash_tool.execute(command="curl google.com")

        call_args = mock_docker.containers.run.call_args
        assert call_args is not None
        assert call_args.kwargs.get("network") == "none"

    @pytest.mark.asyncio
    async def test_resource_limits(self, bash_tool: BashTool) -> None:
        """Test that resource limits are applied."""
        mock_container = MagicMock()
        mock_container.wait.return_value = {"StatusCode": 0}
        mock_container.logs.return_value = b""
        mock_container.remove.return_value = None
        mock_container.kill.return_value = None

        mock_docker = MagicMock()
        mock_docker.containers = MagicMock()
        mock_docker.containers.run.return_value = mock_container

        with (
            patch("tools.bash.docker.from_env", return_value=mock_docker),
            patch("asyncio.to_thread") as mock_to_thread,
        ):
            async def mock_async_to_thread(func, *args, **kwargs):
                return func(*args, **kwargs)

            mock_to_thread.side_effect = mock_async_to_thread
            await bash_tool.execute(command="echo test")

        call_args = mock_docker.containers.run.call_args
        assert call_args is not None
        assert "mem_limit" in call_args.kwargs
        assert "cpu_quota" in call_args.kwargs
