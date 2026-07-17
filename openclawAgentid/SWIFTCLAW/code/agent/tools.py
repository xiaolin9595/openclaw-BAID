"""PydanticAI-compatible tools for SwiftClaw agent.

This module provides tool functions that can be registered with PydanticAI Agent.
"""

from __future__ import annotations

import asyncio
import os
import html
import re
import time
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from loguru import logger
from playwright.async_api import async_playwright
from pydantic_ai import Agent, RunContext

from agent.llm import AgentDependencies
from config.settings import Settings, resolve_configured_path


# Maximum output size for bash commands (10KB)
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

# Default resource limits for Docker
DEFAULT_MEMORY_LIMIT = "256m"
DEFAULT_CPU_QUOTA = 100000
DEFAULT_CPU_PERIOD = 100000


def register_all_tools(agent: Agent[AgentDependencies, str]) -> None:
    """Register all tools with the agent.

    Args:
        agent: The PydanticAI Agent instance.
    """
    # File tools
    agent.tool(file_read)
    agent.tool(file_write)
    agent.tool(file_list)

    # Bash tool
    agent.tool(bash_execute)

    # Local browser opening tool - 默认优先
    agent.tool(local_browser_open)

    # Local command execution tool - 在本地电脑上执行命令
    agent.tool(local_execute)

    # VSCode 打开并编译运行 Python（组合操作）
    agent.tool(vscode_open_and_run)

    # Browser tools - 仅用于自动化任务
    agent.tool(browser_open)
    agent.tool(browser_screenshot)
    agent.tool(browser_click)
    agent.tool(browser_extract_text)

    # Search tool
    agent.tool(web_search)

    # Memory tools
    agent.tool(save_memory)
    agent.tool(recall_memory)
    agent.tool(list_memories)
    agent.tool(search_history)

    logger.debug("All tools registered with agent")


# ============================================================================
# File Tools
# ============================================================================


def _resolve_work_dir(settings: Settings) -> Path:
    """Resolve the file tool work directory."""
    if settings.file_work_dir:
        return resolve_configured_path(settings.file_work_dir)
    return Path.cwd()

async def file_read(
    ctx: RunContext[AgentDependencies],
    path: str,
    max_size_bytes: int = 1024 * 1024,
) -> str:
    """Read a text file.

    Args:
        ctx: Run context with dependencies.
        path: Path to the file to read.
        max_size_bytes: Maximum file size in bytes (default 1MB).

    Returns:
        File content as string, or error message.
    """
    logger.debug(f"Reading file: {path}")

    work_dir = _resolve_work_dir(ctx.deps.settings)

    try:
        resolved_path = _resolve_path(path, work_dir)

        if not resolved_path.exists():
            return f"Error: File not found: {path}"

        if not resolved_path.is_file():
            return f"Error: Not a file: {path}"

        file_size = resolved_path.stat().st_size
        if file_size > max_size_bytes:
            return f"Error: File size ({file_size} bytes) exceeds limit ({max_size_bytes} bytes)"

        content, encoding = _read_with_encoding(resolved_path)
        logger.info(f"Successfully read file: {resolved_path} (encoding: {encoding})")
        return content

    except ValueError as e:
        logger.warning(f"Path validation failed: {e}")
        return f"Error: {e}"
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        return f"Error reading file: {e}"


