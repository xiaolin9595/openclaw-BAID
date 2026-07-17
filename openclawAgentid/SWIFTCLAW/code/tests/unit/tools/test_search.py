"""Unit tests for Tavily Search tool."""

import pytest
import respx
from httpx import Response, TimeoutException

from tools.search import SearchTool


class TestSearchTool:
    """Test cases for SearchTool."""

    def test_init_with_api_key(self):
        """Test initialization with explicit API key."""
        tool = SearchTool(api_key="test_key")
        assert tool._api_key == "test_key"
        assert tool._base_url == "https://api.tavily.com/search"

    def test_init_without_api_key(self):
        """Test initialization without API key."""
        tool = SearchTool()
        assert tool._api_key is None

    def test_name_property(self):
        """Test name property returns correct value."""
        tool = SearchTool()
        assert tool.name == "web_search"

    def test_description_property(self):
        """Test description property returns non-empty string."""
        tool = SearchTool()
        assert "Tavily" in tool.description
        assert "search the web" in tool.description.lower()

    @pytest.mark.asyncio
    async def test_search_without_api_key(self):
        """Test search fails gracefully when API key is not configured."""
        tool = SearchTool(api_key=None)
        result = await tool.search("test query")

        assert result["success"] is False
        assert result["query"] == "test query"
        assert result["total"] == 0
        assert "TAVILY_API_KEY not configured" in result["error"]

    @pytest.mark.asyncio
    async def test_search_with_empty_query(self):
        """Test search fails with empty query."""
        tool = SearchTool(api_key="test_key")
        result = await tool.search("")

        assert result["success"] is False
        assert "Query cannot be empty" in result["error"]

    @pytest.mark.asyncio
    async def test_search_with_whitespace_query(self):
        """Test search fails with whitespace-only query."""
        tool = SearchTool(api_key="test_key")
        result = await tool.search("   ")

        assert result["success"] is False
        assert "Query cannot be empty" in result["error"]

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_success(self):
        """Test successful search returns results."""
        tool = SearchTool(api_key="test_key")

        mock_data = {
            "results": [
                {
                    "title": "Test Result 1",
                    "url": "https://example.com/1",
                    "content": "Description 1",
                    "published_date": "2024-01-01"
                },
                {
                    "title": "Test Result 2",
                    "url": "https://example.com/2",
                    "content": "Description 2"
                }
            ]
        }

        route = respx.post("https://api.tavily.com/search").mock(
            return_value=Response(200, json=mock_data)
        )

        result = await tool.search("test query", count=5)

        assert result["success"] is True
        assert result["query"] == "test query"
        assert result["total"] == 2
        assert len(result["results"]) == 2

        # Verify first result
        assert result["results"][0]["title"] == "Test Result 1"
        assert result["results"][0]["url"] == "https://example.com/1"
        assert result["results"][0]["description"] == "Description 1"
        assert result["results"][0]["published_date"] == "2024-01-01"

        # Verify second result
        assert result["results"][1]["title"] == "Test Result 2"
        assert result["results"][1]["published_date"] is None

        # Verify request was made with correct body
        assert route.called
        request = route.calls.last.request
        import json
        body = json.loads(request.content)
        assert body["api_key"] == "test_key"
        assert body["query"] == "test query"
        assert body["max_results"] == 5

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_invalid_api_key(self):
        """Test search handles 401 unauthorized error."""
        tool = SearchTool(api_key="invalid_key")

        respx.post("https://api.tavily.com/search").mock(
            return_value=Response(401, text="Unauthorized")
        )

        result = await tool.search("test query")

        assert result["success"] is False
        assert "Invalid API key" in result["error"]

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_rate_limit(self):
        """Test search handles 429 rate limit error."""
        tool = SearchTool(api_key="test_key")

        respx.post("https://api.tavily.com/search").mock(
            return_value=Response(429, text="Rate Limited")
        )

        result = await tool.search("test query")

        assert result["success"] is False
        assert "Rate limit exceeded" in result["error"]

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_timeout(self):
        """Test search handles timeout exception."""
        tool = SearchTool(api_key="test_key")

        respx.post("https://api.tavily.com/search").mock(
            side_effect=TimeoutException("Request timed out")
        )

        result = await tool.search("test query")

        assert result["success"] is False
        assert "timeout" in result["error"].lower()

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_http_error(self):
        """Test search handles generic HTTP error."""
        tool = SearchTool(api_key="test_key")

        respx.post("https://api.tavily.com/search").mock(
            return_value=Response(500, text="Internal Server Error")
        )

        result = await tool.search("test query")

        assert result["success"] is False
        assert "HTTP error" in result["error"]

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_empty_results(self):
        """Test search handles empty results."""
        tool = SearchTool(api_key="test_key")

        mock_data = {"results": []}

        respx.post("https://api.tavily.com/search").mock(
            return_value=Response(200, json=mock_data)
        )

        result = await tool.search("test query")

        assert result["success"] is True
        assert result["total"] == 0
        assert result["results"] == []

    @pytest.mark.asyncio
    async def test_search_count_validation(self):
        """Test count parameter is clamped to valid range."""
        tool = SearchTool(api_key="test_key")

        with respx.mock:
            route = respx.post("https://api.tavily.com/search").mock(
                return_value=Response(200, json={"results": []})
            )

            # Test count > 10 is clamped to 10 (Tavily limit)
            await tool.search("test", count=50)
            request = route.calls.last.request
            import json
            body = json.loads(request.content)
            assert body["max_results"] == 10

            # Test count < 1 is clamped to 1
            await tool.search("test", count=0)
            request = route.calls.last.request
            body = json.loads(request.content)
            assert body["max_results"] == 1

            # Test negative count is clamped to 1
            await tool.search("test", count=-5)
            request = route.calls.last.request
            body = json.loads(request.content)
            assert body["max_results"] == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_with_offset(self):
        """Test search with offset parameter (ignored for Tavily)."""
        tool = SearchTool(api_key="test_key")

        route = respx.post("https://api.tavily.com/search").mock(
            return_value=Response(200, json={"results": []})
        )

        await tool.search("test", offset=10)

        # Offset is ignored in Tavily, just verify request succeeds
        assert route.called

    @pytest.mark.asyncio
    async def test_execute_method(self):
        """Test execute method calls search correctly."""
        tool = SearchTool(api_key="test_key")

        with respx.mock:
            respx.post("https://api.tavily.com/search").mock(
                return_value=Response(200, json={"results": []})
            )

            result = await tool.execute(query="test query", count=3, offset=5)

            assert result["success"] is True
            assert result["query"] == "test query"

    @pytest.mark.asyncio
    async def test_execute_with_defaults(self):
        """Test execute method uses default values."""
        tool = SearchTool(api_key="test_key")

        with respx.mock:
            route = respx.post("https://api.tavily.com/search").mock(
                return_value=Response(200, json={"results": []})
            )

            await tool.execute(query="test query")

            request = route.calls.last.request
            import json
            body = json.loads(request.content)
            assert body["max_results"] == 5

    def test_format_results_with_data(self):
        """Test format_results with search results."""
        results = [
            {
                "title": "Result 1",
                "url": "https://example.com/1",
                "description": "Description 1",
                "published_date": "2024-01-01"
            },
            {
                "title": "Result 2",
                "url": "https://example.com/2",
                "description": "Description 2",
                "published_date": None
            }
        ]

        formatted = SearchTool.format_results(results)

        assert "1. Result 1" in formatted
        assert "URL: https://example.com/1" in formatted
        assert "Description 1" in formatted
        assert "Published: 2024-01-01" in formatted
        assert "2. Result 2" in formatted
        assert "URL: https://example.com/2" in formatted

    @respx.mock
    @pytest.mark.asyncio
    async def test_search_generic_exception(self):
        """Test search handles unexpected exceptions."""
        tool = SearchTool(api_key="test_key")

        respx.post("https://api.tavily.com/search").mock(
            side_effect=ValueError("Unexpected error")
        )

        result = await tool.search("test query")

        assert result["success"] is False
        assert "Unexpected error" in result["error"]

    def test_format_results_empty(self):
        """Test format_results with empty list."""
        formatted = SearchTool.format_results([])
        assert formatted == "No results found."

    def test_format_results_without_published_date(self):
        """Test format_results excludes published date when not present."""
        results = [
            {
                "title": "Result",
                "url": "https://example.com",
                "description": "Description",
                "published_date": None
            }
        ]

        formatted = SearchTool.format_results(results)

        assert "Published" not in formatted
        assert "Result" in formatted
