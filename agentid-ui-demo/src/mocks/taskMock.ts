/**
 * 任务执行相关的 Mock 数据
 */

import {
  TaskTemplate,
  TaskParameter,
  TaskParameterType,
  TaskType,
  TaskStatus,
  TaskExecution,
  TaskLog,
  TaskResult,
  TaskArtifact,
  TaskStatistics,
  TaskMonitorStatus,
  TaskFormConfig
} from '../types/task';
import { BlockchainAgent } from '../types/blockchain';

/**
 * 生成随机ID
 */
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 生成随机日期
 */
export const generateRandomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

/**
 * 任务参数配置 Mock 数据
 */
export const mockTaskParameters: Record<string, TaskParameter[]> = {
  data_processing: [
    {
      id: 'data_source',
      name: '数据源',
      type: TaskParameterType.STRING,
      description: '输入数据源路径或URL',
      required: true,
      defaultValue: '',
      ui: {
        component: 'input',
        placeholder: '请输入数据源路径或URL'
      }
    },
    {
      id: 'output_format',
      name: '输出格式',
      type: TaskParameterType.ENUM,
      description: '选择输出数据格式',
      required: true,
      defaultValue: 'json',
      validation: {
        enum: ['json', 'csv', 'xml', 'parquet']
      },
      ui: {
        component: 'select',
        options: [
          { label: 'JSON', value: 'json' },
          { label: 'CSV', value: 'csv' },
          { label: 'XML', value: 'xml' },
          { label: 'Parquet', value: 'parquet' }
        ]
      }
    },
    {
      id: 'batch_size',
      name: '批处理大小',
      type: TaskParameterType.NUMBER,
      description: '设置批处理大小',
      required: false,
      defaultValue: 1000,
      validation: {
        min: 100,
        max: 10000
      },
      ui: {
        component: 'slider',
        placeholder: '100-10000'
      }
    },
    {
      id: 'enable_compression',
      name: '启用压缩',
      type: TaskParameterType.BOOLEAN,
      description: '是否启用数据压缩',
      required: false,
      defaultValue: true,
      ui: {
        component: 'checkbox'
      }
    }
  ],
  content_generation: [
    {
      id: 'prompt',
      name: '生成提示',
      type: TaskParameterType.STRING,
      description: '输入内容生成提示词',
      required: true,
      defaultValue: '',
      ui: {
        component: 'textarea',
        placeholder: '请输入生成提示词...',
        rows: 4
      }
    },
    {
      id: 'content_type',
      name: '内容类型',
      type: TaskParameterType.ENUM,
      description: '选择生成的内容类型',
      required: true,
      defaultValue: 'article',
      validation: {
        enum: ['article', 'blog', 'report', 'summary', 'translation']
      },
      ui: {
        component: 'select',
        options: [
          { label: '文章', value: 'article' },
          { label: '博客', value: 'blog' },
          { label: '报告', value: 'report' },
          { label: '摘要', value: 'summary' },
          { label: '翻译', value: 'translation' }
        ]
      }
    },
    {
      id: 'max_length',
      name: '最大长度',
      type: TaskParameterType.NUMBER,
      description: '生成内容的最大长度',
      required: false,
      defaultValue: 1000,
      validation: {
        min: 100,
        max: 5000
      },
      ui: {
        component: 'slider',
        placeholder: '100-5000'
      }
    },
    {
      id: 'style',
      name: '写作风格',
      type: TaskParameterType.STRING,
      description: '指定写作风格',
      required: false,
      defaultValue: 'professional',
      ui: {
        component: 'input',
        placeholder: '如：专业、 casual、学术等'
      }
    }
  ],
  analysis: [
    {
      id: 'analysis_type',
      name: '分析类型',
      type: TaskParameterType.ENUM,
      description: '选择分析类型',
      required: true,
      defaultValue: 'sentiment',
      validation: {
        enum: ['sentiment', 'topic', 'keyword', 'entity', 'trend']
      },
      ui: {
        component: 'select',
        options: [
          { label: '情感分析', value: 'sentiment' },
          { label: '主题分析', value: 'topic' },
          { label: '关键词提取', value: 'keyword' },
          { label: '实体识别', value: 'entity' },
          { label: '趋势分析', value: 'trend' }
        ]
      }
    },
    {
      id: 'input_text',
      name: '输入文本',
      type: TaskParameterType.STRING,
      description: '待分析的文本内容',
      required: true,
      defaultValue: '',
      ui: {
        component: 'textarea',
        placeholder: '请输入待分析的文本...',
        rows: 6
      }
    },
    {
      id: 'language',
      name: '语言',
      type: TaskParameterType.ENUM,
      description: '文本语言',
      required: true,
      defaultValue: 'zh',
      validation: {
        enum: ['zh', 'en', 'ja', 'ko', 'fr', 'de']
      },
      ui: {
        component: 'select',
        options: [
          { label: '中文', value: 'zh' },
          { label: '英文', value: 'en' },
          { label: '日文', value: 'ja' },
          { label: '韩文', value: 'ko' },
          { label: '法文', value: 'fr' },
          { label: '德文', value: 'de' }
        ]
      }
    }
  ],
  // 买笔记本任务参数
  laptop_purchase: [
    {
      id: 'budget_min',
      name: '最低预算',
      type: TaskParameterType.NUMBER,
      description: '笔记本购买的最低预算（人民币）',
      required: true,
      defaultValue: 3000,
      validation: {
        min: 1000,
        max: 50000
      },
      ui: {
        component: 'input-number',
        placeholder: '请输入最低预算',
        addonAfter: '元'
      }
    },
    {
      id: 'budget_max',
      name: '最高预算',
      type: TaskParameterType.NUMBER,
      description: '笔记本购买的最高预算（人民币）',
      required: true,
      defaultValue: 8000,
      validation: {
        min: 1000,
        max: 50000
      },
      ui: {
        component: 'input-number',
        placeholder: '请输入最高预算',
        addonAfter: '元'
      }
    },
    {
      id: 'usage_type',
      name: '主要用途',
      type: TaskParameterType.ENUM,
      description: '笔记本的主要使用场景',
      required: true,
      defaultValue: 'office',
      validation: {
        enum: ['office', 'gaming', 'design', 'programming', 'student', 'business']
      },
      ui: {
        component: 'select',
        placeholder: '请选择主要用途',
        options: [
          { label: '办公学习', value: 'office' },
          { label: '游戏娱乐', value: 'gaming' },
          { label: '设计创作', value: 'design' },
          { label: '编程开发', value: 'programming' },
          { label: '学生使用', value: 'student' },
          { label: '商务出差', value: 'business' }
        ]
      }
    },
    {
      id: 'screen_size',
      name: '屏幕尺寸',
      type: TaskParameterType.ENUM,
      description: '期望的屏幕尺寸范围',
      required: true,
      defaultValue: '14-15',
      validation: {
        enum: ['13', '14-15', '16-17', 'any']
      },
      ui: {
        component: 'select',
        placeholder: '请选择屏幕尺寸',
        options: [
          { label: '13英寸以下（便携）', value: '13' },
          { label: '14-15英寸（平衡）', value: '14-15' },
          { label: '16-17英寸（大屏）', value: '16-17' },
          { label: '不限制', value: 'any' }
        ]
      }
    },
    {
      id: 'brand_preference',
      name: '品牌偏好',
      type: TaskParameterType.ARRAY,
      description: '偏好的笔记本品牌（可多选）',
      required: false,
      defaultValue: [],
      validation: {
        enum: ['apple', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi', 'razer', 'surface', 'huawei', 'xiaomi']
      },
      ui: {
        component: 'checkbox',
        options: [
          { label: 'Apple MacBook', value: 'apple' },
          { label: 'Dell 戴尔', value: 'dell' },
          { label: 'HP 惠普', value: 'hp' },
          { label: 'Lenovo 联想', value: 'lenovo' },
          { label: 'ASUS 华硕', value: 'asus' },
          { label: 'Acer 宏碁', value: 'acer' },
          { label: 'MSI 微星', value: 'msi' },
          { label: 'Razer 雷蛇', value: 'razer' },
          { label: 'Surface', value: 'surface' },
          { label: 'Huawei 华为', value: 'huawei' },
          { label: 'Xiaomi 小米', value: 'xiaomi' }
        ]
      }
    },
    {
      id: 'performance_level',
      name: '性能要求',
      type: TaskParameterType.ENUM,
      description: '对性能的要求程度',
      required: true,
      defaultValue: 'medium',
      validation: {
        enum: ['low', 'medium', 'high', 'extreme']
      },
      ui: {
        component: 'select',
        placeholder: '请选择性能要求',
        options: [
          { label: '基础性能（日常办公）', value: 'low' },
          { label: '中等性能（多任务处理）', value: 'medium' },
          { label: '高性能（专业工作）', value: 'high' },
          { label: '极致性能（游戏/创作）', value: 'extreme' }
        ]
      }
    },
    {
      id: 'weight_preference',
      name: '重量偏好',
      type: TaskParameterType.ENUM,
      description: '对笔记本重量的要求',
      required: false,
      defaultValue: 'balanced',
      validation: {
        enum: ['ultra_light', 'light', 'balanced', 'any']
      },
      ui: {
        component: 'select',
        placeholder: '请选择重量偏好',
        options: [
          { label: '超轻薄（<1.5kg）', value: 'ultra_light' },
          { label: '轻便（1.5-2kg）', value: 'light' },
          { label: '平衡（2-2.5kg）', value: 'balanced' },
          { label: '不限制', value: 'any' }
        ]
      }
    },
    {
      id: 'storage_type',
      name: '存储偏好',
      type: TaskParameterType.ENUM,
      description: '存储类型和容量偏好',
      required: false,
      defaultValue: 'ssd_512',
      validation: {
        enum: ['ssd_256', 'ssd_512', 'ssd_1tb', 'any']
      },
      ui: {
        component: 'select',
        placeholder: '请选择存储偏好',
        options: [
          { label: 'SSD 256GB（够用）', value: 'ssd_256' },
          { label: 'SSD 512GB（推荐）', value: 'ssd_512' },
          { label: 'SSD 1TB+（大容量）', value: 'ssd_1tb' },
          { label: '不限制', value: 'any' }
        ]
      }
    },
    {
      id: 'special_requirements',
      name: '特殊需求',
      type: TaskParameterType.STRING,
      description: '其他特殊需求或偏好（可选）',
      required: false,
      defaultValue: '',
      ui: {
        component: 'textarea',
        placeholder: '请描述其他特殊需求，如：触屏、数字键盘、特定接口、颜色偏好等',
        rows: 3
      }
    }
  ]
};

/**
 * 任务模板 Mock 数据
 */
export const mockTaskTemplates: TaskTemplate[] = [
  {
    id: 'template_data_analysis',
    name: '数据分析任务',
    description: '对大规模数据集进行清洗、转换和分析',
    type: TaskType.DATA_PROCESSING,
    category: '数据处理',
    version: '1.2.0',
    agentTypes: ['AI Assistant', 'Data Processing'],
    parameters: mockTaskParameters.data_processing,
    expectedOutput: {
      type: 'structured_data',
      description: '处理后的结构化数据和分析报告'
    },
    estimatedDuration: 300,
    maxRetries: 3,
    timeout: 600,
    tags: ['数据分析', 'ETL', '处理'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    isActive: true
  },
  {
    id: 'template_content_generation',
    name: '内容生成任务',
    description: '基于AI模型生成高质量文本内容',
    type: TaskType.CONTENT_GENERATION,
    category: '内容创作',
    version: '2.0.1',
    agentTypes: ['AI Assistant', 'Content Generation'],
    parameters: mockTaskParameters.content_generation,
    expectedOutput: {
      type: 'text_content',
      description: '生成的文本内容'
    },
    estimatedDuration: 120,
    maxRetries: 2,
    timeout: 300,
    tags: ['AI', '内容生成', '创作'],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-20'),
    isActive: true
  },
  {
    id: 'template_text_analysis',
    name: '文本分析任务',
    description: '对文本内容进行深度分析和挖掘',
    type: TaskType.ANALYSIS,
    category: '文本处理',
    version: '1.5.0',
    agentTypes: ['AI Assistant', 'Analysis'],
    parameters: mockTaskParameters.analysis,
    expectedOutput: {
      type: 'analysis_report',
      description: '文本分析结果报告'
    },
    estimatedDuration: 180,
    maxRetries: 3,
    timeout: 360,
    tags: ['文本分析', 'NLP', 'AI'],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-25'),
    isActive: true
  },
  {
    id: 'template_security_scan',
    name: '安全扫描任务',
    description: '扫描系统安全漏洞和威胁',
    type: TaskType.SECURITY,
    category: '安全监控',
    version: '3.0.0',
    agentTypes: ['AI Assistant', 'Security'],
    parameters: [
      {
        id: 'target_url',
        name: '目标URL',
        type: TaskParameterType.STRING,
        description: '要扫描的目标URL或IP地址',
        required: true,
        ui: {
          component: 'input',
          placeholder: 'https://example.com'
        }
      },
      {
        id: 'scan_type',
        name: '扫描类型',
        type: TaskParameterType.ENUM,
        description: '选择扫描类型',
        required: true,
        defaultValue: 'full',
        validation: {
          enum: ['quick', 'full', 'deep']
        },
        ui: {
          component: 'select',
          options: [
            { label: '快速扫描', value: 'quick' },
            { label: '全面扫描', value: 'full' },
            { label: '深度扫描', value: 'deep' }
          ]
        }
      }
    ],
    expectedOutput: {
      type: 'security_report',
      description: '安全扫描报告'
    },
    estimatedDuration: 600,
    maxRetries: 1,
    timeout: 1200,
    tags: ['安全', '扫描', '漏洞检测'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-30'),
    isActive: true
  },
  {
    id: 'template_monitoring',
    name: '系统监控任务',
    description: '监控系统性能和健康状态',
    type: TaskType.MONITORING,
    category: '系统运维',
    version: '1.8.0',
    agentTypes: ['AI Assistant', 'Monitoring'],
    parameters: [
      {
        id: 'metrics',
        name: '监控指标',
        type: TaskParameterType.ARRAY,
        description: '选择要监控的指标',
        required: true,
        defaultValue: ['cpu', 'memory', 'disk'],
        ui: {
          component: 'checkbox',
          options: [
            { label: 'CPU使用率', value: 'cpu' },
            { label: '内存使用率', value: 'memory' },
            { label: '磁盘使用率', value: 'disk' },
            { label: '网络流量', value: 'network' }
          ]
        }
      },
      {
        id: 'interval',
        name: '监控间隔',
        type: TaskParameterType.NUMBER,
        description: '监控数据采集间隔（秒）',
        required: true,
        defaultValue: 60,
        validation: {
          min: 10,
          max: 3600
        },
        ui: {
          component: 'slider',
          placeholder: '10-3600秒'
        }
      }
    ],
    expectedOutput: {
      type: 'metrics_data',
      description: '监控指标数据'
    },
    estimatedDuration: 0, // 持续监控
    maxRetries: 5,
    timeout: 7200,
    tags: ['监控', '性能', '运维'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-02-05'),
    isActive: true
  },
  {
    id: 'template_laptop_purchase',
    name: '买笔记本',
    description: '根据用户需求推荐和协助购买笔记本电脑',
    type: TaskType.LAPTOP_PURCHASE,
    category: '购物助手',
    version: '1.0.0',
    agentTypes: ['购物助手', '产品推荐', 'AI Assistant'],
    parameters: mockTaskParameters.laptop_purchase,
    expectedOutput: {
      type: 'purchase_recommendation',
      description: '推荐的笔记本列表、价格对比和购买建议'
    },
    estimatedDuration: 180,
    maxRetries: 3,
    timeout: 600,
    tags: ['购物', '笔记本', '产品推荐', '价格对比'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-15'),
    isActive: true
  }
];

/**
 * 任务日志 Mock 数据
 */
export const mockTaskLogs: TaskLog[] = [
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 60000),
    level: 'info',
    message: '任务开始执行',
    source: 'system',
    data: { taskId: 'task_1' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 55000),
    level: 'info',
    message: '正在加载任务配置',
    source: 'agent',
    data: { templateId: 'template_data_analysis' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 50000),
    level: 'info',
    message: '开始连接数据源',
    source: 'agent',
    data: { dataSource: '/data/sales_2024.csv' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 45000),
    level: 'info',
    message: '数据源连接成功',
    source: 'agent',
    data: { recordCount: 15420 }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 40000),
    level: 'info',
    message: '开始数据清洗',
    source: 'agent',
    data: { stage: 'data_cleaning' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 35000),
    level: 'warn',
    message: '发现异常数据，正在处理',
    source: 'agent',
    data: { anomalyCount: 156 }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 30000),
    level: 'info',
    message: '数据清洗完成',
    source: 'agent',
    data: { cleanedRecords: 15264, removedRecords: 156 }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 25000),
    level: 'info',
    message: '开始数据分析',
    source: 'agent',
    data: { stage: 'analysis' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 20000),
    level: 'info',
    message: '生成分析报告',
    source: 'agent',
    data: { reportType: 'sales_analysis' }
  },
  {
    id: generateId('log'),
    timestamp: new Date(Date.now() - 15000),
    level: 'info',
    message: '任务执行完成',
    source: 'system',
    data: { duration: 45000, success: true }
  }
];

