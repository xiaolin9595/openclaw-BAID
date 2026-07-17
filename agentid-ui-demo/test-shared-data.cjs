const { sharedAgentData } = require('./src/mocks/sharedAgentData.js');

console.log('=== 共享数据源测试 ===');

// 1. 检查初始数据
console.log('\n1. 初始 Agent 数量:', sharedAgentData.getAgents().length);

// 2. 添加新 Agent
console.log('\n2. 添加新 Agent...');
const newAgent = {
  name: '测试新 Agent',
  description: '这是一个新添加的测试 Agent',
  codeHash: '0xtest123456789',
  profileHash: '0xtest987654321',
  status: 'active',
  boundUser: 'test_user',
  boundAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  codeSize: 500000,
  language: 'javascript',
  config: {
    permissions: ['read', 'write'],
    userBinding: {
      boundUserId: 'test_user',
      bindingType: 'faceBiometrics',
      bindingStrength: 'basic',
      verificationFrequency: 'once',
      fallbackAllowed: true
    }
  },
  permissions: ['read', 'write']
};

const addedAgent = sharedAgentData.addAgent(newAgent);
console.log('新 Agent ID:', addedAgent.id);
console.log('添加后总数:', sharedAgentData.getAgents().length);

// 3. 验证数据在所有地方可用
console.log('\n3. 验证数据一致性...');
const allAgents = sharedAgentData.getAgents();
const foundAgent = allAgents.find(agent => agent.id === addedAgent.id);
console.log('新 Agent 在共享数据中找到:', !!foundAgent);

// 4. 测试删除功能
console.log('\n4. 测试删除功能...');
sharedAgentData.deleteAgent(addedAgent.id);
console.log('删除后总数:', sharedAgentData.getAgents().length);
const deletedAgent = sharedAgentData.getAgents().find(agent => agent.id === addedAgent.id);
console.log('已删除 Agent 是否存在:', !!deletedAgent);

console.log('\n=== 测试完成 ===');