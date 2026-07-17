import React from 'react';
import { Card, Typography, Button } from 'antd';

const { Title, Paragraph } = Typography;

const SimpleTestPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>测试页面</Title>
        <Paragraph>
          这是一个简单的测试页面，用来验证基本的React和Antd组件是否正常工作。
        </Paragraph>
        <Button type="primary">测试按钮</Button>
      </Card>
    </div>
  );
};

export default SimpleTestPage;