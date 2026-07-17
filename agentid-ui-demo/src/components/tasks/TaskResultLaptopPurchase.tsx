import React from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Rate,
  Button,
  Space,
  Typography,
  Descriptions,
  List,
  Avatar,
  Badge,
  Divider,
  Alert,
  Image,
  Tooltip,
  Statistic,
  Progress
} from 'antd';
import {
  LaptopOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { TaskResult } from '../../types/task';

const { Title, Text, Paragraph } = Typography;

interface LaptopSpec {
  processor: string;
  memory: string;
  storage: string;
  graphics: string;
}

interface LaptopRecommendation {
  id: string;
  brand: string;
  model: string;
  price: number;
  screenSize: string;
  weight: number;
  performance: string;
  suitableFor: string[];
  specs: LaptopSpec;
  pros: string[];
  cons: string[];
  rating: number;
  availability: boolean;
}

interface PurchaseLink {
  laptopId: string;
  platform: string;
  url: string;
  price: number;
  inStock: boolean;
}

interface LaptopPurchaseData {
  type: 'laptop_purchase_result';
  searchParams: {
    budget: string;
    usage: string;
    brands: string[];
    performance: string;
  };
  recommendations: LaptopRecommendation[];
  summary: {
    totalFound: number;
    priceRange: {
      min: number;
      max: number;
    } | null;
    topChoice: LaptopRecommendation | null;
  };
  buyingAdvice: string[];
  purchaseLinks: PurchaseLink[];
}

interface TaskResultLaptopPurchaseProps {
  result: TaskResult;
  loading?: boolean;
}

/**
 * 获取品牌中文名称
 */
const getBrandName = (brand: string): string => {
  const brandMap: Record<string, string> = {
    lenovo: '联想',
    apple: '苹果',
    asus: '华硕',
    dell: '戴尔',
    xiaomi: '小米',
    huawei: '华为',
    hp: '惠普',
    acer: '宏碁',
    msi: '微星',
    alienware: '外星人'
  };
  return brandMap[brand] || brand.toUpperCase();
};

/**
 * 获取用途中文名称
 */
const getUsageName = (usage: string): string => {
  const usageMap: Record<string, string> = {
    office: '办公',
    programming: '编程',
    design: '设计',
    gaming: '游戏',
    student: '学生',
    business: '商务'
  };
  return usageMap[usage] || usage;
};

/**
 * 获取性能等级中文名称
 */
const getPerformanceName = (performance: string): string => {
  const performanceMap: Record<string, string> = {
    low: '入门级',
    medium: '中等',
    high: '高性能',
    extreme: '顶级'
  };
  return performanceMap[performance] || performance;
};

/**
 * 获取性能等级颜色
 */
const getPerformanceColor = (performance: string): string => {
  const colorMap: Record<string, string> = {
    low: 'default',
    medium: 'blue',
    high: 'orange',
    extreme: 'red'
  };
  return colorMap[performance] || 'default';
};

/**
 * 笔记本推荐卡片组件
 */
const LaptopCard: React.FC<{
  laptop: LaptopRecommendation;
  rank: number;
  isTopChoice: boolean;
  purchaseLink?: PurchaseLink;
}> = ({ laptop, rank, isTopChoice, purchaseLink }) => {
  return (
    <Badge.Ribbon
      text={rank === 1 ? '推荐首选' : `第${rank}推荐`}
      color={rank === 1 ? 'red' : rank === 2 ? 'orange' : 'blue'}
    >
      <Card
        hoverable
        cover={
          <div style={{
            height: 200,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <LaptopOutlined style={{ fontSize: 64, color: 'white', opacity: 0.3 }} />
            <div style={{
              position: 'absolute',
              top: 16,
              left: 16,
              color: 'white',
              fontWeight: 'bold'
            }}>
              {getBrandName(laptop.brand)}
            </div>
            {!laptop.availability && (
              <div style={{
                position: 'absolute',
                top: 16,
                right: 16,
              }}>
                <Tag color="red">缺货</Tag>
              </div>
            )}
          </div>
        }
        actions={[
          <Tooltip title="查看详情">
            <InfoCircleOutlined key="info" />
          </Tooltip>,
          <Tooltip title="去购买">
            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              size="small"
              disabled={!laptop.availability}
              onClick={() => {
                if (purchaseLink) {
                  window.open(purchaseLink.url, '_blank');
                }
              }}
            >
              {purchaseLink?.inStock ? '去购买' : '暂无链接'}
            </Button>
          </Tooltip>
        ]}
      >
        <div style={{ minHeight: 320 }}>
          {/* 标题和评分 */}
          <div style={{ marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0, fontSize: 16 }}>
              {laptop.model}
              {isTopChoice && <CrownOutlined style={{ color: '#faad14', marginLeft: 8 }} />}
            </Title>
            <Space align="center" style={{ marginTop: 4 }}>
              <Rate disabled defaultValue={laptop.rating} allowHalf style={{ fontSize: 12 }} />
              <Text type="secondary">({laptop.rating})</Text>
            </Space>
          </div>

          {/* 价格和规格 */}
          <div style={{ marginBottom: 12 }}>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 20, color: '#f50' }}>
                ¥{laptop.price.toLocaleString()}
              </Text>
              <Tag color={getPerformanceColor(laptop.performance)}>
                {getPerformanceName(laptop.performance)}
              </Tag>
            </Space>
            <div>
              <Text type="secondary">
                {laptop.screenSize}寸 | {laptop.weight}kg
              </Text>
            </div>
          </div>

          {/* 核心规格 */}
          <div style={{ marginBottom: 12 }}>
            <Text strong>核心配置</Text>
            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>
              <div>处理器: {laptop.specs.processor}</div>
              <div>内存: {laptop.specs.memory}</div>
              <div>存储: {laptop.specs.storage}</div>
              <div>显卡: {laptop.specs.graphics}</div>
            </div>
          </div>

          {/* 适用场景 */}
          <div style={{ marginBottom: 12 }}>
            <Text strong>适用场景</Text>
            <div style={{ marginTop: 4 }}>
              {laptop.suitableFor.map(use => (
                <Tag key={use} style={{ marginBottom: 2 }}>
                  {getUsageName(use)}
                </Tag>
              ))}
            </div>
          </div>

          {/* 优缺点 */}
          <div>
            <Row gutter={8}>
              <Col span={12}>
                <Text strong style={{ color: '#52c41a', fontSize: 12 }}>优点</Text>
                <div style={{ fontSize: 12, lineHeight: 1.3 }}>
                  {laptop.pros.slice(0, 2).map((pro, index) => (
                    <div key={index} style={{ color: '#52c41a' }}>
                      <CheckCircleOutlined style={{ marginRight: 2 }} />
                      {pro}
                    </div>
                  ))}
                </div>
              </Col>
              <Col span={12}>
                <Text strong style={{ color: '#faad14', fontSize: 12 }}>缺点</Text>
                <div style={{ fontSize: 12, lineHeight: 1.3 }}>
                  {laptop.cons.slice(0, 2).map((con, index) => (
                    <div key={index} style={{ color: '#faad14' }}>
                      <ExclamationCircleOutlined style={{ marginRight: 2 }} />
                      {con}
                    </div>
                  ))}
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Card>
    </Badge.Ribbon>
  );
};

/**
 * 买笔记本任务结果展示组件
 */
const TaskResultLaptopPurchase: React.FC<TaskResultLaptopPurchaseProps> = ({
  result,
  loading = false
}) => {
  if (!result || !result.data) {
    return (
      <Alert
        message="暂无结果数据"
        description="任务尚未完成或结果数据不可用"
        type="info"
        showIcon
      />
    );
  }

  const data = result.data as LaptopPurchaseData;
  const { searchParams, recommendations, summary, buyingAdvice, purchaseLinks } = data;

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 搜索参数概览 */}
      <Card
        title={
          <Space>
            <LaptopOutlined />
            搜索条件概览
          </Space>
        }
        style={{ marginBottom: 16 }}
        size="small"
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="预算范围"
              value={searchParams.budget}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="使用用途"
              value={getUsageName(searchParams.usage)}
              prefix={<ThunderboltOutlined />}
            />
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary">品牌偏好</Text>
              <div style={{ marginTop: 4 }}>
                {searchParams.brands.length > 0 ? (
                  searchParams.brands.map(brand => (
                    <Tag key={brand} color="blue">
                      {getBrandName(brand)}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">不限</Text>
                )}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <Text type="secondary">性能要求</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={getPerformanceColor(searchParams.performance)}>
                  {getPerformanceName(searchParams.performance)}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 搜索结果统计 */}
      {summary && (
        <Card
          title={
            <Space>
              <StarOutlined />
              搜索结果统计
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="找到机型"
                value={summary.totalFound}
                suffix="款"
              />
            </Col>
            {summary.priceRange && (
              <Col span={8}>
                <Statistic
                  title="价格区间"
                  value={`¥${summary.priceRange.min.toLocaleString()} - ¥${summary.priceRange.max.toLocaleString()}`}
                />
              </Col>
            )}
            {summary.topChoice && (
              <Col span={8}>
                <div>
                  <Text type="secondary">推荐首选</Text>
                  <div style={{ marginTop: 4 }}>
                    <Text strong>{summary.topChoice.model}</Text>
                    <div>
                      <Text type="secondary">¥{summary.topChoice.price.toLocaleString()}</Text>
                    </div>
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* 笔记本推荐列表 */}
      {recommendations.length > 0 && (
        <Card
          title={
            <Space>
              <CrownOutlined />
              推荐机型列表
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            {recommendations.map((laptop, index) => {
              const purchaseLink = purchaseLinks.find(link => link.laptopId === laptop.id);
              return (
                <Col key={laptop.id} xs={24} sm={12} lg={8}>
                  <LaptopCard
                    laptop={laptop}
                    rank={index + 1}
                    isTopChoice={summary?.topChoice?.id === laptop.id}
                    purchaseLink={purchaseLink}
                  />
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* 购买建议 */}
      {buyingAdvice.length > 0 && (
        <Card
          title={
            <Space>
              <InfoCircleOutlined />
              购买建议
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <List
            size="small"
            dataSource={buyingAdvice}
            renderItem={(advice, index) => (
              <List.Item>
                <Space>
                  <Badge count={index + 1} style={{ backgroundColor: '#52c41a' }} />
                  <Text>{advice}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 任务执行摘要 */}
      {result.summary && (
        <Card
          title="任务执行摘要"
          size="small"
        >
          <Paragraph>{result.summary}</Paragraph>
          {result.metrics && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                执行时间: {Math.round((result.metrics.executionTime || 0) / 1000)}秒 |
                处理数据: {result.metrics.dataProcessed || 0}条 |
                成功率: {((result.metrics.successRate || 0) * 100).toFixed(1)}%
              </Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default TaskResultLaptopPurchase;