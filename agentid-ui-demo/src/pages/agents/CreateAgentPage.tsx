import React, { useState, useEffect } from 'react';
import { Card, Typography, message, Modal, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { AgentCreateForm } from '../../components/agents/AgentCreateForm';
import { useAgentStore } from '../../store/agentStore';
import { DemoWrapper } from '../../components/ui/DemoWrapper';

const { Title } = Typography;

const CreateAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { createAgent, isCreating, error } = useAgentStore();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const handleComplete = async (agentData: {
    basicInfo: any;
    codePackage: any;
  }) => {
    try {
      const newAgent = await createAgent(agentData);
      setCreatedAgentId(newAgent.id);
      setShowSuccessModal(true);
      message.success('Agent创建成功！');
    } catch (err) {
      message.error('Agent创建失败，请重试');
    }
  };

  const handleCancel = () => {
    navigate('/agents');
  };

  const handleViewAgent = () => {
    setShowSuccessModal(false);
    if (createdAgentId) {
      navigate(`/agents/${createdAgentId}`);
    } else {
      navigate('/agents');
    }
  };

  const handleGoToList = () => {
    setShowSuccessModal(false);
    navigate('/agents');
  };

  return (
    <DemoWrapper
      showWatermark={true}
      showTooltip={true}
      tooltipTitle="Agent创建功能演示"
      tooltipContent="此页面演示了完整的Agent创建流程，包括基本信息录入、代码包上传和配置确认。所有功能均为演示目的。"
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div className="mb-6">
          <Title level={2}>
            创建新Agent
          </Title>
          <Typography.Text type="secondary">
            按照向导步骤创建新的智能代理，包括代码包上传和配置
          </Typography.Text>
        </div>

        {/* Main Form */}
        <AgentCreateForm
          onComplete={handleComplete}
          onCancel={handleCancel}
        />

        {/* Success Modal */}
        <Modal
          title="Agent创建成功"
          open={showSuccessModal}
          onCancel={handleGoToList}
          footer={[
            <Button key="list" onClick={handleGoToList}>
              返回Agent列表
            </Button>,
            <Button key="view" type="primary" onClick={handleViewAgent}>
              查看Agent详情
            </Button>
          ]}
        >
          <div className="text-center py-4">
            <div className="text-6xl mb-4">🎉</div>
            <Title level={4} type="success">
              恭喜！Agent创建成功
            </Title>
            <Typography.Text type="secondary">
              您的新Agent已经成功创建并部署。您可以查看Agent详细信息或返回Agent列表进行管理。
            </Typography.Text>
          </div>
        </Modal>

        {/* Error Display */}
        {error && (
          <Card className="mt-4">
            <Typography.Text type="danger">
              创建过程中出现错误：{error}
            </Typography.Text>
          </Card>
        )}
      </div>
    </DemoWrapper>
  );
};

export default CreateAgentPage;