import React from 'react';

const styles = {
  watermarkContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    zIndex: 9999,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute' as const,
    transform: 'rotate(-45deg)',
    opacity: 0.1,
    fontSize: '16px',
    color: '#1890ff',
    fontWeight: 'bold' as const,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
};

interface DemoWatermarkProps {
  text?: string;
  density?: 'low' | 'medium' | 'high';
}

export const DemoWatermark: React.FC<DemoWatermarkProps> = ({
  text = 'AgentID 演示系统',
  density = 'medium'
}) => {

  const getWatermarkPositions = () => {
    const positions = [];
    const spacing = density === 'low' ? 300 : density === 'medium' ? 200 : 150;

    for (let x = -200; x < window.innerWidth + 200; x += spacing) {
      for (let y = -200; y < window.innerHeight + 200; y += spacing) {
        positions.push({ x, y });
      }
    }

    return positions;
  };

  const positions = getWatermarkPositions();

  return (
    <div style={styles.watermarkContainer}>
      {positions.map((pos, index) => (
        <div
          key={index}
          style={{
            ...styles.watermark,
            left: `${pos.x}px`,
            top: `${pos.y}px`,
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
};

export default DemoWatermark;