import React from 'react';
import { Form, Input, Switch, Select, InputNumber, Button, Space, Card, Typography, Divider, Row, Col } from 'antd';
import { useIdentityStore } from '../../store';
import { IdentityGenerationConfig } from '../../types/identity';
import { getDefaultConfig, validateConfig } from '../../utils/identityUtils';

const { Title, Text } = Typography;
const { Option } = Select;

interface IdentityConfigFormProps {
  onConfigChange?: (config: IdentityGenerationConfig) => void;
  onReset?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export const IdentityConfigForm: React.FC<IdentityConfigFormProps> = ({
  onConfigChange,
  onReset,
  showActions = true,
  compact = false
}) => {
  const { config, setConfig, resetConfig } = useIdentityStore();
  const [form] = Form.useForm<IdentityGenerationConfig>();

  React.useEffect(() => {
    form.setFieldsValue(config);
  }, [config, form]);

  const handleValuesChange = (changedValues: Partial<IdentityGenerationConfig>) => {
    const newConfig = { ...config, ...changedValues };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleReset = () => {
    const defaultConfig = getDefaultConfig();
    form.setFieldsValue(defaultConfig);
    resetConfig();
    onReset?.();
  };

  const handleFinish = (values: IdentityGenerationConfig) => {
    const errors = validateConfig(values);
    if (errors.length > 0) {
      // 可以在这里显示错误信息
      console.error('配置验证失败:', errors);
      return;
    }
    setConfig(values);
    onConfigChange?.(values);
  };

  if (compact) {
    return (
      <Card size="small" title="生成配置">
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleValuesChange}
          autoComplete="off"
        >
          <Form.Item label="前缀" name="prefix">
            <Input maxLength={10} placeholder="输入前缀" />
          </Form.Item>

          <Form.Item label="哈希算法" name="hashAlgorithm">
            <Select>
              <Option value="sha256">SHA-256</Option>
              <Option value="sha512">SHA-512</Option>
              <Option value="md5">MD5</Option>
            </Select>
          </Form.Item>

          <Form.Item label="置信度阈值" name="confidenceThreshold">
            <InputNumber
              min={0}
              max={1}
              step={0.1}
              style={{ width: '100%' }}
              formatter={value => `${(Number(value!) * 100).toFixed(0)}%`}
              parser={value => (Number(String(value!).replace('%', '')) / 100) as 0 | 1}
            />
          </Form.Item>

          {showActions && (
            <Form.Item>
              <Button type="primary" onClick={() => form.submit()} block>
                应用配置
              </Button>
            </Form.Item>
          )}
        </Form>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            身份标识生成配置
          </Title>
          {showActions && (
            <Space>
              <Button onClick={handleReset}>
                重置默认
              </Button>
              <Button type="primary" onClick={() => form.submit()}>
                应用配置
              </Button>
            </Space>
          )}
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        onFinish={handleFinish}
        autoComplete="off"
      >
        {/* 基本配置 */}
        <Title level={5}>基本配置</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="前缀"
              name="prefix"
              rules={[
                { max: 10, message: '前缀长度不能超过10个字符' }
              ]}
            >
              <Input placeholder="例如: AGT" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="生成数量"
              name="count"
              rules={[
                { type: 'number', min: 1, message: '生成数量必须大于0' }
              ]}
            >
              <InputNumber
                min={1}
                max={100}
                style={{ width: '100%' }}
                placeholder="1"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 生成选项 */}
        <Title level={5}>生成选项</Title>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="使用UUID"
              name="useUUID"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="包含哈希"
              name="includeHash"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="启用步骤"
              name="enableSteps"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        {/* 高级配置 */}
        <Divider />
        <Title level={5}>高级配置</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="哈希算法"
              name="hashAlgorithm"
            >
              <Select>
                <Option value="sha256">SHA-256</Option>
                <Option value="sha512">SHA-512</Option>
                <Option value="md5">MD5</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="置信度阈值"
              name="confidenceThreshold"
              rules={[
                { type: 'number', min: 0, max: 1, message: '置信度阈值必须在0到1之间' }
              ]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                style={{ width: '100%' }}
                formatter={value => `${(Number(value!) * 100).toFixed(0)}%`}
                parser={value => (Number(String(value!).replace('%', '')) / 100) as 0 | 1}
                placeholder="0.7"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 批量生成选项 */}
        <Form.Item
          label="批量生成"
          name="generateMultiple"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {form.getFieldValue('generateMultiple') && (
          <Form.Item
            label="生成数量"
            name="count"
            dependencies={['generateMultiple']}
            rules={[
              { type: 'number', min: 1, max: 100, message: '生成数量必须在1到100之间' }
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              placeholder="5"
            />
          </Form.Item>
        )}

        {/* 配置预览 */}
        <Divider />
        <Title level={5}>配置预览</Title>
        <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>前缀:</strong> {form.getFieldValue('prefix') || 'AGT'}</Text>
            <Text><strong>使用UUID:</strong> {form.getFieldValue('useUUID') ? '是' : '否'}</Text>
            <Text><strong>哈希算法:</strong> {form.getFieldValue('hashAlgorithm') || 'sha256'}</Text>
            <Text><strong>置信度阈值:</strong> {((form.getFieldValue('confidenceThreshold') || 0.7) * 100).toFixed(0)}%</Text>
            <Text><strong>生成数量:</strong> {form.getFieldValue('count') || 1}</Text>
            <Text><strong>批量生成:</strong> {form.getFieldValue('generateMultiple') ? '是' : '否'}</Text>
          </Space>
        </Card>

        {/* 表单操作 */}
        {showActions && (
          <Form.Item style={{ marginTop: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存配置
              </Button>
              <Button onClick={handleReset}>
                重置为默认
              </Button>
            </Space>
          </Form.Item>
        )}
      </Form>
    </Card>
  );
};

export default IdentityConfigForm;