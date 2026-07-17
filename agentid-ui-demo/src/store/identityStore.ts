import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GeneratedIdentity,
  IdentityGenerationConfig,
  GenerationProcess,
  GenerationStep,
  GenerationHistoryItem,
  GenerationStats,
  ZKKYCProof,
  ZKProofGenerationConfig,
  ZKProofGenerationProcess,
  ZKProofVerificationResult
} from '@/types/identity';

interface IdentityState {
  // 配置状态
  config: IdentityGenerationConfig;

  // 当前生成过程
  currentProcess: GenerationProcess | null;

  // 生成的身份标识列表
  identities: GeneratedIdentity[];

  // ZK-KYC证明相关
  zkProofs: ZKKYCProof[];
  currentZKProcess: ZKProofGenerationProcess | null;
  zkProofConfig: ZKProofGenerationConfig;

  // 历史记录
  history: GenerationHistoryItem[];

  // 统计数据
  stats: GenerationStats | null;

  // UI状态
  isLoading: boolean;
  zkGenerating: boolean;
  error: string | null;

  // 动作
  setConfig: (config: Partial<IdentityGenerationConfig>) => void;
  resetConfig: () => void;

  startGeneration: (file: File) => Promise<void>;
  updateProcess: (process: GenerationProcess) => void;
  completeGeneration: (identity: GeneratedIdentity) => void;
  failGeneration: (error: string) => void;
  resetProcess: () => void;

  addIdentity: (identity: GeneratedIdentity) => void;
  removeIdentity: (identityId: string) => void;
  clearIdentities: () => void;

  // ZK-KYC证明相关动作
  generateZKProof: (identityId: string, config: ZKProofGenerationConfig) => Promise<void>;
  updateZKProcess: (process: ZKProofGenerationProcess) => void;
  completeZKGeneration: (proof: ZKKYCProof) => void;
  failZKGeneration: (error: string) => void;
  resetZKProcess: () => void;

  addZKProof: (proof: ZKKYCProof) => void;
  removeZKProof: (proofId: string) => void;
  getZKProofsByIdentity: (identityId: string) => ZKKYCProof[];
  verifyZKProof: (proofId: string) => Promise<ZKProofVerificationResult>;
  setZKProofConfig: (config: Partial<ZKProofGenerationConfig>) => void;

  addToHistory: (item: GenerationHistoryItem) => void;
  clearHistory: () => void;

  updateStats: () => void;
  setLoading: (loading: boolean) => void;
  setZKGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;

  // 选择器
  getConfig: () => IdentityGenerationConfig;
  getCurrentProcess: () => GenerationProcess | null;
  getIdentities: () => GeneratedIdentity[];
  getZKProofs: () => ZKKYCProof[];
  getCurrentZKProcess: () => ZKProofGenerationProcess | null;
  getZKProofConfig: () => ZKProofGenerationConfig;
  getHistory: () => GenerationHistoryItem[];
  getStats: () => GenerationStats | null;
  getIsLoading: () => boolean;
  getZKGenerating: () => boolean;
  getError: () => string | null;
}

const defaultConfig: IdentityGenerationConfig = {
  prefix: 'AGT',
  useUUID: true,
  includeHash: true,
  hashAlgorithm: 'sha256',
  confidenceThreshold: 0.7,
  enableSteps: true,
  generateMultiple: false,
  count: 1
};

const defaultZKConfig: ZKProofGenerationConfig = {
  proofType: 'comprehensive_kyc',
  securityLevel: 'medium',
  validityPeriod: 365, // 1年
  includeDetailedInfo: true
};

