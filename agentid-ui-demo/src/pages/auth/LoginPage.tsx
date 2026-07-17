import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { loginUser } from '../../services/userService';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 调用登录服务
      const user = await loginUser({
        username: values.username,
        password: values.password
      });

      setUser(user);
      message.success('登录成功！');
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
         style={{
           background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
         }}>
      {/* 背景装饰圆圈 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white opacity-10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo和标题 */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white bg-opacity-20 backdrop-blur-lg mb-6 shadow-xl">
            <UserOutlined className="text-4xl text-white" />
          </div>
          <h2 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">AgentID</h2>
          <p className="text-xl text-white text-opacity-90 font-medium">
            智能Agent管理平台
          </p>
          <p className="mt-3 text-sm text-white text-opacity-80">
            登录您的账户以开始使用
          </p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white bg-opacity-95 border-0 rounded-2xl overflow-hidden"
              style={{ backdropFilter: 'blur(20px)' }}
              bodyStyle={{ padding: '32px' }}>
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名!' }]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="用户名"
                className="rounded-lg"
                style={{
                  height: '48px',
                  fontSize: '16px',
                  borderRadius: '12px'
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="密码"
                className="rounded-lg"
                style={{
                  height: '48px',
                  fontSize: '16px',
                  borderRadius: '12px'
                }}
              />
            </Form.Item>

            <Form.Item>
              <div className="flex items-center justify-between">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox className="text-gray-600">记住我</Checkbox>
                </Form.Item>

                <a className="text-sm font-medium text-blue-600 hover:text-blue-700"
                   href="#">
                  忘记密码？
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full font-semibold text-lg"
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}
              >
                登录
              </Button>
            </Form.Item>

            <div className="text-center pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                还没有账户？{' '}
                <Link
                  to="/register"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  立即注册
                </Link>
              </span>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
