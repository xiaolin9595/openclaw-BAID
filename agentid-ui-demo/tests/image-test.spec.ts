import { test, expect } from '@playwright/test';

test.describe('PNG图片显示功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 先访问首页模拟登录状态
    await page.goto('/');

    // 由于有认证保护，我们需要模拟登录状态
    // 通过设置localStorage来模拟认证状态
    await page.addInitScript(() => {
      // 模拟Zustand store的初始状态
      const localStorageMock = {
        auth: JSON.stringify({
          state: {
            user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
            isAuthenticated: true,
            authSession: null,
            loading: false,
            error: null
          }
        })
      };

      Object.entries(localStorageMock).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    });

    // 重新加载页面以应用认证状态
    await page.reload();

    // 等待页面加载完成，然后导航到图片测试页面
    await page.waitForTimeout(1000);
    await page.goto('/image-test');

    // 等待页面加载完成
    await page.waitForSelector('h2:has-text("PNG图片测试")', { timeout: 10000 });
  });

  test('页面标题和结构正确', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/AgentID UI Demo/);

    // 验证主要标题
    const mainTitle = page.locator('h2');
    await expect(mainTitle).toHaveText('PNG图片测试');

    // 验证有4个图片测试区域
    const imageSections = page.locator('.border.rounded-lg');
    await expect(imageSections).toHaveCount(4);
  });

  test('Public目录PNG图片加载测试', async ({ page }) => {
    const section = page.locator('.border.rounded-lg').first();
    const title = section.locator('h3');
    const image = section.locator('img');
    const description = section.locator('p.text-sm');

    // 验证标题
    await expect(title).toHaveText('Public目录PNG测试');

    // 验证描述
    await expect(description).toHaveText('路径: /test-image.png');

    // 验证图片存在
    await expect(image).toBeVisible();

    // 验证图片属性
    await expect(image).toHaveAttribute('alt', 'Test PNG from public directory');
    await expect(image).toHaveAttribute('src', '/test-image.png');

    // 等待图片加载
    await image.waitForLoadState('load');

    // 验证图片是否成功加载（检查naturalWidth）
    const naturalWidth = await image.evaluate((img) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // 验证图片尺寸
    const boundingBox = await image.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(200);
  });

  test('Assets目录PNG图片加载测试', async ({ page }) => {
    const sections = page.locator('.border.rounded-lg');
    const section = sections.nth(1);
    const title = section.locator('h3');
    const image = section.locator('img');
    const description = section.locator('p.text-sm');

    // 验证标题
    await expect(title).toHaveText('Assets目录PNG测试');

    // 验证描述
    await expect(description).toHaveText('路径: src/assets/test-image-2.png (通过import)');

    // 验证图片存在
    await expect(image).toBeVisible();

    // 验证图片属性
    await expect(image).toHaveAttribute('alt', 'Test PNG from assets directory');

    // 等待图片加载
    await image.waitForLoadState('load');

    // 验证图片是否成功加载（检查naturalWidth）
    const naturalWidth = await image.evaluate((img) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // 验证图片尺寸
    const boundingBox = await image.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(200);
  });

  test('在线URL PNG图片加载测试', async ({ page }) => {
    const sections = page.locator('.border.rounded-lg');
    const section = sections.nth(2);
    const title = section.locator('h3');
    const image = section.locator('img');
    const description = section.locator('p.text-sm');

    // 验证标题
    await expect(title).toHaveText('在线PNG测试');

    // 验证描述
    await expect(description).toHaveText('路径: 在线图片URL');

    // 验证图片存在
    await expect(image).toBeVisible();

    // 验证图片属性
    await expect(image).toHaveAttribute('alt', 'Online PNG test');
    await expect(image).toHaveAttribute('src', 'https://via.placeholder.com/200x100/007bff/ffffff?text=PNG+Test');

    // 等待图片加载（增加超时时间，因为是在线图片）
    await image.waitForLoadState('load', { timeout: 10000 });

    // 验证图片是否成功加载（检查naturalWidth）
    const naturalWidth = await image.evaluate((img) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // 验证图片尺寸
    const boundingBox = await image.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(200);
  });

  test('Base64编码PNG图片加载测试', async ({ page }) => {
    const sections = page.locator('.border.rounded-lg');
    const section = sections.nth(3);
    const title = section.locator('h3');
    const image = section.locator('img');
    const description = section.locator('p.text-sm');

    // 验证标题
    await expect(title).toHaveText('Base64 PNG测试');

    // 验证描述
    await expect(description).toHaveText('格式: Base64编码');

    // 验证图片存在
    await expect(image).toBeVisible();

    // 验证图片属性
    await expect(image).toHaveAttribute('alt', 'Base64 PNG test');
    const src = await image.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);

    // 等待图片加载
    await image.waitForLoadState('load');

    // 验证图片是否成功加载（检查naturalWidth）
    const naturalWidth = await image.evaluate((img) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // 验证图片尺寸
    const boundingBox = await image.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(200);
  });

  test('所有图片成功加载且无错误', async ({ page }) => {
    // 监听控制台错误
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 监听网络错误
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.url()} - ${response.status()}`);
      }
    });

    // 等待所有图片加载
    const images = page.locator('img');
    const imageCount = await images.count();
    expect(imageCount).toBe(4);

    // 等待每张图片加载完成
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      await image.waitForLoadState('load', { timeout: 10000 });

      // 验证图片成功加载
      const naturalWidth = await image.evaluate((img) => img.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }

    // 等待一段时间以捕获所有可能的错误
    await page.waitForTimeout(2000);

    // 验证没有控制台错误
    expect(consoleErrors).toHaveLength(0);

    // 验证没有网络错误
    expect(networkErrors).toHaveLength(0);
  });

  test('页面截图保存', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    // 保存完整页面截图
    await page.screenshot({
      path: 'test-results/image-test-fullpage.png',
      fullPage: true
    });

    // 保存每个图片区域的截图
    const sections = page.locator('.border.rounded-lg');
    const sectionCount = await sections.count();

    for (let i = 0; i < sectionCount; i++) {
      const section = sections.nth(i);
      const title = await section.locator('h3').textContent();

      // 为每个区域创建截图
      await section.screenshot({
        path: `test-results/image-test-${title?.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.png`
      });
    }

    // 测试结果目录存在
    const fs = require('fs');
    const path = require('path');
    const testResultsDir = path.join(process.cwd(), 'test-results');

    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }
  });

  test('图片加载性能测试', async ({ page }) => {
    // 监听图片加载时间
    const loadTimes: number[] = [];

    page.on('load', () => {
      const timing = page.evaluate(() => performance.timing);
      // 这里可以添加更多性能指标
    });

    // 等待所有图片加载
    const images = page.locator('img');
    const imageCount = await images.count();

    // 记录开始时间
    const startTime = Date.now();

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const loadStartTime = Date.now();

      await image.waitForLoadState('load', { timeout: 10000 });

      const loadEndTime = Date.now();
      const loadTime = loadEndTime - loadStartTime;
      loadTimes.push(loadTime);

      // 每张图片应该在合理时间内加载完成
      expect(loadTime).toBeLessThan(5000); // 5秒内加载完成
    }

    // 记录总加载时间
    const totalTime = Date.now() - startTime;

    // 输出性能数据
    console.log(`图片加载时间统计:`);
    console.log(`- 总加载时间: ${totalTime}ms`);
    console.log(`- 平均每张图片加载时间: ${loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length}ms`);
    console.log(`- 最慢图片加载时间: ${Math.max(...loadTimes)}ms`);
    console.log(`- 最快图片加载时间: ${Math.min(...loadTimes)}ms`);

    // 所有图片应该在10秒内完成加载
    expect(totalTime).toBeLessThan(10000);
  });
});