const initialStats: GenerationStats = {
  totalGenerated: 0,
  averageConfidence: 0,
  successRate: 0,
  averageProcessingTime: 0,
  credentialTypeStats: {},
  dailyStats: []
};

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: defaultConfig,
      currentProcess: null,
      identities: [
        // 默认身份标识数据
        {
          id: '1',
          identityId: '1-175826628',
          prefix: '1',
          hash: 'mock-hash-001',
          confidence: 0.95,
          credentialData: {
            id: 'cred-001',
            type: 'id_card',
            name: '张三',
            documentNumber: 'ID123456789',
            issuingCountry: 'CN',
            issuedDate: '2020-01-01',
            expiryDate: '2030-01-01',
            dateOfBirth: '1990-01-01',
            nationality: '中国',
            gender: 'male',
            address: '北京市朝阳区',
            confidence: 0.95,
            extractedAt: '2024-01-15T10:30:00Z'
          },
          generatedAt: '2024-01-15T10:30:00Z',
          steps: [],
          metadata: {
            algorithm: 'AgentID-v1.0',
            version: '1.0.0',
            processingTime: 2000,
            dataQuality: 'high',
            validationStatus: 'passed'
          }
        },
        {
          id: '2',
          identityId: 'lin-175879861',
          prefix: 'lin',
          hash: 'mock-hash-002',
          confidence: 0.92,
          credentialData: {
            id: 'cred-002',
            type: 'id_card',
            name: '张三',
            documentNumber: 'ID987654321',
            issuingCountry: 'CN',
            issuedDate: '2020-02-01',
            expiryDate: '2030-02-01',
            dateOfBirth: '1992-05-15',
            nationality: '中国',
            gender: 'male',
            address: '北京市海淀区',
            confidence: 0.92,
            extractedAt: '2024-02-01T14:20:00Z'
          },
          generatedAt: '2024-02-01T14:20:00Z',
          steps: [],
          metadata: {
            algorithm: 'AgentID-v1.0',
            version: '1.0.0',
            processingTime: 1800,
            dataQuality: 'high',
            validationStatus: 'passed'
          }
        }
      ],
      zkProofs: [],
      currentZKProcess: null,
      zkProofConfig: defaultZKConfig,
      history: [],
      stats: initialStats,
      isLoading: false,
      zkGenerating: false,
      error: null,

      // 配置管理
      setConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig }
        }));
      },

      resetConfig: () => {
        set({ config: defaultConfig });
      },

      // 生成过程管理
      startGeneration: async (file: File) => {
        const state = get();
        set({
          isLoading: true,
          error: null,
          currentProcess: {
            id: Date.now().toString(),
            credentialFile: file,
            config: state.config,
            status: 'processing',
            progress: 0,
            currentStep: 0,
            steps: [],
            startedAt: new Date().toISOString()
          }
        });

        try {
          // 模拟生成过程
          await new Promise(resolve => setTimeout(resolve, 2000));

          // 这里应该调用实际的生成算法
          // 暂时使用模拟数据
          const mockIdentity: GeneratedIdentity = {
            id: Date.now().toString(),
            identityId: `${state.config.prefix}-${Date.now()}`,
            prefix: state.config.prefix,
            hash: 'mock-hash-' + Math.random().toString(36).substring(2),
            confidence: 0.8 + Math.random() * 0.15,
            credentialData: {
              id: Date.now().toString(),
              type: 'id_card',
              name: '张三',
              documentNumber: 'ID123456789',
              issuingCountry: 'CN',
              issuedDate: '2020-01-01',
              expiryDate: '2030-01-01',
              dateOfBirth: '1990-01-01',
              nationality: '中国',
              gender: 'male',
              address: '北京市朝阳区',
              confidence: 0.9,
              extractedAt: new Date().toISOString()
            },
            generatedAt: new Date().toISOString(),
            steps: [],
            metadata: {
              algorithm: 'AgentID-v1.0',
              version: '1.0.0',
              processingTime: 2000,
              dataQuality: 'high',
              validationStatus: 'passed'
            }
          };

          get().completeGeneration(mockIdentity);
        } catch (error) {
          get().failGeneration(error instanceof Error ? error.message : '生成失败');
        } finally {
          set({ isLoading: false });
        }
      },

      updateProcess: (process) => {
        set({ currentProcess: process });
      },

      completeGeneration: (identity) => {
        set((state) => {
          const newIdentities = [...state.identities, identity];
          const historyItem: GenerationHistoryItem = {
            id: identity.id,
            identityId: identity.identityId,
            credentialName: identity.credentialData.name,
            generatedAt: identity.generatedAt,
            confidence: identity.confidence,
            status: 'success',
            preview: identity
          };

          return {
            currentProcess: {
              ...state.currentProcess!,
              status: 'completed',
              result: identity,
              completedAt: new Date().toISOString()
            },
            identities: newIdentities,
            history: [historyItem, ...state.history]
          };
        });

        get().updateStats();
      },

      failGeneration: (error) => {
        set((state) => ({
          currentProcess: state.currentProcess ? {
            ...state.currentProcess,
            status: 'failed',
            error,
            completedAt: new Date().toISOString()
          } : null,
          error
        }));
      },

      resetProcess: () => {
        set({
          currentProcess: null,
          error: null
        });
      },

      // 身份标识管理
      addIdentity: (identity) => {
        set((state) => {
          const newIdentities = [...state.identities, identity];
          const historyItem: GenerationHistoryItem = {
            id: identity.id,
            identityId: identity.identityId,
            credentialName: identity.credentialData.name,
            generatedAt: identity.generatedAt,
            confidence: identity.confidence,
            status: 'success',
            preview: identity
          };

          return {
            identities: newIdentities,
            history: [historyItem, ...state.history]
          };
        });

        get().updateStats();
      },

      removeIdentity: (identityId) => {
        set((state) => ({
          identities: state.identities.filter(id => id.identityId !== identityId)
        }));

        get().updateStats();
      },

      clearIdentities: () => {
        set({ identities: [] });
        get().updateStats();
      },

      // 历史记录管理
      addToHistory: (item) => {
        set((state) => ({
          history: [item, ...state.history]
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      // 统计数据管理
      updateStats: () => {
        const state = get();
        const identities = state.identities;

        if (identities.length === 0) {
          set({ stats: initialStats });
          return;
        }

        const totalGenerated = identities.length;
        const averageConfidence = identities.reduce((sum, id) => sum + id.confidence, 0) / totalGenerated;
        const successRate = (identities.filter(id => id.confidence >= state.config.confidenceThreshold).length / totalGenerated) * 100;
        const averageProcessingTime = identities.reduce((sum, id) => sum + id.metadata.processingTime, 0) / totalGenerated;

        // 按证件类型统计
        const credentialTypeStats: Record<string, number> = {};
        identities.forEach(identity => {
          const type = identity.credentialData.type;
          credentialTypeStats[type] = (credentialTypeStats[type] || 0) + 1;
        });

        // 按日期统计
        const dailyStats: Array<{ date: string; count: number; success: number; failed: number }> = [];
        const dateGroups: Record<string, { count: number; success: number; failed: number }> = {};

        identities.forEach(identity => {
          const date = new Date(identity.generatedAt).toISOString().split('T')[0];
          if (!dateGroups[date]) {
            dateGroups[date] = { count: 0, success: 0, failed: 0 };
          }
          dateGroups[date].count++;
          if (identity.confidence >= state.config.confidenceThreshold) {
            dateGroups[date].success++;
          } else {
            dateGroups[date].failed++;
          }
        });

        Object.entries(dateGroups).forEach(([date, stats]) => {
          dailyStats.push({ date, ...stats });
        });

        dailyStats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        set({
          stats: {
            totalGenerated,
            averageConfidence,
            successRate,
            averageProcessingTime,
            credentialTypeStats,
            dailyStats
          }
        });
      },

      // ZK-KYC证明相关管理
      generateZKProof: async (identityId, config) => {
        const state = get();
        const identity = state.identities.find(id => id.identityId === identityId);

        if (!identity) {
          throw new Error('身份凭证不存在');
        }

        set({
          zkGenerating: true,
          error: null,
          currentZKProcess: {
            id: Date.now().toString(),
            identityId,
            config,
            status: 'preparing',
            progress: 0,
            currentStep: 0,
            steps: [
              {
                id: '1',
                name: '准备身份数据',
                description: '从身份凭证中提取必要信息',
                status: 'pending',
                progress: 0
              },
              {
                id: '2',
                name: '构建证明电路',
                description: '根据选择的证明类型构建零知识电路',
                status: 'pending',
                progress: 0
              },
              {
                id: '3',
                name: '生成证明',
                description: '计算零知识证明',
                status: 'pending',
                progress: 0
              },
              {
                id: '4',
                name: '验证证明',
                description: '验证生成的证明有效性',
                status: 'pending',
                progress: 0
              }
            ],
            startedAt: new Date().toISOString()
          }
        });

        try {
          // 模拟ZK证明生成过程
          await simulateZKProofGeneration(state.currentZKProcess!, (updatedProcess) => {
            get().updateZKProcess(updatedProcess);
          });

          // 生成模拟证明数据
          const proof: ZKKYCProof = {
            id: `zk_proof_${Date.now()}`,
            identityId,
            proofType: config.proofType,
            proofData: {
              publicInputs: generateMockPublicInputs(identity, config.proofType),
              proof: generateMockProof(),
              verificationKey: generateMockVerificationKey(),
              circuitHash: generateMockCircuitHash()
            },
            verificationStatus: 'verified',
            confidence: 0.85 + Math.random() * 0.1,
            metadata: {
              algorithm: 'Groth16',
              version: '1.0.0',
              generatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + config.validityPeriod * 24 * 60 * 60 * 1000).toISOString(),
              processingTime: 3000 + Math.random() * 2000,
              gasUsed: 50000 + Math.floor(Math.random() * 50000),
              transactionHash: generateMockTransactionHash(),
              blockNumber: Math.floor(Math.random() * 1000000)
            },
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'ZK-KYC Verifier v1.0'
          };

          get().completeZKGeneration(proof);
        } catch (error) {
          get().failZKGeneration(error instanceof Error ? error.message : 'ZK证明生成失败');
        } finally {
          set({ zkGenerating: false });
        }
      },

      updateZKProcess: (process) => {
        set({ currentZKProcess: process });
      },

      completeZKGeneration: (proof) => {
        set((state) => {
          const newZKProofs = [...state.zkProofs, proof];

          return {
            currentZKProcess: {
              ...state.currentZKProcess!,
              status: 'completed',
              result: proof,
              completedAt: new Date().toISOString()
            },
            zkProofs: newZKProofs
          };
        });
      },

      failZKGeneration: (error) => {
        set((state) => ({
          currentZKProcess: state.currentZKProcess ? {
            ...state.currentZKProcess,
            status: 'failed',
            error,
            completedAt: new Date().toISOString()
          } : null,
          error
        }));
      },

      resetZKProcess: () => {
        set({
          currentZKProcess: null,
          error: null
        });
      },

      addZKProof: (proof) => {
        set((state) => ({
          zkProofs: [...state.zkProofs, proof]
        }));
      },

      removeZKProof: (proofId) => {
        set((state) => ({
          zkProofs: state.zkProofs.filter(proof => proof.id !== proofId)
        }));
      },

      getZKProofsByIdentity: (identityId) => {
        const state = get();
        return state.zkProofs.filter(proof => proof.identityId === identityId);
      },

      verifyZKProof: async (proofId) => {
        const state = get();
        const proof = state.zkProofs.find(p => p.id === proofId);

        if (!proof) {
          throw new Error('证明不存在');
        }

        // 模拟验证过程
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result: ZKProofVerificationResult = {
          isValid: Math.random() > 0.1, // 90%成功率
          proofId,
          verifiedAt: new Date().toISOString(),
          verifier: 'ZK-KYC Verifier v1.0',
          confidence: 0.9 + Math.random() * 0.1,
          details: {
            publicInputsMatched: true,
            proofFormatValid: true,
            signatureValid: true,
            timestampValid: true
          }
        };

        // 更新证明状态
        set((state) => ({
          zkProofs: state.zkProofs.map(p =>
            p.id === proofId
              ? {
                  ...p,
                  verificationStatus: result.isValid ? 'verified' : 'failed',
                  verifiedAt: result.verifiedAt,
                  verifiedBy: result.verifier
                }
              : p
          )
        }));

        return result;
      },

      setZKProofConfig: (newConfig) => {
        set((state) => ({
          zkProofConfig: { ...state.zkProofConfig, ...newConfig }
        }));
      },

      // UI状态管理
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setZKGenerating: (generating) => {
        set({ zkGenerating: generating });
      },

      setError: (error) => {
        set({ error });
      },

      // 选择器
      getConfig: () => get().config,
      getCurrentProcess: () => get().currentProcess,
      getIdentities: () => get().identities,
      getZKProofs: () => get().zkProofs,
      getCurrentZKProcess: () => get().currentZKProcess,
      getZKProofConfig: () => get().zkProofConfig,
      getHistory: () => get().history,
      getStats: () => get().stats,
      getIsLoading: () => get().isLoading,
      getZKGenerating: () => get().zkGenerating,
      getError: () => get().error
    }),
    {
      name: 'identity-store',
      partialize: (state) => ({
        identities: state.identities,
        zkProofs: state.zkProofs,
        history: state.history,
        stats: state.stats,
        config: state.config,
        zkProofConfig: state.zkProofConfig
      })
    }
  )
);

