import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Progress,
  Timeline,
  Drawer,
  Modal,
  Alert,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Badge,
  Dropdown,
  Menu,
  message,
  Spin,
  Tabs,
  List,
  Avatar,
  Descriptions,
  Divider,
  Switch,
  Input,
  Select,
  DatePicker,
  Popconfirm
} from 'antd';
import TaskExecutionResult from './TaskExecutionResult';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SettingOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  FilterOutlined,
  DownloadOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useTaskStore } from '../../store/taskStore';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
  TaskLog,
  TaskResult,
  TaskStatistics,
  TaskMonitorStatus,
  TaskFilter,
  TaskSort
} from '../../types/task';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

interface TaskMonitorProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const getTaskAgentName = (task: Task) => {
  return task.agent?.name || task.agentId || '未知Agent';
};

/**
 * 任务状态标签组件
 */
const TaskStatusTag: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const statusConfig = {
    [TaskStatus.PENDING]: { color: 'default', icon: <ClockCircleOutlined />, text: '待执行' },
    [TaskStatus.RUNNING]: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
    [TaskStatus.COMPLETED]: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
    [TaskStatus.FAILED]: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
    [TaskStatus.CANCELLED]: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '已取消' },
    [TaskStatus.PAUSED]: { color: 'warning', icon: <PauseCircleOutlined />, text: '已暂停' }
  };

  const config = statusConfig[status];

  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

/**
 * 任务优先级标签组件
 */
const TaskPriorityTag: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const priorityConfig = {
    [TaskPriority.LOW]: { color: 'default', text: '低' },
    [TaskPriority.NORMAL]: { color: 'blue', text: '普通' },
    [TaskPriority.HIGH]: { color: 'orange', text: '高' },
    [TaskPriority.URGENT]: { color: 'red', text: '紧急' }
  };

  const config = priorityConfig[priority];

  return <Tag color={config.color}>{config.text}</Tag>;
};

/**
 * 任务操作菜单组件
 */
const TaskActionsMenu: React.FC<{
  task: Task;
  onAction: (action: string, taskId: string) => void;
}> = ({ task, onAction }) => {
  const handleMenuClick = ({ key }: { key: string }) => {
    onAction(key, task.id);
  };

  const menu = (
    <Menu onClick={handleMenuClick}>
      {task.status === TaskStatus.RUNNING && (
        <Menu.Item key="pause" icon={<PauseCircleOutlined />}>
          暂停任务
        </Menu.Item>
      )}
      {task.status === TaskStatus.PAUSED && (
        <Menu.Item key="resume" icon={<PlayCircleOutlined />}>
          恢复任务
        </Menu.Item>
      )}
      {(task.status === TaskStatus.FAILED || task.status === TaskStatus.CANCELLED) && (
        <Menu.Item key="retry" icon={<ReloadOutlined />}>
          重试任务
        </Menu.Item>
      )}
      {(task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING || task.status === TaskStatus.PAUSED) && (
        <Menu.Item key="cancel" icon={<CloseCircleOutlined />}>
          取消任务
        </Menu.Item>
      )}
      <Menu.Divider />
      <Menu.Item key="view" icon={<EyeOutlined />}>
        查看详情
      </Menu.Item>
      <Menu.Item key="logs" icon={<InfoCircleOutlined />}>
        查看日志
      </Menu.Item>
      <Menu.Item key="download" icon={<DownloadOutlined />}>
        下载结果
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" danger icon={<DeleteOutlined />}>
        删除任务
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown overlay={menu} trigger={['click']}>
      <Button type="text" icon={<MoreOutlined />} size="small" />
    </Dropdown>
  );
};

/**
 * 任务进度条组件
 */
const TaskProgressBar: React.FC<{ task: Task }> = ({ task }) => {
  const getStatusColor = () => {
    switch (task.status) {
      case TaskStatus.RUNNING:
        return {
          strokeColor: '#1890ff',
          trailColor: '#f0f0f0'
        };
      case TaskStatus.COMPLETED:
        return {
          strokeColor: '#52c41a',
          trailColor: '#f0f0f0'
        };
      case TaskStatus.FAILED:
        return {
          strokeColor: '#ff4d4f',
          trailColor: '#f0f0f0'
        };
      case TaskStatus.CANCELLED:
        return {
          strokeColor: '#faad14',
          trailColor: '#f0f0f0'
        };
      default:
        return {
          strokeColor: '#d9d9d9',
          trailColor: '#f0f0f0'
        };
    }
  };

  const statusColor = getStatusColor();

  return (
    <Progress
      percent={Math.round(task.progress)}
      size="small"
      strokeColor={statusColor.strokeColor}
      trailColor={statusColor.trailColor}
      format={(percent) => `${percent}%`}
    />
  );
};

