"""PydanticAI-based agent implementation for SwiftClaw."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from loguru import logger
from pydantic_ai import Agent, RunContext, AgentRunResult

from config.settings import Settings


@dataclass
class LLMResponse:
    """Standardized response from LLM for backward compatibility."""

    content: str
    model: str = "claude-3-5-sonnet-20241022"
    usage: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentDependencies:
    """Dependencies injected into agent tools."""

    settings: Settings
    memory: dict[str, Any] = field(default_factory=dict)
    skill_manager: Any = field(default=None)
    user_id: int | None = field(default=None)
    telegram_id: int | None = field(default=None)
    memory_store: Any = field(default=None)  # MemoryStore instance for persistence


class SwiftClawAgent:
    """Main agent class using PydanticAI framework.

    This agent wraps PydanticAI's Agent with proper configuration
    for LLM API and tool integration.

    Supports:
    - Anthropic Claude API (recommended)
    - Moonshot (Kimi) API (alternative)

    Example:
        agent = SwiftClawAgent(settings)
        result = await agent.run("Hello, how are you?")
        print(result.data)
    """

    def __init__(self, settings: Settings | None = None, skill_manager: Any = None, memory_store: Any = None) -> None:
        """Initialize the agent.

        Args:
            settings: Application settings. If None, loads from environment.
            skill_manager: Optional skill manager for building skills prompt.
            memory_store: Optional memory store for persistent memory operations.
        """
        from config import get_settings

        self.settings = settings or get_settings()
        self._agent: Agent[AgentDependencies, str] | None = None
        self._skill_manager = skill_manager
        self._memory_store = memory_store
        self._deps: AgentDependencies | None = None

    def _get_model(self):
        """Create and configure the LLM model.

        Priority:
        1. Anthropic Claude API (if ANTHROPIC_API_KEY is set)
        2. Moonshot API (if MOONSHOT_API_KEY is set)

        Returns:
            Configured Model instance.
        """
        # 优先使用 Anthropic Claude
        if self.settings.anthropic_api_key:
            from pydantic_ai.models.anthropic import AnthropicModel
            from pydantic_ai.providers.anthropic import AnthropicProvider

            logger.info(f"Using Anthropic Claude API with model: {self.settings.anthropic_model}")
            provider_kwargs = {"api_key": self.settings.anthropic_api_key}
            if self.settings.anthropic_base_url:
                provider_kwargs["base_url"] = self.settings.anthropic_base_url
                logger.info(f"Using custom Anthropic base URL: {self.settings.anthropic_base_url}")
            provider = AnthropicProvider(**provider_kwargs)
            return AnthropicModel(self.settings.anthropic_model, provider=provider)

        # 备选：Moonshot API
        if self.settings.moonshot_api_key:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider

            # 检测 API key 类型并自动选择 endpoint
            if self.settings.moonshot_api_key.startswith("sk-kimi-"):
                # Kimi Code API
                base_url = "https://api.kimi.com/coding/v1"
                model_name = "kimi-for-coding"
                logger.info("Using Kimi Code API (api.kimi.com)")
            else:
                # 标准 Moonshot API
                base_url = "https://api.moonshot.cn/v1"
                model_name = self.settings.moonshot_model
                logger.info(f"Using Moonshot API (api.moonshot.cn) with model: {model_name}")

            provider = OpenAIProvider(
                base_url=base_url,
                api_key=self.settings.moonshot_api_key,
            )
            return OpenAIChatModel(model_name, provider=provider)

        raise ValueError(
            "No API key configured. Please set ANTHROPIC_API_KEY or MOONSHOT_API_KEY in .env"
        )

    def _build_system_prompt(self) -> str:
        """Build the system prompt for the agent.

        Returns:
            System prompt string.
        """
        base_prompt = """You are SwiftClaw, an AI assistant that helps users with various tasks.

You have access to tools for:
- File operations (read, write, list directories)
- Bash command execution (in Docker sandbox)
- Web browser automation (open pages, take screenshots, extract text)
- Local browser opening on the user's own computer when configured
- Web search (Tavily API)
- Memory management (save, recall, list important information about the user)
- Historical log search (search past conversations by keyword)

STRICT MEMORY PROTOCOL - FOLLOW EXACTLY:
When the user tells you ANY personal preference, habit, identity, or fact about themselves:
1. STOP generating a text reply immediately.
2. CALL the save_memory tool FIRST to store it.
3. ONLY AFTER the tool call succeeds, provide a brief friendly confirmation.

Do NOT say "I have remembered", "好的已经记住啦", or similar in plain text without calling save_memory first.
If the user asks "What do I like?", "我喜欢什么", or references the past, call search_history or recall_memory.

