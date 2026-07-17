# SwiftClaw Skill 管理系统设计文档

**日期**: 2026-04-02
**版本**: 1.0

---

## 1. 概述

### 1.1 目标
为 SwiftClaw 实现一个类似于 Claude Code 的 Skill 管理系统，允许用户通过 GitHub 链接安装、管理和使用 Skill。

### 1.2 核心功能
- 通过 GitHub URL 或 `owner/repo@version` 语法安装 Skill
- 支持项目本地和全局两种存储位置
- 完整的安装/卸载/更新/列表命令
- 全面的日志记录（安装、使用、系统事件）
- Skill 热加载（无需重启）

---

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot Layer                       │
├─────────────────────────────────────────────────────────────┤
│  /skill list    /skill install    /skill update    /skill   │
│        │               │                │            remove │
└────────┼───────────────┼────────────────┼───────────────────┘
         │               │                │
         ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Skill Manager                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Installer  │  │   Loader    │  │  Updater/Logger     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │               │                │
         ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │  Global Skills   │  │  Project Skills                │  │
│  │  ~/swiftclaw/    │  │  ./skills/                     │  │
│  └──────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub API Layer                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Skill 格式规范

### 3.1 文件结构

Skill 是 Markdown 文件，包含 YAML 前置元数据：

```markdown
---
name: web-search
description: 搜索网页并返回结果
tools:
  - web_search
  - browser_open
params:
  default_count:
    type: integer
    default: 5
    description: 默认搜索结果数量
version: 1.0.0
author: your-name
---

# Web Search Skill

## 使用场景

当你需要搜索网络信息时，使用此 skill。

## 工作流程

1. 使用 `web_search` 工具搜索关键词
2. 分析搜索结果
3. 如果需要详细信息，使用 `browser_open` 访问具体页面

## 示例

用户：搜索关于 Python asyncio 的最新文章
→ 调用 web_search 工具，query="Python asyncio 2024"
```

### 3.2 元数据字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Skill 唯一标识，小写字母+连字符 |
| description | string | 是 | 简短描述 |
| tools | array | 否 | Skill 依赖的工具列表 |
| params | object | 否 | Skill 可调用的参数定义 |
| version | string | 否 | 版本号，遵循 SemVer |
| author | string | 否 | 作者名称 |

---

## 4. 数据模型

### 4.1 Skill 模型

```python
class Skill:
    name: str                    # 唯一标识
    description: str             # 描述
    content: str                 # Markdown 内容
    tools: list[str]             # 依赖的工具
    params: dict                 # 参数定义
    version: str                 # 版本
    author: str                  # 作者
    source_url: str              # GitHub 来源
    installed_at: datetime       # 安装时间
    updated_at: datetime         # 更新时间
    is_local: bool               # 是否为项目本地
    local_path: Path             # 本地存储路径
```

### 4.2 SkillInstallLog 模型

```python
class SkillInstallLog:
    id: int                      # 日志 ID
    skill_name: str              # Skill 名称
    action: str                  # install/update/remove
    source_url: str              # 来源 URL
    version: str                 # 版本
    success: bool                # 是否成功
    error_message: str | None    # 错误信息
    created_at: datetime         # 记录时间
```

### 4.3 SkillUsageLog 模型

```python
class SkillUsageLog:
    id: int                      # 日志 ID
    skill_name: str              # Skill 名称
    conversation_id: str         # 对话 ID
    input_preview: str           # 输入预览（脱敏）
    output_preview: str          # 输出预览（脱敏）
    execution_time_ms: int       # 执行耗时
    success: bool                # 是否成功
    created_at: datetime         # 记录时间
```

---

## 5. 存储设计

### 5.1 目录结构

```
~/swiftclaw/                          # 全局存储
├── skills/                           # 全局 skills
│   ├── web-search/
│   │   └── skill.md                  # skill 文件
│   └── code-review/
│       └── skill.md
├── logs/                             # 日志目录
│   ├── skill_install.log             # 安装日志（文本）
│   ├── skill_usage.log               # 使用日志（文本）
│   └── skill_system.log              # 系统日志（文本）
└── skill_registry.db                 # SQLite 数据库

./                                    # 项目本地
└── skills/                           # 项目本地 skills
    ├── project-specific/
    │   └── skill.md
    └── ...
```

