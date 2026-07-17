# 代理上下文状态

## 当前模式: 需求

## 任务状态
- **模式**: 需求 - Agent链接功能
- **当前任务**: 🔄 准备实现Agent链接功能
- **目标**: 在Agent发现界面添加"链接对方Agent"功能
- **阻塞项**: 无

## 需求摘要（2025-10-04）
在AgentDiscoveryPage增加"链接对方Agent"功能：
1. ⏳ 在卡片操作区和表格操作列添加"链接"按钮
2. ⏳ 扩展数据模型（Agent类型添加connectedAgents、AgentConnection、ConnectionRequest接口）
3. ⏳ 扩展agentDiscoveryStore（链接状态和操作方法）
4. ⏳ 实现Mock链接服务（createConnection、acceptConnection、rejectConnection）
5. ⏳ 实现链接请求状态管理（pending/accepted/rejected）

## 待确认的关键决策点
### 1. 链接关系模型
- **决策**: Agent链接是单向还是双向？
  - 选项A：单向链接（类似关注/订阅，无需对方同意）
  - 选项B：双向链接（需对方接受，类似好友关系）
  - **推荐**: 选项B（双向链接），需要pending/accepted/rejected状态管理

### 2. 链接请求位置
- **决策**: 链接按钮在哪些位置显示？
  - 选项A：仅在Agent详情页
  - 选项B：卡片视图和表格视图都显示
  - 选项C：卡片视图、表格视图、详情页都显示
  - **推荐**: 选项C（全覆盖），提供最佳用户体验

### 3. 已链接Agent的显示
- **决策**: 如何展示已链接的Agent？
  - 选项A：在Agent详情页添加"已链接Agent"列表
  - 选项B：在发现页添加筛选条件（仅显示已链接）
  - 选项C：创建独立的"我的链接"页面
  - **推荐**: 选项A+B组合，详情页展示且支持筛选

### 4. 链接限制
- **决策**: 是否对链接数量设限？
  - 选项A：无限制
  - 选项B：设定最大链接数（如100个）
  - **推荐**: 选项A（无限制），Demo项目不需要复杂限制

### 5. Mock数据持久化
- **决策**: 链接关系如何存储？
  - 选项A：存储在Zustand store中（页面刷新丢失）
  - 选项B：使用localStorage持久化
  - 选项C：模拟API调用（使用MSW）
  - **推荐**: 选项B（localStorage），既简单又能保持状态

### 6. UI交互流程
- **决策**: 链接按钮的交互方式？
  - 选项A：直接点击发送请求（单步）
  - 选项B：点击后弹出确认对话框（两步）
  - **推荐**: 选项A（单步），简化流程，配合提示消息

## 技术实现范围
### 需要修改的文件
1. **类型定义扩展**:
   - `src/types/agent.ts`: 添加 `connectedAgents?: string[]` 字段
   - `src/types/agent-discovery.ts`: 新增 `AgentConnection`、`ConnectionRequest`、`ConnectionStatus` 接口

2. **状态管理扩展**:
   - `src/store/agentDiscoveryStore.ts`: 添加链接相关状态和操作方法
     - `connections: AgentConnection[]`
     - `pendingRequests: ConnectionRequest[]`
     - `sendConnectionRequest(agentId: string)`
     - `acceptConnection(requestId: string)`
     - `rejectConnection(requestId: string)`
     - `getConnectionStatus(agentId: string)`

3. **UI组件更新**:
   - `src/pages/agent-discovery/AgentDiscoveryPage.tsx`: 在卡片和表格中添加链接按钮
   - 可选：创建新组件 `src/components/agent-discovery/AgentConnectionButton.tsx`

4. **Mock服务**:
   - `src/mocks/sharedAgentData.ts`: 扩展数据操作函数，支持链接管理
   - 或创建新文件 `src/mocks/agentConnectionData.ts`

## 下一步行动
1. ⏳ 等待用户确认关键决策点（尤其是1、2、3、5）
2. ⏳ 基于决策创建OKR和技术规范
3. ⏳ 进入研究模式（如需深入分析现有代码）
4. ⏳ 进入计划模式（制定详细实现计划）
5. ⏳ 进入执行模式（逐步实现功能）

## 子代理调用记录
- **background-maintainer**: ✅ 已更新背景信息和上下文（2025-10-04）
- **code-investigator**: 待调用
- **okr-tracker**: 待调用
- **technical-spec-architect**: 待调用
- **execution-mode-enforcer**: 待调用
- **scope-supervisor**: 待调用

## 文件状态
- ✅ `.project/Background.md` - 已更新（包含新需求背景和技术分析）
- ✅ `.project/AGENT_CONTEXT.md` - 已更新（当前上下文和待确认决策）
- ⏳ `.project/OKR.md` - 待更新（需用户确认决策后创建）
- ⏳ `.project/TECHNICAL_SPEC.md` - 待创建
- ⏳ `.project/IMPLEMENTATION_PLAN.md` - 待创建

## 更新时间
- 创建时间: 2025-10-04
- 最后更新: 2025-10-04
- 模式切换: 需求准备阶段