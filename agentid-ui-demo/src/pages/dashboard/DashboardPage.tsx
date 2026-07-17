import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Avatar, Progress, Timeline, Button } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  BlockOutlined,
  RiseOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import StatisticCard from '../../components/ui/StatisticCard';
import { useAuthStore, useAgentStore } from '../../store';

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { agents, loading } = useAgentStore();
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalAuthentications: 0,
    blockchainTransactions: 0,
  });

  useEffect(() => {
    // 模拟统计数据
    setStats({
      totalAgents: agents.length,
      activeAgents: agents.filter((agent: any) => agent.status === 'active').length,
      totalAuthentications: 156,
      blockchainTransactions: 89,
    });
  }, [agents]);

  const recentActivities = [
    {
      id: 1,
      type: 'agent_created',
      title: '创建了新的Agent',
      description: 'Data Processing Agent',
      time: '2分钟前',
      status: 'success',
    },
    {
      id: 2,
      type: 'authentication',
      title: '完成身份认证',
      description: 'Agent ID: agent_001',
      time: '15分钟前',
      status: 'success',
    },
    {
      id: 3,
      type: 'agent_stopped',
      title: '停止了Agent',
      description: 'Backup Agent',
      time: '1小时前',
      status: 'warning',
    },
    {
      id: 4,
      type: 'blockchain_tx',
      title: '区块链交易',
      description: 'Agent注册',
      time: '2小时前',
      status: 'success',
    },
  ];

  const systemHealth = [
    {
      title: '网络状态',
      value: 98,
      status: 'healthy',
    },
    {
      title: 'API响应时间',
      value: 95,
      status: 'healthy',
    },
    {
      title: '数据库连接',
      value: 100,
      status: 'healthy',
    },
    {
      title: '区块链同步',
      value: 87,
      status: 'warning',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined className="text-white" />;
      case 'warning':
        return <ExclamationCircleOutlined className="text-white" />;
      default:
        return <ExclamationCircleOutlined className="text-white" />;
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      {/* 欢迎横幅 */}
      <Card
        className="mb-6 text-white border-0 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
        }}
        bodyStyle={{ padding: '32px' }}
      >
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white opacity-10 blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white opacity-10 blur-3xl"></div>
        </div>

        <Row align="middle" className="relative z-10">
          <Col flex="auto">
            <div>
              <h1 className="text-3xl font-bold mb-3 drop-shadow-lg">
                欢迎回来，{user?.username}！👋
              </h1>
              <p className="text-white text-opacity-90 text-base">
                今天是 {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}，让我们一起管理您的 AgentID 生态系统。
              </p>
            </div>
          </Col>
          <Col>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <UserOutlined className="text-4xl text-white" />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Agent总数"
            value={stats.totalAgents}
            icon={<RobotOutlined />}
            trend={{ value: 12, isPositive: true }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="活跃Agent"
            value={stats.activeAgents}
            icon={<DashboardOutlined />}
            trend={{ value: 8, isPositive: true }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="认证次数"
            value={stats.totalAuthentications}
            icon={<SafetyCertificateOutlined />}
            trend={{ value: 15, isPositive: true }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="区块链交易"
            value={stats.blockchainTransactions}
            icon={<BlockOutlined />}
            trend={{ value: 5, isPositive: true }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 最近活动 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center text-gray-900">
                <ClockCircleOutlined className="mr-2 text-lg" />
                <span className="font-semibold">最近活动</span>
              </div>
            }
            className="h-full"
            bordered={false}
            style={{
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            }}
          >
            <List
              dataSource={recentActivities}
              renderItem={(item) => (
                <List.Item
                  className="hover:bg-gray-50 transition-all duration-200 rounded-lg px-2 -mx-2"
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        className="flex items-center justify-center w-12 h-12 rounded-xl"
                        style={{
                          background: item.status === 'success'
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          boxShadow: item.status === 'success'
                            ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                            : '0 4px 12px rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        {getStatusIcon(item.status)}
                      </div>
                    }
                    title={
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{item.title}</span>
                        <span className="text-xs text-gray-400">{item.time}</span>
                      </div>
                    }
                    description={
                      <span className="text-gray-600">{item.description}</span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 系统健康状态 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center text-gray-900">
                <RiseOutlined className="mr-2 text-lg" />
                <span className="font-semibold">系统健康状态</span>
              </div>
            }
            className="h-full"
            bordered={false}
            style={{
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="space-y-5">
              {systemHealth.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">{item.title}</span>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'healthy'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {item.value}%
                    </div>
                  </div>
                  <Progress
                    percent={item.value}
                    strokeWidth={8}
                    strokeColor={
                      item.status === 'healthy'
                        ? { '0%': '#10b981', '100%': '#059669' }
                        : { '0%': '#f59e0b', '100%': '#d97706' }
                    }
                    showInfo={false}
                    strokeLinecap="round"
                  />
                </div>
              ))}
            </div>

            <div
              className="mt-6 p-5 rounded-xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
              }}
            >
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <CheckCircleOutlined className="mr-2" />
                系统状态
              </h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                所有系统运行正常。区块链同步稍慢，但不影响正常使用。
              </p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card
        title={
          <div className="flex items-center text-gray-900">
            <DashboardOutlined className="mr-2 text-lg" />
            <span className="font-semibold">快速操作</span>
          </div>
        }
        className="mt-6"
        bordered={false}
        style={{
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Button
              type="primary"
              size="large"
              className="w-full transition-all duration-300 hover:scale-105"
              icon={<RobotOutlined />}
              style={{
                height: '88px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              }}
            >
              创建 Agent
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              size="large"
              className="w-full transition-all duration-300 hover:scale-105"
              icon={<SafetyCertificateOutlined />}
              style={{
                height: '88px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '12px',
                border: '2px solid #667eea',
                color: '#667eea',
                background: 'linear-gradient(135deg, #f0f4ff 0%, #f8f0ff 100%)',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.1)',
              }}
            >
              身份认证
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              size="large"
              className="w-full transition-all duration-300 hover:scale-105"
              icon={<BlockOutlined />}
              style={{
                height: '88px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '12px',
                border: '2px solid #10b981',
                color: '#10b981',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.1)',
              }}
            >
              区块链浏览
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              size="large"
              className="w-full transition-all duration-300 hover:scale-105"
              icon={<UserOutlined />}
              style={{
                height: '88px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '12px',
                border: '2px solid #f59e0b',
                color: '#f59e0b',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)',
              }}
            >
              个人设置
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DashboardPage;