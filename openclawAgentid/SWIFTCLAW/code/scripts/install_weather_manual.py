#!/usr/bin/env python3
"""手动安装天气查询 skill"""

import os
import shutil
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).parent.parent

# 创建本地 skill 目录
local_skill_dir = project_root / 'skills' / 'local' / 'weather-query'
os.makedirs(local_skill_dir, exist_ok=True)

# 复制 skill 文件
source_file = project_root / 'skills' / 'examples' / 'weather-query.md'
target_file = local_skill_dir / 'skill.md'

shutil.copy2(source_file, target_file)

print(f"✅ 天气查询 Skill 安装成功！")
print(f"📁 安装路径: {target_file}")
print(f"📦 Skill 名称: weather-query")
print(f"🔖 版本: 1.0.0")
print(f"\n💡 使用方法：")
print(f"   当用户询问天气时，AI 会自动使用此 skill")
print(f"   例如：'北京今天天气怎么样？'")
