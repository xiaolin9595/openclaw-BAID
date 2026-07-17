import React, { useState } from 'react';
import { Form, Input, Button, Card, Steps, message, Progress, Alert } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../../services/userService';

const { Step } = Steps;

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

const RegisterPage: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<RegisterFormValues>>({});
  const [biometricProgress, setBiometricProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const navigate = useNavigate();


  const steps = [
    {
      title: '基本信息',
      description: '填写账户信息',
      icon: <UserOutlined />,
    },
    {
      title: '生物特征',
      description: '绑定身份验证',
      icon: <SafetyOutlined />,
    },
    {
      title: '密钥生成',
      description: '创建加密密钥',
      icon: <LockOutlined />,
    },
    {
      title: '完成注册',
      description: '账户创建成功',
      icon: <MailOutlined />,
    },
  ];

  const getErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error ? error.message : fallback;
  };

  const handleBasicInfo = async (values: RegisterFormValues) => {
    setRegistrationError(null);
    setFormData({ ...formData, ...values });
    setCurrent(1);
  };

  const handleBiometricBinding = async () => {
    setScanning(true);
    setBiometricProgress(0);

    // 模拟生物特征扫描
    const interval = setInterval(() => {
      setBiometricProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);
          setCurrent(2);
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 300);
  };

  const handleKeyGeneration = async () => {
    setLoading(true);
    setRegistrationError(null);

    try {
      if (!formData.username || !formData.email || !formData.password) {
        throw new Error('注册信息不完整，请返回上一步重新填写');
      }

      await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });

      message.success('注册成功！正在跳转...', 1);
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, '注册失败');
      setRegistrationError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <Form
            layout="vertical"
            onFinish={handleBasicInfo}
            size="large"
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名!' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="输入用户名" />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱!' },
                { type: 'email', message: '请输入有效的邮箱地址!' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="输入邮箱地址" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码!' },
                { min: 8, message: '密码至少8个字符!' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="输入密码" />
            </Form.Item>

            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" className="w-full">
                下一步
              </Button>
            </Form.Item>
          </Form>
        );

      case 1:
        return (
          <div className="text-center">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                <SafetyOutlined className="text-6xl text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">生物特征绑定</h3>
              <p className="text-gray-600">
                请将您的指纹放在扫描器上，系统将生成唯一的生物特征模板。
              </p>
            </div>

            <div className="mb-6">
              <Progress
                percent={biometricProgress}
                status={scanning ? 'active' : biometricProgress === 100 ? 'success' : 'normal'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>

            <Alert
              message="生物特征验证"
              description="此步骤将验证您的生物特征信息，确保Agent只能由其所有者操作。"
              type="info"
              showIcon
              className="mb-6"
            />

            <Button
              type="primary"
              size="large"
              onClick={handleBiometricBinding}
              loading={scanning}
              disabled={biometricProgress > 0}
              className="w-full"
            >
              {scanning ? '扫描中...' : biometricProgress === 100 ? '已绑定' : '开始扫描'}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-4 bg-green-50 rounded-full flex items-center justify-center">
                <LockOutlined className="text-6xl text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">密钥生成</h3>
              <p className="text-gray-600">
                系统正在为您生成加密密钥对，用于身份验证和数据加密。
              </p>
            </div>

            <Alert
              message="安全提示"
              description="您的私钥将安全存储，请妥善保管。私钥丢失将无法恢复。"
              type="warning"
              showIcon
              className="mb-6"
            />

            {registrationError && (
              <Alert
                message={registrationError}
                type="error"
                showIcon
                className="mb-6 text-left"
              />
            )}

            <Button
              type="primary"
              size="large"
              onClick={handleKeyGeneration}
              loading={loading}
              className="w-full"
            >
              生成密钥并完成注册
            </Button>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <SafetyOutlined className="text-6xl text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">注册成功！</h3>
              <p className="text-gray-600 mb-2">
                您的 AgentID 账户已成功创建。
              </p>
              <p className="text-sm text-purple-600 font-medium">
                3秒后自动跳转到登录页面...
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                <p className="text-sm text-gray-600 mb-1">用户名</p>
                <p className="font-medium text-gray-900">{formData.username}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                <p className="text-sm text-gray-600 mb-1">邮箱</p>
                <p className="font-medium text-gray-900">{formData.email}</p>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full font-semibold"
              style={{
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}
            >
              立即登录
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
         style={{
           background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
         }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-60 h-60 rounded-full bg-white opacity-5 blur-2xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>
      </div>

      <div className="max-w-3xl w-full relative z-10">
        {/* 标题 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white bg-opacity-20 backdrop-blur-lg mb-6 shadow-xl">
            <SafetyOutlined className="text-4xl text-white" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">创建 AgentID 账户</h2>
          <p className="text-lg text-white text-opacity-90 font-medium">
            快速注册并开始使用智能Agent管理平台
          </p>
        </div>

        {/* 注册卡片 */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white bg-opacity-95 border-0 rounded-2xl overflow-hidden"
              style={{ backdropFilter: 'blur(20px)' }}
              bodyStyle={{ padding: '40px' }}>
          <Steps current={current} className="mb-8">
            {steps.map((step) => (
              <Step
                key={step.title}
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            ))}
          </Steps>

          <div className="min-h-[400px] flex items-center justify-center">
            {renderStepContent()}
          </div>

          {current > 0 && current < 3 && (
            <div className="text-center mt-8">
              <Button
                onClick={() => setCurrent(current - 1)}
                size="large"
                style={{
                  borderRadius: '10px',
                  height: '44px',
                  paddingLeft: '32px',
                  paddingRight: '32px'
                }}
              >
                上一步
              </Button>
            </div>
          )}

          {current === 0 && (
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                已有账户？{' '}
                <Link
                  to="/login"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  立即登录
                </Link>
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
