import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  RobotOutlined,
  SearchOutlined,
  UserOutlined,
  BlockOutlined,
  IdcardOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../../store';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/agents',
      icon: <RobotOutlined />,
      label: 'Agent管理',
    },
    {
      key: '/agent-discovery',
      icon: <SearchOutlined />,
      label: 'Agent发现',
    },
    {
      key: '/tasks',
      icon: <PlayCircleOutlined />,
      label: '任务执行',
    },
    {
      key: '/blockchain',
      icon: <BlockOutlined />,
      label: '区块链',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
      width={256}
      className="bg-white shadow-md"
      style={{
        overflow: 'hidden auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        {sidebarCollapsed ? (
          <div className="text-xl font-bold text-blue-600">A</div>
        ) : (
          <div className="text-xl font-bold text-blue-600">AgentID</div>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        className="border-none h-[calc(100vh-8rem)]"
      />

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;