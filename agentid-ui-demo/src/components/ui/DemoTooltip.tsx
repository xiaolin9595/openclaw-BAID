import React, { useState } from 'react';
import { Alert, Button, Typography, Space, Card } from 'antd';
import { InfoCircleOutlined, CloseOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface DemoTooltipProps {
  title: string;
  content: string;
  type?: 'info' | 'warning' | 'success';
  showActions?: boolean;
  onClose?: () => void;
}

export const DemoTooltip: React.FC<DemoTooltipProps> = ({
  title,
  content,
  type = 'info',
  showActions = true,
  onClose
}) => {
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        borderLeft: `4px solid ${
          type === 'info' ? '#1890ff' :
          type === 'warning' ? '#faad14' : '#52c41a'
        }`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <InfoCircleOutlined
          style={{
            fontSize: 16,
            color: type === 'info' ? '#1890ff' :
                   type === 'warning' ? '#faad14' : '#52c41a',
            marginRight: 8,
            marginTop: 2,
          }}
        />
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 14 }}>
            {title}
          </Text>
          <Paragraph style={{ margin: '8px 0 0 0', fontSize: 13 }}>
            {content}
          </Paragraph>
          {showActions && (
            <Space style={{ marginTop: 8 }}>
              <Button size="small" type="primary">
                了解更多
              </Button>
              <Button size="small" onClick={handleClose}>
                不再显示
              </Button>
            </Space>
          )}
        </div>
        {onClose && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClose}
            style={{ marginLeft: 8 }}
          />
        )}
      </div>
    </Card>
  );
};

export default DemoTooltip;