import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Steps,
  Progress,
  Space,
  Typography,
  Spin,
  Result,
  Card,
  Alert
} from 'antd';
import {
  CameraOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  ScanOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Step } = Steps;

/**
 * 验证步骤类型定义
 */
type VerificationStep = 'face' | 'zkvm' | 'credential' | 'completed' | 'error';

/**
 * 验证进度状态
 */
interface VerificationProgress {
  step: VerificationStep;
  progress: number;
  message: string;
  status: 'process' | 'finish' | 'error';
}

/**
 * VerificationModal 组件属性
 */
interface VerificationModalProps {
  /** Modal 显示状态 */
  visible: boolean;
  /** 发起通信的 Agent 名称 */
  fromAgentName: string;
  /** 接收通信的 Agent 名称 */
  toAgentName: string;
  /** 验证成功的回调函数 */
  onSuccess: () => void;
  /** 验证失败的回调函数 */
  onError: (error: string) => void;
}

/**
 * VerificationModal - Agent 通信多步骤验证流程组件
 *
 * 实现三步验证流程：
 * 1. 人脸识别验证
 * 2. Agent 身份互验 (zkVM 证明)
 * 3. 可验证凭证权限验证
 *
 * @component
 * @example
 * ```tsx
 * <VerificationModal
 *   visible={true}
 *   fromAgentName="购物助手"
 *   toAgentName="支付助手"
 *   onSuccess={() => console.log('验证成功')}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 */
