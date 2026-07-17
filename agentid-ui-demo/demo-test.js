#!/usr/bin/env node

/**
 * Agent身份合约注册功能测试演示脚本
 * 用于快速展示测试功能和结果
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

console.log('🎯 Agent身份合约注册功能测试演示');
console.log('===================================');

// 检查Node.js版本
const nodeVersion = process.version;
console.log(`📦 Node.js版本: ${nodeVersion}`);

// 检查项目依赖
console.log('🔍 检查项目依赖...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredDeps = ['@playwright/test', 'react', 'typescript'];
const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]);

if (missingDeps.length > 0) {
    console.log('❌ 缺少依赖:', missingDeps.join(', '));
    console.log('💡 请运行: npm install');
    process.exit(1);
}

console.log('✅ 所有必要依赖已安装');

// 检查测试文件
const testFiles = [
    'tests/agent-contract-registration.spec.ts',
    'tests/agent-registration-enhanced.spec.ts',
    'tests/utils/test-utils.ts',
    'tests/config/test-config.json'
];

console.log('📋 检查测试文件...');
testFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - 文件不存在`);
    }
});

// 显示测试配置
console.log('\n⚙️  测试配置:');
const testConfig = JSON.parse(fs.readFileSync('tests/config/test-config.json', 'utf8'));
console.log(`🌐 基础URL: ${testConfig.baseUrl}`);
console.log(`👤 测试用户: ${testConfig.testUser.email}`);
console.log(`⏱️  导航超时: ${testConfig.timeouts.navigation}ms`);

// 显示测试场景
console.log('\n🧪 测试场景:');
console.log('1. 🚪 打开应用首页');
console.log('2. 🔐 用户登录系统');
console.log('3. 🧭 导航到区块链页面');
console.log('4. 📝 进入Agent注册流程');
console.log('5. ⚙️  4步注册流程:');
console.log('   - 选择Agent');
console.log('   - 配置合约参数');
console.log('   - 部署合约');
console.log('   - 查看结果');
console.log('6. ✅ 验证注册结果');

// 显示运行命令
console.log('\n🚀 运行命令:');
console.log('./run-tests.sh                    # 运行完整测试套件');
console.log('npm test                          # 运行所有测试');
console.log('npm run test:ui                   # UI模式调试');
console.log('npm run test:report               # 查看测试报告');

// 检查服务器状态
console.log('\n🌐 检查服务器状态...');

function checkServer(url) {
    return new Promise((resolve) => {
        const req = http.request(url, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}

async function main() {
    const server8080 = await checkServer('http://localhost:8080');
    const server5173 = await checkServer('http://localhost:5173');

    if (server8080) {
        console.log('✅ 服务器运行在 http://localhost:8080');
    } else if (server5173) {
        console.log('✅ 开发服务器运行在 http://localhost:5173');
    } else {
        console.log('❌ 服务器未运行');
        console.log('💡 请启动服务器:');
        console.log('   npm run dev');
    }

    // 预期结果
    console.log('\n🎯 预期结果:');
    console.log('✅ 注册流程顺利完成');
    console.log('✅ 新的Agent合约成功显示在管理列表中');
    console.log('✅ 合约状态为活跃或待确认');

    console.log('\n🎉 演示完成！');
    console.log('💡 运行测试: ./run-tests.sh');
}

main().catch(console.error);