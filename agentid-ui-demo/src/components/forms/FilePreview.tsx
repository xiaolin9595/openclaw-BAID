import React from 'react';
import { Card, Progress, Button, Typography, Alert } from 'antd';
import { DeleteOutlined, ReloadOutlined, FileTextOutlined, PictureOutlined } from '@ant-design/icons';
import { UploadedFile } from '../../types/file-upload';
import { formatFileSize } from '../../utils/file-upload';

const { Text } = Typography;

interface FilePreviewProps {
  file: UploadedFile;
  onRemove?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  onRetry,
  className = ''
}) => {
  const getFileIcon = () => {
    if (file.type.startsWith('image/')) {
      return <PictureOutlined className="text-blue-500 text-2xl" />;
    }
    return <FileTextOutlined className="text-green-500 text-2xl" />;
  };

  const getStatusColor = () => {
    switch (file.status) {
      case 'uploading':
        return 'active';
      case 'success':
        return 'success';
      case 'error':
        return 'exception';
      default:
        return 'normal';
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading':
        return '上传中...';
      case 'success':
        return '上传成功';
      case 'error':
        return '上传失败';
      default:
        return '未知状态';
    }
  };

  return (
    <Card
      className={`${className} hover:shadow-md transition-shadow`}
      size="small"
      actions={[
        <Button
          key="remove"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={onRemove}
          title="删除文件"
        />,
        file.status === 'error' && (
          <Button
            key="retry"
            type="text"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            title="重试上传"
          />
        )
      ].filter(Boolean)}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {getFileIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <Text ellipsis className="text-sm font-medium">
              {file.name}
            </Text>
            <Text type="secondary" className="text-xs">
              {formatFileSize(file.size)}
            </Text>
          </div>

          <div className="flex items-center space-x-2">
            <Text
              type={file.status === 'error' ? 'danger' : 'secondary'}
              className="text-xs"
            >
              {getStatusText()}
            </Text>
          </div>

          {file.status === 'uploading' && (
            <Progress
              percent={Math.round(file.progress)}
              size="small"
              status={getStatusColor()}
              className="mt-2"
            />
          )}

          {file.status === 'error' && file.error && (
            <Alert
              message={file.error}
              type="error"
              className="mt-2"
            />
          )}

          {file.preview && (
            <div className="mt-2">
              <img
                src={file.preview}
                alt={file.name}
                className="w-full h-20 object-cover rounded border"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};