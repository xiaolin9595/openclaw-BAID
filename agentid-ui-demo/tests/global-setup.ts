import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 开始全局设置...');

  // 可以在这里进行一些全局初始化操作
  // 例如：创建测试数据、初始化数据库等

  console.log('✅ 全局设置完成');
}

export default globalSetup;