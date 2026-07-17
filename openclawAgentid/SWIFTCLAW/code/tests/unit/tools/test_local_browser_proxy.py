"""Unit tests for the local browser proxy tool."""

from unittest.mock import MagicMock

import httpx
import pytest
import respx

from agent.tools import local_browser_open


@pytest.mark.asyncio
@respx.mock
async def test_local_browser_open_uses_proxy() -> None:
    """Test that local browser opens through the configured proxy."""
    route = respx.post("https://example.ngrok-free.app/open").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "message": "已在本地浏览器打开: https://www.bilibili.com",
            },
        )
    )

    settings = MagicMock()
    settings.local_browser_proxy = "https://example.ngrok-free.app"

    ctx = MagicMock()
    ctx.deps = MagicMock(settings=settings)

    result = await local_browser_open(ctx, "bilibili.com")

    assert "本地浏览器打开" in result
    assert route.called
    assert route.calls[0].request.url.params["url"] == "https://bilibili.com"
