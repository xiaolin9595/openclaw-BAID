#!/usr/bin/env python3
"""Install weather query skill."""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from skills.manager import SkillManager


async def install_weather_skill():
    """Install the weather query skill."""
    manager = SkillManager(
        global_dir=project_root / 'skills' / 'global',
        project_dir=project_root / 'skills' / 'local',
        db_path=project_root / 'skills' / 'skills.db'
    )
    
    await manager.initialize()
    
    # Install the weather skill from local file
    result = await manager.install(
        source=str(project_root / 'skills' / 'examples' / 'weather-query.md'),
        is_local=True
    )
    
    print(f"✅ Success: {result.success}")
    print(f"📦 Skill Name: {result.skill_name}")
    print(f"🔖 Version: {result.version}")
    print(f"💬 Message: {result.message}")
    
    # List all installed skills
    print("\n📋 已安装的 Skills:")
    skills = await manager.list_skills()
    for skill in skills:
        print(f"   • {skill.name} (v{skill.version}) - {skill.description}")
    
    await manager.close()


if __name__ == "__main__":
    asyncio.run(install_weather_skill())
