import { User, Agent, Transaction, Contract } from '../types';

export const mockUsers: User[] = [
  {
    id: '1',
    userId: 'user_123',
    username: 'demo_user',
    email: 'demo@example.com',
    publicKey: '0x1234567890abcdef1234567890abcdef12345678',
    biometricStatus: 'bound',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    authCount: 42
  },
  {
    id: '2',
    userId: 'user_456',
    username: 'admin_user',
    email: 'admin@example.com',
    publicKey: '0x2345678901abcdef2345678901abcdef23456789',
    biometricStatus: 'bound',
    status: 'active',
    createdAt: '2024-01-10T08:15:00Z',
    authCount: 128
  }
];

export const mockAgents: Agent[] = [
  {
    id: '1',
    agentId: 'agent_001',
    name: 'Data Processing Agent',
    description: '专门处理数据分析任务的智能代理',
    codeHash: '0xabcdef1234567890abcdef1234567890abcdef12',
    profileHash: '0x1234567890abcdef1234567890abcdef12345678',
    status: 'active',
    boundUser: 'user_123',
    boundAt: '2024-01-15T11:00:00Z',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    codeSize: 256,
    language: 'typescript',
    version: "1.0.0",    config: {
      permissions: ['read', 'write', 'execute'],
      userBinding: {
        boundUserId: 'user_001',
        bindingType: 'faceBiometrics',
        bindingStrength: 'basic',
        verificationFrequency: 'once',
        fallbackAllowed: true
      }
    },
    permissions: ['read', 'write', 'execute']
  },
  {
    id: '2',
    agentId: 'agent_002',
    name: 'Security Monitor Agent',
    description: '监控系统安全状态的安全代理',
    codeHash: '0x9876543210fedcba9876543210fedcba98765432',
    profileHash: '0x8765432109abcdef8765432109abcdef87654321',
    status: 'active',
    boundUser: 'user_123',
    boundAt: '2024-01-16T09:30:00Z',
    createdAt: '2024-01-16T09:30:00Z',
    updatedAt: '2024-01-21T16:45:00Z',
    codeSize: 384,
    language: 'python',
    version: "1.0.0",    config: {
      permissions: ['read', 'execute'],
      userBinding: {
        boundUserId: 'user_002',
        bindingType: 'faceBiometrics',
        bindingStrength: 'enhanced',
        verificationFrequency: 'daily',
        fallbackAllowed: false,
        userFaceFeatures: {
          featureVector: Array.from({ length: 128 }, () => Math.random()),
          templateId: 'face_mock_001',
          confidence: 0.96,
          livenessCheck: true,
          antiSpoofing: true,
          enrollmentDate: new Date('2024-01-16T09:30:00Z')
        }
      }
    },
    permissions: ['read', 'execute']
  },
  {
    id: '3',
    agentId: 'agent_003',
    name: 'Backup Agent',
    description: '执行数据备份和恢复任务',
    codeHash: '0x5555555555555555555555555555555555555555',
    profileHash: '0x6666666666666666666666666666666666666666',
    status: 'stopped',
    boundUser: 'user_456',
    boundAt: '2024-01-18T13:20:00Z',
    createdAt: '2024-01-18T13:20:00Z',
    updatedAt: '2024-01-22T10:15:00Z',
    codeSize: 128,
    language: 'javascript',
    version: "1.0.0",    config: {
      permissions: ['read', 'write'],
      userBinding: {
        boundUserId: 'user_456',
        bindingType: 'multiFactor',
        bindingStrength: 'strict',
        verificationFrequency: 'perRequest',
        fallbackAllowed: false,
        userFaceFeatures: {
          featureVector: Array.from({ length: 128 }, () => Math.random()),
          templateId: 'face_mock_002',
          confidence: 0.98,
          livenessCheck: true,
          antiSpoofing: true,
          enrollmentDate: new Date('2024-01-18T13:20:00Z')
        }
      }
    },
    permissions: ['read', 'write']
  }
];

export const mockTransactions: Transaction[] = [
  {
    hash: '0x1111111111111111111111111111111111111111',
    blockNumber: 12345,
    from: '0x1234567890abcdef1234567890abcdef12345678',
    to: '0x9876543210fedcba9876543210fedcba98765432',
    gasUsed: 507763,
    timestamp: '2024-01-20T10:30:00Z',
    status: 'success',
    type: 'agent_registration',
    value: '0.1 ETH',
    nonce: 1
  },
  {
    hash: '0x2222222222222222222222222222222222222222',
    blockNumber: 12346,
    from: '0x2345678901abcdef2345678901abcdef23456789',
    to: '0x8765432109abcdef8765432109abcdef87654321',
    gasUsed: 390325,
    timestamp: '2024-01-20T11:15:00Z',
    status: 'success',
    type: 'user_registration',
    nonce: 2
  },
  {
    hash: '0x3333333333333333333333333333333333333333',
    blockNumber: 12347,
    from: '0x1234567890abcdef1234567890abcdef12345678',
    to: '0x8765432109abcdef8765432109abcdef87654321',
    gasUsed: 128837,
    timestamp: '2024-01-20T12:00:00Z',
    status: 'success',
    type: 'agent_update',
    nonce: 3
  }
];

export const mockContracts: Contract[] = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    type: 'user',
    owner: 'user_123',
    createdAt: '2024-01-15T10:30:00Z',
    status: 'active',
    balance: '1.5 ETH'
  },
  {
    address: '0x9876543210fedcba9876543210fedcba98765432',
    type: 'agent',
    owner: 'user_123',
    createdAt: '2024-01-15T11:00:00Z',
    status: 'active'
  },
  {
    address: '0x8765432109abcdef8765432109abcdef87654321',
    type: 'agent',
    owner: 'user_123',
    createdAt: '2024-01-16T09:30:00Z',
    status: 'active'
  }
];

// 生成模拟数据的工具函数
export const generateMockHash = (length: number = 64): string => {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < length - 2; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateMockTemplate = (): string => {
  return generateMockHash(128);
};

export const generateMockId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};