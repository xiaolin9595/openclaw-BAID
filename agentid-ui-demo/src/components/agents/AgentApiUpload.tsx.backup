import React, { useState, useCallback } from 'react';
import {
  Upload,
  Button,
  Alert,
  Typography,
  Space,
  Divider,
  Badge,
  Card,
  List,
  Tag,
  Progress,
  Spin
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import {
  AgentApiSpec,
  AgentApiUploadProps,
  API_FILE_CONFIG
} from '../../types/agent-upload';
import {
  validateFile,
  uploadFile,
  generateFileId
} from '../../utils/file-upload';
import { UploadedFile } from '../../types/file-upload';

const { Text, Title } = Typography;
const { Dragger } = Upload;

const DEMO_WATERMARK = '演示系统 - API上传功能';

// 模拟API规范验证
const mockApiValidation = async (file: File): Promise<{
  isValid: boolean;
  errors: string[];
  endpoints: any[];
}> => {
  // 模拟API验证延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 直接通过验证，不检查规范内容
  const isValid = true;
  const errors = [];

  // 根据文件类型生成默认的API端点
  const fileName = file.name.toLowerCase();
  let endpoints = [];

  if (fileName.includes('openapi') || fileName.includes('swagger')) {
    endpoints = [
      {
        path: '/api/agent/info',
        method: 'GET',
        description: '获取Agent基本信息',
        parameters: [],
        responses: [{ statusCode: 200, description: '成功响应' }]
      },
      {
        path: '/api/agent/health',
        method: 'GET',
        description: '健康检查',
        parameters: [],
        responses: [{ statusCode: 200, description: '服务正常' }]
      },
      {
        path: '/api/agent/execute',
        method: 'POST',
        description: '执行Agent任务',
        parameters: [
          {
            name: 'task',
            type: 'string',
            required: true,
            description: '要执行的任务'
          }
        ],
        responses: [
          { statusCode: 200, description: '执行成功' },
          { statusCode: 400, description: '请求参数错误' }
        ]
      }
    ];
  } else if (fileName.includes('postman')) {
    endpoints = [
      {
        path: '/v1/agent/status',
        method: 'GET',
        description: '获取Agent状态',
        parameters: [],
        responses: [{ statusCode: 200, description: '状态获取成功' }]
      },
      {
        path: '/v1/agent/command',
        method: 'POST',
        description: '发送命令给Agent',
        parameters: [
          {
            name: 'command',
            type: 'string',
            required: true,
            description: '要执行的命令'
          }
        ],
        responses: [
          { statusCode: 200, description: '命令执行成功' },
          { statusCode: 500, description: '内部服务器错误' }
        ]
      }
    ];
  } else {
    // 默认API端点
    endpoints = [
    {
      path: '/api/agent/status',
      method: 'GET',
      description: '获取Agent状态信息',
      parameters: [],
      responses: [{ statusCode: 200, description: '成功响应' }]
    },
    {
      path: '/api/agent/execute',
      method: 'POST',
      description: '执行Agent任务',
      parameters: [
        {
          name: 'task',
          type: 'string',
          required: true,
          description: '要执行的任务'
        }
      ],
      responses: [
        { statusCode: 200, description: '执行成功' },
        { statusCode: 400, description: '请求参数错误' }
      ]
    }
  ];

  return { isValid, errors, endpoints };
};

export const AgentApiUpload: React.FC<AgentApiUploadProps> = ({
  onApiSpecSelect,
  onApiSpecRemove,
  selectedApiSpec = null,
  disabled = false
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    endpoints: any[];
  } | null>(null);

  const handleFileValidation = useCallback((file: File): string | null => {
    // 检查文件扩展名
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (!API_FILE_CONFIG.allowedExtensions.includes(`.${fileExtension}`)) {
      return `不支持的文件类型: .${fileExtension}，支持的类型: ${API_FILE_CONFIG.allowedExtensions.join(', ')}`;
    }

    // 检查文件大小
    if (file.size > API_FILE_CONFIG.maxFileSize) {
      return `文件大小不能超过 ${API_FILE_CONFIG.maxFileSize / 1024 / 1024}MB`;
    }

    return null;
  }, []);

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    const file = newFiles[0]; // 只处理第一个文件
    const validationError = handleFileValidation(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    // 清理之前的文件和结果
    setFiles([]);
    setValidationResult(null);
    setError(null);
    setIsUploading(true);

    try {
      const uploadedFile = await uploadFile(file, (progress) => {
        setFiles(prev => prev.map(f =>
          f.id === uploadedFile.id
            ? { ...f, progress }
            : f
        ));
      });

      setFiles([uploadedFile]);

      // 开始API规范验证
      setIsValidating(true);
      const validation = await mockApiValidation(file);
      setValidationResult(validation);

      if (validation.isValid) {
        const apiSpec: AgentApiSpec = {
          id: generateFileId(),
          name: file.name,
          version: '1.0.0',
          type: file.name.toLowerCase().includes('json') ? 'openapi' : 'custom',
          file: uploadedFile,
          validated: true,
          endpoints: validation.endpoints
        };
        onApiSpecSelect(apiSpec);
      } else {
        setError('API规范验证失败');
      }

    } catch (err) {
      setError('上传过程中发生错误');
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  }, [handleFileValidation, onApiSpecSelect]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled || isUploading || isValidating) return;
    handleFilesAdded(acceptedFiles);
  }, [disabled, isUploading, isValidating, handleFilesAdded]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'application/yaml': ['.yaml', '.yml'],
      'application/x-yaml': ['.yaml', '.yml'],
      'text/yaml': ['.yaml', '.yml'],
      'text/plain': ['.json', '.yaml', '.yml'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    multiple: false,
    disabled: disabled || isUploading || isValidating,
    maxFiles: 1
  });

  const handleRemoveApiSpec = useCallback(() => {
    setFiles([]);
    setValidationResult(null);
    setError(null);
    onApiSpecRemove();
  }, [onApiSpecRemove]);

  const handleRetryUpload = useCallback(async () => {
    if (files.length === 0) return;

    const fileToRetry = files[0];
    setFiles(prev => prev.map(f =>
      f.id === fileToRetry.id
        ? { ...f, status: 'uploading', progress: 0, error: undefined }
        : f
    ));

    try {
      // 模拟重试成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFiles(prev => prev.map(f =>
        f.id === fileToRetry.id
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.id === fileToRetry.id
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
    <div className="space-y-6">
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
          <ApiOutlined className="mr-2" />
          Agent API规范上传
        </Title>
        <Text type="secondary" className="text-sm">
          上传Agent的API规范文档，支持OpenAPI、Postman集合等格式
        </Text>
      </div>

      {/* Selected API Spec Display */}
      {selectedApiSpec && (
        <Card
          title="已选择的API规范"
          extra={
            <Button
              type="text"
              danger
              onClick={handleRemoveApiSpec}
              disabled={disabled}
            >
              移除
            </Button>
          }
          className="mb-4"
        >
          <Space direction="vertical" className="w-full">
            <div className="flex items-center justify-between">
              <div>
                <Text strong>{selectedApiSpec.name}</Text>
                <br />
                <Text type="secondary">类型: {selectedApiSpec.type}</Text>
              </div>
              <div className="text-right">
                {selectedApiSpec.validated ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    已验证
                  </Tag>
                ) : (
                  <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                    待验证
                  </Tag>
                )}
              </div>
            </div>

            {selectedApiSpec.endpoints.length > 0 && (
              <div>
                <Text strong>发现 {selectedApiSpec.endpoints.length} 个API端点:</Text>
                <List
                  size="small"
                  dataSource={selectedApiSpec.endpoints.slice(0, 3)}
                  renderItem={(endpoint) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<FileTextOutlined className="text-blue-500" />}
                        title={`${endpoint.method} ${endpoint.path}`}
                        description={endpoint.description}
                      />
                    </List.Item>
                  )}
                />
                {selectedApiSpec.endpoints.length > 3 && (
                  <Text type="secondary">...还有 {selectedApiSpec.endpoints.length - 3} 个端点</Text>
                )}
              </div>
            )}
          </Space>
        </Card>
      )}

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

      {/* Validation Results */}
      {validationResult && (
        <Alert
          message={
            validationResult.isValid ? 'API规范验证成功' : 'API规范验证失败'
          }
          type={validationResult.isValid ? 'success' : 'error'}
          className="mb-4"
          description={
            validationResult.isValid ? (
              <span>发现 {validationResult.endpoints.length} 个API端点，规范格式正确</span>
            ) : (
              <ul className="list-disc list-inside">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )
          }
        />
      )}

      {/* Upload Zone */}
      {!selectedApiSpec && (
        <div
          {...getRootProps()}
          className={getDropzoneClassName()}
        >
          <input {...getInputProps()} />

          {(isUploading || isValidating) ? (
            <div className="py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text>
                  {isUploading ? '正在上传...' : '正在验证API规范...'}
                </Text>
                <Progress
                  percent={files[0]?.progress || 0}
                  size="small"
                  className="mt-2"
                />
              </div>
            </div>
          ) : (
            <div>
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
                    拖拽API规范文件到这里，或
                  </p>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    disabled={disabled}
                    className="mt-2"
                  >
                    选择文件
                  </Button>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                支持的格式: JSON, YAML, Postman Collection
              </p>
            </div>
          )}
        </div>
      )}

      {/* File Info */}
      {!selectedApiSpec && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Space direction="vertical" size="small" className="w-full">
            <div className="flex items-center">
              <InfoCircleOutlined className="text-blue-500 mr-2" />
              <Text strong className="text-blue-700">API规范要求：</Text>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-blue-600">
              <span>• 支持OpenAPI 3.0规范 (JSON/YAML格式)</span>
              <span>• 支持Postman Collection v2</span>
              <span>• 最大文件大小: {API_FILE_CONFIG.maxFileSize / 1024 / 1024}MB</span>
              <span>• 单次上传一个文件</span>
            </div>
          </Space>
        </div>
      )}

      {/* Demo Notice */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start">
          <InfoCircleOutlined className="text-orange-500 mt-1 mr-3 flex-shrink-0" />
          <div>
            <Text strong className="text-orange-700 block mb-1">
              演示系统说明
            </Text>
            <Text type="secondary" className="text-sm">
              此系统仅用于演示目的，上传的API规范文件仅用于格式验证，
              不会进行真实的API注册或部署。所有数据均为模拟数据。
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};