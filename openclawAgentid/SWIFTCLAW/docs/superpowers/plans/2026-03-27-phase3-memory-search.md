# swiftclaw Phase 3: 记忆系统与搜索实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task in parallel where possible.

**Goal:** 实现持久化记忆系统和联网搜索能力

**Architecture:** SQLite 数据库存储用户记忆，Tavily Search API 提供联网搜索

**Tech Stack:** Python 3.12+, aiosqlite, Tavily API

---

## 文件结构概览

| 文件 | 职责 |
|------|------|
| `memory/database.py` | SQLite 数据库连接和初始化 |
| `memory/store.py` | 记忆操作（增删改查） |
| `memory/models.py` | 数据模型（Pydantic） |
| `tools/search.py` | Tavily Search 工具 |
| `tests/unit/memory/test_*.py` | 记忆系统测试 |
| `tests/unit/tools/test_search.py` | 搜索工具测试 |

---

## 任务分解

### Task 1: SQLite 记忆系统 - 可并行

**描述**: 实现 SQLite 持久化存储，支持用户偏好、对话历史、关键事实

**Files:**
- Create: `memory/__init__.py`
- Create: `memory/database.py`
- Create: `memory/models.py`
- Create: `memory/store.py`
- Create: `tests/unit/memory/test_database.py`
- Create: `tests/unit/memory/test_store.py`

**数据库 Schema**:

```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    preferences TEXT  -- JSON 存储用户偏好
);

-- 对话历史表
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,  -- 'user' 或 'assistant'
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 关键记忆表（RAG 准备）
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,      -- 记忆关键词
    value TEXT NOT NULL,    -- 记忆内容
    importance INTEGER DEFAULT 1,  -- 重要性 1-5
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP,  -- 最后访问时间（用于 LRU）
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_conversations_user_time ON conversations(user_id, timestamp);
CREATE INDEX idx_memories_user_key ON memories(user_id, key);
```

**核心功能**:

```python
# memory/store.py
class MemoryStore:
    async def get_or_create_user(self, telegram_id: int) -> User:
        """获取或创建用户"""

    async def save_message(self, user_id: int, role: str, content: str, session_id: str = None):
        """保存对话消息"""

    async def get_conversation_history(self, user_id: int, limit: int = 10) -> list[Message]:
        """获取最近对话历史"""

    async def update_preferences(self, user_id: int, preferences: dict):
        """更新用户偏好"""

    async def get_preferences(self, user_id: int) -> dict:
        """获取用户偏好"""

    async def add_memory(self, user_id: int, key: str, value: str, importance: int = 1):
        """添加关键记忆"""

    async def get_memories(self, user_id: int, key_pattern: str = None) -> list[Memory]:
        """获取记忆，支持关键词匹配"""

    async def clear_session(self, user_id: int, session_id: str):
        """清空指定会话"""
```

**模型定义** (`memory/models.py`):

```python
from pydantic import BaseModel
from datetime import datetime

class User(BaseModel):
    id: int
    telegram_id: int
    created_at: datetime
    preferences: dict

class Message(BaseModel):
    id: int
    user_id: int
    role: str
    content: str
    timestamp: datetime
    session_id: str | None

class Memory(BaseModel):
    id: int
    user_id: int
    key: str
    value: str
    importance: int
    created_at: datetime
    accessed_at: datetime | None
```

---

### Task 2: Tavily Search 搜索工具 - 可并行

**描述**: 实现 Tavily API 集成，提供联网搜索能力

**Files:**
- Create: `tools/search.py`
- Create: `tests/unit/tools/test_search.py`

**功能规格**:

```python
class SearchTool(Tool):
    """Tavily Search 工具"""

    async def search(
        self,
        query: str,
        count: int = 5,
        offset: int = 0
    ) -> dict:
        """
        执行搜索

        Returns:
            {
                "success": True/False,
                "query": str,
                "results": [
                    {
                        "title": str,
                        "url": str,
                        "description": str,
                        "published_date": str | None
                    }
                ],
                "total": int
            }
        """
```

**Tavily API**:
- 文档: https://docs.tavily.com/
- 免费额度: 1000 次/月
- 需要 API Key（从环境变量读取 `TAVILY_API_KEY`）
- Python SDK: `pip install tavily-python`

**API 调用示例**:

```python
from tavily import TavilyClient

async def tavily_search(query: str, api_key: str, max_results: int = 5) -> dict:
    """
    使用 Tavily 进行搜索，返回为 AI 优化的结果
    """
    client = TavilyClient(api_key=api_key)

    # Tavily 返回的是已为 AI 优化的搜索结果
    response = client.search(
        query=query,
        max_results=max_results,
        search_depth="basic",  # "basic" 或 "advanced"
        include_answer=False,    # 是否包含 AI 生成的摘要
    )

    # 解析结果
    results = []
    for item in response.get("results", []):
        results.append({
            "title": item.get("title"),
            "url": item.get("url"),
            "description": item.get("content"),  # Tavily 返回的是为 AI 优化的内容
            "published_date": None  # Tavily 不返回发布时间
        })

    return {
        "success": True,
        "query": query,
        "results": results,
        "total": len(results),
        "raw_response": response
    }
```

**错误处理**:
- API 密钥无效 → 返回友好错误信息
- 网络超时 → 重试 3 次
- 超出配额 → 提示用户

---

## 依赖关系

```
Task 1 (Memory) ───┐
                   ├──→ Integration (注册到 ToolRegistry, 集成到 Telegram)
Task 2 (Search) ───┘
```

**并行策略**: Task 1 和 Task 2 可以并行执行。

---

## 环境变量配置

添加到 `.env.example`:

```bash
# Tavily Search API
TAVILY_API_KEY=your_tavily_api_key_here

# 数据库
DATABASE_PATH=./memory_data/swiftclaw.db
```

---

## 验收标准

Phase 3 验收:
- [ ] 用户偏好可持久化存储和读取
- [ ] 对话历史自动保存，可获取最近 N 轮
- [ ] 关键记忆可添加和检索
- [ ] 搜索工具可调用 Tavily API
- [ ] 所有测试通过
- [ ] 类型检查通过