async def file_write(
    ctx: RunContext[AgentDependencies],
    path: str,
    content: str,
    append: bool = False,
) -> str:
    """Write content to a file.

    Args:
        ctx: Run context with dependencies.
        path: Path to the file to write.
        content: Content to write.
        append: If True, append to file. If False, overwrite.

    Returns:
        Success message or error message.
    """
    logger.debug(f"Writing file: {path} (append={append})")

    # Check if this is a Windows path (e.g., D:/, C:/, etc.)
    if re.match(r"^[A-Za-z]:[/\\]", path):
        # Windows path detected - forward to local proxy
        proxy_url = _local_browser_proxy_url(ctx.deps.settings)
        if proxy_url:
            return await _write_file_via_proxy(path, content, proxy_url)
        else:
            return "Error: Windows path detected but LOCAL_BROWSER_PROXY not configured. Please run local_browser.py on your computer."

    work_dir = _resolve_work_dir(ctx.deps.settings)

    try:
        resolved_path = _resolve_path(path, work_dir)
        resolved_path.parent.mkdir(parents=True, exist_ok=True)

        mode = "a" if append else "w"
        with open(resolved_path, mode, encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Successfully wrote file: {resolved_path}")
        return f"Successfully wrote to {path}"

    except ValueError as e:
        logger.warning(f"Path validation failed: {e}")
        return f"Error: {e}"
    except Exception as e:
        logger.error(f"Error writing file: {e}")
        return f"Error writing file: {e}"


async def file_list(
    ctx: RunContext[AgentDependencies],
    directory: str = ".",
) -> str:
    """List directory contents.

    Args:
        ctx: Run context with dependencies.
        directory: Directory path to list. Defaults to current directory.

    Returns:
        Formatted list of directory contents.
    """
    logger.debug(f"Listing directory: {directory}")

    work_dir = _resolve_work_dir(ctx.deps.settings)

    try:
        resolved_dir = _resolve_path(directory, work_dir)

        if not resolved_dir.exists():
            return f"Error: Directory not found: {directory}"

        if not resolved_dir.is_dir():
            return f"Error: Not a directory: {directory}"

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

        # Sort: directories first, then by name
        items.sort(key=lambda x: (x["type"] != "directory", x["name"].lower()))

        # Format output
        lines = [f"Contents of {directory}:", "-" * 40]
        for item in items:
            if item["type"] == "directory":
                lines.append(f"[DIR]  {item['name']}")
            else:
                size = item.get("size", 0)
                lines.append(f"[FILE] {item['name']} ({size} bytes)")

        logger.info(f"Successfully listed directory: {resolved_dir}")
        return "\n".join(lines)

    except ValueError as e:
        logger.warning(f"Path validation failed: {e}")
        return f"Error: {e}"
    except Exception as e:
        logger.error(f"Error listing directory: {e}")
        return f"Error listing directory: {e}"


def _resolve_path(path: str | Path, work_dir: Path) -> Path:
    """Resolve and validate a path.

    Args:
        path: The path to resolve.
        work_dir: Working directory base.

    Returns:
        Resolved Path object.

    Raises:
        ValueError: If path escapes work directory.
    """
    target = Path(path)

    if target.is_absolute():
        resolved = target.resolve()
    else:
        resolved = (work_dir / target).resolve()

    try:
        resolved.relative_to(work_dir)
    except ValueError as e:
        raise ValueError(f"Path '{path}' escapes work directory '{work_dir}'") from e

    return resolved


def _read_with_encoding(path: Path) -> tuple[str, str]:
    """Read file with encoding detection.

    Args:
        path: Path to the file.

    Returns:
        Tuple of (content, encoding).
    """
    try:
        content = path.read_text(encoding="utf-8")
        return content, "utf-8"
    except UnicodeDecodeError:
        pass

    encodings = ["utf-8-sig", "gbk", "gb2312", "gb18030", "big5", "latin-1"]
    for encoding in encodings:
        try:
            content = path.read_text(encoding=encoding)
            return content, encoding
        except UnicodeDecodeError:
            continue

    content = path.read_bytes().decode("utf-8", errors="replace")
    return content, "utf-8-replace"


# ============================================================================
# Bash Tool
# ============================================================================

async def bash_execute(
    ctx: RunContext[AgentDependencies],
    command: str,
    timeout: int = 30,
    working_dir: str | None = None,
) -> str:
    """Execute a bash command in a Docker sandbox.

    Args:
        ctx: Run context with dependencies.
        command: The bash command to execute.
        timeout: Maximum execution time in seconds (default: 30).
        working_dir: Working directory to mount (default: current directory).

    Returns:
        Command output or error message.
    """
    import docker
    from docker.errors import DockerException

    start_time = time.time()

    # Check for dangerous commands
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            logger.warning(f"Blocked dangerous command: {command}")
            return "Error: Command blocked - dangerous operation detected"

    if working_dir is None:
        working_dir = str(Path.cwd())
    else:
        working_dir = str(Path(working_dir).resolve())

    if not Path(working_dir).exists():
        return f"Error: Working directory does not exist: {working_dir}"

    container = None
    try:
        client = docker.from_env()

        volumes = {
            working_dir: {
                "bind": "/workspace",
                "mode": "ro",
            }
        }

        logger.debug(f"Executing command in sandbox: {command}")

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

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(container.wait),
                timeout=timeout,
            )
            exit_code = result.get("StatusCode", -1)
        except TimeoutError:
            logger.warning(f"Command timed out after {timeout}s: {command}")
            await asyncio.to_thread(container.kill, signal="SIGKILL")
            return f"Error: Command timed out after {timeout} seconds"

        stdout_bytes = await asyncio.to_thread(
            container.logs, stdout=True, stderr=False
        )
        stderr_bytes = await asyncio.to_thread(
            container.logs, stdout=False, stderr=True
        )

        stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""

        # Truncate output
        if len(stdout) > MAX_OUTPUT_SIZE:
            stdout = stdout[:MAX_OUTPUT_SIZE] + "..."
        if len(stderr) > MAX_OUTPUT_SIZE:
            stderr = stderr[:MAX_OUTPUT_SIZE] + "..."

        execution_time = time.time() - start_time

        logger.debug(f"Command completed: exit_code={exit_code}, time={execution_time:.3f}s")

        output_parts = []
        if stdout:
            output_parts.append(f"STDOUT:\n{stdout}")
        if stderr:
            output_parts.append(f"STDERR:\n{stderr}")

        output = "\n\n".join(output_parts) if output_parts else "(no output)"
        return f"Exit code: {exit_code}\n{output}"

    except DockerException as e:
        logger.error(f"Docker error: {e}")
        return f"Error: Docker error: {e}"
    except Exception as e:
        logger.error(f"Unexpected error executing command: {e}")
        return f"Error: Execution error: {e}"
    finally:
        if container is not None:
            try:
                await asyncio.to_thread(container.remove, force=True)
            except Exception as e:
                logger.warning(f"Failed to remove container: {e}")


