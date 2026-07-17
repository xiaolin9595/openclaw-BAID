# 技术规范

## 架构设计

### 组件结构
```
BlockchainPage/
├── 统计卡片区域 (移除 Gas 消耗)
├── 标签页区域
│   ├── 功能总览
│   ├── 注册合约 (用户)
│   ├── Agent 合约注册 (新增)
│   ├── 合约管理
│   └── 网络统计
└── 状态管理
```

### 新增组件
- `AgentIdentityContractRegistration.tsx`: Agent 身份合约注册组件
- 位置: `/src/components/blockchain/`

## 技术规范

### 1. 类型定义扩展

#### Agent 合约相关类型
```typescript
interface AgentIdentityContract {
  id: string;
  contractAddress: string;
  contractName: string;
  ownerAddress: string;
  agentId: string;
  identityHash: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  metadata: {
    agentType: AgentType;
    capabilities: AgentCapability[];
    permissions: AgentPermission[];
    apiEndpoints: string[];
    version: string;
    modelInfo?: string;
    tags: string[];
    description?: string;
  };
  blockchain: {
    network: string;
    blockNumber: number;
    transactionHash: string;
    gasUsed: number;
  };
}

type AgentType =
  | 'AI_ASSISTANT'
  | 'CHATBOT'
  | 'AUTOMATION'
  | 'DATA_PROCESSING'
  | 'CONTENT_GENERATION';

type AgentCapability =
  | 'NATURAL_LANGUAGE_PROCESSING'
  | 'DATA_ANALYSIS'
  | 'AUTOMATION'
  | 'CONTENT_GENERATION'
  | 'INTEGRATION'
  | 'CUSTOM';

type AgentPermission =
  | 'READ_ONLY'
  | 'READ_WRITE'
  | 'ADMIN'
  | 'API_ACCESS'
  | 'SYSTEM_ACCESS';

interface AgentContractRegistrationForm {
  contractName: string;
  agentType: AgentType;
  agentId: string;
  capabilities: AgentCapability[];
  permissions: AgentPermission[];
  apiEndpoints: string[];
  version: string;
  modelInfo?: string;
  tags: string[];
  description?: string;
}
```

### 2. Mock 数据规范

#### Agent 数据结构
```typescript
interface Agent {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  status: 'active' | 'inactive' | 'development';
  ownerAddress: string;
  createdAt: Date;
  capabilities: AgentCapability[];
}
```

### 3. 组件规范

#### AgentIdentityContractRegistration 组件
- **输入**: AgentContractRegistrationForm
- **输出**: AgentIdentityContract
- **功能**:
  - Agent ID 选择
  - Agent 类型选择
  - 能力选择（多选）
  - 权限设置
  - API 端点配置
  - 版本信息管理
- **UI 设计**: 与 IdentityContractRegistration 保持一致

#### BlockchainPage 修改
- **移除**: `totalGasUsed` 计算和对应的统计卡片
- **添加**: "Agent 合约注册" 标签页
- **更新**: 统计卡片布局（3列而不是4列）

### 4. 状态管理

#### Store 扩展
- 需要扩展 `blockchainStore` 以支持 Agent 合约
- 添加 Agent 相关的 state 和 actions
- 保持与现有用户合约管理的并行性

### 5. 验证规则

#### 表单验证
- Agent ID: 必填，格式验证
- Agent 类型: 必填，枚举值验证
- 能力: 至少选择一个
- 权限: 必填
- API 端点: URL 格式验证
- 版本: 语义化版本格式验证

### 6. 性能考虑

#### 组件优化
- 使用 React.memo 优化渲染性能
- 合理使用 useMemo 和 useCallback
- 避免不必要的重新渲染

### 7. 错误处理

#### 异常处理
- 网络请求失败处理
- 表单验证失败处理
- 组件边界错误处理

## 接口定义

### 输入接口
- AgentContractRegistrationForm: 注册表单数据
- Agent: Agent 基础信息

### 输出接口
- AgentIdentityContract: 注册成功的合约
- ContractRegistrationResult: 注册结果

### 内部接口
- MockAgent: 模拟 Agent 数据
- MockAgentContract: 模拟 Agent 合约数据

## 测试策略

### 单元测试
- AgentIdentityContractRegistration 组件测试
- 表单验证测试
- 状态管理测试

### 集成测试
- 与 BlockchainPage 的集成测试
- 与 Store 的集成测试

### E2E 测试
- 完整的 Agent 合约注册流程测试
- 用户界面交互测试

## 部署考虑

### 构建优化
- 代码分割优化
- 懒加载策略
- 包大小优化

### 兼容性
- 浏览器兼容性
- 移动端适配
- 无障碍访问支持