/**
 * 任务详情抽屉组件
 */
const TaskDetailDrawer: React.FC<{
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onRefresh: (taskId: string) => void;
}> = ({ task, visible, onClose, onRefresh }) => {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && visible) {
      loadTaskDetails(task.id);
    }
  }, [task, visible]);

  const loadTaskDetails = async (taskId: string) => {
    setLoading(true);
    try {
      // 这里应该调用 store 或 service 方法获取详细信息
      // await useTaskStore.getState().fetchTaskLogs(taskId);
      // await useTaskStore.getState().fetchTaskResult(taskId);
      // 模拟数据
      setTimeout(() => {
        setLogs([
          {
            id: '1',
            timestamp: new Date(),
            level: 'info',
            message: '任务开始执行',
            source: 'system'
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 30000),
            level: 'info',
            message: '正在处理数据...',
            source: 'agent'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('加载任务详情失败:', error);
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('zh-CN');
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warn':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <Text strong>任务详情</Text>
          {task && <TaskStatusTag status={task.status} />}
        </Space>
      }
      width={800}
      visible={visible}
      onClose={onClose}
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => task && onRefresh(task.id)}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      }
    >
      {task && (
        <Spin spinning={loading}>
          <Tabs defaultActiveKey="info">
            <TabPane tab="基本信息" key="info">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
                <Descriptions.Item label="任务类型">
                  <Tag color="blue">{task.type}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <TaskPriorityTag priority={task.priority} />
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <TaskStatusTag status={task.status} />
                </Descriptions.Item>
                <Descriptions.Item label="执行Agent">{task.agent.name}</Descriptions.Item>
                <Descriptions.Item label="进度">
                  <TaskProgressBar task={task} />
                </Descriptions.Item>
                <Descriptions.Item label="执行时间">
                  {task.executionTime > 0 ? `${Math.round(task.executionTime / 1000)}秒` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="重试次数">
                  {task.retryCount} / {task.maxRetries}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatTime(task.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {formatTime(task.updatedAt)}
                </Descriptions.Item>
                {task.startedAt && (
                  <Descriptions.Item label="开始时间">
                    {formatTime(task.startedAt)}
                  </Descriptions.Item>
                )}
                {task.completedAt && (
                  <Descriptions.Item label="完成时间">
                    {formatTime(task.completedAt)}
                  </Descriptions.Item>
                )}
                {task.error && (
                  <Descriptions.Item label="错误信息" span={2}>
                    <Alert
                      message="执行失败"
                      description={task.error}
                      type="error"
                      showIcon
                    />
                  </Descriptions.Item>
                )}
              </Descriptions>

              {task.tags.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>标签：</Text>
                  <div style={{ marginTop: 8 }}>
                    {task.tags.map((tag, index) => (
                      <Tag key={index} color="blue">
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </TabPane>

            <TabPane tab="执行参数" key="parameters">
              <Card size="small">
                <pre style={{ fontSize: '12px', maxHeight: '400px', overflow: 'auto' }}>
                  {JSON.stringify(task.parameters, null, 2)}
                </pre>
              </Card>
            </TabPane>

            <TabPane tab={`执行日志 (${logs.length})`} key="logs">
              <Timeline mode="left">
                {logs.map((log) => (
                  <Timeline.Item
                    key={log.id}
                    dot={getLogIcon(log.level)}
                    color={log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'blue'}
                  >
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatTime(log.timestamp)}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Text>{log.message}</Text>
                      {log.source && (
                        <Tag style={{ marginLeft: 8 }}>
                          {log.source}
                        </Tag>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </TabPane>

            <TabPane tab="执行结果" key="result">
              <TaskExecutionResult
                task={task}
                result={task.result || result || undefined}
                loading={loading}
              />
            </TabPane>
          </Tabs>
        </Spin>
      )}
    </Drawer>
  );
};

/**
 * 任务监控主组件
 */
const TaskMonitor: React.FC<TaskMonitorProps> = ({
  className,
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const {
    tasks,
    statistics,
    monitorStatus,
    loading,
    error,
    fetchTasks,
    fetchStatistics,
    fetchMonitorStatus,
    cancelTask,
    pauseTask,
    resumeTask,
    retryTask,
    deleteTask,
    batchCancelTasks,
    batchDeleteTasks,
    clearError
  } = useTaskStore();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState<TaskFilter>({});
  const [sorter, setSorter] = useState<TaskSort>({ field: 'createdAt', order: 'desc' });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh);

  useEffect(() => {
    loadTaskData();
    if (autoRefreshEnabled) {
      const interval = setInterval(loadTaskData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshEnabled, refreshInterval]);

  const loadTaskData = async () => {
    try {
      await Promise.all([
        fetchTasks({ filter: filters, sort: sorter }),
        fetchStatistics(),
        fetchMonitorStatus()
      ]);
    } catch (error) {
      console.error('加载任务数据失败:', error);
    }
  };

  const handleTaskAction = async (action: string, taskId: string) => {
    try {
      switch (action) {
        case 'pause':
          await pauseTask(taskId);
          message.success('任务已暂停');
          break;
        case 'resume':
          await resumeTask(taskId);
          message.success('任务已恢复');
          break;
        case 'retry':
          await retryTask(taskId);
          message.success('任务已重试');
          break;
        case 'cancel':
          await cancelTask(taskId);
          message.success('任务已取消');
          break;
        case 'delete':
          Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个任务吗？此操作不可撤销。',
            onOk: async () => {
              await deleteTask(taskId);
              message.success('任务已删除');
            }
          });
          break;
        case 'view':
          const task = tasks.find(t => t.id === taskId);
          setSelectedTask(task || null);
          setDetailVisible(true);
          break;
        case 'logs':
          const logTask = tasks.find(t => t.id === taskId);
          setSelectedTask(logTask || null);
          setDetailVisible(true);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的任务');
      return;
    }

    try {
      switch (action) {
        case 'cancel':
          await batchCancelTasks(selectedRowKeys);
          message.success(`已取消 ${selectedRowKeys.length} 个任务`);
          setSelectedRowKeys([]);
          break;
        case 'delete':
          Modal.confirm({
            title: '批量删除确认',
            content: `确定要删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可撤销。`,
            onOk: async () => {
              await batchDeleteTasks(selectedRowKeys);
              message.success(`已删除 ${selectedRowKeys.length} 个任务`);
              setSelectedRowKeys([]);
            }
          });
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('批量操作失败:', error);
      message.error('批量操作失败，请重试');
    }
  };

  const handleFilterChange = (newFilters: Partial<TaskFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSorter({
        field: sorter.field,
        order: sorter.order === 'ascend' ? 'asc' : 'desc'
      });
    }
  };

  const formatRelativeTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
    } catch {
      return date.toLocaleString('zh-CN');
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Task) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Space size={4}>
            <Tag>{record.type}</Tag>
            {(record.tags || []).slice(0, 2).map((tag, index) => (
              <Tag key={index} color="blue">
                {tag}
              </Tag>
            ))}
          </Space>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskStatus) => <TaskStatusTag status={status} />
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: TaskPriority) => <TaskPriorityTag priority={priority} />
    },
    {
      title: '执行Agent',
      dataIndex: ['agent', 'name'],
      key: 'agent',
      render: (text: string, record: Task) => (
        <Space>
          <Avatar size="small">{getTaskAgentName(record).charAt(0)}</Avatar>
          <Text>{text || getTaskAgentName(record)}</Text>
        </Space>
      )
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: Task) => (
        <TaskProgressBar task={record} />
      )
    },
    {
      title: '执行时间',
      dataIndex: 'executionTime',
      key: 'executionTime',
      render: (time: number) =>
        time > 0 ? `${Math.round(time / 1000)}s` : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => formatRelativeTime(date),
      sorter: true
    },
    {
      title: '操作',
      key: 'actions',
      render: (text: any, record: Task) => (
        <TaskActionsMenu task={record} onAction={handleTaskAction} />
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: Task) => ({
      disabled: record.status === TaskStatus.COMPLETED
    })
  };

  return (
    <div className={className}>
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总任务数"
                value={statistics?.totalTasks || 0}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="运行中"
                value={statistics?.runningTasks || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<SyncOutlined spin />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已完成"
                value={statistics?.completedTasks || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功率"
                value={((statistics?.successRate || 0) * 100).toFixed(1)}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
                prefix={<LineChartOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 系统状态 */}
        {monitorStatus && (
          <Card
            title={
              <Space>
                <SettingOutlined />
                系统状态
              </Space>
            }
            extra={
              <Space>
                <Text>自动刷新</Text>
                <Switch
                  checked={autoRefreshEnabled}
                  onChange={setAutoRefreshEnabled}
                  size="small"
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadTaskData}
                  loading={loading}
                  size="small"
                >
                  刷新
                </Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="活跃任务"
                  value={monitorStatus.activeTasks}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="队列长度"
                  value={monitorStatus.queueLength}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col span={8}>
                <Space>
                  <Text>CPU: {monitorStatus.systemLoad.cpu}%</Text>
                  <Text>内存: {monitorStatus.systemLoad.memory}%</Text>
                  <Text>磁盘: {monitorStatus.systemLoad.disk}%</Text>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* 过滤和操作栏 */}
        <Card
          title="任务列表"
          extra={
            <Space>
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  // 显示高级过滤器
                }}
              >
                高级筛选
              </Button>
              {selectedRowKeys.length > 0 && (
                <>
                  <Button
                    onClick={() => handleBatchAction('cancel')}
                    disabled={selectedRowKeys.length === 0}
                  >
                    批量取消
                  </Button>
                  <Button
                    danger
                    onClick={() => handleBatchAction('delete')}
                    disabled={selectedRowKeys.length === 0}
                  >
                    批量删除
                  </Button>
                </>
              )}
            </Space>
          }
        >
          {/* 基础过滤器 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Search
                placeholder="搜索任务名称"
                onSearch={(value) => handleFilterChange({ search: value })}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="状态"
                style={{ width: '100%' }}
                allowClear
                onChange={(value) => handleFilterChange({ status: value ? [value] : undefined })}
              >
                <Option value="pending">待执行</Option>
                <Option value="running">执行中</Option>
                <Option value="completed">已完成</Option>
                <Option value="failed">失败</Option>
                <Option value="cancelled">已取消</Option>
                <Option value="paused">已暂停</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="优先级"
                style={{ width: '100%' }}
                allowClear
                onChange={(value) => handleFilterChange({ priority: value ? [value] : undefined })}
              >
                <Option value="low">低</Option>
                <Option value="normal">普通</Option>
                <Option value="high">高</Option>
                <Option value="urgent">紧急</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="任务类型"
                style={{ width: '100%' }}
                allowClear
                onChange={(value) => handleFilterChange({ type: value ? [value] : undefined })}
              >
                <Option value="data_processing">数据处理</Option>
                <Option value="content_generation">内容生成</Option>
                <Option value="analysis">分析</Option>
                <Option value="automation">自动化</Option>
                <Option value="security">安全</Option>
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => {
                  if (dates) {
                    handleFilterChange({
                      dateRange: {
                        start: dates[0]!.toDate(),
                        end: dates[1]!.toDate()
                      }
                    });
                  } else {
                    handleFilterChange({ dateRange: undefined });
                  }
                }}
              />
            </Col>
          </Row>

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

          {/* 任务表格 */}
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            rowSelection={rowSelection}
            onChange={handleTableChange}
            pagination={{
              total: useTaskStore.getState().pagination.total,
              pageSize: useTaskStore.getState().pagination.limit,
              current: useTaskStore.getState().pagination.page,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            loading={loading}
            size="middle"
          />
        </Card>

        {/* 任务详情抽屉 */}
        <TaskDetailDrawer
          task={selectedTask}
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          onRefresh={(taskId) => {
            // 刷新单个任务详情
            loadTaskData();
          }}
        />
      </Spin>
    </div>
  );
};

export default TaskMonitor;
