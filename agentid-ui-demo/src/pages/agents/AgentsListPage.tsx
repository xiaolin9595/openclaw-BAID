import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  Avatar,
  Tooltip,
  Badge,
  Statistic,
  message,
  Empty
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  UserOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '../../store/agentStore';
import { useAuthStore } from '../../store/authStore';
import { DemoWrapper } from '../../components/ui/DemoWrapper';
import AgentPermissionModal from '../../components/agents/AgentPermissionModal';

const { Title, Text } = Typography;

const AgentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    agents,
    loading,
    error,
    fetchAgents,
    deleteAgent,
    updateAgentStatus,
    setSelectedAgent,
    clearError
  } = useAgentStore();

  const { user, isAuthenticated } = useAuthStore();

  // 权限管理模态框状态
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedAgentForPermission, setSelectedAgentForPermission] = useState<any>(null);

  // 筛选出当前用户的Agent
  const userAgents = useMemo(() => {
    if (!user || !isAuthenticated) {
      return [];
    }
    return agents.filter(agent => agent.boundUser === user.userId || agent.boundUser === user.id);
  }, [agents, user, isAuthenticated]);

  useEffect(() => {
    fetchAgents();
  }, []);

  // 监听路由变化，当从创建页面返回时刷新数据
  useEffect(() => {
    const handleFocus = () => {
      fetchAgents();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleCreateAgent = () => {
    navigate('/agents/create');
  };

  const handleViewAgent = (agent: any) => {
    setSelectedAgent(agent);
    navigate(`/agents/${agent.id}`);
  };

  const handleEditAgent = (agent: any) => {
    setSelectedAgent(agent);
    navigate(`/agents/${agent.id}`);
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteAgent(agentId);
      message.success('Agent删除成功');
    } catch (error) {
      message.error('Agent删除失败');
    }
  };

  const handleToggleStatus = async (agent: any) => {
    try {
      const newStatus = agent.status === 'active' ? 'inactive' : 'active';
      await updateAgentStatus(agent.id, newStatus);
      message.success(`Agent状态已更新为${newStatus === 'active' ? '运行中' : '已停止'}`);
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleManagePermissions = (agent: any) => {
    setSelectedAgentForPermission(agent);
    setPermissionModalOpen(true);
  };

  const handleClosePermissionModal = () => {
    setPermissionModalOpen(false);
    setSelectedAgentForPermission(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'red';
      case 'pending': return 'orange';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '运行中';
      case 'inactive': return '已停止';
      case 'pending': return '待启动';
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

  const columns = [
    {
      title: 'Agent',
      key: 'agent',
      width: 300,
      render: (record: any) => (
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
              <Tag>
                v{record.version}
              </Tag>
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={getStatusText(status)}
        />
      ),
    },
    {
      title: '配置信息',
      key: 'config',
      width: 200,
      render: (record: any) => (
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>CPU: {record.config?.cpu || 'N/A'}</div>
          <div>内存: {record.config?.memory || 'N/A'}</div>
          <div>并发: {record.config?.maxConcurrency || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (record: any) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewAgent(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditAgent(record)}
            />
          </Tooltip>
          <Tooltip title="权限管理">
            <Button
              type="text"
              icon={<SafetyCertificateOutlined />}
              onClick={() => handleManagePermissions(record)}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? '停止' : '启动'}>
            <Button
              type="text"
              icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteAgent(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const activeAgents = userAgents.filter(agent => agent.status === 'active').length;
  const totalAgents = userAgents.length;

  return (
    <DemoWrapper
      showWatermark={true}
      showTooltip={true}
      tooltipTitle="Agent管理演示"
      tooltipContent="Agent管理功能包括创建、查看、编辑、删除和状态控制。所有数据均为模拟数据，用于演示目的。"
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* 头部操作区 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2}>
              <RobotOutlined className="mr-2" />
              我的Agent
            </Title>
            <Text type="secondary">管理绑定到您账户的Agent智能代理</Text>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleCreateAgent}
          >
            创建Agent
          </Button>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总Agent数"
                value={totalAgents}
                prefix={<RobotOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="运行中"
                value={activeAgents}
                prefix={<PlayCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="已停止"
                value={totalAgents - activeAgents}
                prefix={<PauseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="平均运行时长"
                value={24}
                suffix="小时"
                prefix={<SettingOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Agent列表 */}
        <Card>
          {!isAuthenticated || !user ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Title level={4} type="secondary">
                      <UserOutlined style={{ marginRight: 8 }} />
                      请先登录
                    </Title>
                    <Text type="secondary">
                      您需要登录后才能查看和管理您的Agent
                    </Text>
                  </div>
                }
              />
            </div>
          ) : (
            <Table
              dataSource={userAgents}
              columns={columns}
              rowKey="id"
              loading={loading}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div>
                        <Title level={4} type="secondary">
                          <RobotOutlined style={{ marginRight: 8 }} />
                          暂无Agent
                        </Title>
                        <Text type="secondary">
                          您还没有创建任何Agent，点击上方按钮开始创建
                        </Text>
                      </div>
                    }
                  />
                )
              }}
              pagination={{
                total: userAgents.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              }}
            />
          )}
        </Card>
      </div>

      {/* 权限管理模态框 */}
      <AgentPermissionModal
        open={permissionModalOpen}
        agent={selectedAgentForPermission}
        onClose={handleClosePermissionModal}
      />
    </DemoWrapper>
  );
};

export default AgentsListPage;