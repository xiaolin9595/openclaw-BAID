export interface AgentCreateInfo {
  name: string;
  description: string;
  language: AgentLanguage;
  version: string;
  tags: string[];
  config: AgentConfig;
}

export interface AgentLanguage {
  id: string;
  name: string;
  version: string;
  type: 'interpreted' | 'compiled';
  fileExtensions: string[];
  icon?: string;
}

export interface AgentConfig {
  permissions: AgentPermission[];
  userBinding: UserBinding;
  dependencies: string[];
}

export interface UserBinding {
  boundUserId: string;
  userFaceFeatures?: FaceBiometricFeatures;
  bindingType: 'faceBiometrics' | 'multiFactor';
  bindingStrength: 'basic' | 'enhanced' | 'strict';
  verificationFrequency: 'once' | 'daily' | 'perRequest';
  fallbackAllowed: boolean;
}

export interface FaceBiometricFeatures {
  featureVector: number[];
  templateId: string;
  confidence: number;
  livenessCheck: boolean;
  antiSpoofing: boolean;
  enrollmentDate: Date;
  lastVerified?: Date;
}

export interface AgentPermission {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export interface AgentApiSpec {
  id: string;
  name: string;
  version: string;
  type: 'openapi' | 'postman' | 'graphql' | 'custom';
  file: any; // 使用any类型避免循环依赖
  validated: boolean;
  validationErrors?: string[];
  endpoints: ApiEndpoint[];
}

export interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  parameters: ApiParameter[];
  responses: ApiResponse[];
}

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: any;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  schema?: any;
}

export interface AgentCodePackage {
  id: string;
  name: string;
  version: string;
  language: AgentLanguage;
  files: any[]; // 使用any类型避免循环依赖
  entryFile: string;
  structure: CodeStructure;
  validated: boolean;
  validationErrors?: string[];
}

export interface CodeStructure {
  directories: string[];
  files: string[];
  dependencies: string[];
  hasEntryFile: boolean;
  hasConfigFile: boolean;
  hasTestFiles: boolean;
}

export interface AgentCreationStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

export interface AgentCreationState {
  currentStep: number;
  steps: AgentCreationStep[];
  basicInfo: AgentCreateInfo | null;
  apiSpec: AgentApiSpec | null;
  codePackage: AgentCodePackage | null;
  isCreating: boolean;
  error: string | null;
}

export interface AgentCreateFormProps {
  onSubmit: (agentData: AgentCreateInfo) => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface AgentApiUploadProps {
  onApiSpecSelect: (apiSpec: AgentApiSpec) => void;
  onApiSpecRemove: () => void;
  selectedApiSpec?: AgentApiSpec | null;
  disabled?: boolean;
}

export interface AgentCodeUploadProps {
  onCodePackageSelect: (codePackage: AgentCodePackage) => void;
  onCodePackageRemove: () => void;
  selectedCodePackage?: AgentCodePackage | null;
  disabled?: boolean;
  supportedLanguages: AgentLanguage[];
}

export interface AgentConfigFormProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  language?: AgentLanguage;
  disabled?: boolean;
}

export interface AgentCreationWizardProps {
  onComplete: (agentData: {
    basicInfo: AgentCreateInfo;
    codePackage: AgentCodePackage;
  }) => void;
  onCancel: () => void;
}

// 扩展原有的UploadedFile类型以支持Agent相关文件
export interface AgentUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  preview?: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  uploadedAt: Date;
  agentType: 'api' | 'code' | 'config';
  language?: string;
  validated?: boolean;
  validationErrors?: string[];
}

