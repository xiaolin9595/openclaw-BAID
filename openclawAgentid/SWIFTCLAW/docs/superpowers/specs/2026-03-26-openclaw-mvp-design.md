# swiftclaw  - 软件设计文档 (SDD)

**版本**: 1.0
**日期**: 2026-03-26
**状态**: 草案

---

## 1. 概述与目标

### 1.1 项目定位

swiftclaw  是一个个人 AI 助手平台的最小可行产品，用户通过 Telegram 与 AI 助手交互，助手可以调用多种工具（文件操作、Bash 执行、浏览器自动化、联网搜索）来帮助用户完成任务。

### 1.2 核心目标

- 验证 AI 助手与工具调用的集成模式
- 建立可扩展的架构基础
- 为后续完整 swiftclaw 平台积累技术经验

### 1.3 用户场景

个人用户通过 Telegram 与专属 AI 助手对话，助手能够理解上下文、记住用户偏好，并安全地执行各种任务。

---

## 2. 系统架构

### 2.1 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      用户 (Telegram)                     │
└────────────────────┬────────────────────────────────────┘
                     │ Webhook/Long Polling
                     ▼
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Gateway    │  │   Telegram   │  │    Agent     │  │
│  │   (FastAPI)  │◄─┤   Channel    │◄─┤   Runtime    │  │
│  │              │  │              │  │              │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  │
│         │                                    │          │
│         │         ┌──────────────────────────┘          │
│         │         │                                   │
│         ▼         ▼                                   │
│  ┌────────────────────────────────┐                   │
│  │         工具系统 (Tools)        │                   │
│  ├────────┬────────┬──────────────┤                   │
│  │ 文件   │  Bash  │   浏览器     │  搜索            │
│  │ 操作   │ 执行   │              │  (Tavily API)    │
│  └────┬───┴────┬───┴───────┬──────┘                   │
│       │        │           │                          │
│       ▼        ▼           ▼                          │
│  ┌────────────────────────────────┐                   │
│  │      Docker 沙箱 (隔离执行)      │                   │
│  └────────────────────────────────┘                   │
│                        │                              │
│                        ▼                              │
│  ┌────────────────────────────────┐                   │
│  │   持久化记忆 (SQLite + sqlite-vec)│                 │
│  │   - 用户偏好                     │                   │
│  │   - 对话历史                     │                   │
│  │   - 语义检索                     │                   │
│  └────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

1. **用户**通过 Telegram 发送消息
2. **Gateway** 接收 Webhook 请求，路由到 Telegram Channel
3. **Telegram Channel** 解析消息，构建上下文，调用 Agent Runtime
4. **Agent Runtime** (PydanticAI) 调用 LLM，处理流式响应
5. 如需要工具调用，LLM 返回 tool_call，Agent Runtime 调用 **工具系统**
6. **工具系统** 在 **Docker 沙箱** 中安全执行命令
7. 工具执行结果返回给 Agent，继续对话
8. **持久化记忆** 存储和检索用户偏好、历史上下文

---

## 3. 技术栈选择

**选定方案：Python**

| 模块 | 组件 | 理由 |
|------|------|------|
| **Gateway** | FastAPI + uvicorn + websockets | 现代、快速、自动生成文档 |
| **Telegram** | python-telegram-bot | 最成熟，文档最全 |
| **Agent运行时** | PydanticAI | 一行代码切换模型（OpenAI/Claude/Gemini）|
| **浏览器** | playwright | Microsoft 出品，多浏览器支持 |
| **配置** | pydantic-settings | 自动加载 .env，类型安全 |
| **日志** | loguru | 比内置 logging 好用 10 倍 |
| **向量检索** | sqlite-vec | 本地嵌入向量检索，零外部依赖 |
| **沙箱** | docker-py | Docker SDK for Python |

---

## 4. 各模块详细设计

### 4.1 Gateway (FastAPI)

**职责**：HTTP 服务器，接收 Telegram Webhook，管理生命周期

**核心端点**：

```python
@app.post("/webhook/{bot_token}")
async def telegram_webhook(update: Update): ...

@app.get("/health")
async def health_check(): ...
```

**配置**：
- Webhook 模式：生产环境
- Long Polling 模式：本地开发

### 4.2 Telegram Channel

**职责**：Bot API 封装、消息格式转换、用户会话管理

**关键功能**：
- 接收并解析 Telegram Update
- 构建 Message 对象（包含用户ID、聊天ID、文本、附件）
- 调用 Agent Runtime 处理消息
- 发送回复（支持 Markdown、流式打字机效果）
- 处理回调按钮（如工具调用确认）

### 4.3 Agent Runtime (LiteLLM)

**职责**：LLM 调用、工具定义、流式输出处理

**工具定义**：

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "file_read",
            "description": "读取文件内容",
            "parameters": {...}
        }
    },
    # file_write, bash_execute, browser_navigate,
    # browser_click, browser_screenshot, web_search
]
```

**特性**：
- 支持多模型（通过环境变量配置）
- 流式输出到 Telegram
- 工具调用循环处理

### 4.4 工具系统 + Docker 沙箱

**架构**：

```
┌─────────────────────────────────────────┐
│           工具系统 (Tool System)         │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ FileOps │ │ BashOps │ │ BrowserOps│ │
│  └────┬────┘ └────┬────┘ └─────┬─────┘ │
│       └─────────────┬─────────────┘     │
│                     ▼                   │
│  ┌─────────────────────────────────────┐│
│  │     Docker 沙箱管理器                ││
│  │  - 为每个用户创建隔离容器             ││
│  │  - 限制资源 (CPU/内存/网络)           ││
│  │  - 只读挂载工作目录                   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**沙箱策略**：
- 每个用户有独立的 Docker 容器
- 容器内只读挂载宿主机的 `workspace/` 目录
- 禁止访问宿主机其他目录
- 网络限制：只允许出站 HTTPS
- 超时控制：命令执行最长 30 秒

