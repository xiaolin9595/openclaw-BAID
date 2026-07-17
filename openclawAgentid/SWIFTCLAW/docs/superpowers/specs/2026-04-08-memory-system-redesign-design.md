# SwiftClaw 记忆系统重构设计文档

**版本**: v1.0  
**日期**: 2026-04-08  
**状态**: 待实施

---

## 1. 背景与目标

当前 SwiftClaw 的记忆系统采用纯 SQLite 方案（`conversations` + `memories` 表），存在以下问题：

- 长期记忆仅有结构化 key-value，缺乏给人读的可读性
- 对话历史无限累积，长对话时上下文窗口容易被撑满
- 历史对话无法被 AI 主动检索回顾（只能取最近 N 条）
- `memories` 表与 `core.md` 概念重叠，维护成本高

本设计参考 OpenClaw 的记忆机制，引入 **Markdown 文件层 + SQLite 索引层** 的双层结构，在保持"本机启动即可"的部署原则下，实现更接近人脑的记忆体验。

### 核心目标

1. **给人读的MEMORY.md**：用户的长期核心记忆以 Markdown 文件形式保存，可人工查看和编辑
2. **按天归档的日志**：每日对话写入独立的 `.md` 文件，支持今天/昨天的连续性
3. **Memory Flush 自动压缩**：长对话达到阈值时自动摘要归档，释放上下文窗口
4. **FTS5 全文历史检索**：AI 可主动通过 `search_history` 工具搜索历史日志中的关键词
5. **简化架构**：删除 `memories` 表，统一为 `memory.md`（核心）+ `conversations`（短期缓冲）+ `logs/`（历史档案）

---

## 2. 三层记忆架构

重构后，记忆系统由三个清晰的层级组成：

| 层级 | 存储位置 | 内容属性 | 进入 Prompt 的方式 | 生命周期 |
|---|---|---|---|---|
| **核心长期记忆** | `user_data/{telegram_id}/memory.md` | 用户画像、偏好、重要事实 | **每次对话全文加载** | 持久化，懒维护压缩 |
| **短期记忆** | SQLite `conversations` 表 | 当前会话的未归档原始消息 | 取最近 **10 条** 直接拼入 | Memory Flush 后仅删除较老记录，始终保留最近 10 条 |
| **历史档案** | `user_data/{telegram_id}/logs/YYYY-MM-DD.md` + `log_fts` | 完整对话日志 + 摘要 | **不默认加载**，通过 `search_history` 按需检索 | 永久保留 |

### 数据边界原则

- `conversations` 表是**热数据缓冲**，Flush 后会删除，避免与 `logs/` 重复
- `logs/` 是**完整历史仓库**，所有追加内容同时同步到 SQLite `log_fts` 全文索引
- `memory.md` 是**唯一长期记忆源**，删除原有的 `memories` SQLite 表

---

## 3. 用户数据隔离结构

SwiftClaw 是 Telegram Bot（多用户服务端），必须按 `telegram_id` 隔离文件：

```
code/user_data/
└── {telegram_id}/
    ├── memory.md           ← 核心长期记忆（全自动维护 + 可人工查看）
    └── logs/
        ├── 2026-04-07.md   ← 每日完整对话日志
        └── 2026-04-08.md

code/memory_data/
    └── swiftclaw.db        ← 保留现有全局 SQLite（users + conversations + log_fts）
```

### 关键规则

- `memory.md` 在每次私聊开始时**全文加载**到 System Prompt
- `logs/YYYY-MM-DD.md` 文件仅作为**可读档案 + FTS5 检索源**，不直接拼入 Prompt
- 所有 Markdown 文件使用 `aiofiles` 异步写入，避免阻塞 Telegram 事件循环

---

## 4. memory.md 格式与维护

### 文件格式（混合式：小标题 + 段落）

```markdown
# 用户记忆

## 编程语言
用户偏好使用 Python，在提供技术建议时优先从 Python 角度出发。

## 工作地点
目前在深圳南山区工作。

## 当前项目
正在开发一个名为 SwiftClaw 的个人 AI 助手项目。
```

### 写入策略：Upsert

Agent 调用 `save_memory(key, value)` 时：

1. 扫描 `memory.md`，检查是否已存在 `## {key}` 小标题
2. **存在**：将该小标题下的段落替换为 LLM 根据 `value` 生成的自然语言描述
3. **不存在**：在文件末尾追加新的 `## {key}` + 段落

