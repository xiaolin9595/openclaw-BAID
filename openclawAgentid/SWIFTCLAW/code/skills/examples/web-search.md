---
name: web-search
description: 搜索网页并返回结构化结果
tools:
  - web_search
params:
  count:
    type: integer
    default: 5
    description: 搜索结果数量
version: 1.0.0
author: swiftclaw-team
---

# Web Search Skill

## 使用场景
当用户需要搜索网络信息时，使用此 Skill 执行网页搜索并返回结构化的结果。

## 工作流程
1. 分析搜索意图，提取关键查询词
2. 使用 web_search 工具执行搜索
3. 整理搜索结果，去除重复和低质量内容
4. 返回结构化的搜索结果列表

## 参数说明
- `count`: 控制返回的搜索结果数量（默认 5，最大 10）

## 返回格式
```json
{
  "query": "原始搜索词",
  "results": [
    {
      "title": "结果标题",
      "url": "结果链接",
      "snippet": "结果摘要"
    }
  ]
}
```

## 示例

### 输入
```
搜索：Python 异步编程最佳实践
```

### 输出
```json
{
  "query": "Python 异步编程最佳实践",
  "results": [
    {
      "title": "Python Asyncio 完全指南",
      "url": "https://example.com/async-guide",
      "snippet": "本文深入介绍 Python asyncio 的使用方法和最佳实践..."
    }
  ]
}
```
