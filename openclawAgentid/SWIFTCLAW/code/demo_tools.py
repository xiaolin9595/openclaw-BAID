"""SwiftClaw Agent 工具调用演示脚本.

演示如何使用 PydanticAI 的 Agent 调用各种工具。
"""

import asyncio
import os
from pathlib import Path

# 设置测试环境变量（如果没有配置）
os.environ.setdefault("MOONSHOT_API_KEY", "sk-test-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("TAVILY_API_KEY", "tvly-test-key")

from agent.llm import SwiftClawAgent, AgentDependencies
from agent.tools import (
    file_read,
    file_write,
    file_list,
    bash_execute,
    web_search,
)
from config import get_settings


async def demo_direct_tools():
    """演示直接调用工具函数."""
    print("=" * 60)
    print("演示 1: 直接调用工具函数")
    print("=" * 60)

    settings = get_settings()
    deps = AgentDependencies(settings=settings)

    # 使用工作目录内的文件
    test_file = "test_swiftclaw_demo.txt"

    # 1. 文件写入
    print("\n📄 1. 写入文件...")
    result = await file_write(
        None,
        path=test_file,
        content="Hello from SwiftClaw!\n这是一个测试文件。\n"
    )
    print(f"   结果: {result}")

    # 2. 文件读取
    print("\n📖 2. 读取文件...")
    content = await file_read(None, path=test_file)
    print(f"   内容:\n{content}")

    # 3. 列出目录
    print("\n📁 3. 列出当前目录...")
    dir_list = await file_list(None, directory=".")
    print(f"   {dir_list[:800]}...")  # 只显示前800字符

    # 4. Bash 执行（简单的命令）
    print("\n💻 4. 执行 Bash 命令...")
    # 注意：需要 Docker 环境才能运行
    # bash_result = await bash_execute(None, command="echo 'Hello from Docker!'")
    # print(f"   结果: {bash_result}")
    print("   [跳过] 需要 Docker 环境")

    # 5. 网络搜索（需要真实 API key）
    print("\n🔍 5. 网络搜索...")
    if settings.tavily_api_key and not settings.tavily_api_key.startswith("tvly-test"):
        search_result = await web_search(None, query="Python 3.12 新特性", count=3)
        print(f"   结果:\n{search_result}")
    else:
        print("   [跳过] 需要有效的 TAVILY_API_KEY")

    # 清理测试文件
    if os.path.exists(test_file):
        os.remove(test_file)
        print(f"\n🗑️  已清理测试文件: {test_file}")


async def demo_agent_with_tools():
    """演示通过 Agent 自动调用工具."""
    print("\n" + "=" * 60)
    print("演示 2: 通过 Agent 自动调用工具")
    print("=" * 60)

    print("\n⚠️  注意: 以下演示需要真实的 Moonshot API key")
    print("   请确保 .env 文件中配置了有效的 MOONSHOT_API_KEY\n")

    settings = get_settings()

    # 检查是否是测试 key
    if settings.moonshot_api_key.startswith("sk-test"):
        print("❌ 当前使用的是测试 API key，跳过 Agent 演示")
        print("   请设置真实的 MOONSHOT_API_KEY 后重试\n")
        return

    # 创建 Agent
    agent = SwiftClawAgent(settings=settings)

    # 示例 1: 让 Agent 读取文件
    print("\n📝 示例 1: Agent 读取文件")
    print("-" * 40)
    try:
        test_file_path = Path("test_swiftclaw_demo.txt").resolve()
        # 先创建文件
        test_file_path.write_text("这是给 Agent 读取的测试文件内容。\nHello SwiftClaw!")

        result = await agent.run(f"请读取文件 {test_file_path}")
        print(f"Agent 回复:\n{result.data}")

        # 清理
        test_file_path.unlink()
    except Exception as e:
        print(f"错误: {e}")

    # 示例 2: 让 Agent 列出目录
    print("\n📝 示例 2: Agent 列出目录")
    print("-" * 40)
    try:
        result = await agent.run("请列出当前目录下的所有 Python 文件")
        print(f"Agent 回复:\n{result.data}")
    except Exception as e:
        print(f"错误: {e}")

    # 示例 3: 流式输出
    print("\n📝 示例 3: 流式输出")
    print("-" * 40)
    try:
        print("Agent 回复: ", end="", flush=True)
        async for chunk in agent.run_stream("你好，请做个自我介绍"):
            print(chunk, end="", flush=True)
        print()  # 换行
    except Exception as e:
        print(f"错误: {e}")


async def demo_legacy_interface():
    """演示向后兼容的 LLMClient 接口."""
    print("\n" + "=" * 60)
    print("演示 3: 向后兼容的 LLMClient 接口")
    print("=" * 60)

    settings = get_settings()

    if settings.moonshot_api_key.startswith("sk-test"):
        print("❌ 当前使用的是测试 API key，跳过演示\n")
        return

    from agent.llm import LLMClient

    client = LLMClient(settings=settings)

    print("\n📝 使用 LLMClient.complete()")
    print("-" * 40)
    try:
        response = await client.complete([
            {"role": "user", "content": "你好，请简短介绍自己"}
        ])
        print(f"回复: {response.content}")
        print(f"模型: {response.model}")
    except Exception as e:
        print(f"错误: {e}")


async def main():
    """主函数."""
    print("\n" + "=" * 60)
    print("🚀 SwiftClaw PydanticAI 工具调用演示")
    print("=" * 60)

    # 演示 1: 直接调用工具
    await demo_direct_tools()

    # 演示 2: 通过 Agent 调用
    await demo_agent_with_tools()

    # 演示 3: 向后兼容接口
    await demo_legacy_interface()

    print("\n" + "=" * 60)
    print("✅ 演示完成!")
    print("=" * 60)

    print("\n💡 提示:")
    print("   1. 要测试完整功能，请在 .env 中配置真实的 API keys")
    print("   2. 运行 Telegram Bot: python main.py")
    print("   3. 查看源码了解实现细节: agent/llm.py, agent/tools.py")


if __name__ == "__main__":
    asyncio.run(main())
