import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Spin,
  Alert,
  Result,
  Typography,
  Tabs,
  Breadcrumb,
  Table,
  Tag,
  Avatar,
  Tooltip,
  Badge,
  Input,
  Select,
  Checkbox,
  Divider
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  SearchOutlined,
  FilterOutlined,
  PlusOutlined,
  RobotOutlined,
  HomeOutlined,
  ReloadOutlined,
  EyeOutlined,
  StarOutlined,
  UserOutlined,
  TagsOutlined,
  AimOutlined
} from '@ant-design/icons';
import { sharedAgentData } from '../../mocks/sharedAgentData';
import { useAgentStore } from '../../store/agentStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Group: CheckboxGroup } = Checkbox;

interface AgentDisplay {
  id: string;
  name: string;
  description: string;
  status: string;
  language: string;
  createdAt: string;
  boundUser: string;
  codeSize: number;
  capabilities: string[];
  rating?: number;
  connections?: number;
  role?: string;
  taskRequirements?: string[];
  specialties?: string[];
  tags?: string[];
}

const AgentDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedAgent } = useAgentStore();

  const [agents, setAgents] = useState<AgentDisplay[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTaskRequirements, setSelectedTaskRequirements] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // 页面加载时获取数据
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      // 模拟加载延迟
      await new Promise(resolve => setTimeout(resolve, 500));

      // 从共享数据源获取 Agent
      const sharedAgents = sharedAgentData.getAgents();

      // 转换为显示格式
      const displayAgents: AgentDisplay[] = sharedAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        language: agent.language,
        createdAt: agent.createdAt,
        boundUser: agent.boundUser,
        codeSize: agent.codeSize,
        capabilities: agent.permissions || [],
        role: agent.role,
        taskRequirements: agent.taskRequirements || [],
        specialties: agent.specialties || [],
        tags: agent.tags || [],
        rating: agent.rating || Math.random() * 2 + 3, // 3-5分随机评分
        connections: agent.connections || Math.floor(Math.random() * 100) + 10 // 10-110随机连接数
      }));

      setAgents(displayAgents);
      setFilteredAgents(displayAgents);
    } catch (err) {
      setError('加载 Agent 数据失败');
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAgent = (agent: AgentDisplay) => {
    // 找到完整的 Agent 数据
    const fullAgent = sharedAgentData.getAgents().find(a => a.id === agent.id);
    if (fullAgent) {
      setSelectedAgent(fullAgent);
      navigate(`/agents/${agent.id}?from=discovery`);
    }
  };

  // 获取所有可用的用户ID
  const getUserIds = () => {
    const userIds = Array.from(new Set(agents.map(agent => agent.boundUser)));
    return userIds.filter(id => id);
  };

  // 获取所有可用的角色
  const getRoles = () => {
    const roles = Array.from(new Set(agents.map(agent => agent.role).filter(Boolean)));
    return roles as string[];
  };

  // 获取所有可用的任务需求
  const getTaskRequirements = () => {
    const requirements = new Set<string>();
    agents.forEach(agent => {
      if (agent.taskRequirements) {
        agent.taskRequirements.forEach(req => requirements.add(req));
      }
    });
    return Array.from(requirements);
  };

  // 应用筛选逻辑
  const applyFilters = () => {
    let filtered = [...agents];

    // 文本搜索
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.description.toLowerCase().includes(searchLower) ||
        agent.role?.toLowerCase().includes(searchLower) ||
        agent.specialties?.some(spec => spec.toLowerCase().includes(searchLower))
      );
    }

    // 用户ID筛选
    if (selectedUserId) {
      filtered = filtered.filter(agent => agent.boundUser === selectedUserId);
    }

    // 角色筛选
    if (selectedRoles.length > 0) {
      filtered = filtered.filter(agent => agent.role && selectedRoles.includes(agent.role));
    }

    // 任务需求筛选
    if (selectedTaskRequirements.length > 0) {
      filtered = filtered.filter(agent =>
        agent.taskRequirements && selectedTaskRequirements.some(req =>
          agent.taskRequirements?.includes(req)
        )
      );
    }

    setFilteredAgents(filtered);
  };

  // 清除所有筛选
  const clearFilters = () => {
    setSearchText('');
    setSelectedUserId('');
    setSelectedRoles([]);
    setSelectedTaskRequirements([]);
    setFilteredAgents(agents);
  };

  // 当筛选条件变化时重新应用筛选
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedUserId, selectedRoles, selectedTaskRequirements, agents]);

  const handleCreateAgent = () => {
    navigate('/agents/create');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'red';
      case 'stopped': return 'orange';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '运行中';
      case 'inactive': return '未激活';
      case 'stopped': return '已停止';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'javascript': 'yellow',
      'typescript': 'blue',
      'python': 'green',
      'java': 'red',
      'go': 'cyan',
      'rust': 'purple'
    };
    return colors[language.toLowerCase()] || 'default';
  };

  // 表格列定义
  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      width: 300,
      render: (record: AgentDisplay) => (
        <Space>
          <Avatar
            size="large"
            icon={<RobotOutlined />}
            style={{ backgroundColor: '#1890ff' }}
          />
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {record.name}
            </div>
            <div style={{ color: '#666', fontSize: '12px' }}>
              {record.description}
            </div>
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag color={getLanguageColor(record.language)}>
                {record.language}
              </Tag>
              {record.rating && (
                <Tag color="orange">
                  <StarOutlined /> {record.rating.toFixed(1)}
                </Tag>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={getStatusText(status)}
        />
      ),
    },
    {
      title: '创建者',
      dataIndex: 'boundUser',
      key: 'boundUser',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => role || '-',
    },
    {
      title: '连接数',
      dataIndex: 'connections',
      key: 'connections',
      width: 80,
      render: (connections: number) => connections || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (record: AgentDisplay) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewAgent(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const activeAgents = filteredAgents.filter(agent => agent.status === 'active').length;
  const totalConnections = filteredAgents.reduce((sum, agent) => sum + (agent.connections || 0), 0);
  const averageRating = filteredAgents.length > 0
    ? filteredAgents.reduce((sum, agent) => sum + (agent.rating || 0), 0) / filteredAgents.length
    : 0;

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
              onClick={loadAgents}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 快速统计 */}
        <Row gutter={16} className="mt-4">
          <Col span={6}>
            <Card size="small">
              <Text type="secondary">总Agent数</Text>
              <div className="text-2xl font-bold text-blue-600">
                {agents.length}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Text type="secondary">活跃Agent</Text>
              <div className="text-2xl font-bold text-green-600">
                {activeAgents}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Text type="secondary">平均评分</Text>
              <div className="text-2xl font-bold text-yellow-600">
                {averageRating.toFixed(1)}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Text type="secondary">总连接数</Text>
              <div className="text-2xl font-bold text-purple-600">
                {totalConnections}
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 主内容区域 */}
      <div className="p-6">
        <Card>
          {/* 搜索和筛选区域 */}
          <div className="mb-6">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Search
                  placeholder="搜索Agent名称、描述、角色..."
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onSearch={applyFilters}
                  enterButton={<SearchOutlined />}
                  size="large"
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="选择用户ID"
                  allowClear
                  value={selectedUserId || undefined}
                  onChange={setSelectedUserId}
                  size="large"
                  style={{ width: '100%' }}
                >
                  {getUserIds().map(userId => (
                    <Option key={userId} value={userId}>
                      <Space>
                        <UserOutlined />
                        {userId}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={4}>
                <Button
                  icon={<FilterOutlined />}
                  type={showFilters ? 'primary' : 'default'}
                  size="large"
                  style={{ width: '100%' }}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  高级筛选
                </Button>
              </Col>
              <Col span={4}>
                <Button
                  onClick={clearFilters}
                  disabled={!searchText && !selectedUserId && selectedRoles.length === 0 && selectedTaskRequirements.length === 0}
                  size="large"
                  style={{ width: '100%' }}
                >
                  清除筛选
                </Button>
              </Col>
              <Col span={4}>
                <Space>
                  <Button.Group>
                    <Button
                      icon={<RobotOutlined />}
                      type={viewMode === 'grid' ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setViewMode('grid')}
                    >
                      网格
                    </Button>
                    <Button
                      icon={<RobotOutlined />}
                      type={viewMode === 'table' ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setViewMode('table')}
                    >
                      表格
                    </Button>
                  </Button.Group>
                </Space>
              </Col>
            </Row>

            {/* 高级筛选面板 */}
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div className="mb-2">
                      <Text strong><TagsOutlined /> Agent角色</Text>
                    </div>
                    <CheckboxGroup
                      options={getRoles().map(role => ({ label: role, value: role }))}
                      value={selectedRoles}
                      onChange={setSelectedRoles}
                    />
                  </Col>
                  <Col span={12}>
                    <div className="mb-2">
                      <Text strong><AimOutlined /> 任务需求</Text>
                    </div>
                    <CheckboxGroup
                      options={getTaskRequirements().map(req => ({ label: req, value: req }))}
                      value={selectedTaskRequirements}
                      onChange={setSelectedTaskRequirements}
                    />
                  </Col>
                </Row>
              </div>
            )}

            {/* 当前筛选条件显示 */}
            {(searchText || selectedUserId || selectedRoles.length > 0 || selectedTaskRequirements.length > 0) && (
              <div className="mt-4">
                <Space wrap>
                  <Text type="secondary">当前筛选:</Text>
                  {searchText && (
                    <Tag closable onClose={() => setSearchText('')}>
                      搜索: {searchText}
                    </Tag>
                  )}
                  {selectedUserId && (
                    <Tag closable onClose={() => setSelectedUserId('')}>
                      用户ID: {selectedUserId}
                    </Tag>
                  )}
                  {selectedRoles.map(role => (
                    <Tag key={role} closable onClose={() => setSelectedRoles(selectedRoles.filter(r => r !== role))}>
                      角色: {role}
                    </Tag>
                  ))}
                  {selectedTaskRequirements.map(req => (
                    <Tag key={req} closable onClose={() => setSelectedTaskRequirements(selectedTaskRequirements.filter(r => r !== req))}>
                      需求: {req}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* 搜索结果统计 */}
            <div className="flex items-center justify-between mt-4">
              <Space>
                <Text strong>
                  {filteredAgents.length > 0
                    ? `找到 ${filteredAgents.length} 个Agent (共 ${agents.length} 个)`
                    : '暂无搜索结果'
                  }
                </Text>
                {filteredAgents.length !== agents.length && (
                  <Text type="secondary">
                    筛选条件已应用
                  </Text>
                )}
              </Space>
            </div>
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="text-center py-8">
              <Spin size="large" tip="正在加载Agent..." />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert
              message="加载失败"
              description={error}
              type="error"
              showIcon
              action={
                <Button size="small" onClick={loadAgents}>
                  重试
                </Button>
              }
              className="mb-4"
            />
          )}

          {/* 搜索结果 */}
          {!loading && !error && (
            <>
              {agents.length === 0 ? (
                <Result
                  status="info"
                  title="未找到匹配的Agent"
                  subTitle="请尝试刷新页面或创建新的Agent"
                  extra={[
                    <Button
                      key="refresh"
                      onClick={loadAgents}
                    >
                      刷新
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
                <>
                  {viewMode === 'table' ? (
                    <Table
                      dataSource={filteredAgents}
                      columns={columns}
                      rowKey="id"
                      pagination={{
                        total: filteredAgents.length,
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                          `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                      }}
                    />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredAgents.map((agent) => (
                        <Col xs={24} sm={12} lg={8} xl={6} key={agent.id}>
                          <Card
                            hoverable
                            actions={[
                              <Button
                                type="link"
                                icon={<EyeOutlined />}
                                onClick={() => handleViewAgent(agent)}
                              >
                                查看详情
                              </Button>
                            ]}
                          >
                            <Card.Meta
                              avatar={
                                <Avatar
                                  size="large"
                                  icon={<RobotOutlined />}
                                  style={{ backgroundColor: '#1890ff' }}
                                />
                              }
                              title={
                                <Space>
                                  {agent.name}
                                  <Badge
                                    status={getStatusColor(agent.status) as any}
                                    text={getStatusText(agent.status)}
                                  />
                                </Space>
                              }
                              description={
                                <div>
                                  <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {agent.description}
                                  </Text>
                                  <div style={{ marginTop: 8 }}>
                                    <Space wrap>
                                      <Tag color={getLanguageColor(agent.language)}>
                                        {agent.language}
                                      </Tag>
                                      {agent.role && (
                                        <Tag color="blue">
                                          <TagsOutlined /> {agent.role}
                                        </Tag>
                                      )}
                                      {agent.rating && (
                                        <Tag color="orange">
                                          <StarOutlined /> {agent.rating.toFixed(1)}
                                        </Tag>
                                      )}
                                      <Tag>
                                        连接: {agent.connections || 0}
                                      </Tag>
                                    </Space>
                                  </div>
                                  {agent.taskRequirements && agent.taskRequirements.length > 0 && (
                                    <div style={{ marginTop: 4, fontSize: '11px', color: '#999' }}>
                                      <Text type="secondary">任务需求:</Text>
                                      <div style={{ marginTop: 2 }}>
                                        {agent.taskRequirements.slice(0, 2).map(req => (
                                          <Tag key={req} style={{ marginBottom: 2, fontSize: '11px' }}>
                                            {req}
                                          </Tag>
                                        ))}
                                        {agent.taskRequirements.length > 2 && (
                                          <Tag style={{ marginBottom: 2, fontSize: '11px' }}>
                                            +{agent.taskRequirements.length - 2}
                                          </Tag>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                                    <div>创建者: {agent.boundUser}</div>
                                    <div>创建时间: {new Date(agent.createdAt).toLocaleDateString()}</div>
                                  </div>
                                </div>
                              }
                            />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AgentDiscoveryPage;