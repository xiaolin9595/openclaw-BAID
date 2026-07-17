import React from 'react';
import { Card, Alert, Spin, Empty } from 'antd';
import { TaskResult, TaskType, Task } from '../../types/task';
import TaskResultLaptopPurchase from './TaskResultLaptopPurchase';

interface TaskExecutionResultProps {
  task: Task;
  result?: TaskResult;
  loading?: boolean;
  error?: string;
}

/**
 * 通用任务结果展示组件
 * 根据任务类型展示对应的结果组件
 */
const TaskExecutionResult: React.FC<TaskExecutionResultProps> = ({
  task,
  result,
  loading = false,
  error
}) => {
  // 错误状态
  if (error) {
    return (
      <Alert
        message="加载结果失败"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  // 加载状态
  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在加载任务结果...</div>
        </div>
      </Card>
    );
  }

  // 无结果状态
  if (!result) {
    return (
      <Card>
        <Empty
          description="暂无执行结果"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  // 根据任务类型渲染对应的结果组件
  const renderTaskResult = () => {
    switch (task.type) {
      case TaskType.LAPTOP_PURCHASE:
        return (
          <TaskResultLaptopPurchase
            result={result}
            loading={loading}
          />
        );

      case TaskType.DATA_PROCESSING:
      case TaskType.CONTENT_GENERATION:
      case TaskType.ANALYSIS:
      case TaskType.AUTOMATION:
      case TaskType.COMMUNICATION:
      case TaskType.SECURITY:
      case TaskType.RESEARCH:
      case TaskType.MONITORING:
      default:
        // 通用结果展示组件（暂时使用简单的JSON显示）
        return (
          <Card title="任务执行结果">
            {result.success ? (
              <Alert
                message="任务执行成功"
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                message="任务执行失败"
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {result.summary && (
              <div style={{ marginBottom: 16 }}>
                <h4>执行摘要</h4>
                <p>{result.summary}</p>
              </div>
            )}

            {result.data && (
              <div style={{ marginBottom: 16 }}>
                <h4>结果数据</h4>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  maxHeight: 400,
                  overflow: 'auto'
                }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}

            {result.output && (
              <div style={{ marginBottom: 16 }}>
                <h4>输出内容</h4>
                <div>
                  <strong>类型:</strong> {result.output.type} ({result.output.format})
                </div>
                <pre style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  maxHeight: 300,
                  overflow: 'auto',
                  marginTop: 8
                }}>
                  {typeof result.output.content === 'string'
                    ? result.output.content
                    : JSON.stringify(result.output.content, null, 2)}
                </pre>
              </div>
            )}

            {result.metrics && (
              <div>
                <h4>执行指标</h4>
                <div style={{ fontSize: 12, color: '#666' }}>
                  执行时间: {Math.round((result.metrics.executionTime || 0) / 1000)}秒 |
                  内存使用: {result.metrics.memoryUsed || 0}MB |
                  CPU使用: {result.metrics.cpuUsage || 0}% |
                  网络调用: {result.metrics.networkCalls || 0}次 |
                  处理数据: {result.metrics.dataProcessed || 0}条
                </div>
              </div>
            )}
          </Card>
        );
    }
  };

  return (
    <div>
      {renderTaskResult()}
    </div>
  );
};

export default TaskExecutionResult;