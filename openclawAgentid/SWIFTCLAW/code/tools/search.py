"""Tavily Search tool implementation."""

from typing import Any

import httpx
from loguru import logger

from tools.base import Tool


class SearchTool(Tool):
    """Tavily Search tool for web search."""

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key
        self._base_url = "https://api.tavily.com/search"

    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "Search the web using Tavily API. "
            "Returns search results with title, URL, and content. "
            "Free tier: 1000 queries/month."
        )

    async def search(
        self,
        query: str,
        count: int = 5,
        offset: int = 0
    ) -> dict[str, Any]:
        """Execute web search.

        Args:
            query: Search query string
            count: Number of results (1-10, default 5)
            offset: Result offset for pagination (not supported by Tavily, ignored)

        Returns:
            {
                "success": True/False,
                "query": str,
                "results": [
                    {
                        "title": str,
                        "url": str,
                        "description": str,
                        "published_date": str | None
                    }
                ],
                "total": int,
                "error": str | None
            }
        """
        # Validate API key
        if not self._api_key:
            return {
                "success": False,
                "query": query,
                "results": [],
                "total": 0,
                "error": "TAVILY_API_KEY not configured"
            }

        # Validate parameters
        if not query or not query.strip():
            return {
                "success": False,
                "query": query,
                "results": [],
                "total": 0,
                "error": "Query cannot be empty"
            }

        count = max(1, min(count, 10))  # Clamp to 1-10 (Tavily limit)

        headers: dict[str, str] = {
            "Content-Type": "application/json"
        }

        payload: dict[str, Any] = {
            "api_key": self._api_key,
            "query": query.strip(),
            "max_results": count,
            "search_depth": "basic",
            "include_answer": False
        }

        try:
            logger.info(f"Searching for: {query}")

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self._base_url,
                    headers=headers,
                    json=payload
                )

                # Handle specific status codes
                if response.status_code == 401:
                    return {
                        "success": False,
                        "query": query,
                        "results": [],
                        "total": 0,
                        "error": "Invalid API key"
                    }
                elif response.status_code == 429:
                    return {
                        "success": False,
                        "query": query,
                        "results": [],
                        "total": 0,
                        "error": "Rate limit exceeded (1000 queries/month)"
                    }

                response.raise_for_status()
                data = response.json()

                # Parse results
                results = []
                for item in data.get("results", []):
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "description": item.get("content", ""),  # Tavily uses 'content' not 'description'
                        "published_date": item.get("published_date")
                    })

                logger.info(f"Found {len(results)} results")

                return {
                    "success": True,
                    "query": query,
                    "results": results,
                    "total": len(results),
                    "error": None
                }

        except httpx.TimeoutException:
            logger.error("Search request timed out")
            return {
                "success": False,
                "query": query,
                "results": [],
                "total": 0,
                "error": "Request timeout"
            }
        except httpx.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            return {
                "success": False,
                "query": query,
                "results": [],
                "total": 0,
                "error": f"HTTP error: {e}"
            }
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "success": False,
                "query": query,
                "results": [],
                "total": 0,
                "error": str(e)
            }

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute tool with given parameters.

        Expected kwargs:
            - query: str (required)
            - count: int (optional, default 5)
            - offset: int (optional, default 0, ignored)
        """
        query = kwargs.get("query", "")
        count = kwargs.get("count", 5)
        offset = kwargs.get("offset", 0)

        return await self.search(query, count, offset)

    @staticmethod
    def format_results(results: list[dict[str, Any]]) -> str:
        """Format search results as readable text."""
        if not results:
            return "No results found."

        lines = []
        for i, result in enumerate(results, 1):
            lines.append(f"{i}. {result['title']}")
            lines.append(f"   URL: {result['url']}")
            lines.append(f"   {result['description']}")
            if result.get('published_date'):
                lines.append(f"   Published: {result['published_date']}")
            lines.append("")

        return "\n".join(lines)