# ============================================================================
# Browser Tools
# ============================================================================

_browser_instance: Any = None
_playwright_instance: Any = None
_page_instance: Any = None

_URL_PATTERN = re.compile(
    r"^https?://"  # http:// or https://
    r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
    r"localhost|"  # localhost
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # or ip
    r"(?::\d+)?"  # optional port
    r"(?:/?|[/?]\S+)$",
    re.IGNORECASE,
)


def _normalize_url(url: str) -> str:
    """Normalize and validate a web URL."""
    cleaned = url.strip().strip('"').strip("'")
    if not cleaned:
        raise ValueError("URL cannot be empty")

    if not cleaned.startswith(("http://", "https://")):
        cleaned = "https://" + cleaned

    if not _URL_PATTERN.match(cleaned):
        raise ValueError(f"Invalid URL format: {url}")

    return cleaned


def _local_browser_proxy_url(settings: Settings) -> str | None:
    """Return a normalized local browser proxy URL, if configured."""
    proxy_url = settings.local_browser_proxy
    if not proxy_url:
        return None
    return proxy_url.rstrip("/")


async def _open_local_browser_proxy(url: str, proxy_url: str) -> str:
    """Open a URL via the user's local browser proxy."""
    endpoint = f"{proxy_url}/open"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(endpoint, params={"url": url})
            response.raise_for_status()
            data = response.json()

        if data.get("success"):
            return data.get("message", f"已在本地浏览器打开: {url}")

        error = data.get("error") or "本地浏览器代理返回失败"
        return f"Error: {error}"

    except httpx.TimeoutException:
        return (
            "Error: 无法连接到本地浏览器代理，连接超时。"
            "请确认 local_browser.py 正在你的电脑上运行，并且代理地址可访问。"
        )
    except httpx.HTTPError as e:
        return f"Error: 无法连接到本地浏览器代理: {e}"


