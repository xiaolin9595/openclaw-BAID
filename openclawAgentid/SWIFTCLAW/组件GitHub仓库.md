# MVP 组件 GitHub 仓库列表

## 开发工具链

| 组件 | GitHub 仓库 | 说明 |
|------|------------|------|
| Claude Code | https://github.com/anthropics/claude-code | AI 辅助编程工具 |
| superpowers | https://github.com/anthropics/superpowers | 规范化开发插件系统 |

---

## Python 组件

### 核心组件

| 组件 | GitHub 仓库 |
|------|------------|
| fastapi | https://github.com/tiangolo/fastapi |
| uvicorn | https://github.com/encode/uvicorn |
| websockets | https://github.com/python-websockets/websockets |
| python-telegram-bot | https://github.com/python-telegram-bot/python-telegram-bot |
| litellm | https://github.com/BerriAI/litellm |
| aiofiles | https://github.com/Tinche/aiofiles |
| pydantic-settings | https://github.com/pydantic/pydantic-settings |
| python-dotenv | https://github.com/theskumar/python-dotenv |
| loguru | https://github.com/Delgan/loguru |
| duckduckgo-search | https://github.com/deedy5/duckduckgo-search |

### 备选组件

| 组件 | GitHub 仓库 |
|------|------------|
| flask | https://github.com/pallets/flask |
| flask-socketio | https://github.com/miguelgrinberg/flask-socketio |
| aiogram | https://github.com/aiogram/aiogram |

### 进阶组件

| 组件 | GitHub 仓库 |
|------|------------|
| sqlite-vec | https://github.com/asg017/sqlite-vec |
| docker-py | https://github.com/docker/docker-py |

---

## 按功能分类的仓库速查

### 开发工具链
- **Claude Code**: https://github.com/anthropics/claude-code
- **superpowers**: https://github.com/anthropics/superpowers

### Gateway（网关）
- **Python**: https://github.com/tiangolo/fastapi

### Telegram Bot
- **Python**: https://github.com/python-telegram-bot/python-telegram-bot

### LLM 调用
- **Python (litellm)**: https://github.com/BerriAI/litellm
- **OpenAI SDK**: https://github.com/openai/openai-python

### 浏览器自动化
- **Playwright**: https://github.com/microsoft/playwright

### 配置管理
- **Python (pydantic)**: https://github.com/pydantic/pydantic-settings

### 日志
- **Python (loguru)**: https://github.com/Delgan/loguru

### 持久化记忆（进阶）
- **Python (SQLite向量)**: https://github.com/asg017/sqlite-vec

---

## 外部服务/API

| 服务 | 网址 |
|------|------|
| Kimi (Moonshot) API | https://platform.moonshot.cn/ |
| Brave Search API | https://api.search.brave.com/ |
| OpenAI API | https://platform.openai.com/ |
| Telegram Bot API | https://core.telegram.org/bots/api |

---

## superpowers 核心 Skill 速查

| Skill | 用途 | 触发时机 |
|-------|------|----------|
| `superpowers:brainstorming` | 结构化头脑风暴 | 任何创造性工作之前 |
| `superpowers:writing-plans` | 编写实施计划 | 确定需求后 |
| `superpowers:executing-plans` | 执行计划 | 有计划要执行时 |
| `superpowers:test-driven-development` | 测试驱动开发 | 编写功能/修复 bug 时 |
| `superpowers:systematic-debugging` | 系统化调试 | 遇到 bug 时 |
| `superpowers:verification-before-completion` | 完成前验证 | 声称完成前 |
| `superpowers:requesting-code-review` | 代码审查请求 | 完成代码后 |
| `superpowers:using-git-worktrees` | Git 工作树管理 | 需要隔离开发环境时 |
