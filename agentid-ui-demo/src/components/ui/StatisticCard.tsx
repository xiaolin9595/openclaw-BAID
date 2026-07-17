import React from 'react';
import { Card, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface StatisticCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  valueStyle?: React.CSSProperties;
}

const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  icon,
  trend,
  prefix,
  suffix,
  className = '',
  valueStyle,
}) => {
  return (
    <Card
      className={`statistic-card ${className} hover:shadow-lg transition-all duration-300`}
      bordered={false}
      style={{
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-500 mb-2">{title}</div>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {prefix}{value}{suffix}
          </div>
          {trend && (
            <div className="flex items-center">
              <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                trend.isPositive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {trend.isPositive ? (
                  <ArrowUpOutlined className="mr-1" />
                ) : (
                  <ArrowDownOutlined className="mr-1" />
                )}
                {Math.abs(trend.value)}%
              </div>
              <span className="ml-2 text-xs text-gray-500">vs 上期</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="ml-4 flex items-center justify-center w-14 h-14 rounded-xl text-2xl"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatisticCard;