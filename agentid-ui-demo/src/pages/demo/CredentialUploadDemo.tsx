import React from 'react';
import { Card, Row, Col, Typography, Space, Button } from 'antd';
import { CredentialUpload } from '../../components/forms/CredentialUpload';
import { useFileUploadStore } from '../../store/fileUploadStore';

const { Title, Paragraph } = Typography;

export const CredentialUploadDemo: React.FC = () => {
  const {
    files,
    isUploading,
    error,
    totalFiles,
    successfulUploads,
    failedUploads,
    clearFiles
  } = useFileUploadStore();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Title level={2} className="mb-4">
            身份凭证上传演示
          </Title>
          <Paragraph className="text-gray-600 max-w-2xl mx-auto">
            这是一个完整的文件上传组件演示，支持拖拽上传、文件预览、进度显示和错误处理。
          </Paragraph>
        </div>

        {/* Demo Cards */}
        <Row gutter={[24, 24]} className="mb-8">
          {/* Main Upload Component */}
          <Col xs={24} lg={16}>
            <Card title="文件上传区域" className="h-full">
              <CredentialUpload
                onFileSelect={(files) => {
                  console.log('Files selected:', files);
                }}
                onFileUpload={(file) => {
                  console.log('File uploaded:', file);
                }}
                onFileRemove={(fileId) => {
                  console.log('File removed:', fileId);
                }}
                onFileError={(error) => {
                  console.error('Upload error:', error);
                }}
              />
            </Card>
          </Col>

          {/* Stats and Controls */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="large" className="w-full">
              {/* Statistics */}
              <Card title="上传统计" size="small">
                <Space direction="vertical" className="w-full">
                  <div className="flex justify-between">
                    <span>总文件数：</span>
                    <span className="font-medium">{totalFiles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>成功上传：</span>
                    <span className="font-medium text-green-600">{successfulUploads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>上传失败：</span>
                    <span className="font-medium text-red-600">{failedUploads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>上传状态：</span>
                    <span className="font-medium">
                      {isUploading ? '上传中...' : '空闲'}
                    </span>
                  </div>
                </Space>
              </Card>

              {/* Controls */}
              <Card title="控制面板" size="small">
                <Space direction="vertical" className="w-full">
                  <Button
                    type="primary"
                    danger
                    onClick={clearFiles}
                    disabled={totalFiles === 0}
                    block
                  >
                    清空所有文件
                  </Button>

                  {error && (
                    <Button
                      type="default"
                      onClick={() => console.log('Clear error')}
                      block
                    >
                      清除错误
                    </Button>
                  )}
                </Space>
              </Card>

              {/* Demo Info */}
              <Card title="演示说明" size="small">
                <Space direction="vertical" className="w-full">
                  <div className="text-sm text-gray-600">
                    <p>• 支持拖拽和点击上传</p>
                    <p>• 支持多种文件格式</p>
                    <p>• 实时上传进度显示</p>
                    <p>• 文件预览和错误处理</p>
                    <p>• 支持重试失败的上传</p>
                  </div>
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>

        {/* File List */}
        {files.length > 0 && (
          <Card title="已上传文件列表" className="mb-8">
            <div className="text-sm text-gray-600 mb-4">
              <p>当前共有 {files.length} 个文件，其中 {successfulUploads} 个上传成功，{failedUploads} 个上传失败。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <div key={file.id} className="p-3 border rounded-lg">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div className="text-sm text-gray-500">
                    状态: {file.status}
                  </div>
                  <div className="text-sm text-gray-500">
                    进度: {file.progress}%
                  </div>
                  {file.error && (
                    <div className="text-sm text-red-500">
                      错误: {file.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Features List */}
        <Card title="功能特性">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">拖拽上传</h4>
                <p className="text-sm text-blue-600">支持直接拖拽文件到上传区域，操作简单直观。</p>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">文件验证</h4>
                <p className="text-sm text-green-600">自动验证文件类型、大小和数量限制。</p>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">进度显示</h4>
                <p className="text-sm text-purple-600">实时显示上传进度和状态信息。</p>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">文件预览</h4>
                <p className="text-sm text-orange-600">支持图片文件的实时预览功能。</p>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">错误处理</h4>
                <p className="text-sm text-red-600">完善的错误处理和重试机制。</p>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="p-4 bg-cyan-50 rounded-lg">
                <h4 className="font-medium text-cyan-800 mb-2">状态管理</h4>
                <p className="text-sm text-cyan-600">基于Zustand的响应式状态管理。</p>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  );
};