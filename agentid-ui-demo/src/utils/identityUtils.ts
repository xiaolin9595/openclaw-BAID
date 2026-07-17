import { GeneratedIdentity, IdentityGenerationConfig, GenerationStep, CredentialData } from '@/types/identity';

// 身份标识验证工具
export const validateIdentity = (identity: GeneratedIdentity): boolean => {
  return (
    identity.identityId.length > 0 &&
    identity.hash.length > 0 &&
    identity.confidence >= 0.5 &&
    identity.credentialData.name.length > 0 &&
    identity.credentialData.documentNumber.length > 0
  );
};

// 格式化身份标识显示
export const formatIdentityId = (identityId: string): string => {
  if (identityId.length <= 12) return identityId;

  const parts = identityId.split('-');
  if (parts.length === 2) {
    return `${parts[0]}-${parts[1].substring(0, 8)}...`;
  }

  return `${identityId.substring(0, 8)}...${identityId.substring(identityId.length - 4)}`;
};

// 计算处理时间
export const calculateProcessingTime = (startTime: string, endTime: string): number => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return end - start;
};

// 格式化处理时间
export const formatProcessingTime = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    return `${(milliseconds / 60000).toFixed(1)}min`;
  }
};

// 获取步骤状态颜色
export const getStepStatusColor = (status: GenerationStep['status']): string => {
  switch (status) {
    case 'pending':
      return 'text-gray-500';
    case 'in_progress':
      return 'text-blue-500';
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

// 获取置信度颜色
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) {
    return 'text-green-600 bg-green-100';
  } else if (confidence >= 0.6) {
    return 'text-yellow-600 bg-yellow-100';
  } else {
    return 'text-red-600 bg-red-100';
  }
};

// 获取置信度文本
export const getConfidenceText = (confidence: number): string => {
  if (confidence >= 0.8) {
    return '高置信度';
  } else if (confidence >= 0.6) {
    return '中等置信度';
  } else {
    return '低置信度';
  }
};

// 生成默认配置
export const getDefaultConfig = (): IdentityGenerationConfig => {
  return {
    prefix: 'AGT',
    useUUID: true,
    includeHash: true,
    hashAlgorithm: 'sha256',
    confidenceThreshold: 0.7,
    enableSteps: true,
    generateMultiple: false,
    count: 1
  };
};

// 验证配置
export const validateConfig = (config: Partial<IdentityGenerationConfig>): string[] => {
  const errors: string[] = [];

  if (config.prefix && config.prefix.length > 10) {
    errors.push('前缀长度不能超过10个字符');
  }

  if (config.confidenceThreshold !== undefined && (config.confidenceThreshold < 0 || config.confidenceThreshold > 1)) {
    errors.push('置信度阈值必须在0到1之间');
  }

  if (config.count !== undefined && config.count < 1) {
    errors.push('生成数量必须大于0');
  }

  return errors;
};

// 格式化日期
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return dateString;
  }
};

// 计算年龄
export const calculateAge = (birthDate: string): number => {
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  } catch (error) {
    return 0;
  }
};

// 验证证件日期
export const validateDocumentDates = (issuedDate: string, expiryDate: string): boolean => {
  try {
    const issued = new Date(issuedDate);
    const expiry = new Date(expiryDate);
    const today = new Date();

    return issued < expiry && issued <= today && expiry > today;
  } catch (error) {
    return false;
  }
};

// 生成预览数据
export const generatePreviewData = (credentialData: CredentialData): Partial<GeneratedIdentity> => {
  return {
    identityId: 'AGT-preview-' + Math.random().toString(36).substring(2, 10),
    prefix: 'AGT',
    hash: 'preview-hash-' + Math.random().toString(36).substring(2, 10),
    confidence: 0.8 + Math.random() * 0.15,
    credentialData,
    generatedAt: new Date().toISOString(),
    steps: [],
    metadata: {
      algorithm: 'AgentID-v1.0',
      version: '1.0.0',
      processingTime: 1500,
      dataQuality: 'medium',
      validationStatus: 'passed'
    }
  };
};

// 导出身份标识数据
export const exportIdentityData = (identity: GeneratedIdentity): string => {
  return JSON.stringify({
    identityId: identity.identityId,
    credentialData: identity.credentialData,
    confidence: identity.confidence,
    generatedAt: identity.generatedAt,
    metadata: identity.metadata
  }, null, 2);
};

// 复制到剪贴板
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (error) {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

// 生成文件名
export const generateFileName = (identity: GeneratedIdentity, extension: string = '.json'): string => {
  const timestamp = new Date(identity.generatedAt).toISOString().split('T')[0];
  return `${identity.identityId}_${timestamp}${extension}`;
};

// 检查文件类型
export const isValidCredentialFile = (file: File): boolean => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  return allowedTypes.includes(file.type) ||
         file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i) !== null;
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// 生成进度百分比
export const calculateProgress = (steps: GenerationStep[]): number => {
  if (steps.length === 0) return 0;

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  return Math.round((completedSteps / steps.length) * 100);
};

// 获取当前步骤
export const getCurrentStep = (steps: GenerationStep[]): GenerationStep | null => {
  return steps.find(step => step.status === 'in_progress') || null;
};

// 获取下一步骤
export const getNextStep = (steps: GenerationStep[]): GenerationStep | null => {
  return steps.find(step => step.status === 'pending') || null;
};

// 检查是否完成
export const isProcessComplete = (steps: GenerationStep[]): boolean => {
  return steps.every(step => step.status === 'completed');
};

// 检查是否失败
export const hasProcessFailed = (steps: GenerationStep[]): boolean => {
  return steps.some(step => step.status === 'failed');
};

// 获取错误信息
export const getProcessErrors = (steps: GenerationStep[]): string[] => {
  return steps
    .filter(step => step.status === 'failed' && step.error)
    .map(step => step.error!);
};

// 重置步骤状态
export const resetSteps = (steps: GenerationStep[]): GenerationStep[] => {
  return steps.map(step => ({
    ...step,
    status: 'pending' as const,
    progress: 0,
    startTime: undefined,
    endTime: undefined,
    duration: undefined,
    output: undefined,
    error: undefined
  }));
};

// 创建步骤的副本
export const cloneStep = (step: GenerationStep): GenerationStep => {
  return JSON.parse(JSON.stringify(step));
};

// 比较两个身份标识
export const compareIdentities = (a: GeneratedIdentity, b: GeneratedIdentity): number => {
  // 按生成时间排序
  return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
};

// 过滤身份标识
export const filterIdentities = (
  identities: GeneratedIdentity[],
  filters: {
    search?: string;
    minConfidence?: number;
    dateRange?: [string, string];
    type?: string;
  }
): GeneratedIdentity[] => {
  return identities.filter(identity => {
    // 搜索过滤
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        identity.identityId.toLowerCase().includes(searchLower) ||
        identity.credentialData.name.toLowerCase().includes(searchLower) ||
        identity.credentialData.documentNumber.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // 置信度过滤
    if (filters.minConfidence !== undefined) {
      if (identity.confidence < filters.minConfidence) return false;
    }

    // 日期范围过滤
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      const generatedDate = new Date(identity.generatedAt);

      if (generatedDate < new Date(startDate) || generatedDate > new Date(endDate)) {
        return false;
      }
    }

    // 类型过滤
    if (filters.type) {
      if (identity.credentialData.type !== filters.type) return false;
    }

    return true;
  });
};