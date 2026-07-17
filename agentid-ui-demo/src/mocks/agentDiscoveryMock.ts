import {
  Agent,
  BlockchainAgent,
  AgentIdentityContract,
  AgentCapability,
  AgentDiscoveryItem,
  AgentDiscoveryStats,
  AgentCommunicationStatus
} from '../types';
import type { AgentRole } from '../types/agent-discovery';
import { sharedAgentData } from './sharedAgentData';

/**
 * Agent发现功能的模拟数据
 */

// 使用共享数据源
export const mockBaseAgents: Agent[] = sharedAgentData.getAgents();

// 区块链Agent模拟数据 - 基于共享数据源生成
export const mockBlockchainAgents: BlockchainAgent[] = mockBaseAgents.map(agent => ({
  id: agent.id,
  name: agent.name,
  type: 'AI Assistant' as const,
  capabilities: ['私人助理', '工作助理', '学习助理'],
  description: agent.description,
  version: '1.0.0',
  model: 'GPT-4',
  apiEndpoint: 'https://api.example.com/v1',
  status: (agent.status === 'active' ? 'active' : agent.status === 'inactive' ? 'inactive' : 'development') as 'active' | 'inactive' | 'development' | 'deprecated',
  createdAt: new Date(agent.createdAt),
  updatedAt: new Date(agent.updatedAt),
  owner: 'Demo User'
}));

// Agent身份合约模拟数据 - 基于共享数据源生成
export const mockAgentContracts: AgentIdentityContract[] = mockBaseAgents.map((agent, index) => ({
  id: `contract_${agent.id}`,
  contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
  contractName: `${agent.name} Identity Contract`,
  ownerAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
  agentId: agent.id,
  agentInfo: mockBlockchainAgents[index],
  permissions: 'read-write' as const,
  createdAt: new Date(agent.createdAt),
  updatedAt: new Date(agent.updatedAt),
  status: 'active' as const,
  metadata: {
    tags: ['AI', 'Agent', 'Identity'],
    description: `Identity contract for ${agent.name}`,
    securityLevel: 'medium' as const,
    compliance: ['KYC', 'AML']
  },
  blockchain: {
    network: 'Ethereum',
    blockNumber: 12345678 + index,
    transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
    gasUsed: 100000 + index * 50000
  }
}));

// Agent发现统计模拟数据
export const mockDiscoveryStats: AgentDiscoveryStats = {
  totalAgents: mockBaseAgents.length,
  activeAgents: mockBaseAgents.filter(a => a.status === 'active').length,
  inactiveAgents: mockBaseAgents.filter(a => a.status === 'inactive').length,
  verifiedAgents: mockBaseAgents.length,
  featuredAgents: Math.floor(mockBaseAgents.length / 2),
  averageRating: 4.2,
  totalConnections: mockBaseAgents.length * 10,
  topCapabilities: [
    { capability: '数据处理' as AgentCapability, count: 8, percentage: 80 },
    { capability: 'AI/ML' as AgentCapability, count: 7, percentage: 70 },
    { capability: '自动化' as AgentCapability, count: 6, percentage: 60 }
  ],
  topTypes: [
    { type: 'AI Assistant' as const, count: 2, percentage: 67 },
    { type: 'Data Processing' as const, count: 1, percentage: 33 }
  ],
  networkDistribution: [
    { network: 'Ethereum', count: 7, percentage: 70 },
    { network: 'BSC', count: 2, percentage: 20 },
    { network: 'Polygon', count: 1, percentage: 10 }
  ],
  statusDistribution: [
    { status: 'active', count: mockBaseAgents.filter(a => a.status === 'active').length, percentage: 67 },
    { status: 'inactive', count: mockBaseAgents.filter(a => a.status === 'inactive').length, percentage: 33 }
  ],
  dailyStats: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    newAgents: Math.floor(Math.random() * 3),
    activeAgents: mockBaseAgents.filter(a => a.status === 'active').length,
    totalCalls: Math.floor(Math.random() * 1000) + 500
  }))
};

// Agent通信状态模拟数据
export const mockCommunicationStatus: Record<string, AgentCommunicationStatus> = {};

