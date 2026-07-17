import React, { useState, useEffect } from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Card,
  Row,
  Col,
  Space,
  Divider,
  Typography,
  message,
  Spin,
  Switch,
  Slider,
  InputNumber,
  Checkbox,
  Radio,
  Upload,
  Tag,
  Tooltip,
  Collapse,
  Alert,
  Progress,
  Rate
} from 'antd';
import {
  PlayCircleOutlined,
  SaveOutlined,
  ClearOutlined,
  EyeOutlined,
  BugOutlined,
  FormOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useTaskStore } from '../../store/taskStore';
import { useAgentStore } from '../../store/agentStore';
import { useAuthStore } from '../../store/authStore';
import {
  TaskTemplate,
  TaskParameter,
  TaskParameterType,
  TaskExecutionRequest,
  TaskPriority
} from '../../types/task';
import { getFormConfigByTemplate } from '../../mocks/taskMock';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

interface TaskExecutionFormProps {
  template?: TaskTemplate;
  onSubmit?: (request: TaskExecutionRequest) => void;
  onSaveDraft?: (draft: Record<string, any>) => void;
  className?: string;
}

/**
 * 任务参数渲染器组件
 */
const ParameterRenderer: React.FC<{
  parameter: TaskParameter;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}> = ({ parameter, value, onChange, disabled }) => {
  const { id, name, type, description, required, defaultValue, validation, ui } = parameter;

  const handleChange = (newValue: any) => {
    // 应用验证规则
    if (validation) {
      if (validation.min !== undefined && newValue < validation.min) {
        message.warning(`${name} 不能小于 ${validation.min}`);
        return;
      }
      if (validation.max !== undefined && newValue > validation.max) {
        message.warning(`${name} 不能大于 ${validation.max}`);
        return;
      }
      if (validation.pattern && typeof newValue === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(newValue)) {
          message.warning(`${name} 格式不正确`);
          return;
        }
      }
    }
    onChange(newValue);
  };

  const renderInput = () => {
    switch (ui?.component || 'input') {
      case 'input':
        return (
          <Input
            placeholder={ui?.placeholder || `请输入${name}`}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'textarea':
        return (
          <TextArea
            placeholder={ui?.placeholder || `请输入${name}`}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            rows={ui?.rows || 4}
            disabled={disabled}
          />
        );

      case 'select':
        return (
          <Select
            placeholder={ui?.placeholder || `请选择${name}`}
            value={value || defaultValue}
            onChange={handleChange}
            disabled={disabled}
            allowClear={!required}
          >
            {ui?.options?.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        );

      case 'checkbox':
        if (type === TaskParameterType.BOOLEAN) {
          return (
            <Switch
              checked={value || defaultValue || false}
              onChange={handleChange}
              disabled={disabled}
            />
          );
        } else {
          return (
            <Checkbox.Group
              options={ui?.options?.map(opt => ({ label: opt.label, value: opt.value }))}
              value={value || defaultValue || []}
              onChange={handleChange}
              disabled={disabled}
            />
          );
        }

      case 'radio':
        return (
          <Radio.Group
            value={value || defaultValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
          >
            {ui?.options?.map((option) => (
              <Radio key={option.value} value={option.value}>
                {option.label}
              </Radio>
            ))}
          </Radio.Group>
        );

      case 'slider':
        return (
          <Slider
            min={validation?.min}
            max={validation?.max}
            step={1}
            value={value || defaultValue || 0}
            onChange={handleChange}
            disabled={disabled}
          />
        );

      case 'input-number':
        return (
          <InputNumber
            min={validation?.min}
            max={validation?.max}
            value={value || defaultValue}
            onChange={handleChange}
            disabled={disabled}
            style={{ width: '100%' }}
          />
        );

      case 'rate':
        return (
          <Rate
            value={value || defaultValue || 0}
            onChange={handleChange}
            disabled={disabled}
          />
        );

      case 'file-upload':
        return (
          <Upload
            disabled={disabled}
            beforeUpload={() => false}
            maxCount={1}
          >
            <Button>选择文件</Button>
          </Upload>
        );

      default:
        return (
          <Input
            placeholder={ui?.placeholder || `请输入${name}`}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <Form.Item
      label={
        <Space>
          <Text strong>{name}</Text>
          {required && <Tag color="red">必填</Tag>}
        </Space>
      }
      name={id}
      rules={[
        {
          required,
          message: `请输入${name}`
        }
      ]}
      tooltip={{
        title: description,
        icon: <ExclamationCircleOutlined />
      }}
    >
      {renderInput()}
    </Form.Item>
  );
};

/**
 * 任务执行表单主组件
 */
const TaskExecutionForm: React.FC<TaskExecutionFormProps> = ({
  template,
  onSubmit,
  onSaveDraft,
  className
}) => {
  const [form] = Form.useForm();
  const { agents } = useAgentStore();
  const { user, isAuthenticated } = useAuthStore();

  // 筛选出当前用户的Agent，与Agent管理界面保持一致
  const userAgents = React.useMemo(() => {
    if (!user || !isAuthenticated) {
      return [];
    }
    return agents.filter(agent => agent.boundUser === user.userId || agent.boundUser === user.id);
  }, [agents, user, isAuthenticated]);

  const {
    selectedTemplate,
    setSelectedTemplate,
    formDraft,
    setFormDraft,
    updateFormDraft,
    clearFormDraft,
    createTask,
    loading,
    error,
    clearError,
    executing
  } = useTaskStore();

  const [showPreview, setShowPreview] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // 初始化表单
  useEffect(() => {
    if (template) {
      setSelectedTemplate(template);
      initializeForm(template);
    } else if (selectedTemplate) {
      initializeForm(selectedTemplate);
    }
  }, [template, selectedTemplate]);

  // 恢复草稿
  useEffect(() => {
    if (Object.keys(formDraft).length > 0) {
      form.setFieldsValue(formDraft);
      setFormValues(formDraft);
      if (formDraft.agentId) {
        const agent = userAgents.find(a => a.id === formDraft.agentId);
        setSelectedAgent(agent || null);
      }
    }
  }, [formDraft, form, userAgents]);

  const initializeForm = (template: TaskTemplate) => {
    const initialValues: Record<string, any> = {};

    // 设置默认值
    template.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialValues[param.id] = param.defaultValue;
      }
    });

    // 恢复草稿中的值
    if (formDraft && formDraft.parameters) {
      Object.assign(initialValues, formDraft.parameters);
    }

    form.setFieldsValue(initialValues);
    setFormValues(initialValues);
  };

  const handleTemplateChange = (templateId: string) => {
    const template = useTaskStore.getState().taskTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      clearFormDraft();
      initializeForm(template);
    }
  };

  const handleAgentChange = (agentId: string) => {
    const agent = userAgents.find(a => a.id === agentId);
    setSelectedAgent(agent || null);
    updateFormDraft('agentId', agentId);
  };

  const handleValuesChange = (changedValues: Record<string, any>, allValues: Record<string, any>) => {
    setFormValues(allValues);
    updateFormDraft('parameters', allValues);
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateFormDraft('priority', priority);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (!selectedTemplate) {
        message.error('请选择任务模板');
        return;
      }

      if (!selectedAgent) {
        message.error('请选择执行Agent');
        return;
      }

      const request: TaskExecutionRequest = {
        templateId: selectedTemplate.id,
        agentId: selectedAgent.id,
        parameters: values,
        priority: formDraft.priority || TaskPriority.NORMAL,
        tags: formDraft.tags || [],
        metadata: formDraft.metadata || {}
      };

      if (onSubmit) {
        onSubmit(request);
      } else {
        await createTask(request);
        message.success('任务创建成功');
        clearFormDraft();
        form.resetFields();
        setSelectedAgent(null);
      }
    } catch (error) {
      console.error('表单提交失败:', error);
      message.error('表单验证失败，请检查输入');
    }
  };

  const handleSaveDraft = () => {
    const values = form.getFieldsValue();
    const draft = {
      templateId: selectedTemplate?.id,
      agentId: selectedAgent?.id,
      parameters: values,
      priority: formDraft.priority,
      tags: formDraft.tags,
      metadata: formDraft.metadata,
      savedAt: new Date()
    };

    if (onSaveDraft) {
      onSaveDraft(draft);
    } else {
      setFormDraft(draft);
      message.success('草稿已保存');
    }
  };

  const handleClear = () => {
    form.resetFields();
    clearFormDraft();
    setSelectedAgent(null);
    setFormValues({});
    if (selectedTemplate) {
      initializeForm(selectedTemplate);
    }
  };

  const getFormPreview = () => {
    return (
      <Card title="表单预览" size="small">
        <pre style={{ fontSize: '12px', maxHeight: '400px', overflow: 'auto' }}>
          {JSON.stringify({
            template: selectedTemplate?.name,
            agent: selectedAgent?.name,
            parameters: formValues,
            priority: formDraft.priority,
            tags: formDraft.tags
          }, null, 2)}
        </pre>
      </Card>
    );
  };

  const getDebugInfo = () => {
    return (
      <Card title="调试信息" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="模板信息"
            description={
              <pre style={{ fontSize: '10px' }}>
                {JSON.stringify(selectedTemplate, null, 2)}
              </pre>
            }
            type="info"
          />
          <Alert
            message="表单状态"
            description={
              <pre style={{ fontSize: '10px' }}>
                {JSON.stringify({
                  formValues,
                  formDraft,
                  errors: form.getFieldsError()
                }, null, 2)}
              </pre>
            }
            type="warning"
          />
        </Space>
      </Card>
    );
  };

  const formConfig = selectedTemplate ? getFormConfigByTemplate(selectedTemplate.id) : null;

  return (
    <div className={className}>
      <Spin spinning={loading || executing}>
        <Card
          title={
            <Space>
              <FormOutlined />
              任务执行配置
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setShowPreview(!showPreview)}
                type={showPreview ? 'primary' : 'default'}
                size="small"
              >
                预览
              </Button>
              <Button
                icon={<BugOutlined />}
                onClick={() => setShowDebug(!showDebug)}
                type={showDebug ? 'primary' : 'default'}
                size="small"
              >
                调试
              </Button>
            </Space>
          }
        >
          {/* 模板和Agent选择 */}
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="任务模板"
                name="templateId"
                rules={[{ required: true, message: '请选择任务模板' }]}
              >
                <Select
                  placeholder="请选择任务模板"
                  onChange={handleTemplateChange}
                  value={selectedTemplate?.id}
                  loading={loading}
                >
                  {useTaskStore.getState().taskTemplates.map((template) => (
                    <Option key={template.id} value={template.id}>
                      <Space>
                        <Text strong>{template.name}</Text>
                        <Tag color="blue">{template.type}</Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="执行Agent"
                name="agentId"
                rules={[{ required: true, message: '请选择执行Agent' }]}
              >
                <Select
                  placeholder="请选择执行Agent"
                  onChange={handleAgentChange}
                  value={selectedAgent?.id}
                  loading={loading}
                >
                  {userAgents
                    .filter(agent =>
                      selectedTemplate && agent.type
                        ? selectedTemplate.agentTypes.includes(agent.type)
                        : true
                    )
                    .map((agent) => (
                      <Option key={agent.id} value={agent.id}>
                        <Space>
                          <Text strong>{agent.name}</Text>
                          <Tag color="green">{agent.type}</Tag>
                          <Text type="secondary">{agent.model}</Text>
                        </Space>
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 任务优先级 */}
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="任务优先级">
                <Select
                  placeholder="选择优先级"
                  value={formDraft.priority || TaskPriority.NORMAL}
                  onChange={handlePriorityChange}
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
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="任务标签">
                <Select
                  mode="tags"
                  placeholder="输入标签"
                  value={formDraft.tags || []}
                  onChange={(tags) => updateFormDraft('tags', tags)}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 模板描述 */}
          {selectedTemplate && (
            <Alert
              message={
                <Space>
                  <Text strong>{selectedTemplate.name}</Text>
                  <Tag color="blue">{selectedTemplate.type}</Tag>
                  <Tag color="cyan">{selectedTemplate.category}</Tag>
                </Space>
              }
              description={
                <Paragraph>
                  {selectedTemplate.description}
                  <br />
                  <Text type="secondary">
                    <ClockCircleOutlined /> 预估时长: {Math.round(selectedTemplate.estimatedDuration / 60)} 分钟
                  </Text>
                </Paragraph>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider />

          {/* 动态参数表单 */}
          {selectedTemplate && (
            <Form
              form={form}
              layout="vertical"
              onValuesChange={handleValuesChange}
              disabled={loading || executing}
            >
              {formConfig?.ui.sections ? (
                <Collapse
                  defaultActiveKey={
                    formConfig.ui.sections
                      .map((section, index) => !section.collapsed ? `section-${index}` : null)
                      .filter((key): key is string => key !== null)
                  }
                  ghost
                >
                  {formConfig.ui.sections.map((section, index) => (
                    <Panel
                      header={
                        <Space>
                          <Text strong>{section.title}</Text>
                          <Text type="secondary">({section.fields.length} 个字段)</Text>
                        </Space>
                      }
                      key={`section-${index}`}
                      forceRender={!section.collapsed}
                    >
                      <Row gutter={24}>
                        {selectedTemplate.parameters
                          .filter(param => section.fields.includes(param.id))
                          .map((parameter) => (
                            <Col
                              span={formConfig.ui.columns === 2 ? 12 : 24}
                              key={parameter.id}
                            >
                              <ParameterRenderer
                                parameter={parameter}
                                value={formValues[parameter.id]}
                                onChange={(value) => {
                                  setFormValues(prev => ({ ...prev, [parameter.id]: value }));
                                  form.setFieldsValue({ [parameter.id]: value });
                                }}
                                disabled={loading || executing}
                              />
                            </Col>
                          ))}
                      </Row>
                    </Panel>
                  ))}
                </Collapse>
              ) : (
                <Row gutter={24}>
                  {selectedTemplate.parameters.map((parameter) => (
                    <Col span={12} key={parameter.id}>
                      <ParameterRenderer
                        parameter={parameter}
                        value={formValues[parameter.id]}
                        onChange={(value) => {
                          setFormValues(prev => ({ ...prev, [parameter.id]: value }));
                          form.setFieldsValue({ [parameter.id]: value });
                        }}
                        disabled={loading || executing}
                      />
                    </Col>
                  ))}
                </Row>
              )}
            </Form>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              style={{ marginTop: 16 }}
            />
          )}

          {/* 预览和调试面板 */}
          {(showPreview || showDebug) && (
            <div style={{ marginTop: 16 }}>
              {showPreview && getFormPreview()}
              {showDebug && getDebugInfo()}
            </div>
          )}

          {/* 操作按钮 */}
          <Divider />
          <Row justify="end" gutter={16}>
            <Col>
              <Button onClick={handleClear} icon={<ClearOutlined />}>
                清空
              </Button>
            </Col>
            <Col>
              <Button onClick={handleSaveDraft} icon={<SaveOutlined />}>
                保存草稿
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                onClick={handleSubmit}
                icon={<PlayCircleOutlined />}
                loading={executing}
                disabled={!selectedTemplate || !selectedAgent}
              >
                {executing ? '创建中...' : '执行任务'}
              </Button>
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  );
};

export default TaskExecutionForm;