这样可以保证同一 key 不会重复出现，语义与原来 `memories` 表的 upsert 一致。

### 懒维护压缩

当 `memory.md` 字符长度超过 **1500** 时，在 Memory Flush 触发的同时：

1. 读取现有 `memory.md`
2. 调用 LLM（静默回合）将其中的多个小标题合并为一段紧凑的用户画像
3. 覆盖写回 `memory.md`

示例压缩前 → 压缩后：

```markdown
<!-- 压缩前 -->
# 用户记忆

## 编程语言
用户偏好使用 Python...

## 工作地点
目前在深圳南山区工作。

## 当前项目
正在开发 SwiftClaw...
```

```markdown
<!-- 压缩后 -->
# 用户记忆

用户偏好使用 Python，在提供技术建议时优先从 Python 角度出发。目前在深圳南山区工作，正在开发一个名为 SwiftClaw 的个人 AI 助手项目。
```

---

## 5. 每日日志 logs/ 格式

### 文件组织

- 每天一个文件：`logs/{YYYY-MM-DD}.md`
- 文件名使用 UTC+8 本地日期

### 内容格式

```markdown
# 2026-04-08

## 09:15
**User:** 我喜欢 Python，请记住。
**Assistant:** 好的，我已经记下了——你喜欢 Python！

## 09:20
**User:** 帮我查一下深圳天气。
**Assistant:** 根据搜索结果，今天深圳南山区的天气情况如下：...
```

### 写入时机

每次 `save_message` 时：
1. 照常 `INSERT` 到 SQLite `conversations` 表
2. **同时追加**到 `logs/{today}.md`
3. **同时插入**到 SQLite `log_fts` 全文索引表

### 与 conversations 表的关系

- `conversations` 是**未归档的原始消息**（热数据）
- `logs/` 是**完整备份 + 压缩后的摘要**（冷数据）
- Memory Flush 后，**较老的原始记录**会从 `conversations` 中删除，但 **最新的 10 条始终保留**；`logs/` 文件中的完整记录（含摘要和原始对话）永久保留

---

## 6. Memory Flush 机制

### 触发条件

当 `conversations` 表中当前用户的未归档消息，其 `content` **累计字符长度 > 6000** 时触发。

> 简化规则说明：中文环境下字符数约为 Token 数的 1.5~2 倍，6000 字符 ≈ 3000~4000 Tokens，对 `moonshot-v1-8k` 模型是安全区。

### Flush 执行流程

当 `conversations` 累计字符长度 > 6000 时：

```
1. 计算需要归档的范围： oldest_records = total_records - 10（始终保留最近 10 条）
2. 取这 oldest_records 中超出 6000 字符门槛的前半部分
3. 调用 LLM（静默回合）生成这部分会话摘要
4. 以 ## 会话摘要 格式追加到 logs/{today}.md
5. 将这些较老的原始消息从 conversations 表中 DELETE
6. 剩余未删除的最近 10 条记录继续作为短期记忆保留
7. 同时检查 memory.md 长度，执行懒维护压缩
```

> **核心原则**：Flush 是"压缩历史"而非"清空过去"。最近 10 条原始对话始终保留在 `conversations` 中，确保短期记忆的连续性。> 

### 摘要追加格式示例

```markdown
## 会话摘要（2026-04-08 10:30）
用户和助手讨论了深圳天气、Python 编程偏好，以及 SwiftClaw 项目的开发计划。用户明确表示喜欢 Python，并请求记住这一点。
```

---

## 7. FTS5 全文历史检索

### 数据库 Schema

