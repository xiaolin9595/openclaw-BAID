import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Alert,
  Space,
  Typography,
  Tag,
  Divider,
  Row,
  Col,
  Steps,
  Spin,
  Switch,
  Progress,
  message
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import {
  IdentityContract,
  ContractRegistrationForm,
  ContractRegistrationResult,
  IdentityCredential,
  BlockchainUser as User
} from '../../types/blockchain';
import { useIdentityStore } from '../../store/identityStore';
import {
  ZKKYCProof,
  ZKProofGenerationConfig,
  GeneratedIdentity
} from '../../types/identity';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;
const { Option } = Select;

// Mock identity credentials data
const MOCK_IDENTITY_CREDENTIALS: IdentityCredential[] = [
  {
    id: 'cred_001',
    name: '张三的身份证',
    type: 'id_card',
    fileUrl: '/mock/id_card_zhangsan.jpg',
    uploadDate: new Date('2024-01-15'),
    verified: true,
    verificationScore: 95
  },
  {
    id: 'cred_002',
    name: '李四的护照',
    type: 'passport',
    fileUrl: '/mock/passport_lisi.pdf',
    uploadDate: new Date('2024-02-20'),
    verified: true,
    verificationScore: 98
  },
  {
    id: 'cred_003',
    name: '王五的驾驶证',
    type: 'driver_license',
    fileUrl: '/mock/driver_license_wangwu.jpg',
    uploadDate: new Date('2024-03-10'),
    verified: false
  },
  {
    id: 'cred_004',
    name: '某科技公司营业执照',
    type: 'business_license',
    fileUrl: '/mock/business_license_tech.pdf',
    uploadDate: new Date('2024-01-30'),
    verified: true,
    verificationScore: 92
  }
];

// Mock users data
const MOCK_USERS: User[] = [
  {
    id: 'user_001',
    name: '张三',
    email: 'zhangsan@example.com',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    createdAt: new Date('2024-01-10'),
    status: 'active'
  },
  {
    id: 'user_002',
    name: '李四',
    email: 'lisi@example.com',
    walletAddress: '0x2345678901bcdef2345678901bcdef23456789',
    createdAt: new Date('2024-02-15'),
    status: 'active'
  },
  {
    id: 'user_003',
    name: '王五',
    email: 'wangwu@example.com',
    walletAddress: '0x3456789012cdefg3456789012cdefg34567890',
    createdAt: new Date('2024-03-05'),
    status: 'inactive'
  },
  {
    id: 'user_004',
    name: '赵六',
    email: 'zhaoliu@example.com',
    walletAddress: '0x4567890123defgh4567890123defgh45678901',
    createdAt: new Date('2024-03-12'),
    status: 'active'
  }
];

const IDENTITY_TYPES = [
  '个人身份',
  '企业身份',
  '开发者身份',
  '机构身份',
  '设备身份'
];

const PREDEFINED_TAGS = [
  'KYC验证',
  '企业认证',
  '开发者',
  '高级用户',
  '实名认证',
  '多因素认证'
];

interface IdentityContractRegistrationProps {
  onSuccess?: (contract: IdentityContract) => void;
  onError?: (error: string) => void;
}

