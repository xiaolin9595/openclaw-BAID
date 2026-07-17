# Agent Discovery Store 使用说明

## 概述

`AgentDiscoveryStore` 是一个基于 Zustand 的状态管理库，专门用于管理 Agent 发现功能的状态。它提供了完整的状态管理解决方案，包括搜索、过滤、排序、选择、通信和统计等功能。

## 功能特性

### 1. 搜索功能
- **搜索Agent**: 支持关键词搜索、能力搜索、状态过滤等
- **搜索历史**: 自动保存搜索历史，支持快速回溯
- **搜索建议**: 基于缓存数据提供智能搜索建议

### 2. 过滤和排序
- **多维度过滤**: 支持状态、类型、语言、评分、能力等多维度过滤
- **灵活排序**: 支持按名称、创建时间、评分、连接数等字段排序
- **高级过滤**: 提供高级过滤选项，满足复杂查询需求

### 3. Agent管理
- **单选/多选**: 支持单个Agent选择和批量选择
- **Agent详情**: 获取和管理Agent详细信息
- **缓存管理**: 智能缓存Agent数据，提高性能

### 4. 通信功能
- **建立通信**: 与Agent建立通信通道
- **状态监控**: 实时监控Agent通信状态
- **连接管理**: 管理多个通信连接

### 5. 统计信息
- **全局统计**: 获取Agent数量、活跃度、评分等统计信息
- **分类统计**: 按类别、能力等维度统计Agent分布
- **实时更新**: 支持统计数据实时刷新

### 6. UI状态管理
- **视图模式**: 支持网格、列表、表格三种视图模式
- **界面控制**: 控制过滤面板、侧边栏等UI元素显示状态

## 基本使用

### 1. 导入Store

```typescript
import { useAgentDiscoveryStore } from '@/store';

// 在组件中使用
const store = useAgentDiscoveryStore();
```

### 2. 搜索Agent

```typescript
// 更新搜索参数
store.updateSearchParams({
  search: 'AI assistant',
  page: 1,
  pageSize: 12,
  capabilities: ['ai_ml', 'automation']
});

// 执行搜索
await store.searchAgents();
```

### 3. 过滤和排序

```typescript
// 设置过滤器
store.setActiveFilters({
  statuses: ['active'],
  languages: ['javascript', 'python'],
  ratingRange: { min: 4.0, max: 5.0 }
});

// 设置排序
store.setCurrentSort({
  field: 'rating',
  order: 'desc'
});

// 应用过滤
store.applyFilters();
```

### 4. 选择Agent

```typescript
// 选择单个Agent
store.setSelectedAgent(agent);

// 切换选择状态
store.toggleAgentSelection(agent);

// 批量选择
store.selectAllAgents();

// 清除选择
store.clearSelection();
```

### 5. 获取Agent详情

```typescript
// 获取Agent详情
await store.getAgentDetails(agentId);

// 清除详情缓存
store.clearAgentDetails(agentId);
```

### 6. 建立通信

```typescript
// 建立通信通道
const request = {
  agentId: 'agent1',
  type: 'message',
  payload: { message: 'Hello' },
  priority: 'medium'
};

await store.establishCommunication(request);
```

### 7. 获取统计信息

```typescript
// 获取统计数据
await store.fetchStatistics();

// 刷新统计
await store.refreshStatistics();
```

## 状态结构

### 核心状态

```typescript
interface AgentDiscoveryStore {
  // 搜索状态
  searchParams: AgentDiscoverySearchParams;
  searchResults: AgentDiscoveryResult | null;
  isSearching: boolean;
  searchError: string | null;
  searchHistory: Array<SearchHistoryItem>;

  // 选中状态
  selectedAgent: AgentDiscoveryItem | null;
  selectedAgents: AgentDiscoveryItem[];
  agentDetails: Record<string, AgentDiscoveryItem>;

  // 过滤和排序
  activeFilters: AgentDiscoveryFilterParams;
  currentSort: AgentDiscoverySortParams;

  // 统计信息
  stats: AgentDiscoveryStats | null;
  isLoadingStats: boolean;
  statsError: string | null;

  // 通信状态
  communicationStatus: Record<string, AgentCommunicationStatus>;
  communicationChannels: Record<string, AgentCommunicationChannel>;

  // UI状态
  viewMode: 'grid' | 'list' | 'table';
  showFilters: boolean;
  showAdvancedFilters: boolean;
}
```

## 计算属性

