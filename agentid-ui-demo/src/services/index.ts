/**
 * 服务层统一导出文件
 */

// 导出任务服务
export { TaskService as taskService } from './taskService';

// 导出模拟数据（仅用于开发环境）
export {
  mockBaseAgents,
  mockBlockchainAgents,
  mockAgentContracts,
  mockDiscoveryStats,
  mockCommunicationStatus,
  generateMockAgentDiscoveryList
} from '../mocks/agentDiscoveryMock';

// 导出任务相关模拟数据
export {
  mockTaskTemplates,
  mockTaskLogs,
  mockTaskResults,
  mockTaskStatistics,
  mockMonitorStatus,
  getAllTaskTemplates,
  getTaskTemplatesByType,
  getTaskTemplateById,
  getFormConfigByTemplate
} from '../mocks/taskMock';