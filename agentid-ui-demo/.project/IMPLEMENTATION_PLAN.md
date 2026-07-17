# 实现计划

## 原子化任务列表

### Task-1: 更新类型定义
**描述**: 在 `blockchain.ts` 中添加 Agent 相关的类型定义
**文件**: `/src/types/blockchain.ts`
**变更内容**:
- 添加 `AgentIdentityContract` 接口
- 添加 `AgentType`, `AgentCapability`, `AgentPermission` 类型
- 添加 `AgentContractRegistrationForm` 接口
- 添加 `Agent` 接口
- 添加相关的 Mock 数据类型

**验收标准**:
- 所有新类型定义完整且无语法错误
- 类型与现有接口保持一致
- 支持 TypeScript 类型检查

---

### Task-2: 创建 AgentIdentityContractRegistration 组件
**描述**: 创建 Agent 身份合约注册组件
**文件**: `/src/components/blockchain/AgentIdentityContractRegistration.tsx`
**变更内容**:
- 创建新组件，参考 IdentityContractRegistration 的结构
- 实现 Agent 特定的表单字段
- 添加 Agent 相关的 Mock 数据
- 实现表单验证和提交逻辑
- 保持与现有设计系统的一致性

**验收标准**:
- 组件功能完整，与设计规范一致
- 表单验证正常工作
- Agent 特定字段正确实现
- 错误处理完善

---

### Task-3: 修改 BlockchainPage 移除 Gas 消耗统计
**描述**: 移除总 Gas 消耗相关的代码和 UI
**文件**: `/src/pages/blockchain/BlockchainPage.tsx`
**变更内容**:
- 移除第73行的 `totalGasUsed` 计算
- 移除第144-154行的 Gas 消耗统计卡片
- 调整统计卡片布局为3列

**验收标准**:
- Gas 消耗统计完全移除
- 统计卡片布局调整为3列
- 页面功能正常，无错误

---

### Task-4: 在 BlockchainPage 中添加 Agent 注册标签页
**描述**: 添加 "Agent 合约注册" 标签页和相关功能
**文件**: `/src/pages/blockchain/BlockchainPage.tsx`
**变更内容**:
- 导入 AgentIdentityContractRegistration 组件
- 添加新的标签页 "Agent 合约注册"
- 添加 Agent 合约注册的处理函数
- 更新导入语句和图标

**验收标准**:
- 新标签页正常显示和工作
- Agent 合约注册功能完整
- 页面切换和状态管理正常

---

### Task-5: 更新 Mock 数据和 Store
**描述**: 扩展 Mock 数据和 Store 以支持 Agent 合约
**文件**: 相关的 Mock 数据文件和 Store 文件
**变更内容**:
- 添加 Agent Mock 数据
- 更新 Store 以支持 Agent 合约管理
- 确保 Agent 合约与用户合约的并行管理

**验收标准**:
- Mock 数据完整且合理
- Store 支持新的 Agent 合约类型
- 状态管理正常工作

---

## 执行顺序

1. **Task-1**: 更新类型定义 (基础依赖)
2. **Task-2**: 创建 AgentIdentityContractRegistration 组件 (核心功能)
3. **Task-3**: 修改 BlockchainPage 移除 Gas 消耗统计 (UI 清理)
4. **Task-4**: 在 BlockchainPage 中添加 Agent 注册标签页 (集成)
5. **Task-5**: 更新 Mock 数据和 Store (数据层支持)

## 风险评估

### 高风险项
- 无

### 中风险项
- Task-4 需要确保新标签页与现有功能无缝集成
- Task-5 需要确保 Store 扩展不会影响现有功能

### 低风险项
- Task-1, Task-2, Task-3 都是独立的低风险任务

## 回滚策略

### 每个任务的回滚点
- Task-1: 恢复类型定义文件
- Task-2: 删除新创建的组件文件
- Task-3: 恢复 Gas 消耗相关代码
- Task-4: 移除新添加的标签页
- Task-5: 恢复 Store 和 Mock 数据

### 整体回滚
- 如果整体实现失败，可以回滚到需求分析阶段的状态

## 测试计划

### 单元测试
- 每个组件都需要有相应的测试用例
- 表单验证逻辑需要测试
- 状态管理需要测试

### 集成测试
- 页面级别的集成测试
- Store 与组件的集成测试

### E2E 测试
- 完整的用户流程测试
- Agent 合约注册流程测试

## 交付标准

### 功能要求
- 所有 Task 完成且功能正常
- 无明显的 UI/UX 问题
- 性能表现良好

### 代码质量
- 代码风格一致
- TypeScript 类型安全
- 无明显的性能问题
- 错误处理完善

### 文档要求
- 代码注释完整
- 实现日志记录完整
- 符合项目的文档标准