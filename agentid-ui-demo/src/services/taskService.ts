import {
  Task,
  TaskTemplate,
  TaskExecution,
  TaskQueryParams,
  TaskListResponse,
  TaskStatistics,
  TaskMonitorStatus,
  TaskExecutionRequest,
  TaskLog,
  TaskResult,
  TaskFilter,
  TaskPagination,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskParameterType
} from '../types/task';
import { mockTaskTemplates as importedMockTaskTemplates } from '../mocks/taskMock';

// 模拟API响应延迟
const API_DELAY = 300;

// 模拟API响应包装器
const mockApiCall = <T>(data: T, delay: number = API_DELAY): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

// 模拟API错误
const mockApiError = (message: string, delay: number = API_DELAY): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), delay);
  });
};

// 模拟任务数据存储
let mockTasks: Task[] = [];
let mockTaskTemplates: TaskTemplate[] = [];

export class TaskService {
  /**
   * 获取任务列表
   */
  static async getTasks(params?: TaskQueryParams): Promise<TaskListResponse> {
    await mockApiCall(null, 200);

    let filteredTasks = [...mockTasks];

    // 应用过滤
    if (params?.filter) {
      const { status, type, priority, agentId, dateRange, tags, search } = params.filter;

      if (status && status.length > 0) {
        filteredTasks = filteredTasks.filter(task => status.includes(task.status));
      }

      if (type && type.length > 0) {
        filteredTasks = filteredTasks.filter(task => type.includes(task.type));
      }

      if (priority && priority.length > 0) {
        filteredTasks = filteredTasks.filter(task => priority.includes(task.priority));
      }

      if (agentId && agentId.length > 0) {
        filteredTasks = filteredTasks.filter(task => agentId.includes(task.agentId));
      }

      if (dateRange) {
        filteredTasks = filteredTasks.filter(task => {
          const taskDate = new Date(task.createdAt);
          return taskDate >= dateRange.start && taskDate <= dateRange.end;
        });
      }

      if (tags && tags.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          tags.some(tag => task.tags.includes(tag))
        );
      }

      if (search) {
        filteredTasks = filteredTasks.filter(task =>
          task.name.toLowerCase().includes(search.toLowerCase()) ||
          task.description?.toLowerCase().includes(search.toLowerCase())
        );
      }
    }

    // 应用排序
    if (params?.sort) {
      const { field, order } = params.sort;
      filteredTasks.sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];

        if (order === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }

    // 应用分页
    const pagination = params?.pagination || {
      page: 1,
      limit: 20,
      total: filteredTasks.length
    };

    const { page, limit } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    // 计算统计
    const summary = {
      total: filteredTasks.length,
      pending: filteredTasks.filter(t => t.status === 'pending').length,
      running: filteredTasks.filter(t => t.status === 'running').length,
      completed: filteredTasks.filter(t => t.status === 'completed').length,
      failed: filteredTasks.filter(t => t.status === 'failed').length,
      cancelled: filteredTasks.filter(t => t.status === 'cancelled').length
    };

