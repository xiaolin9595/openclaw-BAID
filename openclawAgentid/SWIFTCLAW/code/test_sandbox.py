#!/usr/bin/env python3
"""Bash 沙箱功能测试脚本"""

import asyncio
from tools.bash import BashTool


def print_result(test_name: str, result: dict) -> None:
    """打印测试结果"""
    print(f"\n{'='*50}")
    print(f"测试: {test_name}")
    print(f"{'='*50}")
    print(f"  成功: {result['success']}")
    print(f"  退出码: {result['exit_code']}")
    print(f"  执行时间: {result.get('execution_time', 'N/A')}s")
    if result.get('stdout'):
        print(f"  STDOUT:\n{result['stdout'][:500]}")
    if result.get('stderr'):
        print(f"  STDERR: {result['stderr'][:200]}")
    if result.get('error'):
        print(f"  ❌ 错误: {result['error']}")


async def test_sandbox() -> None:
    """运行所有沙箱测试"""
    tool = BashTool()

    print("🧪 SwiftClaw Bash 沙箱测试")
    print("=" * 50)

    # 测试1: 正常命令
    result = await tool.execute(command="ls -la /workspace", working_dir=".")
    print_result("正常命令 (ls -la)", result)

    # 测试2: 危险命令 - 删除根目录
    result = await tool.execute(command="rm -rf /")
    print_result("危险命令拦截 (rm -rf /)", result)

    # 测试3: 危险命令 - Fork bomb
    result = await tool.execute(command=":(){ :|:& };")
    print_result("危险命令拦截 (Fork bomb)", result)

    # 测试4: 格式化磁盘
    result = await tool.execute(command="mkfs.ext4 /dev/sda1")
    print_result("危险命令拦截 (mkfs)", result)

    # 测试5: 网络隔离（如果 Docker 可用）
    result = await tool.execute(command="curl -s https://www.google.com")
    print_result("网络隔离测试 (curl)", result)
    if not result['success'] and 'Docker' in result.get('error', ''):
        print("  ℹ️  提示: Docker 未配置，请参考 setup_docker.sh")

    # 测试6: 超时控制
    result = await tool.execute(command="sleep 60", timeout=2)
    print_result("超时控制测试 (sleep 60, timeout=2s)", result)

    # 测试7: 资源限制（如果 Docker 可用）
    result = await tool.execute(command="cat /proc/meminfo | grep MemTotal")
    print_result("内存信息查看", result)

    # 测试8: 工作目录限制
    result = await tool.execute(command="ls /etc", working_dir=".")
    print_result("工作目录限制测试", result)

    print("\n" + "=" * 50)
    print("测试完成!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(test_sandbox())
