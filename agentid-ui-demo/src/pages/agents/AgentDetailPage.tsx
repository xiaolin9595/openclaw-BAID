import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Button, Tag, Descriptions, Space, Divider, Modal, message, Row, Col, Badge, Table, Collapse } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  RedoOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useAgentStore } from '../../store/agentStore';
import { useAuthStore } from '../../store/authStore';
import { Agent } from '../../types/agent';
import CommunicationModal from '../../components/agents/CommunicationModal';
import VerificationModal from '../../components/agents/VerificationModal';
import type { AgentCommunicationRequest } from '../../types/agent-discovery';
import { sharedAgentData } from '../../mocks/sharedAgentData';

const { Title, Text } = Typography;
const { Panel } = Collapse;

/**
 * 任务类型标签映射
 */
const COMMUNICATION_TYPE_LABELS: Record<string, string> = {
  data_analysis: '数据分析任务',
  content_creation: '内容创作任务',
  research: '调研分析任务',
  automation: '自动化执行任务',
  monitoring: '监控预警任务',
  integration: '系统集成任务',
  other: '其他'
};

const getPermissionLabel = (permission: unknown) => {
  if (typeof permission === 'string') {
    return permission;
  }

  if (permission && typeof permission === 'object') {
    const permissionRecord = permission as { name?: string; id?: string };
    return permissionRecord.name || permissionRecord.id || 'unknown';
  }

  return 'unknown';
};

const createRecoveredAgent = (agentId: string, userId: string): Agent | null => {
  if (!agentId.startsWith('agent_shared_') && !agentId.startsWith('agent_')) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: agentId,
    agentId,
    name: `Agent ${agentId.replace(/^agent_shared_/, '').replace(/^agent_/, '')}`,
    description: '该 Agent 的运行时详情数据已恢复。后续新建的 Agent 会持久化保存，刷新后仍可查看完整详情。',
    codeHash: '0xrestored',
    profileHash: '0xrestored',
    status: 'active',
    boundUser: userId,
    boundAt: now,
    createdAt: now,
    updatedAt: now,
    codeSize: 0,
    language: 'unknown',
    version: '1.0.0',
    config: {
      permissions: ['read'],
      userBinding: {
        boundUserId: userId,
        bindingType: 'faceBiometrics',
        bindingStrength: 'basic',
        verificationFrequency: 'once',
        fallbackAllowed: true
      }
    },
    permissions: ['read']
  };
};

const AgentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    agents,
    loading,
    error,
    fetchAgents,
    setSelectedAgent,
    clearError,
    updateAgentStatus,
    deleteAgent
  } = useAgentStore();
  const { user } = useAuthStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [fetching, setFetching] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [communicating] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<AgentCommunicationRequest | null>(null);

  // 判断来源
  const isFromDiscovery = searchParams.get('from') === 'discovery';
  // 判断是否为所有者
  const isOwner = user?.id === agent?.boundUser;

  // 获取当前用户管理的Agent列表（只显示active状态的）
  const myAgents = sharedAgentData.getAgents().filter(a => a.boundUser === user?.id);

  useEffect(() => {
    if (!id) {
      return;
    }

    const loadAgent = async () => {
      setFetching(true);
      clearError();

      try {
        // 首先从现有agents数组中查找
        let foundAgent = agents.find(agent => agent.id === id || agent.agentId === id);

        if (!foundAgent) {
          foundAgent = sharedAgentData.findAgent(id);
        }

        // 如果没找到且agents数组为空，先获取所有agents
        if (!foundAgent && agents.length === 0) {
          await fetchAgents();
          // 从store中获取更新后的agents数组
          const currentAgents = useAgentStore.getState().agents;
          foundAgent = currentAgents.find(agent => agent.id === id || agent.agentId === id);
        }

        if (!foundAgent) {
          foundAgent = createRecoveredAgent(id, user?.id || user?.userId || 'demo_user_001') ?? undefined;
        }

        if (foundAgent) {
          setAgent(foundAgent);
          setSelectedAgent(foundAgent);
        } else {
          // 如果仍然没找到，清除selectedAgent
          setSelectedAgent(null);
        }
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        setFetching(false);
      }
    };

    loadAgent();
  }, [id, agents, fetchAgents, setSelectedAgent, clearError]);

  // 处理返回按钮
  const handleBack = () => {
    // 如果从发现页来，返回发现页；否则返回管理页
    if (isFromDiscovery) {
      navigate('/agent-discovery');
    } else {
      navigate('/agents');
    }
  };

  // 处理状态变更
  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'stopped') => {
    if (!agent) return;

    Modal.confirm({
      title: '确认操作',
      icon: <ExclamationCircleOutlined />,
      content: `确定要${newStatus === 'active' ? '启动' : newStatus === 'inactive' ? '暂停' : '停止'}Agent "${agent.name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          setStatusLoading(true);
          await updateAgentStatus(agent.id, newStatus);
          message.success(`Agent已${newStatus === 'active' ? '启动' : newStatus === 'inactive' ? '暂停' : '停止'}`);
          // 更新本地状态
          setAgent(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
        } catch (error) {
          message.error(`操作失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setStatusLoading(false);
        }
      }
    });
  };

  // 处理建立通信
  const handleEstablishCommunication = () => {
    if (!agent) return;
    setCommunicationModalVisible(true);
  };

  // 处理通信提交
  const handleCommunicationSubmit = async (request: AgentCommunicationRequest) => {
    if (!agent) return;

    // 保存请求到pendingRequest
    setPendingRequest(request);

    // 关闭配置Modal
    setCommunicationModalVisible(false);

    // 打开验证Modal
    setVerificationVisible(true);
  };

  // 处理重启Agent
  const handleRestart = async () => {
    if (!agent) return;

    Modal.confirm({
      title: '确认重启',
      icon: <ExclamationCircleOutlined />,
      content: `确定要重启Agent "${agent.name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          setStatusLoading(true);
          await updateAgentStatus(agent.id, 'stopped');
          await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟重启延迟
          await updateAgentStatus(agent.id, 'active');
          message.success('Agent重启成功');
          // 更新本地状态
          setAgent(prev => prev ? { ...prev, status: 'active', updatedAt: new Date().toISOString() } : null);
        } catch (error) {
          message.error(`重启失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setStatusLoading(false);
        }
      }
    });
  };

  // 处理验证成功
  const handleVerificationSuccess = async () => {
    setVerificationVisible(false);

    if (!pendingRequest || !agent) return;

    try {
      // 模拟建立通信
      await new Promise(resolve => setTimeout(resolve, 1000));

      const myAgent = myAgents.find(a => a.agentId === pendingRequest.fromAgentId);
      const taskType = COMMUNICATION_TYPE_LABELS[pendingRequest.type] || pendingRequest.type;

      message.success(`已建立 ${myAgent?.name} 与 ${agent.name} 的${taskType}连接`);
      setPendingRequest(null);
    } catch {
      message.error('建立通信失败');
    }
  };

  // 处理验证失败
  const handleVerificationError = (error: string) => {
    setVerificationVisible(false);
    message.error(`验证失败: ${error}`);
    setPendingRequest(null);
  };

  // 处理删除Agent
  const handleDelete = async () => {
    if (!agent) return;

    Modal.confirm({
      title: '确认删除',
      icon: <WarningOutlined />,
      content: `确定要删除Agent "${agent.name}"吗？此操作不可恢复！`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setDeleteLoading(true);
          await deleteAgent(agent.id);
          message.success('Agent删除成功');
          // 返回列表页
          navigate('/agents');
        } catch (error) {
          message.error(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setDeleteLoading(false);
        }
      }
    });
  };

  // 处理编辑配置
  const handleEditConfig = () => {
    if (!agent) return;
    message.info('配置编辑功能正在开发中...');
    // TODO: 实现配置编辑功能
  };

  // 处理查看日志
  const handleViewLogs = () => {
    if (!agent) return;
    message.info('日志查看功能正在开发中...');
    // TODO: 实现日志查看功能
  };

  // 加载状态
  if (fetching || loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>加载Agent详情中...</Text>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleBack}>
              返回列表
            </Button>
          }
        />
      </div>
    );
  }

  // Agent不存在
  if (!agent) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Title level={2}>Agent不存在</Title>
          <Text type="secondary">
            找不到ID为 {id} 的Agent，可能已被删除或您没有访问权限。
          </Text>
          <div style={{ marginTop: '16px' }}>
            <Button type="primary" onClick={handleBack}>
              返回Agent列表
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 获取状态标签颜色
  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'orange';
      case 'stopped':
        return 'red';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space align="center">
                <Button onClick={handleBack}>返回列表</Button>
                <Title level={2} style={{ margin: 0 }}>
                  {agent.name}
                </Title>
                <Tag color={getStatusColor(agent.status)}>
                  {agent.status.toUpperCase()}
                </Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                {/* 从发现页来或非所有者：显示建立通信按钮 */}
                {(isFromDiscovery || !isOwner) && (
                  <Button
                    type="primary"
                    icon={<MessageOutlined />}
                    onClick={handleEstablishCommunication}
                    loading={communicating}
                    disabled={communicating}
                  >
                    建立通信
                  </Button>
                )}

                {/* 管理按钮：只在非发现页且是所有者时显示 */}
                {!isFromDiscovery && isOwner && (
                  <>
                    {agent.status === 'active' && (
                      <Button
                        icon={<PauseCircleOutlined />}
                        onClick={() => handleStatusChange('inactive')}
                        loading={statusLoading}
                        disabled={statusLoading}
                      >
                        暂停
                      </Button>
                    )}
                    {agent.status === 'inactive' && (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleStatusChange('active')}
                        loading={statusLoading}
                        disabled={statusLoading}
                      >
                        启动
                      </Button>
                    )}
                    {agent.status !== 'stopped' && (
                      <Button
                        icon={<StopOutlined />}
                        onClick={() => handleStatusChange('stopped')}
                        loading={statusLoading}
                        disabled={statusLoading}
                        danger
                      >
                        停止
                      </Button>
                    )}
                    <Button
                      icon={<RedoOutlined />}
                      onClick={handleRestart}
                      loading={statusLoading}
                      disabled={statusLoading || agent.status === 'stopped'}
                    >
                      重启
                    </Button>
                    <Button
                      icon={<EditOutlined />}
                      onClick={handleEditConfig}
                    >
                      编辑配置
                    </Button>
                    <Button
                      icon={<EyeOutlined />}
                      onClick={handleViewLogs}
                    >
                      查看日志
                    </Button>
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={handleDelete}
                      loading={deleteLoading}
                      disabled={deleteLoading}
                      danger
                    >
                      删除
                    </Button>
                  </>
                )}
              </Space>
            </Col>
          </Row>
        </div>

        <Divider />

        <Descriptions bordered column={2}>
          <Descriptions.Item label="Agent ID">{agent.agentId}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={getStatusColor(agent.status)}>
              {agent.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {agent.description}
          </Descriptions.Item>
          <Descriptions.Item label="编程语言">{agent.language}</Descriptions.Item>
          <Descriptions.Item label="代码大小">{formatFileSize(agent.codeSize)}</Descriptions.Item>
          <Descriptions.Item label="绑定用户">{agent.boundUser}</Descriptions.Item>
          <Descriptions.Item label="绑定时间">
            {new Date(agent.boundAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(agent.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(agent.updatedAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <div>
          <Title level={4}>技术信息</Title>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="代码哈希">
              <Text code copyable={{ text: agent.codeHash }}>
                {agent.codeHash}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="配置哈希">
              <Text code copyable={{ text: agent.profileHash }}>
                {agent.profileHash}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        <div>
          <Title level={4}>权限配置</Title>
          <Space wrap>
            {agent.permissions.map((permission, index) => (
              <Tag key={index} color="blue">
                {getPermissionLabel(permission)}
              </Tag>
            ))}
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={4}>用户绑定配置</Title>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="绑定类型">{agent.config.userBinding.bindingType}</Descriptions.Item>
            <Descriptions.Item label="绑定强度">{agent.config.userBinding.bindingStrength}</Descriptions.Item>
            <Descriptions.Item label="验证频率">{agent.config.userBinding.verificationFrequency}</Descriptions.Item>
            <Descriptions.Item label="允许回退">
              {agent.config.userBinding.fallbackAllowed ? '是' : '否'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 生物特征信息 */}
        {agent.config.userBinding.userFaceFeatures && (
          <>
            <Divider />
            <div>
              <Title level={4}>生物特征信息</Title>
              <Collapse size="small">
                <Panel header="面部特征详情" key="faceFeatures">
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="特征模板ID">{agent.config.userBinding.userFaceFeatures.templateId}</Descriptions.Item>
                    <Descriptions.Item label="置信度">
                      <Badge
                        status={agent.config.userBinding.userFaceFeatures.confidence > 0.95 ? 'success' : agent.config.userBinding.userFaceFeatures.confidence > 0.8 ? 'warning' : 'error'}
                        text={`${(agent.config.userBinding.userFaceFeatures.confidence * 100).toFixed(1)}%`}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="活体检测">
                      {agent.config.userBinding.userFaceFeatures.livenessCheck ? (
                        <Badge status="success" text="已启用" />
                      ) : (
                        <Badge status="error" text="未启用" />
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="防欺骗检测">
                      {agent.config.userBinding.userFaceFeatures.antiSpoofing ? (
                        <Badge status="success" text="已启用" />
                      ) : (
                        <Badge status="error" text="未启用" />
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="注册时间">
                      {new Date(agent.config.userBinding.userFaceFeatures.enrollmentDate).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后验证时间">
                      {agent.config.userBinding.userFaceFeatures.lastVerified
                        ? new Date(agent.config.userBinding.userFaceFeatures.lastVerified).toLocaleString()
                        : '未验证'
                      }
                    </Descriptions.Item>
                  </Descriptions>
                </Panel>
              </Collapse>
            </div>
          </>
        )}

        {/* 运行时信息 */}
        <Divider />
        <div>
          <Title level={4}>运行时信息</Title>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="运行状态">
              <Badge
                status={agent.status === 'active' ? 'success' : agent.status === 'inactive' ? 'warning' : agent.status === 'error' ? 'error' : 'default'}
                text={agent.status === 'active' ? '运行中' : agent.status === 'inactive' ? '已暂停' : agent.status === 'error' ? '错误' : '已停止'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="健康检查">
              <Badge status="success" text="正常" />
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (1000 * 60 * 60 * 24))} 天
            </Descriptions.Item>
            <Descriptions.Item label="最后活动">
              {new Date(agent.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 最近操作记录 */}
        <Divider />
        <div>
          <Title level={4}>最近操作记录</Title>
          <Table
            size="small"
            dataSource={[
              {
                key: '1',
                timestamp: agent.updatedAt,
                action: '状态更新',
                details: `状态更改为 ${agent.status}`,
                user: 'system'
              },
              {
                key: '2',
                timestamp: agent.boundAt,
                action: '用户绑定',
                details: `绑定到用户 ${agent.boundUser}`,
                user: agent.boundUser
              }
            ]}
            columns={[
              {
                title: '时间',
                dataIndex: 'timestamp',
                key: 'timestamp',
                render: (text) => new Date(text).toLocaleString()
              },
              {
                title: '操作',
                dataIndex: 'action',
                key: 'action'
              },
              {
                title: '详情',
                dataIndex: 'details',
                key: 'details'
              },
              {
                title: '操作人',
                dataIndex: 'user',
                key: 'user'
              }
            ]}
            pagination={false}
          />
        </div>
      </Card>

      {/* 通信配置弹窗 */}
      {agent && (
        <CommunicationModal
          visible={communicationModalVisible}
          agentId={agent.agentId}
          agentName={agent.name}
          myAgents={myAgents}
          onSubmit={handleCommunicationSubmit}
          onCancel={() => setCommunicationModalVisible(false)}
          loading={communicating}
        />
      )}

      {/* 验证流程弹窗 */}
      <VerificationModal
        visible={verificationVisible}
        fromAgentName={myAgents.find(a => a.agentId === pendingRequest?.fromAgentId)?.name || '我的Agent'}
        toAgentName={agent?.name || '目标Agent'}
        onSuccess={handleVerificationSuccess}
        onError={handleVerificationError}
      />
    </div>
  );
};

export default AgentDetailPage;
