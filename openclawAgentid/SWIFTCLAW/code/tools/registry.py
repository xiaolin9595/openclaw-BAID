"""Tool registry for managing and executing tools."""

from typing import Any

from tools.base import Tool


class ToolRegistry:
    """Registry for managing tools.

    Provides methods to register, retrieve, and execute tools by name.
    All tools must inherit from the Tool base class.

    Example:
        registry = ToolRegistry()
        registry.register(FileTool())
        result = await registry.execute("file", action="read", path="test.txt")
    """

    def __init__(self) -> None:
        """Initialize empty tool registry."""
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool in the registry.

        Args:
            tool: Tool instance to register. Must inherit from Tool.

        Raises:
            ValueError: If a tool with the same name is already registered.
        """
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        """Get a tool by name.

        Args:
            name: Name of the tool to retrieve.

        Returns:
            Tool instance if found, None otherwise.
        """
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        """List all registered tools.

        Returns:
            List of all registered tool instances.
        """
        return list(self._tools.values())

    async def execute(self, name: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a tool by name.

        Args:
            name: Name of the tool to execute.
            **kwargs: Parameters to pass to the tool's execute method.

        Returns:
            Dict with execution result. If tool not found, returns error dict.
        """
        tool = self.get(name)
        if not tool:
            return {"success": False, "error": f"Tool '{name}' not found"}
        return await tool.execute(**kwargs)

    def build_tools_description(self) -> str:
        """Generate tool description text for prompts.

        Returns:
            Formatted string describing all registered tools.
        """
        if not self._tools:
            return "No tools available."

        desc = []
        for tool in self._tools.values():
            desc.append(f"- {tool.name}: {tool.description}")
        return "\n".join(desc)