Use tools when needed to help the user. Be concise and helpful."""

        # Add skills prompt
        skills_prompt = ""
        if self._deps and self._deps.skill_manager:
            try:
                skills_prompt = self._deps.skill_manager.build_skills_prompt()
            except Exception as e:
                logger.warning(f"Failed to build skills prompt: {e}")

        if skills_prompt:
            return f"{base_prompt}\n\n{skills_prompt}"
        return base_prompt

    def get_agent(self) -> Agent[AgentDependencies, str]:
        """Get or create the PydanticAI agent.

        Returns:
            Configured Agent instance.
        """
        if self._agent is None:
            model = self._get_model()
            self._agent = Agent(
                model=model,
                system_prompt=self._build_system_prompt(),
                deps_type=AgentDependencies,
                output_type=str,
            )
            # Register tools
            self._register_tools()
            logger.info(f"Agent initialized with model: {self.settings.moonshot_model}")

        return self._agent

    def get_deps(self, user_id: int | None = None, telegram_id: int | None = None) -> AgentDependencies:
        """Get agent dependencies, optionally with user context.

        Args:
            user_id: Optional user ID for memory operations.
            telegram_id: Optional Telegram user ID for markdown-based memory store.

        Returns:
            Configured AgentDependencies instance.
        """
        if self._deps is None:
            self._deps = AgentDependencies(
                settings=self.settings,
                skill_manager=self._skill_manager,
                memory_store=self._memory_store,
            )
        # Update user_id for this specific run
        self._deps.user_id = user_id
        self._deps.telegram_id = telegram_id
        return self._deps

    def _register_tools(self) -> None:
        """Register all tools with the agent.

        This method imports and registers tool functions from the tools module.
        """
        # Import here to avoid circular imports
        from agent.tools import register_all_tools

        if self._agent:
            register_all_tools(self._agent)
            logger.debug("Tools registered with agent")

    async def run(
        self,
        message: str,
        user_id: int | None = None,
        telegram_id: int | None = None,
    ) -> AgentRunResult[str]:
        """Run the agent with a user message.

        Args:
            message: User input message.
            user_id: Optional database user ID for memory operations.
            telegram_id: Optional Telegram user ID for markdown-based memory store.

        Returns:
            AgentRunResult containing the agent's response.
        """
        agent = self.get_agent()
        deps = self.get_deps(user_id, telegram_id=telegram_id)
        logger.debug(f"Running agent with message: {message[:50]}...")

        result = await agent.run(message, deps=deps)

        # PydanticAI 返回的是 AgentRunResult
        # response 是 ModelResponse 对象，使用 .text 获取文本
        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            response_text = result.response.text
        else:
            response_text = str(result.response)
        logger.debug(f"Agent response: {response_text[:100]}...")
        return result

    async def run_stream(
        self,
        message: str,
        user_id: int | None = None,
        telegram_id: int | None = None,
    ):
        """Run the agent with streaming response.

        Args:
            message: User input message.
            user_id: Optional database user ID for memory operations.
            telegram_id: Optional Telegram user ID for markdown-based memory store.

        Yields:
            Content chunks as they arrive.
        """
        agent = self.get_agent()
        deps = self.get_deps(user_id, telegram_id=telegram_id)
        logger.debug(f"Running agent in streaming mode: {message[:50]}...")

        async with agent.run_stream(message, deps=deps) as result:
            async for chunk in result.stream_text():
                yield chunk


# Backward compatibility: keep LLMClient interface
class LLMClient:
    """Legacy LLM client interface for backward compatibility.

    This class provides the same interface as the old litellm-based client
    but uses PydanticAI internally.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize LLM client.

        Args:
            settings: Application settings.
        """
        self._agent = SwiftClawAgent(settings)

    async def complete(
        self,
        messages: list[dict[str, str]],
        system_message: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Send completion request to LLM.

        Args:
            messages: List of message dicts.
            system_message: Optional system message.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens.

        Returns:
            LLMResponse with generated content.
        """
        # Convert messages to single prompt
        user_message = messages[-1].get("content", "") if messages else ""

        result = await self._agent.run(user_message)
        # 从 AgentRunResult 中提取文本
        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            response_text = result.response.text
        elif hasattr(result, 'response'):
            response_text = str(result.response)
        else:
            response_text = str(result)
        return LLMResponse(content=response_text)

    async def stream_complete(
        self,
        messages: list[dict[str, str]],
        system_message: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ):
        """Stream completion from LLM.

        Args:
            messages: List of message dicts.
            system_message: Optional system message.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens.

        Yields:
            Content chunks as they arrive.
        """
        user_message = messages[-1].get("content", "") if messages else ""

        async for chunk in self._agent.run_stream(user_message):
            yield chunk
