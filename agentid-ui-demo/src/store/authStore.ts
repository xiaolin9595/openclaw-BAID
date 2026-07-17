import { create } from 'zustand';
import { User, AuthSession } from '../types';

interface AuthState {
  // 用户状态
  user: User | null;
  isAuthenticated: boolean;

  // 认证会话
  authSession: AuthSession | null;

  // UI状态
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setAuthSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

// 从localStorage恢复用户状态
const loadUserFromStorage = (): User | null => {
  try {
    const userStr = localStorage.getItem('agentid_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

// 保存用户到localStorage
const saveUserToStorage = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem('agentid_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agentid_user');
    }
  } catch (error) {
    console.error('Failed to save user to localStorage:', error);
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  // 初始状态 - 从localStorage恢复或默认未登录
  user: loadUserFromStorage(),
  isAuthenticated: !!loadUserFromStorage(),
  authSession: null,
  loading: false,
  error: null,

  // Actions
  setUser: (user) => {
    saveUserToStorage(user);
    set({
      user,
      isAuthenticated: !!user,
      error: null
    });
  },

  setAuthSession: (session) => set({ authSession: session }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  logout: () => {
    saveUserToStorage(null);
    set({
      user: null,
      isAuthenticated: false,
      authSession: null,
      error: null
    });
  }
}));