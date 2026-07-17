import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Task,
  TaskTemplate,
  TaskExecution,
  TaskFilter,
  TaskSort,
  TaskPagination,
  TaskQueryParams,
  TaskListResponse,
  TaskStatistics,
  TaskMonitorStatus,
  TaskExecutionRequest,
  TaskStatus,
  TaskPriority,
  TaskWSMessage,
  TaskWSMessageType
} from '../types/task';
import { taskService } from '../services';

interface TaskState {
  // 任务数据
  tasks: Task[];
  taskTemplates: TaskTemplate[];
  selectedTask: Task | null;
  selectedTemplate: TaskTemplate | null;
  activeExecutions: Map<string, TaskExecution>;

  // 任务统计和监控
  statistics: TaskStatistics | null;
  monitorStatus: TaskMonitorStatus | null;

  // 分页和过滤
  pagination: TaskPagination;
  filters: TaskFilter;
  sort: TaskSort;

  // UI状态
  loading: boolean;
  executing: boolean;
  error: string | null;
  wsConnected: boolean;

  // 表单状态
  formDraft: Record<string, any>;

  // Actions
  // 数据操作
  setTasks: (tasks: Task[]) => void;
  setTaskTemplates: (templates: TaskTemplate[]) => void;
  setSelectedTask: (task: Task | null) => void;
  setSelectedTemplate: (template: TaskTemplate | null) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTask: (task: Task) => void;
  removeTask: (id: string) => void;
  setActiveExecution: (executionId: string, execution: TaskExecution) => void;
  removeActiveExecution: (executionId: string) => void;

  // 统计和监控
  setStatistics: (stats: TaskStatistics) => void;
  setMonitorStatus: (status: TaskMonitorStatus) => void;

  // 分页和过滤
  setPagination: (pagination: TaskPagination) => void;
  setFilters: (filters: TaskFilter) => void;
  setSort: (sort: TaskSort) => void;

  // UI状态
  setLoading: (loading: boolean) => void;
  setExecuting: (executing: boolean) => void;
  setError: (error: string | null) => void;
  setWsConnected: (connected: boolean) => void;

  // 表单操作
  setFormDraft: (draft: Record<string, any>) => void;
  updateFormDraft: (key: string, value: any) => void;
  clearFormDraft: () => void;

  // 数据获取
  fetchTasks: (params?: TaskQueryParams) => Promise<void>;
  fetchTaskTemplates: () => Promise<void>;
  fetchTaskById: (id: string) => Promise<void>;
  fetchStatistics: () => Promise<void>;
  fetchMonitorStatus: () => Promise<void>;

  // 任务操作
  createTask: (request: TaskExecutionRequest) => Promise<Task>;
  executeTask: (taskId: string) => Promise<TaskExecution>;
  cancelTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // 批量操作
  batchCancelTasks: (taskIds: string[]) => Promise<void>;
  batchDeleteTasks: (taskIds: string[]) => Promise<void>;

  // 任务日志和结果
  fetchTaskLogs: (taskId: string) => Promise<void>;
  fetchTaskResult: (taskId: string) => Promise<void>;

  // WebSocket连接
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  handleWebSocketMessage: (message: TaskWSMessage) => void;

  // 清理
  clearFilters: () => void;
  clearError: () => void;
  reset: () => void;
}

const defaultPagination: TaskPagination = {
  page: 1,
  limit: 20,
  total: 0
};

const defaultSort: TaskSort = {
  field: 'createdAt',
  order: 'desc'
};