const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  fromAgentName,
  toAgentName,
  onSuccess,
  onError
}) => {
  // 当前验证步骤状态
  const [currentStep, setCurrentStep] = useState<number>(0);

  // 验证进度状态
  const [verificationProgress, setVerificationProgress] = useState<VerificationProgress>({
    step: 'face',
    progress: 0,
    message: '准备开始验证...',
    status: 'process'
  });

  // 各步骤完成状态
  const [stepsStatus, setStepsStatus] = useState<{
    face: boolean;
    zkvm: boolean;
    credential: boolean;
  }>({
    face: false,
    zkvm: false,
    credential: false
  });

  // 摄像头相关状态
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * 启动摄像头
   */
  const startCamera = async () => {
    try {
      setCameraError(null);
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
      setCameraError('摄像头启动失败，请检查权限设置');
      // 即使摄像头失败，也允许继续流程（演示模式）
      setCameraActive(false);
    }
  };

  /**
   * 停止摄像头
   */
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  /**
   * 重置验证状态
   */
  const resetVerification = () => {
    setCurrentStep(0);
    setVerificationProgress({
      step: 'face',
      progress: 0,
      message: '准备开始验证...',
      status: 'process'
    });
    setStepsStatus({
      face: false,
      zkvm: false,
      credential: false
    });
    setCameraError(null);
    stopCamera();
  };

  /**
   * 模拟步骤1：人脸识别验证（5秒，包含真实摄像头）
   * - 启动摄像头：1秒
   * - 检测人脸：2秒
   * - 验证匹配：2秒
   */
  const simulateFaceVerification = () => {
    setVerificationProgress({
      step: 'face',
      progress: 0,
      message: '正在启动摄像头...',
      status: 'process'
    });

    // 模拟进度更新 - 总时长5秒
    let progress = 0;
    const messages = [
      { threshold: 0, text: '正在启动摄像头...' },
      { threshold: 20, text: '正在检测人脸...' },
      { threshold: 60, text: '人脸匹配中...' },
      { threshold: 100, text: '✓ 身份验证成功' }
    ];

    const interval = setInterval(() => {
      progress += 2; // 5秒完成 (100 / 2 * 100ms = 5000ms)

      // 根据进度更新消息
      const currentMessage = messages
        .filter(m => progress >= m.threshold)
        .pop()?.text || messages[0].text;

      setVerificationProgress(prev => ({
        ...prev,
        progress: Math.min(progress, 100),
        message: currentMessage
      }));

      if (progress >= 100) {
        clearInterval(interval);
        // 标记步骤1完成
        setStepsStatus(prev => ({ ...prev, face: true }));

        // 延迟500ms后进入步骤2
        setTimeout(() => {
          setCurrentStep(1);
          simulateZkvmVerification();
        }, 500);
      }
    }, 100); // 每100ms更新一次
  };

  /**
   * 模拟步骤2：Agent 身份互验（8秒，zkVM 证明）
   * - 生成我的Agent证明：3秒
   * - 验证对方zkVM proof：3秒
   * - 交换验证：2秒
   */
  const simulateZkvmVerification = () => {
    setVerificationProgress({
      step: 'zkvm',
      progress: 0,
      message: '生成我的Agent运行证明...',
      status: 'process'
    });

    let progress = 0;
    const messages = [
      { threshold: 0, text: '生成我的Agent运行证明...' },
      { threshold: 37.5, text: '验证对方Agent的zkVM proof...' },
      { threshold: 75, text: '交换并验证双方证明...' },
      { threshold: 100, text: '✓ zkVM证明验证成功' }
    ];

    const interval = setInterval(() => {
      progress += 1.25; // 8秒完成 (100 / 1.25 * 100ms = 8000ms)

      // 根据进度更新消息
      const currentMessage = messages
        .filter(m => progress >= m.threshold)
        .pop()?.text || messages[0].text;

      setVerificationProgress(prev => ({
        ...prev,
        progress: Math.min(progress, 100),
        message: currentMessage
      }));

      if (progress >= 100) {
        clearInterval(interval);
        // 标记步骤2完成
        setStepsStatus(prev => ({ ...prev, zkvm: true }));

        // 延迟500ms后进入步骤3
        setTimeout(() => {
          setCurrentStep(2);
          simulateCredentialVerification();
        }, 500);
      }
    }, 100);
  };

  /**
   * 模拟步骤3：可验证凭证权限验证（6秒）
   * - 检查我的凭证：2秒
   * - 验证对方权限：2秒
   * - 确认匹配：2秒
   */
  const simulateCredentialVerification = () => {
    setVerificationProgress({
      step: 'credential',
      progress: 0,
      message: '检查我的Agent权限凭证...',
      status: 'process'
    });

    let progress = 0;
    const messages = [
      { threshold: 0, text: '检查我的Agent权限凭证...' },
      { threshold: 33, text: '验证对方Agent权限范围...' },
      { threshold: 66, text: '确认双方权限匹配...' },
      { threshold: 100, text: '✓ 权限验证通过' }
    ];

    const interval = setInterval(() => {
      progress += 1.67; // 6秒完成 (100 / 1.67 * 100ms ≈ 6000ms)

      // 根据进度更新消息
      const currentMessage = messages
        .filter(m => progress >= m.threshold)
        .pop()?.text || messages[0].text;

      setVerificationProgress(prev => ({
        ...prev,
        progress: Math.min(progress, 100),
        message: currentMessage
      }));

      if (progress >= 100) {
        clearInterval(interval);
        // 标记步骤3完成
        setStepsStatus(prev => ({ ...prev, credential: true }));

        // 延迟500ms后显示完成状态
        setTimeout(() => {
          setVerificationProgress({
            step: 'completed',
            progress: 100,
            message: '所有验证步骤已完成',
            status: 'finish'
          });

          // 停止摄像头
          stopCamera();

          // 延迟1秒后关闭Modal并调用成功回调
          setTimeout(() => {
            onSuccess();
          }, 1000);
        }, 500);
      }
    }, 100);
  };

  /**
   * Modal 打开时启动验证流程
   */
  useEffect(() => {
    if (visible) {
      resetVerification();
      // 启动摄像头
      startCamera();
      // 延迟500ms后开始第一步验证
      setTimeout(() => {
        simulateFaceVerification();
      }, 500);
    }

    // 清理函数：Modal关闭时停止摄像头
    return () => {
      if (visible) {
        stopCamera();
      }
    };
  }, [visible]);

  /**
   * 渲染步骤图标
   */
  const renderStepIcon = (step: number) => {
    if (stepsStatus.face && step === 0) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    if (stepsStatus.zkvm && step === 1) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    if (stepsStatus.credential && step === 2) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }

    // 当前进行中的步骤显示 Spin
    if (currentStep === step) {
      return <Spin size="small" />;
    }

    // 未开始的步骤显示默认图标
    const icons = [
      <CameraOutlined />,
      <RobotOutlined />,
      <SafetyCertificateOutlined />
    ];
    return icons[step];
  };

  /**
   * 渲染当前步骤的详细内容
   */
  const renderStepContent = () => {
    if (verificationProgress.step === 'completed') {
      return (
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: '72px' }} />}
          title="验证成功"
          subTitle={
            <Space direction="vertical" size="small">
              <Text>所有验证步骤已完成，通信即将建立</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {fromAgentName} ⇄ {toAgentName}
              </Text>
            </Space>
          }
        />
      );
    }

    if (verificationProgress.step === 'error') {
      return (
        <Result
          status="error"
          icon={<CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '72px' }} />}
          title="验证失败"
          subTitle={verificationProgress.message}
        />
      );
    }

    // 步骤1：人脸识别 - 显示摄像头预览
    if (verificationProgress.step === 'face') {
      return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          {/* 摄像头预览区域 */}
          <div
            style={{
              width: '300px',
              height: '225px',
              margin: '0 auto 24px',
              background: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            {/* 摄像头视频流 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)' // 镜像效果
              }}
            />

            {/* 人脸识别框 */}
            {cameraActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '150px',
                  height: '200px',
                  border: '3px solid #52c41a',
                  borderRadius: '50%',
                  opacity: 0.6,
                  boxShadow: '0 0 20px rgba(82, 196, 26, 0.5)'
                }}
              />
            )}

            {/* 扫描线动画 */}
            {cameraActive && verificationProgress.progress > 20 && (
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
            )}

            {/* 摄像头未启动提示 */}
            {!cameraActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#fff',
                  textAlign: 'center'
                }}
              >
                <CameraOutlined style={{ fontSize: '48px', marginBottom: '8px' }} />
                <div style={{ fontSize: '14px' }}>正在启动摄像头...</div>
              </div>
            )}
          </div>

          {/* 摄像头错误提示 */}
          {cameraError && (
            <Alert
              message={cameraError}
              description="继续使用演示模式进行验证"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 步骤消息 */}
          <div style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, color: '#1890ff' }}>
              <ScanOutlined spin={verificationProgress.progress > 0} /> {verificationProgress.message}
            </Text>
          </div>

          {/* 进度条 */}
          <div style={{ marginBottom: 24 }}>
            <Progress
              percent={Math.round(verificationProgress.progress)}
              status={verificationProgress.status === 'error' ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068'
              }}
            />
          </div>

          {/* 扫描线动画样式 */}
          <style>{`
            @keyframes scan {
              0% { top: 0; }
              100% { top: 100%; }
            }
          `}</style>
        </div>
      );
    }

    // 其他步骤的动画和进度
    const stepIcons: Record<VerificationStep, React.ReactNode> = {
      face: <CameraOutlined style={{ fontSize: 48, color: '#1890ff' }} />,
      zkvm: <RobotOutlined style={{ fontSize: 48, color: '#1890ff' }} />,
      credential: <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1890ff' }} />,
      completed: null,
      error: null
    };

    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        {/* 步骤图标和动画 */}
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 80
          }}
        >
          <Spin spinning={verificationProgress.status === 'process'} size="large">
            {stepIcons[verificationProgress.step]}
          </Spin>
        </div>

        {/* 步骤消息 */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, color: '#1890ff' }}>
            {verificationProgress.message}
          </Text>
        </div>

        {/* 进度条 */}
        <div style={{ marginBottom: 24 }}>
          <Progress
            percent={Math.round(verificationProgress.progress)}
            status={verificationProgress.status === 'error' ? 'exception' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068'
            }}
          />
        </div>

        {/* Agent 信息卡片 */}
        {verificationProgress.step === 'zkvm' && (
          <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #adc6ff' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <RobotOutlined style={{ color: '#1890ff' }} />
                  <Text strong>{fromAgentName}</Text>
                </Space>
                <Text type="secondary">⇄</Text>
                <Space>
                  <Text strong>{toAgentName}</Text>
                  <RobotOutlined style={{ color: '#1890ff' }} />
                </Space>
              </div>
            </Space>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
          <span>Agent 通信验证流程</span>
        </Space>
      }
      open={visible}
      onCancel={undefined} // 禁用取消按钮
      footer={null} // 不显示底部按钮
      width={700}
      centered
      maskClosable={false} // 禁止点击遮罩关闭
      closable={false} // 禁用关闭按钮
    >
      {/* 验证步骤指示器 */}
      <div style={{ marginBottom: 32 }}>
        <Steps current={currentStep} size="small">
          <Step
            title="人脸识别验证"
            icon={renderStepIcon(0)}
            status={stepsStatus.face ? 'finish' : currentStep === 0 ? 'process' : 'wait'}
          />
          <Step
            title="Agent 身份互验"
            icon={renderStepIcon(1)}
            status={stepsStatus.zkvm ? 'finish' : currentStep === 1 ? 'process' : 'wait'}
            description="zkVM 证明"
          />
          <Step
            title="凭证权限验证"
            icon={renderStepIcon(2)}
            status={stepsStatus.credential ? 'finish' : currentStep === 2 ? 'process' : 'wait'}
          />
        </Steps>
      </div>

      {/* 步骤内容区域 */}
      {renderStepContent()}

      {/* 提示信息 */}
      {verificationProgress.step !== 'completed' && verificationProgress.step !== 'error' && (
        <div
          style={{
            backgroundColor: '#f0f5ff',
            border: '1px solid #adc6ff',
            borderRadius: 4,
            padding: 12,
            marginTop: 16
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Space direction="vertical" size={4}>
              <div>🔒 验证过程中使用零知识证明技术保护隐私</div>
              <div>⚡ 所有验证步骤均在安全环境中执行</div>
              <div>✓ 验证完成后将自动建立安全通信通道</div>
            </Space>
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default VerificationModal;