SQLite 3.45.3 原生支持 FTS5。在现有 `swiftclaw.db` 中创建虚拟表：

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS log_fts USING fts5(
    content,           -- 日志文本片段
    source_file,       -- 来源文件路径（如 logs/2026-04-08.md）
    user_id UNINDEXED  -- 用户ID过滤条件（不参与全文索引）
);
```

### 同步策略

每次向 `logs/YYYY-MM-DD.md` 追加新段落时，将追加的文本**同时**写入 `log_fts`：

```python
INSERT INTO log_fts (content, source_file, user_id)
VALUES (?, ?, ?)
```

### 检索工具

新增 Agent 工具 `search_history(ctx, query: str, limit: int = 5)`：

1. 执行 `SELECT content, source_file FROM log_fts WHERE log_fts MATCH ? AND user_id = ? LIMIT ?`
2. 按 BM25 相关性排序返回格式化的片段列表

### 触发场景

System Prompt 中明确指示 Agent：
> "当用户提到'上次''昨天''之前聊过'，或要求回顾过去讨论的话题时，调用 `search_history` 工具查找相关历史日志。"

### 已知限制

- FTS5 基于字面匹配（BM25），不做语义理解
- "我上周提到的项目" 可能无法匹配到 "我的工作项目"
- 语义搜索计划在后续阶段通过 Embedding 补强

---

## 8. 工具行为变更

### 删除的表

- `memories` SQLite 表 → **完全删除**
- `accessed_at` 字段逻辑 → **完全删除**（LRU 不再有意义）

### 新增的工具

**`search_history(ctx, query, limit=5)`**
- 在 `log_fts` 中搜索历史日志

### 修改的工具

**`save_memory(ctx, key, value)`**
- 不再写 SQLite `memories`
- 改为 upsert 到 `user_data/{telegram_id}/memory.md`
- 由 LLM 把 `key` + `value` 润色成自然语言段落

**`recall_memory(ctx, key)`**
- 读取 `memory.md`
- 正则查找 `## {key}` 小标题，返回其下段落

**`list_memories(ctx)`**
- 读取 `memory.md`
- 提取所有 `## ` 后面的小标题列表并格式化返回

### 未改动的工具

- 文件工具、Bash 工具、浏览器工具、Tavily 搜索工具等保持不变

---

## 9. 新增 Telegram 命令

新增 `/memory` 命令：

- **功能**：直接返回用户当前 `memory.md` 的完整内容（作为 Telegram 消息）
- **用途**：让用户能直观查看 AI 记住了什么
- **编辑方式**：用户可以对 AI 说"帮我修改/删除 memory.md 里关于 Python 的部分"，AI 用现有 `file_read`/`file_write` 工具操作

---

## 10. 改动模块清单

| 文件 | 改动内容 |
|---|---|
| `memory/store.py` | 新增 Markdown 日志写入、`memory.md` upsert、Memory Flush 触发、懒维护检查 |
| `memory/database.py` | 删除 `memories` 表创建逻辑；新增 `log_fts` 虚拟表创建 |
| `memory/models.py` | 删除 `Memory` 模型（可能保留 `User` 和 `Message`） |
| `agent/tools.py` | 修改 `save_memory`/`recall_memory`/`list_memories`；新增 `search_history` |
| `agent/llm.py` | 更新 System Prompt（`memory.md` 加载说明、`search_history` 触发场景） |
| `gateway/telegram.py` | 改消息处理流程：增加维护触发、`memory.md` 加载、新增 `/memory` 命令 |
| `pyproject.toml` | 新增 `aiofiles` 依赖 |
| `tests/unit/memory/test_*.py` | 更新测试以适配新架构 |

---

## 11. 风险与边界

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| `memory.md` 无限膨胀 | 高 | 懒维护压缩机制（超 1500 字符自动合并摘要） |
| `log_fts` 表膨胀 | 中 | 个人 Bot 场景下数据量极小，暂不做清理 |
| Windows 路径长度限制 | 中 | `user_data/{telegram_id}/...` 层级浅，不会触及 260 字符限制 |
| 异步文件 I/O 阻塞 | 中 | 使用 `aiofiles` 替代内置 `open()` |
| Memory Flush 摘要丢失细节 | 中 | 摘要同时追加 `logs/`，原始对话保留在 Markdown 文件中 |
| FTS5 不支持语义搜索 | 低 | 明确文档化，后续 Phase 2 通过 Embedding 补强 |

---

## 12. 验收标准

- [ ] 删除 `memories` 表后系统无报错
- [ ] `save_memory` 能正确 upsert 到 `memory.md`
- [ ] `recall_memory` 和 `list_memories` 能正确读取 `memory.md`
- [ ] 每次对话双向写入 `conversations` 表和 `logs/YYYY-MM-DD.md`
- [ ] `log_fts` 表同步更新，且 `search_history` 能搜索历史日志
- [ ] 当 `conversations` 累计字符 > 6000 时自动触发 Memory Flush
- [ ] `memory.md` 超 1500 字符时自动压缩合并
- [ ] Telegram `/memory` 命令能返回当前核心记忆内容
- [ ] 所有相关单元测试通过

---

**文档历史**:
- v1.0 (2026-04-08): 初始版本
