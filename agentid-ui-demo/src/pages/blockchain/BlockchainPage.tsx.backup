import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Tabs,
  Statistic,
  Alert,
  Space,
  Button
} from 'antd';
import {
  BlockOutlined,
  UserOutlined,
  FileTextOutlined,
  TrophyOutlined,
  ReloadOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { IdentityContractRegistration } from '../../components/blockchain/IdentityContractRegistration';
import { AgentIdentityContractRegistration } from '../../components/blockchain/AgentIdentityContractRegistration';
import { IdentityContractList } from '../../components/blockchain/IdentityContractList';
import { AgentIdentityContractList } from '../../components/blockchain/AgentIdentityContractList';
import { useBlockchainStore } from '../../store/blockchainStore';
import { DemoWrapper } from '../../components/ui/DemoWrapper';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const BlockchainPage: React.FC = () => {
  const {
    contracts,
    agentContracts,
    isLoading,
    error,
    fetchContracts,
    fetchAgentContracts,
    registerContract,
    registerAgentContract,
    deleteContract,
    deleteAgentContract,
    updateContractStatus,
    updateAgentContractStatus,
    setSelectedContract,
    setSelectedAgentContract,
    clearError,
    reset
  } = useBlockchainStore();

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchContracts();
    fetchAgentContracts();
  }, []);

  const handleRegisterContract = async (formData: any) => {
    try {
      await registerContract(formData);
      setActiveTab('contracts');
    } catch (error) {
      console.error('Contract registration failed:', error);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    try {
      await deleteContract(contractId);
    } catch (error) {
      console.error('Contract deletion failed:', error);
    }
  };

  const handleRegisterAgentContract = async (formData: any) => {
    try {
      await registerAgentContract(formData);
      // 注册成功后刷新数据，但不跳转页面
      fetchAgentContracts();
    } catch (error) {
      console.error('Agent contract registration failed:', error);
    }
  };

  const handleDeleteAgentContract = async (contractId: string) => {
    try {
      await deleteAgentContract(contractId);
    } catch (error) {
      console.error('Agent contract deletion failed:', error);
    }
  };

  const refreshData = () => {
    fetchContracts();
    fetchAgentContracts();
  };

  // 计算统计数据
  const allContracts = [...contracts, ...agentContracts];
  const totalContracts = allContracts.length;
  const activeContracts = allContracts.filter(c => c.status === 'active').length;
  const pendingContracts = allContracts.filter(c => c.status === 'pending').length;

  return (
    <DemoWrapper
      showWatermark={true}
      showTooltip={true}
      tooltipTitle="区块链功能演示"
      tooltipContent="区块链功能包括身份合约注册、管理和状态监控。所有数据均为模拟数据，用于演示目的。"
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2}>
              <BlockOutlined className="mr-2" />
              区块链功能
            </Title>
            <Text type="secondary">用户身份与Agent合约注册管理</Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshData}
            loading={isLoading}
          >
            刷新数据
          </Button>
        </div>

        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            className="mb-4"
          />
        )}

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="总合约数"
                value={totalContracts}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="活跃合约"
                value={activeContracts}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="待确认"
                value={pendingContracts}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 主要功能区域 */}
        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane
              tab={
                <span>
                  <BlockOutlined />
                  功能总览
                </span>
              }
              key="overview"
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="快速操作" className="h-full">
                    <Space direction="vertical" className="w-full">
                      <Button
                        type="primary"
                        size="large"
                        block
                        onClick={() => setActiveTab('agent-register')}
                      >
                        <RobotOutlined />
                        注册Agent合约
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => setActiveTab('register')}
                      >
                        <UserOutlined />
                        注册身份合约
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => setActiveTab('agent-contracts')}
                      >
                        <FileTextOutlined />
                        查看Agent管理
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="网络信息" className="h-full">
                    <Space direction="vertical" className="w-full">
                      <div>
                        <Text strong>网络状态:</Text>
                        <Text className="ml-2 text-green-600">正常运行</Text>
                      </div>
                      <div>
                        <Text strong>当前网络:</Text>
                        <Text className="ml-2">Ethereum Testnet</Text>
                      </div>
                      <div>
                        <Text strong>最新区块:</Text>
                        <Text className="ml-2">#15,847,392</Text>
                      </div>
                      <div>
                        <Text strong>平均Gas价格:</Text>
                        <Text className="ml-2">25 Gwei</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <RobotOutlined />
                  Agent注册
                </span>
              }
              key="agent-register"
            >
              <AgentIdentityContractRegistration onSuccess={handleRegisterAgentContract} />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <UserOutlined />
                  注册合约
                </span>
              }
              key="register"
            >
              <IdentityContractRegistration onSuccess={handleRegisterContract} />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <RobotOutlined />
                  Agent管理
                </span>
              }
              key="agent-contracts"
            >
              <AgentIdentityContractList
                contracts={agentContracts}
                loading={isLoading}
                onViewContract={setSelectedAgentContract}
                onDeleteContract={handleDeleteAgentContract}
                onUpdateContractStatus={updateAgentContractStatus}
                onEditContract={setSelectedAgentContract}
              />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <FileTextOutlined />
                  合约管理
                </span>
              }
              key="contracts"
            >
              <IdentityContractList
                contracts={contracts}
                loading={isLoading}
                onViewContract={setSelectedContract}
                onDeleteContract={handleDeleteContract}
              />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <TrophyOutlined />
                  网络统计
                </span>
              }
              key="stats"
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="状态分布">
                    <Space direction="vertical" className="w-full">
                      <div className="flex justify-between">
                        <Text>活跃合约:</Text>
                        <Text strong className="text-green-600">
                          {activeContracts} ({Math.round((activeContracts / totalContracts) * 100) || 0}%)
                        </Text>
                      </div>
                      <div className="flex justify-between">
                        <Text>待确认合约:</Text>
                        <Text strong className="text-yellow-600">
                          {pendingContracts} ({Math.round((pendingContracts / totalContracts) * 100) || 0}%)
                        </Text>
                      </div>
                      <div className="flex justify-between">
                        <Text>暂停合约:</Text>
                        <Text strong className="text-red-600">
                          {contracts.filter(c => c.status === 'suspended').length}
                        </Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="身份类型分布">
                    <Space direction="vertical" className="w-full">
                      <div className="flex justify-between">
                        <Text>身份类型统计:</Text>
                        <Text strong>
                          {contracts.length}
                        </Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </DemoWrapper>
  );
};

export default BlockchainPage;