export const IdentityContractRegistration: React.FC<IdentityContractRegistrationProps> = ({
  onSuccess,
  onError
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationResult, setRegistrationResult] = useState<ContractRegistrationResult | null>(null);
  const [registrationValues, setRegistrationValues] = useState<ContractRegistrationForm | null>(null);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentTimeout, setDeploymentTimeout] = useState<NodeJS.Timeout | null>(null);

  // ZK-KYC相关状态
  const [zkConfig, setZkConfig] = useState<ZKProofGenerationConfig>({
    proofType: 'comprehensive_kyc',
    securityLevel: 'medium',
    validityPeriod: 365,
    includeDetailedInfo: true
  });
  const [selectedIdentity, setSelectedIdentity] = useState<GeneratedIdentity | null>(null);
  const [zkProof, setZkProof] = useState<ZKKYCProof | null>(null);
  const [showZKConfig, setShowZKConfig] = useState(false);

  // 从identityStore获取状态和方法
  const {
    identities,
    currentZKProcess,
    zkGenerating,
    generateZKProof,
    getZKProofsByIdentity,
    setZKProofConfig
  } = useIdentityStore();

  const deployContract = async (values: ContractRegistrationForm) => {
    setLoading(true);
    setDeploymentProgress(0);
    setCurrentStep(2);
    let activeTimeout: NodeJS.Timeout | null = null;

    try {
      // 清理之前的超时定时器
      if (deploymentTimeout) {
        clearTimeout(deploymentTimeout);
        setDeploymentTimeout(null);
      }

      // 设置超时处理
      const timeout = setTimeout(() => {
        message.warning('部署超时，请检查网络连接或稍后重试');
        setCurrentStep(0);
        setLoading(false);
        setDeploymentProgress(0);
      }, 30000); // 30秒超时
      activeTimeout = timeout;
      setDeploymentTimeout(timeout);

      // 模拟合约注册过程
      const result = await simulateContractRegistration(values, setDeploymentProgress);
      setRegistrationResult(result);

      // 清除超时定时器
      clearTimeout(timeout);
      activeTimeout = null;
      setDeploymentTimeout(null);

      if (result.success) {
        message.success('身份合约注册成功！');
        setCurrentStep(3);

        // 查找选中的身份凭证和用户
        const selectedCredential = MOCK_IDENTITY_CREDENTIALS.find(cred => cred.id === values.identityCredential);
        const selectedUser = MOCK_USERS.find(user => user.id === values.userId);

        // 创建合约对象
        const contract: IdentityContract = {
          id: `contract_${Date.now()}`,
          contractAddress: result.contractAddress || generateContractAddress(),
          contractName: values.contractName,
          ownerAddress: selectedUser?.walletAddress || generateWalletAddress(),
          identityHash: generateIdentityHash(),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
          metadata: {
            identityType: values.identityType,
            identityCredential: selectedCredential || MOCK_IDENTITY_CREDENTIALS[0],
            userId: values.userId,
            tags: [...values.tags, ...customTags, 'ZK-KYC验证'],
            description: values.description,
            zkProof: zkProof ? {
              proofId: zkProof.id,
              proofType: zkProof.proofType,
              verificationStatus: zkProof.verificationStatus,
              confidence: zkProof.confidence,
              generatedAt: zkProof.metadata.generatedAt
            } : undefined
          },
          blockchain: {
            network: 'Ethereum Testnet',
            blockNumber: result.blockNumber || Math.floor(Math.random() * 1000000),
            transactionHash: result.transactionHash || generateTransactionHash(),
            gasUsed: result.gasUsed || Math.floor(Math.random() * 100000) + 50000
          }
        };

        onSuccess?.(contract);
      } else {
        message.error(result.error || '合约注册失败');
        onError?.(result.error || '合约注册失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
      setDeploymentProgress(0);
      if (activeTimeout) {
        clearTimeout(activeTimeout);
      }
      setDeploymentTimeout(null);
    }
  };

  const handleSubmit = async (values: ContractRegistrationForm) => {
    setRegistrationValues(values);

    // 如果选择了ZK身份凭证但还没有生成ZK证明，先进入ZK-KYC证明步骤
    if (!zkProof && selectedIdentity) {
      setCurrentStep(1);
      return;
    }

    await deployContract(values);
  };

  const handleTagChange = (tags: string[]) => {
    const newCustomTags = tags.filter(tag => !PREDEFINED_TAGS.includes(tag));
    setCustomTags(newCustomTags);
  };

  const resetForm = () => {
    form.resetFields();
    setRegistrationResult(null);
    setRegistrationValues(null);
    setCurrentStep(0);
    setCustomTags([]);
    setZkProof(null);
    setSelectedIdentity(null);
    setShowZKConfig(false);
    setDeploymentProgress(0);
    if (deploymentTimeout) {
      clearTimeout(deploymentTimeout);
      setDeploymentTimeout(null);
    }
  };

  // ZK-KYC相关处理函数
  const handleGenerateZKProof = async () => {
    if (!selectedIdentity) {
      message.error('请先选择身份凭证');
      return;
    }

    try {
      await generateZKProof(selectedIdentity.identityId, zkConfig);
      message.success('ZK-KYC证明生成成功！');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ZK-KYC证明生成失败');
    }
  };

  const handleIdentitySelect = (identityId: string) => {
    const identity = identities.find(id => id.identityId === identityId);
    setSelectedIdentity(identity || null);

    // 清除之前的ZK证明
    setZkProof(null);

    // 检查是否已有ZK证明
    if (identity) {
      const existingProofs = getZKProofsByIdentity(identity.identityId);
      if (existingProofs.length > 0) {
        setZkProof(existingProofs[0]); // 使用最新的证明
      }
    }
  };

  const handleZKConfigChange = (
    key: keyof ZKProofGenerationConfig,
    value: ZKProofGenerationConfig[keyof ZKProofGenerationConfig]
  ) => {
    const newConfig = { ...zkConfig, [key]: value };
    setZkConfig(newConfig);
    setZKProofConfig(newConfig);
  };

  // 监听ZK证明生成过程
  React.useEffect(() => {
    if (currentZKProcess && currentZKProcess.status === 'completed' && currentZKProcess.result) {
      setZkProof(currentZKProcess.result);
    }
  }, [currentZKProcess]);

  // 清理超时定时器
  React.useEffect(() => {
    return () => {
      if (deploymentTimeout) {
        clearTimeout(deploymentTimeout);
      }
    };
  }, [deploymentTimeout]);

  const getStepStatus = (step: number) => {
    if (currentStep > step) return 'finish';
    if (currentStep === step) return 'process';
    return 'wait';
  };

  return (
    <Card title="用户身份合约注册" className="h-full">
      <div className="mb-6">
        <Steps current={currentStep} size="small">
          <Step
            title="填写信息"
            status={getStepStatus(0)}
            icon={<FileTextOutlined />}
          />
          <Step
            title="ZK-KYC证明"
            status={getStepStatus(1)}
            icon={<LoadingOutlined />}
          />
          <Step
            title="部署合约"
            status={getStepStatus(2)}
            icon={<LoadingOutlined />}
          />
          <Step
            title="完成注册"
            status={getStepStatus(3)}
            icon={<CheckCircleOutlined />}
          />
        </Steps>
      </div>

      {currentStep === 0 && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            identityType: '个人身份',
            identityCredential: MOCK_IDENTITY_CREDENTIALS[0]?.id || '',
            userId: MOCK_USERS[0]?.id || '',
            tags: [],
            description: ''
          }}
        >
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="合约名称"
                name="contractName"
                rules={[
                  { required: true, message: '请输入合约名称' },
                  { min: 3, message: '合约名称至少3个字符' },
                  { max: 50, message: '合约名称最多50个字符' }
                ]}
              >
                <Input
                  prefix={<FileTextOutlined />}
                  placeholder="例如：我的身份合约"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="身份类型"
                name="identityType"
                rules={[{ required: true, message: '请选择身份类型' }]}
              >
                <Select placeholder="选择身份类型">
                  {IDENTITY_TYPES.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="身份凭证"
                name="identityCredential"
                rules={[{ required: true, message: '请选择身份凭证' }]}
              >
                <Select placeholder="选择身份凭证">
                  {MOCK_IDENTITY_CREDENTIALS.map(credential => (
                    <Option key={credential.id} value={credential.id}>
                      <div>
                        <div className="font-medium">{credential.name}</div>
                        <div className="text-xs text-gray-500">
                          {credential.type === 'id_card' && '身份证'}
                          {credential.type === 'passport' && '护照'}
                          {credential.type === 'driver_license' && '驾驶证'}
                          {credential.type === 'business_license' && '营业执照'}
                          {credential.type === 'certificate' && '证书'}
                          {credential.verified && (
                            <Tag color="success" className="ml-2">已验证</Tag>
                          )}
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="关联用户"
                name="userId"
                rules={[{ required: true, message: '请选择用户' }]}
              >
                <Select placeholder="选择用户">
                  {MOCK_USERS.map(user => (
                    <Option key={user.id} value={user.id}>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-gray-500">
                          {user.email}
                          {user.status === 'active' && (
                            <Tag color="success" className="ml-2">活跃</Tag>
                          )}
                          {user.status === 'inactive' && (
                            <Tag color="default" className="ml-2">未激活</Tag>
                          )}
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label="标签"
                name="tags"
              >
                <Select
                  mode="tags"
                  placeholder="选择或输入标签"
                  style={{ width: '100%' }}
                  onChange={handleTagChange}
                >
                  {PREDEFINED_TAGS.map(tag => (
                    <Option key={tag} value={tag}>{tag}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label="描述"
                name="description"
              >
                <TextArea
                  rows={4}
                  placeholder="描述此身份合约的用途和特点..."
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </Col>

            {/* ZK-KYC身份凭证选择 */}
            <Col span={24}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Text strong>ZK-KYC身份凭证</Text>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setShowZKConfig(!showZKConfig)}
                  >
                    {showZKConfig ? '收起配置' : '展开配置'}
                  </Button>
                </div>

                <Select
                  placeholder="选择身份凭证用于ZK-KYC证明"
                  style={{ width: '100%' }}
                  onChange={handleIdentitySelect}
                  value={selectedIdentity?.identityId}
                >
                  {identities.map(identity => (
                    <Option key={identity.identityId} value={identity.identityId}>
                      <div>
                        <div className="font-medium">{identity.identityId}</div>
                        <div className="text-xs text-gray-500">
                          {identity.credentialData.name} - {identity.credentialData.type}
                          <Tag color="blue" className="ml-2">
                            置信度: {(identity.confidence * 100).toFixed(1)}%
                          </Tag>
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* ZK-KYC配置面板 */}
              {showZKConfig && (
                <Card size="small" className="mb-4">
                  <Space direction="vertical" className="w-full">
                    <div>
                      <Text strong>证明类型</Text>
                      <Select
                        style={{ width: '100%', marginTop: 4 }}
                        value={zkConfig.proofType}
                        onChange={(value) => handleZKConfigChange('proofType', value)}
                      >
                        <Option value="age_verification">年龄验证</Option>
                        <Option value="nationality_verification">国籍验证</Option>
                        <Option value="document_validity">证件有效性</Option>
                        <Option value="comprehensive_kyc">综合KYC</Option>
                      </Select>
                    </div>

                    <Row gutter={16}>
                      <Col span={12}>
                        <div>
                          <Text strong>安全级别</Text>
                          <Select
                            style={{ width: '100%', marginTop: 4 }}
                            value={zkConfig.securityLevel}
                            onChange={(value) => handleZKConfigChange('securityLevel', value)}
                          >
                            <Option value="low">低</Option>
                            <Option value="medium">中</Option>
                            <Option value="high">高</Option>
                          </Select>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div>
                          <Text strong>有效期（天）</Text>
                          <Input
                            type="number"
                            style={{ marginTop: 4 }}
                            value={zkConfig.validityPeriod}
                            onChange={(e) => handleZKConfigChange('validityPeriod', parseInt(e.target.value) || 365)}
                          />
                        </div>
                      </Col>
                    </Row>

                    <div>
                      <Text strong>包含详细信息</Text>
                      <Switch
                        style={{ marginLeft: 8 }}
                        checked={zkConfig.includeDetailedInfo}
                        onChange={(checked) => handleZKConfigChange('includeDetailedInfo', checked)}
                      />
                    </div>

                    {selectedIdentity && (
                      <div className="mt-4">
                        <Button
                          type="primary"
                          loading={zkGenerating}
                          onClick={handleGenerateZKProof}
                          disabled={!selectedIdentity}
                        >
                          {zkGenerating ? '生成中...' : '生成ZK-KYC证明'}
                        </Button>
                      </div>
                    )}
                  </Space>
                </Card>
              )}

              {/* ZK证明状态显示 */}
              {zkProof && (
                <Alert
                  message="ZK-KYC证明已生成"
                  description={`证明类型: ${zkProof.proofType}, 置信度: ${(zkProof.confidence * 100).toFixed(1)}%`}
                  type="success"
                  showIcon
                  className="mb-4"
                />
              )}

              {currentZKProcess && currentZKProcess.status === 'generating' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Text>正在生成ZK-KYC证明...</Text>
                    <Text type="secondary">{(currentZKProcess.progress * 100).toFixed(0)}%</Text>
                  </div>
                  <Progress percent={currentZKProcess.progress * 100} size="small" />
                  <div className="mt-2">
                    <Text type="secondary">
                      {currentZKProcess.steps[currentZKProcess.currentStep]?.name}
                    </Text>
                  </div>
                </div>
              )}
            </Col>
          </Row>

          <div className="flex justify-end space-x-4">
            <Button onClick={resetForm}>
              重置
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<UserOutlined />}
            >
              注册合约
            </Button>
          </div>
        </Form>
      )}

      {currentStep === 1 && (
        <div className="py-8">
          <Title level={4} className="text-center mb-6">ZK-KYC证明生成</Title>

          {!selectedIdentity ? (
            <Alert
              message="请选择身份凭证"
              description="请返回第一步选择身份凭证以生成ZK-KYC证明"
              type="warning"
              showIcon
              className="mb-4"
            />
          ) : (
            <div>
              <Card size="small" className="mb-4">
                <Space direction="vertical" className="w-full">
                  <div>
                    <Text strong>选中的身份凭证:</Text>
                    <div className="mt-1">
                      <Text>{selectedIdentity.identityId}</Text>
                      <div className="text-sm text-gray-500">
                        {selectedIdentity.credentialData.name} - {selectedIdentity.credentialData.type}
                      </div>
                    </div>
                  </div>

                  {!zkProof ? (
                    <div className="text-center">
                      <Button
                        type="primary"
                        size="large"
                        loading={zkGenerating}
                        onClick={handleGenerateZKProof}
                        className="mb-4"
                      >
                        {zkGenerating ? '生成中...' : '生成ZK-KYC证明'}
                      </Button>
                      <div>
                        <Text type="secondary">
                          点击按钮开始生成零知识KYC证明
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <Alert
                      message="ZK-KYC证明已生成"
                      description={
                        <div>
                          <div>证明类型: {zkProof.proofType}</div>
                          <div>置信度: {(zkProof.confidence * 100).toFixed(1)}%</div>
                          <div>验证状态: {zkProof.verificationStatus === 'verified' ? '已验证' : '待验证'}</div>
                          <div>有效期至: {new Date(zkProof.metadata.expiresAt).toLocaleDateString()}</div>
                        </div>
                      }
                      type="success"
                      showIcon
                    />
                  )}

                  {currentZKProcess && currentZKProcess.status === 'generating' && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Text>正在生成ZK-KYC证明...</Text>
                        <Text type="secondary">{(currentZKProcess.progress * 100).toFixed(0)}%</Text>
                      </div>
                      <Progress percent={currentZKProcess.progress * 100} />
                      <div className="mt-2">
                        <Text type="secondary">
                          {currentZKProcess.steps[currentZKProcess.currentStep]?.name}
                        </Text>
                      </div>
                    </div>
                  )}
                </Space>
              </Card>

              <div className="flex justify-center space-x-4">
                <Button onClick={() => setCurrentStep(0)}>
                  返回上一步
                </Button>
                <Button
                  type="primary"
                  onClick={async () => {
                    const values = registrationValues || await form.validateFields();
                    setRegistrationValues(values);
                    await deployContract(values);
                  }}
                  disabled={!zkProof}
                  loading={loading}
                >
                  下一步：部署合约
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Title level={4}>正在部署身份合约...</Title>
            <Paragraph type="secondary">
              请稍候，系统正在区块链上部署您的身份合约
            </Paragraph>

            {deploymentProgress > 0 && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <Text>部署进度</Text>
                  <Text type="secondary">{deploymentProgress.toFixed(0)}%</Text>
                </div>
                <Progress percent={deploymentProgress} size="small" className="mb-2" />
                <Text type="secondary" className="text-sm">
                  {deploymentProgress < 33 && '初始化合约参数...'}
                  {deploymentProgress >= 33 && deploymentProgress < 66 && '发送交易到网络...'}
                  {deploymentProgress >= 66 && deploymentProgress < 100 && '验证合约部署...'}
                </Text>
              </div>
            )}

                      </div>
        </div>
      )}

      {currentStep === 3 && registrationResult && (
        <div>
          <Alert
            message="合约注册成功"
            description="您的身份合约已成功部署到区块链上"
            type="success"
            showIcon
            className="mb-4"
          />

          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card size="small" title="合约信息">
                <Space direction="vertical" className="w-full">
                  <div>
                    <Text type="secondary">合约地址:</Text>
                    <div className="font-mono text-sm break-all">
                      {registrationResult.contractAddress}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary">交易哈希:</Text>
                    <div className="font-mono text-sm break-all">
                      {registrationResult.transactionHash}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary">区块号:</Text>
                    <Text> #{registrationResult.blockNumber}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Gas消耗:</Text>
                    <Text> {registrationResult.gasUsed?.toLocaleString()}</Text>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col span={8}>
              <Card size="small" title="网络信息">
                <Space direction="vertical" className="w-full">
                  <div>
                    <Text type="secondary">网络:</Text>
                    <Tag color="blue">Ethereum Testnet</Tag>
                  </div>
                  <div>
                    <Text type="secondary">状态:</Text>
                    <Tag color="success">活跃</Tag>
                  </div>
                  <div>
                    <Text type="secondary">确认数:</Text>
                    <Text> 12/12 确认</Text>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col span={8}>
              <Card size="small" title="ZK-KYC证明">
                <Space direction="vertical" className="w-full">
                  {zkProof ? (
                    <>
                      <div>
                        <Text type="secondary">证明类型:</Text>
                        <Text> {zkProof.proofType}</Text>
                      </div>
                      <div>
                        <Text type="secondary">验证状态:</Text>
                        <Tag color={zkProof.verificationStatus === 'verified' ? 'success' : 'warning'}>
                          {zkProof.verificationStatus === 'verified' ? '已验证' : '待验证'}
                        </Tag>
                      </div>
                      <div>
                        <Text type="secondary">置信度:</Text>
                        <Text> {(zkProof.confidence * 100).toFixed(1)}%</Text>
                      </div>
                      <div>
                        <Text type="secondary">有效期至:</Text>
                        <Text> {new Date(zkProof.metadata.expiresAt).toLocaleDateString()}</Text>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <Text type="secondary">未生成ZK-KYC证明</Text>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          <Divider />

          <div className="flex justify-center space-x-4">
            <Button onClick={resetForm}>
              注册新合约
            </Button>
            <Button type="primary">
              查看合约详情
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

// 辅助函数
async function simulateContractRegistration(
  values: ContractRegistrationForm,
  progressCallback?: (progress: number) => void
): Promise<ContractRegistrationResult> {
  // 瞬时部署，无延迟
  progressCallback?.(33);
  await new Promise(resolve => setTimeout(resolve, 5));
  progressCallback?.(66);
  await new Promise(resolve => setTimeout(resolve, 5));
  progressCallback?.(100);

  return {
    success: true,
    contractAddress: generateContractAddress(),
    transactionHash: generateTransactionHash(),
    blockNumber: Math.floor(Math.random() * 1000000),
    gasUsed: Math.floor(Math.random() * 100000) + 50000
  };
}

function generateContractAddress(): string {
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateWalletAddress(): string {
  return generateContractAddress();
}

function generateTransactionHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateIdentityHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