// ZK-KYC证明生成的辅助函数
async function simulateZKProofGeneration(
  process: ZKProofGenerationProcess,
  onUpdate: (process: ZKProofGenerationProcess) => void
): Promise<void> {
  const steps = [
    { status: 'preparing', duration: 1000 },
    { status: 'generating', duration: 2000 },
    { status: 'verifying', duration: 1000 }
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepIndex = i;

    // 更新为当前步骤
    let updatedProcess: ZKProofGenerationProcess = {
      ...process,
      status: step.status as ZKProofGenerationProcess['status'],
      currentStep: stepIndex,
      steps: process.steps.map((s, index) =>
        index === stepIndex
          ? { ...s, status: 'in_progress' as const, startTime: new Date().toISOString() }
          : index < stepIndex
            ? { ...s, status: 'completed' as const, endTime: new Date().toISOString() }
            : s
      )
    };
    onUpdate(updatedProcess);

    // 模拟进度更新
    const progressUpdates = 5;
    for (let j = 1; j <= progressUpdates; j++) {
      await new Promise(resolve => setTimeout(resolve, step.duration / progressUpdates));

      updatedProcess = {
        ...updatedProcess,
        progress: ((stepIndex * 100) + (j * (100 / steps.length) / progressUpdates)) / 100,
        steps: updatedProcess.steps.map((s, index) =>
          index === stepIndex
            ? { ...s, progress: (j * 100) / progressUpdates }
            : s
        )
      };
      onUpdate(updatedProcess);
    }

    // 完成当前步骤
    updatedProcess = {
      ...updatedProcess,
      steps: updatedProcess.steps.map((s, index) =>
        index === stepIndex
          ? { ...s, status: 'completed' as const, progress: 100, endTime: new Date().toISOString() }
          : s
      )
    };
    onUpdate(updatedProcess);
  }
}

