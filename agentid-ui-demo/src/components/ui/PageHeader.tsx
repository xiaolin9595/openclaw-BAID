import React from 'react';
import { PageHeader as AntPageHeader } from '@ant-design/pro-components';
import { Breadcrumb } from 'antd';
import { useLocation } from 'react-router-dom';
import { BreadcrumbItem } from '@types';

interface PageHeaderProps {
  title: string;
  subTitle?: string;
  breadcrumb?: BreadcrumbItem[];
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subTitle,
  breadcrumb,
  extra,
  children,
}) => {
  const location = useLocation();

  const defaultBreadcrumb = breadcrumb || [
    {
      title: '首页',
      path: '/',
    },
    {
      title,
    },
  ];

  const breadcrumbItems = defaultBreadcrumb.map((item, index) => ({
    title: item.title,
    href: item.path,
  }));

  return (
    <div className="mb-6">
      <AntPageHeader
        title={title}
        subTitle={subTitle}
        breadcrumb={{
          routes: breadcrumbItems,
          itemRender: (route, params, routes) => {
            const last = routes.indexOf(route) === routes.length - 1;
            return last ? (
              <span>{route.breadcrumbName}</span>
            ) : (
              <a href={route.path}>{route.breadcrumbName}</a>
            );
          },
        }}
        extra={extra}
        className="site-page-header"
        style={{
          backgroundColor: '#fff',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
        }}
      >
        {children}
      </AntPageHeader>
    </div>
  );
};

export default PageHeader;