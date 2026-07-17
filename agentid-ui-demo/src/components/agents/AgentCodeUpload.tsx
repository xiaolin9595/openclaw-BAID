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
  Spin,
  Select,
  Tree,
  Collapse
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  FileOutlined
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import {
  AgentCodePackage,
  AgentCodeUploadProps,
  AgentLanguage,
  CODE_FILE_CONFIG,
  CodeStructure
} from '../../types/agent-upload';
import {
  uploadFile,
  generateFileId
} from '../../utils/file-upload';
import { UploadedFile } from '../../types/file-upload';

const { Text, Title } = Typography;
const { Dragger } = Upload;
const { Option } = Select;
const { Panel } = Collapse;

const DEMO_WATERMARK = '演示系统 - 代码上传功能';


// 递归渲染文件树
const renderFileTree = (files: string[], directories: string[]) => {
  const treeData: any[] = [];

  // 构建目录结构
  directories.forEach(dir => {
    const dirFiles = files.filter(f => f.startsWith(`${dir}/`));
    if (dirFiles.length > 0) {
      treeData.push({
        title: dir,
        key: dir,
        icon: <FolderOutlined />,
        children: dirFiles.map(f => ({
          title: f.split('/').pop(),
          key: f,
          icon: <FileOutlined />,
          isLeaf: true
        }))
      });
    }
  });

  // 添加根级文件
  const rootFiles = files.filter(f => !f.includes('/'));
  rootFiles.forEach(file => {
    treeData.push({
      title: file,
      key: file,
      icon: <FileOutlined />,
      isLeaf: true
    });
  });

  return treeData;
};

