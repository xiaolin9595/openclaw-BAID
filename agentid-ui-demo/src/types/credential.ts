/**
 * W3C Verifiable Credentials 类型定义
 * 基于 W3C VC 标准，用于 Agent 权限管理
 * @see https://www.w3.org/TR/vc-data-model/
 */

/**
 * 权限类型枚举
 * 定义 Agent 可以拥有的各种权限类型
 */
export enum PermissionType {
  // 基础权限
  READ = 'READ',
  WRITE = 'WRITE',
  EXECUTE = 'EXECUTE',
  DELETE = 'DELETE',
  ADMIN = 'ADMIN',

  // 访问权限
  API_ACCESS = 'API_ACCESS',
  DATA_ACCESS = 'DATA_ACCESS',
  NETWORK_ACCESS = 'NETWORK_ACCESS',

  // 资源权限
  FILE_SYSTEM = 'FILE_SYSTEM',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE'
}

/**
 * 权限操作枚举
 * 定义具体的操作类型
 */
export enum PermissionAction {
  // 读取操作
  READ = 'read',
  GET = 'get',
  LIST = 'list',

  // 写入操作
  WRITE = 'write',
  CREATE = 'create',
  UPDATE = 'update',

  // 删除操作
  DELETE = 'delete',

  // 执行操作
  EXECUTE = 'execute',
  INVOKE = 'invoke',
  CALL = 'call'
}

/**
 * 权限约束
 * 用于限制权限的使用范围和条件
 */
export interface PermissionConstraint {
  /** 约束类型 */
  type: 'time' | 'ip' | 'usage' | 'rate' | 'location' | 'context';
  /** 约束值 */
  value: any;
  /** 约束描述 */
  description: string;
  /** 约束是否激活 */
  active?: boolean;
}

/**
 * Agent 权限声明
 * 定义 Agent 对特定资源的权限
 */
export interface AgentPermissionClaim {
  /** 权限声明唯一标识 */
  id: string;
  /** 权限类型 */
  type: PermissionType;
  /** 资源名称或路径 */
  resource: string;
  /** 允许的操作列表 */
  actions: PermissionAction[];
  /** 权限约束条件（可选） */
  constraints?: PermissionConstraint[];
  /** 授权时间 */
  grantedAt: string;
  /** 授权人标识 */
  grantedBy: string;
  /** 权限优先级（可选） */
  priority?: number;
  /** 是否可委托（可选） */
  delegable?: boolean;
}

/**
 * 凭证主体
 * 描述凭证所属的 Agent 及其权限
 */
export interface CredentialSubject {
  /** Agent 唯一标识 */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 主体类型 */
  type?: string;
  /** 权限声明列表 */
  permissions: AgentPermissionClaim[];
  /** 权限范围标识 */
  scope: string[];
  /** 权限生效时间 */
  validFrom: string;
  /** 权限失效时间（可选） */
  validUntil?: string;
  /** Agent 类型（可选） */
  agentType?: string;
  /** 附加属性（可选） */
  additionalProperties?: Record<string, any>;
}

/**
 * 发行者对象
 * 描述凭证发行者的详细信息
 */
export interface IssuerObject {
  /** 发行者唯一标识 */
  id: string;
  /** 发行者名称 */
  name: string;
  /** 发行者类型 */
  type: string[];
  /** 发行者描述（可选） */
  description?: string;
  /** 发行者网址（可选） */
  url?: string;
}

/**
 * VC 证明
 * 用于验证凭证的真实性和完整性
 */
export interface Proof {
  /** 证明类型（如 JsonWebSignature2020） */
  type: string;
  /** 证明创建时间 */
  created: string;
  /** 证明目的（如 assertionMethod） */
  proofPurpose: string;
  /** 验证方法标识 */
  verificationMethod: string;
  /** JSON Web Signature（可选） */
  jws?: string;
  /** 证明值（可选） */
  proofValue?: string;
  /** 挑战值（可选） */
  challenge?: string;
  /** 域（可选） */
  domain?: string;
}

/**
 * W3C 可验证凭证
 * 完整的 VC 数据结构
 */