    return {
      tasks: paginatedTasks,
      pagination: {
        ...pagination,
        total: filteredTasks.length
      },
      summary
    };
  }

  /**
   * 获取任务模板
   */
  static async getTaskTemplates(): Promise<TaskTemplate[]> {
    await mockApiCall(null, 150);
    return mockTaskTemplates;
  }

  /**
   * 获取任务详情
   */
  static async getTaskById(id: string): Promise<Task> {
    await mockApiCall(null, 100);

    const task = mockTasks.find(t => t.id === id);
    if (!task) {
      throw new Error(`任务 ${id} 不存在`);
    }

    return task;
  }

  /**
   * 创建任务
   */
  static async createTask(request: TaskExecutionRequest): Promise<Task> {
    await mockApiCall(null, 500);

    const template = mockTaskTemplates.find(t => t.id === request.templateId);
    if (!template) {
      throw new Error(`任务模板 ${request.templateId} 不存在`);
    }

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId: template.id,
      template,
      name: template.name,
      type: template.type,
      priority: request.priority || TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      agentId: request.agentId,
      agent: {} as any, // 这里应该从agent store获取
      parameters: request.parameters,
      progress: 0,
      executionTime: 0,
      estimatedDuration: template.estimatedDuration,
      maxRetries: template.maxRetries,
      retryCount: 0,
      timeout: template.timeout,
      tags: request.tags || [],
      dependencies: request.dependencies,
      metadata: request.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockTasks.unshift(newTask);
    return newTask;
  }

  /**
   * 执行任务
   */
  static async executeTask(taskId: string): Promise<TaskExecution> {
    await mockApiCall(null, 200);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const execution: TaskExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      task,
      executionId: `exec_${taskId}`,
      status: TaskStatus.RUNNING,
      agentId: task.agentId,
      startTime: new Date(),
      progress: 0,
      logs: [],
      metrics: {
        executionTime: 0,
        memoryUsed: 0,
        cpuUsage: 0,
        networkCalls: 0,
        dataProcessed: 0
      },
      retries: 0,
      maxRetries: task.maxRetries,
      isTimeout: false
    };

    // 模拟任务执行过程
    this.simulateTaskExecution(taskId, execution.id);

    return execution;
  }

  /**
   * 取消任务
   */
  static async cancelTask(taskId: string): Promise<void> {
    await mockApiCall(null, 100);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status === 'completed' || task.status === TaskStatus.FAILED || task.status === 'cancelled') {
      throw new Error(`任务 ${taskId} 状态不允许取消`);
    }

    task.status = TaskStatus.CANCELLED;
    task.updatedAt = new Date();
  }

  /**
   * 暂停任务
   */
  static async pauseTask(taskId: string): Promise<void> {
    await mockApiCall(null, 100);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status !== 'running') {
      throw new Error(`任务 ${taskId} 状态不允许暂停`);
    }

    task.status = TaskStatus.PAUSED;
    task.updatedAt = new Date();
  }

  /**
   * 恢复任务
   */
  static async resumeTask(taskId: string): Promise<void> {
    await mockApiCall(null, 100);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status !== 'paused') {
      throw new Error(`任务 ${taskId} 状态不允许恢复`);
    }

    task.status = TaskStatus.RUNNING;
    task.updatedAt = new Date();
  }

  /**
   * 重试任务
   */
  static async retryTask(taskId: string): Promise<TaskExecution> {
    await mockApiCall(null, 200);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status !== 'failed') {
      throw new Error(`任务 ${taskId} 状态不允许重试`);
    }

    if (task.retryCount >= task.maxRetries) {
      throw new Error(`任务 ${taskId} 已达到最大重试次数`);
    }

    task.status = TaskStatus.RUNNING;
    task.retryCount++;
    task.updatedAt = new Date();

    const execution: TaskExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      task,
      executionId: `exec_${taskId}`,
      status: TaskStatus.RUNNING,
      agentId: task.agentId,
      startTime: new Date(),
      progress: 0,
      logs: [],
      metrics: {
        executionTime: 0,
        memoryUsed: 0,
        cpuUsage: 0,
        networkCalls: 0,
        dataProcessed: 0
      },
      retries: task.retryCount,
      maxRetries: task.maxRetries,
      isTimeout: false
    };

    this.simulateTaskExecution(taskId, execution.id);

    return execution;
  }

  /**
   * 删除任务
   */
  static async deleteTask(taskId: string): Promise<void> {
    await mockApiCall(null, 100);

    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    mockTasks.splice(taskIndex, 1);
  }

  /**
   * 批量取消任务
   */
  static async batchCancelTasks(taskIds: string[]): Promise<void> {
    await mockApiCall(null, 300);

    for (const taskId of taskIds) {
      const task = mockTasks.find(t => t.id === taskId);
      if (task && task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled') {
        task.status = TaskStatus.CANCELLED;
        task.updatedAt = new Date();
      }
    }
  }

  /**
   * 批量删除任务
   */
  static async batchDeleteTasks(taskIds: string[]): Promise<void> {
    await mockApiCall(null, 300);

    mockTasks = mockTasks.filter(task => !taskIds.includes(task.id));
  }

  /**
   * 获取任务日志
   */
  static async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    await mockApiCall(null, 150);

    // 模拟日志数据
    const logs: TaskLog[] = [
      {
        id: 'log_1',
        timestamp: new Date(Date.now() - 60000),
        level: 'info',
        message: '任务开始执行',
        source: 'system'
      },
      {
        id: 'log_2',
        timestamp: new Date(Date.now() - 30000),
        level: 'info',
        message: '正在处理数据...',
        source: 'agent'
      }
    ];

    return logs;
  }

  /**
   * 获取任务结果
   */
  static async getTaskResult(taskId: string): Promise<TaskResult> {
    await mockApiCall(null, 200);

    const task = mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status !== 'completed') {
      throw new Error(`任务 ${taskId} 尚未完成`);
    }

    // 模拟任务结果
    const result: TaskResult = {
      success: true,
      data: {
        processedItems: 100,
        accuracy: 0.95,
        processingTime: 4500
      },
      output: {
        type: 'json',
        content: {
          result: 'success',
          data: '任务执行完成'
        },
        format: 'json'
      },
      summary: '任务成功完成，处理了100个项目',
      metrics: {
        executionTime: 4500,
        memoryUsed: 512,
        cpuUsage: 25,
        networkCalls: 3,
        dataProcessed: 1024
      },
      completedAt: new Date()
    };

    return result;
  }

  /**
   * 获取任务统计
   */
  static async getTaskStatistics(): Promise<TaskStatistics> {
    await mockApiCall(null, 300);

    const stats: TaskStatistics = {
      totalTasks: mockTasks.length,
      completedTasks: mockTasks.filter(t => t.status === 'completed').length,
      failedTasks: mockTasks.filter(t => t.status === 'failed').length,
      runningTasks: mockTasks.filter(t => t.status === 'running').length,
      averageExecutionTime: 4500,
      successRate: 0.85,
      tasksByType: {} as any,
      tasksByStatus: {} as any,
      dailyTaskCount: [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 8 },
        { date: '2024-01-03', count: 12 },
        { date: '2024-01-04', count: 6 },
        { date: '2024-01-05', count: 15 }
      ],
      agentPerformance: [
        {
          agentId: 'agent_1',
          agentName: '数据处理助手',
          totalTasks: 25,
          successRate: 0.92,
          averageExecutionTime: 3800
        },
        {
          agentId: 'agent_2',
          agentName: '内容生成助手',
          totalTasks: 18,
          successRate: 0.78,
          averageExecutionTime: 5200
        }
      ]
    };

    // 计算任务类型统计
    mockTasks.forEach(task => {
      stats.tasksByType[task.type] = (stats.tasksByType[task.type] || 0) + 1;
      stats.tasksByStatus[task.status] = (stats.tasksByStatus[task.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * 获取监控状态
   */
  static async getMonitorStatus(): Promise<TaskMonitorStatus> {
    await mockApiCall(null, 200);

    const status: TaskMonitorStatus = {
      activeTasks: mockTasks.filter(t => t.status === 'running').length,
      queueLength: mockTasks.filter(t => t.status === 'pending').length,
      systemLoad: {
        cpu: 45,
        memory: 68,
        disk: 52
      },
      alerts: [
        {
          id: 'alert_1',
          type: 'warning',
          message: '系统负载较高',
          timestamp: new Date(Date.now() - 300000),
          resolved: false
        }
      ]
    };

    return status;
  }

  /**
   * 模拟任务执行过程
   */
  private static simulateTaskExecution(taskId: string, executionId: string): void {
    const progressInterval = setInterval(() => {
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) {
        clearInterval(progressInterval);
        return;
      }

      if (task.status !== TaskStatus.RUNNING) {
        clearInterval(progressInterval);
        return;
      }

      // 更新进度
      const progressIncrement = Math.random() * 15;
      task.progress = Math.min(100, task.progress + progressIncrement);
      task.executionTime += 1000;
      task.updatedAt = new Date();

      // 模拟完成或失败
      if (task.progress >= 100) {
        // 85% 概率成功
        if (Math.random() < 0.85) {
          task.status = TaskStatus.COMPLETED;
          task.completedAt = new Date();

          // 为买笔记本任务生成特殊结果
          if (task.type === TaskType.LAPTOP_PURCHASE) {
            task.result = {
              success: true,
              ...this.generateLaptopPurchaseResult(task.parameters),
              completedAt: new Date()
            };
          }

        } else {
          task.status = TaskStatus.FAILED;
          task.error = '任务执行失败';
          task.completedAt = new Date();
        }
        clearInterval(progressInterval);
      }
    }, 1000);
  }

  /**
   * 生成买笔记本任务的结果
   */
  private static generateLaptopPurchaseResult(parameters: Record<string, any>): Partial<TaskResult> {
    const budgetMin = parameters.budget_min || 3000;
    const budgetMax = parameters.budget_max || 8000;
    const usageType = parameters.usage_type || 'office';
    const brandPreference = parameters.brand_preference || [];
    const performanceLevel = parameters.performance_level || 'medium';

    // 模拟笔记本推荐数据
    const laptopDatabase = [
      {
        id: 'laptop_1',
        brand: 'lenovo',
        model: 'ThinkPad E14',
        price: 4299,
        screenSize: '14',
        weight: 1.59,
        performance: 'medium',
        suitableFor: ['office', 'programming', 'student'],
        specs: {
          processor: 'AMD Ryzen 5 5500U',
          memory: '16GB DDR4',
          storage: '512GB SSD',
          graphics: '集成显卡'
        },
        pros: ['经典商务设计', '键盘手感好', '性价比高'],
        cons: ['屏幕色彩一般'],
        rating: 4.3,
        availability: true
      },
      {
        id: 'laptop_2',
        brand: 'apple',
        model: 'MacBook Air M2',
        price: 7999,
        screenSize: '13',
        weight: 1.24,
        performance: 'high',
        suitableFor: ['design', 'programming', 'office'],
        specs: {
          processor: 'Apple M2',
          memory: '8GB 统一内存',
          storage: '256GB SSD',
          graphics: 'M2集成GPU'
        },
        pros: ['续航极佳', '性能强劲', '做工精良'],
        cons: ['价格较高', '接口较少'],
        rating: 4.7,
        availability: true
      },
      {
        id: 'laptop_3',
        brand: 'asus',
        model: 'ROG Strix G15',
        price: 6899,
        screenSize: '15',
        weight: 2.3,
        performance: 'extreme',
        suitableFor: ['gaming', 'design'],
        specs: {
          processor: 'AMD Ryzen 7 5800H',
          memory: '16GB DDR4',
          storage: '512GB SSD',
          graphics: 'RTX 3060'
        },
        pros: ['游戏性能强', '散热好', '屏幕好'],
        cons: ['续航一般', '较重'],
        rating: 4.4,
        availability: true
      },
      {
        id: 'laptop_4',
        brand: 'dell',
        model: 'XPS 13',
        price: 7299,
        screenSize: '13',
        weight: 1.2,
        performance: 'high',
        suitableFor: ['office', 'business', 'design'],
        specs: {
          processor: 'Intel i7-1265U',
          memory: '16GB LPDDR5',
          storage: '512GB SSD',
          graphics: 'Intel Iris Xe'
        },
        pros: ['轻薄便携', '屏幕优秀', '做工精良'],
        cons: ['价格偏高', '接口少'],
        rating: 4.5,
        availability: true
      },
      {
        id: 'laptop_5',
        brand: 'xiaomi',
        model: 'RedmiBook Pro 14',
        price: 3999,
        screenSize: '14',
        weight: 1.4,
        performance: 'medium',
        suitableFor: ['office', 'student', 'programming'],
        specs: {
          processor: 'Intel i5-11300H',
          memory: '16GB DDR4',
          storage: '512GB SSD',
          graphics: 'Intel Iris Xe'
        },
        pros: ['性价比高', '屏幕不错', '接口齐全'],
        cons: ['品牌认知度低'],
        rating: 4.2,
        availability: true
      }
    ];

    // 根据参数筛选推荐笔记本
    let recommendations = laptopDatabase.filter(laptop => {
      // 预算筛选
      if (laptop.price < budgetMin || laptop.price > budgetMax) return false;

      // 用途筛选
      if (!laptop.suitableFor.includes(usageType)) return false;

      // 品牌筛选
      if (brandPreference.length > 0 && !brandPreference.includes(laptop.brand)) return false;

      // 性能筛选
      const performanceMapping: { [key: string]: number } = { low: 1, medium: 2, high: 3, extreme: 4 };
      const requiredLevel = performanceMapping[performanceLevel] || 2;
      const laptopLevel = performanceMapping[laptop.performance] || 2;
      if (laptopLevel < requiredLevel) return false;

      return true;
    });

    // 如果筛选结果太少，放宽条件
    if (recommendations.length < 2) {
      recommendations = laptopDatabase.filter(laptop =>
        laptop.price >= budgetMin && laptop.price <= budgetMax * 1.1
      ).slice(0, 3);
    }

    // 按评分排序
    recommendations.sort((a, b) => b.rating - a.rating);
    recommendations = recommendations.slice(0, 3);

    return {
      data: {
        type: 'laptop_purchase_result',
        searchParams: {
          budget: `${budgetMin} - ${budgetMax}元`,
          usage: usageType,
          brands: brandPreference,
          performance: performanceLevel
        },
        recommendations,
        summary: {
          totalFound: recommendations.length,
          priceRange: recommendations.length > 0 ? {
            min: Math.min(...recommendations.map(l => l.price)),
            max: Math.max(...recommendations.map(l => l.price))
          } : null,
          topChoice: recommendations[0] || null
        },
        buyingAdvice: this.generateBuyingAdvice(usageType, performanceLevel, budgetMax),
        purchaseLinks: recommendations.map(laptop => ({
          laptopId: laptop.id,
          platform: 'jd',
          url: `https://item.jd.com/mock-${laptop.id}.html`,
          price: laptop.price,
          inStock: true
        }))
      },
      output: {
        type: 'structured_data',
        content: {
          searchParams: {
            budget: `${budgetMin} - ${budgetMax}元`,
            usage: usageType,
            brands: brandPreference,
            performance: performanceLevel
          },
          recommendations: recommendations.slice(0, 3),
          totalFound: recommendations.length
        },
        format: 'json'
      },
      summary: `根据您的需求（预算${budgetMin}-${budgetMax}元，用途：${usageType}），为您推荐了${recommendations.length}款笔记本电脑。`,
      metrics: {
        executionTime: 3000,
        dataProcessed: recommendations.length,
        networkCalls: 1,
        successRate: 1.0
      }
    };
  }

  /**
   * 生成购买建议
   */
  private static generateBuyingAdvice(usageType: string, performanceLevel: string, budget: number): string[] {
    const advice = [];

    switch (usageType) {
      case 'gaming':
        advice.push('游戏用途建议选择独立显卡的机型');
        advice.push('关注散热性能和屏幕刷新率');
        break;
      case 'design':
        advice.push('设计工作建议选择色彩准确的高分屏');
        advice.push('内存建议16GB起步，CPU性能要强');
        break;
      case 'programming':
        advice.push('编程建议选择键盘手感好的机型');
        advice.push('内存16GB，SSD存储，多接口');
        break;
      default:
        advice.push('日常办公选择轻薄本即可');
        advice.push('注重续航和便携性');
    }

    if (budget < 5000) {
      advice.push('该预算建议关注性价比品牌');
    } else if (budget > 8000) {
      advice.push('该预算可以考虑高端机型');
    }

    return advice;
  }

  /**
   * 初始化模拟数据
   */
  static initializeMockData(): void {
    // 使用导入的模板数据
    mockTaskTemplates.push(...importedMockTaskTemplates);

    // 初始化一些示例任务
    mockTasks = [
      {
        id: 'task_1',
        templateId: 'template_data_analysis',
        template: importedMockTaskTemplates.find(t => t.id === 'template_data_analysis') || importedMockTaskTemplates[0],
        name: '用户行为分析',
        type: TaskType.DATA_PROCESSING,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.COMPLETED,
        agentId: 'agent_1',
        agent: {} as any,
        parameters: {
          data_source: '/data/user_behavior.csv',
          analysis_type: 'statistical'
        },
        progress: 100,
        executionTime: 4500,
        estimatedDuration: 300,
        maxRetries: 3,
        retryCount: 0,
        timeout: 600,
        startedAt: new Date(Date.now() - 10000),
        completedAt: new Date(Date.now() - 5500),
        createdAt: new Date(Date.now() - 15000),
        updatedAt: new Date(Date.now() - 5500),
        tags: ['分析', '用户行为']
      },
      {
        id: 'task_2',
        templateId: 'template_laptop_purchase',
        template: importedMockTaskTemplates.find(t => t.id === 'template_laptop_purchase') || importedMockTaskTemplates[0],
        name: '买笔记本推荐',
        type: TaskType.LAPTOP_PURCHASE,
        priority: TaskPriority.HIGH,
        status: TaskStatus.RUNNING,
        agentId: 'agent_shopping',
        agent: {} as any,
        parameters: {
          budget_min: 5000,
          budget_max: 8000,
          usage_type: 'programming',
          brand_preference: ['apple', 'lenovo'],
          performance_level: 'high'
        },
        progress: 65,
        executionTime: 1800,
        estimatedDuration: 180,
        maxRetries: 3,
        retryCount: 0,
        timeout: 600,
        startedAt: new Date(Date.now() - 3000),
        createdAt: new Date(Date.now() - 5000),
        updatedAt: new Date(Date.now() - 1000),
        tags: ['购物', '推荐']
      }
    ];
  }
}

// 初始化模拟数据
TaskService.initializeMockData();