#!/usr/bin/env node

/**
 * Agent Discovery Test Suite
 * 测试Agent发现页面的筛选功能
 */

const { sharedAgentData } = require('../src/mocks/sharedAgentData.ts');

// 模拟前端筛选逻辑
class AgentDiscoveryTester {
  constructor() {
    this.agents = sharedAgentData.getAgents();
    this.testResults = [];
  }

  // 记录测试结果
  logTest(testName, passed, details = '') {
    const result = {
      test: testName,
      status: passed ? 'PASS' : 'FAIL',
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${passed ? 'PASSED' : 'FAILED'} ${details ? `- ${details}` : ''}`);
    return passed;
  }

  // 测试1: 基本加载 - 验证所有25个Agent都能正确显示
  testBasicLoad() {
    console.log('\n=== 测试1: 基本加载和显示 ===');

    const agents = this.agents;
    const passed = agents.length === 25;

    this.logTest(
      '所有25个Agent正确加载',
      passed,
      `期望: 25个Agent, 实际: ${agents.length}个`
    );

    if (passed) {
      // 检查Agent数据的完整性
      const incompleteAgents = agents.filter(agent =>
        !agent.id || !agent.name || !agent.role || !agent.boundUser
      );

      this.logTest(
        'Agent数据完整性',
        incompleteAgents.length === 0,
        incompleteAgents.length > 0 ?
          `${incompleteAgents.length}个Agent数据不完整` :
          '所有Agent数据完整'
      );
    }

    return passed;
  }

  // 测试2: 文本搜索功能
  testTextSearch() {
    console.log('\n=== 测试2: 文本搜索功能 ===');

    let allPassed = true;

    // 搜索角色
    const searchResults1 = this.applyFilters({ searchText: '顾问' });
    const advisorCount = searchResults1.filter(agent =>
      agent.role?.includes('顾问') || agent.specialties?.includes('顾问')
    ).length;

    allPassed &= this.logTest(
      '搜索"顾问"',
      advisorCount > 0,
      `找到${advisorCount}个包含"顾问"的Agent`
    );

    // 搜索技术关键词
    const searchResults2 = this.applyFilters({ searchText: 'Python' });
    const pythonCount = searchResults2.filter(agent =>
      agent.language === 'python' || agent.specialties?.includes('Python')
    ).length;

    allPassed &= this.logTest(
      '搜索"Python"',
      pythonCount > 0,
      `找到${pythonCount}个Python相关Agent`
    );

    // 搜索描述
    const searchResults3 = this.applyFilters({ searchText: 'AI' });
    const aiCount = searchResults3.filter(agent =>
      agent.description.toLowerCase().includes('ai') ||
      agent.name.toLowerCase().includes('ai') ||
      agent.specialties?.some(spec => spec.toLowerCase().includes('ai'))
    ).length;

    allPassed &= this.logTest(
      '搜索"AI"',
      aiCount > 0,
      `找到${aiCount}个AI相关Agent`
    );

    return allPassed;
  }

  // 测试3: 角色筛选
  testRoleFilter() {
    console.log('\n=== 测试3: 角色筛选功能 ===');

    const roles = [...new Set(this.agents.map(agent => agent.role).filter(Boolean))];
    let allPassed = true;

    // 测试单个角色筛选
    const testRole = roles[0];
    const roleResults = this.applyFilters({ selectedRoles: [testRole] });
    const expectedCount = this.agents.filter(agent => agent.role === testRole).length;

    allPassed &= this.logTest(
      `单个角色筛选: ${testRole}`,
      roleResults.length === expectedCount,
      `期望: ${expectedCount}个, 实际: ${roleResults.length}个`
    );

    // 测试多角色筛选
    if (roles.length >= 2) {
      const multipleRoles = roles.slice(0, 2);
      const multiRoleResults = this.applyFilters({ selectedRoles: multipleRoles });
      const expectedMultiCount = this.agents.filter(agent =>
        multipleRoles.includes(agent.role)
      ).length;

      allPassed &= this.logTest(
        `多角色筛选: ${multipleRoles.join(', ')}`,
        multiRoleResults.length === expectedMultiCount,
        `期望: ${expectedMultiCount}个, 实际: ${multiRoleResults.length}个`
      );
    }

    return allPassed;
  }

  // 测试4: 用户ID筛选
  testUserIdFilter() {
    console.log('\n=== 测试4: 用户ID筛选功能 ===');

    const userIds = [...new Set(this.agents.map(agent => agent.boundUser).filter(id => id))];
    let allPassed = true;

    if (userIds.length > 0) {
      const testUserId = userIds[0];
      const userResults = this.applyFilters({ selectedUserId: testUserId });
      const expectedCount = this.agents.filter(agent => agent.boundUser === testUserId).length;

      allPassed &= this.logTest(
        `用户ID筛选: ${testUserId}`,
        userResults.length === expectedCount,
        `期望: ${expectedCount}个, 实际: ${userResults.length}个`
      );
    }

    return allPassed;
  }

  // 测试5: 任务需求筛选
  testTaskRequirementsFilter() {
    console.log('\n=== 测试5: 任务需求筛选功能 ===');

    const allRequirements = new Set();
    this.agents.forEach(agent => {
      if (agent.taskRequirements) {
        agent.taskRequirements.forEach(req => allRequirements.add(req));
      }
    });

    let allPassed = true;

    if (allRequirements.size > 0) {
      const testRequirement = Array.from(allRequirements)[0];
      const reqResults = this.applyFilters({ selectedTaskRequirements: [testRequirement] });
      const expectedCount = this.agents.filter(agent =>
        agent.taskRequirements?.includes(testRequirement)
      ).length;

      allPassed &= this.logTest(
        `任务需求筛选: ${testRequirement}`,
        reqResults.length === expectedCount,
        `期望: ${expectedCount}个, 实际: ${reqResults.length}个`
      );
    }

    return allPassed;
  }

  // 测试6: 组合筛选
  testCombinedFilters() {
    console.log('\n=== 测试6: 组合筛选功能 ===');

    let allPassed = true;

    // 文本搜索 + 角色筛选
    const combinedResults1 = this.applyFilters({
      searchText: '顾问',
      selectedRoles: ['财务顾问']
    });

    const expected1 = this.agents.filter(agent =>
      agent.role === '财务顾问' && (
        agent.name.includes('顾问') ||
        agent.description.includes('顾问') ||
        agent.specialties?.some(spec => spec.includes('顾问'))
      )
    ).length;

    allPassed &= this.logTest(
      '文本搜索 + 角色筛选',
      combinedResults1.length === expected1,
      `期望: ${expected1}个, 实际: ${combinedResults1.length}个`
    );

    return allPassed;
  }

  // 测试7: 清除筛选
  testClearFilters() {
    console.log('\n=== 测试7: 清除筛选功能 ===');

    // 先应用一些筛选
    this.applyFilters({
      searchText: 'test',
      selectedRoles: ['测试角色'],
      selectedUserId: 'test_user'
    });

    // 清除筛选
    const clearedResults = this.applyFilters({});

    const passed = this.logTest(
      '清除筛选',
      clearedResults.length === this.agents.length,
      `清除后应显示所有${this.agents.length}个Agent`
    );

    return passed;
  }

  // 应用筛选逻辑（模拟前端筛选函数）
  applyFilters(filters = {}) {
    let filtered = [...this.agents];

    // 文本搜索
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.description.toLowerCase().includes(searchLower) ||
        agent.role?.toLowerCase().includes(searchLower) ||
        agent.specialties?.some(spec => spec.toLowerCase().includes(searchLower))
      );
    }

    // 用户ID筛选
    if (filters.selectedUserId) {
      filtered = filtered.filter(agent => agent.boundUser === filters.selectedUserId);
    }

    // 角色筛选
    if (filters.selectedRoles && filters.selectedRoles.length > 0) {
      filtered = filtered.filter(agent =>
        agent.role && filters.selectedRoles.includes(agent.role)
      );
    }

    // 任务需求筛选
    if (filters.selectedTaskRequirements && filters.selectedTaskRequirements.length > 0) {
      filtered = filtered.filter(agent =>
        agent.taskRequirements && filters.selectedTaskRequirements.some(req =>
          agent.taskRequirements?.includes(req)
        )
      );
    }

    return filtered;
  }

  // 运行所有测试
  runAllTests() {
    console.log('🚀 开始Agent发现页面功能测试');
    console.log('=====================================');

    const tests = [
      () => this.testBasicLoad(),
      () => this.testTextSearch(),
      () => this.testRoleFilter(),
      () => this.testUserIdFilter(),
      () => this.testTaskRequirementsFilter(),
      () => this.testCombinedFilters(),
      () => this.testClearFilters()
    ];

    let passedTests = 0;
    tests.forEach(test => {
      if (test()) passedTests++;
    });

    // 输出测试总结
    console.log('\n=====================================');
    console.log('📊 测试总结');
    console.log('=====================================');
    console.log(`总测试数: ${tests.length}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${tests.length - passedTests}`);
    console.log(`成功率: ${((passedTests / tests.length) * 100).toFixed(1)}%`);

    // 输出数据统计
    console.log('\n📈 数据统计');
    console.log('=====================================');
    const roles = [...new Set(this.agents.map(agent => agent.role).filter(Boolean))];
    const userIds = [...new Set(this.agents.map(agent => agent.boundUser).filter(id => id))];
    const allRequirements = new Set();
    this.agents.forEach(agent => {
      if (agent.taskRequirements) {
        agent.taskRequirements.forEach(req => allRequirements.add(req));
      }
    });

    console.log(`总Agent数: ${this.agents.length}`);
    console.log(`不同角色: ${roles.length}个`);
    console.log(`不同用户: ${userIds.length}个`);
    console.log(`不同任务需求: ${allRequirements.size}个`);

    return {
      total: tests.length,
      passed: passedTests,
      failed: tests.length - passedTests,
      successRate: (passedTests / tests.length) * 100
    };
  }
}

// 运行测试
if (require.main === module) {
  const tester = new AgentDiscoveryTester();
  const results = tester.runAllTests();

  process.exit(results.passed === results.total ? 0 : 1);
}

module.exports = AgentDiscoveryTester;