/**
 * 任务结果 Mock 数据
 */
export const mockTaskResults: TaskResult[] = [
  {
    success: true,
    data: {
      totalRecords: 15264,
      processedRecords: 15264,
      anomalyCount: 156,
      processingTime: 45000,
      analysisResults: {
        totalSales: 1256780,
        averageOrderValue: 156.78,
        topProducts: ['产品A', '产品B', '产品C'],
        salesTrend: 'upward'
      }
    },
    output: {
      type: 'json',
      content: {
        report: {
          summary: '销售数据分析完成',
          key_findings: [
            '总销售额同比增长15%',
            '平均订单价值提升8%',
            '异常数据已处理'
          ],
          recommendations: [
            '增加产品A的库存',
            '优化产品B的定价策略',
            '重点关注产品C的推广'
          ]
        }
      },
      format: 'json'
    },
    artifacts: [
      {
        id: generateId('artifact'),
        name: 'sales_analysis_report.pdf',
        type: 'file',
        url: '/reports/sales_analysis_report.pdf',
        size: 2048576,
        mimeType: 'application/pdf',
        description: '销售分析报告PDF',
        createdAt: new Date()
      },
      {
        id: generateId('artifact'),
        name: 'cleaned_data.csv',
        type: 'file',
        url: '/data/cleaned_data.csv',
        size: 5242880,
        mimeType: 'text/csv',
        description: '清洗后的数据文件',
        createdAt: new Date()
      }
    ],
    summary: '成功完成销售数据分析，处理了15,264条记录，发现并处理了156条异常数据。生成详细的分析报告和清洗后的数据文件。',
    metrics: {
      executionTime: 45000,
      memoryUsed: 512,
      cpuUsage: 35,
      networkCalls: 3,
      dataProcessed: 10240,
      successRate: 1.0
    },
    completedAt: new Date()
  }
];