// 预定义的Agent语言选项
export const SUPPORTED_AGENT_LANGUAGES: AgentLanguage[] = [
  {
    id: 'javascript',
    name: 'JavaScript',
    version: 'ES2022',
    type: 'interpreted',
    fileExtensions: ['.js', '.jsx', '.mjs', '.cjs']
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    version: '5.0',
    type: 'interpreted',
    fileExtensions: ['.ts', '.tsx']
  },
  {
    id: 'python',
    name: 'Python',
    version: '3.11',
    type: 'interpreted',
    fileExtensions: ['.py', '.pyw']
  },
  {
    id: 'java',
    name: 'Java',
    version: '17',
    type: 'compiled',
    fileExtensions: ['.java', '.jar', '.war']
  },
  {
    id: 'go',
    name: 'Go',
    version: '1.21',
    type: 'compiled',
    fileExtensions: ['.go']
  },
  {
    id: 'rust',
    name: 'Rust',
    version: '1.71',
    type: 'compiled',
    fileExtensions: ['.rs']
  }
];

// 预定义的Agent权限
export const DEFAULT_AGENT_PERMISSIONS: AgentPermission[] = [
  {
    id: 'read',
    name: '读取权限',
    description: '允许读取数据和文件',
    required: true
  },
  {
    id: 'write',
    name: '写入权限',
    description: '允许写入数据和文件',
    required: false
  },
  {
    id: 'execute',
    name: '执行权限',
    description: '允许执行代码和命令',
    required: true
  },
  {
    id: 'network',
    name: '网络权限',
    description: '允许网络访问',
    required: false
  },
  {
    id: 'filesystem',
    name: '文件系统权限',
    description: '允许文件系统操作',
    required: false
  }
];

// 默认Agent配置
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  permissions: ['read' as any, 'execute' as any],
  userBinding: {
    boundUserId: '',
    bindingType: 'faceBiometrics',
    bindingStrength: 'basic',
    verificationFrequency: 'once',
    fallbackAllowed: true
  },
  dependencies: []
};

// 模拟用户数据用于下拉选择 - 同一个用户的多个ID
export const MOCK_USERS = [
  { id: 'user_zhangsan_001', name: '张三', email: 'zhangsan@example.com', department: '技术部' },
  { id: 'user_zhangsan_002', name: '张三', email: 'zhangsan_work@example.com', department: '技术部' },
  { id: 'user_zhangsan_003', name: '张三', email: 'zhangsan_dev@example.com', department: '开发组' },
  { id: 'user_zhangsan_admin', name: '张三', email: 'zhangsan_admin@example.com', department: '管理组' },
  { id: 'user_zhangsan_test', name: '张三', email: 'zhangsan_test@example.com', department: '测试组' }
];

// 预定义的用户绑定选项
export const USER_BINDING_OPTIONS = {
  bindingTypes: [
    { label: '人脸生物特征', value: 'faceBiometrics', description: '通过人脸识别进行身份验证' },
    { label: '多重验证', value: 'multiFactor', description: '结合用户ID和人脸识别的多重验证' }
  ],
  bindingStrengths: [
    { label: '基础验证', value: 'basic', description: '基本的身份验证，适用于低风险场景' },
    { label: '增强验证', value: 'enhanced', description: '强化身份验证，适用于中等风险场景' },
    { label: '严格验证', value: 'strict', description: '最严格的身份验证，适用于高风险场景' }
  ],
  verificationFrequencies: [
    { label: '一次性验证', value: 'once', description: '仅在Agent启动时验证一次' },
    { label: '每日验证', value: 'daily', description: '每天重新验证用户身份' },
    { label: '每次请求验证', value: 'perRequest', description: '每次执行任务时都验证身份' }
  ]
};

// API文件类型配置
export const API_FILE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/json',
    'application/yaml',
    'application/x-yaml',
    'text/yaml',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ],
  allowedExtensions: ['.json', '.yaml', '.yml', '.zip'],
  maxFiles: 1
};

// 代码文件类型配置
export const CODE_FILE_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-tar',
    'application/x-gzip',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ],
  allowedExtensions: ['.zip', '.tar', '.tar.gz', '.rar', '.7z'],
  maxFiles: 1
};