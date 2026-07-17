import { UploadedFile, FileUploadConfig, FileValidationError } from '../types/file-upload';

export const DEFAULT_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFiles: 5,
  allowMultiple: true
};

export function validateFile(file: File, config: FileUploadConfig): FileValidationError | null {
  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `文件大小不能超过 ${formatFileSize(config.maxFileSize)}`,
      file
    };
  }

  // Check file type with extension fallback
  const fileType = file.type.toLowerCase();
  const fileExtension = getFileExtension(file.name).toLowerCase();

  // Map extensions to MIME types for files without proper MIME type
  const extensionToMime = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  const effectiveFileType = fileType || extensionToMime[fileExtension as keyof typeof extensionToMime];

  if (!effectiveFileType || !config.allowedTypes.includes(effectiveFileType)) {
    return {
      code: 'INVALID_TYPE',
      message: `不支持的文件类型: ${fileExtension.toUpperCase()}`,
      file
    };
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex + 1).toLowerCase();
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isDocumentFile(file: File): boolean {
  return [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ].includes(file.type);
}

export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadedFile> {
  const fileId = generateFileId();
  const preview = await createFilePreview(file);

  const uploadedFile: UploadedFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    preview,
    status: 'uploading',
    progress: 0,
    uploadedAt: new Date()
  };

  try {
    // Simulate upload progress
    await simulateUploadProgress((progress) => {
      onProgress?.(progress);
    });

    uploadedFile.status = 'success';
    uploadedFile.progress = 100;

    // In a real application, this would be the actual URL from the server
    uploadedFile.url = URL.createObjectURL(file);

    return uploadedFile;
  } catch (error) {
    uploadedFile.status = 'error';
    uploadedFile.error = error instanceof Error ? error.message : '上传失败';
    throw error;
  }
}

function simulateUploadProgress(onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        onProgress(progress);
        resolve();
      } else {
        onProgress(progress);
      }
    }, 200);
  });
}

export function createMockUploadedFile(file: File): UploadedFile {
  return {
    id: generateFileId(),
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'success',
    progress: 100,
    uploadedAt: new Date()
  };
}