async def _write_file_via_proxy(path: str, content: str, proxy_url: str) -> str:
    """Write a file via the user's local browser proxy."""
    endpoint = f"{proxy_url}/file_write"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                endpoint,
                json={"path": path, "content": content}
            )
            response.raise_for_status()
            data = response.json()

        if data.get("success"):
            return data.get("message", f"文件已保存到本地: {path}")

        error = data.get("error") or "本地代理返回失败"
        return f"Error: {error}"

    except httpx.TimeoutException:
        return (
            "Error: 无法连接到本地浏览器代理，连接超时。"
            "请确认 local_browser.py 正在你的电脑上运行，并且代理地址可访问。"
        )
    except httpx.HTTPError as e:
        return f"Error: 无法连接到本地浏览器代理: {e}"


def _browser_launch_kwargs(settings: Settings) -> dict[str, Any]:
    """Build Playwright launch kwargs from app settings."""
    launch_kwargs: dict[str, Any] = {"headless": settings.browser_headless}

    if settings.browser_executable_path:
        launch_kwargs["executable_path"] = settings.browser_executable_path
    elif settings.browser_channel.strip():
        launch_kwargs["channel"] = settings.browser_channel.strip()

    return launch_kwargs


def _has_graphical_display() -> bool:
    """Return True when the current process can open a visible window."""
    return bool(os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY"))


def _resolve_browser_executable_path(settings: Settings) -> str | None:
    """Resolve a browser executable path from settings or common local installs."""
    if settings.browser_executable_path:
        return settings.browser_executable_path

    for candidate in ("msedge", "microsoft-edge", "google-chrome", "chromium", "chromium-browser"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    return None


async def _launch_browser(playwright: Any, settings: Settings) -> Any:
    """Launch a browser, preferring the configured channel or executable."""
    launch_kwargs = _browser_launch_kwargs(settings)
    has_display = _has_graphical_display()
    effective_headless = settings.browser_headless or not has_display

    if not has_display and not settings.browser_headless:
        logger.warning(
            "No graphical display detected; falling back to headless browser mode. "
            "Start SwiftClaw from scripts/start_visible_desktop.sh in a desktop "
            "terminal if you want a visible browser window."
        )

    launch_kwargs["headless"] = effective_headless

    try:
        logger.debug(f"Launching browser with options: {launch_kwargs}")
        return await playwright.chromium.launch(**launch_kwargs)
    except Exception as primary_error:
        fallback_executable = _resolve_browser_executable_path(settings)
        if fallback_executable:
            fallback_kwargs: dict[str, Any] = {
                "headless": effective_headless,
                "executable_path": fallback_executable,
            }
            logger.warning(
                "Failed to launch configured browser, falling back to executable path: "
                f"{fallback_executable}. Original error: {primary_error}"
            )
            return await playwright.chromium.launch(**fallback_kwargs)

        logger.warning(
            "Failed to launch configured browser, falling back to Chromium: "
            f"{primary_error}"
        )
        return await playwright.chromium.launch(headless=effective_headless)


async def local_browser_open(
    ctx: RunContext[AgentDependencies],
    url: str,
) -> str:
    """Open a URL in the user's local browser (on their own computer).

    This is the DEFAULT and PREFERRED way to open URLs for the user to view.
    Always use this tool when the user asks to open a website, unless they
    specifically request a screenshot or background browsing.

    Requires local_browser_proxy to be configured and the local proxy running.
    """
    settings = ctx.deps.settings
    proxy_url = _local_browser_proxy_url(settings)

    if not proxy_url:
        return (
            "Error: 未配置本地浏览器代理。请先在你的电脑上运行 local_browser.py，"
            "并把公开代理地址写入 LOCAL_BROWSER_PROXY。"
        )

    try:
        normalized_url = _normalize_url(url)
    except ValueError as e:
        return f"Error: {e}"

    result = await _open_local_browser_proxy(normalized_url, proxy_url)
    if result.startswith("Error:"):
        return result

    logger.info(f"Opened URL via local browser proxy: {normalized_url}")
    return result


async def _ensure_browser(settings: Settings) -> Any:
    """Lazy initialization of browser."""
    global _browser_instance, _playwright_instance, _page_instance

    if _browser_instance is None:
        logger.debug("Initializing browser...")
        _playwright_instance = await async_playwright().start()
        _browser_instance = await _launch_browser(_playwright_instance, settings)
        _page_instance = await _browser_instance.new_page()
        _page_instance.set_default_timeout(30000)
        logger.info("Browser initialized successfully")

    return _page_instance


async def browser_open(
    ctx: RunContext[AgentDependencies],
    url: str,
) -> str:
    """Open a URL in a background browser on the server for automation tasks.

    ONLY use this tool when:
    - The user specifically asks for a screenshot
    - The user asks to extract/extract text from a webpage
    - The user asks for automation/interaction with a page
    - The user explicitly says "在服务器上打开" or "后台打开"

    For normal browsing (用户想看的网页), ALWAYS use local_browser_open instead.

    Args:
        ctx: Run context with dependencies.
        url: URL to open.

    Returns:
        Page title and info, or error message.
    """
    logger.info(f"Opening URL: {url}")

    try:
        url = _normalize_url(url)
    except ValueError as e:
        return f"Error: {e}"

    try:
        page = await _ensure_browser(ctx.deps.settings)

        start_time = time.time()
        await page.goto(url, wait_until="domcontentloaded")
        load_time = time.time() - start_time

        title = await page.title()
        final_url = page.url

        logger.info(f"Page loaded in {load_time:.2f}s: {title}")
        return f"Loaded: {title}\nURL: {final_url}\nLoad time: {load_time:.2f}s"

    except TimeoutError:
        return "Error: Navigation timeout"
    except Exception as e:
        logger.error(f"Failed to open URL: {e}")
        return f"Error: Failed to open URL: {e}"


async def browser_screenshot(
    ctx: RunContext[AgentDependencies],
    path: str,
) -> str:
    """Take a screenshot of the current page.

    Args:
        ctx: Run context with dependencies.
        path: File path to save screenshot.

    Returns:
        Success message or error message.
    """
    logger.info(f"Taking screenshot: {path}")

    MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024

    try:
        page = await _ensure_browser(ctx.deps.settings)

        await page.screenshot(path=path, full_page=True)

        file_path = Path(path)
        size = file_path.stat().st_size

        if size > MAX_SCREENSHOT_SIZE:
            file_path.unlink()
            return f"Error: Screenshot size ({size} bytes) exceeds limit (5MB)"

        logger.info(f"Screenshot saved: {path} ({size} bytes)")
        return f"Screenshot saved to {path} ({size} bytes)"

    except Exception as e:
        logger.error(f"Failed to take screenshot: {e}")
        return f"Error: Failed to take screenshot: {e}"


async def browser_click(
    ctx: RunContext[AgentDependencies],
    selector: str,
) -> str:
    """Click an element on the page.

    Args:
        ctx: Run context with dependencies.
        selector: CSS selector for the element to click.

    Returns:
        Success message or error message.
    """
    logger.info(f"Clicking element: {selector}")

    if not selector:
        return "Error: Selector cannot be empty"

    try:
        page = await _ensure_browser(ctx.deps.settings)
        await page.click(selector)
        logger.info(f"Element clicked: {selector}")
        return f"Successfully clicked: {selector}"

    except Exception as e:
        logger.error(f"Failed to click element: {e}")
        return f"Error: Failed to click element: {e}"


async def browser_extract_text(
    ctx: RunContext[AgentDependencies],
) -> str:
    """Extract text content from the current page.

    Args:
        ctx: Run context with dependencies.

    Returns:
        Page text content.
    """
    logger.info("Extracting page text")

    try:
        page = await _ensure_browser(ctx.deps.settings)
        content = await page.content()

        # Simple HTML to text conversion
        text = _html_to_text(content)
        length = len(text)

        logger.info(f"Text extracted: {length} characters")

        # Truncate if too long
        if length > 10000:
            text = text[:10000] + "...\n[Content truncated]"

        return text

    except Exception as e:
        logger.error(f"Failed to extract text: {e}")
        return f"Error: Failed to extract text: {e}"


def _html_to_text(html_content: str) -> str:
    """Convert HTML to plain text."""
    text = re.sub(
        r"<script[^>]*>[^<]*</script>", "", html_content, flags=re.DOTALL | re.IGNORECASE
    )
    text = re.sub(r"<style[^>]*>[^<]*</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li|tr)>\s*", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<(br|hr)\s*/?>\s*", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ============================================================================
# Search Tool
# ============================================================================

async def web_search(
    ctx: RunContext[AgentDependencies],
    query: str,
    count: int = 5,
) -> str:
    """Search the web using Tavily API.

    Args:
        ctx: Run context with dependencies.
        query: Search query string.
        count: Number of results (1-10, default 5).

    Returns:
        Formatted search results or error message.
    """
    settings = ctx.deps.settings
    api_key = settings.tavily_api_key

    if not api_key:
        return "Error: TAVILY_API_KEY not configured"

    if not query or not query.strip():
        return "Error: Query cannot be empty"

    count = max(1, min(count, 10))

    headers = {"Content-Type": "application/json"}
    payload = {
        "api_key": api_key,
        "query": query.strip(),
        "max_results": count,
        "search_depth": "basic",
        "include_answer": False,
    }

    try:
        logger.info(f"Searching for: {query}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                headers=headers,
                json=payload,
            )

            if response.status_code == 401:
                return "Error: Invalid API key"
            elif response.status_code == 429:
                return "Error: Rate limit exceeded (1000 queries/month)"

            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                })

            logger.info(f"Found {len(results)} results")

            if not results:
                return "No results found."

            lines = [f"Search results for '{query}':", "-" * 40]
            for i, result in enumerate(results, 1):
                lines.append(f"{i}. {result['title']}")
                lines.append(f"   URL: {result['url']}")
                lines.append(f"   {result['content'][:200]}...")
                lines.append("")

            return "\n".join(lines)

    except httpx.TimeoutException:
        logger.error("Search request timed out")
        return "Error: Request timeout"
    except httpx.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        return f"Error: HTTP error: {e}"
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return f"Error: {e}"


# ============================================================================
# Local Execute Tool (for VSCode, Python execution on local computer)
# ============================================================================


async def _execute_via_proxy(command: str, proxy_url: str, working_dir: str | None = None, timeout: int = 30) -> str:
    """Execute command via local browser proxy."""
    endpoint = f"{proxy_url}/execute"

    payload = {
        "command": command,
        "timeout": timeout
    }
    if working_dir:
        payload["working_dir"] = working_dir

    try:
        async with httpx.AsyncClient(timeout=timeout + 5.0) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()

        if data.get("success"):
            output = []
            if data.get("stdout"):
                output.append(f"STDOUT:\n{data['stdout']}")
            if data.get("stderr"):
                output.append(f"STDERR:\n{data['stderr']}")
            return f"命令执行成功 (退出码: {data.get('exit_code', 0)})\n\n" + "\n\n".join(output) if output else "命令执行成功 (无输出)"
        else:
            error = data.get("error", "未知错误")
            return f"Error: 命令执行失败: {error}"

    except httpx.TimeoutException:
        return (
            "Error: 无法连接到本地代理，连接超时。"
            "请确认 local_browser.py 正在你的电脑上运行。"
        )
    except httpx.HTTPError as e:
        return f"Error: 无法连接到本地代理: {e}"


async def local_execute(
    ctx: RunContext[AgentDependencies],
    command: str,
    working_dir: str | None = None,
    timeout: int = 30,
) -> str:
    """Execute command on user's local computer.

    This tool executes commands on the user's own computer (Windows/Mac),
    NOT on the server. Useful for opening files in VSCode, running Python scripts, etc.

    Examples:
    - Open file in VSCode: "code D:\\project\\hello.py" or "code /Users/name/project/hello.py"
    - Run Python script: "python D:\\project\\hello.py" or "python3 /Users/name/project/hello.py"
    - Open in Notepad: "notepad D:\\project\\hello.py"
    - List directory: "dir D:\\project" (Windows) or "ls -la /Users/name/project" (Mac/Linux)

    Args:
        ctx: Run context with dependencies.
        command: Command to execute on local computer.
        working_dir: Working directory for command execution (optional).
        timeout: Maximum execution time in seconds (default: 30).

    Returns:
        Command output or error message.
    """
    settings = ctx.deps.settings
    proxy_url = _local_browser_proxy_url(settings)

    if not proxy_url:
        return (
            "Error: 未配置本地浏览器代理。请先在你的电脑上运行 local_browser.py，"
            "并把公开代理地址写入 LOCAL_BROWSER_PROXY。"
        )

    logger.info(f"Executing local command: {command}")

    result = await _execute_via_proxy(command, proxy_url, working_dir, timeout)

    if not result.startswith("Error:"):
        logger.info(f"Local command executed successfully: {command}")
    else:
        logger.warning(f"Local command failed: {command} - {result}")

    return result


async def _vscode_open_and_run_via_proxy(file_path: str, proxy_url: str, timeout: int = 30) -> str:
    """Call the local proxy to open VSCode and run Python."""
    endpoint = f"{proxy_url}/vscode_open_and_run"

    payload = {
        "path": file_path,
        "timeout": timeout
    }

    try:
        async with httpx.AsyncClient(timeout=timeout + 10.0) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()

        if data.get("success"):
            return data.get("message", "VSCode 已打开并运行成功")
        else:
            error = data.get("error", "未知错误")
            return f"Error: 操作失败: {error}"

    except httpx.TimeoutException:
        return (
            "Error: 无法连接到本地代理，连接超时。"
            "请确认 local_browser.py 正在你的电脑上运行。"
        )
    except httpx.HTTPError as e:
        return f"Error: 无法连接到本地代理: {e}"


async def vscode_open_and_run(
    ctx: RunContext[AgentDependencies],
    file_path: str,
    timeout: int = 30,
) -> str:
    """Open Python file in VSCode and run it (combined operation).

    This tool performs two actions on the user's local computer:
    1. Opens the file in VSCode for editing/viewing
    2. Runs the Python file and returns the output

    Use this when the user wants to both view the code in VSCode AND see the execution result.

    Args:
        ctx: Run context with dependencies.
        file_path: Path to the Python file (e.g., "D:\\project\\hello.py").
        timeout: Maximum execution time in seconds (default: 30).

    Returns:
        Combined result of VSCode opening and Python execution.

    Examples:
        - "打开 D:\\1.py 并运行"
        - "用 VSCode 打开 test.py 然后执行"
        - "编辑并运行 hello.py"
    """
    settings = ctx.deps.settings
    proxy_url = _local_browser_proxy_url(settings)

    if not proxy_url:
        return (
            "Error: 未配置本地浏览器代理。请先在你的电脑上运行 local_browser.py，"
            "并把公开代理地址写入 LOCAL_BROWSER_PROXY。"
        )

    logger.info(f"Opening VSCode and running: {file_path}")

    result = await _vscode_open_and_run_via_proxy(file_path, proxy_url, timeout)

    if not result.startswith("Error:"):
        logger.info(f"VSCode open and run successful: {file_path}")
    else:
        logger.warning(f"VSCode open and run failed: {file_path} - {result}")

    return result


# ============================================================================
# Memory Tools
# ============================================================================

async def save_memory(
    ctx: RunContext[AgentDependencies],
    key: str,
    value: str,
) -> str:
    """Save a piece of information to the persistent memory store.

    Use this tool when the user tells you something important that should be
    remembered for future conversations. Examples:
    - User preferences ("我喜欢用中文交流", "我的GitHub用户名是xxx")
    - Important facts about the user ("我在xxx公司工作", "我是Python开发者")
    - Personal information the user wants you to remember

    Args:
        ctx: Run context with dependencies.
        key: A short, descriptive key for this memory (e.g., "user_name", "preference_language").
        value: The actual information to remember.

    Returns:
        Success or error message.
    """
    memory_store = ctx.deps.memory_store
    telegram_id = ctx.deps.telegram_id

    if not memory_store:
        return "Error: Memory store not available"

    if not telegram_id:
        return "Error: Telegram ID not set"

    if not key or not key.strip():
        return "Error: Memory key cannot be empty"

    if not value or not value.strip():
        return "Error: Memory value cannot be empty"

    try:
        # Note: telegram_id here is the Telegram user ID passed through deps
        await memory_store.add_memory_to_md(telegram_id, key.strip(), value.strip())
        logger.info(f"Memory saved: key='{key}', telegram_id={telegram_id}")
        return f"Memory saved successfully: '{key}'"
    except Exception as e:
        logger.error(f"Failed to save memory: {e}")
        return f"Error: Failed to save memory: {e}"


async def recall_memory(
    ctx: RunContext[AgentDependencies],
    key: str,
) -> str:
    """Retrieve a specific memory by its exact key.

    Args:
        ctx: Run context with dependencies.
        key: The exact key of the memory to retrieve.

    Returns:
        The memory value, or error message if not found.
    """
    memory_store = ctx.deps.memory_store
    telegram_id = ctx.deps.telegram_id

    if not memory_store:
        return "Error: Memory store not available"

    if not telegram_id:
        return "Error: Telegram ID not set"

    if not key or not key.strip():
        return "Error: Memory key cannot be empty"

    try:
        value = await memory_store.recall_memory_section(telegram_id, key.strip())
        if value is not None:
            logger.info(f"Memory recalled: key='{key}', telegram_id={telegram_id}")
            return f"Memory '{key}': {value}"
        return f"No memory found with key: '{key}'"
    except Exception as e:
        logger.error(f"Failed to recall memory: {e}")
        return f"Error: Failed to recall memory: {e}"


async def list_memories(
    ctx: RunContext[AgentDependencies],
) -> str:
    """List all memories for the current user.

    Returns:
        Formatted list of memories or error message.
    """
    memory_store = ctx.deps.memory_store
    telegram_id = ctx.deps.telegram_id

    if not memory_store:
        return "Error: Memory store not available"

    if not telegram_id:
        return "Error: Telegram ID not set"

    try:
        sections = await memory_store.get_memory_sections(telegram_id)

        if not sections:
            return "No memories found. You can save memories using the save_memory tool."

        lines = ["Stored Memories:", "-" * 40]

        for section in sections:
            lines.append(f"\nKey: {section['key']}")
            lines.append(f"Value: {section['value']}")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to list memories: {e}")
        return f"Error: Failed to list memories: {e}"


async def search_history(
    ctx: RunContext[AgentDependencies],
    query: str,
    limit: int = 5,
) -> str:
    """Search historical conversation logs for relevant content.

    Use this tool when the user mentions past discussions, says 'last time',
    'yesterday', 'before', or asks to recall something from earlier.

    Args:
        ctx: Run context with dependencies.
        query: Search query string.
        limit: Maximum number of results (default 5).

    Returns:
        Formatted search results or error message.
    """
    memory_store = ctx.deps.memory_store
    user_id = ctx.deps.user_id

    if not memory_store:
        return "Error: Memory store not available"

    if not user_id:
        return "Error: User ID not set"

    if not query or not query.strip():
        return "Error: Query cannot be empty"

    try:
        results = await memory_store.search_history(user_id, query.strip(), limit)

        if not results:
            return f"No historical logs found for query: '{query}'"

        lines = [f"Historical search results for '{query}':", "-" * 40]
        for i, result in enumerate(results, 1):
            content_preview = result['content'][:250].replace('\n', ' ')
            lines.append(f"{i}. [{result['source_file']}]")
            lines.append(f"   {content_preview}...")
            lines.append("")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to search history: {e}")
        return f"Error: Failed to search history: {e}"
