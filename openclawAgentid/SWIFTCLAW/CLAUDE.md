# swiftclaw项目规范

## 🧱 技术栈
- Python + FastAPI + WebSocket
- python-telegram-bot
- **PydanticAI** + **Moonshot API** (推荐)
- playwright

## 📚 规格文档
- `技术组件.md`
- `MVP组件.md`
- `组件GitHub仓库.md`

## 🔄 会话与进度管理
### 会话开始时
1. 读取当前文档理解项目状态
2. 检查环境变量配置 (.env)

### 功能完成后
- 更新相关文档
- 记录实现决策

### 发生纠正后
- 更新教训记录
- 调整开发模式

## 🚀 部署要求
- 本机启动即可
- Telegram Bot Webhook 或轮询模式
- 无需复杂部署

## 🛠️ 开发模式
- **SDD**: Spec-Driven Development（规格驱动开发）
- **TDD**: Test-Driven Development（红-绿-重构）

### 强制 Skill
- `superpowers:brainstorming` - 任何创造性工作之前
- `superpowers:test-driven-development` - 编写功能/修复 bug
- `superpowers:verification-before-completion` - 声称完成前

## 🗣️ 用户交互规范
- 📄 项目文档：**全部使用中文**
- 💬 与用户对话：**全部使用中文**
- 🧩 输出格式要求：
  - Code only
  - No explanation
  - Chunk output
