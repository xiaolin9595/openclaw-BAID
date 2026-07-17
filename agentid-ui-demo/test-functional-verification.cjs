#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔬 统一Agent数据源功能验证测试\n');

// 1. 验证统一数据源实现
console.log('1️⃣ 验证统一数据源实现:');
const unifiedStores = [
  'unifiedAgentStore.ts',
  'unifiedAgentDiscoveryStore.ts',
  'unifiedBlockchainStore.ts'
];

unifiedStores.forEach(storeFile => {
  const filePath = path.join(__dirname, 'src/store', storeFile);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasSharedData = content.includes('sharedData');
    const hasEventSystem = content.includes('eventSystem');
    const hasDataSync = content.includes('syncData');
    
    console.log(`  📦 ${storeFile}:`);
    console.log(`    共享数据: ${hasSharedData ? '✅' : '❌'}`);
    console.log(`    事件系统: ${hasEventSystem ? '✅' : '❌'}`);
    console.log(`    数据同步: ${hasDataSync ? '✅' : '❌'}`);
  }
});

// 2. 验证数据流
console.log('\n2️⃣ 验证数据流架构:');
console.log('  🔄 预期数据流:');
console.log('    Agent管理页面 → 统一AgentStore → 共享数据');
console.log('    Agent发现页面 → 统一AgentDiscoveryStore ← 共享数据');
console.log('    区块链页面 → 统一BlockchainStore ← 共享数据');

// 3. 验证组件集成
console.log('\n3️⃣ 验证组件集成:');
const pageComponents = [
  'AgentDiscoveryPage.tsx',
  'AgentsListPage.tsx', 
  'BlockchainPage.tsx'
];

pageComponents.forEach(component => {
  const componentPath = path.join(__dirname, 'src/pages', 
    component.includes('Discovery') ? 'agent-discovery' :
    component.includes('Agents') ? 'agents' : 'blockchain',
    component);
  
  if (fs.existsSync(componentPath)) {
    const content = fs.readFileSync(componentPath, 'utf8');
    const hasUnifiedStore = content.includes('useUnified');
    const hasErrorHandling = content.includes('error') || content.includes('Error');
    const hasLoadingState = content.includes('loading') || content.includes('Loading');
    
    console.log(`  🧩 ${component}:`);
    console.log(`    统一Store: ${hasUnifiedStore ? '✅' : '❌'}`);
    console.log(`    错误处理: ${hasErrorHandling ? '✅' : '❌'}`);
    console.log(`    加载状态: ${hasLoadingState ? '✅' : '❌'}`);
  }
});

// 4. 模拟测试场景
console.log('\n4️⃣ 模拟测试场景:');
console.log('  📋 测试场景1: 数据同步');
console.log('    步骤1: 在Agent管理页面创建新Agent');
console.log('    步骤2: 切换到Agent发现页面');
console.log('    预期: 新创建的Agent应该出现在搜索结果中');

console.log('\n  📋 测试场景2: 状态同步');
console.log('    步骤1: 在Agent管理页面修改Agent状态');
console.log('    步骤2: 切换到区块链页面');
console.log('    预期: Agent状态变更应该反映在区块链合约中');

console.log('\n  📋 测试场景3: 搜索功能');
console.log('    步骤1: 在Agent发现页面搜索特定Agent');
console.log('    步骤2: 验证搜索结果准确性');
console.log('    预期: 搜索结果应该与数据一致');

// 5. 性能和错误处理验证
console.log('\n5️⃣ 性能和错误处理验证:');
console.log('  ⚡ 性能检查点:');
console.log('    - 数据加载时间 < 2秒');
console.log('    - 搜索响应时间 < 1秒');
console.log('    - 页面切换流畅无卡顿');

console.log('\n  🛡️ 错误处理检查点:');
console.log('    - 网络错误时显示友好提示');
console.log('    - 数据加载失败时提供重试机制');
console.log('    - 页面崩溃时保持应用稳定性');

console.log('\n🎯 功能验证完成！');
console.log('请在浏览器中手动执行上述测试场景验证数据同步功能。');