export const AgentCodeUpload: React.FC<AgentCodeUploadProps> = ({
  onCodePackageSelect,
  onCodePackageRemove,
  selectedCodePackage = null,
  disabled = false,
  supportedLanguages
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<AgentLanguage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0 || !selectedLanguage) return;

    const file = newFiles[0]; // 只处理第一个文件

    // 清理之前的文件
    setFiles([]);
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

      // 直接创建代码包，不进行验证
      const codePackage: AgentCodePackage = {
        id: generateFileId(),
        name: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
        version: '1.0.0',
        language: selectedLanguage,
        files: [uploadedFile],
        entryFile: `src/index.${selectedLanguage.id === 'typescript' ? 'ts' : 'js'}`,
        structure: {
          directories: ['src'],
          files: [`src/index.${selectedLanguage.id === 'typescript' ? 'ts' : 'js'}`],
          dependencies: [],
          hasEntryFile: true,
          hasConfigFile: false,
          hasTestFiles: false
        },
        validated: false
      };
      onCodePackageSelect(codePackage);

    } catch (err) {
      setError('上传过程中发生错误');
    } finally {
      setIsUploading(false);
    }
  }, [selectedLanguage, onCodePackageSelect]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled || isUploading || !selectedLanguage) return;
    handleFilesAdded(acceptedFiles);
  }, [disabled, isUploading, selectedLanguage, handleFilesAdded]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/x-tar': ['.tar'],
      'application/x-gzip': ['.tar.gz'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z']
    },
    multiple: false,
    disabled: disabled || isUploading || !selectedLanguage,
    maxFiles: 1
  });

  const handleRemoveCodePackage = useCallback(() => {
    setFiles([]);
    setError(null);
    setSelectedLanguage(null);
    onCodePackageRemove();
  }, [onCodePackageRemove]);

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

    if (disabled || !selectedLanguage) {
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
          <CodeOutlined className="mr-2" />
          Agent代码包上传
        </Title>
        <Text type="secondary" className="text-sm">
          上传Agent的源代码包，支持多种编程语言的压缩包格式
        </Text>
      </div>

      {/* Language Selection */}
      <Card title="选择编程语言" className="mb-4">
        <Select
          placeholder="请选择Agent的编程语言"
          style={{ width: '100%' }}
          value={selectedLanguage?.id || null}
          onChange={(value) => {
            const language = supportedLanguages.find(lang => lang.id === value);
            setSelectedLanguage(language || null);
          }}
          disabled={disabled || !!selectedCodePackage}
        >
          {supportedLanguages.map((language) => (
            <Option key={language.id} value={language.id}>
              <Space>
                <span>{language.name}</span>
                <Tag>{language.type === 'interpreted' ? '解释型' : '编译型'}</Tag>
                <Tag color="blue">{language.version}</Tag>
              </Space>
            </Option>
          ))}
        </Select>
      </Card>

      {/* Selected Code Package Display */}
      {selectedCodePackage && (
        <Card
          title="已选择的代码包"
          extra={
            <Button
              type="text"
              danger
              onClick={handleRemoveCodePackage}
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
                <Text strong>{selectedCodePackage.name}</Text>
                <br />
                <Text type="secondary">
                  语言: {selectedCodePackage.language.name} {selectedCodePackage.language.version}
                </Text>
              </div>
              <div className="text-right">
                <Tag color="default" icon={<CheckCircleOutlined />}>
                    已上传
                  </Tag>
              </div>
            </div>

            <div>
              <Text strong>项目结构:</Text>
              <Collapse size="small" className="mt-2">
                <Panel header="文件树" key="file-tree">
                  <Tree
                    showLine
                    treeData={renderFileTree(
                      selectedCodePackage.structure.files,
                      selectedCodePackage.structure.directories
                    )}
                    defaultExpandAll
                  />
                </Panel>
                <Panel header="依赖信息" key="dependencies">
                  <div className="space-y-2">
                    <Text strong>检测到 {selectedCodePackage.structure.dependencies.length} 个依赖:</Text>
                    <div className="flex flex-wrap gap-2">
                      {selectedCodePackage.structure.dependencies.map((dep, index) => (
                        <Tag key={index} color="blue">{dep}</Tag>
                      ))}
                    </div>
                  </div>
                </Panel>
                <Panel header="项目特性" key="features">
                  <Space direction="vertical" size="small">
                    <div className="flex items-center justify-between">
                      <Text>入口文件:</Text>
                      <Tag color={selectedCodePackage.structure.hasEntryFile ? 'success' : 'default'}>
                        {selectedCodePackage.structure.hasEntryFile ? '已找到' : '未找到'}
                      </Tag>
                    </div>
                    <div className="flex items-center justify-between">
                      <Text>配置文件:</Text>
                      <Tag color={selectedCodePackage.structure.hasConfigFile ? 'success' : 'default'}>
                        {selectedCodePackage.structure.hasConfigFile ? '已找到' : '未找到'}
                      </Tag>
                    </div>
                    <div className="flex items-center justify-between">
                      <Text>测试文件:</Text>
                      <Tag color={selectedCodePackage.structure.hasTestFiles ? 'success' : 'default'}>
                        {selectedCodePackage.structure.hasTestFiles ? '已找到' : '未找到'}
                      </Tag>
                    </div>
                  </Space>
                </Panel>
              </Collapse>
            </div>
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

      
      {/* Upload Zone */}
      {!selectedCodePackage && selectedLanguage && (
        <div
          {...getRootProps()}
          className={getDropzoneClassName()}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text>
                  正在上传...
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
                  {isDragReject ? '文件类型不支持' : '拖拽代码包到这里'}
                </p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-1">
                    拖拽{selectedLanguage.name}代码包到这里，或
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
                支持的格式: ZIP, TAR.GZ, RAR, 7Z
              </p>
            </div>
          )}
        </div>
      )}

      {/* File Info */}
      {!selectedCodePackage && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Space direction="vertical" size="small" className="w-full">
            <div className="flex items-center">
              <InfoCircleOutlined className="text-blue-500 mr-2" />
              <Text strong className="text-blue-700">代码包要求：</Text>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-blue-600">
              <span>• 支持的格式: {CODE_FILE_CONFIG.allowedExtensions.join(', ')}</span>
              <span>• 最大文件大小: {CODE_FILE_CONFIG.maxFileSize / 1024 / 1024}MB</span>
              <span>• 必须包含标准的入口文件 (如index.js, main.py等)</span>
              <span>• 建议包含package.json或requirements.txt等配置文件</span>
              <span>• 单次上传一个代码包</span>
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
              此系统仅用于演示目的，上传的代码包仅用于功能演示，
              不会进行真实的代码编译或部署。所有数据均为模拟数据。
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};