import React, { useState, useCallback } from 'react';
import { Layout, Row, Col, Space, Typography, Alert, Tabs, Button } from 'antd';
import { useIdentityStore } from '../../store';
import { IdentityGenerator } from '../../core/identity/IdentityGenerator';
import { CredentialUpload } from '../../components/forms/CredentialUpload';
import { GenerationProcessTracker } from '../../components/identity/GenerationProcessTracker';
import { GenerationResult } from '../../components/identity/GenerationResult';
import { IdentityConfigForm } from '../../components/identity/IdentityConfigForm';
import { DemoWrapper } from '../../components/ui/DemoWrapper';
import {
  isValidCredentialFile,
  formatFileSize,
  filterIdentities
} from '../../utils/identityUtils';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

export const IdentityGenerationPage: React.FC = () => {
  const {
    config,
    currentProcess,
    identities,
    isLoading,
    error,
    startGeneration,
    updateProcess,
    completeGeneration,
    failGeneration,
    resetProcess,
    removeIdentity,
    setError
  } = useIdentityStore();

  const [generator] = useState(() => new IdentityGenerator(config));
  const [activeTab, setActiveTab] = useState('generation');
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
    // 可以添加提示逻辑
    console.log('复制:', text);
  }, []);

  const handleExport = useCallback((identity: any) => {
    console.log('导出:', identity.identityId);
  }, []);

  const handleDelete = useCallback((identityId: string) => {
    removeIdentity(identityId);
  }, [removeIdentity]);

  return (
    <DemoWrapper
      showWatermark={true}
      showTooltip={true}
      tooltipTitle="身份标识生成演示"
      tooltipContent="此演示系统展示了完整的身份标识生成流程，包括文件上传、信息提取、标识生成等步骤。所有数据均为模拟数据。"
    >
      <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <Content style={{ padding: '24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Title level={2}>
              <span style={{ position: 'relative' }}>
                身份标识生成
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-40px',
                  background: '#ff4d4f',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontWeight: 'bold'
                }}>
                  演示用
                </span>
              </span>
            </Title>
            <Text type="secondary">
              上传身份凭证文件，系统将自动提取信息并生成唯一的身份标识
            </Text>

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
            <TabPane tab="生成" key="generation">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {/* 配置表单 */}
                    <IdentityConfigForm compact />

                    {/* 文件上传 */}
                    <CredentialUpload
                      onFileSelect={handleFileSelect}
                      config={{
                        maxFileSize: 10 * 1024 * 1024,
                        allowedTypes: ['image/*', 'application/pdf'],
                        maxFiles: 1,
                        allowMultiple: false
                      }}
                      disabled={isLoading || currentProcess?.status === 'processing'}
                    />

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

                    {/* 生成按钮 */}
                    <Button
                      type="primary"
                      size="large"
                      block
                      onClick={handleGenerate}
                      disabled={!selectedFile || isLoading || currentProcess?.status === 'processing'}
                      loading={isLoading}
                    >
                      {currentProcess?.status === 'processing' ? '生成中...' : '开始生成'}
                    </Button>
                  </Space>
                </Col>

                <Col span={16}>
                  {/* 生成过程追踪 */}
                  {currentProcess && (
                    <GenerationProcessTracker
                      process={currentProcess}
                      onCancel={handleCancel}
                      showDetails={true}
                    />
                  )}

                  {/* 生成结果 */}
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
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={`历史记录 (${identities.length})`} key="history">
              <Row gutter={[16, 16]}>
                {identities.length === 0 ? (
                  <Col span={24}>
                    <Alert
                      message="暂无历史记录"
                      description="生成身份标识后，历史记录将显示在这里"
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

            <TabPane tab="配置" key="config">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <IdentityConfigForm
                    onConfigChange={(newConfig) => {
                      console.log('配置更新:', newConfig);
                    }}
                    onReset={() => {
                      console.log('配置重置');
                    }}
                    showActions={true}
                    compact={false}
                  />
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        </div>
      </Content>
    </Layout>
    </DemoWrapper>
  );
};

export default IdentityGenerationPage;