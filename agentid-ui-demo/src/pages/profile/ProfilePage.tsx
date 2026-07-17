import React, { useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Alert,
  Tabs,
  Button,
  Avatar,
  Descriptions,
  Tag,
  Divider
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useIdentityStore } from '../../store';
import { IdentityGenerator } from '../../core/identity/IdentityGenerator';
import { CredentialUpload } from '../../components/forms/CredentialUpload';
import { GenerationProcessTracker } from '../../components/identity/GenerationProcessTracker';
import { GenerationResult } from '../../components/identity/GenerationResult';
import { IdentityConfigForm } from '../../components/identity/IdentityConfigForm';
import { DemoWrapper } from '../../components/ui/DemoWrapper';
import {
  isValidCredentialFile,
  formatFileSize
} from '../../utils/identityUtils';
import { getCurrentUser } from '../../mocks/sharedUserData';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ProfilePage: React.FC = () => {
  const {
    config,
    currentProcess,
    identities,
    isLoading,
    error,
    startGeneration,
    failGeneration,
    resetProcess,
    removeIdentity,
    setError
  } = useIdentityStore();

  const [generator] = useState(() => new IdentityGenerator(config));
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 更新生成器配置
  React.useEffect(() => {
    generator.updateConfig(config);
  }, [config, generator]);

  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      if (!isValidCredentialFile(file)) {
        setError('不支持的文件类型，请上传图片或PDF文件');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
        setError('文件大小不能超过10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }, [setError]);

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) {
      setError('请先选择凭证文件');
      return;
    }

    try {
      setError(null);
      await startGeneration(selectedFile);
    } catch (error) {
      failGeneration(error instanceof Error ? error.message : '生成失败');
    }
  }, [selectedFile, startGeneration, failGeneration, setError]);

  const handleCancel = useCallback(() => {
    resetProcess();
    setSelectedFile(null);
  }, [resetProcess]);

  const handleCopy = useCallback((text: string) => {
    console.log('复制:', text);
  }, []);

  const handleExport = useCallback((identity: { identityId: string }) => {
    console.log('导出:', identity.identityId);
  }, []);

  const handleDelete = useCallback((identityId: string) => {
    removeIdentity(identityId);
  }, [removeIdentity]);

  // 从共享数据源获取当前用户数据
  const userData = getCurrentUser() || {
    name: '未知用户',
    email: 'unknown@example.com',
    phone: '+86 138 0000 0000',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown',
    joinDate: '2024-01-01',
    location: '未知',
    department: '未知部门',
    position: '未知职位',
    status: 'active' as const
  };

  return (
    <DemoWrapper
      showWatermark={true}
      showTooltip={true}
      tooltipTitle="个人中心演示"
      tooltipContent="个人中心集成了用户信息管理和身份标识生成功能。所有数据均为模拟数据，用于演示目的。"
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Title level={2}>
          <span style={{ position: 'relative' }}>
            个人中心
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-40px',
              background: '#52c41a',
              color: 'white',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              个人中心
            </span>
          </span>
        </Title>

        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 24 }}>
          <TabPane tab="基本信息" key="basic">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card>
                  <Space direction="vertical" style={{ width: '100%', alignItems: 'center' }}>
                    <Avatar size={120} src={userData.avatar} icon={<UserOutlined />} />
                    <Title level={4}>{userData.name}</Title>
                    <Tag color="green">活跃</Tag>
                  </Space>
                </Card>
              </Col>
              <Col span={16}>
                <Card title="个人信息">
                  <Descriptions column={2}>
                    <Descriptions.Item label="姓名">{userData.name}</Descriptions.Item>
                    <Descriptions.Item label="邮箱">
                      <MailOutlined /> {userData.email}
                    </Descriptions.Item>
                    <Descriptions.Item label="电话">
                      <PhoneOutlined /> {userData.phone}
                    </Descriptions.Item>
                    <Descriptions.Item label="部门">{userData.department}</Descriptions.Item>
                    <Descriptions.Item label="职位">{userData.position}</Descriptions.Item>
                    <Descriptions.Item label="入职时间">
                      <CalendarOutlined /> {userData.joinDate}
                    </Descriptions.Item>
                    <Descriptions.Item label="地址" span={2}>
                      <EnvironmentOutlined /> {userData.location}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="身份凭证上传" key="upload">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Card title="配置信息" size="small">
                    <IdentityConfigForm compact />
                  </Card>

                  <Card title="身份凭证上传" size="small">
                    <CredentialUpload
                      onFileSelect={handleFileSelect}
                      config={{
                        maxFileSize: 10 * 1024 * 1024,
                        allowedTypes: [
                          'image/jpeg',
                          'image/png',
                          'image/gif',
                          'image/webp',
                          'application/pdf'
                        ],
                        maxFiles: 1,
                        allowMultiple: false
                      }}
                      disabled={isLoading || currentProcess?.status === 'processing'}
                    />
                    <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-600">
                      • 支持PNG、JPG、GIF、WebP图片格式<br/>
                      • 支持PDF文档格式<br/>
                      • 文件大小限制：10MB
                    </div>
                  </Card>

                  {selectedFile && (
                    <Alert
                      message="已选择文件"
                      description={
                        <div>
                          <div>文件名: {selectedFile.name}</div>
                          <div>文件大小: {formatFileSize(selectedFile.size)}</div>
                          <div>文件类型: {selectedFile.type || '未知'}</div>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginTop: 16 }}
                    />
                  )}

                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={handleGenerate}
                    disabled={!selectedFile || isLoading || currentProcess?.status === 'processing'}
                    loading={isLoading}
                  >
                    {currentProcess?.status === 'processing' ? '生成中...' : '开始生成身份标识'}
                  </Button>
                </Space>
              </Col>

              <Col span={16}>
                <Card title="生成进度">
                  {currentProcess && (
                    <GenerationProcessTracker
                      process={currentProcess}
                      onCancel={handleCancel}
                      showDetails={true}
                    />
                  )}

                  {currentProcess?.status === 'completed' && currentProcess.result && (
                    <div style={{ marginTop: 16 }}>
                      <GenerationResult
                        identity={currentProcess.result}
                        onCopy={handleCopy}
                        onExport={handleExport}
                        onDelete={handleDelete}
                        showActions={true}
                      />
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab={`身份标识 (${identities.length})`} key="identities">
            <Row gutter={[16, 16]}>
              {identities.length === 0 ? (
                <Col span={24}>
                  <Alert
                    message="暂无身份标识"
                    description="生成身份标识后，它们将显示在这里"
                    type="info"
                    showIcon
                  />
                </Col>
              ) : (
                identities.map((identity) => (
                  <Col span={24} key={identity.id}>
                    <GenerationResult
                      identity={identity}
                      onCopy={handleCopy}
                      onExport={handleExport}
                      onDelete={handleDelete}
                      showActions={true}
                      compact={true}
                    />
                  </Col>
                ))
              )}
            </Row>
          </TabPane>

          <TabPane tab="历史记录" key="history">
            <Card title="生成历史">
              <Text type="secondary">
                这里将显示所有身份标识生成的历史记录，包括成功和失败的记录。
              </Text>
              <Divider />
              <Alert
                message="功能开发中"
                description="历史记录功能正在开发中，敬请期待"
                type="info"
                showIcon
              />
            </Card>
          </TabPane>

          <TabPane tab="设置" key="settings">
            <Card title="个人设置">
              <Text type="secondary">
                这里将显示个人设置选项，包括隐私设置、通知设置等。
              </Text>
              <Divider />
              <Alert
                message="功能开发中"
                description="个人设置功能正在开发中，敬请期待"
                type="info"
                showIcon
              />
            </Card>
          </TabPane>
        </Tabs>
      </div>
    </DemoWrapper>
  );
};

export default ProfilePage;