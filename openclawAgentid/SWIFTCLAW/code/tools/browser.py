"""Browser automation tool using Playwright.

This module provides a BrowserTool class for automating browser interactions
including opening URLs, taking screenshots, clicking elements, and extracting text.
"""

import html
import os
import re
import shutil
import time
from contextlib import AbstractAsyncContextManager
from pathlib import Path
from typing import Any

from loguru import logger
from playwright.async_api import Page, async_playwright

from tools.base import Tool


class BrowserTool(Tool, AbstractAsyncContextManager["BrowserTool"]):
    """Browser automation tool using Playwright.

    This tool provides methods to:
    - Open URLs and navigate pages
    - Take screenshots
    - Click elements
    - Extract text content

    The browser is lazily initialized on first use and supports async context manager
    for automatic cleanup.

    Example:
        async with BrowserTool() as browser:
            await browser.open("https://example.com")
            result = await browser.screenshot("/tmp/page.png")
    """

    # Constants
    DEFAULT_TIMEOUT = 30000  # 30 seconds
    MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024  # 5MB
    URL_PATTERN = re.compile(
        r"^https?://"  # http:// or https://
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
        r"localhost|"  # localhost
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # or ip
        r"(?::\d+)?"  # optional port
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )

    def __init__(self) -> None:
        """Initialize BrowserTool with no active browser instance."""
        self._playwright: Any = None
        self._browser: Any = None
        self._page: Page | None = None
        self._headless = self._env_bool("BROWSER_HEADLESS", False)
        self._browser_channel = os.getenv("BROWSER_CHANNEL", "msedge").strip()
        self._browser_executable_path = os.getenv("BROWSER_EXECUTABLE_PATH") or None

    @property
    def name(self) -> str:
        """Return the tool name."""
        return "browser"

    @property
    def description(self) -> str:
        """Return the tool description."""
        return "浏览器自动化工具，支持打开网页、截图、点击元素和提取文本"

    async def _ensure_browser(self) -> None:
        """Lazy initialization of browser.

        Creates a new browser instance if one doesn't exist.
        Uses single page mode for efficiency.
        """
        if self._browser is None:
            logger.debug("Initializing browser...")
            self._playwright = await async_playwright().start()
            self._browser = await self._launch_browser(self._playwright)
            self._page = await self._browser.new_page()
            self._page.set_default_timeout(self.DEFAULT_TIMEOUT)
            logger.info("Browser initialized successfully")

    @staticmethod
    def _env_bool(name: str, default: bool) -> bool:
        """Parse a boolean environment variable."""
        raw_value = os.getenv(name)
        if raw_value is None:
            return default

        return raw_value.strip().lower() in {"1", "true", "yes", "on"}

    def _launch_kwargs(self) -> dict[str, Any]:
        """Build Playwright launch kwargs from environment or defaults."""
        launch_kwargs: dict[str, Any] = {"headless": self._headless}

        if self._browser_executable_path:
            launch_kwargs["executable_path"] = self._browser_executable_path
        elif self._browser_channel:
            launch_kwargs["channel"] = self._browser_channel

        return launch_kwargs

    @staticmethod
    def _has_graphical_display() -> bool:
        """Return True when the current process can open a visible window."""
        return bool(os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY"))

    def _resolve_browser_executable_path(self) -> str | None:
        """Resolve a browser executable path from env or common local installs."""
        if self._browser_executable_path:
            return self._browser_executable_path

        for candidate in ("msedge", "microsoft-edge", "google-chrome", "chromium", "chromium-browser"):
            resolved = shutil.which(candidate)
            if resolved:
                return resolved

        return None

    async def _launch_browser(self, playwright: Any) -> Any:
        """Launch a browser, preferring Microsoft Edge when available."""
        launch_kwargs = self._launch_kwargs()
        has_display = self._has_graphical_display()
        effective_headless = self._headless or not has_display

        if not has_display and not self._headless:
            logger.warning(
                "No graphical display detected; falling back to headless browser mode. "
                "Start SwiftClaw from scripts/start_visible_desktop.sh in a desktop "
                "terminal if you want a visible browser window."
            )

        launch_kwargs["headless"] = effective_headless

        try:
            logger.debug(f"Launching browser with options: {launch_kwargs}")
            return await playwright.chromium.launch(**launch_kwargs)
        except Exception as launch_error:
            fallback_executable = self._resolve_browser_executable_path()
            if fallback_executable:
                logger.warning(
                    "Failed to launch configured browser, falling back to executable path: "
                    f"{fallback_executable}. Original error: {launch_error}"
                )
                return await playwright.chromium.launch(
                    headless=effective_headless,
                    executable_path=fallback_executable,
                )

            logger.warning(
                f"Failed to launch configured browser, falling back to Chromium: {launch_error}"
            )
            return await playwright.chromium.launch(headless=effective_headless)

    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is valid.

        Args:
            url: URL string to validate.

        Returns:
            True if URL is valid, False otherwise.
        """
        return bool(self.URL_PATTERN.match(url))

    async def open(self, url: str) -> dict[str, Any]:
        """Open specified URL.

        Args:
            url: URL to open.

        Returns:
            Dictionary with:
                - success: True if successful, False otherwise
                - title: Page title (if successful)
                - url: Final URL after navigation
                - load_time: Time taken to load in seconds
                - error: Error message (if failed)
        """
        logger.info(f"Opening URL: {url}")

        # Validate URL
        if not url:
            logger.error("Empty URL provided")
            return {"success": False, "error": "URL cannot be empty"}

        if not self._is_valid_url(url):
            logger.error(f"Invalid URL format: {url}")
            return {"success": False, "error": f"Invalid URL format: {url}"}

        try:
            await self._ensure_browser()
            assert self._page is not None

            start_time = time.time()
            await self._page.goto(url, wait_until="domcontentloaded")
            load_time = time.time() - start_time

            title = await self._page.title()
            final_url = self._page.url

            logger.info(f"Page loaded in {load_time:.2f}s: {title}")

            return {
                "success": True,
                "title": title,
                "url": final_url,
                "load_time": round(load_time, 3),
            }

        except TimeoutError as e:
            logger.error(f"Navigation timeout: {e}")
            return {"success": False, "error": f"Navigation timeout: {e}"}
        except Exception as e:
            logger.error(f"Failed to open URL: {e}")
            return {"success": False, "error": f"Failed to open URL: {e}"}

    async def screenshot(self, path: str) -> dict[str, Any]:
        """Take screenshot and save to specified path.

        Args:
            path: File path to save screenshot.

        Returns:
            Dictionary with:
                - success: True if successful, False otherwise
                - path: Screenshot file path
                - size: File size in bytes
                - error: Error message (if failed)
        """
        logger.info(f"Taking screenshot: {path}")

        try:
            await self._ensure_browser()
            assert self._page is not None

            # Take screenshot
            await self._page.screenshot(path=path, full_page=True)

            # Get file size
            file_path = Path(path)
            size = file_path.stat().st_size

            # Check size limit
            if size > self.MAX_SCREENSHOT_SIZE:
                logger.error(f"Screenshot size {size} exceeds limit {self.MAX_SCREENSHOT_SIZE}")
                file_path.unlink()  # Delete oversized file
                return {
                    "success": False,
                    "error": f"Screenshot size ({size} bytes) exceeds limit (5MB)",
                }

            logger.info(f"Screenshot saved: {path} ({size} bytes)")
            return {"success": True, "path": path, "size": size}

        except Exception as e:
            logger.error(f"Failed to take screenshot: {e}")
            return {"success": False, "error": f"Failed to take screenshot: {e}"}

    async def click(self, selector: str) -> dict[str, Any]:
        """Click page element.

        Args:
            selector: CSS selector for the element to click.

        Returns:
            Dictionary with:
                - success: True if successful, False otherwise
                - error: Error message (if failed)
        """
        logger.info(f"Clicking element: {selector}")

        # Validate selector
        if not selector:
            logger.error("Empty selector provided")
            return {"success": False, "error": "Selector cannot be empty"}

        try:
            await self._ensure_browser()
            assert self._page is not None

            await self._page.click(selector)
            logger.info(f"Element clicked: {selector}")
            return {"success": True, "error": None}

        except Exception as e:
            logger.error(f"Failed to click element: {e}")
            return {"success": False, "error": f"Failed to click element: {e}"}

    async def extract_text(self) -> dict[str, Any]:
        """Extract page text content.

        Returns:
            Dictionary with:
                - success: True if successful, False otherwise
                - text: Page plain text content
                - length: Text length in characters
                - error: Error message (if failed)
        """
        logger.info("Extracting page text")

        try:
            await self._ensure_browser()
            assert self._page is not None

            # Get page content and extract text
            content = await self._page.content()

            # Simple HTML to text conversion
            text = self._html_to_text(content)
            length = len(text)

            logger.info(f"Text extracted: {length} characters")
            return {"success": True, "text": text, "length": length}

        except Exception as e:
            logger.error(f"Failed to extract text: {e}")
            return {"success": False, "error": f"Failed to extract text: {e}"}

    def _html_to_text(self, html_content: str) -> str:
        """Convert HTML to plain text.

        Simple HTML tag stripping for text extraction.

        Args:
            html_content: HTML content string.

        Returns:
            Plain text with HTML tags removed.
        """
        # Remove script and style elements
        text = re.sub(
            r"<script[^>]*>[^<]*</script>", "", html_content, flags=re.DOTALL | re.IGNORECASE
        )
        text = re.sub(r"<style[^>]*>[^<]*</style>", "", text, flags=re.DOTALL | re.IGNORECASE)

        # Replace common block elements with newlines
        text = re.sub(r"</(p|div|h[1-6]|li|tr)>\s*", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<(br|hr)\s*/?>\s*", "\n", text, flags=re.IGNORECASE)

        # Remove all remaining HTML tags
        text = re.sub(r"<[^>]+>", "", text)

        # Decode HTML entities
        text = html.unescape(text)

        # Normalize whitespace
        text = re.sub(r"\n\s*\n", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)

        return text.strip()

    async def close(self) -> None:
        """Close browser and cleanup resources."""
        logger.debug("Closing browser...")

        if self._browser is not None:
            try:
                await self._browser.close()
                logger.info("Browser closed")
            except Exception as e:
                logger.warning(f"Error closing browser: {e}")
            finally:
                self._browser = None
                self._page = None

        if self._playwright is not None:
            try:
                await self._playwright.stop()
                logger.debug("Playwright stopped")
            except Exception as e:
                logger.warning(f"Error stopping playwright: {e}")
            finally:
                self._playwright = None

    async def __aenter__(self) -> "BrowserTool":
        """Enter async context manager.

        Returns:
            Self for use in async with statement.
        """
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Exit async context manager and cleanup.

        Args:
            exc_type: Exception type if an exception occurred.
            exc_val: Exception value if an exception occurred.
            exc_tb: Exception traceback if an exception occurred.
        """
        await self.close()

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute browser action based on parameters.

        Implements the Tool interface. Dispatches to specific methods
        based on the 'action' parameter.

        Args:
            **kwargs: Must include 'action' key. Additional parameters
                depend on the action type.

        Returns:
            Dictionary with execution result.

        Supported actions:
            - open: requires 'url'
            - screenshot: requires 'path'
            - click: requires 'selector'
            - extract_text: no additional params
        """
        action = kwargs.get("action")

        if not action:
            return {"success": False, "error": "Missing required parameter: action"}

        logger.info(f"Executing browser action: {action}")

        if action == "open":
            url = kwargs.get("url")
            if not url:
                return {"success": False, "error": "Missing required parameter: url"}
            return await self.open(url)

        elif action == "screenshot":
            path = kwargs.get("path")
            if not path:
                return {"success": False, "error": "Missing required parameter: path"}
            return await self.screenshot(path)

        elif action == "click":
            selector = kwargs.get("selector")
            if not selector:
                return {"success": False, "error": "Missing required parameter: selector"}
            return await self.click(selector)

        elif action == "extract_text":
            return await self.extract_text()

        else:
            return {"success": False, "error": f"Unknown action: {action}"}
