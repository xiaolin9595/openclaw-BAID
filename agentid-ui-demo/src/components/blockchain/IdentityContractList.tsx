import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Avatar,
  Tooltip,
  Badge,
  Input,
  Select,
  Row,
  Col,
  Modal,
  Descriptions,
  Divider,
  message
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FilterOutlined,
  UserOutlined,
  FileTextOutlined,
  SafetyOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { IdentityContract, ContractStatus } from '../../types/blockchain';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const STATUS_COLORS: Record<ContractStatus, "success" | "error" | "warning" | "processing" | "default"> = {
  pending: 'processing',
  active: 'success',
  suspended: 'warning',
  terminated: 'error'
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  pending: '待确认',
  active: '活跃',
  suspended: '暂停',
  terminated: '终止'
};


interface IdentityContractListProps {
  contracts?: IdentityContract[];
  onViewContract?: (contract: IdentityContract) => void;
  onEditContract?: (contract: IdentityContract) => void;
  onDeleteContract?: (contractId: string) => void;
  loading?: boolean;
}

export const IdentityContractList: React.FC<IdentityContractListProps> = ({
  contracts = [],
  onViewContract,
  onEditContract,
  onDeleteContract,
  loading = false
}) => {
  const [filteredContracts, setFilteredContracts] = useState<IdentityContract[]>(contracts);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContract, setSelectedContract] = useState<IdentityContract | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    filterContracts();
  }, [contracts, searchText, statusFilter]);

  const filterContracts = () => {
    let filtered = contracts;

    // 搜索过滤
    if (searchText) {
      filtered = filtered.filter(contract =>
        contract.contractName.toLowerCase().includes(searchText.toLowerCase()) ||
        contract.contractAddress.toLowerCase().includes(searchText.toLowerCase()) ||
        contract.metadata.identityType.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => contract.status === statusFilter);
    }

    setFilteredContracts(filtered);
  };

  const handleViewContract = (contract: IdentityContract) => {
    setSelectedContract(contract);
    setDetailModalVisible(true);
    onViewContract?.(contract);
  };

  const handleDeleteContract = (contractId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个身份合约吗？此操作不可恢复。',
      onOk: () => {
        onDeleteContract?.(contractId);
        message.success('合约已删除');
      }
    });
  };

  const getStatusBadge = (status: ContractStatus) => (
    <Badge status={STATUS_COLORS[status]} text={STATUS_LABELS[status]} />
  );


  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN');
  };

  const columns: ColumnsType<IdentityContract> = [
    {
      title: '合约名称',
      dataIndex: 'contractName',
      key: 'contractName',
      render: (text: string, record: IdentityContract) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-xs text-gray-500">{record.metadata.identityType}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '合约地址',
      dataIndex: 'contractAddress',
      key: 'contractAddress',
      render: (address: string) => (
        <Tooltip title={address}>
          <Text code>{formatAddress(address)}</Text>
        </Tooltip>
      ),
    },
    {
      title: '验证级别',
      dataIndex: ['metadata', 'verificationLevel'],
      key: 'verificationLevel',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ContractStatus) => getStatusBadge(status),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => formatDate(date),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Gas消耗',
      dataIndex: ['blockchain', 'gasUsed'],
      key: 'gasUsed',
      render: (gas: number) => gas.toLocaleString(),
      sorter: (a, b) => a.blockchain.gasUsed - b.blockchain.gasUsed,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: IdentityContract) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewContract(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEditContract?.(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteContract(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选和搜索 */}
      <Card className="mb-4">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索合约名称、地址或类型"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={filterContracts}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="筛选状态"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="all">全部状态</Option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary">
              共 {filteredContracts.length} 个合约
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 合约列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredContracts}
          rowKey="id"
          loading={loading}
          pagination={{
            total: filteredContracts.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="合约详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedContract && (
          <div>
            <Descriptions bordered column={2} className="mb-4">
              <Descriptions.Item label="合约名称" span={2}>
                <Space>
                  <Avatar icon={<FileTextOutlined />} />
                  <Text strong>{selectedContract.contractName}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="合约地址" span={2}>
                <Text code>{selectedContract.contractAddress}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="所有者地址">
                <Text code>{formatAddress(selectedContract.ownerAddress)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="身份哈希">
                <Text code>{formatAddress(selectedContract.identityHash)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="身份类型">
                {selectedContract.metadata.identityType}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusBadge(selectedContract.status)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(selectedContract.createdAt)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">区块链信息</Divider>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="网络">
                {selectedContract.blockchain.network}
              </Descriptions.Item>
              <Descriptions.Item label="区块号">
                #{selectedContract.blockchain.blockNumber.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="交易哈希" span={2}>
                <Text code>{selectedContract.blockchain.transactionHash}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Gas消耗">
                {selectedContract.blockchain.gasUsed.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="确认数">
                <Badge status="success" text="12/12" />
              </Descriptions.Item>
            </Descriptions>

            {selectedContract.metadata.description && (
              <>
                <Divider orientation="left">描述</Divider>
                <Text>{selectedContract.metadata.description}</Text>
              </>
            )}

            {selectedContract.metadata.tags.length > 0 && (
              <>
                <Divider orientation="left">标签</Divider>
                <Space wrap>
                  {selectedContract.metadata.tags.map((tag, index) => (
                    <Tag key={index}>{tag}</Tag>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};