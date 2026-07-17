import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '../../store';

const { Content } = AntLayout;

const MainLayout: React.FC = () => {
  const { sidebarCollapsed } = useUIStore();

  return (
    <AntLayout className="min-h-screen bg-gray-50">
      <Sidebar />
      <AntLayout
        className="transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? 80 : 256,
        }}
      >
        <Header />
        <Content className="p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default MainLayout;