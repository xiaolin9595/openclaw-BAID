# swiftclaw Phase 2: 工具系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task in parallel where possible.

**Goal:** 实现核心工具系统，包括文件工具、Bash 工具、浏览器工具和工具调用循环

**Architecture:** 采用工具注册模式，每个工具实现统一接口，Agent 运行时通过工具调度器调用

**Tech Stack:** Python 3.12+, Playwright, Docker SDK

---

## 文件结构概览

| 文件 | 职责 |
|------|------|
| `tools/base.py` | 工具基类定义 |
| `tools/file.py` | 文件工具实现 |
| `tools/bash.py` | Bash 工具实现 |
| `tools/browser.py` | 浏览器工具实现 |
| `tools/registry.py` | 工具注册与管理 |
| `agent/tool_loop.py` | 工具调用循环 |
| `tests/unit/tools/test_file.py` | 文件工具测试 |
| `tests/unit/tools/test_bash.py` | Bash 工具测试 |
| `tests/unit/tools/test_browser.py` | 浏览器工具测试 |
| `docker/Dockerfile.sandbox` | Bash 沙箱镜像 |

---

## 任务分解

### Task 1: 文件工具（File Tools）- 可并行

**描述**: 实现文件读取、写入、列表工具

**Files:**
- Create: `tools/base.py`
- Create: `tools/file.py`
- Create: `tests/unit/tools/test_file.py`

**功能规格**:
- `file_read(path: str) -> str`: 读取文本文件，支持编码自动检测，限制文件大小（默认 1MB）
- `file_write(path: str, content: str, append: bool = False) -> None`: 写入文件，支持追加模式
- `file_list(directory: str) -> list[dict]`: 列出目录内容，返回文件/目录信息

**安全限制**:
- 只能在指定工作目录内操作
- 禁止访问父目录（`..`）
- 文件大小限制（防止大文件导致内存溢出）

---

### Task 2: Bash 工具（Bash Tools）- 可并行

**描述**: 实现带 Docker 沙箱的 Bash 命令执行

**Files:**
- Create: `tools/bash.py`
- Create: `docker/Dockerfile.sandbox`
- Create: `docker/sandbox-entrypoint.sh`
- Create: `tests/unit/tools/test_bash.py`

**功能规格**:
- `bash_execute(command: str, timeout: int = 30) -> dict`: 执行 shell 命令
- 超时控制（默认 30s，可配置）
- 输出限制（stdout/stderr 截断到 10KB）
- Docker 沙箱隔离执行

**Docker 沙箱要求**:
- 基于 alpine:latest 镜像
- 挂载只读工作目录
- 网络隔离（可选）
- 资源限制（CPU、内存）

---

### Task 3: 浏览器工具（Browser Tools）- 可并行

**描述**: 实现 Playwright 浏览器自动化工具

**Files:**
- Create: `tools/browser.py`
- Create: `tests/unit/tools/test_browser.py`

**功能规格**:
- `browser_open(url: str) -> dict`: 打开指定 URL，返回页面标题和 URL
- `browser_screenshot(url: str, path: str) -> str`: 截图保存到指定路径
- `browser_click(selector: str) -> bool`: 点击页面元素
- `browser_extract() -> str`: 提取页面文本内容

**限制**:
- 单页面模式（复用 browser context）
- 页面加载超时 30s
- 截图文件大小限制

---

### Task 4: 工具调用循环（Tool Loop）- 依赖 Task 1-3

**描述**: 实现 Agent 工具调用循环，集成所有工具

**Files:**
- Create: `tools/registry.py`
- Create: `agent/tool_loop.py`
- Create: `tests/unit/agent/test_tool_loop.py`
- Modify: `agent/llm.py` - 添加工具调用支持

**功能规格**:
- 工具注册表模式
- LLM 判断是否需要工具
- 工具执行并返回结果
- 结果反馈给 LLM 生成回复

**工具调用流程**:
```
用户输入 → LLM 判断是否需要工具 → 解析工具调用 → 执行工具 →
结果返回 LLM → LLM 生成最终回复
```

---

## 自我审查检查清单

### Spec 覆盖检查

| PRD 需求 | 对应任务 | 状态 |
|----------|----------|------|
| 文件工具（读/写/列表）| Task 1 | ✅ |
| Bash 工具（带 Docker 沙箱）| Task 2 | ✅ |
| 浏览器工具（Playwright）| Task 3 | ✅ |
| 工具调用循环 | Task 4 | ✅ |

### 依赖关系

```
Task 1 (File) ───┐
Task 2 (Bash) ───┼──→ Task 4 (Tool Loop)
Task 3 (Browser)─┘
```

**并行策略**: Task 1、2、3 可以并行执行，Task 4 需要等前三个完成。

---

## 执行建议

1. **第一轮并行**: 同时启动 Task 1、Task 2、Task 3
2. **第二轮**: 等 Task 1-3 完成后，执行 Task 4

每个任务完成后需要：
- 单元测试通过
- 类型检查通过
- 代码审查通过
