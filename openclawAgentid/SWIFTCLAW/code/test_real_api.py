"""真实 API 调用测试 - 使用真实的 Moonshot 和 Tavily API keys."""

import asyncio
import os

# 确保使用 .env 中的配置，不设置默认值
from dotenv import load_dotenv
load_dotenv(override=True)

from agent.llm import SwiftClawAgent
from agent.tools import web_search


async def test_search():
    """测试 Tavily 搜索."""
    print("=" * 60)
    print("🔍 测试 Tavily 搜索")
    print("=" * 60)

    try:
        result = await web_search(None, query="Python 3.12 新特性", count=3)
        print(result[:1000])
        print("\n✅ 搜索成功!")
    except Exception as e:
        print(f"❌ 搜索失败: {e}")


async def test_agent():
    """测试 PydanticAI Agent."""
    print("\n" + "=" * 60)
    print("🤖 测试 PydanticAI Agent")
    print("=" * 60)

    from config import get_settings
    settings = get_settings()

    print(f"\n使用模型: {settings.moonshot_model}")
    print(f"API Key: {settings.moonshot_api_key[:25]}...\n")

    agent = SwiftClawAgent(settings=settings)

    # 测试 1: 简单对话
    print("\n📝 测试 1: 简单对话")
    print("-" * 40)
    try:
        result = await agent.run("你好，请简短介绍自己（50字以内）")
        print(f"Agent: {result.data}")
    except Exception as e:
        print(f"❌ 错误: {e}")

    # 测试 2: 文件操作
    print("\n📝 测试 2: Agent 使用文件工具")
    print("-" * 40)

    # 创建测试文件
    test_file = "agent_test_file.txt"
    with open(test_file, "w") as f:
        f.write("这是 Agent 测试文件的内容。\nSwiftClaw + PydanticAI 测试成功!")

    try:
        result = await agent.run(f"请读取文件 {os.path.abspath(test_file)}，并总结内容")
        print(f"Agent: {result.data}")
    except Exception as e:
        print(f"❌ 错误: {e}")
    finally:
        if os.path.exists(test_file):
            os.remove(test_file)

    # 测试 3: 流式输出
    print("\n📝 测试 3: 流式输出")
    print("-" * 40)
    try:
        print("Agent: ", end="", flush=True)
        async for chunk in agent.run_stream("用一句话描述 Python"):
            print(chunk, end="", flush=True)
        print()
    except Exception as e:
        print(f"❌ 错误: {e}")


async def main():
    print("\n🚀 SwiftClaw 真实 API 测试")
    print("=" * 60)

    # 测试搜索
    await test_search()

    # 测试 Agent
    await test_agent()

    print("\n" + "=" * 60)
    print("✅ 测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
