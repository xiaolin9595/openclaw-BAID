"""Unit tests for PydanticAI-based agent."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent.llm import LLMClient, LLMResponse, SwiftClawAgent


# Test fixtures
@pytest.fixture
def mock_settings():
    """Create mock settings."""
    settings = MagicMock()
    settings.moonshot_model = "moonshot-v1-8k"
    settings.moonshot_api_key = "test-api-key"
    settings.tavily_api_key = "test-tavily-key"
    return settings


@pytest.fixture
def swiftclaw_agent(mock_settings):
    """Create a SwiftClawAgent instance with mocked settings."""
    return SwiftClawAgent(settings=mock_settings)


@pytest.fixture
def llm_client(mock_settings):
    """Create an LLMClient instance with mocked settings."""
    return LLMClient(settings=mock_settings)


# SwiftClawAgent tests
class TestSwiftClawAgent:
    """Tests for SwiftClawAgent class."""

    def test_init(self, swiftclaw_agent: SwiftClawAgent, mock_settings) -> None:
        """Test agent initialization."""
        assert swiftclaw_agent.settings == mock_settings
        assert swiftclaw_agent._agent is None

    def test_get_model(self, swiftclaw_agent: SwiftClawAgent) -> None:
        """Test model configuration."""
        # 测试在没有 anthropic_api_key 时返回 None（模拟设置）
        from unittest.mock import MagicMock

        # 创建没有 anthropic key 的设置
        mock_settings = MagicMock()
        mock_settings.anthropic_api_key = None
        mock_settings.moonshot_api_key = "test-key"
        mock_settings.moonshot_model = "moonshot-v1-8k"

        agent = SwiftClawAgent(settings=mock_settings)
        model = agent._get_model()
        from pydantic_ai.models.openai import OpenAIChatModel
        assert isinstance(model, OpenAIChatModel)

    def test_build_system_prompt(self, swiftclaw_agent: SwiftClawAgent) -> None:
        """Test system prompt includes tool information."""
        prompt = swiftclaw_agent._build_system_prompt()

        assert "SwiftClaw" in prompt
        assert "File operations" in prompt
        assert "Bash command" in prompt
        assert "browser" in prompt.lower()
        assert "search" in prompt.lower()

    @pytest.mark.asyncio
    async def test_run(self, swiftclaw_agent: SwiftClawAgent) -> None:
        """Test agent run method."""
        # Mock the underlying agent
        mock_result = MagicMock()
        mock_result.response = "Hello, I'm SwiftClaw!"

        mock_agent = MagicMock()
        mock_agent.run = AsyncMock(return_value=mock_result)

        swiftclaw_agent._agent = mock_agent

        result = await swiftclaw_agent.run("Hello!")

        assert result.response == "Hello, I'm SwiftClaw!"
        mock_agent.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_stream(self, swiftclaw_agent: SwiftClawAgent) -> None:
        """Test agent streaming."""
        # Mock the streaming result
        async def mock_stream_text():
            chunks = ["Hello", ", ", "world"]
            for chunk in chunks:
                yield chunk

        mock_stream_result = AsyncMock()
        mock_stream_result.stream_text = mock_stream_text

        mock_agent = MagicMock()
        mock_agent.run_stream = MagicMock(return_value=mock_stream_result)
        mock_stream_result.__aenter__ = AsyncMock(return_value=mock_stream_result)
        mock_stream_result.__aexit__ = AsyncMock(return_value=None)

        swiftclaw_agent._agent = mock_agent

        chunks = []
        async for chunk in swiftclaw_agent.run_stream("Hello!"):
            chunks.append(chunk)

        mock_agent.run_stream.assert_called_once()


# LLMClient tests (backward compatibility)
class TestLLMClient:
    """Tests for LLMClient backward compatibility."""

    def test_init(self, llm_client: LLMClient) -> None:
        """Test LLMClient initialization."""
        assert llm_client._agent is not None
        assert isinstance(llm_client._agent, SwiftClawAgent)

    @pytest.mark.asyncio
    async def test_complete(self, llm_client: LLMClient) -> None:
        """Test complete method."""
        # Mock the underlying agent
        mock_result = MagicMock()
        mock_result.response = "Test response"

        llm_client._agent.run = AsyncMock(return_value=mock_result)

        messages = [{"role": "user", "content": "Hello!"}]
        result = await llm_client.complete(messages)

        assert isinstance(result, LLMResponse)
        assert result.content == "Test response"
        assert result.model == "claude-3-5-sonnet-20241022"

    @pytest.mark.asyncio
    async def test_complete_with_system_message(self, llm_client: LLMClient) -> None:
        """Test complete with system message."""
        mock_result = MagicMock()
        mock_result.response = "Test response"

        llm_client._agent.run = AsyncMock(return_value=mock_result)

        messages = [{"role": "user", "content": "Hello!"}]
        result = await llm_client.complete(
            messages,
            system_message="You are a helpful assistant.",
            temperature=0.5,
            max_tokens=100
        )

        assert result.content == "Test response"

    @pytest.mark.asyncio
    async def test_complete_empty_messages(self, llm_client: LLMClient) -> None:
        """Test complete with empty messages."""
        mock_result = MagicMock()
        mock_result.response = "Default response"

        llm_client._agent.run = AsyncMock(return_value=mock_result)

        result = await llm_client.complete([])

        assert result.content == "Default response"
        # Should call with empty string when no messages
        llm_client._agent.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_stream_complete(self, llm_client: LLMClient) -> None:
        """Test streaming complete."""
        # Mock the streaming
        mock_stream = AsyncMock()
        mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
        mock_stream.__aexit__ = AsyncMock(return_value=None)
        mock_stream.stream = AsyncMock(return_value=["Hello", ", ", "world"])

        llm_client._agent.run_stream = MagicMock(return_value=mock_stream)

        messages = [{"role": "user", "content": "Hello!"}]

        chunks = []
        async for chunk in llm_client.stream_complete(messages):
            chunks.append(chunk)

        llm_client._agent.run_stream.assert_called_once()


# LLMResponse tests
class TestLLMResponse:
    """Tests for LLMResponse dataclass."""

    def test_creation(self) -> None:
        """Test creating LLMResponse."""
        response = LLMResponse(content="Hello!")

        assert response.content == "Hello!"
        assert response.model == "claude-3-5-sonnet-20241022"
        assert response.usage == {}

    def test_creation_with_all_fields(self) -> None:
        """Test creating LLMResponse with all fields."""
        response = LLMResponse(
            content="Hello!",
            model="custom-model",
            usage={"tokens": 100}
        )

        assert response.content == "Hello!"
        assert response.model == "custom-model"
        assert response.usage == {"tokens": 100}
