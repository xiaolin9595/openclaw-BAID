import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Radio,
  Slider,
  Input,
  Space,
  Button,
  Typography,
  Divider,
  Tag
} from 'antd';
import {
  BarChartOutlined,
  EditOutlined,
  SearchOutlined,
  RobotOutlined,
  EyeOutlined,
  ApiOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import type { AgentCommunicationRequest } from '../../types/agent-discovery';
import type { Agent } from '../../types/agent';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

/**
 * CommunicationModal 组件属性
 */
interface CommunicationModalProps {
  /** Modal 显示状态 */
  visible: boolean;
  /** 目标 Agent ID */
  agentId: string;
  /** 目标 Agent 名称 */
  agentName: string;
  /** 用户管理的Agent列表 */
  myAgents: Agent[];
  /** 提交通信请求的回调函数 */
  onSubmit: (request: AgentCommunicationRequest) => void;
  /** 取消操作的回调函数 */
  onCancel: () => void;
  /** 提交中状态 */
  loading?: boolean;
}

/**
 * 任务类型图标映射
 */
const COMMUNICATION_TYPE_ICONS = {
  data_analysis: <BarChartOutlined />,
  content_creation: <EditOutlined />,
  research: <SearchOutlined />,
  automation: <RobotOutlined />,
  monitoring: <EyeOutlined />,
  integration: <ApiOutlined />,
  other: <EditOutlined />
};

/**
 * 任务类型标签映射
 */
const COMMUNICATION_TYPE_LABELS = {
  data_analysis: '📊 数据分析任务',
  content_creation: '✍️ 内容创作任务',
  research: '🔍 调研分析任务',
  automation: '🤖 自动化执行任务',
  monitoring: '👁️ 监控预警任务',
  integration: '🔗 系统集成任务',
  other: '📝 其他'
};

/**
 * 优先级标签映射
 */
const PRIORITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急'
};

/**
 * 优先级颜色映射
 */
const PRIORITY_COLORS = {
  low: '#52c41a',
  medium: '#1890ff',
  high: '#faad14',
  urgent: '#f5222d'
};

/**
 * 超时时间标记
 */
const TIMEOUT_MARKS = {
  5: '5s',
  30: '30s',
  60: '1m',
  120: '2m',
  180: '3m',
  300: '5m'
};

/**
 * CommunicationModal - Agent 通信配置弹窗组件
 *
 * 提供与Agent建立通信的配置界面，支持多种通信类型和参数配置。
 *
 * @component
 * @example
 * ```tsx
 * <CommunicationModal
 *   visible={true}
 *   agentId="agent-001"
 *   agentName="购物助手"
 *   onSubmit={(request) => console.log(request)}
 *   onCancel={() => setVisible(false)}
 *   loading={false}
 * />
 * ```
 */
