import React from 'react';
import { DemoWatermark } from './DemoWatermark';
import { DemoTooltip } from './DemoTooltip';

interface DemoWrapperProps {
  children: React.ReactNode;
  showWatermark?: boolean;
  showTooltip?: boolean;
  tooltipTitle?: string;
  tooltipContent?: string;
  tooltipType?: 'info' | 'warning' | 'success';
}

export const DemoWrapper: React.FC<DemoWrapperProps> = ({
  children,
  showWatermark = true,
  showTooltip = true,
  tooltipTitle = '演示模式',
  tooltipContent = '这是一个演示系统，所有功能均为模拟展示，不涉及真实的身份标识生成和处理。',
  tooltipType = 'info'
}) => {
  return (
    <>
      {showWatermark && <DemoWatermark />}
      {showTooltip && (
        <div style={{ padding: '0 24px' }}>
          <DemoTooltip
            title={tooltipTitle}
            content={tooltipContent}
            type={tooltipType}
          />
        </div>
      )}
      {children}
    </>
  );
};

export default DemoWrapper;