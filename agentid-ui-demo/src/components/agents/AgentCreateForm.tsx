import React, { useState } from 'react';
import {
  Steps,
  Card,
  Typography,
  Space,
  Button,
  Alert,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Divider,
  Form,
  Input,
  Select
} from 'antd';
import {
  UserOutlined,
  CodeOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import {
  AgentCreateInfo,
  AgentCodePackage,
  AgentCreationWizardProps,
  AgentCreationStep,
  SUPPORTED_AGENT_LANGUAGES,
  DEFAULT_AGENT_CONFIG
} from '../../types/agent-upload';
import { AgentCodeUpload } from './AgentCodeUpload';
import { AgentConfigForm } from './AgentConfigForm';

const { Text, Title } = Typography;
const { Step } = Steps;

const DEMO_WATERMARK = '演示系统 - Agent创建向导';

export const AgentCreateForm: React.FC<AgentCreationWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<AgentCreationStep[]>([
    { id: 0, title: '基本信息', description: '配置Agent基本信息', status: 'pending' },
    { id: 1, title: '代码上传', description: '上传Agent代码包', status: 'pending' },
    { id: 2, title: '配置确认', description: '确认配置并创建', status: 'pending' }
  ]);

  const [basicInfo, setBasicInfo] = useState<AgentCreateInfo | null>(null);
  const [codePackage, setCodePackage] = useState<AgentCodePackage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStepStatus = (stepId: number, status: AgentCreationStep['status']) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleBasicInfoSubmit = (info: AgentCreateInfo) => {
    setBasicInfo(info);
    updateStepStatus(0, 'completed');
    updateStepStatus(1, 'in_progress');
    setCurrentStep(1);
    setError(null);
  };

  const handleCodePackageSelect = (pkg: AgentCodePackage) => {
    setCodePackage(pkg);
    updateStepStatus(1, 'completed');
    updateStepStatus(2, 'in_progress');
    setCurrentStep(2);
    setError(null);
  };

  const handleCodePackageRemove = () => {
    setCodePackage(null);
    updateStepStatus(1, 'in_progress');
    setError(null);
  };

  const handleConfigChange = (config: any) => {
    if (basicInfo) {
      setBasicInfo({ ...basicInfo, config });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      updateStepStatus(currentStep, 'pending');
      updateStepStatus(currentStep - 1, 'in_progress');
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleCreateAgent = async () => {
    if (!basicInfo || !codePackage) {
      setError('请完成所有必要步骤');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 模拟Agent创建过程
      await new Promise(resolve => setTimeout(resolve, 2000));

      const agentData = {
        basicInfo,
        codePackage
      };

      // 更新步骤状态
      updateStepStatus(2, 'completed');

      // 调用完成回调
      onComplete(agentData);

    } catch (err) {
      setError('创建Agent失败，请重试');
      updateStepStatus(2, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const getStepIcon = (step: AgentCreationStep) => {
    switch (step.id) {
      case 0: return <UserOutlined />;
      case 1: return <CodeOutlined />;
      case 2: return <SettingOutlined />;
      default: return null;
    }
  };

  const isStepComplete = (stepId: number) => {
    switch (stepId) {
      case 0: return basicInfo !== null;
      case 1: return codePackage !== null;
      case 2: return basicInfo !== null && codePackage !== null;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoForm onSubmit={handleBasicInfoSubmit} initialData={basicInfo} />;
      case 1:
        return (
          <AgentCodeUpload
            onCodePackageSelect={handleCodePackageSelect}
            onCodePackageRemove={handleCodePackageRemove}
            selectedCodePackage={codePackage}
            supportedLanguages={SUPPORTED_AGENT_LANGUAGES}
          />
        );
      case 2:
        return (
          <AgentConfigForm
            config={basicInfo?.config || DEFAULT_AGENT_CONFIG}
            onChange={handleConfigChange}
            language={codePackage?.language}
          />
        );
      default:
        return null;
    }
  };

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Demo Watermark */}
      <div className="mb-4">
        <Tag color="orange" className="text-sm">
          {DEMO_WATERMARK}
        </Tag>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <Title level={2} className="mb-2">
          创建Agent
        </Title>
        <Text type="secondary">
          按照以下步骤创建新的Agent智能代理
        </Text>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6">
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Statistic
              title="完成进度"
              value={completedSteps}
              suffix={`/ ${steps.length}`}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="当前步骤"
              value={currentStep + 1}
              suffix={`/ ${steps.length}`}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div className="h-full flex items-center">
              <Progress
                percent={Math.round(progressPercentage)}
                size="small"
                style={{ width: '100%' }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Steps */}
      <Card className="mb-6">
        <Steps
          current={currentStep}
          status={error ? 'error' : 'process'}
          className="mb-6"
        >
          {steps.map((step) => (
            <Step
              key={step.id}
              title={step.title}
              description={step.description}
              icon={getStepIcon(step)}
              status={step.status === 'error' ? 'error' : undefined}
            />
          ))}
        </Steps>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          className="mb-4"
          closable
          onClose={() => setError(null)}
        />
      )}

      {/* Action Buttons */}
      <Card>
        <Row justify="space-between" align="middle">
          <Col>
            <Button onClick={onCancel}>
              取消
            </Button>
          </Col>
          <Col>
            <Space>
              {currentStep > 0 && (
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={handlePrevious}
                  disabled={isCreating}
                >
                  上一步
                </Button>
              )}

              {currentStep < steps.length - 1 ? (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => {
                    if (isStepComplete(currentStep)) {
                      updateStepStatus(currentStep, 'completed');
                      updateStepStatus(currentStep + 1, 'in_progress');
                      setCurrentStep(currentStep + 1);
                      setError(null);
                    } else {
                      setError('请完成当前步骤后再继续');
                    }
                  }}
                  disabled={!isStepComplete(currentStep)}
                >
                  下一步
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleCreateAgent}
                  loading={isCreating}
                  disabled={!basicInfo || !codePackage}
                >
                  {isCreating ? '创建中...' : '创建Agent'}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

// 基本信息表单组件
interface BasicInfoFormProps {
  onSubmit: (info: AgentCreateInfo) => void;
  initialData?: AgentCreateInfo | null;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ onSubmit, initialData }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (initialData) {
      form.setFieldsValue(initialData);
    }
  }, [initialData, form]);

  const handleSubmit = async (values: any) => {
    const agentInfo: AgentCreateInfo = {
      ...values,
      config: DEFAULT_AGENT_CONFIG
    };
    onSubmit(agentInfo);
  };

  return (
    <Card title="Agent基本信息">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: '',
          description: '',
          language: '',
          version: '1.0.0',
          tags: []
        }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Agent名称"
              name="name"
              rules={[
                { required: true, message: '请输入Agent名称' },
                { min: 2, max: 50, message: '名称长度在2-50个字符之间' }
              ]}
            >
              <Input placeholder="输入Agent名称" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="版本"
              name="version"
              rules={[
                { required: true, message: '请输入版本号' },
                { pattern: /^\d+\.\d+\.\d+$/, message: '版本号格式应为 x.y.z' }
              ]}
            >
              <Input placeholder="1.0.0" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="描述"
          name="description"
          rules={[
            { required: true, message: '请输入Agent描述' },
            { min: 10, max: 500, message: '描述长度在10-500个字符之间' }
          ]}
        >
          <Input.TextArea
            rows={4}
            placeholder="描述Agent的功能、用途和特点"
          />
        </Form.Item>

        <Form.Item
          label="技术栈"
          name="language"
          rules={[{ required: true, message: '请选择技术栈' }]}
        >
          <Select placeholder="选择主要技术栈">
            {SUPPORTED_AGENT_LANGUAGES.map((lang) => (
              <Select.Option key={lang.id} value={lang.id}>
                <Space>
                  <span>{lang.name}</span>
                  <Tag>{lang.version}</Tag>
                  <Tag>{lang.type === 'interpreted' ? '解释型' : '编译型'}</Tag>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            下一步：代码上传
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

const { Option } = Select;