const defaultFilters: TaskFilter = {};

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        tasks: [],
        taskTemplates: [],
        selectedTask: null,
        selectedTemplate: null,
        activeExecutions: new Map(),
        statistics: null,
        monitorStatus: null,
        pagination: defaultPagination,
        filters: defaultFilters,
        sort: defaultSort,
        loading: false,
        executing: false,
        error: null,
        wsConnected: false,
        formDraft: {},

        // 数据操作
        setTasks: (tasks) => set({ tasks }),
        setTaskTemplates: (taskTemplates) => set({ taskTemplates }),
        setSelectedTask: (selectedTask) => set({ selectedTask }),
        setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),

        updateTask: (id, updates) => set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id ? { ...task, ...updates, updatedAt: new Date() } : task
          ),
          selectedTask: state.selectedTask?.id === id
            ? { ...state.selectedTask, ...updates, updatedAt: new Date() }
            : state.selectedTask
        })),

        addTask: (task) => set((state) => ({
          tasks: [task, ...state.tasks],
          pagination: { ...state.pagination, total: state.pagination.total + 1 }
        })),

        removeTask: (id) => set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id),
          selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
          pagination: { ...state.pagination, total: Math.max(0, state.pagination.total - 1) }
        })),

        setActiveExecution: (executionId, execution) => set((state) => {
          const newMap = new Map(state.activeExecutions);
          newMap.set(executionId, execution);
          return { activeExecutions: newMap };
        }),

        removeActiveExecution: (executionId) => set((state) => {
          const newMap = new Map(state.activeExecutions);
          newMap.delete(executionId);
          return { activeExecutions: newMap };
        }),

        // 统计和监控
        setStatistics: (statistics) => set({ statistics }),
        setMonitorStatus: (monitorStatus) => set({ monitorStatus }),

        // 分页和过滤
        setPagination: (pagination) => set({ pagination }),
        setFilters: (filters) => set({ filters }),
        setSort: (sort) => set({ sort }),

        // UI状态
        setLoading: (loading) => set({ loading }),
        setExecuting: (executing) => set({ executing }),
        setError: (error) => set({ error }),
        setWsConnected: (wsConnected) => set({ wsConnected }),

        // 表单操作
        setFormDraft: (formDraft) => set({ formDraft }),
        updateFormDraft: (key, value) => set((state) => ({
          formDraft: { ...state.formDraft, [key]: value }
        })),
        clearFormDraft: () => set({ formDraft: {} }),

        // 数据获取
        fetchTasks: async (params?: TaskQueryParams) => {
          set({ loading: true, error: null });
          try {
            const response = await taskService.getTasks(params);
            set({
              tasks: response.tasks,
              pagination: response.pagination,
              loading: false
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '获取任务列表失败',
              loading: false
            });
          }
        },

        fetchTaskTemplates: async () => {
          set({ loading: true, error: null });
          try {
            const templates = await taskService.getTaskTemplates();
            set({ taskTemplates: templates, loading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '获取任务模板失败',
              loading: false
            });
          }
        },

        fetchTaskById: async (id: string) => {
          set({ loading: true, error: null });
          try {
            const task = await taskService.getTaskById(id);
            set({ selectedTask: task, loading: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '获取任务详情失败',
              loading: false
            });
          }
        },

        fetchStatistics: async () => {
          try {
            const statistics = await taskService.getTaskStatistics();
            set({ statistics });
          } catch (error) {
            console.error('获取任务统计失败:', error);
          }
        },

        fetchMonitorStatus: async () => {
          try {
            const status = await taskService.getMonitorStatus();
            set({ monitorStatus: status });
          } catch (error) {
            console.error('获取监控状态失败:', error);
          }
        },

        // 任务操作
        createTask: async (request: TaskExecutionRequest) => {
          set({ executing: true, error: null });
          try {
            const task = await taskService.createTask(request);
            get().addTask(task);
            set({ executing: false });
            return task;
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '创建任务失败',
              executing: false
            });
            throw error;
          }
        },

        executeTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            const execution = await taskService.executeTask(taskId);
            get().updateTask(taskId, {
              status: TaskStatus.RUNNING,
              startedAt: new Date()
            });
            get().setActiveExecution(execution.executionId, execution);
            set({ executing: false });
            return execution;
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '执行任务失败',
              executing: false
            });
            throw error;
          }
        },

        cancelTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            await taskService.cancelTask(taskId);
            get().updateTask(taskId, { status: TaskStatus.CANCELLED });
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '取消任务失败',
              executing: false
            });
            throw error;
          }
        },

        pauseTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            await taskService.pauseTask(taskId);
            get().updateTask(taskId, { status: TaskStatus.PAUSED });
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '暂停任务失败',
              executing: false
            });
            throw error;
          }
        },

        resumeTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            await taskService.resumeTask(taskId);
            get().updateTask(taskId, { status: TaskStatus.RUNNING });
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '恢复任务失败',
              executing: false
            });
            throw error;
          }
        },

        retryTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            await taskService.retryTask(taskId);
            get().updateTask(taskId, {
              status: TaskStatus.RUNNING,
              retryCount: (get().selectedTask?.retryCount || 0) + 1
            });
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '重试任务失败',
              executing: false
            });
            throw error;
          }
        },

        deleteTask: async (taskId: string) => {
          set({ executing: true, error: null });
          try {
            await taskService.deleteTask(taskId);
            get().removeTask(taskId);
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '删除任务失败',
              executing: false
            });
            throw error;
          }
        },

        // 批量操作
        batchCancelTasks: async (taskIds: string[]) => {
          set({ executing: true, error: null });
          try {
            await taskService.batchCancelTasks(taskIds);
            taskIds.forEach(taskId => {
              get().updateTask(taskId, { status: TaskStatus.CANCELLED });
            });
            set({ executing: false });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '批量取消任务失败',
              executing: false
            });
            throw error;
          }
        },

        batchDeleteTasks: async (taskIds: string[]) => {
          set({ executing: true, error: null });
          try {
            await taskService.batchDeleteTasks(taskIds);
            set((state) => ({
              tasks: state.tasks.filter(task => !taskIds.includes(task.id)),
              pagination: {
                ...state.pagination,
                total: Math.max(0, state.pagination.total - taskIds.length)
              },
              executing: false
            }));
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : '批量删除任务失败',
              executing: false
            });
            throw error;
          }
        },

        // 任务日志和结果
        fetchTaskLogs: async (taskId: string) => {
          try {
            const logs = await taskService.getTaskLogs(taskId);
            // 更新任务的日志信息
            get().updateTask(taskId, { metadata: { logs } });
          } catch (error) {
            console.error('获取任务日志失败:', error);
          }
        },

        fetchTaskResult: async (taskId: string) => {
          try {
            const result = await taskService.getTaskResult(taskId);
            get().updateTask(taskId, { result });
          } catch (error) {
            console.error('获取任务结果失败:', error);
          }
        },

        // WebSocket连接
        connectWebSocket: () => {
          // 这里实现WebSocket连接逻辑
          // 暂时设置为连接状态
          set({ wsConnected: true });
        },

        disconnectWebSocket: () => {
          set({ wsConnected: false });
        },

        handleWebSocketMessage: (message: TaskWSMessage) => {
          const { type, payload } = message;

          switch (type) {
            case TaskWSMessageType.TASK_UPDATE:
              get().updateTask(payload.taskId, payload.updates);
              break;
            case TaskWSMessageType.TASK_PROGRESS:
              get().updateTask(payload.taskId, { progress: payload.progress });
              break;
            case TaskWSMessageType.TASK_COMPLETED:
              get().updateTask(payload.taskId, {
                status: TaskStatus.COMPLETED,
                result: payload.result,
                completedAt: new Date()
              });
              break;
            case TaskWSMessageType.TASK_FAILED:
              get().updateTask(payload.taskId, {
                status: TaskStatus.FAILED,
                error: payload.error,
                completedAt: new Date()
              });
              break;
            case TaskWSMessageType.SYSTEM_STATUS:
              set({ monitorStatus: payload.status });
              break;
          }
        },

        // 清理
        clearFilters: () => set({
          filters: defaultFilters,
          pagination: defaultPagination
        }),

        clearError: () => set({ error: null }),

        reset: () => set({
          tasks: [],
          taskTemplates: [],
          selectedTask: null,
          selectedTemplate: null,
          activeExecutions: new Map(),
          statistics: null,
          monitorStatus: null,
          pagination: defaultPagination,
          filters: defaultFilters,
          sort: defaultSort,
          loading: false,
          executing: false,
          error: null,
          wsConnected: false,
          formDraft: {}
        })
      }),
      {
        name: 'task-storage',
        partialize: (state) => ({
          filters: state.filters,
          sort: state.sort,
          formDraft: state.formDraft
        })
      }
    ),
    {
      name: 'task-store'
    }
  )
);