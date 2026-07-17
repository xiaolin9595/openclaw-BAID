import React from 'react';
import { Card, Button, Space, Typography, Tag, Alert, Descriptions, Row, Col, Divider } from 'antd';
import { CopyOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { GeneratedIdentity } from '../../types/identity';
import {
  formatIdentityId,
  formatProcessingTime,
  formatDate,
  calculateAge,
  getConfidenceColor,
  getConfidenceText,
  exportIdentityData,
  copyToClipboard
} from '../../utils/identityUtils';

const { Title, Text, Paragraph } = Typography;

interface GenerationResultProps {
  identity: GeneratedIdentity;
  onCopy?: (text: string) => void;
  onExport?: (identity: GeneratedIdentity) => void;
  onDelete?: (identityId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export const GenerationResult: React.FC<GenerationResultProps> = ({
  identity,
  onCopy,
  onExport,
  onDelete,
  showActions = true,
  compact = false
}) => {
  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      // 可以添加提示
      console.log('复制成功');
    } else {
      console.log('复制失败');
    }
    onCopy?.(text);
  };

  const handleExport = () => {
    const data = exportIdentityData(identity);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${identity.identityId}_${new Date(identity.generatedAt).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onExport?.(identity);
  };

  const handleDelete = () => {
    onDelete?.(identity.identityId);
  };

  if (compact) {
    return (
      <Card size="small" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>{formatIdentityId(identity.identityId)}</Text>
            <br />
            <Text type="secondary">{identity.credentialData.name}</Text>
          </div>
          <Space>
            <Tag color={getConfidenceColor(identity.confidence)}>
              {Math.round(identity.confidence * 100)}%
            </Tag>
            {showActions && (
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopy(identity.identityId)}
              />
            )}
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            生成结果
          </Title>
          <Space>
            <Tag color={getConfidenceColor(identity.confidence)}>
              {getConfidenceText(identity.confidence)} ({Math.round(identity.confidence * 100)}%)
            </Tag>
            {showActions && (
              <Space>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(identity.identityId)}
                >
                  复制
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                >
                  导出
                </Button>
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  onClick={handleDelete}
                >
                  删除
                </Button>
              </Space>
            )}
          </Space>
        </div>
      }
      style={{ width: '100%' }}
    >
      {/* 基本信息 */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="身份标识">
              <Text copyable={{ text: identity.identityId }}>
                {formatIdentityId(identity.identityId)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="前缀">{identity.prefix}</Descriptions.Item>
            <Descriptions.Item label="哈希值">
              <Text code>{identity.hash.substring(0, 16)}...</Text>
            </Descriptions.Item>
            <Descriptions.Item label="生成时间">
              {formatDate(identity.generatedAt)}
            </Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="置信度">
              <Tag color={getConfidenceColor(identity.confidence)}>
                {Math.round(identity.confidence * 100)}%
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="处理时间">
              {formatProcessingTime(identity.metadata.processingTime)}
            </Descriptions.Item>
            <Descriptions.Item label="数据质量">
              <Tag color={
                identity.metadata.dataQuality === 'high' ? 'green' :
                identity.metadata.dataQuality === 'medium' ? 'orange' : 'red'
              }>
                {identity.metadata.dataQuality === 'high' ? '高质量' :
                 identity.metadata.dataQuality === 'medium' ? '中等质量' : '低质量'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="验证状态">
              <Tag color={identity.metadata.validationStatus === 'passed' ? 'green' : 'red'}>
                {identity.metadata.validationStatus === 'passed' ? '通过' : '失败'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      <Divider />

      {/* 凭证信息 */}
      <Title level={5}>凭证信息</Title>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="姓名">{identity.credentialData.name}</Descriptions.Item>
            <Descriptions.Item label="证件类型">{identity.credentialData.type}</Descriptions.Item>
            <Descriptions.Item label="证件号码">{identity.credentialData.documentNumber}</Descriptions.Item>
            <Descriptions.Item label="性别">{identity.credentialData.gender === 'male' ? '男' : '女'}</Descriptions.Item>
            <Descriptions.Item label="出生日期">
              {identity.credentialData.dateOfBirth} (年龄: {calculateAge(identity.credentialData.dateOfBirth)})
            </Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="国籍">{identity.credentialData.nationality}</Descriptions.Item>
            <Descriptions.Item label="签发国家">{identity.credentialData.issuingCountry}</Descriptions.Item>
            <Descriptions.Item label="签发日期">{identity.credentialData.issuedDate}</Descriptions.Item>
            <Descriptions.Item label="到期日期">{identity.credentialData.expiryDate}</Descriptions.Item>
            {identity.credentialData.address && (
              <Descriptions.Item label="地址">{identity.credentialData.address}</Descriptions.Item>
            )}
          </Descriptions>
        </Col>
      </Row>

      <Divider />

      {/* 技术信息 */}
      <Title level={5}>技术信息</Title>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="算法版本">{identity.metadata.algorithm}</Descriptions.Item>
            <Descriptions.Item label="版本号">{identity.metadata.version}</Descriptions.Item>
            <Descriptions.Item label="提取置信度">
              {Math.round(identity.credentialData.confidence * 100)}%
            </Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="提取时间">{formatDate(identity.credentialData.extractedAt)}</Descriptions.Item>
            <Descriptions.Item label="步骤数量">{identity.steps.length}</Descriptions.Item>
            <Descriptions.Item label="完成步骤">
              {identity.steps.filter(s => s.status === 'completed').length} / {identity.steps.length}
            </Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      {/* 警告信息 */}
      {identity.confidence < 0.7 && (
        <Alert
          message="低置信度警告"
          description="此身份标识的置信度较低，建议重新生成或检查凭证数据质量。"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {identity.metadata.validationStatus === 'failed' && (
        <Alert
          message="验证失败"
          description="身份标识验证未通过，请检查凭证数据并重新生成。"
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
};

export default GenerationResult;