Store 提供了多个计算属性，用于获取派生数据：

```typescript
// 获取过滤后的Agent列表
const filteredAgents = store.getFilteredAgents();

// 获取选中Agent数量
const selectedCount = store.getSelectedAgentsCount();

// 获取平均评分
const averageRating = store.getAverageRating();

// 获取活跃Agent数量
const activeCount = store.getActiveAgentsCount();

// 获取特色Agent
const featuredAgents = store.getFeaturedAgents();

// 按类别分组
const agentsByCategory = store.getAgentsByCategory();

// 按能力分组
const agentsByCapability = store.getAgentsByCapability();

// 获取搜索建议
const suggestions = store.getSearchSuggestions(query);
```

## 完整示例

```typescript
import React, { useEffect, useState } from 'react';
import { useAgentDiscoveryStore } from '@/store';

const AgentDiscoveryPage: React.FC = () => {
  const {
    // 状态
    searchParams,
    searchResults,
    isSearching,
    selectedAgents,
    viewMode,
    stats,

    // Actions
    searchAgents,
    updateSearchParams,
    toggleAgentSelection,
    setViewMode,
    fetchStatistics,

    // 计算属性
    getFilteredAgents,
    getSelectedAgentsCount
  } = useAgentDiscoveryStore();

  const [searchQuery, setSearchQuery] = useState('');

  // 初始化统计数据
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // 处理搜索
  const handleSearch = () => {
    updateSearchParams({ search: searchQuery, page: 1 });
    searchAgents();
  };

  // 处理Agent选择
  const handleAgentSelect = (agent: AgentDiscoveryItem) => {
    toggleAgentSelection(agent);
  };

  // 切换视图模式
  const handleViewModeChange = (mode: 'grid' | 'list' | 'table') => {
    setViewMode(mode);
  };

  return (
    <div className="agent-discovery-page">
      {/* 搜索栏 */}
      <div className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索Agent..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? '搜索中...' : '搜索'}
        </button>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="stats-panel">
          <div>总Agent数: {stats.totalAgents}</div>
          <div>活跃Agent: {stats.activeAgents}</div>
          <div>平均评分: {stats.averageRating.toFixed(1)}</div>
        </div>
      )}

      {/* 视图模式切换 */}
      <div className="view-mode-switcher">
        <button onClick={() => handleViewModeChange('grid')}>网格</button>
        <button onClick={() => handleViewModeChange('list')}>列表</button>
        <button onClick={() => handleViewModeChange('table')}>表格</button>
      </div>

      {/* 搜索结果 */}
      <div className={`results ${viewMode}`}>
        {getFilteredAgents().map(agent => (
          <div
            key={agent.id}
            className={`agent-card ${selectedAgents.some(a => a.id === agent.id) ? 'selected' : ''}`}
            onClick={() => handleAgentSelect(agent)}
          >
            <h3>{agent.name}</h3>
            <p>{agent.description}</p>
            <div className="agent-meta">
              <span>状态: {agent.status}</span>
              <span>评分: {agent.rating?.toFixed(1)}</span>
              <span>连接数: {agent.connections}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 选择信息 */}
      {getSelectedAgentsCount() > 0 && (
        <div className="selection-info">
          已选择 {getSelectedAgentsCount()} 个Agent
        </div>
      )}
    </div>
  );
};

export default AgentDiscoveryPage;
```

## 最佳实践

### 1. 状态管理
- 使用单一Store管理所有相关状态
- 避免在组件内部维护重复状态
- 合理使用计算属性避免重复计算

### 2. 异步操作
- 正确处理加载状态和错误状态
- 使用try-catch包装异步操作
- 提供用户反馈

### 3. 性能优化
- 使用缓存减少重复请求
- 合理使用计算属性
- 避免不必要的重渲染

### 4. 用户体验
- 提供加载状态指示
- 清晰的错误信息
- 支持取消操作

## 注意事项

1. **依赖注入**: Store 使用了 AgentDiscoveryService 的单例模式
2. **错误处理**: 所有异步操作都包含错误处理逻辑
3. **缓存策略**: 实现了多层缓存策略提高性能
4. **类型安全**: 完整的TypeScript类型定义

## 相关文件

- `src/services/agentDiscovery.ts` - Agent发现服务
- `src/types/agent-discovery.ts` - 类型定义
- `src/examples/agentDiscoveryStoreExample.tsx` - 使用示例
- `src/store/agentDiscoveryStore.test.ts` - 测试文件