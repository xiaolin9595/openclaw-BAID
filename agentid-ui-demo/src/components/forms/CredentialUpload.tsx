import React, { useState, useCallback, useMemo } from 'react';
import { Button, Alert, Typography, Space, Divider, Badge } from 'antd';
import { InboxOutlined, UploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import { FilePreview } from './FilePreview';
import {
  UploadedFile,
  FileValidationError,
  FileUploadProps
} from '../../types/file-upload';
import {
  DEFAULT_UPLOAD_CONFIG,
  validateFile,
  uploadFile
} from '../../utils/file-upload';

const { Text, Title } = Typography;

const DEMO_WATERMARK = '演示系统 - 数据仅为示例';

export const CredentialUpload: React.FC<FileUploadProps> = ({
  config = DEFAULT_UPLOAD_CONFIG,
  onFileSelect,
  onFileUpload,
  onFileRemove,
  onFileError,
  disabled = false,
  className = ''
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergedConfig = useMemo(() => ({
    ...DEFAULT_UPLOAD_CONFIG,
    ...config
  }), [config]);

  const handleFileValidation = useCallback((file: File): FileValidationError | null => {
    return validateFile(file, mergedConfig);
  }, [mergedConfig]);

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: FileValidationError[] = [];

    newFiles.forEach(file => {
      const validationError = handleFileValidation(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      const firstError = errors[0];
      setError(firstError.message);
      onFileError?.(firstError);
    }

    if (validFiles.length === 0) {
      return;
    }

    // Check max files limit
    const totalFiles = files.length + validFiles.length;
    if (totalFiles > mergedConfig.maxFiles) {
      setError(`最多只能上传 ${mergedConfig.maxFiles} 个文件`);
      onFileError?.({
        code: 'TOO_MANY_FILES',
        message: `最多只能上传 ${mergedConfig.maxFiles} 个文件`
      });
      return;
    }

    onFileSelect?.(validFiles);
    setIsUploading(true);
    setError(null);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (const file of validFiles) {
        const uploadedFile = await uploadFile(file, (progress) => {
          setFiles(prev => prev.map(f =>
            f.id === uploadedFile.id
              ? { ...f, progress }
              : f
          ));
        });

        uploadedFiles.push(uploadedFile);
        setFiles(prev => [...prev, uploadedFile]);
        onFileUpload?.(uploadedFile);
      }
    } catch {
      setError('上传过程中发生错误');
    } finally {
      setIsUploading(false);
    }
  }, [files, mergedConfig, handleFileValidation, onFileSelect, onFileUpload, onFileError]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled || isUploading) return;
    handleFilesAdded(acceptedFiles);
  }, [disabled, isUploading, handleFilesAdded]);

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: mergedConfig.allowMultiple,
    disabled: disabled || isUploading,
    maxFiles: mergedConfig.maxFiles - files.length
  });

  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    onFileRemove?.(fileId);
  }, [onFileRemove]);

  const handleRetryUpload = useCallback(async (fileId: string) => {
    const fileToRetry = files.find(f => f.id === fileId);
    if (!fileToRetry) return;

    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, status: 'uploading', progress: 0, error: undefined }
        : f
    ));

    try {
      // For demo purposes, simulate successful retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));
    } catch {
      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'error', error: '重试失败' }
          : f
      ));
    }
  }, [files]);

  const getDropzoneClassName = () => {
    let className = 'border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200';

    if (disabled) {
      className += ' border-gray-300 bg-gray-50 cursor-not-allowed';
    } else if (isDragReject) {
      className += ' border-red-500 bg-red-50';
    } else if (isDragActive) {
      className += ' border-blue-500 bg-blue-50';
    } else {
      className += ' border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50';
    }

    return className;
  };

  return (
    <div className={className}>
      {/* Demo Watermark */}
      <div className="mb-4">
        <Badge
          color="orange"
          text={DEMO_WATERMARK}
          className="text-orange-600"
        />
      </div>

      {/* Title and Description */}
      <div className="mb-6">
        <Title level={4} className="mb-2">
          身份凭证上传
        </Title>
        <Text type="secondary" className="text-sm">
          上传身份证明文件以生成唯一身份标识（演示系统）
        </Text>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message={error}
          type="error"
          className="mb-4"
          closable
          onClose={() => setError(null)}
        />
      )}

      {/* File Info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Space direction="vertical" size="small" className="w-full">
          <div className="flex items-center">
            <InfoCircleOutlined className="text-blue-500 mr-2" />
            <Text strong className="text-blue-700">支持的文件类型：</Text>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-600">
            <span>• 图片：JPG, PNG, GIF, WebP</span>
            <span>• 文档：PDF, DOC, DOCX</span>
            <span>• 最大文件：{mergedConfig.maxFileSize / 1024 / 1024}MB</span>
            <span>• 最多文件：{mergedConfig.maxFiles}个</span>
          </div>
        </Space>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={getDropzoneClassName()}
      >
        <input {...getInputProps()} />
        <p className="text-lg mb-2">
          <InboxOutlined className="text-4xl text-gray-400 mb-2" />
        </p>

        {isDragActive ? (
          <p className="text-blue-600 font-medium">
            {isDragReject ? '文件类型不支持' : '拖拽文件到这里'}
          </p>
        ) : (
          <div>
            <p className="text-gray-600 mb-1">
              拖拽文件到这里，或
            </p>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              disabled={disabled || isUploading}
              className="mt-2"
              onClick={(event) => {
                event.stopPropagation();
                open();
              }}
            >
              选择文件
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          支持拖拽上传和批量上传
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <>
          <Divider className="my-6" />
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <Text strong>已上传文件 ({files.length}/{mergedConfig.maxFiles})</Text>
              {files.some(f => f.status === 'uploading') && (
                <Badge status="processing" text="上传中..." />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <FilePreview
                  key={file.id}
                  file={file}
                  onRemove={() => handleRemoveFile(file.id)}
                  onRetry={() => handleRetryUpload(file.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Demo Notice */}
      <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start">
          <InfoCircleOutlined className="text-orange-500 mt-1 mr-3 flex-shrink-0" />
          <div>
            <Text strong className="text-orange-700 block mb-1">
              演示系统说明
            </Text>
            <Text type="secondary" className="text-sm">
              此系统仅用于演示目的，上传的文件不会被真实处理或保存。
              所有数据均为模拟数据，仅用于展示功能流程。
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};
