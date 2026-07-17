# Agent发现服务文档

## 概述

Agent发现服务 (`AgentDiscoveryService`) 是一个专门为Agent发现功能设计的数据服务层，提供了完整的Agent搜索、详情获取、通信建立和统计信息功能。

## 功能特性

### 1. 搜索功能
- **多条件组合搜索**：支持按能力、用户ID、角色、状态、关键词等条件搜索
- **高级过滤**：支持按类型、评分范围、代码大小、合约状态等过滤
- **灵活排序**：支持按名称、评分、创建时间、连接数等字段排序
- **分页支持**：完整的分页功能，支持页码和页面大小控制

### 2. Agent详情
- **完整信息获取**：获取Agent的详细信息，包括区块链信息
- **统计数据**：提供Agent的运行统计和性能指标
- **元数据信息**：包括网站、文档、定价等附加信息

### 3. 通信功能
- **通信状态查询**：实时查询Agent的通信状态和负载情况
- **通信通道建立**：支持多种通信类型（WebSocket、HTTP、gRPC等）
- **安全认证**：支持多种认证方式和加密协议

### 4. 统计信息
- **总体统计**：Agent总数、活跃数、验证数等
- **分布统计**：按能力、类型、网络、状态的分布情况
- **趋势统计**：最近7天的Agent活动和调用统计

### 5. 缓存机制
- **智能缓存**：自动缓存搜索结果、Agent详情和统计信息
- **TTL管理**：支持不同类型数据的缓存时间设置
- **缓存统计**：提供缓存使用情况和性能统计

## 快速开始

### 基本使用

```typescript
import { agentDiscoveryService } from './services';

// 搜索Agent
const result = await agentDiscoveryService.searchAgents(
  {
    search: 'AI Assistant',
    page: 1,
    pageSize: 10
  },
  {
    field: 'rating',
    order: 'desc'
  },
  {
    statuses: ['active'],
    ratingRange: { min: 4.0, max: 5.0 }
  }
);

console.log(`找到 ${result.agents.length} 个Agent`);
```

### 获取Agent详情

```typescript
// 获取Agent详情
const agent = await agentDiscoveryService.getAgentDetails('agent-001');

if (agent) {
  console.log(`Agent名称: ${agent.name}`);
  console.log(`评分: ${agent.rating}`);
  console.log(`状态: ${agent.status}`);

  if (agent.blockchainInfo?.isOnChain) {
    console.log(`区块链合约: ${agent.blockchainInfo.contractAddress}`);
  }
}
```

### 通信功能

```typescript
// 获取通信状态
const status = await agentDiscoveryService.getCommunicationStatus('agent-001');
console.log(`Agent状态: ${status.status}`);
console.log(`当前负载: ${status.currentLoad}/${status.maxCapacity}`);

// 建立通信通道
const channel = await agentDiscoveryService.establishCommunication({
  agentId: 'agent-001',
  type: 'message',
  payload: { message: 'Hello!' },
  priority: 'medium',
  requiresResponse: true
});
```

### 统计信息

```typescript
// 获取统计信息
const stats = await agentDiscoveryService.getStatistics();

console.log(`总Agent数: ${stats.totalAgents}`);
console.log(`活跃Agent数: ${stats.activeAgents}`);
console.log(`平均评分: ${stats.averageRating}`);

// 显示热门能力
stats.topCapabilities.forEach(cap => {
  console.log(`${cap.capability}: ${cap.count} (${cap.percentage}%)`);
});
```

## 高级用法

### 复杂搜索

```typescript
// 高级搜索示例
const result = await agentDiscoveryService.searchAgents(
  {
    search: 'AI',
    capabilities: ['私人助理', '工作助理'],
    language: 'typescript',
    minRating: 4.5,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date()
    },
    page: 1,
    pageSize: 20
  },
  {
    field: 'connections',
    order: 'desc'
  },
  {
    types: ['AI Assistant', 'Automation'],
    capabilities: ['私人助理', '工作助理'],
    ratingRange: { min: 4.0, max: 5.0 },
    hasContract: true,
    isVerified: true
  }
);
```

### 缓存管理

```typescript
// 清除缓存
agentDiscoveryService.clearCache();

// 获取缓存统计
const cacheStats = agentDiscoveryService.getCacheStats();
console.log(`缓存条目数: ${cacheStats.size}`);
console.log(`缓存条目:`, cacheStats.entries);
```

## API 参考

### AgentDiscoveryService

#### 方法

##### `searchAgents(params, sortParams, filterParams)`
搜索Agent

**参数:**
- `params: AgentDiscoverySearchParams` - 搜索参数
- `sortParams: AgentDiscoverySortParams` - 排序参数
- `filterParams: AgentDiscoveryFilterParams` - 过滤参数

**返回:** `Promise<AgentDiscoveryResult>`

##### `getAgentDetails(agentId)`
获取Agent详情

