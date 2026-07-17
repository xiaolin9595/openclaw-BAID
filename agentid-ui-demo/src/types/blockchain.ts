export interface Transaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  gasUsed: number;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  type: 'user_registration' | 'agent_registration' | 'agent_update' | 'authentication';
  value?: string;
  nonce: number;
}

export interface Contract {
  address: string;
  type: 'user' | 'agent';
  owner: string;
  createdAt: string;
  status: 'active' | 'inactive';
  balance?: string;
}

export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
  difficulty?: string;
  size: number;
}

export interface ZKProof {
  proof: string;
  publicInputs: string[];
  verificationKey: string;
  gasEstimate: number;
  confidence: number;
}

export interface ContractCall {
  contractAddress: string;
  methodName: string;
  parameters: any[];
  gasLimit?: number;
  value?: string;
}

export interface BlockchainStats {
  totalBlocks: number;
  totalTransactions: number;
  totalContracts: number;
  averageGasPrice: number;
  networkStatus: 'healthy' | 'congested' | 'down';
}

export interface IdentityCredential {
  id: string;
  name: string;
  type: 'id_card' | 'passport' | 'driver_license' | 'business_license' | 'certificate';
  fileUrl: string;
  uploadDate: Date;
  verified: boolean;
  verificationScore?: number;
}

export interface BlockchainUser {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  createdAt: Date;
  status: 'active' | 'inactive' | 'suspended';
}

export interface IdentityContract {
  id: string;
  contractAddress: string;
  contractName: string;
  ownerAddress: string;
  identityHash: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  metadata: {
    identityType: string;
    identityCredential: IdentityCredential;
    userId: string;
    tags: string[];
    description?: string;
    zkProof?: {
      proofId: string;
      proofType: string;
      verificationStatus: string;
      confidence: number;
      generatedAt: string;
    };
  };
  blockchain: {
    network: string;
    blockNumber: number;
    transactionHash: string;
    gasUsed: number;
  };
}

export interface ContractRegistrationForm {
  contractName: string;
  identityType: string;
  identityCredential: string;
  userId: string;
  description: string;
  tags: string[];
}

export interface ContractRegistrationResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  error?: string;
}

export type ContractStatus = IdentityContract['status'];

// Agent相关类型定义
export type BlockchainAgentType = 'AI Assistant' | 'Chatbot' | 'Automation' | 'Data Processing' | 'Content Generation' | 'Analysis' | 'Security';

export type AgentCapability = '私人助理' | '购物助理' | '生活助理' | '健康助理' | '学习助理' | '工作助理' | '旅行助理' | '财务助理' | '娱乐助理' | '客服助理';

export type AgentContractPermission = 'read-only' | 'read-write' | 'admin';

export interface BlockchainAgent {
  id: string;
  name: string;
  type: BlockchainAgentType;
  capabilities: AgentCapability[];
  description: string;
  version: string;
  model: string;
  apiEndpoint: string;
  status: 'active' | 'inactive' | 'development' | 'deprecated';
  createdAt: Date;
  updatedAt: Date;
  owner: string;
}

export interface AgentIdentityContract {
  id: string;
  contractAddress: string;
  contractName: string;
  ownerAddress: string;
  agentId: string;
  agentInfo: BlockchainAgent;
  permissions: AgentContractPermission;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  metadata: {
    tags: string[];
    description?: string;
    securityLevel: 'low' | 'medium' | 'high';
    compliance: string[];
  };
  blockchain: {
    network: string;
    blockNumber: number;
    transactionHash: string;
    gasUsed: number;
  };
}

export interface AgentContractRegistrationForm {
  contractName: string;
  agentId: string;
  agentType: BlockchainAgentType;
  capabilities: AgentCapability[];
  permissions: AgentContractPermission;
  apiEndpoint: string;
  version: string;
  model: string;
  description: string;
  tags: string[];
  securityLevel: 'low' | 'medium' | 'high';
}

export interface AgentContractRegistrationResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  error?: string;
}

export type AgentContractStatus = AgentIdentityContract['status'];

// Mock数据类型
export interface MockAgent {
  id: string;
  name: string;
  type: BlockchainAgentType;
  capabilities: AgentCapability[];
  description: string;
  version: string;
  model: string;
  apiEndpoint: string;
  status: BlockchainAgent['status'];
  owner: string;
}
