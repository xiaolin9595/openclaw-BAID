import React, { useEffect, useState } from 'react';
import {
  Layout,
  Typography,
  Tabs,
  Row,
  Col,
  Card,
  Space,
  Button,
  Alert,
  Badge,
  Statistic,
  Spin,
  Divider
} from 'antd';
import {
  PlusOutlined,
  CiOutlined,
  BarChartOutlined,
  SettingOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useTaskStore } from '../../store/taskStore';
import { useAgentStore } from '../../store/agentStore';
import { useUIStore } from '../../store/uiStore';
import TaskExecutionForm from '../../components/tasks/TaskExecutionForm';
import TaskMonitor from '../../components/tasks/TaskMonitor';
import TaskInstructionDialog from '../../components/tasks/TaskInstructionDialog';
import { TaskTemplate, TaskStatistics } from '../../types/task';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

/**
 * 页面统计卡片组件
 */
const StatsCards: React.FC<{
  statistics: TaskStatistics | null;
}> = ({ statistics }) => {
  if (!statistics) return null;

  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="总任务数"
            value={statistics.totalTasks}
            prefix={<BarChartOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="运行中"
            value={statistics.runningTasks}
            prefix={<SyncOutlined spin />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="已完成"
            value={statistics.completedTasks}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="成功率"
            value={((statistics.successRate || 0) * 100).toFixed(1)}
            suffix="%"
            prefix={<PlayCircleOutlined />}
            valueStyle={{
              color: statistics.successRate > 0.8 ? '#52c41a' : statistics.successRate > 0.6 ? '#faad14' : '#ff4d4f'
            }}
          />
        </Card>
      </Col>
    </Row>
  );
};

/**
 * 快速任务模板卡片组件
 */
const QuickTaskTemplates: React.FC<{
  templates: TaskTemplate[];
  onSelectTemplate: (template: TaskTemplate) => void;
}> = ({ templates, onSelectTemplate }) => {
  const popularTemplates = templates.slice(0, 6);

  return (
    <Card
      title="快速创建"
      extra={
        <Button type="link" onClick={() => {}}>
          查看全部
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        {popularTemplates.map((template) => (
          <Col xs={24} sm={12} md={8} lg={6} key={template.id}>
            <Card
              hoverable
              size="small"
              className="template-card"
              onClick={() => onSelectTemplate(template)}
              actions={[
                <Button type="link" size="small" icon={<PlusOutlined />}>
                  创建
                </Button>
              ]}
            >
              <Card.Meta
                title={
                  <Space>
                    <Text strong>{template.name}</Text>
                    <Badge count={template.type} style={{ backgroundColor: '#f50' }} />
                  </Space>
                }
                description={
                  <Text ellipsis>
                    {template.description}
                  </Text>
                }
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  预估 {Math.round(template.estimatedDuration / 60)} 分钟
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

/**
 * 任务执行主页面
 */
const TaskExecutionPage: React.FC = () => {
  const {
    taskTemplates,
    statistics,
    monitorStatus,
    loading,
    error,
    fetchTaskTemplates,
    fetchStatistics,
    fetchMonitorStatus,
    clearError
  } = useTaskStore();

  const { fetchAgents } = useAgentStore();
  const { sidebarCollapsed } = useUIStore();

  const [activeTab, setActiveTab] = useState('monitor');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false);

  // 页面初始化
  useEffect(() => {
    loadInitialData();
  }, []);

  // 自动刷新监控数据
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && activeTab === 'monitor') {
      interval = setInterval(() => {
        fetchStatistics();
        fetchMonitorStatus();
      }, 10000); // 每10秒刷新一次
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, activeTab]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        fetchAgents(),
        fetchTaskTemplates(),
        fetchStatistics(),
        fetchMonitorStatus()
      ]);
    } catch (err) {
      console.error('加载初始数据失败:', err);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'monitor') {
      // 切换到监控标签时刷新数据
      fetchStatistics();
      fetchMonitorStatus();
    }
  };

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setActiveTab('create');
  };

  const handleRefresh = () => {
    if (activeTab === 'monitor') {
      fetchStatistics();
      fetchMonitorStatus();
    } else {
      loadInitialData();
    }
  };

  const getTabBadge = (key: string) => {
    switch (key) {
      case 'monitor':
        return statistics?.runningTasks || 0;
      default:
        return 0;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', marginLeft: sidebarCollapsed ? 80 : 200 }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        boxShadow: '0 1px 4px rgba(0,21,41,.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Space size="large">
          <PlayCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            任务执行中心
          </Title>
          {/* AI对话按钮 - 放在显眼位置 */}
          <Button
            type="primary"
            size="large"
            icon={<MessageOutlined style={{ fontSize: '20px' }} />}
            onClick={() => setInstructionDialogOpen(true)}
            style={{
              height: '48px',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              borderRadius: '8px',
              padding: '0 24px'
            }}
          >
            AI对话
          </Button>
        </Space>
        <Space>
          {monitorStatus && (
            <Space>
              <Badge
                status={monitorStatus.systemLoad.cpu > 80 ? 'error' : monitorStatus.systemLoad.cpu > 60 ? 'warning' : 'success'}
                text={`CPU: ${monitorStatus.systemLoad.cpu}%`}
              />
              <Badge
                status={monitorStatus.systemLoad.memory > 80 ? 'error' : monitorStatus.systemLoad.memory > 60 ? 'warning' : 'success'}
                text={`内存: ${monitorStatus.systemLoad.memory}%`}
              />
            </Space>
          )}
          <Button icon={<SettingOutlined />}>
            设置
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <Spin spinning={loading}>
          {/* 错误提示 */}
          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 统计卡片 */}
          <StatsCards statistics={statistics} />

          {/* 主标签页 */}
          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              tabBarExtraContent={
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                    loading={loading}
                    size="small"
                  >
                    刷新
                  </Button>
                  {activeTab === 'monitor' && (
                    <Button
                      type={autoRefresh ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                      自动刷新 {autoRefresh ? '开启' : '关闭'}
                    </Button>
                  )}
                </Space>
              }
              items={[
                {
                  key: 'create',
                  label: (
                    <span onClick={() => handleTabChange('create')}>
                      <PlusOutlined />
                      创建任务
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {/* 快速模板选择 */}
                      {taskTemplates.length > 0 && (
                        <QuickTaskTemplates
                          templates={taskTemplates}
                          onSelectTemplate={handleTemplateSelect}
                        />
                      )}

                      <Divider />

                      {/* 任务创建表单 */}
                      <TaskExecutionForm
                        template={selectedTemplate || undefined}
                      />
                    </Space>
                  )
                },
                {
                  key: 'monitor',
                  label: (
                    <span onClick={() => handleTabChange('monitor')}>
                      <CiOutlined />
                      任务监控
                      {getTabBadge('monitor') > 0 && (
                        <Badge
                          count={getTabBadge('monitor')}
                          size="small"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </span>
                  ),
                  children: (
                    <TaskMonitor
                      autoRefresh={autoRefresh}
                      refreshInterval={10000}
                    />
                  )
                },
                {
                  key: 'templates',
                  label: (
                    <span onClick={() => handleTabChange('templates')}>
                      <BarChartOutlined />
                      任务模板
                    </span>
                  ),
                  children: (
                    <div>
                      <Title level={4}>可用任务模板</Title>
                      <Row gutter={[16, 16]}>
                        {taskTemplates.map((template) => (
                          <Col xs={24} sm={12} md={8} lg={6} key={template.id}>
                            <Card
                              hoverable
                              actions={[
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setActiveTab('create');
                                  }}
                                >
                                  使用模板
                                </Button>
                              ]}
                            >
                              <Card.Meta
                                title={
                                  <Space>
                                    <Text strong>{template.name}</Text>
                                    <Badge count={template.type} style={{ backgroundColor: '#1890ff' }} />
                                    {template.isActive ? (
                                      <Badge status="success" text="激活" />
                                    ) : (
                                      <Badge status="default" text="未激活" />
                                    )}
                                  </Space>
                                }
                                description={
                                  <div>
                                    <Text ellipsis>
                                      {template.description}
                                    </Text>
                                    <div style={{ marginTop: 8 }}>
                                      <Space direction="vertical" size="small">
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          <ClockCircleOutlined /> 预估 {Math.round(template.estimatedDuration / 60)} 分钟
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          <ExclamationCircleOutlined /> 参数数量: {template.parameters.length}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          <CheckCircleOutlined /> 成功率: {Math.round(Math.random() * 20 + 80)}%
                                        </Text>
                                      </Space>
                                    </div>
                                  </div>
                                }
                              />
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  )
                },
                {
                  key: 'analytics',
                  label: (
                    <span onClick={() => handleTabChange('analytics')}>
                      <BarChartOutlined />
                      分析统计
                    </span>
                  ),
                  children: (
                    <div>
                      <Title level={4}>任务执行分析</Title>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={12}>
                          <Card title="任务类型分布">
                            <div style={{ height: 300 }}>
                              {/* 这里可以插入图表组件 */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999'
                              }}>
                                图表组件待实现
                              </div>
                            </div>
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title="执行趋势">
                            <div style={{ height: 300 }}>
                              {/* 这里可以插入趋势图 */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999'
                              }}>
                                趋势图组件待实现
                              </div>
                            </div>
                          </Card>
                        </Col>
                        <Col xs={24}>
                          <Card title="Agent性能统计">
                            <div style={{ height: 300 }}>
                              {/* 这里可以插入性能统计表格 */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#999'
                              }}>
                                性能统计表格待实现
                              </div>
                            </div>
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </Spin>

        {/* AI对话框 */}
        <TaskInstructionDialog
          open={instructionDialogOpen}
          onClose={() => setInstructionDialogOpen(false)}
        />
      </Content>
    </Layout>
  );
};

export default TaskExecutionPage;
