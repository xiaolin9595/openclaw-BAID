# 天气查询 Skill 安装说明

## 📦 已创建的文件

1. **Skill 文件**: `skills/examples/weather-query.md`
   - 包含天气查询的完整逻辑和说明
   - 支持查询当前天气和未来预报

2. **安装脚本**: `scripts/install_weather_skill.py`
   - 用于将 skill 安装到系统中

## 🚀 安装步骤

### 方式一：使用安装脚本（推荐）

```bash
# 在项目根目录执行
python3 scripts/install_weather_skill.py
```

### 方式二：手动安装

1. 复制 skill 文件到本地 skills 目录：
```bash
cp skills/examples/weather-query.md skills/local/weather-query/skill.md
```

2. 在你的应用代码中加载 skill

## 📖 Skill 使用方法

安装完成后，当用户询问天气时，AI 会自动使用此 skill：

**示例对话：**
```
用户：北京今天天气怎么样？
AI：🌤️ 北京 天气信息

📍 当前天气：
   • 温度：15°C
   • 状况：多云
   • 湿度：45%
   • 风速：3级
```

## ⚙️ Skill 参数

- `city`: 城市名称（必填）
- `days`: 预报天数，默认 1 天，最多 7 天

## 🔧 依赖工具

此 skill 依赖 `web_search` 工具来搜索天气信息。

## 📝 Skill 内容预览

```yaml
name: weather-query
description: 查询指定城市的天气信息
tools:
  - web_search
version: 1.0.0
```

---

✅ 天气查询 Skill 已准备就绪！
