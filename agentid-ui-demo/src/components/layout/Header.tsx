import React from 'react';
import { Layout, Button, Avatar, Dropdown, Space, Badge } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuthStore, useUIStore } from '../../store';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { notifications, sidebarCollapsed } = useUIStore();

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => console.log('Profile clicked'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => console.log('Settings clicked'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  const notificationMenuItems = notifications.map((notification: any) => ({
    key: notification.id,
    label: (
      <div className="p-2">
        <div className="font-medium">{notification.title}</div>
        <div className="text-sm text-gray-600">{notification.message}</div>
      </div>
    ),
  }));

  return (
    <AntHeader
      className="bg-white shadow-sm border-b border-gray-200 px-6"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        width: `calc(100% - ${sidebarCollapsed ? 80 : 256}px)`,
      }}
    >
      <div className="flex items-center justify-between h-full">
        {/* 左侧 - 可以放置面包屑或标题 */}
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-800">
            AgentID 管理平台
          </h1>
        </div>

        {/* 右侧 - 用户操作区域 */}
        <Space size="large">
          {/* 通知图标 */}
          <Dropdown
            menu={{ items: notificationMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Badge count={notifications.length} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                className="hover:bg-gray-100"
              />
            </Badge>
          </Dropdown>

          {/* 用户菜单 */}
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <div className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <Avatar size="small" icon={<UserOutlined />} />
              <span className="ml-2 text-sm font-medium">
                {user?.username || '未登录'}
              </span>
            </div>
          </Dropdown>
        </Space>
      </div>
    </AntHeader>
  );
};

export default Header;