### 5.2 SQLite 数据库表

```sql
-- Skills 表
CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    tools TEXT,  -- JSON array
    params TEXT, -- JSON object
    version TEXT,
    author TEXT,
    source_url TEXT,
    is_local BOOLEAN DEFAULT 0,
    local_path TEXT,
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 安装日志表
CREATE TABLE skill_install_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    action TEXT NOT NULL,  -- install, update, remove
    source_url TEXT,
    version TEXT,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 使用日志表
CREATE TABLE skill_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    conversation_id TEXT,
    input_preview TEXT,
    output_preview TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_install_logs_skill ON skill_install_logs(skill_name);
CREATE INDEX idx_install_logs_time ON skill_install_logs(created_at);
CREATE INDEX idx_usage_logs_skill ON skill_usage_logs(skill_name);
CREATE INDEX idx_usage_logs_time ON skill_usage_logs(created_at);
```

---

## 6. 核心模块设计

### 6.1 SkillManager

```python
class SkillManager:
    """Skill 管理器，负责 Skill 的全生命周期管理"""

    def __init__(self):
        self.global_dir = Path.home() / "swiftclaw" / "skills"
        self.project_dir = Path("./skills")
        self.db = SkillDatabase()
        self.logger = SkillLogger()

    async def install(self, source: str, is_local: bool = False) -> InstallResult:
        """
        安装 Skill

        Args:
            source: GitHub URL 或 owner/repo@version
            is_local: 是否安装到项目本地

        Returns:
            InstallResult: 安装结果
        """
        pass

    async def remove(self, name: str, is_local: bool | None = None) -> bool:
        """卸载 Skill"""
        pass

    async def update(self, name: str) -> UpdateResult:
        """更新 Skill"""
        pass

    def list_skills(self, is_local: bool | None = None) -> list[Skill]:
        """列出已安装的 Skills"""
        pass

    def get_skill(self, name: str) -> Skill | None:
        """获取指定 Skill"""
        pass

    async def reload(self) -> None:
        """热重载所有 Skills"""
        pass
```

### 6.2 GitHubSkillSource

```python
class GitHubSkillSource:
    """从 GitHub 获取 Skill"""

    async def fetch(self, source: str) -> FetchedSkill:
        """
        从 GitHub 获取 Skill

        支持格式：
        - https://github.com/owner/repo
        - https://github.com/owner/repo/tree/main/subdir
        - owner/repo
        - owner/repo@v1.0.0
        - owner/repo#main
        """
        pass

    def _parse_source(self, source: str) -> ParsedSource:
        """解析 source 字符串"""
        pass
```

### 6.3 SkillLogger

```python
class SkillLogger:
    """Skill 相关日志记录器"""

    def log_install(
        self,
        skill_name: str,
        action: str,
        source_url: str,
        version: str,
        success: bool,
        error: str | None = None
    ) -> None:
        """记录安装日志"""
        pass

    def log_usage(
        self,
        skill_name: str,
        conversation_id: str,
        input_data: dict,
        output_data: dict,
        execution_time_ms: int,
        success: bool
    ) -> None:
        """记录使用日志"""
        pass

    def log_system(self, message: str, level: str = "info") -> None:
        """记录系统日志"""
        pass

    async def get_install_logs(
        self,
        skill_name: str | None = None,
        limit: int = 50
    ) -> list[SkillInstallLog]:
        """获取安装日志"""
        pass

    async def get_usage_logs(
        self,
        skill_name: str | None = None,
        limit: int = 50
    ) -> list[SkillUsageLog]:
        """获取使用日志"""
        pass
```

---

## 7. Telegram Bot 命令接口

### 7.1 命令列表

| 命令 | 描述 |
|------|------|
| `/skill list` | 列出所有已安装的 skills |
| `/skill list --local` | 只列出项目本地 skills |
| `/skill list --global` | 只列出全局 skills |
| `/skill install <source>` | 安装 skill |
| `/skill install <source> --local` | 安装到项目本地 |
| `/skill remove <name>` | 卸载 skill |
| `/skill update <name>` | 更新指定 skill |
| `/skill update --all` | 更新所有 skills |
| `/skill info <name>` | 查看 skill 详情 |
| `/skill logs` | 查看安装日志 |
| `/skill logs --usage` | 查看使用日志 |

