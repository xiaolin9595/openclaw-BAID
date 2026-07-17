# Agent身份合约注册功能测试套件

## 概述

本测试套件专门用于测试Agent身份合约注册功能的完整流程，包括用户登录、导航、4步注册流程和结果验证。

## 测试场景

### 主要测试流程
1. **系统访问** - 打开应用首页
2. **用户登录** - 使用默认测试账号登录系统
3. **页面导航** - 导航到区块链管理页面
4. **注册入口** - 进入Agent注册流程
5. **4步注册流程**：
   - 步骤1: 选择一个Agent
   - 步骤2: 配置合约参数
   - 步骤3: 部署合约
   - 步骤4: 查看成功结果
6. **结果验证** - 验证新注册的Agent合约出现在管理列表中

### 预期结果
- ✅ 注册流程顺利完成
- ✅ 新的Agent合约成功显示在Agent管理列表中
- ✅ 合约状态为活跃或待确认

## 测试文件结构

```
tests/
├── README.md                           # 本文档
├── config/
│   └── test-config.json                # 测试配置文件
├── utils/
│   └── test-utils.ts                   # 测试工具函数
├── agent-contract-registration.spec.ts # 基础测试脚本
├── agent-registration-enhanced.spec.ts # 增强版测试脚本
├── global-setup.ts                     # 全局设置
├── global-teardown.ts                  # 全局清理
└── test-results/                      # 测试结果目录
    ├── screenshots/                    # 截图
    ├── reports/                       # 报告
    └── videos/                        # 录像
```

## 运行测试

### 前提条件
1. Node.js 已安装 (v16+)
2. 项目依赖已安装 (`npm install`)
3. 应用服务器正在运行 (http://localhost:8080 或 http://localhost:5173)

### 运行方式

#### 1. 使用自动化脚本（推荐）
```bash
# 运行完整测试套件
./run-tests.sh
```

#### 2. 手动运行测试
```bash
# 启动开发服务器（如果需要）
npm run dev

# 运行基础测试
npm run test -- tests/agent-contract-registration.spec.ts

# 运行增强版测试
npm run test -- tests/agent-registration-enhanced.spec.ts

# 运行所有测试
npm test

# 查看测试报告
npm run test:report
```

#### 3. 使用Playwright UI模式（调试）
```bash
# 启动UI模式调试
npm run test:ui

# 有头模式运行
npm run test:headed
```

## 测试配置

### 配置文件
测试配置位于 `tests/config/test-config.json`，包含：
- 测试环境URL
- 测试用户凭据
- 超时设置
- Agent注册参数
- 截图和报告设置

### 环境变量
```bash
# 设置测试环境
export BASE_URL=http://localhost:8080
export TEST_USER_EMAIL=test@example.com
export TEST_USER_PASSWORD=password123
```

## 测试工具函数

### test-utils.ts 提供的工具
- `waitAndClick()` - 等待元素出现并点击
- `waitAndFill()` - 等待元素出现并填充文本
- `waitForNavigation()` - 等待导航完成
- `getTestData()` - 生成随机测试数据
- `verifyTextContains()` - 验证文本内容
- `takeScreenshot()` - 截图保存
- `logStep()` - 记录测试步骤
- `delay()` - 延迟等待

## 测试结果

### 测试报告
- HTML报告: `playwright-report/index.html`
- 截图: `test-results/screenshots/`
- 录像: `test-results/videos/`

### 日志输出
测试过程中会输出详细的控制台日志：
- 🚀 测试开始
- 📍 测试步骤
- ✅ 成功步骤
- ❌ 失败信息
- 🎉 测试完成

## 故障排除

### 常见问题

1. **服务器连接失败**
   ```bash
   # 检查服务器状态
   curl http://localhost:8080

   # 启动开发服务器
   npm run dev
   ```

2. **元素定位失败**
   - 检查页面是否完全加载
   - 确认选择器是否正确
   - 检查是否有弹窗或覆盖层

3. **超时问题**
   ```bash
   # 增加超时时间（在配置文件中）
   "timeouts": {
     "navigation": 60000,
     "action": 20000
   }
   ```

4. **权限问题**
   ```bash
   # 确保脚本有执行权限
   chmod +x run-tests.sh
   ```

### 调试技巧

1. **使用UI模式调试**
   ```bash
   npm run test:ui
   ```

2. **单步调试**
   ```bash
   # 运行特定测试
   npm run test -- --grep "特定的测试描述"
   ```

3. **详细日志**
   ```bash
   DEBUG=pw:api npm test
   ```

## 自定义测试

### 添加新的测试场景
1. 在 `tests/` 目录创建新的 `.spec.ts` 文件
2. 导入必要的工具函数
3. 使用 `test.describe()` 组织测试
4. 使用 `test.step()` 组织测试步骤

### 示例
```typescript
import { test, expect } from '@playwright/test';
import { getTestData, logStep } from './utils/test-utils';

test.describe('自定义测试场景', () => {
  test('自定义测试', async ({ page }) => {
    const testData = getTestData();
    logStep('开始自定义测试');

    // 测试逻辑
    await page.goto('http://localhost:8080');
    // ... 更多测试步骤
  });
});
```

## 最佳实践

1. **测试独立性** - 每个测试应该是独立的，不依赖其他测试的状态
2. **等待策略** - 使用适当的等待策略，避免硬编码延迟
3. **断言验证** - 为每个关键步骤添加断言
4. **错误处理** - 添加适当的错误处理和日志记录
5. **清理操作** - 测试完成后清理测试数据

## 技术支持

如果遇到问题：
1. 检查控制台错误日志
2. 查看测试报告中的详细错误信息
3. 使用UI模式进行调试
4. 检查网络连接和服务器状态

---

## 版本历史

- v1.0.0 - 初始版本，包含基础Agent注册测试
- v1.1.0 - 增强版测试，添加更多工具函数和错误处理
- v1.2.0 - 添加性能测试和配置管理