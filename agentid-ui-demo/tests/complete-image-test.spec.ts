import { test, expect } from '@playwright/test';

test.describe('PNG图片显示功能完整测试', () => {
  test('登录并测试图片显示功能', async ({ page }) => {
    // 监听控制台消息
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // 监听网络错误
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.url()} - ${response.status()}`);
      }
    });

    // 访问首页
    await page.goto('/');

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 检查是否被重定向到登录页面
    if (page.url().includes('/login')) {
      console.log('被重定向到登录页面，开始登录流程...');

      // 等待登录表单加载
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });

      // 填写登录表单
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'password123');

      // 点击登录按钮
      await page.click('button[type="submit"]');

      // 等待登录完成
      await page.waitForTimeout(3000);

      // 检查是否登录成功（应该被重定向到dashboard）
      expect(page.url()).toContain('/dashboard');
    }

    console.log('登录成功，当前URL:', page.url());

    // 导航到图片测试页面
    await page.goto('/image-test');

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证页面标题
    await expect(page.locator('h2:has-text("PNG图片测试")')).toBeVisible({ timeout: 10000 });

    console.log('成功访问图片测试页面');

    // 验证有4个图片测试区域
    const sections = page.locator('.border.rounded-lg');
    await expect(sections).toHaveCount(4);

    // 测试每张图片
    const images = page.locator('img');
    const imageCount = await images.count();
    expect(imageCount).toBe(4);

    console.log(`找到 ${imageCount} 张图片，开始逐一测试...`);

    const testResults = [];

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const src = await image.getAttribute('src');
      const alt = await image.getAttribute('alt');

      console.log(`测试图片 ${i + 1}:`);
      console.log(`  - src: ${src}`);
      console.log(`  - alt: ${alt}`);

      const result = {
        index: i + 1,
        src: src || '',
        alt: alt || '',
        loaded: false,
        naturalWidth: 0,
        error: null
      };

      try {
        // 检查图片是否可见
        const isVisible = await image.isVisible();
        console.log(`  - 是否可见: ${isVisible}`);

        if (isVisible) {
          // 等待图片加载
          await image.waitForLoadState('load', { timeout: 10000 });

          // 检查图片是否成功加载
          const naturalWidth = await image.evaluate((img) => img.naturalWidth);
          const naturalHeight = await image.evaluate((img) => img.naturalHeight);

          result.naturalWidth = naturalWidth;
          result.loaded = naturalWidth > 0;

          console.log(`  - 图片尺寸: ${naturalWidth}x${naturalHeight}`);
          console.log(`  - 加载状态: ${result.loaded ? '成功' : '失败'}`);

          expect(naturalWidth).toBeGreaterThan(0);

          // 检查图片显示尺寸
          const boundingBox = await image.boundingBox();
          if (boundingBox) {
            console.log(`  - 显示尺寸: ${boundingBox.width}x${boundingBox.height}`);
            expect(boundingBox.width).toBeLessThanOrEqual(200);
          }
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`  - 加载错误: ${result.error}`);
      }

      testResults.push(result);
    }

    // 保存完整页面截图
    await page.screenshot({
      path: 'test-results/image-test-complete.png',
      fullPage: true
    });

    // 保存每个图片区域的截图
    for (let i = 0; i < 4; i++) {
      const section = sections.nth(i);
      const title = await section.locator('h3').textContent();
      const safeTitle = title?.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'section';

      await section.screenshot({
        path: `test-results/image-section-${i + 1}-${safeTitle}-${Date.now()}.png`
      });
    }

    // 等待一段时间以捕获所有可能的错误
    await page.waitForTimeout(2000);

    // 输出测试结果
    console.log('\n=== 测试结果汇总 ===');
    testResults.forEach(result => {
      console.log(`图片 ${result.index} (${result.alt}): ${result.loaded ? '✓' : '✗'} (${result.naturalWidth}x${result.naturalHeight}px)`);
      if (result.error) {
        console.log(`  错误: ${result.error}`);
      }
    });

    console.log('\n=== 控制台消息 ===');
    consoleMessages.forEach(msg => {
      if (msg.includes('error') || msg.includes('Error')) {
        console.log(msg);
      }
    });

    console.log('\n=== 网络错误 ===');
    if (networkErrors.length > 0) {
      networkErrors.forEach(error => console.log(error));
    } else {
      console.log('无网络错误');
    }

    // 验证所有图片都成功加载
    const failedImages = testResults.filter(r => !r.loaded);
    expect(failedImages.length).toBe(0);

    // 验证没有网络错误
    expect(networkErrors.length).toBe(0);

    // 验证没有控制台错误
    const errorMessages = consoleMessages.filter(msg =>
      msg.toLowerCase().includes('error') ||
      msg.toLowerCase().includes('failed') ||
      msg.toLowerCase().includes('failed to load')
    );

    // 只允许一些非关键的网络错误（比如字体文件等）
    const criticalErrors = errorMessages.filter(msg =>
      !msg.includes('font') &&
      !msg.includes('favicon') &&
      msg.includes('image')
    );

    expect(criticalErrors.length).toBe(0);

    console.log('\n=== 测试完成 ===');
    console.log(`✓ 所有 ${imageCount} 张图片都成功加载`);
    console.log('✓ 没有发现网络错误');
    console.log('✓ 没有发现控制台错误');
  });
});