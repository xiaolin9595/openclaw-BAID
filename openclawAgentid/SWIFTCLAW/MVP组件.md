# MVP 项目组件推荐

基于 OpenClaw 项目的 MVP 架构，以下是各模块需要的组件及推荐的开源方案。

---

## 技术栈

**Python** - 快速验证、AI 原生，开发速度快，LLM 库成熟
**开发工具** - Claude Code + superpowers 插件
**开发模式** - SDD (Spec-Driven Development) + TDD (Test-Driven Development)

---

## 各模块组件需求与推荐

### 1. Gateway（网关服务器）

**需要的功能**：WebSocket 服务、HTTP API、路由、中间件

| 组件 | 推荐 |
|------|------|
| **首选** | [`fastapi`](https://github.com/tiangolo/fastapi) + [`websockets`](https://github.com/python-websockets/websockets) |
| **备选** | [`flask`](https://github.com/pallets/flask) + [`flask-socketio`](https://github.com/miguelgrinberg/flask-socketio) |

**推荐选择**：`fastapi`（自动生成文档，类型提示友好）

---

### 2. Telegram 通道

**需要的功能**：Bot API 封装、Webhook/长轮询、消息解析

| 组件 | 推荐 |
|------|------|
| **首选** | [`python-telegram-bot`](https://github.com/python-telegram-bot/python-telegram-bot) |
| **备选** | [`aiogram`](https://github.com/aiogram/aiogram) |

**推荐**：`python-telegram-bot`（最成熟，文档最全）

---

### 3. Agent 运行时（LLM 调用）

**需要的功能**：多模型支持、流式输出、工具调用、重试机制

| 组件 | 说明 |
|------|------|
| **首选** | [`pydantic-ai`](https://github.com/pydantic/pydantic-ai)（强烈推荐）|
| **备选** | OpenAI SDK（PydanticAI 内部使用）|
| **原始接口** | [`openai-python`](https://github.com/openai/openai-python) |

**推荐**：`pydantic-ai`（类型安全、原生工具调用、Pydantic 团队出品）

```python
from pydantic_ai import Agent
from pydantic_ai.models.anthropic import AnthropicModel

# Anthropic Claude 配置（推荐）
model = AnthropicModel(
    'claude-3-5-sonnet-20241022',
    api_key='your-anthropic-api-key'
)

agent = Agent(model)

# 运行 Agent
result = await agent.run('Hello!')
print(result.data)
```

**Moonshot 备选配置**：

```python
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

# Moonshot API 配置
provider = OpenAIProvider(
    base_url='https://api.moonshot.cn/v1',
    api_key='your-moonshot-api-key'
)
model = OpenAIModel('moonshot-v1-8k', provider=provider)
```

agent = Agent(model)

# 运行 Agent
result = await agent.run('Hello!')
print(result.data)
```

**工具调用示例**：

```python
from pydantic_ai import Agent, RunContext

# 注册工具
@agent.tool
def search(ctx: RunContext, query: str) -> str:
    """搜索工具"""
    return f"搜索结果: {query}"

# Agent 会自动决定是否调用工具
result = await agent.run('搜索 Python 教程')
```

---

### 4. 工具系统（文件、Bash）

**需要的功能**：文件读写、命令执行、权限控制

#### 文件操作
| 组件 | 说明 |
|------|------|
| **Python 内置** | `pathlib` + `aiofiles`（异步文件）|

#### Bash 执行
| 组件 | 说明 |
|------|------|
| **内置** | [`subprocess`](https://docs.python.org/3/library/subprocess.html) |
| **高级** | [`sh`](https://github.com/amoffat/sh) |

**推荐**：内置 `subprocess` 足够

#### 权限控制（沙箱）
| 组件 | 说明 |
|------|------|
| [`docker-py`](https://github.com/docker/docker-py) | Docker SDK |
| [`firejail`](https://github.com/netblue30/firejail) | Linux 沙箱（无需 Docker）|

**MVP 建议**：前期不用 Docker，先用**目录限制 + 超时 + 危险命令黑名单**。

---

### 5. 浏览器自动化

**需要的功能**：Chrome 控制、截图、点击、提取内容

| 组件 | 说明 |
|------|------|
| **首选** | [`playwright`](https://github.com/microsoft/playwright) |

**推荐**：`playwright`（Microsoft 出品，支持多浏览器）

---

### 6. 联网搜索

**需要的功能**：搜索 API 调用、结果解析

| 组件 | 说明 | 成本 |
|------|------|------|
| **Tavily** | 专为 AI 优化 | 1000次/月免费 |
| **Brave Search API** | 直接 HTTP 调用，无需 SDK | 1500次/月免费 |
| **DuckDuckGo** | [`duckduckgo-search`](https://github.com/deedy5/duckduckgo-search) | 免费但有限制 |

**推荐**：MVP 阶段直接用 **Tavily API**（已集成）。

---

### 7. 配置管理

**需要的功能**：环境变量、配置文件、Secret 管理

| 组件 | 说明 |
|------|------|
| **Python**: [`pydantic-settings`](https://github.com/pydantic/pydantic-settings) | 自动加载 .env，类型安全 |
| **备选**: [`python-dotenv`](https://github.com/theskumar/python-dotenv) | 环境变量加载 |

---

### 8. 日志与监控（可选）

| 组件 | 说明 |
|------|------|
| **Python**: [`loguru`](https://github.com/Delgan/loguru) | 比内置 logging 好用 10 倍 |

---

### 9. 持久化记忆（推荐添加）

**需要的功能**：跨会话记住用户偏好、历史上下文、关键信息

#### 简单方案：JSON 文件存储（MVP 阶段足够）

```python
import json
from pathlib import Path
from typing import Any, Optional

class SimpleMemory:
    def __init__(self, user_id: str):
        self.file_path = Path(f"./memory/{user_id}.json")
        self.data: dict[str, Any] = {}

    async def load(self):
        try:
            if self.file_path.exists():
                self.data = json.loads(self.file_path.read_text(encoding='utf-8'))
        except Exception:
            pass  # 文件不存在或格式错误，使用空记忆

    async def save(self):
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_path.write_text(
            json.dumps(self.data, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    def set(self, key: str, value: Any):
        self.data[key] = value

    def get(self, key: str) -> Optional[Any]:
        return self.data.get(key)
```

#### 进阶方案：SQLite + 向量检索（需要语义搜索时）

| 组件 | 说明 |
|------|------|
| [`sqlite-vec`](https://github.com/asg017/sqlite-vec) | SQLite 向量扩展，本地嵌入向量检索 |

**使用场景**：
- **简单 JSON**：用户偏好（"我喜欢简洁回答"）、待办事项、关键事实
- **SQLite+向量**：需要语义检索的长期记忆（"上周我提到过的那个项目"）

**MVP 建议**：先用 JSON 文件方案，一行依赖都不用加。等需要语义搜索时再升级到 SQLite。

---

### 10. 开发工具链（Claude Code + superpowers）

**需要的功能**：AI 辅助编程、规范化开发流程、代码质量保证

| 组件 | 说明 |
|------|------|
| **Claude Code** | 主要开发工具，通过 CLI 进行代码编写、调试和重构 |
| **superpowers** | Claude Code 的规范化开发插件系统 |

#### superpowers 核心 Skill

| Skill | 用途 |
|-------|------|
| `superpowers:brainstorming` | 任何创造性工作前的结构化头脑风暴 |
| `superpowers:writing-plans` | 多步骤任务的计划编写 |
| `superpowers:executing-plans` | 执行已编写的计划 |
| `superpowers:test-driven-development` | 测试驱动开发 |
| `superpowers:systematic-debugging` | 系统化调试 |
| `superpowers:verification-before-completion` | 完成前的验证检查 |
| `superpowers:requesting-code-review` | 代码审查请求 |
| `superpowers:using-git-worktrees` | Git 工作树管理 |

#### SDD + TDD 开发流程

Spec-Driven Development（规格驱动开发）+ Test-Driven Development（测试驱动开发）

```
新功能/需求
    ↓
调用 superpowers:brainstorming
    ↓
生成规格文档（Spec）
    ↓
调用 superpowers:writing-plans
    ↓
编写详细实施计划（Plan）
    ↓
调用 superpowers:test-driven-development
    ↓
编写测试 → 编写实现 → 运行验证
    ↓
调用 superpowers:verification-before-completion
    ↓
提交/合并
```

---

## 推荐的 MVP 技术组合

```txt
fastapi
uvicorn[standard]
websockets
python-telegram-bot
pydantic-ai
playwright
python-dotenv
pydantic-settings
loguru
tavily-python
```

---

## 最简依赖清单

| 功能 | 最小依赖 |
|------|----------|
| 服务器 | `fastapi`, `uvicorn` |
| Telegram | `python-telegram-bot` |
| LLM | `pydantic-ai` |
| 浏览器 | `playwright` |
| 执行命令 | 内置 `subprocess` |
| 配置 | `python-dotenv` |
| 持久化记忆 | 内置 `json` / `sqlite3` |
| 开发工具 | Claude Code + superpowers |

**总共**：Python 7 个包即可跑起来（不含记忆则用内置模块）。

---

## MVP 与完整 OpenClaw 的功能对比

这个 MVP 版本相比完整的 OpenClaw 平台，主要缺少以下功能模块：

### 1. 消息通道（Channels）

| MVP | 完整 OpenClaw |
|-----|---------------|
| 仅 Telegram | Discord, Slack, Signal, iMessage, WhatsApp, Teams, Matrix, Zalo, Line, IRC, Twitch, Google Chat, Feishu 等 **20+ 通道** |

### 2. LLM 提供商支持

| MVP | 完整 OpenClaw |
|-----|---------------|
| **Moonshot** 为主，pydantic-ai 可切换 | Anthropic, Azure, Google, Groq, DeepSeek, Mistral,, Ollama, HuggingFace, xAI, Perplexity, 火山引擎, 百度千帆等 **30+ 提供商** |

### 3. 语音与媒体能力

| MVP | 完整 OpenClaw |
|-----|---------------|
| 无 | Deepgram (语音识别), ElevenLabs (语音合成), FAL (图像生成), 语音通话插件 |

### 4. 记忆与上下文

| MVP | 完整 OpenClaw |
|-----|---------------|
| **JSON 文件持久化**（用户偏好、关键事实）| `memory-core`, `memory-lancedb` - 向量语义检索、跨会话长期记忆 |

### 5. 客户端生态

| MVP | 完整 OpenClaw |
|-----|---------------|
| 仅服务端 | **iOS, Android, macOS, Web** 多平台原生应用 |

### 6. 插件系统架构

| MVP | 完整 OpenClaw |
|-----|---------------|
| 内置固定组件 | **完整插件 SDK** - 可热插拔的扩展机制，80+ 官方插件 |

### 7. 其他高级功能

- **代码差异分析** (`diffs` 插件)
- **诊断与可观测性** (OpenTelemetry)
- **GitHub Copilot 集成**
- **多租户/工作区隔离**
- **Canvas/A2UI 可视化交互界面**

**一句话总结**：MVP 是一个"能跑通 Telegram + Moonshot + 基础工具 + Claude Code 规范化开发"的最小闭环；OpenClaw 是面向生产环境的**多通道、多模型、有记忆、有客户端、可扩展**的完整平台。