### 7.2 自然语言支持

Agent 应该能识别以下意图：

- "安装 skill https://github.com/user/repo"
- "帮我装一下 owner/repo 这个 skill"
- "列出所有已安装的 skills"
- "更新 web-search skill"
- "卸载 local 的 skill-name"
- "查看 skill 日志"

---

## 8. 安装流程

```
用户输入: /skill install owner/repo@v1.0.0 --local

1. 解析 source
   └─ owner/repo@v1.0.0 → {owner, repo, version=v1.0.0}

2. 检查是否已存在
   └─ 查询数据库，如果存在且版本相同 → 返回 "已安装"

3. 从 GitHub 获取
   └─ 调用 GitHub API 获取 skill.md 内容
   └─ 如果失败，尝试下载仓库 zip 并解压

4. 验证 Skill
   └─ 解析 YAML frontmatter
   └─ 验证必填字段
   └─ 检查 name 是否合法

5. 存储
   └─ 写入本地文件: ./skills/repo/skill.md
   └─ 写入数据库

6. 记录日志
   └─ 写入 skill_install_logs 表
   └─ 写入 skill_install.log 文件

7. 返回结果
   └─ 发送成功消息到 Telegram
```

---

## 9. 更新检查机制

```python
async def check_updates(self) -> list[UpdateInfo]:
    """检查所有 skills 的更新"""
    updates = []

    for skill in self.list_skills():
        # 获取 GitHub 最新 release/tag
        latest = await self._get_latest_version(skill.source_url)

        if latest and latest != skill.version:
            updates.append(UpdateInfo(
                skill=skill,
                current_version=skill.version,
                latest_version=latest
            ))

    return updates
```

更新检查触发时机：
1. 启动时（异步，不阻塞）
2. 用户主动调用 `/skill update --check`

---

## 10. 集成到 Agent

### 10.1 Skill 注入 Prompt

```python
def build_skills_prompt(self) -> str:
    """构建 skills 部分的 prompt"""
    skills = self.skill_manager.list_skills()

    if not skills:
        return ""

    lines = ["\n## 可用 Skills\n"]

    for skill in skills:
        lines.append(f"### {skill.name}")
        lines.append(f"{skill.description}\n")
        lines.append(skill.content)
        lines.append("")

    return "\n".join(lines)
```

### 10.2 在 Agent 初始化时加载

```python
# agent/llm.py

class AgentDependencies:
    settings: Settings
    memory_store: MemoryStore
    skill_manager: SkillManager  # 新增

async def run_agent(user_input: str, deps: AgentDependencies) -> str:
    # 构建包含 skills 的 system prompt
    system_prompt = build_system_prompt()
    skills_prompt = deps.skill_manager.build_skills_prompt()
    full_prompt = f"{system_prompt}\n{skills_prompt}"

    # 运行 agent...
```

---

## 11. 配置项

```python
# config/settings.py

class Settings(BaseSettings):
    # ... 现有配置 ...

    # Skill 系统配置
    skill_global_dir: Path = Path.home() / "swiftclaw" / "skills"
    skill_project_dir: Path = Path("./skills")
    skill_db_path: Path = Path.home() / "swiftclaw" / "skill_registry.db"
    skill_auto_update_check: bool = True
    skill_update_check_interval_hours: int = 24
    skill_github_token: str | None = None  # 用于提高 API 限制
```

---

## 12. 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| GitHub API 限制 | 提示用户设置 GITHUB_TOKEN |
| 网络超时 | 重试 3 次，失败后提示检查网络 |
| Skill 格式错误 | 详细说明哪个字段缺失或格式不对 |
| 重复安装 | 提示已存在，提供 `--force` 选项覆盖 |
| 依赖工具不存在 | 在安装时检查，提示用户 |

---

## 13. 安全考虑

