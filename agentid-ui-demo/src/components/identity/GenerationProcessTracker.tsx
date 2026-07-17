import React, { useEffect, useState } from 'react';
import { Card, Progress, Steps, Alert, Button, Space, Typography, Tag, Divider } from 'antd';
import { useIdentityStore } from '../../store';
import { GenerationProcess } from '../../types/identity';
import {
  formatProcessingTime,
  getStepStatusColor,
  getConfidenceColor,
  getConfidenceText,
  formatIdentityId
} from '../../utils/identityUtils';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface GenerationProcessTrackerProps {
  process: GenerationProcess;
  onCancel?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
}

export const GenerationProcessTracker: React.FC<GenerationProcessTrackerProps> = ({
  process,
  onCancel,
  onRetry,
  showDetails = false
}) => {
  const { currentProcess, updateProcess } = useIdentityStore();
  const [expanded, setExpanded] = useState(false);

  // 模拟进度更新
  useEffect(() => {
    if (process.status === 'processing' && !currentProcess) {
      const interval = setInterval(() => {
        const updatedProcess: GenerationProcess = {
          ...process,
          progress: Math.min(process.progress + Math.random() * 20, 95),
          steps: process.steps.map((step: any, index: number) => {
            if (index === process.currentStep) {
              return {
                ...step,
                status: 'in_progress' as const,
                progress: Math.min(step.progress + Math.random() * 30, 90)
              };
            } else if (index < process.currentStep) {
              return {
                ...step,
                status: 'completed' as const,
                progress: 100
              };
            }
            return step;
          })
        };

        updateProcess(updatedProcess);

        // 模拟完成
        if (updatedProcess.progress >= 95) {
          setTimeout(() => {
            const completedProcess: GenerationProcess = {
              ...updatedProcess,
              status: 'completed',
              progress: 100,
              steps: updatedProcess.steps.map(step => ({
                ...step,
                status: 'completed' as const,
                progress: 100
              }))
            };
            updateProcess(completedProcess);
          }, 1000);
          clearInterval(interval);
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [process, currentProcess, updateProcess]);

  const getStatusColor = (status: GenerationProcess['status']) => {
    switch (status) {
      case 'processing':
        return 'process';
      case 'completed':
        return 'finish';
      case 'failed':
        return 'error';
      default:
        return 'wait';
    }
  };

  const getStatusText = (status: GenerationProcess['status']) => {
    switch (status) {
      case 'idle':
        return '待处理';
      case 'processing':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '处理失败';
      default:
        return '未知状态';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return '';
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    return formatProcessingTime(duration);
  };

  const renderStepDetails = (step: any) => (
    <div className="step-details" style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong>{step.name}</Text>
        <Text type="secondary">{step.progress}%</Text>
      </div>
      <Paragraph style={{ margin: 0, fontSize: 12 }}>{step.description}</Paragraph>
      {step.startTime && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            开始时间: {new Date(step.startTime).toLocaleString()}
          </Text>
        </div>
      )}
      {step.endTime && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            结束时间: {new Date(step.endTime).toLocaleString()}
          </Text>
          {step.duration && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              耗时: {formatProcessingTime(step.duration)}
            </Text>
          )}
        </div>
      )}
      {step.error && (
        <Alert
          message="错误"
          description={step.error}
          type="error"
          style={{ marginTop: 4 }}
        />
      )}
      {step.output && (
        <div style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 11 }}>输出: {JSON.stringify(step.output).substring(0, 100)}...</Text>
        </div>
      )}
    </div>
  );

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            身份标识生成过程
          </Title>
          <Space>
            <Tag color={process.status === 'processing' ? 'blue' :
                         process.status === 'completed' ? 'green' : 'red'}>
              {getStatusText(process.status)}
            </Tag>
            {process.status === 'processing' && onCancel && (
              <Button size="small" onClick={onCancel}>
                取消
              </Button>
            )}
            {process.status === 'failed' && onRetry && (
              <Button size="small" type="primary" onClick={onRetry}>
                重试
              </Button>
            )}
          </Space>
        </div>
      }
      style={{ width: '100%' }}
    >
      {/* 进度条 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>总体进度</Text>
          <Text strong>{Math.round(process.progress)}%</Text>
        </div>
        <Progress percent={Math.round(process.progress)} size="small" />
      </div>

      {/* 步骤进度 */}
      <Steps current={process.currentStep} status={getStatusColor(process.status)}>
        {process.steps.map((step: any, index: number) => (
          <Step
            key={step.id}
            title={step.name}
            description={
              <div style={{ fontSize: 12 }}>
                {step.description}
                {step.progress > 0 && step.progress < 100 && (
                  <div style={{ marginTop: 4 }}>
                    <Progress
                      percent={step.progress}
                      size="small"
                      status={step.status === 'failed' ? 'exception' : 'active'}
                    />
                  </div>
                )}
              </div>
            }
          />
        ))}
      </Steps>

      {/* 错误信息 */}
      {process.error && (
        <Alert
          message="处理失败"
          description={process.error}
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {/* 结果展示 */}
      {process.status === 'completed' && process.result && (
        <div style={{ marginTop: 16 }}>
          <Divider />
          <Title level={5}>生成结果</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>身份标识:</Text>
              <Text copyable={{ text: process.result.identityId }}>
                {formatIdentityId(process.result.identityId)}
              </Text>
            </div>
            <div>
              <Text strong>置信度:</Text>
              <Tag color={getConfidenceColor(process.result.confidence)}>
                {getConfidenceText(process.result.confidence)} ({Math.round(process.result.confidence * 100)}%)
              </Tag>
            </div>
            <div>
              <Text strong>处理时间:</Text>
              <Text>{formatProcessingTime(process.result.metadata.processingTime)}</Text>
            </div>
            <div>
              <Text strong>数据质量:</Text>
              <Tag color={process.result.metadata.dataQuality === 'high' ? 'green' :
                           process.result.metadata.dataQuality === 'medium' ? 'orange' : 'red'}>
                {process.result.metadata.dataQuality === 'high' ? '高质量' :
                 process.result.metadata.dataQuality === 'medium' ? '中等质量' : '低质量'}
              </Tag>
            </div>
          </Space>
        </div>
      )}

      {/* 详细信息 */}
      {showDetails && (
        <div style={{ marginTop: 16 }}>
          <Button
            type="link"
            onClick={() => setExpanded(!expanded)}
            style={{ padding: 0, marginBottom: 8 }}
          >
            {expanded ? '收起详情' : '展开详情'}
          </Button>
          {expanded && (
            <div>
              <Divider />
              <Title level={5}>详细信息</Title>

              {/* 文件信息 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>文件信息:</Text>
                <div style={{ marginLeft: 16 }}>
                  <div>文件名: {process.credentialFile.name}</div>
                  <div>文件大小: {(process.credentialFile.size / 1024).toFixed(2)} KB</div>
                  <div>文件类型: {process.credentialFile.type}</div>
                </div>
              </div>

              {/* 配置信息 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>生成配置:</Text>
                <div style={{ marginLeft: 16 }}>
                  <div>前缀: {process.config.prefix}</div>
                  <div>使用UUID: {process.config.useUUID ? '是' : '否'}</div>
                  <div>哈希算法: {process.config.hashAlgorithm}</div>
                  <div>置信度阈值: {Math.round(process.config.confidenceThreshold * 100)}%</div>
                </div>
              </div>

              {/* 步骤详情 */}
              <div>
                <Text strong>步骤详情:</Text>
                <div style={{ marginLeft: 16 }}>
                  {process.steps.map((step: any, index: number) => (
                    <div key={step.id} style={{ marginBottom: 8 }}>
                      {renderStepDetails(step)}
                    </div>
                  ))}
                </div>
              </div>

              {/* 时间信息 */}
              {process.startedAt && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>时间信息:</Text>
                  <div style={{ marginLeft: 16 }}>
                    <div>开始时间: {new Date(process.startedAt).toLocaleString()}</div>
                    {process.completedAt && (
                      <>
                        <div>完成时间: {new Date(process.completedAt).toLocaleString()}</div>
                        <div>总耗时: {formatDuration(process.startedAt, process.completedAt)}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default GenerationProcessTracker;