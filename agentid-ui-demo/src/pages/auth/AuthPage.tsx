import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const AuthPage: React.FC = () => {
  return (
    <div>
      <Card>
        <Title level={2}>认证流程演示</Title>
        <p>这里将展示完整的Agent身份认证流程</p>
      </Card>
    </div>
  );
};

export default AuthPage;