const CommunicationModal: React.FC<CommunicationModalProps> = ({
  visible,
  agentId,
  agentName,
  myAgents,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [selectedType, setSelectedType] = React.useState<string>('data_analysis');

  /**
   * Modal关闭时重置表单
   */
  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [visible, form]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 构造 AgentCommunicationRequest 对象
      const request: AgentCommunicationRequest = {
        fromAgentId: values.fromAgentId,
        agentId,
        type: values.type,
        priority: values.priority,
        timeout: values.timeout * 1000, // 转换为毫秒
        requiresResponse: values.requiresResponse,
        payload: values.type === 'other' && values.customInstruction
          ? { customInstruction: values.customInstruction, message: values.message }
          : values.message
          ? { message: values.message }
          : undefined,
        metadata: {
          userId: 'current-user', // 实际应用中应从上下文获取
          sessionId: `session-${Date.now()}`,
          requestId: `req-${Date.now()}`,
          tags: ['ui-initiated']
        }
      };

      onSubmit(request);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  /**
   * 处理取消操作
   */
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1890ff' }} />
          <span>建立通信 - {agentName}</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={loading}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
        >
          建立通信
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          fromAgentId: undefined,
          type: 'data_analysis',
          priority: 'medium',
          timeout: 30,
          requiresResponse: true
        }}
      >
        {/* 选择我的Agent */}
        <Form.Item
          label="选择我的Agent"
          name="fromAgentId"
          rules={[{ required: true, message: '请选择您的Agent' }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              选择您管理的Agent来与目标Agent建立通信
            </Text>
          }
        >
          <Select
            placeholder="选择您的Agent"
            size="large"
            showSearch
            optionFilterProp="children"
          >
            {myAgents
              .filter(agent => agent.status === 'active')
              .map(agent => (
                <Option key={agent.id} value={agent.agentId}>
                  <Space>
                    <span>{agent.name}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({agent.agentId})
                    </Text>
                    <Tag color="green" style={{ fontSize: 11 }}>
                      {agent.status}
                    </Tag>
                  </Space>
                </Option>
              ))}
          </Select>
        </Form.Item>

        {/* 任务类型 */}
        <Form.Item
          label="任务类型"
          name="type"
          rules={[{ required: true, message: '请选择任务类型' }]}
        >
          <Select
            placeholder="选择要指派的任务类型"
            size="large"
            onChange={(value) => setSelectedType(value)}
          >
            {(Object.keys(COMMUNICATION_TYPE_LABELS) as Array<keyof typeof COMMUNICATION_TYPE_LABELS>).map(
              (type) => (
                <Option key={type} value={type}>
                  <Space>
                    {COMMUNICATION_TYPE_ICONS[type]}
                    {COMMUNICATION_TYPE_LABELS[type]}
                  </Space>
                </Option>
              )
            )}
          </Select>
        </Form.Item>

        {/* 当选择"其他"时显示自定义指令输入框 */}
        {selectedType === 'other' && (
          <Form.Item
            label="自定义指令"
            name="customInstruction"
            rules={[{ required: true, message: '请输入自定义指令' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                请详细描述您要指派给Agent的具体任务和指令
              </Text>
            }
          >
            <TextArea
              rows={3}
              placeholder="输入详细的任务指令，例如：帮我分析最近一周的销售数据并生成报告"
              maxLength={200}
              showCount
            />
          </Form.Item>
        )}

        {/* 优先级 */}
        <Form.Item
          label="优先级"
          name="priority"
          rules={[{ required: true, message: '请选择优先级' }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              优先级决定请求在队列中的处理顺序
            </Text>
          }
        >
          <Select placeholder="选择请求优先级">
            {(Object.keys(PRIORITY_LABELS) as Array<keyof typeof PRIORITY_LABELS>).map(
              (priority) => (
                <Option key={priority} value={priority}>
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: PRIORITY_COLORS[priority]
                      }}
                    />
                    {PRIORITY_LABELS[priority]}
                  </Space>
                </Option>
              )
            )}
          </Select>
        </Form.Item>

        {/* 超时时间 */}
        <Form.Item
          label="超时时间"
          name="timeout"
          rules={[{ required: true, message: '请设置超时时间' }]}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              超过此时间未响应将自动终止通信
            </Text>
          }
        >
          <Slider
            min={5}
            max={300}
            marks={TIMEOUT_MARKS}
            tooltip={{
              formatter: (value) => `${value}秒`
            }}
          />
        </Form.Item>

        {/* 是否需要响应 */}
        <Form.Item
          label="是否需要响应"
          name="requiresResponse"
          rules={[{ required: true, message: '请选择是否需要响应' }]}
        >
          <Radio.Group>
            <Radio value={true}>需要响应</Radio>
            <Radio value={false}>不需要响应</Radio>
          </Radio.Group>
        </Form.Item>

        <Divider />

        {/* 消息内容（可选） */}
        <Form.Item
          label="消息内容"
          name="message"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              可选：附加的消息或说明内容
            </Text>
          }
        >
          <TextArea
            rows={4}
            placeholder="输入消息内容、参数或说明（可选）"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>

      {/* 提示信息 */}
      <div
        style={{
          backgroundColor: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: 4,
          padding: 12,
          marginTop: 16
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Space direction="vertical" size={4}>
            <div>💡 通信建立后，您可以在通信记录中查看详细信息</div>
            <div>⚡ 不同优先级会影响Agent的响应速度和资源分配</div>
            <div>🔒 所有通信都经过加密和身份验证保护</div>
          </Space>
        </Text>
      </div>
    </Modal>
  );
};

export default CommunicationModal;