export interface VerifiableCredential {
  /** JSON-LD 上下文 */
  '@context': string[];
  /** 凭证唯一标识 */
  id: string;
  /** 凭证类型 */
  type: string[];
  /** 发行者（字符串或对象） */
  issuer: string | IssuerObject;
  /** 签发时间 */
  issuanceDate: string;
  /** 过期时间（可选） */
  expirationDate?: string;
  /** 凭证主体 */
  credentialSubject: CredentialSubject;
  /** 证明 */
  proof: Proof;
  /** 凭证状态（可选） */
  credentialStatus?: CredentialStatus;
  /** 刷新服务（可选） */
  refreshService?: {
    id: string;
    type: string;
  };
  /** 服务条款（可选） */
  termsOfUse?: Array<{
    type: string;
    [key: string]: any;
  }>;
  /** 证据（可选） */
  evidence?: Array<{
    id?: string;
    type: string[];
    [key: string]: any;
  }>;
}

/**
 * 凭证状态
 * 跟踪凭证的当前状态
 */
export interface CredentialStatus {
  /** 状态标识 */
  id: string;
  /** 状态类型 */
  type: string;
  /** 状态值 */
  status: 'active' | 'revoked' | 'suspended' | 'expired';
  /** 状态原因（可选） */
  statusReason?: string;
  /** 状态变更时间 */
  statusDate: string;
  /** 状态变更人（可选） */
  statusChangedBy?: string;
  /** 前一个状态（可选） */
  previousStatus?: 'active' | 'revoked' | 'suspended' | 'expired';
}

/**
 * Agent 凭证管理
 * 管理单个 Agent 的所有凭证
 */
export interface AgentCredentialManagement {
  /** Agent 标识 */
  agentId: string;
  /** Agent 名称 */
  agentName?: string;
  /** 凭证列表 */
  credentials: VerifiableCredential[];
  /** 凭证总数 */
  totalCredentials: number;
  /** 活跃凭证数 */
  activeCredentials: number;
  /** 已撤销凭证数 */
  revokedCredentials: number;
  /** 已过期凭证数 */
  expiredCredentials?: number;
  /** 最后更新时间 */
  lastUpdated: string;
  /** 凭证摘要（可选） */
  credentialsSummary?: {
    permissionTypes: PermissionType[];
    totalPermissions: number;
    criticalPermissions: number;
  };
}

/**
 * 凭证验证结果
 * 验证凭证后的结果信息
 */
export interface CredentialVerificationResult {
  /** 是否验证通过 */
  verified: boolean;
  /** 验证时间 */
  verifiedAt: string;
  /** 验证人/系统 */
  verifiedBy: string;
  /** 验证失败原因（可选） */
  errors?: string[];
  /** 验证警告（可选） */
  warnings?: string[];
  /** 凭证状态 */
  credentialStatus: CredentialStatus;
  /** 权限有效性 */
  permissionsValid: boolean;
}

/**
 * 权限请求
 * 用于请求特定权限的数据结构
 */
export interface PermissionRequest {
  /** 请求标识 */
  requestId: string;
  /** 请求 Agent */
  agentId: string;
  /** 请求的权限类型 */
  permissionType: PermissionType;
  /** 请求的资源 */
  resource: string;
  /** 请求的操作 */
  actions: PermissionAction[];
  /** 请求原因 */
  reason: string;
  /** 请求时间 */
  requestedAt: string;
  /** 请求状态 */
  status: 'pending' | 'approved' | 'denied' | 'expired';
  /** 审批人（可选） */
  approvedBy?: string;
  /** 审批时间（可选） */
  approvedAt?: string;
}

/**
 * 权限审计日志
 * 记录权限相关的操作历史
 */
export interface PermissionAuditLog {
  /** 日志标识 */
  id: string;
  /** 操作时间 */
  timestamp: string;
  /** Agent 标识 */
  agentId: string;
  /** 操作类型 */
  action: 'grant' | 'revoke' | 'modify' | 'request' | 'use';
  /** 权限类型 */
  permissionType: PermissionType;
  /** 资源 */
  resource: string;
  /** 操作人 */
  performedBy: string;
  /** 操作结果 */
  result: 'success' | 'failure';
  /** 详细信息（可选） */
  details?: Record<string, any>;
  /** IP 地址（可选） */
  ipAddress?: string;
  /** 用户代理（可选） */
  userAgent?: string;
}