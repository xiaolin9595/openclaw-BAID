import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Progress,
  Space,
  Typography,
  Card,
  Alert,
  Button,
  Result
} from 'antd';
import {
  CameraOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  ScanOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface FaceVerificationModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  userName?: string;
}

/**
 * 人脸识别验证模态框（演示版本）
 * 模拟人脸识别流程，自动通过验证
 */
const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({
  open,
  onSuccess,
  onCancel,
  userName = '用户'
}) => {
  const [step, setStep] = useState<'camera' | 'scanning' | 'analyzing' | 'success' | 'error'>('camera');
  const [progress, setProgress] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 启动摄像头
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('摄像头启动失败:', error);
      // 即使摄像头失败，也继续模拟流程
      setCameraActive(true);
    }
  };

  // 停止摄像头
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // 模拟验证流程
  useEffect(() => {
    if (!open) return;

    setStep('camera');
    setProgress(0);
    startCamera();

    // 自动进入扫描阶段
    const timer1 = setTimeout(() => {
      setStep('scanning');
      simulateProgress('scanning');
    }, 1500);

    return () => {
      clearTimeout(timer1);
      stopCamera();
    };
  }, [open]);

  // 模拟进度条
  const simulateProgress = (currentStep: string) => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 5;
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        clearInterval(interval);
        if (currentStep === 'scanning') {
          setStep('analyzing');
          setTimeout(() => simulateProgress('analyzing'), 500);
        } else if (currentStep === 'analyzing') {
          setStep('success');
          setTimeout(() => {
            stopCamera();
            onSuccess();
          }, 1500);
        }
      }
    }, 100);
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const renderContent = () => {
    switch (step) {
      case 'camera':
        return (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '100%',
                height: '360px',
                background: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '20px'
              }}
            >
              {cameraActive && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )}
              {!cameraActive && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#fff'
                  }}
                >
                  <CameraOutlined style={{ fontSize: '64px' }} />
                </div>
              )}

              {/* 人脸框 */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200px',
                  height: '260px',
                  border: '3px solid #52c41a',
                  borderRadius: '50%',
                  opacity: 0.6
                }}
              />
            </div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Text style={{ fontSize: '16px', color: '#1890ff' }}>
                <CameraOutlined /> 正在启动摄像头...
              </Text>
              <Text type="secondary">请将面部置于框内</Text>
            </Space>
          </div>
        );

      case 'scanning':
        return (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '100%',
                height: '360px',
                background: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '20px'
              }}
            >
              {cameraActive && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )}

              {/* 扫描线动画 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #52c41a, transparent)',
                  animation: 'scan 2s linear infinite'
                }}
              />

              {/* 人脸识别框 */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200px',
                  height: '260px',
                  border: '3px solid #52c41a',
                  borderRadius: '50%',
                  boxShadow: '0 0 20px rgba(82, 196, 26, 0.5)'
                }}
              />
            </div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Text style={{ fontSize: '16px', color: '#52c41a' }}>
                <ScanOutlined spin /> 正在扫描人脸特征...
              </Text>
              <Progress percent={progress} strokeColor="#52c41a" />
            </Space>
            <style>{`
              @keyframes scan {
                0% { top: 0; }
                100% { top: 100%; }
              }
            `}</style>
          </div>
        );

      case 'analyzing':
        return (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '100%',
                height: '360px',
                background: '#f0f2f5',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <LoadingOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                <div style={{ marginTop: '20px' }}>
                  <Text style={{ fontSize: '18px', color: '#1890ff' }}>
                    正在分析特征数据...
                  </Text>
                </div>
              </div>

              {/* 背景动画粒子 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle, rgba(24,144,255,0.1) 0%, transparent 70%)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}
              />
            </div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">面部匹配度</Text>
                    <Text strong>98.5%</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">活体检测</Text>
                    <Text strong style={{ color: '#52c41a' }}>通过</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">防伪检测</Text>
                    <Text strong style={{ color: '#52c41a' }}>通过</Text>
                  </div>
                </Space>
              </Card>
              <Progress percent={progress} strokeColor="#1890ff" />
            </Space>
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.05); }
              }
            `}</style>
          </div>
        );

      case 'success':
        return (
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="身份验证成功"
            subTitle={
              <Space direction="vertical" size="small">
                <Text>欢迎回来，{userName}！</Text>
                <Text type="secondary">身份验证已通过，可以继续操作</Text>
                <Card size="small" style={{ marginTop: '16px', background: '#f6ffed' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">验证置信度</Text>
                      <Text strong style={{ color: '#52c41a' }}>98.5%</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">验证时间</Text>
                      <Text strong>2.3秒</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">安全等级</Text>
                      <Text strong style={{ color: '#52c41a' }}>高</Text>
                    </div>
                  </Space>
                </Card>
              </Space>
            }
          />
        );

      case 'error':
        return (
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            title="验证失败"
            subTitle="未能识别您的身份，请重试"
            extra={
              <Button type="primary" onClick={() => setStep('camera')}>
                重新验证
              </Button>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined />
          <span>人脸识别身份验证</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={step === 'success' ? null : [
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>
      ]}
      width={600}
      centered
      maskClosable={false}
    >
      <Alert
        message="安全提示"
        description="系统将使用人脸识别技术验证您的身份，以确保操作安全性。"
        type="info"
        showIcon
        style={{ marginBottom: '20px' }}
      />
      {renderContent()}
    </Modal>
  );
};

export default FaceVerificationModal;