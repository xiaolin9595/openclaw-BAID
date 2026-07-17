#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 测试统一数据源功能
console.log('🧪 开始测试统一Agent数据源功能...\n');

// 1. 检查文件是否存在
const filesToCheck = [
  'src/store/unifiedAgentStore.ts',
  'src/store/unifiedAgentDiscoveryStore.ts', 
  'src/store/unifiedBlockchainStore.ts',
  'src/store/index.ts'
];

console.log('📁 检查文件存在性:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// 2. 检查页面组件导入
console.log('\n🔍 检查页面组件导入:');
const pagesToCheck = [
  {
    file: 'src/pages/agent-discovery/AgentDiscoveryPage.tsx',
    expectedImport: 'useUnifiedAgentDiscoveryStore'
  },
  {
    file: 'src/pages/agents/AgentsListPage.tsx',
    expectedImport: 'useUnifiedAgentStore'
  },
  {
    file: 'src/pages/blockchain/BlockchainPage.tsx',
    expectedImport: 'useUnifiedBlockchainStore'
  }
];

pagesToCheck.forEach(({file, expectedImport}) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasCorrectImport = content.includes(expectedImport);
    console.log(`  ${hasCorrectImport ? '✅' : '❌'} ${file} - ${expectedImport}`);
  } else {
    console.log(`  ❌ ${file} - 文件不存在`);
  }
});

// 3. 检查store导出
console.log('\n📤 检查store导出:');
const storeIndexPath = path.join(__dirname, 'src/store/index.ts');
if (fs.existsSync(storeIndexPath)) {
  const storeIndexContent = fs.readFileSync(storeIndexPath, 'utf8');
  const unifiedExports = [
    'useUnifiedAgentStore',
    'useUnifiedAgentDiscoveryStore', 
    'useUnifiedBlockchainStore'
  ];
  
  unifiedExports.forEach(exportName => {
    const hasExport = storeIndexContent.includes(exportName);
    console.log(`  ${hasExport ? '✅' : '❌'} ${exportName}`);
  });
}

console.log('\n🎯 基本检查完成！');
console.log('请在浏览器中访问 http://localhost:5173 进行手动测试:');
console.log('  1. 登录后访问 Agent发现 页面');
console.log('  2. 访问 Agent管理 页面'); 
console.log('  3. 访问 区块链 页面');
console.log('  4. 测试添加新Agent并在不同页面查看同步情况');
