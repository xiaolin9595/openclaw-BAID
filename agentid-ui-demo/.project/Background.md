# 项目背景

## 项目概述
AgentID UI 演示系统是一个基于 React + Vite + TypeScript + Ant Design + Tailwind CSS 的前端项目，专注于展示 AgentID 相关功能。

## 技术栈
- **框架**: React 19.1.1
- **构建工具**: Vite 7.1.2
- **语言**: TypeScript 5.8.3
- **UI 库**: Ant Design 5.27.4 + @ant-design/pro-components 2.8.10
- **样式**: Tailwind CSS 4.1.13
- **状态管理**: Zustand 5.0.8
- **路由**: React Router DOM 7.9.1
- **测试**: Playwright 1.55.0
- **动画**: Framer Motion 12.23.13
- **Mock**: MSW 2.11.2

## 项目结构
```
src/
├── components/
│   ├── ui/                    # 通用UI组件
│   ├── forms/                 # 表单组件
│   ├── blockchain/            # 区块链相关组件
│   ├── agent-discovery/       # Agent发现功能组件（搜索、展示、通信）
│   └── layout/                # 布局组件
├── pages/                     # 路由页面
│   ├── agent-discovery/       # Agent发现页面
│   ├── agents/                # Agent管理页面
│   ├── auth/                  # 认证页面
│   ├── blockchain/            # 区块链页面
│   ├── dashboard/             # 仪表板
│   ├── identity/              # 身份生成页面
│   ├── profile/               # 用户资料
│   └── tasks/                 # 任务执行
├── store/                     # Zustand状态管理
│   ├── agentStore.ts
│   ├── agentDiscoveryStore.ts
│   ├── authStore.ts
│   ├── blockchainStore.ts
│   ├── identityStore.ts
│   ├── taskStore.ts
│   ├── uiStore.ts
│   └── fileUploadStore.ts
├── services/                  # API服务（待实现）
├── types/                     # TypeScript类型定义
│   ├── agent.ts
│   ├── agent-discovery.ts
│   ├── blockchain.ts
│   ├── auth.ts
│   ├── identity.ts
│   └── ...
├── mocks/                     # Mock数据
│   └── sharedAgentData.ts
└── styles/                    # 全局样式
```

## 当前状态与已有功能
### 区块链功能
- BlockchainPage 已实现用户身份合约注册功能
- IdentityContractRegistration 组件支持用户合约注册
- AgentIdentityContractRegistration 组件支持Agent合约注册
- 区块链状态管理使用 Zustand

### Agent发现功能（已完成）
- **搜索组件系统**：
  - DebouncedSearchInput - 防抖搜索输入
  - AgentDiscoverySearch - 搜索主界面
  - AgentDiscoveryFilters - 多维度过滤器
  - AgentDiscoverySort - 排序功能
  - AgentDiscoverySearchHistory - 搜索历史

- **结果展示组件**：
  - AgentDiscoveryCard - 卡片视图
  - AgentDiscoveryList - 列表/网格视图切换
  - AgentDiscoveryItem - 紧凑列表项
  - AgentDiscoveryStats - 统计信息
  - AgentDiscoveryEmpty - 空状态处理
  - AgentDiscoveryPagination - 分页控制

- **通信组件系统**：
  - AgentDiscoveryCommunicationPanel - 通信请求界面
  - AgentCommunicationModal - 通信建立模态框
  - AgentCommunicationStatus - 通信状态显示
  - AgentCommunicationHistory - 通信历史列表
  - AgentCommunicationTypes - 通信类型选择器

- **AgentDiscoveryPage页面**：
  - 完整的搜索、筛选、展示功能
  - 支持网格和表格两种视图模式
  - 用户ID、角色、任务需求等多维度筛选
  - 评分、连接数等统计展示
  - 导航到Agent详情页

### 数据模型（当前状态）
- `types/agent.ts`: 基础Agent类型定义
- `types/agent-discovery.ts`: Agent发现相关类型（角色、搜索、排序、过滤、通信）
- `types/blockchain.ts`: 区块链Agent类型
- `store/agentStore.ts`: Agent状态管理
- `store/agentDiscoveryStore.ts`: 简化的Agent发现状态管理（基础版）
- `mocks/sharedAgentData.ts`: 共享Agent数据源

## 新需求背景（2025-10-04）
用户希望在AgentDiscoveryPage增加"链接对方Agent"功能，使得用户能够：
1. 在发现的Agent卡片和表格操作区域添加"链接"按钮
2. 建立Agent之间的链接关系
3. 管理已链接的Agent列表
4. 查看链接请求状态（pending/accepted/rejected）
5. 支持发送链接请求和处理链接请求

### 需求分析
根据现有代码分析：
- **UI层面**: AgentDiscoveryPage已有完整的搜索和展示功能，可在卡片的actions区域和表格的操作列添加"链接"按钮
- **数据层面**: 需要扩展Agent类型，添加`connectedAgents`字段，定义`AgentConnection`和`ConnectionRequest`接口
- **状态层面**: agentDiscoveryStore需要扩展，添加链接相关状态和操作方法
- **服务层面**: 需要Mock链接相关的服务接口（createConnection、acceptConnection、rejectConnection等）

### 技术约束与依赖
- 必须复用现有的Agent数据结构（来自sharedAgentData）
- UI设计需与现有Ant Design风格保持一致
- 状态管理沿用Zustand模式
- 由于是Demo项目，使用Mock数据，不涉及真实后端API
- 需要保持响应式设计，支持移动端

## 设计约束
- 必须与现有设计系统保持一致（Ant Design + Tailwind CSS）
- 保持 TypeScript 类型安全
- 遵循现有的代码风格和架构模式
- Mock 数据需要与 Agent 功能对应
- 确保响应式设计和移动端支持
- 不破坏现有功能和组件复用性

## 参考文档与现有实现
- `src/pages/agent-discovery/AgentDiscoveryPage.tsx`: 主页面实现，包含搜索、筛选、展示逻辑
- `src/types/agent-discovery.ts`: 类型定义，包含AgentRole、搜索参数、通信相关类型
- `src/store/agentDiscoveryStore.ts`: 当前简化的状态管理
- `src/components/agent-discovery/`: 已有的完整组件系统
- `src/mocks/sharedAgentData.ts`: 共享数据源