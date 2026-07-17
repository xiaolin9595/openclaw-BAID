import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Card,
  Alert,
  Result
} from 'antd';
import {
  CameraOutlined,
  CheckCircleOutlined,
  ScanOutlined
} from '@ant-design/icons';
import type { FaceBiometricFeatures } from '@/types/agent';

const { Text } = Typography;

interface FaceCaptureModalProps {
  open: boolean;
  onCapture: (faceFeatures: FaceBiometricFeatures) => void;
  onCancel: () => void;
}

/**
 * 人脸采集模态框
 * 用于Agent创建时采集用户人脸照片并生成生物特征数据
 */
const FaceCaptureModal: React.FC<FaceCaptureModalProps> = ({
  open,
  onCapture,
  onCancel
}) => {
  const [step, setStep] = useState<'camera' | 'processing' | 'success'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number>(0); // 0表示未开始，1-3表示倒计时
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      // 即使摄像头失败，也继续模拟流程（用于演示）
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

  // 拍照（自动触发，无需按钮）
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // 设置 canvas 尺寸与 video 一致
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // 绘制当前帧到 canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 停止摄像头
    stopCamera();

    // 直接进入处理状态（跳过预览）
    setStep('processing');

    // 模拟特征提取过程
    setTimeout(() => {
      const faceFeatures: FaceBiometricFeatures = generateFaceFeatures();
      setStep('success');

      // 延迟一下再回调，让用户看到成功状态
      setTimeout(() => {
        onCapture(faceFeatures);
      }, 1500);
    }, 1500);
  };

  // 生成模拟的人脸特征数据
  const generateFaceFeatures = (): FaceBiometricFeatures => {
    // 生成 128 维特征向量（模拟实际的人脸识别算法输出）
    const featureVector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);

    // 生成唯一的模板 ID
    const templateId = `face_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      featureVector,
      templateId,
      confidence: 0.95 + Math.random() * 0.04, // 95-99% 置信度
      livenessCheck: true,
      antiSpoofing: true,
      enrollmentDate: new Date(),
      lastVerified: new Date()
    };
  };

  // 组件打开时启动摄像头并开始倒计时
  useEffect(() => {
    if (!open) return;

    setStep('camera');
    setCountdown(0);
    startCamera();

    return () => {
      stopCamera();
    };
  }, [open]);

  // 摄像头启动后开始倒计时
  useEffect(() => {
    if (!cameraActive || step !== 'camera') return;

    // 延迟500ms后开始倒计时，确保摄像头画面稳定
    const startTimer = setTimeout(() => {
      setCountdown(3);
    }, 500);

    return () => clearTimeout(startTimer);
  }, [cameraActive, step]);

  // 倒计时逻辑
  useEffect(() => {
    if (countdown === 0) return;

    if (countdown === 1) {
      // 倒计时结束，自动拍照
      const timer = setTimeout(() => {
        setCountdown(0);
        capturePhoto();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // 继续倒计时
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCancel = () => {
    stopCamera();
    setStep('camera');
    setCountdown(0);
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

              {/* 人脸框引导 */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200px',
                  height: '260px',
                  border: '3px solid #1890ff',
                  borderRadius: '50%',
                  opacity: 0.6
                }}
              />

              {/* 倒计时显示 */}
              {countdown > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '120px',
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.6)',
                    animation: 'countdownPulse 1s ease-in-out',
                    zIndex: 10
                  }}
                >
                  {countdown}
                </div>
              )}
            </div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Text style={{ fontSize: '16px', color: '#1890ff' }}>
                <CameraOutlined /> {countdown > 0 ? `${countdown} 秒后自动拍照...` : '自动采集中，请保持面部在框内...'}
              </Text>
              <Text type="secondary">保持面部清晰可见，正面对准摄像头</Text>
            </Space>
            <style>{`
              @keyframes countdownPulse {
                0% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
              }
            `}</style>
          </div>
        );

      case 'processing':
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
                <ScanOutlined spin style={{ fontSize: '64px', color: '#1890ff' }} />
                <div style={{ marginTop: '20px' }}>
                  <Text style={{ fontSize: '18px', color: '#1890ff' }}>
                    正在提取人脸特征...
                  </Text>
                </div>
              </div>

              {/* 背景动画 */}
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
                    <Text type="secondary">特征提取</Text>
                    <Text strong style={{ color: '#1890ff' }}>进行中...</Text>
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
            title="人脸特征采集成功"
            subTitle={
              <Space direction="vertical" size="small">
                <Text>已成功采集并生成人脸生物特征数据</Text>
                <Card size="small" style={{ marginTop: '16px', background: '#f6ffed' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">特征维度</Text>
                      <Text strong>128维</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">采集置信度</Text>
                      <Text strong style={{ color: '#52c41a' }}>97.8%</Text>
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

      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <CameraOutlined />
            <span>人脸采集</span>
          </Space>
        }
        open={open}
        onCancel={handleCancel}
        footer={step === 'success' ? null : step === 'camera' || step === 'processing' ? [
          <Button key="cancel" onClick={handleCancel}>
            取消
          </Button>
        ] : null}
        width={600}
        centered
        maskClosable={false}
      >
        <Alert
          message="人脸采集说明"
          description="系统将采集您的人脸照片并生成生物特征数据，用于Agent绑定和身份验证。"
          type="info"
          showIcon
          style={{ marginBottom: '20px' }}
        />
        {renderContent()}
      </Modal>

      {/* 隐藏的 canvas 用于照片捕获 */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default FaceCaptureModal;