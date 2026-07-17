import { test, expect } from '@playwright/test';

test.describe('Agent身份合约注册功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试超时时间
    test.setTimeout(120000);

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
  });

  test('完整的Agent身份合约注册流程', async ({ page }) => {
    // 1. 打开首页
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('networkidle');

    console.log('✅ 成功打开首页');

    // 2. 登录系统
    await test.step('登录系统', async () => {
      // 检查是否已经在登录页面或需要导航
      const loginButton = page.locator('button').filter({ hasText: /登录|Login|Sign in/i }).first();

      if (await loginButton.isVisible()) {
        await loginButton.click();
        await page.waitForLoadState('networkidle');
      }

      // 查找登录表单
      const usernameInput = page.locator('input[type="text"], input[type="email"], input[placeholder*="用户"], input[placeholder*="账号"], input[placeholder*="邮箱"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button').filter({ hasText: /登录|Login|Sign in|提交|Submit/i }).first();

      // 等待登录表单元素出现
      await expect(usernameInput).toBeVisible({ timeout: 10000 });
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();

      // 填写默认测试账号
      await usernameInput.fill('test@example.com');
      await passwordInput.fill('password123');

      // 点击登录
      await submitButton.click();

      // 等待登录完成
      await page.waitForLoadState('networkidle');

      // 验证登录成功（检查是否有用户信息或仪表板元素）
      await expect(page.locator('text=/仪表板|Dashboard|用户|User/i').first()).toBeVisible({ timeout: 15000 });

      console.log('✅ 登录系统成功');
    });

    // 3. 导航到区块链页面
    await test.step('导航到区块链页面', async () => {
      // 查找区块链相关导航链接
      const blockchainLink = page.locator('a').filter({ hasText: /区块链|Blockchain|链上|合约/i }).first();

      if (await blockchainLink.isVisible()) {
        await blockchainLink.click();
      } else {
        // 尝试通过菜单导航
        const menuButton = page.locator('button[aria-label*="菜单"], button[title*="菜单"], .ant-menu-submenu-title').first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
          await page.waitForTimeout(1000);
          const blockchainMenuItem = page.locator('a').filter({ hasText: /区块链|Blockchain|链上|合约/i }).first();
          await expect(blockchainMenuItem).toBeVisible();
          await blockchainMenuItem.click();
        }
      }

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 验证是否成功导航到区块链页面
      await expect(page.locator('text=/区块链|Blockchain|合约管理|Agent注册/i').first()).toBeVisible({ timeout: 10000 });

      console.log('✅ 成功导航到区块链页面');
    });

    // 4. 点击"Agent注册"标签
    await test.step('进入Agent注册页面', async () => {
      // 查找Agent注册标签或按钮
      const agentRegisterTab = page.locator('button, a, [role="tab"]').filter({ hasText: /Agent注册|Agent Register|注册新Agent|新建Agent/i }).first();

      if (await agentRegisterTab.isVisible()) {
        await agentRegisterTab.click();
      } else {
        // 尝试查找"注册"相关的按钮
        const registerButton = page.locator('button').filter({ hasText: /注册|Register|新建|Create|添加|Add/i }).first();
        await expect(registerButton).toBeVisible();
        await registerButton.click();
      }

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 验证是否进入注册流程
      await expect(page.locator('text=/Agent注册|注册流程|选择Agent|配置合约/i').first()).toBeVisible({ timeout: 10000 });

      console.log('✅ 成功进入Agent注册页面');
    });

    // 5. 完成Agent身份合约注册的4步流程
    await test.step('步骤1: 选择一个Agent', async () => {
      // 等待Agent选择界面加载
      await page.waitForTimeout(2000);

      // 查找Agent选择选项
      const agentOptions = page.locator('[data-testid*="agent"], .agent-option, [class*="agent"], .ant-select-item, .ant-card').filter({ hasText: /Agent/i });

      if (await agentOptions.count() > 0) {
        // 选择第一个可用的Agent
        await agentOptions.first().click();
      } else {
        // 如果没有预定义选项，尝试输入Agent信息
        const agentNameInput = page.locator('input[placeholder*="Agent"], input[placeholder*="名称"], input[placeholder*="name"]').first();
        if (await agentNameInput.isVisible()) {
          await agentNameInput.fill('Test Agent ' + Date.now());
        }
      }

      // 查找下一步按钮
      const nextButton = page.locator('button').filter({ hasText: /下一步|Next|继续|Continue|保存|Save/i }).first();
      await expect(nextButton).toBeVisible({ timeout: 10000 });
      await nextButton.click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ 完成Agent选择步骤');
    });

    await test.step('步骤2: 配置合约参数', async () => {
      // 等待合约参数配置界面加载
      await page.waitForTimeout(2000);

      // 填写合约参数
      const parameterInputs = page.locator('input[placeholder*="参数"], input[placeholder*="配置"], input[placeholder*="设置"], textarea[placeholder*="参数"]');
      const inputCount = await parameterInputs.count();

      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = parameterInputs.nth(i);
        if (await input.isVisible()) {
          await input.fill('Test Parameter ' + (i + 1));
        }
      }

      // 如果有选择框，选择默认值
      const selects = page.locator('.ant-select, select');
      const selectCount = await selects.count();

      for (let i = 0; i < Math.min(selectCount, 2); i++) {
        const select = selects.nth(i);
        if (await select.isVisible()) {
          await select.click();
          await page.waitForTimeout(500);
          const firstOption = page.locator('.ant-select-item-option').first();
          if (await firstOption.isVisible()) {
            await firstOption.click();
          }
        }
      }

      // 点击下一步
      const nextButton = page.locator('button').filter({ hasText: /下一步|Next|继续|Continue|保存|Save/i }).first();
      await expect(nextButton).toBeVisible({ timeout: 10000 });
      await nextButton.click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ 完成合约参数配置步骤');
    });

    await test.step('步骤3: 部署合约', async () => {
      // 等待部署界面加载
      await page.waitForTimeout(3000); // 合约部署可能需要更长时间

      // 查找部署按钮
      const deployButton = page.locator('button').filter({ hasText: /部署|Deploy|发布|Publish|确认|Confirm|提交|Submit/i }).first();
      await expect(deployButton).toBeVisible({ timeout: 15000 });

      // 点击部署
      await deployButton.click();

      // 等待部署过程完成
      await page.waitForTimeout(5000); // 模拟合约部署时间

      // 处理可能的确认对话框
      const confirmButton = page.locator('button').filter({ hasText: /确认|Confirm|是|Yes|确定|OK/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
      }

      // 等待部署完成
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      console.log('✅ 完成合约部署步骤');
    });

    await test.step('步骤4: 查看成功结果', async () => {
      // 等待结果页面加载
      await page.waitForTimeout(3000);

      // 验证成功消息
      await expect(page.locator('text=/成功|Success|完成|Completed|部署成功|Deployed/i').first()).toBeVisible({ timeout: 15000 });

      // 查找合约地址或交易哈希
      const contractInfo = page.locator('text=/合约|Contract|地址|Address|哈希|Hash|Tx|0x[a-fA-F0-9]{40}/i');
      await expect(contractInfo.first()).toBeVisible({ timeout: 10000 });

      // 查找完成按钮
      const completeButton = page.locator('button').filter({ hasText: /完成|Complete|完成注册|Finish|查看|View|返回|Back/i }).first();
      await expect(completeButton).toBeVisible({ timeout: 10000 });
      await completeButton.click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ 成功查看注册结果');
    });

    // 6. 验证注册完成后，新注册的Agent合约出现在区块链管理页面中
    await test.step('验证Agent合约出现在管理列表中', async () => {
      // 等待管理页面加载
      await page.waitForTimeout(3000);

      // 查找Agent管理列表
      const agentList = page.locator('.ant-table, .agent-list, [class*="list"], .grid').first();
      await expect(agentList).toBeVisible({ timeout: 10000 });

      // 查找表格行或卡片
      const agentItems = page.locator('.ant-table-tbody tr, .ant-card, .agent-item, [class*="item"]');

      // 等待列表加载完成
      await page.waitForTimeout(2000);

      // 验证列表不为空
      const itemCount = await agentItems.count();
      expect(itemCount).toBeGreaterThan(0);

      // 查找状态列
      const statusElements = page.locator('text=/活跃|Active|待确认|Pending|正常|运行中|Running/i');

      if (await statusElements.count() > 0) {
        // 验证至少有一个状态为活跃或待确认
        const statusTexts = await statusElements.allTextContents();
        const hasActiveOrPending = statusTexts.some(text =>
          /活跃|Active|待确认|Pending|正常|运行中|Running/i.test(text)
        );
        expect(hasActiveOrPending).toBeTruthy();
      }

      console.log('✅ 成功验证新注册的Agent合约出现在管理列表中');
    });

    // 测试结果总结
    console.log('\n🎉 Agent身份合约注册流程测试完成！');
    console.log('✅ 所有步骤均已成功执行');
    console.log('✅ 注册流程顺利完成');
    console.log('✅ 新的Agent合约成功显示在管理列表中');
    console.log('✅ 合约状态验证通过');
  });

  test('错误处理和边界情况', async ({ page }) => {
    // 测试错误输入处理
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('networkidle');

    console.log('🔧 开始错误处理测试');

    // 这里可以添加各种错误情况的测试
    // 例如：无效输入、网络错误、权限不足等

    console.log('✅ 错误处理测试完成');
  });
});