**参数:**
- `agentId: string` - Agent ID

**返回:** `Promise<AgentDiscoveryItem | null>`

##### `establishCommunication(request)`
建立通信通道

**参数:**
- `request: AgentCommunicationRequest` - 通信请求

**返回:** `Promise<AgentCommunicationChannel>`

##### `getCommunicationStatus(agentId)`
获取通信状态

**参数:**
- `agentId: string` - Agent ID

**返回:** `Promise<AgentCommunicationStatus>`

##### `getStatistics()`
获取统计信息

**返回:** `Promise<AgentDiscoveryStats>`

##### `clearCache()`
清除缓存

**返回:** `void`

##### `getCacheStats()`
获取缓存统计

**返回:** `{ size: number; entries: Array<{ key: string; age: number }> }`

### 类型定义

#### AgentDiscoverySearchParams
```typescript
interface AgentDiscoverySearchParams {
  search?: string;                    // 关键词搜索
  capabilities?: AgentCapability[];   // 能力过滤
  userId?: string;                    // 用户ID过滤
  role?: string;                      // 角色过滤
  status?: Agent['status'];            // 状态过滤
  blockchainStatus?: string;           // 区块链状态过滤
  type?: BlockchainAgent['type'];      // 类型过滤
  language?: string;                   // 编程语言过滤
  minRating?: number;                 // 最小评分
  maxRating?: number;                 // 最大评分
  dateRange?: {                       // 时间范围
    start?: Date;
    end?: Date;
  };
  tags?: string[];                     // 标签过滤
  securityLevel?: 'low' | 'medium' | 'high';  // 安全级别
  permissions?: AgentPermission[];     // 权限过滤
  contractPermissions?: AgentContractPermission[];  // 合约权限过滤
  page: number;                       // 页码
  pageSize: number;                   // 页面大小
}
```

#### AgentDiscoverySortParams
```typescript
interface AgentDiscoverySortParams {
  field: 'name' | 'createdAt' | 'updatedAt' | 'rating' | 'status' | 'type' | 'capabilities' | 'codeSize' | 'connections';
  order: 'asc' | 'desc';
}
```

#### AgentDiscoveryFilterParams
```typescript
interface AgentDiscoveryFilterParams {
  statuses?: Array<Agent['status'] | BlockchainAgent['status']>;
  types?: BlockchainAgent['type'][];
  languages?: string[];
  capabilities?: AgentCapability[];
  ratingRange?: { min: number; max: number };
  codeSizeRange?: { min: number; max: number };
  hasContract?: boolean;
  isVerified?: boolean;
  isActive?: boolean;
  tags?: string[];
  owners?: string[];
  networks?: string[];
}
```

## 示例和测试

### 运行示例

```bash
# 运行完整演示
npx ts-node src/services/agentDiscoveryExample.ts

# 运行测试
npx ts-node src/services/agentDiscovery.test.ts
```

### 示例输出

```
=== 演示Agent搜索功能 ===
搜索结果: 找到 5 个Agent
总页数: 2
当前页: 1
搜索耗时: 450ms

Agent 1:
  名称: Blockchain AI Assistant
  描述: 基于区块链的AI助理，提供智能化的个人和工作助理服务
  评分: 4.8 (245 条评价)
  状态: active
  区块链: 是
  能力: 私人助理, 工作助理
```

## 开发和调试

### 开发环境

服务在开发环境中有以下特性：

1. **丰富的模拟数据**：包含13个预定义的Agent，涵盖各种类型和状态
2. **随机性数据**：统计信息和性能指标包含适当随机性，更接近真实场景
3. **调试信息**：提供详细的缓存统计和性能指标

### 缓存策略

- **搜索结果**：5分钟TTL
- **Agent详情**：5分钟TTL
- **统计信息**：1分钟TTL
- **通信状态**：30秒TTL

### 错误处理

所有方法都包含完整的错误处理机制：

```typescript
try {
  const result = await agentDiscoveryService.searchAgents(params, sort, filters);
  // 处理结果
} catch (error) {
  console.error('搜索失败:', error);
  // 错误恢复逻辑
}
```

## 性能优化

1. **缓存利用**：合理使用缓存，避免重复请求
2. **批量操作**：尽量在一次请求中获取所有需要的数据
3. **分页控制**：合理的页面大小设置
4. **过滤优化**：在前端进行初步过滤，减少服务端压力

## 未来扩展

1. **实时搜索**：支持实时搜索建议
2. **地理位置过滤**：基于地理位置的Agent发现
3. **智能推荐**：基于用户行为的Agent推荐
4. **性能监控**：更详细的性能指标和监控
5. **多语言支持**：支持多语言搜索和结果

## 贡献指南

1. 遵循现有的代码风格和架构模式
2. 添加适当的类型注解和文档
3. 包含必要的测试用例
4. 更新相关文档

## 许可证

此服务遵循项目的许可证条款。