import { Agent, AgentPermission, AgentPaginationParams } from './agent';
import { BlockchainAgent, AgentCapability, AgentContractPermission } from './blockchain';

// Agent角色类型
export type AgentRole =
  | 'shopping_assistant'    // 购物员
  | 'sales_assistant'       // 销售员
  | 'life_assistant'        // 生活助理
  | 'health_doctor'         // 健康医生
  | 'data_analyst'          // 数据分析师
  | 'customer_service'      // 客服专员
  | 'content_creator'       // 内容创作者
  | 'research_assistant'    // 研究助理
  | 'financial_advisor'      // 财务顾问
  | 'education_tutor'       // 教育导师
  | 'technical_support'     // 技术支持
  | 'business_consultant'    // 商业顾问
  | 'personal_assistant'    // 个人助理
  | 'legal_advisor'         // 法律顾问
  | 'marketing_specialist';  // 营销专员

// 角色显示信息
export const AGENT_ROLE_INFO: Record<AgentRole, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  shopping_assistant: {
    label: '购物员',
    description: '帮助用户进行商品选择、比价和购买决策',
    icon: '🛒',
    color: '#52c41a'
  },
  sales_assistant: {
    label: '销售员',
    description: '协助销售流程，提供产品推荐和客户服务',
    icon: '💼',
    color: '#1890ff'
  },
  life_assistant: {
    label: '生活助理',
    description: '管理日程安排，提供生活建议和服务',
    icon: '🏠',
    color: '#722ed1'
  },
  health_doctor: {
    label: '健康医生',
    description: '提供健康咨询、医疗建议和健康监测',
    icon: '🏥',
    color: '#f5222d'
  },
  data_analyst: {
    label: '数据分析师',
    description: '分析数据，提供洞察和商业智能',
    icon: '📊',
    color: '#fa8c16'
  },
  customer_service: {
    label: '客服专员',
    description: '提供客户支持和问题解决方案',
    icon: '🎧',
    color: '#13c2c2'
  },
  content_creator: {
    label: '内容创作者',
    description: '生成创意内容，文案和多媒体素材',
    icon: '✍️',
    color: '#eb2f96'
  },
  research_assistant: {
    label: '研究助理',
    description: '协助学术研究，文献分析和知识整理',
    icon: '🔬',
    color: '#52c41a'
  },
  financial_advisor: {
    label: '财务顾问',
    description: '提供投资建议和财务规划服务',
    icon: '💰',
    color: '#faad14'
  },
  education_tutor: {
    label: '教育导师',
    description: '提供个性化教学和学习辅导',
    icon: '📚',
    color: '#1890ff'
  },
  technical_support: {
    label: '技术支持',
    description: '解决技术问题，提供IT支持服务',
    icon: '🔧',
    color: '#722ed1'
  },
  business_consultant: {
    label: '商业顾问',
    description: '提供商业策略和管理咨询服务',
    icon: '📈',
    color: '#f5222d'
  },
  personal_assistant: {
    label: '个人助理',
    description: '提供个人事务管理和日常协助',
    icon: '🤖',
    color: '#13c2c2'
  },
  legal_advisor: {
    label: '法律顾问',
    description: '提供法律咨询和合规建议',
    icon: '⚖️',
    color: '#fa8c16'
  },
  marketing_specialist: {
    label: '营销专员',
    description: '制定营销策略，推广品牌和产品',
    icon: '📢',
    color: '#eb2f96'
  }
};

// 搜索参数类型
export interface AgentDiscoverySearchParams extends AgentPaginationParams {
  search?: string;
  capabilities?: AgentCapability[];
  userId?: string;
  role?: AgentRole | AgentRole[];
  status?: Agent['status'] | BlockchainAgent['status'];
  blockchainStatus?: string;
  type?: BlockchainAgent['type'];
  language?: string;
  minRating?: number;
  maxRating?: number;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  tags?: string[];
  securityLevel?: 'low' | 'medium' | 'high';
  permissions?: AgentPermission[];
  contractPermissions?: AgentContractPermission[];
}

// 排序参数
export interface AgentDiscoverySortParams {
  field: 'name' | 'createdAt' | 'updatedAt' | 'rating' | 'status' | 'type' | 'capabilities' | 'codeSize' | 'connections';
  order: 'asc' | 'desc';
}

// 过滤参数
export interface AgentDiscoveryFilterParams {
  statuses?: Array<Agent['status'] | BlockchainAgent['status']>;
  types?: BlockchainAgent['type'][];
  languages?: string[];
  capabilities?: AgentCapability[];
  roles?: AgentRole[];
  ratingRange?: {
    min: number;
    max: number;
  };
  codeSizeRange?: {
    min: number;
    max: number;
  };
  hasContract?: boolean;
  isVerified?: boolean;
  isActive?: boolean;
  tags?: string[];
  owners?: string[];
  networks?: string[];
}

// 扩展的Agent信息
export interface AgentDiscoveryItem extends Omit<Agent, 'description' | 'version'> {
  // 基础字段重新定义以避免冲突
  description: string;
  version?: string;

  // 区块链相关信息
  blockchainInfo?: AgentBlockchainInfo;
  contractInfo?: AgentContractInfo;

  // 发现功能特有字段
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  role?: AgentRole;
  isVerified?: boolean;
  isFeatured?: boolean;
  popularity?: number;
  connections?: number;
  responseTime?: number;
  uptime?: number;
  lastActivity?: Date;
  categories?: string[];
  apiEndpoint?: string;
  model?: string;

  // 统计信息
  stats?: {
    totalCalls: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    uptimePercentage: number;
  };

