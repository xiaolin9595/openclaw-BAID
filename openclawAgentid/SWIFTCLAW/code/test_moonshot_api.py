"""测试标准 Moonshot API key."""

import asyncio
import os
from dotenv import load_dotenv

# 强制重新加载 .env
load_dotenv(override=True)

from agent.llm import SwiftClawAgent


async def test_moonshot_api():
    """测试 Moonshot API 调用."""
    print("=" * 60)
    print("🧪 测试标准 Moonshot API")
    print("=" * 60)

    from config import get_settings
    settings = get_settings()

    print(f"\nAPI Key: {settings.moonshot_api_key[:20]}...")
    print(f"Model: {settings.moonshot_model}")
    print(f"Anthropic Key: {'已配置' if settings.anthropic_api_key else '未配置'}")

    # 创建 Agent
    agent = SwiftClawAgent(settings=settings)

    # 测试 1: 简单对话
    print("\n📝 测试 1: 简单对话")
    print("-" * 40)
    try:
        result = await agent.run("你好，请简短介绍自己（30字以内）")
        # 从 AgentRunResult 获取文本
        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            text = result.response.text
        else:
            text = str(result)
        print(f"✅ 成功!")
        print(f"回复: {text}")
    except Exception as e:
        print(f"❌ 失败: {e}")

    # 测试 2: 文件工具
    print("\n📝 测试 2: Agent 使用文件工具")
    print("-" * 40)
    test_file = "moonshot_test.txt"
    with open(test_file, "w") as f:
        f.write("这是 Moonshot API 测试文件。\n测试时间: 2026-03-28")

    try:
        import os
        abs_path = os.path.abspath(test_file)
        result = await agent.run(f"请读取文件 {abs_path}，告诉我内容")
        # 从 AgentRunResult 获取文本
        if hasattr(result, 'response') and hasattr(result.response, 'text'):
            text = result.response.text
        else:
            text = str(result)
        print(f"✅ 成功!")
        print(f"回复: {text}")
    except Exception as e:
        print(f"❌ 失败: {e}")
    finally:
        if os.path.exists(test_file):
            os.remove(test_file)

    # 测试 3: 流式输出
    print("\n📝 测试 3: 流式输出")
    print("-" * 40)
    try:
        print("回复: ", end="", flush=True)
        async for chunk in agent.run_stream("用一句话赞美 Python"):
            print(chunk, end="", flush=True)
        print("\n✅ 成功!")
    except Exception as e:
        print(f"\n❌ 失败: {e}")


async def main():
    print("\n🚀 Moonshot API 测试")
    print("=" * 60)

    await test_moonshot_api()

    print("\n" + "=" * 60)
    print("✅ 测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
