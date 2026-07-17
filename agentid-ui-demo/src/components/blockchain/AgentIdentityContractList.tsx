import React, { useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Tooltip,
  Badge,
  Popconfirm,
  message,
  Switch
} from 'antd';
import {
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ApiOutlined,
  SecurityScanOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { AgentIdentityContract } from '../../types/blockchain';

const { Text, Paragraph } = Typography;

interface AgentIdentityContractListProps {
  contracts: AgentIdentityContract[];
  loading?: boolean;
  onViewContract?: (contract: AgentIdentityContract) => void;
  onEditContract?: (contract: AgentIdentityContract) => void;
  onDeleteContract?: (contractId: string) => void;
  onUpdateContractStatus?: (contractId: string, status: AgentIdentityContract['status']) => void;
}

export const AgentIdentityContractList: React.FC<AgentIdentityContractListProps> = ({
  contracts,
  loading = false,
  onViewContract,
  onEditContract,
  onDeleteContract,
  onUpdateContractStatus
}) => {
  const getStatusColor = (status: AgentIdentityContract['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'error';
      case 'terminated':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: AgentIdentityContract['status']) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'pending':
        return '待确认';
      case 'suspended':
        return '暂停';
      case 'terminated':
        return '终止';
      default:
        return '未知';
    }
  };

  const getStatusIcon = (status: AgentIdentityContract['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleOutlined />;
      case 'pending':
        return <ClockCircleOutlined />;
      case 'suspended':
        return <StopOutlined />;
      case 'terminated':
        return <ExclamationCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const getPermissionColor = (permission: AgentIdentityContract['permissions']) => {
    switch (permission) {
      case 'admin':
        return 'red';
      case 'read-write':
        return 'orange';
      case 'read-only':
        return 'green';
      default:
        return 'default';
    }
  };

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getSecurityLevelText = (level: string) => {
    switch (level) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return level;
    }
  };

  const handleStatusChange = async (contractId: string, checked: boolean) => {
    const newStatus = checked ? 'active' : 'suspended';
    if (onUpdateContractStatus) {
      try {
        await onUpdateContractStatus(contractId, newStatus);
        message.success(`合约状态已更新为${checked ? '活跃' : '暂停'}`);
      } catch (error) {
        message.error('状态更新失败');
      }
    }
  };

  const handleDelete = async (contractId: string) => {
    if (onDeleteContract) {
      try {
        await onDeleteContract(contractId);
        message.success('合约删除成功');
      } catch (error) {
        message.error('合约删除失败');
      }
    }
  };

  const columns = [
    {
      title: 'Agent信息',
      key: 'agentInfo',
      width: 300,
      render: (_: any, record: AgentIdentityContract) => (
        <div>
          <div className="flex items-center mb-2">
            <RobotOutlined className="mr-2 text-blue-500" />
            <Text strong>{record.agentInfo.name}</Text>
            <Badge
              status={record.agentInfo.status === 'active' ? 'success' : 'processing'}
              text={record.agentInfo.status === 'active' ? '活跃' : '开发中'}
              className="ml-2"
            />
          </div>
          <div className="text-sm text-gray-600">
            <div>类型: {record.agentInfo.type}</div>
            <div>模型: {record.agentInfo.model}</div>
            <div>版本: {record.agentInfo.version}</div>
          </div>
          <div className="mt-2">
            <Tag color={getPermissionColor(record.permissions)} className="mr-1">
              {record.permissions}
            </Tag>
            <Tag color={getSecurityLevelColor(record.metadata.securityLevel)}>
              {getSecurityLevelText(record.metadata.securityLevel)}安全级别
            </Tag>
          </div>
        </div>
      )
    },
    {
      title: '合约信息',
      key: 'contractInfo',
      width: 250,
      render: (_: any, record: AgentIdentityContract) => (
        <div>
          <div className="mb-2">
            <Text strong>{record.contractName}</Text>
          </div>
          <div className="text-sm text-gray-600">
            <div className="font-mono text-xs break-all mb-1">
              {record.contractAddress}
            </div>
            <div>创建时间: {new Date(record.createdAt).toLocaleDateString()}</div>
            <div>Gas消耗: {record.blockchain.gasUsed.toLocaleString()}</div>
          </div>
        </div>
      )
    },
    {
      title: '扮演角色',
      key: 'capabilities',
      width: 200,
      render: (_: any, record: AgentIdentityContract) => (
        <div>
          {record.agentInfo.capabilities.slice(0, 3).map(capability => (
            <Tag key={capability} color="blue" className="mb-1">
              {capability}
            </Tag>
          ))}
          {record.agentInfo.capabilities.length > 3 && (
            <Tooltip title={record.agentInfo.capabilities.slice(3).join(', ')}>
              <Tag color="blue">+{record.agentInfo.capabilities.length - 3}</Tag>
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: AgentIdentityContract) => (
        <Space direction="vertical">
          <Tag color={getStatusColor(record.status)} icon={getStatusIcon(record.status)}>
            {getStatusText(record.status)}
          </Tag>
          {record.status !== 'terminated' && (
            <div className="flex items-center">
              <Text className="mr-2">启用:</Text>
              <Switch
                checked={record.status === 'active'}
                onChange={(checked) => handleStatusChange(record.id, checked)}
                size="small"
              />
            </div>
          )}
        </Space>
      )
    },
    {
      title: 'API端点',
      key: 'apiEndpoint',
      width: 200,
      render: (_: any, record: AgentIdentityContract) => (
        <Tooltip title={record.agentInfo.apiEndpoint}>
          <div className="flex items-center">
            <ApiOutlined className="mr-2 text-green-500" />
            <Text className="text-sm font-mono break-all">
              {record.agentInfo.apiEndpoint.length > 30
                ? `${record.agentInfo.apiEndpoint.substring(0, 30)}...`
                : record.agentInfo.apiEndpoint
              }
            </Text>
          </div>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: AgentIdentityContract) => (
        <Space size="small">
          {onViewContract && (
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onViewContract(record)}
              />
            </Tooltip>
          )}
          {onEditContract && (
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEditContract(record)}
              />
            </Tooltip>
          )}
          {onDeleteContract && (
            <Popconfirm
              title="确定删除此Agent合约？"
              description="此操作不可撤销"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const summary = () => (
    <Table.Summary.Row>
      <Table.Summary.Cell index={0} colSpan={3}>
        <Text strong>总计: {contracts.length} 个Agent合约</Text>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={1}>
        <Space>
          <Badge status="success" text="活跃" />
          <Text>{contracts.filter(c => c.status === 'active').length}</Text>
        </Space>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={2}>
        <Space>
          <Badge status="warning" text="待确认" />
          <Text>{contracts.filter(c => c.status === 'pending').length}</Text>
        </Space>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3}>
        <Space>
          <Badge status="error" text="暂停/终止" />
          <Text>{contracts.filter(c => c.status === 'suspended' || c.status === 'terminated').length}</Text>
        </Space>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4}></Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <Card title="Agent身份合约列表" className="h-full">
      <Table
        columns={columns}
        dataSource={contracts}
        loading={loading}
        rowKey="id"
        pagination={{
          total: contracts.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        scroll={{ x: 1200 }}
        summary={summary}
        size="middle"
      />
    </Card>
  );
};