/**
 * 统一数据源验证脚本
 * 验证统一数据源的基本功能
 */

// 由于TypeScript模块导入问题，我们使用动态导入
async function loadModules() {
  try {
    const [
      { unifiedAgentDataManager },
      { AgentDataConverter },
      { unifiedDataAdapter },
      { unifiedBlockchainAdapter },
      { unifiedAgentAdapter }
    ] = await Promise.all([
      import('./src/data/unifiedAgentDataManager.ts'),
      import('./src/data/agentDataConverter.ts'),
      import('./src/data/unifiedDataAdapter.ts'),
      import('./src/data/unifiedBlockchainAdapter.ts'),
      import('./src/data/unifiedAgentAdapter.ts')
    ]);

    return {
      unifiedAgentDataManager,
      AgentDataConverter,
      unifiedDataAdapter,
      unifiedBlockchainAdapter,
      unifiedAgentAdapter
    };
  } catch (error) {
    console.error('模块加载失败:', error);
    throw error;
  }
}

async function verifyUnifiedDataSource() {
  console.log('🔍 开始验证统一数据源...\n');

  try {
    // 加载模块
    const modules = await loadModules();
    const { unifiedAgentDataManager, AgentDataConverter, unifiedDataAdapter, unifiedBlockchainAdapter, unifiedAgentAdapter } = modules;

    // 1. 测试数据管理器基础功能
    console.log('1️⃣ 测试数据管理器基础功能...');

    // 清空数据
    unifiedAgentDataManager.clearAll();

    // 添加测试Agent
    const testAgent = unifiedAgentDataManager.addAgent({
      name: '验证测试Agent',
      description: '用于验证统一数据源功能的Agent',
      type: 'AI Assistant',
      capabilities: ['工作助理'],
      status: 'active',
      version: '1.0.0',
      config: {
        permissions: ['read'],
        userBinding: {
          boundUserId: 'test_user',
          bindingType: 'faceBiometrics',
          bindingStrength: 'basic',
          verificationFrequency: 'once',
          fallbackAllowed: true
        }
      },
      blockchainInfo: {
        isOnChain: false,
        verificationStatus: 'unverified',
        syncStatus: 'synced'
      },
      metadata: {
        tags: ['验证测试'],
        categories: ['AI Assistant'],
        securityLevel: 'medium',
        compliance: []
      }
    });

    console.log(`✅ 成功添加Agent: ${testAgent.name}`);

    // 验证Agent可以被检索到
    const retrievedAgent = unifiedAgentDataManager.getAgentById(testAgent.id);
    if (retrievedAgent && retrievedAgent.name === '验证测试Agent') {
      console.log('✅ Agent检索功能正常');
    } else {
      throw new Error('Agent检索功能异常');
    }

    // 更新Agent
    const updateSuccess = unifiedAgentDataManager.updateAgent(testAgent.id, {
      name: '更新后的验证测试Agent',
      status: 'inactive'
    });

    if (updateSuccess) {
      const updatedAgent = unifiedAgentDataManager.getAgentById(testAgent.id);
      if (updatedAgent && updatedAgent.name === '更新后的验证测试Agent') {
        console.log('✅ Agent更新功能正常');
      } else {
        throw new Error('Agent更新功能异常');
      }
    } else {
      throw new Error('Agent更新失败');
    }

    // 搜索功能
    const searchResults = unifiedAgentDataManager.searchAgents('验证测试');
    if (searchResults.length > 0 && searchResults[0].name.includes('验证测试')) {
      console.log('✅ Agent搜索功能正常');
    } else {
      throw new Error('Agent搜索功能异常');
    }

    // 过滤功能
    const filterResults = unifiedAgentDataManager.filterAgents({ status: 'inactive' });
    if (filterResults.length > 0) {
      console.log('✅ Agent过滤功能正常');
    } else {
      throw new Error('Agent过滤功能异常');
    }

    // 获取统计信息
    const stats = unifiedAgentDataManager.getStats();
    if (stats.totalAgents > 0) {
      console.log(`✅ 统计信息功能正常，总Agent数: ${stats.totalAgents}`);
    } else {
      throw new Error('统计信息功能异常');
    }

    console.log('');

    // 2. 测试数据适配器
    console.log('2️⃣ 测试数据适配器...');

    // 测试Agent发现适配器
    const discoveryResult = await unifiedDataAdapter.searchAgents({
      page: 1,
      pageSize: 10,
      search: '验证测试'
    });

    if (discoveryResult.agents.length > 0) {
      console.log('✅ Agent发现适配器正常');
    } else {
      throw new Error('Agent发现适配器异常');
    }

    // 测试Agent适配器
    const agentList = await unifiedAgentAdapter.fetchAgents();
    if (agentList.length > 0) {
      console.log('✅ Agent适配器正常');
    } else {
      throw new Error('Agent适配器异常');
    }

    // 测试区块链适配器
    const blockchainAgents = await unifiedBlockchainAdapter.getAvailableAgents();
    if (blockchainAgents.length > 0) {
      console.log('✅ 区块链适配器正常');
    } else {
      throw new Error('区块链适配器异常');
    }

    console.log('');

    // 3. 测试数据同步
    console.log('3️⃣ 测试数据同步...');

    // 添加新的Agent
    const syncTestAgent = unifiedAgentDataManager.addAgent({
      name: '同步测试Agent',
      description: '用于测试数据同步的Agent',
      type: 'Data Processing',
      capabilities: ['数据分析'],
      status: 'active',
      version: '2.0.0',
      config: {
        permissions: ['read', 'write'],
        userBinding: {
          boundUserId: 'sync_user',
          bindingType: 'multiFactor',
          bindingStrength: 'strict',
          verificationFrequency: 'daily',
          fallbackAllowed: false
        }
      },
      blockchainInfo: {
        isOnChain: true,
        verificationStatus: 'verified',
        syncStatus: 'synced'
      },
      metadata: {
        tags: ['同步测试'],
        categories: ['Data Processing'],
        securityLevel: 'high',
        compliance: ['GDPR', 'SOC2']
      }
    });

    // 验证数据同步到各个适配器
    const discoverySyncResult = await unifiedDataAdapter.searchAgents({
      page: 1,
      pageSize: 10,
      search: '同步测试'
    });

    const managementSyncResult = await unifiedAgentAdapter.fetchAgents();
    const blockchainSyncResult = await unifiedBlockchainAdapter.getAvailableAgents();

    const syncSuccess =
      discoverySyncResult.agents.some(a => a.name === '同步测试Agent') &&
      managementSyncResult.some(a => a.name === '同步测试Agent') &&
      blockchainSyncResult.some(a => a.name === '同步测试Agent');

    if (syncSuccess) {
      console.log('✅ 数据同步功能正常');
    } else {
      throw new Error('数据同步功能异常');
    }

    console.log('');

    // 4. 测试数据转换器
    console.log('4️⃣ 测试数据转换器...');

    // 测试转换功能
    const unifiedAgent = unifiedAgentDataManager.getAllAgents()[0];
    if (unifiedAgent) {
      // 转换为AgentDiscoveryItem格式并转回
      const discoveryItem = AgentDataConverter.toAgentDiscoveryItem(unifiedAgent);
      const convertedBack = AgentDataConverter.fromAgentDiscoveryItem(discoveryItem);

      if (convertedBack.id === unifiedAgent.id && convertedBack.name === unifiedAgent.name) {
        console.log('✅ 数据转换器正常');
      } else {
        throw new Error('数据转换器异常');
      }
    } else {
      throw new Error('无法获取Agent进行转换测试');
    }

    console.log('');

    // 5. 显示最终统计
    console.log('5️⃣ 最终数据统计...');
    const finalStats = unifiedAgentDataManager.getStats();
    const finalAgents = unifiedAgentDataManager.getAllAgents();
    const finalContracts = unifiedAgentDataManager.getAgentContracts();

    console.log(`📊 统计信息:`);
    console.log(`   总Agent数: ${finalStats.totalAgents}`);
    console.log(`   活跃Agent: ${finalStats.activeAgents}`);
    console.log(`   非活跃Agent: ${finalStats.inactiveAgents}`);
    console.log(`   验证Agent: ${finalStats.verifiedAgents}`);
    console.log(`   区块链Agent: ${finalStats.onChainAgents}`);
    console.log(`   平均评分: ${finalStats.averageRating.toFixed(1)}`);
    console.log(`   Agent合约数: ${finalContracts.length}`);

    console.log(`\n📋 Agent列表:`);
    finalAgents.forEach((agent, index) => {
      console.log(`   ${index + 1}. ${agent.name} (${agent.type}) - ${agent.status}`);
      console.log(`      能力: ${agent.capabilities.join(', ')}`);
      console.log(`      区块链: ${agent.blockchainInfo.isOnChain ? '是' : '否'}`);
    });

    console.log('\n🎉 统一数据源验证完成！所有功能正常工作。');
    return true;

  } catch (error) {
    console.error(`❌ 验证失败: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// 运行验证
verifyUnifiedDataSource().then(success => {
  if (success) {
    console.log('\n✅ 验证通过！统一数据源功能正常。');
    process.exit(0);
  } else {
    console.log('\n❌ 验证失败！请检查统一数据源实现。');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 验证过程出错:', error);
  process.exit(1);
});