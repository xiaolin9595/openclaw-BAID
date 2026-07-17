#!/usr/bin/env node

/**
 * Agent Discovery Test Suite - Simple Version
 * 测试Agent发现页面的筛选功能
 */

// 模拟Agent数据（基于sharedAgentData.ts的内容）
const mockAgents = [
  {
    id: 'agent_shared_001',
    name: 'Claude AI Assistant',
    description: '基于大语言模型的AI助手，支持自然语言交互和代码生成',
    role: '通用助手',
    boundUser: 'user_001',
    taskRequirements: ['文本生成', '代码编写', '问答', '翻译'],
    specialties: ['自然语言处理', '代码生成', '多语言支持'],
    language: 'typescript'
  },
  {
    id: 'agent_shared_002',
    name: 'Data Analyzer Pro',
    description: '专业数据分析工具，支持机器学习模型训练和预测',
    role: '数据分析师',
    boundUser: 'user_002',
    taskRequirements: ['数据清洗', '统计分析', '机器学习', '预测建模'],
    specialties: ['Python', 'pandas', 'scikit-learn', 'TensorFlow'],
    language: 'python'
  },
  {
    id: 'agent_shared_003',
    name: 'Security Monitor',
    description: 'AI安全监控系统，支持异常检测和威胁识别',
    role: '安全专家',
    boundUser: 'user_003',
    taskRequirements: ['威胁检测', '安全监控', '漏洞扫描', '入侵检测'],
    specialties: ['网络安全', '区块链安全', '智能合约审计'],
    language: 'solidity'
  },
  {
    id: 'agent_shared_004',
    name: 'Finance Advisor Pro',
    description: '专业财务顾问AI，提供投资建议和财务规划服务',
    role: '财务顾问',
    boundUser: '1-175826628',
    taskRequirements: ['投资分析', '风险评估', '财务规划', '市场预测'],
    specialties: ['金融市场', '投资组合管理', '风险控制'],
    language: 'java'
  },
  {
    id: 'agent_shared_005',
    name: 'Health Assistant',
    description: '智能健康助手，提供健康咨询和医疗建议',
    role: '健康医生',
    boundUser: 'lin-175879861',
    taskRequirements: ['健康咨询', '症状分析', '用药建议', '康复指导'],
    specialties: ['医学知识', '健康监测', '疾病预防'],
    language: 'python'
  },
  {
    id: 'agent_shared_006',
    name: 'Family Care Assistant',
    description: '家庭生活助手，提供日常管理和家政服务建议',
    role: '家庭助理',
    boundUser: 'user_004',
    taskRequirements: ['日程管理', '家政服务', '购物建议', '家庭娱乐'],
    specialties: ['生活管理', '家庭教育', '营养搭配'],
    language: 'javascript'
  },
  {
    id: 'agent_shared_007',
    name: 'Legal Advisor',
    description: '法律顾问AI，提供法律咨询和合同审查服务',
    role: '法律顾问',
    boundUser: '1-175826628',
    taskRequirements: ['法律咨询', '合同审查', '合规检查', '纠纷调解'],
    specialties: ['合同法', '公司法', '知识产权法'],
    language: 'python'
  },
  {
    id: 'agent_shared_008',
    name: 'Education Tutor',
    description: '智能教育导师，提供个性化学习计划和知识辅导',
    role: '教育导师',
    boundUser: 'lin-175879861',
    taskRequirements: ['个性化教学', '知识问答', '学习计划', '考试辅导'],
    specialties: ['数学', '物理', '编程教育'],
    language: 'typescript'
  },
  {
    id: 'agent_shared_009',
    name: 'HR Assistant',
    description: '人力资源管理助手，提供招聘和员工管理服务',
    role: '人力资源',
    boundUser: 'user_005',
    taskRequirements: ['招聘筛选', '员工培训', '绩效评估', '薪资管理'],
    specialties: ['人才招聘', '员工关系', '培训发展'],
    language: 'java'
  },
  {
    id: 'agent_shared_010',
    name: 'Marketing Specialist',
    description: '市场营销专家，提供营销策略和推广方案',
    role: '营销专家',
    boundUser: 'user_001',
    taskRequirements: ['市场分析', '品牌推广', '内容营销', '社交媒体'],
    specialties: ['数字营销', '品牌策略', '内容创作'],
    language: 'javascript'
  },
  {
    id: 'agent_shared_011',
    name: 'Travel Assistant',
    description: '智能旅行助手，提供行程规划和旅行建议',
    role: '旅行顾问',
    boundUser: 'agent-18239478',
    taskRequirements: ['行程规划', '酒店预订', '景点推荐', '交通安排'],
    specialties: ['目的地研究', '预算规划', '当地文化'],
    language: 'python'
  },
  {
    id: 'agent_shared_012',
    name: 'Fitness Coach',
    description: 'AI健身教练，提供个性化健身计划和营养建议',
    role: '健身教练',
    boundUser: '1-175826628',
    taskRequirements: ['健身计划', '营养指导', '运动跟踪', '目标设定'],
    specialties: ['力量训练', '有氧运动', '瑜伽指导'],
    language: 'javascript'
  },
  {
    id: 'agent_shared_013',
    name: 'Language Tutor',
    description: '多语言导师，提供语言学习和翻译服务',
    role: '语言导师',
    boundUser: 'lin-175879861',
    taskRequirements: ['语言学习', '翻译服务', '口语练习', '文化介绍'],
    specialties: ['英语', '日语', '韩语', '法语'],
    language: 'typescript'
  },
  {
    id: 'agent_shared_014',
    name: 'Recipe Assistant',
    description: '美食助手，提供菜谱推荐和烹饪指导',
    role: '美食顾问',
    boundUser: 'user_002',
    taskRequirements: ['菜谱推荐', '营养搭配', '烹饪技巧', '食材选择'],
    specialties: ['中式料理', '西式料理', '烘焙', '素食'],
    language: 'python'
  },
  {
    id: 'agent_shared_015',
    name: 'Career Counselor',
    description: '职业规划师，提供职业发展建议和求职指导',
    role: '职业顾问',
    boundUser: 'user_003',
    taskRequirements: ['职业规划', '简历优化', '面试指导', '技能提升'],
    specialties: ['行业分析', '职业咨询', '求职策略'],
    language: 'java'
  },
  {
    id: 'agent_shared_016',
    name: 'Mental Health Assistant',
    description: '心理健康助手，提供情绪支持和心理健康建议',
    role: '心理顾问',
    boundUser: '1-175826628',
    taskRequirements: ['情绪支持', '压力管理', '心理咨询', '健康建议'],
    specialties: ['认知行为疗法', '正念冥想', '情绪调节'],
    language: 'python'
  },
  {
    id: 'agent_shared_017',
    name: 'Tech Support',
    description: '技术支持助手，提供IT问题解决和技术咨询',
    role: '技术支持',
    boundUser: 'user_004',
    taskRequirements: ['故障排除', '技术咨询', '系统维护', '用户培训'],
    specialties: ['硬件问题', '软件问题', '网络配置'],
    language: 'javascript'
  },
  {
    id: 'agent_shared_018',
    name: 'Music Composer',
    description: '音乐创作助手，提供作曲和音乐制作服务',
    role: '音乐创作',
    boundUser: 'agent-18239478',
    taskRequirements: ['作曲编曲', '音频处理', '音乐制作', '声音设计'],
    specialties: ['电子音乐', '古典音乐', '流行音乐', '电影配乐'],
    language: 'typescript'
  },
  {
    id: 'agent_shared_019',
    name: 'Gardening Assistant',
    description: '园艺助手，提供植物养护和园艺设计建议',
    role: '园艺顾问',
    boundUser: 'lin-175879861',
    taskRequirements: ['植物养护', '园艺设计', '病虫害防治', '季节种植'],
    specialties: ['室内植物', '花园设计', '有机种植'],
    language: 'python'
  },
  {
    id: 'agent_shared_020',
    name: 'Pet Care Assistant',
    description: '宠物护理助手，提供宠物饲养和健康建议',
    role: '宠物护理',
    boundUser: 'user_005',
    taskRequirements: ['宠物饲养', '健康检查', '行为训练', '营养搭配'],
    specialties: ['狗狗护理', '猫咪护理', '小动物饲养'],
    language: 'javascript'
  },
  {
    id: 'agent_shared_021',
    name: 'Fashion Stylist',
    description: '时尚造型师，提供穿搭建议和时尚指导',
    role: '时尚顾问',
    boundUser: 'user_001',
    taskRequirements: ['穿搭建议', '时尚指导', '购物推荐', '形象设计'],
    specialties: ['日常穿搭', '商务正装', '休闲风格', '配饰搭配'],
    language: 'typescript'
  },
  {
    id: 'agent_shared_022',
    name: 'Home Design Assistant',
    description: '家居设计助手，提供室内设计和装修建议',
    role: '室内设计师',
    boundUser: 'user_002',
    taskRequirements: ['空间规划', '家具选择', '色彩搭配', '材料建议'],
    specialties: ['现代风格', '北欧风格', '工业风格', '古典风格'],
    language: 'python'
  },
  {
    id: 'agent_shared_023',
    name: 'Investment Advisor',
    description: '投资顾问，提供投资策略和理财建议',
    role: '投资顾问',
    boundUser: '1-175826628',
    taskRequirements: ['投资策略', '理财规划', '风险评估', '市场分析'],
    specialties: ['股票投资', '基金投资', '房地产投资', '加密货币'],
    language: 'java'
  },
  {
    id: 'agent_shared_024',
    name: 'Environmental Assistant',
    description: '环保助手，提供环保建议和可持续发展指导',
    role: '环保顾问',
    boundUser: 'user_003',
    taskRequirements: ['环保建议', '节能方案', '可持续发展', '废物处理'],
    specialties: ['绿色能源', '节能减排', '环保材料'],
    language: 'python'
  },
  {
    id: 'agent_shared_025',
    name: 'Writing Assistant',
    description: '写作助手，提供文案创作和编辑服务',
    role: '写作助手',
    boundUser: 'lin-175879861',
    taskRequirements: ['文案创作', '编辑校对', '内容策划', '风格指导'],
    specialties: ['商务写作', '创意写作', '技术文档', '学术写作'],
    language: 'typescript'
  }
];

// 模拟前端筛选逻辑的测试器
class AgentDiscoveryTester {
  constructor() {
    this.agents = mockAgents;
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

    console.log('\n👥 用户ID分布:');
    const userCounts = {};
    this.agents.forEach(agent => {
      userCounts[agent.boundUser] = (userCounts[agent.boundUser] || 0) + 1;
    });
    Object.entries(userCounts).forEach(([user, count]) => {
      console.log(`  ${user}: ${count}个Agent`);
    });

    return {
      total: tests.length,
      passed: passedTests,
      failed: tests.length - passedTests,
      successRate: (passedTests / tests.length) * 100
    };
  }
}

// 运行测试
const tester = new AgentDiscoveryTester();
const results = tester.runAllTests();

process.exit(results.passed === results.total ? 0 : 1);