### 4.5 持久化记忆 (SQLite + sqlite-vec)

**数据模型**：

```sql
-- 用户表
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    preferences TEXT,  -- JSON
    created_at TIMESTAMP
);

-- 消息历史
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    role TEXT,  -- user/assistant/tool
    content TEXT,
    timestamp TIMESTAMP
);

-- 向量记忆（语义检索）
CREATE VIRTUAL TABLE memory_vectors USING vec0(
    memory_id INTEGER PRIMARY KEY,
    embedding FLOAT[1536],
    content TEXT,
    metadata TEXT  -- JSON
);
```

**功能**：
- 存储用户偏好（"我喜欢简洁回答"）
- 保留最近 N 条对话历史作为上下文
- 语义检索长期记忆（"上周提到的项目"）

---

## 5. 接口定义

### 5.1 模块间接口

```python
# Gateway -> Telegram Channel
class Channel(ABC):
    @abstractmethod
    async def handle_update(self, update: dict) -> None: ...

# Telegram Channel -> Agent Runtime
class AgentRuntime(ABC):
    @abstractmethod
    async def process_message(
        self,
        message: Message,
        context: List[Message]
    ) -> AsyncIterator[str]: ...

# Agent Runtime -> Tool System
class ToolExecutor(ABC):
    @abstractmethod
    async def execute(
        self,
        tool_name: str,
        params: dict,
        user_id: str
    ) -> ToolResult: ...
```

### 5.2 外部 API 集成

| 服务 | 用途 | 认证方式 |
|------|------|---------|
| Telegram Bot API | 消息收发 | Bot Token |
| OpenAI API | LLM 调用 | API Key |
| Tavily Search API | 联网搜索 | API Key |

---

## 6. 数据模型

### 6.1 核心实体

```python
class User(BaseModel):
    user_id: str  # Telegram user_id
    preferences: dict = {}
    workspace_path: str  # Docker 挂载点

class Message(BaseModel):
    id: str
    user_id: str
    role: Literal["user", "assistant", "tool"]
    content: str
    tool_calls: Optional[List[ToolCall]]
    timestamp: datetime

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict

class ToolResult(BaseModel):
    tool_call_id: str
    output: str
    error: Optional[str]
```

---

## 7. 部署与配置

### 7.1 本地开发部署

**目录结构**：

```
openclaw-mvp/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── src/
│   ├── main.py
│   ├── gateway/
│   ├── channels/
│   ├── agent/
│   ├── tools/
│   └── memory/
├── workspace/          # 用户工作目录（挂载到沙箱）
└── data/               # SQLite 数据库
```

**启动步骤**：

```bash
# 1. 克隆代码
git clone <repo>

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 TELEGRAM_BOT_TOKEN, OPENAI_API_KEY 等

# 3. 启动服务
docker-compose up -d
```

### 7.2 配置项

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# LLM
OPENAI_API_KEY=your_key
# 或 CLAUDE_API_KEY=your_key
DEFAULT_MODEL=gpt-4o-mini

# 搜索
BRAVE_API_KEY=your_key

# 沙箱
DOCKER_WORKSPACE_PATH=./workspace
MAX_CONTAINER_MEMORY=512m

# 记忆
SQLITE_DB_PATH=./data/memory.db
MAX_CONTEXT_MESSAGES=20
```

---

## 8. 依赖清单

### 8.1 Python 依赖

```txt
# Web 框架
fastapi
uvicorn[standard]
websockets

# Telegram
python-telegram-bot

# LLM
PydanticAI

# 浏览器
playwright

# 配置与日志
pydantic-settings
loguru

# 向量检索
sqlite-vec

# Docker 沙箱
docker

# 其他
aiofiles
python-dotenv
```

### 8.2 系统依赖

- Docker Engine
- Python 3.11+
- Playwright browsers: `playwright install chromium`

---

## 9. 风险评估与限制

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Docker 沙箱配置复杂 | 高 | 提供预配置 docker-compose，详细文档 |
| SQLite 向量性能瓶颈 | 中 | 用户量小时无问题，后续可迁移到 LanceDB |
| Playwright 资源消耗 | 中 | 限制并发浏览器实例，超时控制 |

### 9.2 MVP 限制

| 功能 | MVP 状态 | 完整版 |
|------|---------|--------|
| 通道 | 仅 Telegram | 20+ 通道 |
| LLM 提供商 | 单一 | 30+ 提供商 |
| 记忆 | SQLite 本地 | 云端向量数据库 |
| 部署 | 本地 Docker | K8s/Serverless |
| 多用户隔离 | 基础 | 企业级隔离 |

### 9.3 安全注意事项

- **Docker 沙箱逃逸风险**：定期更新 Docker，遵循安全最佳实践
- **API 密钥管理**：使用 .env 文件，绝不提交到代码仓库
- **用户输入验证**：严格验证所有工具参数，防止注入攻击

---

## 10. 决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 技术栈 | Node/TS vs Python | Python | 快速开发 |
| 沙箱策略 | 白名单 vs Docker | Docker | 完全隔离，更安全 |
| 持久化 | JSON vs SQLite | SQLite + 向量 | 支持语义检索 |
| 部署方式 | 本地 vs 云端 | 本地 | 个人使用，数据隐私 |

---

*文档结束*
