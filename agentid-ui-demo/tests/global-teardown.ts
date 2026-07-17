import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 开始全局清理...');

  // 可以在这里进行一些清理操作
  // 例如：删除测试数据、清理数据库等

  console.log('✅ 全局清理完成');
}

export default globalTeardown;