/**
 * 任务统计 Mock 数据
 */
export const mockTaskStatistics: TaskStatistics = {
  totalTasks: 156,
  completedTasks: 134,
  failedTasks: 12,
  runningTasks: 8,
  averageExecutionTime: 3850,
  successRate: 0.859,
  tasksByType: {
    [TaskType.DATA_PROCESSING]: 45,
    [TaskType.CONTENT_GENERATION]: 38,
    [TaskType.ANALYSIS]: 32,
    [TaskType.AUTOMATION]: 20,
    [TaskType.COMMUNICATION]: 18,
    [TaskType.SECURITY]: 25,
    [TaskType.RESEARCH]: 15,
    [TaskType.MONITORING]: 16,
    [TaskType.LAPTOP_PURCHASE]: 8
  },
  tasksByStatus: {
    completed: 134,
    failed: 12,
    running: 8,
    pending: 2,
    cancelled: 0,
    paused: 0
  },
  dailyTaskCount: [
    { date: '2024-01-22', count: 12 },
    { date: '2024-01-23', count: 18 },
    { date: '2024-01-24', count: 25 },
    { date: '2024-01-25', count: 31 },
    { date: '2024-01-26', count: 28 },
    { date: '2024-01-27', count: 22 },
    { date: '2024-01-28', count: 20 }
  ],
  agentPerformance: [
    {
      agentId: 'agent_data_processor',
      agentName: '数据处理助手',
      totalTasks: 48,
      successRate: 0.917,
      averageExecutionTime: 3200
    },
    {
      agentId: 'agent_content_generator',
      agentName: '内容生成助手',
      totalTasks: 42,
      successRate: 0.881,
      averageExecutionTime: 4100
    },
    {
      agentId: 'agent_analyst',
      agentName: '数据分析助手',
      totalTasks: 35,
      successRate: 0.829,
      averageExecutionTime: 5200
    },
    {
      agentId: 'agent_security',
      agentName: '安全扫描助手',
      totalTasks: 18,
      successRate: 0.778,
      averageExecutionTime: 6800
    },
    {
      agentId: 'agent_monitor',
      agentName: '系统监控助手',
      totalTasks: 13,
      successRate: 0.923,
      averageExecutionTime: 2800
    }
  ]
};

