"""Bash tool implementation with Docker sandbox execution."""

import asyncio
import re
import time
from pathlib import Path
from typing import Any

from docker.errors import DockerException
from loguru import logger

import docker
from tools.base import Tool

# Maximum output size (10KB)
MAX_OUTPUT_SIZE = 10 * 1024

# Dangerous command patterns
DANGEROUS_PATTERNS = [
    r"rm\s+-rf\s+/\s*($|;|&&|\|\|)",
    r"rm\s+-rf\s+/\*",
    r"mkfs\.\w+\s+/dev/\w+",
    r"dd\s+.*of=/dev/\w+",
    r">\s*/dev/\w+",
    r":\(\)\s*\{\s*:\|:&\s*\};:",  # Fork bomb
]

# Default resource limits
DEFAULT_MEMORY_LIMIT = "256m"
DEFAULT_CPU_QUOTA = 100000  # 1 CPU
DEFAULT_CPU_PERIOD = 100000


class BashTool(Tool):
    """Tool for executing bash commands in a Docker sandbox."""

    @property
    def name(self) -> str:
        """Return the tool name."""
        return "bash"

    @property
    def description(self) -> str:
        """Return the tool description."""
        return (
            "Execute bash commands in an isolated Docker sandbox. "
            "Commands are run with restricted resources and network isolation. "
            "Output is limited to 10KB."
        )

    def _is_dangerous(self, command: str) -> bool:
        """Check if a command contains dangerous patterns.

        Args:
            command: The command to check.

        Returns:
            True if the command is dangerous, False otherwise.
        """
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return True
        return False

    def _truncate_output(self, output: str) -> str:
        """Truncate output to MAX_OUTPUT_SIZE.

        Args:
            output: The output string to truncate.

        Returns:
            Truncated output with "..." appended if truncated.
        """
        if len(output) > MAX_OUTPUT_SIZE:
            return output[:MAX_OUTPUT_SIZE] + "..."
        return output

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute a bash command in a Docker sandbox.

        Args:
            command: The bash command to execute.
            timeout: Maximum execution time in seconds (default: 30).
            working_dir: Working directory to mount (default: current directory).

        Returns:
            A dictionary containing:
                - success: Whether the command executed successfully
                - stdout: Standard output (truncated to 10KB)
                - stderr: Standard error (truncated to 10KB)
                - exit_code: Command exit code
                - execution_time: Execution time in seconds
                - error: Error message if execution failed
        """
        command = kwargs.get("command", "")
        timeout = kwargs.get("timeout", 30)
        working_dir = kwargs.get("working_dir")

        start_time = time.time()

        # Check for dangerous commands
        if self._is_dangerous(command):
            logger.warning(f"Blocked dangerous command: {command}")
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "execution_time": 0.0,
                "error": "Command blocked: dangerous operation detected",
            }

        # Resolve working directory
        if working_dir is None:
            working_dir = str(Path.cwd())
        else:
            working_dir = str(Path(working_dir).resolve())

        # Validate working directory exists
        if not Path(working_dir).exists():
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "execution_time": 0.0,
                "error": f"Working directory does not exist: {working_dir}",
            }

        container = None
        try:
            # Create Docker client
            client = docker.from_env()  # type: ignore[attr-defined]

            # Prepare volume mounts (read-only)
            volumes = {
                working_dir: {
                    "bind": "/workspace",
                    "mode": "ro",
                }
            }

            logger.debug(f"Executing command in sandbox: {command}")

            # Run container
            container = await asyncio.to_thread(
                client.containers.run,
                "alpine:latest",
                command=["sh", "-c", command],
                volumes=volumes,
                working_dir="/workspace",
                network="none",
                mem_limit=DEFAULT_MEMORY_LIMIT,
                cpu_quota=DEFAULT_CPU_QUOTA,
                cpu_period=DEFAULT_CPU_PERIOD,
                detach=True,
                stdout=True,
                stderr=True,
            )

            # Wait for container with timeout
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(container.wait),
                    timeout=timeout,
                )
                exit_code = result.get("StatusCode", -1)
            except TimeoutError:
                logger.warning(f"Command timed out after {timeout}s: {command}")
                # Kill the container
                await asyncio.to_thread(container.kill, signal="SIGKILL")
                execution_time = time.time() - start_time
                return {
                    "success": False,
                    "stdout": "",
                    "stderr": "",
                    "exit_code": -1,
                    "execution_time": round(execution_time, 3),
                    "error": f"Command timed out after {timeout} seconds",
                }

            # Get output
            stdout_bytes = await asyncio.to_thread(
                container.logs, stdout=True, stderr=False
            )
            stderr_bytes = await asyncio.to_thread(
                container.logs, stdout=False, stderr=True
            )

            stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""

            # Truncate output
            stdout = self._truncate_output(stdout)
            stderr = self._truncate_output(stderr)

            execution_time = time.time() - start_time

            logger.debug(
                f"Command completed: exit_code={exit_code}, "
                f"time={execution_time:.3f}s"
            )

            return {
                "success": exit_code == 0,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code,
                "execution_time": round(execution_time, 3),
            }

        except DockerException as e:
            logger.error(f"Docker error: {e}")
            execution_time = time.time() - start_time
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "execution_time": round(execution_time, 3),
                "error": f"Docker error: {e!s}",
            }
        except Exception as e:
            logger.error(f"Unexpected error executing command: {e}")
            execution_time = time.time() - start_time
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "execution_time": round(execution_time, 3),
                "error": f"Execution error: {e!s}",
            }
        finally:
            # Clean up container
            if container is not None:
                try:
                    await asyncio.to_thread(container.remove, force=True)
                except Exception as e:
                    logger.warning(f"Failed to remove container: {e}")
