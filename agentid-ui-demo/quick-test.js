import { chromium } from '@playwright/test';

async function quickTest() {
  console.log('🚀 开始快速环境测试...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 测试1: 访问首页
    console.log('📱 测试访问首页...');
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('networkidle');
    console.log('✅ 首页访问成功');

    // 测试2: 检查页面标题
    const title = await page.title();
    console.log(`📄 页面标题: ${title}`);

    // 测试3: 截图
    await page.screenshot({ path: 'quick-test-screenshot.png' });
    console.log('📸 截图保存成功');

    // 测试4: 查找关键元素
    const loginButton = page.locator('button').filter({ hasText: /登录|Login|Sign in/i }).first();
    const hasLoginButton = await loginButton.isVisible();
    console.log(`🔐 登录按钮: ${hasLoginButton ? '找到' : '未找到'}`);

    const navLinks = page.locator('a').count();
    console.log(`🔗 导航链接: ${navLinks}个`);

    console.log('✅ 快速环境测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);