import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Table,
  Space,
  Tag,
  Card,
  Statistic,
  Row,
  Col,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Badge,
  Typography
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Agent } from '../../types/agent';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface AgentPermissionModalProps {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
}

interface Credential {
  id: string;
  type: string;
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  status: 'active' | 'revoked' | 'expired';
  permissions: {
    resource: string;
    actions: string[];
    constraints?: string;
  }[];
}

const AgentPermissionModal: React.FC<AgentPermissionModalProps> = ({
  open,
  agent,
  onClose
}) => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();

  // 初始化示例数据
  useEffect(() => {
    if (agent && open) {
      setCredentials([
        {
          id: `vc-${Date.now()}-1`,
          type: 'AgentPermissionCredential',
          issuer: 'AgentID System',
          issuanceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          permissions: [
            {
              resource: '📅 日程与提醒',
              actions: ['read', 'create', 'update'],
              constraints: '仅工作时间'
            }
          ]
        },
        {
          id: `vc-${Date.now()}-2`,
          type: 'AgentPermissionCredential',
          issuer: 'AgentID System',
          issuanceDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          permissions: [
            {
              resource: '🛒 购物与下单',
              actions: ['read', 'create'],
              constraints: '金额限制'
            }
          ]
        },
        {
          id: `vc-${Date.now()}-3`,
          type: 'AgentPermissionCredential',
          issuer: 'User',
          issuanceDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          expirationDate: undefined,
          status: 'revoked',
          permissions: [
            {
              resource: '💳 支付账户',
              actions: ['read', 'execute'],
              constraints: '需要确认'
            }
          ]
        }
      ]);
    }
  }, [agent, open]);

  // 统计信息
  const stats = {
    total: credentials.length,
    active: credentials.filter(c => c.status === 'active').length,
    revoked: credentials.filter(c => c.status === 'revoked').length,
    expired: credentials.filter(c => c.status === 'expired').length
  };

  // 添加凭证
  const handleAdd = async () => {
    try {
      const values = await form.validateFields();

      const newCredential: Credential = {
        id: `vc-${Date.now()}`,
        type: 'AgentPermissionCredential',
        issuer: 'AgentID System',
        issuanceDate: new Date().toISOString(),
        expirationDate: values.expirationDate ? values.expirationDate.toISOString() : undefined,
        status: 'active',
        permissions: [{
          resource: values.resource,
          actions: values.actions,
          constraints: values.constraints
        }]
      };

      setCredentials([newCredential, ...credentials]);
      message.success('凭证添加成功');
      setShowAddForm(false);
      form.resetFields();
    } catch (error) {
      console.error('添加失败:', error);
    }
  };

  // 撤销凭证
  const handleRevoke = (id: string) => {
    setCredentials(credentials.map(c =>
      c.id === id ? { ...c, status: 'revoked' as const } : c
    ));
    message.success('凭证已撤销');
  };

  // 删除凭证
  const handleDelete = (id: string) => {
    setCredentials(credentials.filter(c => c.id !== id));
    message.success('凭证已删除');
  };

  // 获取状态显示
  const getStatusBadge = (status: string) => {
    const map = {
      active: { status: 'success' as const, text: '活跃' },
      revoked: { status: 'error' as const, text: '已撤销' },
      expired: { status: 'warning' as const, text: '已过期' }
    };
    const config = map[status as keyof typeof map] || map.active;
    return <Badge status={config.status} text={config.text} />;
  };

  // 表格列定义
  const columns: ColumnsType<Credential> = [
    {
      title: '凭证ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (id: string) => <Tag color="blue">{id.substring(0, 16)}...</Tag>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (type: string) => <Tag color="purple">{type}</Tag>
    },
    {
      title: '发行者',
      dataIndex: 'issuer',
      key: 'issuer',
      width: 120
    },
    {
      title: '发行日期',
      dataIndex: 'issuanceDate',
      key: 'issuanceDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '过期日期',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      width: 120,
      render: (date?: string) => date ? dayjs(date).format('YYYY-MM-DD') : '永久'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusBadge(status)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status === 'active' && (
            <Popconfirm
              title="确认撤销?"
              onConfirm={() => handleRevoke(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" size="small">撤销</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="确认删除?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 展开行 - 显示权限详情
  const expandedRowRender = (record: Credential) => (
    <Card size="small" title="权限详情" style={{ backgroundColor: '#fafafa' }}>
      {record.permissions.map((perm, idx) => (
        <div key={idx} style={{ marginBottom: 8 }}>
          <Text strong>资源: </Text>
          <Text code>{perm.resource}</Text>
          <br />
          <Text strong>操作: </Text>
          {perm.actions.map(action => (
            <Tag key={action} color="green" style={{ marginRight: 4 }}>
              {action}
            </Tag>
          ))}
          {perm.constraints && (
            <>
              <br />
              <Text strong>约束: </Text>
              <Tag color="orange">{perm.constraints}</Tag>
            </>
          )}
        </div>
      ))}
    </Card>
  );

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>可验证凭证管理 - {agent?.name}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总凭证数"
              value={stats.total}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃凭证"
              value={stats.active}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已撤销"
              value={stats.revoked}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已过期"
              value={stats.expired}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 添加按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '取消' : '添加凭证'}
        </Button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <Card style={{ marginBottom: 16 }} title="新增权限凭证">
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="权限场景"
                  name="resource"
                  rules={[{ required: true, message: '请选择权限场景' }]}
                >
                  <Select placeholder="选择Agent可以访问的功能场景">
                    <Option value="个人信息">📋 个人信息管理</Option>
                    <Option value="日程安排">📅 日程与提醒</Option>
                    <Option value="购物下单">🛒 购物与下单</Option>
                    <Option value="支付账户">💳 支付账户</Option>
                    <Option value="通讯录">📞 通讯录</Option>
                    <Option value="邮件管理">📧 邮件管理</Option>
                    <Option value="文件存储">📁 文件与云存储</Option>
                    <Option value="社交媒体">👥 社交媒体账号</Option>
                    <Option value="健康数据">❤️ 健康与运动数据</Option>
                    <Option value="家居控制">🏠 智能家居控制</Option>
                    <Option value="出行服务">🚗 出行与导航</Option>
                    <Option value="娱乐订阅">🎬 娱乐订阅服务</Option>
                    <Option value="财务记录">💰 财务与账单</Option>
                    <Option value="工作文档">📄 工作文档与协作</Option>
                    <Option value="会议安排">🎯 会议与视频通话</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="允许的操作"
                  name="actions"
                  rules={[{ required: true, message: '请选择允许的操作' }]}
                >
                  <Select mode="multiple" placeholder="选择Agent可以执行的操作">
                    <Option value="read">🔍 查看/读取</Option>
                    <Option value="create">➕ 创建/添加</Option>
                    <Option value="update">✏️ 修改/更新</Option>
                    <Option value="delete">🗑️ 删除</Option>
                    <Option value="execute">▶️ 执行/触发</Option>
                    <Option value="share">📤 分享/发送</Option>
                    <Option value="download">⬇️ 下载</Option>
                    <Option value="upload">⬆️ 上传</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="有效期限" name="expirationDate">
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="选择过期日期"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="使用限制" name="constraints">
                  <Select placeholder="选择使用场景限制(可选)">
                    <Option value="">无限制</Option>
                    <Option value="仅工作日">⏰ 仅工作日(周一至周五)</Option>
                    <Option value="仅工作时间">🕐 仅工作时间(9:00-18:00)</Option>
                    <Option value="仅家庭网络">📶 仅家庭网络环境</Option>
                    <Option value="仅办公网络">🏢 仅办公网络环境</Option>
                    <Option value="需要确认">✅ 每次操作需要确认</Option>
                    <Option value="金额限制">💵 单次金额不超过500元</Option>
                    <Option value="频率限制">⏱️ 每日操作不超过10次</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="备注说明" name="description">
              <TextArea
                rows={2}
                placeholder="说明此权限的用途或特殊要求(可选)"
                maxLength={200}
                showCount
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleAdd}>
                  创建凭证
                </Button>
                <Button onClick={() => { setShowAddForm(false); form.resetFields(); }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* 凭证列表 */}
      <Table
        columns={columns}
        dataSource={credentials}
        rowKey="id"
        expandable={{
          expandedRowRender,
          rowExpandable: (record) => record.permissions.length > 0
        }}
        pagination={{
          pageSize: 5,
          showTotal: (total) => `共 ${total} 条`
        }}
      />
    </Modal>
  );
};

export default AgentPermissionModal;
