import React, { useState } from 'react';
import { Button, Card, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import AgentPermissionModal from '../components/agents/AgentPermissionModal';
import type { Agent } from '../types/agent';

const { Title } = Typography;

const PermissionTestPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);

  const testAgent: Agent = {
    id: 'test-001',
    agentId: 'agent_test_001',
    name: 'Test Agent',
    description: 'Test agent for permission modal',
    codeHash: '0x123',
    profileHash: '0xabc',
    status: 'active',
    boundUser: 'test-user',
    boundAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    codeSize: 1024,
    language: 'typescript',
    version: '1.0.0',
    config: {
      permissions: ['read', 'write'],
      userBinding: {
        boundUserId: 'test-user',
        bindingType: 'multiFactor',
        bindingStrength: 'basic',
        verificationFrequency: 'once',
        fallbackAllowed: true
      }
    },
    permissions: ['read', 'write']
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>
          <SafetyCertificateOutlined /> 权限管理测试页面
        </Title>
        <p>这是一个独立的测试页面，用于验证权限管理Modal组件</p>
        <Button
          type="primary"
          size="large"
          onClick={() => setModalOpen(true)}
        >
          打开权限管理Modal
        </Button>
      </Card>

      <AgentPermissionModal
        open={modalOpen}
        agent={testAgent}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default PermissionTestPage;