/**
 * 监控状态 Mock 数据
 */
export const mockMonitorStatus: TaskMonitorStatus = {
  activeTasks: 8,
  queueLength: 5,
  systemLoad: {
    cpu: 42,
    memory: 68,
    disk: 45
  },
  alerts: [
    {
      id: generateId('alert'),
      type: 'warning',
      message: '系统内存使用率较高',
      timestamp: new Date(Date.now() - 300000),
      resolved: false
    },
    {
      id: generateId('alert'),
      type: 'info',
      message: '数据处理助手运行正常',
      timestamp: new Date(Date.now() - 600000),
      resolved: true
    }
  ]
};

/**
 * 表单配置 Mock 数据
 */
export const mockFormConfigs: Record<string, TaskFormConfig> = {
  data_processing: {
    templateId: 'template_data_analysis',
    parameters: mockTaskParameters.data_processing,
    validation: {
      rules: {
        data_source: [{ required: true, message: '请输入数据源' }],
        output_format: [{ required: true, message: '请选择输出格式' }],
        batch_size: [{ type: 'number', min: 100, max: 10000, message: '批处理大小必须在100-10000之间' }]
      },
      messages: {
        required: '此字段为必填项',
        invalid: '输入格式不正确'
      }
    },
    ui: {
      layout: 'vertical',
      columns: 1,
      sections: [
        {
          title: '基础配置',
          fields: ['data_source', 'output_format'],
          collapsed: false
        },
        {
          title: '高级选项',
          fields: ['batch_size', 'enable_compression'],
          collapsed: true
        }
      ]
    },
    actions: {
      showPreview: true,
      showDebug: true,
      allowSaveTemplate: true
    }
  },
  content_generation: {
    templateId: 'template_content_generation',
    parameters: mockTaskParameters.content_generation,
    validation: {
      rules: {
        prompt: [{ required: true, message: '请输入生成提示词' }],
        content_type: [{ required: true, message: '请选择内容类型' }],
        max_length: [{ type: 'number', min: 100, max: 5000, message: '最大长度必须在100-5000之间' }]
      },
      messages: {
        required: '此字段为必填项',
        invalid: '输入格式不正确'
      }
    },
    ui: {
      layout: 'vertical',
      columns: 1,
      sections: [
        {
          title: '内容配置',
          fields: ['prompt', 'content_type'],
          collapsed: false
        },
        {
          title: '生成选项',
          fields: ['max_length', 'style'],
          collapsed: false
        }
      ]
    },
    actions: {
      showPreview: true,
      showDebug: true,
      allowSaveTemplate: true
    }
  },
  laptop_purchase: {
    templateId: 'template_laptop_purchase',
    parameters: mockTaskParameters.laptop_purchase,
    validation: {
      rules: {
        budget_min: [{ required: true, message: '请输入最低预算' }],
        budget_max: [{ required: true, message: '请输入最高预算' }],
        usage_type: [{ required: true, message: '请选择主要用途' }],
        screen_size: [{ required: true, message: '请选择屏幕尺寸' }],
        performance_level: [{ required: true, message: '请选择性能要求' }]
      },
      messages: {
        required: '此字段为必填项',
        invalid: '输入格式不正确'
      }
    },
    ui: {
      layout: 'vertical',
      columns: 1,
      sections: [
        {
          title: '基础配置',
          fields: ['budget_min', 'budget_max', 'usage_type', 'performance_level', 'brand_preference'],
          collapsed: false
        },
        {
          title: '高级选项',
          fields: ['screen_size', 'weight_preference', 'storage_type', 'special_requirements'],
          collapsed: true
        }
      ]
    },
    actions: {
      showPreview: true,
      showDebug: true,
      allowSaveTemplate: true
    }
  }
};

