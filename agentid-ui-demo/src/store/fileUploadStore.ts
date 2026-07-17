import { create } from 'zustand';
import { UploadedFile, FileUploadConfig, FileUploadActions } from '../types/file-upload';
import { DEFAULT_UPLOAD_CONFIG } from '../utils/file-upload';

interface FileUploadState {
  // 文件数据
  files: UploadedFile[];

  // 上传状态
  isUploading: boolean;
  isProcessing: boolean;

  // 错误状态
  error: string | null;

  // 配置
  config: FileUploadConfig;

  // 统计信息
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;

  // Actions
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  updateFile: (fileId: string, updates: Partial<UploadedFile>) => void;
  setUploading: (isUploading: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  updateConfig: (config: Partial<FileUploadConfig>) => void;
  retryUpload: (fileId: string) => void;
  resetState: () => void;
}

export const useFileUploadStore = create<FileUploadState>((set, get) => ({
  // 初始状态
  files: [],
  isUploading: false,
  isProcessing: false,
  error: null,
  config: DEFAULT_UPLOAD_CONFIG,
  totalFiles: 0,
  successfulUploads: 0,
  failedUploads: 0,

  // Actions
  addFiles: (files) => set((state) => {
    const newFiles = [...state.files, ...files];
    const totalFiles = newFiles.length;
    const successfulUploads = newFiles.filter(f => f.status === 'success').length;
    const failedUploads = newFiles.filter(f => f.status === 'error').length;

    return {
      files: newFiles,
      totalFiles,
      successfulUploads,
      failedUploads
    };
  }),

  removeFile: (fileId) => set((state) => {
    const newFiles = state.files.filter(f => f.id !== fileId);
    const totalFiles = newFiles.length;
    const successfulUploads = newFiles.filter(f => f.status === 'success').length;
    const failedUploads = newFiles.filter(f => f.status === 'error').length;

    return {
      files: newFiles,
      totalFiles,
      successfulUploads,
      failedUploads
    };
  }),

  clearFiles: () => set({
    files: [],
    totalFiles: 0,
    successfulUploads: 0,
    failedUploads: 0,
    error: null
  }),

  updateFile: (fileId, updates) => set((state) => {
    const newFiles = state.files.map(file =>
      file.id === fileId ? { ...file, ...updates } : file
    );

    const successfulUploads = newFiles.filter(f => f.status === 'success').length;
    const failedUploads = newFiles.filter(f => f.status === 'error').length;

    return {
      files: newFiles,
      successfulUploads,
      failedUploads
    };
  }),

  setUploading: (isUploading) => set({ isUploading }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  setError: (error) => set({ error }),

  updateConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),

  retryUpload: (fileId) => {
    const state = get();
    const fileToRetry = state.files.find(f => f.id === fileId);

    if (fileToRetry) {
      // 更新文件状态为上传中
      state.updateFile(fileId, {
        status: 'uploading',
        progress: 0,
        error: undefined
      });

      // 模拟重试上传
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% 成功率

        state.updateFile(fileId, {
          status: success ? 'success' : 'error',
          progress: success ? 100 : 0,
          error: success ? undefined : '重试失败'
        });
      }, 1000 + Math.random() * 2000);
    }
  },

  resetState: () => set({
    files: [],
    isUploading: false,
    isProcessing: false,
    error: null,
    config: DEFAULT_UPLOAD_CONFIG,
    totalFiles: 0,
    successfulUploads: 0,
    failedUploads: 0
  })
}));