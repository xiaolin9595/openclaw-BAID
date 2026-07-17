import { create } from 'zustand';

// 简化的 Agent 发现 Store
interface AgentDiscoveryStore {
  // 基础状态
  isLoading: boolean;
  error: string | null;

  // 动作
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAgentDiscoveryStore = create<AgentDiscoveryStore>((set) => ({
  // 初始状态
  isLoading: false,
  error: null,

  // 动作实现
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null })
}));