/**
 * 生成任务执行实例
 */
export const generateMockTaskExecution = (taskId: string, agent: BlockchainAgent): TaskExecution => {
  const startTime = generateRandomDate(
    new Date(Date.now() - 3600000),
    new Date(Date.now() - 60000)
  );

  return {
    id: generateId('execution'),
    taskId,
    task: {} as any, // 这里应该传入完整的task对象
    executionId: generateId('exec'),
    status: Math.random() > 0.3 ? TaskStatus.RUNNING : TaskStatus.COMPLETED,
    agentId: agent.id,
    startTime,
    endTime: Math.random() > 0.3 ? new Date() : undefined,
    duration: Math.random() * 300000,
    progress: Math.random() * 100,
    logs: mockTaskLogs.slice(0, Math.floor(Math.random() * mockTaskLogs.length)),
    metrics: {
      executionTime: Math.random() * 300000,
      memoryUsed: Math.random() * 2048,
      cpuUsage: Math.random() * 100,
      networkCalls: Math.floor(Math.random() * 10),
      dataProcessed: Math.random() * 10000
    },
    result: Math.random() > 0.3 ? mockTaskResults[0] : undefined,
    retries: Math.floor(Math.random() * 3),
    maxRetries: 3,
    isTimeout: Math.random() > 0.9
  };
};