1. **Skill 来源验证**：只支持 GitHub 安装，未来可扩展信任列表
2. **敏感信息脱敏**：使用日志中参数值用 `***` 替代
3. **执行隔离**：Skill 只是提示词模板，不直接执行代码
4. **权限控制**：项目本地 skill 优先于全局，防止覆盖

---

## 14. 文件清单

需要创建/修改的文件：

```
code/
├── skills/                           # 新增模块
│   ├── __init__.py
│   ├── manager.py                    # SkillManager
│   ├── models.py                     # Skill, InstallLog, UsageLog
│   ├── database.py                   # SQLite 操作
│   ├── github_source.py              # GitHubSkillSource
│   ├── logger.py                     # SkillLogger
│   ├── parser.py                     # Skill 文件解析
│   └── commands.py                   # Telegram 命令处理
├── agent/
│   └── llm.py                        # 修改：集成 skill
├── gateway/
│   └── telegram.py                   # 修改：添加 skill 命令
└── config/
    └── settings.py                   # 修改：添加 skill 配置
```

---

## 15. 用户交互设计

### 15.1 交互方式概述

用户可以通过以下三种方式与Skill系统交互：

| 交互方式 | 场景 | 示例 |
|---------|------|------|
| **Slash命令** | 精确管理操作 | `/skill install owner/repo` |
| **自然语言** | 日常对话中表达意图 | "帮我安装web-search skill" |
| **隐式触发** | 对话中自动匹配Skill | 用户描述需求时自动调用匹配Skill |

### 15.2 Slash命令交互

#### 15.2.1 命令格式规范

```
/skill <action> [target] [options]
```

**参数说明：**
- `action`: 操作类型（install/remove/update/list/info/logs）
- `target`: 操作对象（skill名称、GitHub URL等）
- `options`: 可选标志（--local, --global, --force等）

#### 15.2.2 交互流程示例

**安装Skill：**
```
用户: /skill install swiftclaw-team/web-search

Bot: 🔍 正在从 GitHub 获取 skill...
     ✅ 找到技能: web-search (v1.2.0)
     📝 描述: 搜索网页并返回结构化结果
     ⚡ 依赖工具: web_search, browser_open

     确认安装？
     [确认安装] [查看详情] [取消]

用户: 确认安装

Bot: ✅ Skill 安装成功！
     📦 名称: web-search
     📍 位置: 全局 (~/.swiftclaw/skills/web-search/)
     🔧 使用方法: 在对话中直接描述搜索需求即可触发
```

**查看已安装Skills：**
```
用户: /skill list

Bot: 📋 已安装的 Skills (共 3 个)

     🌍 全局 Skills:
     1. web-search v1.2.0 - 搜索网页并返回结构化结果
     2. code-review v0.5.0 - 代码审查助手

     📁 项目本地 Skills:
     1. project-docs v1.0.0 - 项目文档生成器

     提示: 使用 /skill info <name> 查看详情
```

### 15.3 自然语言交互

#### 15.3.1 意图识别模式

Agent通过以下模式识别用户意图：

| 意图类型 | 关键词模式 | 示例 |
|---------|-----------|------|
| **安装** | "安装skill", "添加skill", "我要用xxx" | "帮我装一个代码审查的skill" |
| **卸载** | "卸载", "删除skill", "移除" | "把web-search删掉" |
| **更新** | "更新skill", "升级", "最新版" | "更新所有skill到最新版" |
| **查询** | "有哪些skill", "装了什么", "skill列表" | "我现在有哪些skill可用" |
| **帮助** | "怎么用", "不会用", "帮助" | "这个skill怎么用" |

#### 15.3.2 自然语言处理流程

```
用户输入: "我想装一个能搜索网页的skill，github上那个"
         ↓
意图识别: install_skill (置信度: 0.92)
         ↓
实体提取:
   - 功能描述: "搜索网页"
   - 来源: "github"
         ↓
候选匹配:
   1. web-search (匹配度: 95%)
   2. google-search (匹配度: 80%)
         ↓
Bot回复: "找到以下匹配的 Skills:
         1. swiftclaw-team/web-search - 搜索网页并返回结构化结果
         2. another-org/google-search - Google搜索助手

         您想安装哪一个？或者提供具体的GitHub地址？"
```

### 15.4 Skill使用方式

