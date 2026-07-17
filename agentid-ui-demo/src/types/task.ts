// 任务执行相关类型定义

import { BlockchainAgent } from './blockchain';

/**
 * 任务类型枚举
 */
export enum TaskType {
  DATA_PROCESSING = 'data_processing',
  CONTENT_GENERATION = 'content_generation',
  ANALYSIS = 'analysis',
  AUTOMATION = 'automation',
  COMMUNICATION = 'communication',
  SECURITY = 'security',
  RESEARCH = 'research',
  MONITORING = 'monitoring',
  LAPTOP_PURCHASE = 'laptop_purchase'
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

/**
 * 任务优先级枚举
 */
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * 任务参数类型
 */
export enum TaskParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  ENUM = 'enum',
  FILE = 'file'
}

/**
 * 任务参数接口
 */
export interface TaskParameter {
  id: string;
  name: string;
  type: TaskParameterType;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    custom?: (value: any) => boolean | string;
  };
  ui?: {
    component: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'slider' | 'file-upload' | 'input-number' | 'rate';
    placeholder?: string;
    options?: Array<{ label: string; value: any }>;
    rows?: number;
    addonAfter?: string;
  };
}

/**
 * 任务模板接口
 */
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  category: string;
  version: string;
  agentTypes: string[];
  parameters: TaskParameter[];
  expectedOutput: {
    type: string;
    description: string;
  };
  estimatedDuration: number; // 预估时间（秒）
  maxRetries: number;
  timeout: number; // 超时时间（秒）
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * 任务实例接口
 */
export interface Task {
  id: string;
  templateId: string;
  template: TaskTemplate;
  name: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  agentId: string;
  agent: BlockchainAgent;
  parameters: Record<string, any>;
  result?: TaskResult;
  progress: number; // 0-100
  executionTime: number; // 执行时间（秒）
  estimatedDuration: number;
  maxRetries: number;
  retryCount: number;
  timeout: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  dependencies?: string[]; // 依赖的任务ID
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 任务执行接口
 */
export interface TaskExecution {
  id: string;
  taskId: string;
  task: Task;
  executionId: string;
  status: TaskStatus;
  agentId: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  progress: number;
  logs: TaskLog[];
  metrics: TaskMetrics;
  result?: TaskResult;
  error?: TaskError;
  retries: number;
  maxRetries: number;
  isTimeout: boolean;
  metadata?: Record<string, any>;
}

/**
 * 任务结果接口
 */
export interface TaskResult {
  success: boolean;
  data?: any;
  output?: {
    type: string;
    content: any;
    format: 'json' | 'text' | 'html' | 'markdown' | 'file';
  };
  artifacts?: TaskArtifact[];
  summary?: string;
  metrics?: TaskMetrics;
  completedAt: Date;
}

/**
 * 任务产物接口
 */
export interface TaskArtifact {
  id: string;
  name: string;
  type: 'file' | 'data' | 'link' | 'report';
  url?: string;
  size?: number;
  mimeType?: string;
  description?: string;
  createdAt: Date;
}

/**
 *任务日志接口
 */
export interface TaskLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source: 'system' | 'agent' | 'user';
}

/**
 * 任务错误接口
 */
export interface TaskError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * 任务指标接口
 */
export interface TaskMetrics {
  executionTime: number;
  memoryUsed?: number;
  cpuUsage?: number;
  networkCalls?: number;
  dataProcessed?: number;
  successRate?: number;
  errorRate?: number;
  custom?: Record<string, any>;
}

/**
 * 任务表单配置接口
 */
export interface TaskFormConfig {
  templateId: string;
  parameters: TaskParameter[];
  validation: {
    rules: Record<string, any>;
    messages: Record<string, string>;
  };
  ui: {
    layout: 'vertical' | 'horizontal' | 'inline';
    columns?: number;
    sections?: Array<{
      title: string;
      fields: string[];
      collapsed?: boolean;
    }>;
  };
  actions: {
    showPreview: boolean;
    showDebug: boolean;
    allowSaveTemplate: boolean;
  };
}

/**
 * 任务过滤器接口
 */
export interface TaskFilter {
  status?: TaskStatus[];
  type?: TaskType[];
  priority?: TaskPriority[];
  agentId?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  search?: string;
}

/**
 * 任务排序接口
 */
export interface TaskSort {
  field: 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'executionTime' | 'progress';
  order: 'asc' | 'desc';
}

/**
 * 任务分页接口
 */
export interface TaskPagination {
  page: number;
  limit: number;
  total: number;
}

/**
 * 任务查询参数接口
 */
export interface TaskQueryParams {
  filter?: TaskFilter;
  sort?: TaskSort;
  pagination?: TaskPagination;
}

/**
 * 任务列表响应接口
 */
export interface TaskListResponse {
  tasks: Task[];
  pagination: TaskPagination;
  summary: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

/**
 * 任务执行请求接口
 */
export interface TaskExecutionRequest {
  templateId: string;
  agentId: string;
  parameters: Record<string, any>;
  priority?: TaskPriority;
  scheduledAt?: Date;
  tags?: string[];
  dependencies?: string[];
  metadata?: Record<string, any>;
}

/**
 * 任务批量操作请求接口
 */
export interface TaskBatchRequest {
  taskIds: string[];
  action: 'cancel' | 'pause' | 'resume' | 'retry' | 'delete';
  reason?: string;
}

/**
 * 任务统计信息接口
 */
export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  averageExecutionTime: number;
  successRate: number;
  tasksByType: Record<TaskType, number>;
  tasksByStatus: Record<TaskStatus, number>;
  dailyTaskCount: Array<{
    date: string;
    count: number;
  }>;
  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    totalTasks: number;
    successRate: number;
    averageExecutionTime: number;
  }>;
}

/**
 * 任务监控状态接口
 */
export interface TaskMonitorStatus {
  activeTasks: number;
  queueLength: number;
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
}

/**
 * WebSocket 消息类型
 */
export enum TaskWSMessageType {
  TASK_UPDATE = 'task_update',
  TASK_LOG = 'task_log',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  SYSTEM_STATUS = 'system_status'
}

/**
 * WebSocket 消息接口
 */
export interface TaskWSMessage {
  type: TaskWSMessageType;
  payload: any;
  timestamp: Date;
  messageId: string;
}

/**
 * 任务导出选项接口
 */
export interface TaskExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeLogs: boolean;
  includeResults: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filter?: TaskFilter;
}

/**
 * 任务导入选项接口
 */
export interface TaskImportOptions {
  format: 'json' | 'csv' | 'xlsx';
  validateOnly: boolean;
  overrideExisting: boolean;
  templateId?: string;
}