  // 元数据
  metadata?: {
    website?: string;
    documentation?: string;
    github?: string;
    socialLinks?: {
      twitter?: string;
      linkedin?: string;
      discord?: string;
    };
    pricing?: {
      type: 'free' | 'paid' | 'freemium';
      price?: number;
      currency?: string;
    };
  };
}

// 区块链上的Agent信息
export interface AgentBlockchainInfo {
  contractAddress?: string;
  network?: string;
  blockNumber?: number;
  transactionHash?: string;
  gasUsed?: number;
  isOnChain: boolean;
  verificationStatus: 'verified' | 'pending' | 'failed' | 'unverified';
  verificationDate?: Date;
  chainId?: number;
  lastSyncedAt?: Date;
  syncStatus: 'synced' | 'syncing' | 'failed';
}

// 合约信息
export interface AgentContractInfo {
  contractAddress: string;
  contractName: string;
  ownerAddress: string;
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

// 搜索结果
export interface AgentDiscoveryResult {
  agents: AgentDiscoveryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  sort: AgentDiscoverySortParams;
  filters: AgentDiscoveryFilterParams;
  searchTime: number;
  queryId?: string;
}

// 统计信息
export interface AgentDiscoveryStats {
  totalAgents: number;
  activeAgents: number;
  inactiveAgents: number;
  verifiedAgents: number;
  featuredAgents: number;
  averageRating: number;
  totalConnections: number;
  topCapabilities: Array<{
    capability: AgentCapability;
    count: number;
    percentage: number;
  }>;
  topTypes: Array<{
    type: BlockchainAgent['type'];
    count: number;
    percentage: number;
  }>;
  networkDistribution: Array<{
    network: string;
    count: number;
    percentage: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  dailyStats: Array<{
    date: string;
    newAgents: number;
    activeAgents: number;
    totalCalls: number;
  }>;
}

// 通信相关类型
export interface AgentCommunicationRequest {
  fromAgentId: string; // 发起通信的Agent ID
  agentId: string;     // 目标Agent ID
  type: 'data_analysis' | 'content_creation' | 'research' | 'automation' | 'monitoring' | 'integration' | 'other';
  payload?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timeout?: number;
  requiresResponse?: boolean;
  metadata?: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    tags?: string[];
  };
}

export interface AgentCommunicationChannel {
  id: string;
  name: string;
  type: 'websocket' | 'http' | 'grpc' | 'mqtt' | 'custom';
  endpoint: string;
  protocol: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: Date;
  supportedMethods: string[];
  security: {
    authentication: 'none' | 'api_key' | 'oauth' | 'jwt' | 'certificate';
    encryption: 'none' | 'tls' | 'ssl' | 'custom';
    authorization: string[];
  };
}

export interface AgentCommunicationStatus {
  status: 'idle' | 'busy' | 'offline' | 'error';
  currentLoad?: number;
  maxCapacity?: number;
  responseTime?: number;
  lastActivity?: Date;
  error?: string;
  channels: AgentCommunicationChannel[];
}

// Store状态类型
export interface AgentDiscoveryState {
  // 搜索状态
  searchParams: AgentDiscoverySearchParams;
  searchResults: AgentDiscoveryResult | null;
  isSearching: boolean;
  searchError: string | null;

  // 选中状态
  selectedAgent: AgentDiscoveryItem | null;
  selectedAgents: AgentDiscoveryItem[];

  // 过滤和排序
  activeFilters: AgentDiscoveryFilterParams;
  currentSort: AgentDiscoverySortParams;

  // 统计信息
  stats: AgentDiscoveryStats | null;
  isLoadingStats: boolean;
  statsError: string | null;

  // 通信状态
  communicationStatus: Record<string, AgentCommunicationStatus>;

  // UI状态
  viewMode: 'grid' | 'list' | 'table';
  showFilters: boolean;
  showAdvancedFilters: boolean;

  // 缓存
  cache: {
    agents: Record<string, AgentDiscoveryItem>;
    stats: AgentDiscoveryStats | null;
    lastUpdated: Date | null;
  };
}

// Action类型
export type AgentDiscoveryAction =
  | { type: 'SET_SEARCH_PARAMS'; payload: AgentDiscoverySearchParams }
  | { type: 'SET_SEARCH_RESULTS'; payload: AgentDiscoveryResult }
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SET_SEARCH_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_AGENT'; payload: AgentDiscoveryItem | null }
  | { type: 'SET_SELECTED_AGENTS'; payload: AgentDiscoveryItem[] }
  | { type: 'ADD_SELECTED_AGENT'; payload: AgentDiscoveryItem }
  | { type: 'REMOVE_SELECTED_AGENT'; payload: string }
  | { type: 'CLEAR_SELECTED_AGENTS' }
  | { type: 'SET_ACTIVE_FILTERS'; payload: AgentDiscoveryFilterParams }
  | { type: 'SET_CURRENT_SORT'; payload: AgentDiscoverySortParams }
  | { type: 'SET_STATS'; payload: AgentDiscoveryStats }
  | { type: 'SET_LOADING_STATS'; payload: boolean }
  | { type: 'SET_STATS_ERROR'; payload: string | null }
  | { type: 'SET_COMMUNICATION_STATUS'; payload: { agentId: string; status: AgentCommunicationStatus } }
  | { type: 'SET_VIEW_MODE'; payload: 'grid' | 'list' | 'table' }
  | { type: 'SET_SHOW_FILTERS'; payload: boolean }
  | { type: 'SET_SHOW_ADVANCED_FILTERS'; payload: boolean }
  | { type: 'UPDATE_CACHE'; payload: { agent: AgentDiscoveryItem } }
  | { type: 'CLEAR_CACHE' }
  | { type: 'RESET_STATE' };

// 导出类型
export type {
  Agent,
  AgentPermission,
  AgentPaginationParams,
  BlockchainAgent,
  AgentCapability,
  AgentContractPermission
};