import { create } from 'zustand';
import { Notification } from '../types';

interface UIState {
  // 主题和布局
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;

  // 通知
  notifications: Notification[];

  // 全局加载状态
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;

  // 模态框
  activeModal: string | null;
  modalData: any;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setGlobalLoading: (loading: boolean) => void;
  setLoadingState: (key: string, loading: boolean) => void;
  setActiveModal: (modal: string | null, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // 初始状态
  theme: 'light',
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  notifications: [],
  globalLoading: false,
  loadingStates: {},
  activeModal: null,
  modalData: null,

  // Actions
  setTheme: (theme) => set({ theme }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  addNotification: (notification) => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      id,
      duration: 5000,
      closable: true,
      ...notification
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }));

    // 自动移除通知
    if (notification.duration !== 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, notification.duration || 5000);
    }
  },

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] }),

  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  setLoadingState: (key, loading) => set((state) => ({
    loadingStates: { ...state.loadingStates, [key]: loading }
  })),

  setActiveModal: (modal, data) => set({
    activeModal: modal,
    modalData: data
  }),

  closeModal: () => set({
    activeModal: null,
    modalData: null
  })
}));