/**
 * 生成随机任务参数
 */
export const generateRandomTaskParameters = (templateId: string): Record<string, any> => {
  const template = mockTaskTemplates.find(t => t.id === templateId);
  if (!template) return {};

  const parameters: Record<string, any> = {};

  template.parameters.forEach(param => {
    switch (param.type) {
      case TaskParameterType.STRING:
        parameters[param.id] = param.defaultValue || `sample_${param.id}`;
        break;
      case TaskParameterType.NUMBER:
        parameters[param.id] = param.defaultValue || Math.floor(Math.random() * 1000);
        break;
      case TaskParameterType.BOOLEAN:
        parameters[param.id] = param.defaultValue !== undefined ? param.defaultValue : Math.random() > 0.5;
        break;
      case TaskParameterType.ENUM:
        const enumOptions = param.validation?.enum || [];
        parameters[param.id] = enumOptions.length > 0
          ? enumOptions[Math.floor(Math.random() * enumOptions.length)]
          : param.defaultValue;
        break;
      case TaskParameterType.ARRAY:
        if (param.ui?.options) {
          const options = param.ui.options;
          const selectedCount = Math.floor(Math.random() * options.length) + 1;
          parameters[param.id] = options
            .sort(() => Math.random() - 0.5)
            .slice(0, selectedCount)
            .map(opt => opt.value);
        } else {
          parameters[param.id] = param.defaultValue || [];
        }
        break;
      default:
        parameters[param.id] = param.defaultValue;
    }
  });

  return parameters;
};

/**
 * 获取所有任务模板
 */
export const getAllTaskTemplates = (): TaskTemplate[] => {
  return mockTaskTemplates;
};

/**
 * 根据类型获取任务模板
 */
export const getTaskTemplatesByType = (type: TaskType): TaskTemplate[] => {
  return mockTaskTemplates.filter(template => template.type === type);
};

/**
 * 根据ID获取任务模板
 */
export const getTaskTemplateById = (id: string): TaskTemplate | undefined => {
  return mockTaskTemplates.find(template => template.id === id);
};

/**
 * 根据模板ID获取表单配置
 */
export const getFormConfigByTemplate = (templateId: string): TaskFormConfig | undefined => {
  const template = getTaskTemplateById(templateId);
  if (!template) return undefined;

  // 对于买笔记本任务，直接映射到对应的配置
  if (templateId === 'template_laptop_purchase') {
    return mockFormConfigs.laptop_purchase;
  }

  const type = template.type;
  return mockFormConfigs[type] || mockFormConfigs.data_processing;
};