function generateMockPublicInputs(
  identity: GeneratedIdentity,
  proofType: ZKKYCProof['proofType']
): string[] {
  const baseInputs = [
    identity.identityId,
    identity.hash,
    identity.credentialData.name,
    identity.credentialData.dateOfBirth
  ];

  switch (proofType) {
    case 'age_verification':
      return [
        ...baseInputs,
        calculateAge(identity.credentialData.dateOfBirth).toString(),
        '18' // 最低年龄要求
      ];
    case 'nationality_verification':
      return [
        ...baseInputs,
        identity.credentialData.nationality,
        'CN' // 允许的国家代码
      ];
    case 'document_validity':
      return [
        ...baseInputs,
        identity.credentialData.issuedDate,
        identity.credentialData.expiryDate,
        new Date().toISOString()
      ];
    case 'comprehensive_kyc':
    default:
      return [
        ...baseInputs,
        identity.credentialData.nationality,
        calculateAge(identity.credentialData.dateOfBirth).toString(),
        identity.credentialData.issuedDate,
        identity.credentialData.expiryDate,
        identity.credentialData.documentNumber
      ];
  }
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function generateMockProof(): string[] {
  return Array.from({ length: 8 }, () =>
    '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  );
}

function generateMockVerificationKey(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateMockCircuitHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateMockTransactionHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}