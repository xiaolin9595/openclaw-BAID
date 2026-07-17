import React, { useState, useEffect } from 'react';
import {
  Modal,
  Input,
  Button,
  Select,
  Space,
  Typography,
  Card,
  Tag,
  Avatar,
  Divider,
  Alert,
  message,
  Spin
} from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
  ClearOutlined,
  UserOutlined,
  ThunderboltOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { useAgentStore } from '../../store/agentStore';
import { useAuthStore } from '../../store/authStore';
import { useTaskStore } from '../../store/taskStore';
import FaceVerificationModal from '../identity/FaceVerificationModal';
import {
  TaskExecutionRequest,
  TaskPriority,
  TaskTemplate
} from '../../types/task';
import { Agent } from '../../types/agent';

const { TextArea } = Input;
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

interface TaskInstructionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (request: TaskExecutionRequest) => void;
  className?: string;
}

/**
 * 对话框形式的任务指令输入界面
 */
const TaskInstructionDialog: React.FC<TaskInstructionDialogProps> = ({
  open,
  onClose,
  onSubmit,
  className
}) => {
  const { agents } = useAgentStore();
  const { user, isAuthenticated } = useAuthStore();
  const { taskTemplates, createTask, loading } = useTaskStore();

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [instruction, setInstruction] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.NORMAL);
  const [suggestedTemplate, setSuggestedTemplate] = useState<TaskTemplate | null>(null);
  const [executing, setExecuting] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<TaskExecutionRequest | null>(null);

  // 筛选当前用户的Agent
  const userAgents = React.useMemo(() => {
    if (!user || !isAuthenticated) {
      return [];
    }
    return agents.filter(agent => agent.boundUser === user.userId || agent.boundUser === user.id);
  }, [agents, user, isAuthenticated]);

  // 指令解析和模板推荐
  useEffect(() => {
    if (instruction.trim()) {
      const template = analyzeInstructionAndSuggestTemplate(instruction);
      setSuggestedTemplate(template);
    } else {
      setSuggestedTemplate(null);
    }
  }, [instruction]);

  // 根据指令内容分析并推荐模板
  const analyzeInstructionAndSuggestTemplate = (text: string): TaskTemplate | null => {
    const lowerText = text.toLowerCase();

    // 买笔记本相关关键词
    if (lowerText.includes('买') && (lowerText.includes('笔记本') || lowerText.includes('电脑') || lowerText.includes('laptop'))) {
      return taskTemplates.find(t => t.id === 'template_laptop_purchase') || null;
    }

    // 数据处理相关关键词
    if (lowerText.includes('数据') && (lowerText.includes('处理') || lowerText.includes('分析') || lowerText.includes('清洗'))) {
      return taskTemplates.find(t => t.id === 'template_data_analysis') || null;
    }

    // 内容生成相关关键词
    if (lowerText.includes('生成') || lowerText.includes('写') || lowerText.includes('创作') || lowerText.includes('文案')) {
      return taskTemplates.find(t => t.id === 'template_content_generation') || null;
    }

    // 文本分析相关关键词
    if (lowerText.includes('分析') && (lowerText.includes('文本') || lowerText.includes('情感') || lowerText.includes('关键词'))) {
      return taskTemplates.find(t => t.id === 'template_text_analysis') || null;
    }

    // 安全相关关键词
    if (lowerText.includes('安全') || lowerText.includes('扫描') || lowerText.includes('漏洞') || lowerText.includes('检测')) {
      return taskTemplates.find(t => t.id === 'template_security_scan') || null;
    }

    // 监控相关关键词
    if (lowerText.includes('监控') || lowerText.includes('性能') || lowerText.includes('系统状态')) {
      return taskTemplates.find(t => t.id === 'template_monitoring') || null;
    }

    return null;
  };

  // 根据指令内容解析参数
  const parseInstructionParameters = (text: string, template: TaskTemplate): Record<string, any> => {
    const params: Record<string, any> = {};
    const lowerText = text.toLowerCase();

    if (template.id === 'template_laptop_purchase') {
      // 解析预算
      const budgetMatch = text.match(/(\d+)[-到至~](\d+)[元块]/);
      if (budgetMatch) {
        params.budget_min = parseInt(budgetMatch[1]);
        params.budget_max = parseInt(budgetMatch[2]);
      } else {
        const singleBudgetMatch = text.match(/(\d+)[元块]/);
        if (singleBudgetMatch) {
          const budget = parseInt(singleBudgetMatch[1]);
          params.budget_max = budget;
          params.budget_min = Math.max(3000, budget - 2000);
        }
      }

      // 解析用途
      if (lowerText.includes('游戏')) params.usage_type = 'gaming';
      else if (lowerText.includes('设计') || lowerText.includes('创作')) params.usage_type = 'design';
      else if (lowerText.includes('编程') || lowerText.includes('开发')) params.usage_type = 'programming';
      else if (lowerText.includes('学生') || lowerText.includes('学习')) params.usage_type = 'student';
      else if (lowerText.includes('商务') || lowerText.includes('出差')) params.usage_type = 'business';
      else params.usage_type = 'office';

      // 解析品牌偏好
      const brands: string[] = [];
      if (lowerText.includes('苹果') || lowerText.includes('apple') || lowerText.includes('macbook')) brands.push('apple');
      if (lowerText.includes('联想') || lowerText.includes('lenovo') || lowerText.includes('thinkpad')) brands.push('lenovo');
      if (lowerText.includes('戴尔') || lowerText.includes('dell')) brands.push('dell');
      if (lowerText.includes('华硕') || lowerText.includes('asus')) brands.push('asus');
      if (lowerText.includes('惠普') || lowerText.includes('hp')) brands.push('hp');
      if (lowerText.includes('小米') || lowerText.includes('xiaomi')) brands.push('xiaomi');
      if (brands.length > 0) params.brand_preference = brands;

      // 解析性能要求
      if (lowerText.includes('高性能') || lowerText.includes('强') || lowerText.includes('专业')) params.performance_level = 'high';
      else if (lowerText.includes('极致') || lowerText.includes('顶级') || lowerText.includes('最强')) params.performance_level = 'extreme';
      else if (lowerText.includes('基础') || lowerText.includes('简单') || lowerText.includes('普通')) params.performance_level = 'low';
      else params.performance_level = 'medium';
    }

    return params;
  };

  const handleAgentChange = (agentId: string) => {
    const agent = userAgents.find(a => a.id === agentId);
    setSelectedAgent(agent || null);
  };

  const handleSubmit = async () => {
    if (!selectedAgent) {
      message.error('请选择执行Agent');
      return;
    }

    if (!instruction.trim()) {
      message.error('请输入指令内容');
      return;
    }

    try {
      let request: TaskExecutionRequest;

      if (suggestedTemplate) {
        // 使用推荐的模板和解析的参数
        const parsedParams = parseInstructionParameters(instruction, suggestedTemplate);
        request = {
          templateId: suggestedTemplate.id,
          agentId: selectedAgent.id,
          parameters: parsedParams,
          priority,
          tags: ['指令创建'],
          metadata: {
            originalInstruction: instruction,
            createdViaDialog: true
          }
        };
      } else {
        // 使用通用模板
        const generalTemplate = taskTemplates.find(t => t.id === 'template_content_generation');
        if (!generalTemplate) {
          message.error('未找到合适的任务模板');
          return;
        }

        request = {
          templateId: generalTemplate.id,
          agentId: selectedAgent.id,
          parameters: {
            prompt: instruction,
            content_type: 'article',
            max_length: 1000,
            style: 'professional'
          },
          priority,
          tags: ['指令创建', '通用任务'],
          metadata: {
            originalInstruction: instruction,
            createdViaDialog: true
          }
        };
      }

      // 保存请求，先进行人脸验证
      setPendingRequest(request);
      setShowFaceVerification(true);
    } catch (error) {
      console.error('任务准备失败:', error);
      message.error('任务准备失败，请重试');
    }
  };

  // 人脸验证成功后执行任务
  const handleVerificationSuccess = async () => {
    setShowFaceVerification(false);

    if (!pendingRequest) {
      message.error('未找到待执行的任务');
      return;
    }

    try {
      setExecuting(true);

      if (onSubmit) {
        onSubmit(pendingRequest);
      } else {
        await createTask(pendingRequest);
        message.success('任务创建成功');
      }

      handleClear();
      onClose();
    } catch (error) {
      console.error('任务创建失败:', error);
      message.error('任务创建失败，请重试');
    } finally {
      setExecuting(false);
      setPendingRequest(null);
    }
  };

  // 取消人脸验证
  const handleVerificationCancel = () => {
    setShowFaceVerification(false);
    setPendingRequest(null);
    message.info('已取消任务执行');
  };

  const handleClear = () => {
    setInstruction('');
    setSelectedAgent(null);
    setPriority(TaskPriority.NORMAL);
    setSuggestedTemplate(null);
  };

  const exampleInstructions = [
    "帮我买一台5000-8000元的编程用笔记本，偏好联想或苹果",
    "分析这段文本的情感倾向和关键词",
    "生成一篇关于人工智能发展的专业文章",
    "处理销售数据并生成分析报告",
    "监控系统性能状态"
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <MessageOutlined />
            <span>AI助手对话</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={800}
        footer={null}
        className={className}
        destroyOnClose
      >
        <Spin spinning={loading || executing}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Agent选择 */}
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>选择执行Agent</Text>
              <Select
                placeholder="请选择要对话的Agent"
                value={selectedAgent?.id}
                onChange={handleAgentChange}
                style={{ width: '100%' }}
                size="large"
              >
                {userAgents.map((agent) => (
                  <Option key={agent.id} value={agent.id}>
                    <Space>
                      <Avatar icon={<RobotOutlined />} size="small" />
                      <Text strong>{agent.name}</Text>
                      <Tag color="blue">{agent.type}</Tag>
                      <Text type="secondary">{agent.model}</Text>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Space>
          </Card>

          {/* 指令输入 */}
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <UserOutlined />
                <Text strong>您想要做什么？</Text>
              </Space>
              <TextArea
                placeholder="请用自然语言描述您想要执行的任务，例如：帮我买一台适合编程的笔记本，预算5000-8000元..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={4}
                size="large"
              />
            </Space>
          </Card>

          {/* 智能推荐 */}
          {suggestedTemplate && (
            <Alert
              message={
                <Space>
                  <BulbOutlined />
                  <Text strong>智能推荐</Text>
                </Space>
              }
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Text>系统推荐使用模板：</Text>
                    <Tag color="green">{suggestedTemplate.name}</Tag>
                    <Tag color="blue">{suggestedTemplate.type}</Tag>
                  </Space>
                  <Text type="secondary">{suggestedTemplate.description}</Text>
                </Space>
              }
              type="info"
              showIcon
            />
          )}

          {/* 优先级设置 */}
          <Card size="small">
            <Space>
              <Text strong>任务优先级：</Text>
              <Select
                value={priority}
                onChange={setPriority}
                style={{ width: 120 }}
              >
                <Option value={TaskPriority.LOW}>
                  <Tag color="default">低</Tag>
                </Option>
                <Option value={TaskPriority.NORMAL}>
                  <Tag color="blue">普通</Tag>
                </Option>
                <Option value={TaskPriority.HIGH}>
                  <Tag color="orange">高</Tag>
                </Option>
                <Option value={TaskPriority.URGENT}>
                  <Tag color="red">紧急</Tag>
                </Option>
              </Select>
            </Space>
          </Card>

          {/* 示例指令 */}
          <Card size="small" title="示例指令">
            <Space direction="vertical" style={{ width: '100%' }}>
              {exampleInstructions.map((example, index) => (
                <Button
                  key={index}
                  type="link"
                  size="small"
                  onClick={() => setInstruction(example)}
                  style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'left', padding: '4px 0' }}
                >
                  <Text type="secondary">{example}</Text>
                </Button>
              ))}
            </Space>
          </Card>

          <Divider />

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleClear} icon={<ClearOutlined />}>
              清空
            </Button>
            <Button onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              icon={<SendOutlined />}
              loading={executing}
              disabled={!selectedAgent || !instruction.trim()}
            >
              {executing ? '创建中...' : '发送指令'}
            </Button>
          </Space>
        </Space>
      </Spin>
    </Modal>

      {/* 人脸识别验证模态框 */}
      <FaceVerificationModal
        open={showFaceVerification}
        onSuccess={handleVerificationSuccess}
        onCancel={handleVerificationCancel}
        userName={user?.username || '用户'}
      />
    </>
  );
};

export default TaskInstructionDialog;