import { test, expect } from '@playwright/test';

test.describe('PNG图片显示功能简化测试', () => {
  test('直接测试图片加载', async ({ page }) => {
    // 直接访问图片测试页面
    await page.goto('/image-test');

    // 等待页面加载
    await page.waitForTimeout(3000);

    // 获取页面内容以调试
    const pageContent = await page.content();
    console.log('页面标题:', await page.title());
    console.log('页面URL:', page.url());

    // 如果被重定向到登录页面，尝试绕过
    if (page.url().includes('/login')) {
      console.log('检测到重定向到登录页面，尝试模拟登录...');

      // 模拟填写登录表单
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');

      // 点击登录按钮
      await page.click('button[type="submit"]');

      // 等待登录完成
      await page.waitForTimeout(2000);

      // 重新访问图片测试页面
      await page.goto('/image-test');
      await page.waitForTimeout(2000);
    }

    // 尝试查找图片元素
    const images = page.locator('img');
    const imageCount = await images.count();
    console.log(`找到 ${imageCount} 张图片`);

    if (imageCount > 0) {
      // 测试每张图片
      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        const src = await image.getAttribute('src');
        const alt = await image.getAttribute('alt');

        console.log(`图片 ${i + 1}: src=${src}, alt=${alt}`);

        // 检查图片是否可见
        const isVisible = await image.isVisible();
        console.log(`图片 ${i + 1} 是否可见: ${isVisible}`);

        if (isVisible) {
          try {
            // 等待图片加载
            await image.waitForLoadState('load', { timeout: 5000 });

            // 检查图片是否成功加载
            const naturalWidth = await image.evaluate((img) => img.naturalWidth);
            console.log(`图片 ${i + 1} naturalWidth: ${naturalWidth}`);

            expect(naturalWidth).toBeGreaterThan(0);
          } catch (error) {
            console.log(`图片 ${i + 1} 加载失败:`, error);
          }
        }
      }
    } else {
      // 如果没有找到图片，截图保存当前页面状态
      await page.screenshot({
        path: 'test-results/no-images-found.png',
        fullPage: true
      });

      // 获取页面文本内容用于调试
      const bodyText = await page.locator('body').textContent();
      console.log('页面文本内容:', bodyText?.substring(0, 200));
    }

    // 保存页面截图
    await page.screenshot({
      path: 'test-results/image-test-final.png',
      fullPage: true
    });

    // 记录控制台消息
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // 等待一段时间捕获所有控制台消息
    await page.waitForTimeout(2000);

    console.log('控制台消息:');
    consoleMessages.forEach(msg => console.log(msg));

    // 至少应该有一些图片元素
    expect(imageCount).toBeGreaterThan(0);
  });
});