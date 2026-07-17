export interface UploadedFile {
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
}

export interface FileUploadConfig {
  maxFileSize: number;
  allowedTypes: string[];
  maxFiles: number;
  allowMultiple: boolean;
}

export interface FileValidationError {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'TOO_MANY_FILES' | 'UNKNOWN_ERROR';
  message: string;
  file?: File;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  progress: number;
}

export interface FileUploadProps {
  config?: Partial<FileUploadConfig>;
  onFileSelect?: (files: File[]) => void;
  onFileUpload?: (file: UploadedFile) => void;
  onFileRemove?: (fileId: string) => void;
  onFileError?: (error: FileValidationError) => void;
  disabled?: boolean;
  className?: string;
}

export interface FilePreviewProps {
  file: UploadedFile;
  onRemove?: () => void;
  onRetry?: () => void;
  className?: string;
}

export interface UploadZoneProps {
  isDragActive: boolean;
  isDragReject: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  disabled?: boolean;
  className?: string;
}

export interface FileUploadState {
  files: UploadedFile[];
  isUploading: boolean;
  error: string | null;
  config: FileUploadConfig;
}

export interface FileUploadActions {
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  retryUpload: (fileId: string) => void;
  setError: (error: string | null) => void;
  updateProgress: (fileId: string, progress: number) => void;
  updateFileStatus: (fileId: string, status: UploadedFile['status'], error?: string) => void;
}