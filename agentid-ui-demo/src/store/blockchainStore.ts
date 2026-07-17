import { create } from 'zustand';
import {
  IdentityContract,
  ContractRegistrationForm,
  AgentIdentityContract,
  AgentContractRegistrationForm,
  BlockchainAgent,
  MockAgent
} from '../types/blockchain';
import { sharedAgentData } from '../mocks/sharedAgentData';

interface BlockchainState {
  // 状态
  contracts: IdentityContract[];
  agentContracts: AgentIdentityContract[];
  isLoading: boolean;
  error: string | null;
  selectedContract: IdentityContract | null;
  selectedAgentContract: AgentIdentityContract | null;

  // 操作
  registerContract: (formData: ContractRegistrationForm) => Promise<void>;
  registerAgentContract: (formData: AgentContractRegistrationForm) => Promise<void>;
  fetchContracts: () => Promise<void>;
  fetchAgentContracts: () => Promise<void>;
  deleteContract: (contractId: string) => Promise<void>;
  deleteAgentContract: (contractId: string) => Promise<void>;
  updateContractStatus: (contractId: string, status: IdentityContract['status']) => Promise<void>;
  updateAgentContractStatus: (contractId: string, status: AgentIdentityContract['status']) => Promise<void>;
  setSelectedContract: (contract: IdentityContract | null) => void;
  setSelectedAgentContract: (contract: AgentIdentityContract | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useBlockchainStore = create<BlockchainState>((set, get) => ({
  // 初始状态
  contracts: [],
  agentContracts: [],
  isLoading: false,
  error: null,
  selectedContract: null,
  selectedAgentContract: null,

  // 注册新合约
  registerContract: async (formData: ContractRegistrationForm) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newContract: IdentityContract = {
        id: `contract_${Date.now()}`,
        contractAddress: generateContractAddress(),
        contractName: formData.contractName,
        ownerAddress: generateWalletAddress(),
        identityHash: generateIdentityHash(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        metadata: {
          identityType: formData.identityType,
          identityCredential: {
            id: `credential_${Date.now()}`,
            name: formData.identityCredential,
            type: 'id_card',
            fileUrl: 'https://example.com/credential.pdf',
            uploadDate: new Date(),
            verified: true,
            verificationScore: 95
          },
          userId: formData.userId,
          tags: formData.tags,
          description: formData.description
        },
        blockchain: {
          network: 'Ethereum Testnet',
          blockNumber: Math.floor(Math.random() * 1000000),
          transactionHash: generateTransactionHash(),
          gasUsed: Math.floor(Math.random() * 100000) + 50000
        }
      };

      set(state => ({
        contracts: [...state.contracts, newContract],
        isLoading: false,
        selectedContract: newContract
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '合约注册失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 注册Agent合约
  registerAgentContract: async (formData: AgentContractRegistrationForm) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 查找对应的共享数据源中的Agent
      const sharedAgent = sharedAgentData.findAgent(formData.agentId);

      const agentInfo: BlockchainAgent = {
        id: formData.agentId,
        name: sharedAgent?.name || 'Unknown Agent',
        type: formData.agentType as 'AI Assistant' | 'Chatbot' | 'Automation' | 'Data Processing' | 'Content Generation' | 'Analysis' | 'Security',
        capabilities: formData.capabilities as ('私人助理' | '购物助理' | '生活助理' | '健康助理' | '学习助理' | '工作助理' | '旅行助理' | '财务助理' | '娱乐助理' | '客服助理')[],
        description: formData.description,
        version: formData.version,
        model: formData.model,
        apiEndpoint: formData.apiEndpoint,
        status: (sharedAgent?.status || 'active') as 'active' | 'inactive' | 'development' | 'deprecated',
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: sharedAgent?.boundUser || 'Unknown'
      };

      const newAgentContract: AgentIdentityContract = {
        id: `agent_contract_${Date.now()}`,
        contractAddress: generateContractAddress(),
        contractName: formData.contractName,
        ownerAddress: generateWalletAddress(),
        agentId: formData.agentId,
        agentInfo,
        permissions: formData.permissions,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        metadata: {
          tags: formData.tags,
          description: formData.description,
          securityLevel: formData.securityLevel,
          compliance: ['GDPR', 'SOC2', 'ISO27001']
        },
        blockchain: {
          network: 'Ethereum Testnet',
          blockNumber: Math.floor(Math.random() * 1000000),
          transactionHash: generateTransactionHash(),
          gasUsed: Math.floor(Math.random() * 100000) + 50000
        }
      };

      set(state => ({
        agentContracts: [...state.agentContracts, newAgentContract],
        isLoading: false,
        selectedAgentContract: newAgentContract
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Agent合约注册失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 获取合约列表
  fetchContracts: async () => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 生成模拟数据
      const mockContracts: IdentityContract[] = generateMockContracts();

      set({ contracts: mockContracts, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取合约列表失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 获取Agent合约列表
  fetchAgentContracts: async () => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 生成模拟数据
      const mockAgentContracts: AgentIdentityContract[] = generateMockAgentContracts();

      set({ agentContracts: mockAgentContracts, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取Agent合约列表失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 删除合约
  deleteContract: async (contractId: string) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      set(state => ({
        contracts: state.contracts.filter(c => c.id !== contractId),
        isLoading: false,
        selectedContract: state.selectedContract?.id === contractId ? null : state.selectedContract
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除合约失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 删除Agent合约
  deleteAgentContract: async (contractId: string) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      set(state => ({
        agentContracts: state.agentContracts.filter(c => c.id !== contractId),
        isLoading: false,
        selectedAgentContract: state.selectedAgentContract?.id === contractId ? null : state.selectedAgentContract
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除Agent合约失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 更新合约状态
  updateContractStatus: async (contractId: string, status: IdentityContract['status']) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 800));

      set(state => ({
        contracts: state.contracts.map(contract =>
          contract.id === contractId
            ? { ...contract, status, updatedAt: new Date() }
            : contract
        ),
        isLoading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新合约状态失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 更新Agent合约状态
  updateAgentContractStatus: async (contractId: string, status: AgentIdentityContract['status']) => {
    set({ isLoading: true, error: null });

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 800));

      set(state => ({
        agentContracts: state.agentContracts.map(contract =>
          contract.id === contractId
            ? { ...contract, status, updatedAt: new Date() }
            : contract
        ),
        isLoading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新Agent合约状态失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 设置选中的合约
  setSelectedContract: (contract: IdentityContract | null) => {
    set({ selectedContract: contract });
  },

  // 设置选中的Agent合约
  setSelectedAgentContract: (contract: AgentIdentityContract | null) => {
    set({ selectedAgentContract: contract });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 重置状态
  reset: () => {
    set({
      contracts: [],
      agentContracts: [],
      isLoading: false,
      error: null,
      selectedContract: null,
      selectedAgentContract: null
    });
  }
}));

// 辅助函数
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

function generateMockContracts(): IdentityContract[] {
  const identityTypes = ['个人身份', '企业身份', '开发者身份', '机构身份'];
  const statuses: Array<'active' | 'pending' | 'suspended'> = ['active', 'pending', 'suspended'];

  return Array.from({ length: 8 }, (_, index) => ({
    id: `contract_${Date.now()}_${index}`,
    contractAddress: generateContractAddress(),
    contractName: `身份合约 ${index + 1}`,
    ownerAddress: generateWalletAddress(),
    identityHash: generateIdentityHash(),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 过去30天内
    updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 过去7天内
    status: statuses[Math.floor(Math.random() * statuses.length)],
    metadata: {
      identityType: identityTypes[Math.floor(Math.random() * identityTypes.length)],
      identityCredential: {
        id: `credential_${Date.now()}_${index}`,
        name: '身份证件',
        type: 'id_card',
        fileUrl: 'https://example.com/credential.pdf',
        uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        verified: Math.random() > 0.3,
        verificationScore: Math.floor(Math.random() * 30) + 70
      },
      userId: `user_${index + 1}`,
      tags: [
        'KYC验证',
        '企业认证',
        '开发者',
        '高级用户',
        '实名认证',
        '多因素认证'
      ].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1),
      description: `这是第${index + 1}个身份合约，用于演示区块链身份管理功能。`
    },
    blockchain: {
      network: 'Ethereum Testnet',
      blockNumber: Math.floor(Math.random() * 1000000),
      transactionHash: generateTransactionHash(),
      gasUsed: Math.floor(Math.random() * 100000) + 50000
    }
  }));
}

// Mock Agent数据现在使用 sharedAgentData 替代

function generateMockAgentContracts(): AgentIdentityContract[] {
  // 使用共享数据源
  const sharedAgents = sharedAgentData.getAgents();

  return sharedAgents.map((agent, index) => {
    const agentInfo: BlockchainAgent = {
      id: agent.id,
      name: agent.name,
      type: 'AI Assistant',
      capabilities: ['私人助理', '工作助理', '学习助理'],
      description: agent.description,
      version: '1.0.0',
      model: 'GPT-4',
      apiEndpoint: 'https://api.example.com/v1',
      status: (agent.status === 'active' ? 'active' : agent.status === 'inactive' ? 'inactive' : 'development') as 'active' | 'inactive' | 'development' | 'deprecated',
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt),
      owner: agent.boundUser || 'Unknown'
    };

    return {
      id: `agent_contract_${agent.id}`,
      contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
      contractName: `${agent.name} Identity Contract`,
      ownerAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
      agentId: agent.id,
      agentInfo,
      permissions: 'read-write',
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt),
      status: 'active',
      metadata: {
        tags: ['AI', 'Agent', 'Identity'],
        description: `Identity contract for ${agent.name}`,
        securityLevel: 'medium',
        compliance: ['KYC', 'AML']
      },
      blockchain: {
        network: 'Ethereum',
        blockNumber: 12345678 + index,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        gasUsed: 100000 + index * 50000
      }
    };
  });
}