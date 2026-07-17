# SwiftClaw 本地代理使用说明

## 功能概述

本地代理让你可以在 Telegram 中控制你的 Windows 电脑：

1. **创建文件**：Bot 在你的电脑 D 盘创建 Python 文件
2. **VSCode 打开**：自动用 VSCode 打开文件
3. **运行 Python**：执行 Python 文件并返回结果

---

## 文件说明

```
swiftclaw-local/
├── local_browser.py      # 本地代理主程序（FastAPI 服务）
├── start_proxy.bat       # 一键启动脚本
└── README.md            # 本说明文档
```

---

## 安装步骤

### 1. 安装 Python

- 下载：https://www.python.org/downloads/
- **安装时务必勾选 "Add Python to PATH"**

验证安装：
```cmd
python --version
```

### 2. 复制文件到 Windows

将 `swiftclaw-local` 文件夹复制到你的电脑，例如：
```
D:\swiftclaw-local\
```

### 3. 启动本地代理

**方法1：双击运行（推荐）**
```
双击 start_proxy.bat
```

**方法2：命令行启动**
```cmd
cd D:\swiftclaw-local
pip install fastapi uvicorn
python local_browser.py
```

---

## 配置 Bot

### 如果 Bot 和本地代理在同一台电脑

编辑 `.env`：
```env
LOCAL_BROWSER_PROXY=http://127.0.0.1:8790
```

### 如果 Bot 在远程服务器

1. 安装 ngrok：https://ngrok.com/download
2. 注册并获取 authtoken
3. 配置 ngrok：
   ```cmd
   ngrok config add-authtoken YOUR_TOKEN
   ```
4. 启动代理时会自动启动 ngrok
5. 在 ngrok 窗口找到公网地址（如 `https://abc123.ngrok-free.app`）
6. 编辑服务器上的 `.env`：
   ```env
   LOCAL_BROWSER_PROXY=https://abc123.ngrok-free.app
   ```

### 重启 Bot

```bash
kill 3138817  # 替换为实际的进程号
python main.py
```

---

## 使用示例

在 Telegram 中与 Bot 对话：

### 1. 创建 Python 文件

```
你：在本地 D:\project\test.py 创建一个打印"Hello World"的Python文件

Bot：我来帮你创建这个文件
[调用 file_write 工具，文件保存到你的 D 盘]

结果：文件已保存到 D:\project\test.py
```

### 2. 用 VSCode 打开

```
你：用 VSCode 打开 D:\project\test.py

Bot：正在用 VSCode 打开...
[调用 local_execute 执行 code D:\project\test.py]

结果：VSCode 自动打开 test.py
```

### 3. 运行 Python 文件

```
你：运行 D:\project\test.py

Bot：正在运行...
[调用 local_execute 执行 python D:\project\test.py]

结果：
STDOUT:
Hello World

命令执行成功 (退出码: 0)
```

---

## 支持的命令

| 命令 | 说明 |
|------|------|
| `code <路径>` | 用 VSCode 打开文件 |
| `python <路径>` | 运行 Python 文件 |
| `notepad <路径>` | 用记事本打开 |
| `cmd /c <命令>` | 执行任意 Windows 命令 |

---

## 故障排查

### 问题1：双击 start_proxy.bat 闪退

**解决**：使用命令行启动查看错误：
```cmd
cd D:\swiftclaw-local
start_proxy.bat
```

或直接用 Python 启动：
```cmd
cd D:\swiftclaw-local
python local_browser.py
```

### 问题2：VSCode 命令找不到

**解决**：确保 VSCode 已添加到 PATH
```cmd
where code
```

如果显示 "找不到文件"，需要：
1. 打开 VSCode
2. 按 `Ctrl+Shift+P`
3. 输入 "Shell Command: Install 'code' command in PATH"
4. 重启命令行窗口

### 问题3：Bot 提示 "未配置本地浏览器代理"

**解决**：检查服务器 `.env` 文件：
```bash
ssh 你的服务器
cat /home/ypp/projects/swiftclaw/.worktrees/phase1-core/.env | grep LOCAL_BROWSER_PROXY
```

确保地址正确，且代理正在运行。

---

## 注意事项

1. **安全**：本地代理会执行你发送的命令，请确保 Bot 只有你一个人使用
2. **路径**：Windows 路径使用双反斜杠 `D:\project\test.py` 或正斜杠 `D:/project/test.py`
3. **端口**：默认使用 8790 端口，如果被占用可以修改 local_browser.py 最后一行

---

## 更新日志

- 2024-03-30：添加文件写入和命令执行功能
