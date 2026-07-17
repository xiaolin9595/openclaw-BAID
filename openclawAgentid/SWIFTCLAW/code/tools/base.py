"""Tool base class for SwiftClaw tools system."""

from abc import ABC, abstractmethod
from typing import Any


class Tool(ABC):
    """Abstract base class for all tools.

    All tools must inherit from this class and implement the required
    abstract properties and methods.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the tool name.

        Returns:
            The unique name identifier for this tool.
        """
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Return the tool description.

        Returns:
            A human-readable description of what this tool does.
        """
        ...

    @abstractmethod
    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute the tool with the given parameters.

        Args:
            **kwargs: Tool-specific parameters.

        Returns:
            A dictionary containing the execution result.
            Must include "success" key (bool).
            On success, may include additional data.
            On failure, should include "error" key with error message.
        """
        ...
