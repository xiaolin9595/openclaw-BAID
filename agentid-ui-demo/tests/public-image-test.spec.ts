import { test, expect } from '@playwright/test';

test.describe('PNG图片显示功能公开路由测试', () => {
  test('直接访问公开图片测试页面', async ({ page }) => {
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

    console.log('开始测试图片显示功能...');

    // 直接访问公开图片测试页面
    await page.goto('/public-image-test');

    // 等待页面加载
    await page.waitForTimeout(3000);

    console.log('当前页面URL:', page.url());
    console.log('页面标题:', await page.title());

    // 保存初始页面截图
    await page.screenshot({
      path: 'test-results/public-image-test-initial.png',
      fullPage: true
    });

    // 获取页面内容用于调试
    const bodyText = await page.locator('body').textContent();
    console.log('页面内容预览:', bodyText?.substring(0, 300));

    // 尝试查找图片测试标题
    try {
      await page.waitForSelector('h2:has-text("PNG图片测试")', { timeout: 10000 });
      console.log('✓ 成功找到图片测试页面标题');
    } catch (error) {
      console.log('✗ 未找到图片测试页面标题');
      // 保存当前页面状态
      await page.screenshot({
        path: 'test-results/no-title-found.png',
        fullPage: true
      });
      throw error;
    }

    // 验证有4个图片测试区域
    const sections = page.locator('.border.rounded-lg');
    const sectionCount = await sections.count();
    console.log(`找到 ${sectionCount} 个测试区域`);

    expect(sectionCount).toBe(4);

    // 测试每张图片
    const images = page.locator('img');
    const imageCount = await images.count();
    console.log(`找到 ${imageCount} 张图片`);

    expect(imageCount).toBe(4);

    const testResults = [];

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const src = await image.getAttribute('src');
      const alt = await image.getAttribute('alt');

      console.log(`\n--- 测试图片 ${i + 1} ---`);
      console.log(`src: ${src}`);
      console.log(`alt: ${alt}`);

      const result = {
        index: i + 1,
        src: src || '',
        alt: alt || '',
        loaded: false,
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        error: null,
        imageType: ''
      };

      try {
        // 判断图片类型
        if (src?.startsWith('/')) {
          result.imageType = 'public目录';
        } else if (src?.startsWith('data:image')) {
          result.imageType = 'Base64编码';
        } else if (src?.startsWith('http')) {
          result.imageType = '在线URL';
        } else {
          result.imageType = 'Assets目录';
        }

        // 检查图片是否可见
        const isVisible = await image.isVisible();
        console.log(`是否可见: ${isVisible}`);

        if (isVisible) {
          // 等待图片加载
          await page.waitForTimeout(2000);

          // 获取图片自然尺寸
          const naturalWidth = await image.evaluate((img) => img.naturalWidth);
          const naturalHeight = await image.evaluate((img) => img.naturalHeight);

          result.naturalWidth = naturalWidth;
          result.naturalHeight = naturalHeight;
          result.loaded = naturalWidth > 0;

          console.log(`自然尺寸: ${naturalWidth}x${naturalHeight}`);
          console.log(`加载状态: ${result.loaded ? '成功' : '失败'}`);

          // 获取图片显示尺寸
          const boundingBox = await image.boundingBox();
          if (boundingBox) {
            result.displayWidth = boundingBox.width;
            result.displayHeight = boundingBox.height;
            console.log(`显示尺寸: ${boundingBox.width}x${boundingBox.height}`);
          }

          // 验证图片成功加载
          expect(naturalWidth).toBeGreaterThan(0);
          expect(naturalHeight).toBeGreaterThan(0);

          // 验证显示尺寸不超过200px
          expect(boundingBox!.width).toBeLessThanOrEqual(200);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`加载错误: ${result.error}`);
      }

      testResults.push(result);
    }

    // 保存完整页面截图
    await page.screenshot({
      path: 'test-results/public-image-test-complete.png',
      fullPage: true
    });

    // 保存每个图片区域的截图
    for (let i = 0; i < sectionCount; i++) {
      const section = sections.nth(i);
      const title = await section.locator('h3').textContent();
      const safeTitle = title?.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'section';

      await section.screenshot({
        path: `test-results/public-image-section-${i + 1}-${safeTitle}.png`
      });
    }

    // 等待一段时间以捕获所有可能的错误
    await page.waitForTimeout(2000);

    // 输出详细测试结果
    console.log('\n=== 详细测试结果 ===');
    testResults.forEach(result => {
      console.log(`\n图片 ${result.index} (${result.imageType}):`);
      console.log(`  - 描述: ${result.alt}`);
      console.log(`  - 加载状态: ${result.loaded ? '✓' : '✗'}`);
      console.log(`  - 自然尺寸: ${result.naturalWidth}x${result.naturalHeight}px`);
      console.log(`  - 显示尺寸: ${result.displayWidth}x${result.displayHeight}px`);
      if (result.error) {
        console.log(`  - 错误: ${result.error}`);
      }
    });

    // 统计结果
    const successfulImages = testResults.filter(r => r.loaded);
    const failedImages = testResults.filter(r => !r.loaded);

    console.log('\n=== 统计结果 ===');
    console.log(`成功加载: ${successfulImages.length}/${testResults.length}`);
    console.log(`加载失败: ${failedImages.length}/${testResults.length}`);

    // 输出控制台消息
    console.log('\n=== 控制台消息 ===');
    const errorMessages = consoleMessages.filter(msg =>
      msg.toLowerCase().includes('error') ||
      msg.toLowerCase().includes('failed') ||
      msg.toLowerCase().includes('failed to load')
    );

    if (errorMessages.length > 0) {
      errorMessages.forEach(msg => console.log(msg));
    } else {
      console.log('无错误消息');
    }

    // 输出网络错误
    console.log('\n=== 网络错误 ===');
    if (networkErrors.length > 0) {
      networkErrors.forEach(error => console.log(error));
    } else {
      console.log('无网络错误');
    }

    // 最终验证
    console.log('\n=== 最终验证 ===');
    expect(successfulImages.length).toBe(testResults.length);
    expect(networkErrors.length).toBe(0);

    // 只允许非关键的控制台错误
    const criticalErrors = errorMessages.filter(msg =>
      !msg.includes('font') &&
      !msg.includes('favicon') &&
      (msg.includes('image') || msg.includes('img'))
    );

    if (criticalErrors.length > 0) {
      console.log(`发现 ${criticalErrors.length} 个关键错误:`);
      criticalErrors.forEach(msg => console.log(msg));
    }
    expect(criticalErrors.length).toBe(0);

    console.log('\n✓ 图片测试完成！');
    console.log(`✓ 所有 ${testResults.length} 张图片都成功加载`);
    console.log('✓ 没有发现网络错误');
    console.log('✓ 没有发现关键控制台错误');

    // 生成测试报告
    const report = {
      testTime: new Date().toISOString(),
      totalImages: testResults.length,
      successfulImages: successfulImages.length,
      failedImages: failedImages.length,
      networkErrors: networkErrors.length,
      consoleErrors: criticalErrors.length,
      results: testResults,
      consoleMessages: consoleMessages,
      networkErrors: networkErrors
    };

    // 保存测试报告
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(process.cwd(), 'test-results', 'image-test-report.json');

    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n测试报告已保存到: ${reportPath}`);
  });
});