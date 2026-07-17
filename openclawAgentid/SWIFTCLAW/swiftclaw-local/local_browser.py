"""本地浏览器代理 - 在用户的 Windows/Mac 电脑上运行

功能：
1. 打开浏览器访问网页
2. 写入文件到本地（如 D:\project\hello.py）
3. 执行本地命令（如用 VSCode 打开文件、运行 Python）
"""

import subprocess
import platform
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="SwiftClaw Local Proxy")


@app.post("/open")
async def open_browser(request: Request, url: str | None = None):
    """在本地默认浏览器中打开 URL"""
    try:
        if not url:
            payload = await request.json()
            url = payload.get("url")

        if not url:
            return {"success": False, "error": "url is required"}

        system = platform.system()

        if system == "Windows":
            subprocess.Popen(["start", "", url], shell=True)
        elif system == "Darwin":
            subprocess.Popen(["open", url])
        else:
            subprocess.Popen(["xdg-open", url])

        return {"success": True, "message": f"已在本地浏览器打开: {url}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/file_write")
async def file_write(request: Request):
    """在本地电脑写入文件

    示例：
    {
        "path": "D:\\project\\hello.py",
        "content": "print('Hello World')"
    }
    """
    try:
        payload = await request.json()
        path = payload.get("path")
        content = payload.get("content", "")

        if not path:
            return {"success": False, "error": "path is required"}

        # 解析路径
        file_path = Path(path).expanduser().resolve()

        # 创建父目录
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # 写入文件
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return {"success": True, "message": f"文件已保存: {file_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/execute")
async def execute_command(request: Request):
    """在本地电脑执行命令

    示例：
    {
        "command": "code D:\\project\\hello.py",
        "working_dir": "D:\\project",
        "timeout": 30
    }

    支持的命令：
    - code <文件路径>        : 用 VSCode 打开文件
    - python <文件路径>      : 运行 Python 文件
    - notepad <文件路径>     : 用记事本打开
    - cmd /c <命令>          : 执行任意命令
    """
    try:
        payload = await request.json()
        command = payload.get("command")
        working_dir = payload.get("working_dir")
        timeout = payload.get("timeout", 30)

        if not command:
            return {"success": False, "error": "command is required"}

        system = platform.system()

        # 记录执行信息
        print(f"[执行命令] {command}")
        if working_dir:
            print(f"[工作目录] {working_dir}")

        # 根据系统选择执行方式
        if system == "Windows":
            # Windows: 使用 cmd /c 执行
            # 处理路径中的特殊字符
            shell_cmd = f'cmd /c "{command}"'
            process = subprocess.Popen(
                shell_cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=working_dir,
                encoding="utf-8",
                errors="replace"
            )
        else:
            # macOS/Linux
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=working_dir
            )

        # 等待命令完成
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            return {
                "success": False,
                "error": f"命令执行超时 ({timeout}秒)",
                "exit_code": -1
            }

        return {
            "success": process.returncode == 0,
            "stdout": stdout[:5000] if stdout else "",  # 限制输出大小
            "stderr": stderr[:2000] if stderr else "",
            "exit_code": process.returncode,
            "platform": system
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok", "platform": platform.system()}


@app.post("/vscode_open_and_run")
async def vscode_open_and_run(request: Request):
    """用 VSCode 打开文件并在 VSCode 终端中运行 Python

    示例：
    {
        "path": "D:\\project\\hello.py",
        "timeout": 30
    }

    功能：
    1. 用 VSCode 打开文件
    2. 在 VSCode 内置终端中运行 Python（通过 VSCode CLI 命令）
    3. 返回运行结果
    """
    try:
        payload = await request.json()
        file_path = payload.get("path")
        timeout = payload.get("timeout", 30)

        if not file_path:
            return {"success": False, "error": "path is required"}

        system = platform.system()
        file_path_obj = Path(file_path).expanduser().resolve()
        working_dir = str(file_path_obj.parent)

        # Step 1: 用 VSCode 打开文件
        print(f"[1/2] 正在用 VSCode 打开: {file_path}")
        if system == "Windows":
            subprocess.Popen(f'code "{file_path}"', shell=True)
        else:
            subprocess.Popen(f'code "{file_path}"', shell=True)

        # 等待 VSCode 打开文件
        import time
        time.sleep(1)

        # Step 2: 在 VSCode 终端中运行 Python
        print(f"[2/2] 正在 VSCode 终端中运行: {file_path}")

        if system == "Windows":
            # 方法：使用 VSCode 的 CLI 在终端中执行命令
            # code --command workbench.action.terminal.new
            # 然后发送命令到终端

            # 先创建新终端
            subprocess.Popen(f'code --command workbench.action.terminal.new', shell=True)
            time.sleep(0.5)

            # 构建 Python 运行命令
            python_cmd = f'cd "{working_dir}" && python "{file_path}"'

            # 发送命令到终端（使用 VSCode 的 sendSequence 命令）
            import json
            args = json.dumps({"text": python_cmd + "\n"})
            send_cmd = f'code --command workbench.action.terminal.sendSequence --args "{args}"'
            subprocess.Popen(send_cmd, shell=True)

            # 同时在后台运行以获取输出返回给 Bot
            process = subprocess.Popen(
                f'python "{file_path}"',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=working_dir,
                encoding="utf-8",
                errors="replace"
            )
        else:
            # macOS/Linux
            subprocess.Popen(f'code --command workbench.action.terminal.new', shell=True)
            time.sleep(0.5)
            python_cmd = f'cd "{working_dir}" && python3 "{file_path}"'
            import json
            args = json.dumps({"text": python_cmd + "\n"})
            send_cmd = f'code --command workbench.action.terminal.sendSequence --args "{args}"'
            subprocess.Popen(send_cmd, shell=True)

            process = subprocess.Popen(
                f'python3 "{file_path}"',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=working_dir
            )

        # 等待运行完成以获取输出
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            return {
                "success": False,
                "error": f"Python 运行超时 ({timeout}秒)",
                "vscode_opened": True,
                "exit_code": -1
            }

        # 组合结果
        result_message = f"✅ VSCode 已打开: {file_path}\n"
        result_message += f"✅ 已在 VSCode 终端中执行 Python 命令\n\n"

        if stdout:
            result_message += f"📤 程序输出:\n{stdout}\n"
        if stderr:
            result_message += f"⚠️  错误信息:\n{stderr}\n"

        result_message += f"\n🔚 退出码: {process.returncode}"

        return {
            "success": process.returncode == 0,
            "message": result_message,
            "vscode_opened": True,
            "stdout": stdout[:5000] if stdout else "",
            "stderr": stderr[:2000] if stderr else "",
            "exit_code": process.returncode
        }

    except Exception as e:
        return {"success": False, "error": str(e), "vscode_opened": False}


if __name__ == "__main__":
    print("=" * 60)
    print(" SwiftClaw 本地代理已启动!")
    print("=" * 60)
    print("\n📍 本地地址: http://127.0.0.1:8790")
    print("\n📋 可用接口:")
    print("   POST /open         - 打开浏览器")
    print("   POST /file_write   - 写入文件")
    print("   POST /execute      - 执行命令（VSCode、Python等）")
    print("   GET  /health       - 健康检查")
    print("\n💡 使用示例:")
    print("   创建文件: POST /file_write")
    print('             {"path": "D:\\\\project\\\\test.py", "content": "print(1)"}')
    print("   VSCode打开: POST /execute")
    print('               {"command": "code D:\\\\project\\\\test.py"}')
    print("   运行Python: POST /execute")
    print('               {"command": "python D:\\\\project\\\\test.py"}')
    print("\n⚠️  注意: 如果 Bot 在服务器运行，需要使用 ngrok 暴露此服务")
    print("\n按 Ctrl+C 停止\n")

    uvicorn.run(app, host="127.0.0.1", port=8790)
