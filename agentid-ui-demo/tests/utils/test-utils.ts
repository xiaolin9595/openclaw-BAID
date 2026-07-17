import { Page } from '@playwright/test';

/**
 * 等待元素出现并点击
 */
export async function waitAndClick(page: Page, selector: string, timeout = 10000): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  await element.click();
}

/**
 * 等待元素出现并填充文本
 */
export async function waitAndFill(page: Page, selector: string, text: string, timeout = 10000): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  await element.fill(text);
}

/**
 * 等待导航完成
 */
export async function waitForNavigation(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * 获取随机测试数据
 */
export function getTestData() {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 10000);

  return {
    email: `test${timestamp}@example.com`,
    username: `testuser${timestamp}`,
    agentName: `Test Agent ${timestamp}`,
    contractName: `Test Contract ${randomId}`,
    timestamp,
    randomId
  };
}

/**
 * 验证元素文本包含预期内容
 */
export async function verifyTextContains(page: Page, selector: string, expectedText: string, timeout = 10000): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  const text = await element.textContent();
  expect(text).toContain(expectedText);
}

/**
 * 截图并保存到指定路径
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `./test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true
  });
}

/**
 * 记录测试步骤
 */
export function logStep(step: string): void {
  console.log(`📍 ${step}`);
}

/**
 * 等待指定时间
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}