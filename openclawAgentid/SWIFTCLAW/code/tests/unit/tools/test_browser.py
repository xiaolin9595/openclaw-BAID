"""Unit tests for BrowserTool.

Tests use mocked Playwright to avoid starting real browser instances.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tools.browser import BrowserTool


@asynccontextmanager
async def _patched_browser(mock_playwright: dict) -> AsyncGenerator[BrowserTool, None]:
    """Helper context manager for patching async_playwright."""
    with patch(
        "tools.browser.async_playwright",
        return_value=mock_playwright["async_playwright"],
    ):
        yield BrowserTool()


@pytest.fixture
def mock_playwright():
    """Create a mock Playwright instance."""
    # Create the mock page
    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_page.screenshot = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body>Test</body></html>")
    mock_page.title = AsyncMock(return_value="Test Page Title")
    mock_page.url = "https://example.com"
    mock_page.set_default_timeout = MagicMock()

    # Create the mock browser
    mock_browser = MagicMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    # Create the mock playwright instance with async start() method
    mock_pw_instance = MagicMock()
    mock_pw_instance.chromium = MagicMock()
    mock_pw_instance.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_pw_instance.stop = AsyncMock()

    # Create the async_playwright mock that returns an object with async start()
    mock_async_playwright = MagicMock()
    mock_async_playwright.start = AsyncMock(return_value=mock_pw_instance)

    return {
        "async_playwright": mock_async_playwright,
        "playwright": mock_pw_instance,
        "browser": mock_browser,
        "page": mock_page,
    }


@pytest.fixture
async def browser_tool(mock_playwright):
    """Create a BrowserTool with mocked Playwright."""
    async with _patched_browser(mock_playwright) as tool:
        yield tool
        # Cleanup
        if tool._playwright is not None:
            await tool.close()


class TestBrowserToolInitialization:
    """Test suite for BrowserTool initialization."""

    def test_tool_properties(self):
        """Test tool name and description properties."""
        tool = BrowserTool()
        assert tool.name == "browser"
        assert tool.description == "浏览器自动化工具，支持打开网页、截图、点击元素和提取文本"

    def test_initial_state(self):
        """Test initial state of BrowserTool."""
        tool = BrowserTool()
        assert tool._playwright is None
        assert tool._browser is None
        assert tool._page is None


class TestBrowserToolEnsureBrowser:
    """Test suite for _ensure_browser method."""

    @pytest.mark.asyncio
    async def test_lazy_initialization(self, mock_playwright):
        """Test browser is lazily initialized."""
        async with _patched_browser(mock_playwright) as tool:
            assert tool._browser is None

            # Trigger initialization
            await tool._ensure_browser()

            assert tool._playwright is not None
            assert tool._browser is not None
            assert tool._page is not None
            mock_playwright["playwright"].chromium.launch.assert_called_once()

    @pytest.mark.asyncio
    async def test_reuse_existing_browser(self, mock_playwright):
        """Test existing browser is reused."""
        async with _patched_browser(mock_playwright) as tool:
            await tool._ensure_browser()
            await tool._ensure_browser()  # Second call

            # Should only launch once
            mock_playwright["playwright"].chromium.launch.assert_called_once()


class TestBrowserToolOpen:
    """Test suite for open method."""

    @pytest.mark.asyncio
    async def test_open_success(self, mock_playwright):
        """Test successful page open."""
        async with _patched_browser(mock_playwright) as tool:
            result = await tool.open("https://example.com")

            assert result["success"] is True
            assert result["url"] == "https://example.com"
            assert "title" in result
            assert "load_time" in result
            assert isinstance(result["load_time"], float)

    @pytest.mark.asyncio
    async def test_open_invalid_url(self):
        """Test open with invalid URL."""
        tool = BrowserTool()
        result = await tool.open("not-a-url")

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_open_empty_url(self):
        """Test open with empty URL."""
        tool = BrowserTool()
        result = await tool.open("")

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_open_timeout(self, mock_playwright):
        """Test open with timeout error."""
        mock_playwright["page"].goto = AsyncMock(
            side_effect=TimeoutError("Navigation timeout")
        )

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.open("https://example.com")

            assert result["success"] is False
            error_lower = result["error"].lower()
            assert "timeout" in error_lower or "navigation" in error_lower


class TestBrowserToolScreenshot:
    """Test suite for screenshot method."""

    @pytest.mark.asyncio
    async def test_screenshot_success(self, mock_playwright, tmp_path):
        """Test successful screenshot."""
        screenshot_path = tmp_path / "screenshot.png"
        mock_playwright["page"].screenshot = AsyncMock()
        # Create the file to simulate screenshot
        screenshot_path.write_bytes(b"fake image data")

        async with _patched_browser(mock_playwright) as tool:
            await tool._ensure_browser()
            result = await tool.screenshot(str(screenshot_path))

            assert result["success"] is True
            assert result["path"] == str(screenshot_path)
            assert "size" in result

    @pytest.mark.asyncio
    async def test_screenshot_browser_not_initialized(self, tmp_path):
        """Test screenshot auto-initializes the browser when needed."""
        tool = BrowserTool()
        result = await tool.screenshot(str(tmp_path / "test.png"))

        assert result["success"] is True
        assert result["path"].endswith("test.png")
        assert "size" in result

    @pytest.mark.asyncio
    async def test_screenshot_size_limit(self, mock_playwright, tmp_path):
        """Test screenshot size limit enforcement."""
        screenshot_path = tmp_path / "screenshot.png"
        # Create a file larger than 5MB
        screenshot_path.write_bytes(b"x" * (6 * 1024 * 1024))

        mock_playwright["page"].screenshot = AsyncMock()

        async with _patched_browser(mock_playwright) as tool:
            await tool._ensure_browser()
            result = await tool.screenshot(str(screenshot_path))

            assert result["success"] is False
            error_lower = result["error"].lower()
            assert "size" in error_lower or "limit" in error_lower


class TestBrowserToolClick:
    """Test suite for click method."""

    @pytest.mark.asyncio
    async def test_click_success(self, mock_playwright):
        """Test successful element click."""
        mock_playwright["page"].click = AsyncMock()

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.click("#submit-button")

            assert result["success"] is True
            mock_playwright["page"].click.assert_called_once_with("#submit-button")

    @pytest.mark.asyncio
    async def test_click_element_not_found(self, mock_playwright):
        """Test click on non-existent element."""
        from playwright.async_api import Error as PlaywrightError

        mock_playwright["page"].click = AsyncMock(
            side_effect=PlaywrightError("Element not found")
        )

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.click("#nonexistent")

            assert result["success"] is False
            assert "error" in result

    @pytest.mark.asyncio
    async def test_click_empty_selector(self):
        """Test click with empty selector."""
        tool = BrowserTool()
        result = await tool.click("")

        assert result["success"] is False
        assert "error" in result


class TestBrowserToolExtractText:
    """Test suite for extract_text method."""

    @pytest.mark.asyncio
    async def test_extract_text_success(self, mock_playwright):
        """Test successful text extraction."""
        html_content = """
        <html>
            <body>
                <h1>Title</h1>
                <p>Paragraph 1</p>
                <p>Paragraph 2</p>
            </body>
        </html>
        """
        mock_playwright["page"].content = AsyncMock(return_value=html_content)

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.extract_text()

            assert result["success"] is True
            assert "text" in result
            assert "length" in result
            assert "Title" in result["text"]
            assert result["length"] > 0

    @pytest.mark.asyncio
    async def test_extract_text_browser_not_initialized(self):
        """Test extract_text auto-initializes the browser when needed."""
        tool = BrowserTool()
        result = await tool.extract_text()

        assert result["success"] is True
        assert "text" in result
        assert "length" in result

    @pytest.mark.asyncio
    async def test_extract_text_strips_html(self, mock_playwright):
        """Test that HTML tags are stripped from extracted text."""
        html_content = "<html><body><p>  Text with spaces  </p></body></html>"
        mock_playwright["page"].content = AsyncMock(return_value=html_content)

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.extract_text()

            assert result["success"] is True
            assert "<p>" not in result["text"]
            assert "</p>" not in result["text"]


class TestBrowserToolClose:
    """Test suite for close method."""

    @pytest.mark.asyncio
    async def test_close_browser(self, mock_playwright):
        """Test browser is properly closed."""
        async with _patched_browser(mock_playwright) as tool:
            await tool._ensure_browser()
            await tool.close()

            mock_playwright["browser"].close.assert_called_once()
            mock_playwright["playwright"].stop.assert_called_once()
            assert tool._browser is None
            assert tool._page is None

    @pytest.mark.asyncio
    async def test_close_not_initialized(self):
        """Test close when browser was never initialized."""
        tool = BrowserTool()
        # Should not raise any error
        await tool.close()
        assert tool._browser is None


class TestBrowserToolContextManager:
    """Test suite for async context manager support."""

    @pytest.mark.asyncio
    async def test_async_context_manager(self, mock_playwright):
        """Test async context manager properly manages browser lifecycle."""
        with patch(
            "tools.browser.async_playwright",
            return_value=mock_playwright["async_playwright"],
        ):
            async with BrowserTool() as tool:
                assert isinstance(tool, BrowserTool)
                # Trigger browser initialization
                await tool._ensure_browser()
                assert tool._browser is not None

            # After exiting context, browser should be closed
            mock_playwright["browser"].close.assert_called_once()

    @pytest.mark.asyncio
    async def test_context_manager_exception_handling(self, mock_playwright):
        """Test context manager handles exceptions gracefully."""
        with patch(
            "tools.browser.async_playwright",
            return_value=mock_playwright["async_playwright"],
        ):
            try:
                async with BrowserTool() as tool:
                    await tool._ensure_browser()
                    raise ValueError("Test exception")
            except ValueError:
                pass

            # Browser should still be closed
            mock_playwright["browser"].close.assert_called_once()


class TestBrowserToolExecute:
    """Test suite for execute method (Tool interface compliance)."""

    @pytest.mark.asyncio
    async def test_execute_open(self, mock_playwright):
        """Test execute with open action."""
        async with _patched_browser(mock_playwright) as tool:
            result = await tool.execute(action="open", url="https://example.com")

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_screenshot(self, mock_playwright, tmp_path):
        """Test execute with screenshot action."""
        screenshot_path = tmp_path / "test.png"
        screenshot_path.write_bytes(b"test")
        mock_playwright["page"].screenshot = AsyncMock()

        async with _patched_browser(mock_playwright) as tool:
            await tool._ensure_browser()
            result = await tool.execute(action="screenshot", path=str(screenshot_path))

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_click(self, mock_playwright):
        """Test execute with click action."""
        mock_playwright["page"].click = AsyncMock()

        async with _patched_browser(mock_playwright) as tool:
            result = await tool.execute(action="click", selector="#btn")

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_extract_text(self, mock_playwright):
        """Test execute with extract_text action."""
        async with _patched_browser(mock_playwright) as tool:
            result = await tool.execute(action="extract_text")

            assert result["success"] is True
            assert "text" in result

    @pytest.mark.asyncio
    async def test_execute_invalid_action(self):
        """Test execute with invalid action."""
        tool = BrowserTool()
        result = await tool.execute(action="invalid_action")

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self):
        """Test execute with missing required parameters."""
        tool = BrowserTool()
        result = await tool.execute(action="open")  # Missing url

        assert result["success"] is False
        assert "error" in result
