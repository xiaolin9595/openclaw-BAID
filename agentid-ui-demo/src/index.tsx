import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { CredentialUploadDemo } from './pages/demo/CredentialUploadDemo';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <CredentialUploadDemo />
    </ConfigProvider>
  </React.StrictMode>
);