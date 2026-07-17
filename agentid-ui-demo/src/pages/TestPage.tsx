import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const TestPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>测试页面</Title>
        <p>如果你能看到这个页面，说明路由是工作的。</p>
      </Card>
    </div>
  );
};

export default TestPage;