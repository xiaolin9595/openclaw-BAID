export interface CredentialData {
  id: string;
  type: 'id_card' | 'passport' | 'driver_license' | 'other';
  name: string;
  documentNumber: string;
  issuingCountry: string;
  issuedDate: string;
  expiryDate: string;
  dateOfBirth: string;
  nationality: string;
  gender: 'male' | 'female' | 'other';
  address?: string;
  confidence: number;
  extractedAt: string;
}

export interface IdentityGenerationConfig {
  prefix: string;
  useUUID: boolean;
  includeHash: boolean;
  hashAlgorithm: 'sha256' | 'sha512' | 'md5';
  confidenceThreshold: number;
  enableSteps: boolean;
  generateMultiple: boolean;
  count: number;
}

export interface GeneratedIdentity {
  id: string;
  identityId: string;
  prefix: string;
  hash: string;
  confidence: number;
  credentialData: CredentialData;
  generatedAt: string;
  steps: GenerationStep[];
  metadata: IdentityMetadata;
}

export interface IdentityMetadata {
  algorithm: string;
  version: string;
  processingTime: number;
  dataQuality: 'high' | 'medium' | 'low';
  validationStatus: 'passed' | 'failed' | 'warning';
}

export interface GenerationStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  output?: any;
  error?: string;
  progress: number;
}

export interface GenerationProcess {
  id: string;
  credentialFile: File;
  config: IdentityGenerationConfig;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: number;
  steps: GenerationStep[];
  result?: GeneratedIdentity;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface IdentityValidation {
  isValid: boolean;
  confidence: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  field: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field: string;
}

export interface GenerationHistoryItem {
  id: string;
  identityId: string;
  credentialName: string;
  generatedAt: string;
  confidence: number;
  status: 'success' | 'failed' | 'pending';
  preview?: GeneratedIdentity;
}

export interface GenerationStats {
  totalGenerated: number;
  averageConfidence: number;
  successRate: number;
  averageProcessingTime: number;
  credentialTypeStats: Record<string, number>;
  dailyStats: Array<{
    date: string;
    count: number;
    success: number;
    failed: number;
  }>;
}

// ZK-KYC证明相关类型定义
export interface ZKKYCProof {
  id: string;
  identityId: string;
  proofType: 'age_verification' | 'nationality_verification' | 'document_validity' | 'comprehensive_kyc';
  proofData: {
    publicInputs: string[];
    proof: string[];
    verificationKey: string;
    circuitHash: string;
  };
  verificationStatus: 'pending' | 'verified' | 'failed' | 'expired';
  confidence: number;
  metadata: {
    algorithm: string;
    version: string;
    generatedAt: string;
    expiresAt: string;
    processingTime: number;
    gasUsed: number;
    transactionHash?: string;
    blockNumber?: number;
  };
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ZKProofGenerationConfig {
  proofType: ZKKYCProof['proofType'];
  securityLevel: 'low' | 'medium' | 'high';
  validityPeriod: number; // 天数
  includeDetailedInfo: boolean;
}

export interface ZKProofGenerationProcess {
  id: string;
  identityId: string;
  config: ZKProofGenerationConfig;
  status: 'idle' | 'preparing' | 'generating' | 'verifying' | 'completed' | 'failed';
  progress: number;
  currentStep: number;
  steps: ZKProofGenerationStep[];
  result?: ZKKYCProof;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ZKProofGenerationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  output?: any;
  error?: string;
}

export interface ZKProofVerificationResult {
  isValid: boolean;
  proofId: string;
  verifiedAt: string;
  verifier: string;
  confidence: number;
  details: {
    publicInputsMatched: boolean;
    proofFormatValid: boolean;
    signatureValid: boolean;
    timestampValid: boolean;
  };
  error?: string;
}