mockBaseAgents.forEach(agent => {
  mockCommunicationStatus[agent.id] = {
    status: 'idle' as const,
    currentLoad: Math.floor(Math.random() * 50),
    maxCapacity: 100,
    responseTime: Math.floor(Math.random() * 100) + 50,
    lastActivity: new Date(Date.now() - Math.random() * 3600000),
    channels: [
      {
        id: `channel_${agent.id}`,
        name: `${agent.name} Channel`,
        type: 'http' as const,
        endpoint: 'https://api.example.com/agent',
        protocol: 'REST',
        status: 'connected' as const,
        lastConnected: new Date(Date.now() - Math.random() * 3600000),
        supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        security: {
          authentication: 'api_key' as const,
          encryption: 'tls' as const,
          authorization: ['read', 'write']
        }
      }
    ]
  };
});

// 生成随机Agent发现项的辅助函数
export function generateRandomAgentDiscoveryItem(baseAgent: Agent, blockchainAgent?: BlockchainAgent): AgentDiscoveryItem {
  const roles: AgentRole[] = [
    'shopping_assistant', 'sales_assistant', 'life_assistant', 'health_doctor',
    'data_analyst', 'customer_service', 'content_creator', 'research_assistant',
    'financial_advisor', 'education_tutor', 'technical_support', 'business_consultant',
    'personal_assistant', 'legal_advisor', 'marketing_specialist'
  ];

  const randomRole = roles[Math.floor(Math.random() * roles.length)];

  return {
    ...baseAgent,
    description: baseAgent.description,
    blockchainInfo: {
      contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
      network: 'Ethereum',
      blockNumber: Math.floor(Math.random() * 1000000),
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      gasUsed: Math.floor(Math.random() * 100000) + 50000,
      isOnChain: true,
      verificationStatus: 'verified' as const,
      verificationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      chainId: 1,
      lastSyncedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      syncStatus: 'synced' as const
    },
    rating: Math.random() * 2 + 3, // 3-5分
    reviewCount: Math.floor(Math.random() * 100) + 10,
    tags: ['AI', 'Automation', 'Blockchain', 'Data Processing'],
    role: randomRole,
    isVerified: true,
    isFeatured: Math.random() > 0.7,
    popularity: Math.floor(Math.random() * 1000) + 100,
    connections: Math.floor(Math.random() * 500) + 50,
    responseTime: Math.floor(Math.random() * 200) + 50,
    uptime: Math.random() * 0.1 + 0.9, // 90-100%
    lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    categories: ['AI Service', 'Automation'],
    apiEndpoint: 'https://api.example.com/v1',
    model: 'GPT-4',
    version: '1.0.0',
    stats: {
      totalCalls: Math.floor(Math.random() * 10000) + 1000,
      successRate: Math.random() * 0.1 + 0.9, // 90-100%
      averageResponseTime: Math.floor(Math.random() * 200) + 50,
      errorRate: Math.random() * 0.05, // 0-5%
      uptimePercentage: Math.random() * 0.1 + 0.9 // 90-100%
    },
    metadata: {
      website: 'https://example.com',
      documentation: 'https://docs.example.com',
      github: 'https://github.com/example/agent',
      socialLinks: {
        twitter: 'https://twitter.com/example',
        linkedin: 'https://linkedin.com/company/example',
        discord: 'https://discord.gg/example'
      },
      pricing: {
        type: 'freemium' as const,
        price: 0.01,
        currency: 'USD'
      }
    }
  };
}

// 生成模拟的Agent发现列表
export function generateMockAgentDiscoveryList(): AgentDiscoveryItem[] {
  const items: AgentDiscoveryItem[] = [];

  // 添加基础Agent
  mockBaseAgents.forEach(agent => {
    const blockchainAgent = mockBlockchainAgents.find(ba => ba.id === agent.id);
    items.push(generateRandomAgentDiscoveryItem(agent, blockchainAgent));
  });

  // 添加一些额外的随机Agent
  for (let i = 0; i < 3; i++) {
    const randomAgent: Agent = {
      id: `random_agent_${i}`,
      agentId: `random_${i}`,
      name: `Random Agent ${i + 1}`,
      description: `这是一个随机生成的Agent，用于测试发现功能 ${i + 1}`,
      codeHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      profileHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'active',
      boundUser: 'user_random',
      boundAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      codeSize: Math.floor(Math.random() * 1000000) + 100000,
      language: 'javascript',
      version: "1.0.0",      config: {
        permissions: ['read', 'write'],
        userBinding: {
          boundUserId: 'user_random',
          bindingType: 'faceBiometrics',
          bindingStrength: 'basic',
          verificationFrequency: 'once',
          fallbackAllowed: true
        }
      },
      permissions: ['read', 'write']
    };

    items.push(generateRandomAgentDiscoveryItem(randomAgent));
  }

  return items;
}