#### 15.4.1 隐式触发

Skill安装后，Agent会根据对话内容自动判断是否使用Skill：

```
用户: "帮我搜索一下Python异步编程的最新文章"
         ↓
Agent分析:
   - 检测到搜索意图
   - 匹配到已安装 skill: web-search
   - confidence > 0.8
         ↓
使用Skill: 调用web-search skill处理请求
         ↓
Bot回复: [使用web-search skill生成的结构化结果]
```

#### 15.4.2 显式调用

用户可以直接指定使用某个Skill：

```
用户: "使用web-search skill，搜索Python asyncio教程"

Bot: 🔍 正在使用 web-search skill...
     [执行结果]
```

#### 15.4.3 多Skill协同

复杂任务可能触发多个Skills协同工作：

```
用户: "分析这个网站 https://example.com 并生成一份报告"
         ↓
Agent规划:
   1. 使用 web-search skill 获取网站信息
   2. 使用 browser-open skill 访问并提取内容
   3. 使用 analysis skill 分析内容
   4. 使用 report-gen skill 生成报告
         ↓
执行并汇总结果...
```

### 15.5 交互状态反馈

#### 15.5.1 进度提示

对于耗时操作，Bot应提供实时进度：

```
安装过程:
⏳ 正在下载... 45%
⏳ 正在验证skill格式...
✅ 安装完成

更新检查:
🔍 正在检查 web-search... 有更新 (v1.0.0 → v1.2.0)
🔍 正在检查 code-review... 已是最新版
```

#### 15.5.2 错误反馈

```
❌ 安装失败
   原因: 无法访问 GitHub API (Rate limit exceeded)
   建议: 设置 GITHUB_TOKEN 以提高API限制

❌ Skill格式错误
   原因: 缺少必填字段 'description'
   位置: skill.md 第3行

⚠️ 警告
   Skill 'xxx' 依赖的工具 'special_tool' 当前不可用
   该skill的部分功能可能无法正常工作
```

### 15.6 交互式配置

对于需要配置的Skill，提供交互式设置：

```
用户: /skill install swiftclaw-team/advanced-search

Bot: ✅ Skill 安装成功！

     ⚙️ 需要配置以下参数:
     1. API Key (必填): ______
     2. 默认搜索数量 [5]: ______
     3. 结果语言 [zh]: ______

     [保存配置] [稍后设置]
```

### 15.7 帮助与学习

#### 15.7.1 上下文帮助

```
用户: /skill help install

Bot: 📖 /skill install 命令帮助

     用法: /skill install <source> [options]

     参数:
       source  - GitHub仓库地址或owner/repo格式
                 支持: owner/repo, owner/repo@version, 完整URL

     选项:
       --local   安装到当前项目 (./skills/)
       --global  安装到全局 (~/.swiftclaw/skills/)
       --force   强制重新安装（覆盖已有）

     示例:
       /skill install swiftclaw-team/web-search
       /skill install owner/repo@v1.0.0 --local
       /skill install https://github.com/user/repo/tree/main/subdir
```

#### 15.7.2 Skill使用示例

```
用户: /skill info web-search

Bot: 📦 Skill: web-search
     📝 描述: 搜索网页并返回结构化结果
     👤 作者: swiftclaw-team
     📌 版本: v1.2.0
     🔧 依赖工具: web_search, browser_open

     📖 使用示例:
     1. "搜索 Python asyncio 教程"
     2. "查找最近一周的AI新闻"
     3. "搜索并总结 https://example.com 的内容"

     [查看完整文档] [测试Skill] [删除]
```

## 16. 验收标准

- [ ] 用户可以通过 `/skill install owner/repo` 安装 skill
- [ ] 支持 `@version` 语法安装指定版本
- [ ] 支持 `--local` 标志安装到项目本地
- [ ] `/skill list` 正确显示所有已安装 skills
- [ ] `/skill remove` 可以卸载 skill
- [ ] `/skill update` 可以更新 skill
- [ ] 安装日志正确记录到数据库和文件
- [ ] 使用日志正确记录
- [ ] Skill 内容正确注入到 Agent prompt
- [ ] 支持自然语言方式管理 skills
