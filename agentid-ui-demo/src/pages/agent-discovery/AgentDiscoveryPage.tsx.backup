import React, { useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Button, Space, Spin, Alert, Result, Typography, Tabs, Breadcrumb } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  HistoryOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  TableOutlined,
  PlusOutlined,
  RobotOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { useAgentDiscoveryStore } from '../../store/agentDiscoveryStore';
import { AgentDiscoverySearch } from '../../components/agent-discovery/AgentDiscoverySearch';
import { AgentDiscoveryFilters } from '../../components/agent-discovery/AgentDiscoveryFilters';
import { AgentDiscoverySort } from '../../components/agent-discovery/AgentDiscoverySort';
import { AgentDiscoveryList } from '../../components/agent-discovery/AgentDiscoveryList';
import { AgentDiscoveryStats } from '../../components/agent-discovery/AgentDiscoveryStats';
import { AgentDiscoverySearchHistory } from '../../components/agent-discovery/AgentDiscoverySearchHistory';
import { AgentDiscoveryCommunicationPanel } from '../../components/agent-discovery/AgentDiscoveryCommunicationPanel';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AgentDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Store状态
  const {
    searchResults,
    isSearching,
    searchError,
    stats,
    isLoadingStats,
    statsError,
    viewMode,
    showFilters,
    showAdvancedFilters,
    searchAgents,
    fetchStatistics,
    setViewMode,
    toggleFilters,
    toggleAdvancedFilters,
    clearErrors,
    getFilteredAgents,
    getSelectedAgentsCount,
    getAverageRating,
    getTotalConnections,
    getActiveAgentsCount,
    searchHistory,
    communicationChannels
  } = useAgentDiscoveryStore();

  // 页面加载时初始化数据
  useEffect(() => {
    const initializePage = async () => {
      try {
        await fetchStatistics();
        // 如果没有搜索结果，执行一次默认搜索
        if (!searchResults) {
          await searchAgents();
        }
      } catch (error) {
        console.error('页面初始化失败:', error);
      }
    };

    initializePage();
  }, []);

  // 处理搜索
  const handleSearch = useCallback(async () => {
    try {
      await searchAgents();
    } catch (error) {
      console.error('搜索失败:', error);
    }
  }, [searchAgents]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    try {
      await fetchStatistics();
      await searchAgents();
    } catch (error) {
      console.error('刷新失败:', error);
    }
  }, [fetchStatistics, searchAgents]);

  // 创建新Agent
  const handleCreateAgent = useCallback(() => {
    navigate('/agents/create');
  }, [navigate]);

  // 查看Agent详情
  const handleViewDetails = useCallback((agent: any) => {
    navigate(`/agents/${agent.id}`);
  }, [navigate]);

  // 连接Agent
  const handleConnect = useCallback((agent: any) => {
    console.log('连接Agent:', agent);
    // 这里可以添加连接逻辑
  }, []);

  // 计算统计信息
  const filteredAgents = useMemo(() => getFilteredAgents(), [getFilteredAgents]);
  const selectedCount = useMemo(() => getSelectedAgentsCount(), [getSelectedAgentsCount]);
  const avgRating = useMemo(() => getAverageRating(), [getAverageRating]);
  const totalConnections = useMemo(() => getTotalConnections(), [getTotalConnections]);
  const activeCount = useMemo(() => getActiveAgentsCount(), [getActiveAgentsCount]);

  // 活跃的通信频道数量
  const activeCommunicationChannels = useMemo(() =>
    Object.values(communicationChannels).filter(channel => channel.status === 'connected').length,
    [communicationChannels]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面标题和面包屑 */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Breadcrumb
              items={[
                { href: '/dashboard', title: <HomeOutlined /> },
                { href: '/agents', title: <RobotOutlined /> },
                { title: 'Agent发现' }
              ]}
            />
            <Title level={2} className="mt-2 mb-0">
              Agent发现
            </Title>
            <Text type="secondary">
              发现、连接和协作与智能Agent
            </Text>
          </div>

          <Space>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={handleCreateAgent}
            >
              创建Agent
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isSearching || isLoadingStats}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 快速统计 */}
        {stats && (
          <Row gutter={16} className="mt-4">
            <Col span={6}>
              <Card size="small">
                <Text type="secondary">总Agent数</Text>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalAgents}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Text type="secondary">活跃Agent</Text>
                <div className="text-2xl font-bold text-green-600">
                  {activeCount}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Text type="secondary">平均评分</Text>
                <div className="text-2xl font-bold text-yellow-600">
                  {avgRating.toFixed(1)}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Text type="secondary">活跃连接</Text>
                <div className="text-2xl font-bold text-purple-600">
                  {activeCommunicationChannels}
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="p-6">
        <Row gutter={24}>
          {/* 左侧搜索和筛选区域 */}
          <Col span={6}>
            <Space direction="vertical" size="middle" className="w-full">
              {/* 搜索框 */}
              <Card
                title={
                  <div className="flex items-center justify-between">
                    <span>搜索Agent</span>
                    <SearchOutlined />
                  </div>
                }
                size="small"
              >
                <AgentDiscoverySearch />
              </Card>

              {/* 筛选器 */}
              <Card
                title={
                  <div className="flex items-center justify-between">
                    <span>筛选器</span>
                    <FilterOutlined />
                  </div>
                }
                size="small"
                extra={
                  <Button
                    type="link"
                    size="small"
                    onClick={toggleAdvancedFilters}
                  >
                    {showAdvancedFilters ? '简化' : '高级'}
                  </Button>
                }
              >
                <AgentDiscoveryFilters />
              </Card>

              {/* 排序 */}
              <Card
                title={
                  <div className="flex items-center justify-between">
                    <span>排序</span>
                    <SortAscendingOutlined />
                  </div>
                }
                size="small"
              >
                <AgentDiscoverySort />
              </Card>

              {/* 搜索历史 */}
              {searchHistory.length > 0 && (
                <Card
                  title={
                    <div className="flex items-center justify-between">
                      <span>搜索历史</span>
                      <HistoryOutlined />
                    </div>
                  }
                  size="small"
                >
                  <AgentDiscoverySearchHistory />
                </Card>
              )}
            </Space>
          </Col>

          {/* 右侧结果区域 */}
          <Col span={18}>
            <Space direction="vertical" size="middle" className="w-full">
              {/* 工具栏 */}
              <Card size="small">
                <div className="flex items-center justify-between">
                  <Space>
                    <Text strong>
                      {filteredAgents.length > 0
                        ? `找到 ${filteredAgents.length} 个Agent`
                        : '暂无搜索结果'
                      }
                    </Text>
                    {selectedCount > 0 && (
                      <Text type="secondary">
                        已选择 {selectedCount} 个Agent
                      </Text>
                    )}
                  </Space>

                  <Space>
                    {/* 视图切换 */}
                    <Button.Group>
                      <Button
                        icon={<AppstoreOutlined />}
                        type={viewMode === 'grid' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => setViewMode('grid')}
                      />
                      <Button
                        icon={<UnorderedListOutlined />}
                        type={viewMode === 'list' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => setViewMode('list')}
                      />
                      <Button
                        icon={<TableOutlined />}
                        type={viewMode === 'table' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => setViewMode('table')}
                      />
                    </Button.Group>

                    <Button
                      icon={<FilterOutlined />}
                      onClick={toggleFilters}
                      type={showFilters ? 'primary' : 'default'}
                      size="small"
                    >
                      筛选
                    </Button>
                  </Space>
                </div>
              </Card>

              {/* 搜索状态和错误提示 */}
              {isSearching && (
                <div className="text-center py-8">
                  <Spin size="large" tip="正在搜索Agent..." />
                </div>
              )}

              {searchError && (
                <Alert
                  message="搜索失败"
                  description={searchError}
                  type="error"
                  showIcon
                  action={
                    <Button size="small" onClick={() => searchAgents()}>
                      重试
                    </Button>
                  }
                />
              )}

              {statsError && (
                <Alert
                  message="统计数据获取失败"
                  description={statsError}
                  type="warning"
                  showIcon
                  closable
                />
              )}

              {/* 搜索结果 */}
              {!isSearching && !searchError && (
                <>
                  {filteredAgents.length === 0 ? (
                    <Result
                      status="info"
                      title="未找到匹配的Agent"
                      subTitle="请尝试调整搜索条件或筛选器"
                      extra={[
                        <Button
                          key="clear"
                          onClick={() => {
                            clearErrors();
                            searchAgents();
                          }}
                        >
                          清除筛选
                        </Button>,
                        <Button
                          key="create"
                          type="primary"
                          onClick={handleCreateAgent}
                        >
                          创建新Agent
                        </Button>
                      ]}
                    />
                  ) : (
                    <AgentDiscoveryList
                      onViewDetails={handleViewDetails}
                      onConnect={handleConnect}
                    />
                  )}
                </>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* 通信面板 */}
      {/* 通信面板需要选中的agent参数，暂时移除 */}
      {/* {Object.keys(communicationChannels).length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <AgentDiscoveryCommunicationPanel />
        </div>
      )} */}
    </div>
  );
};

export default AgentDiscoveryPage;