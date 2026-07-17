#!/bin/bash

# Agent身份合约注册功能测试运行脚本

echo "🚀 开始运行Agent身份合约注册功能测试"
echo "==========================================="

# 检查依赖
echo "📦 检查依赖..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装Node.js"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📥 安装项目依赖..."
    npm install
fi

# 创建测试结果目录
mkdir -p test-results/screenshots
mkdir -p test-results/reports

# 检查服务器状态
echo "🔍 检查服务器状态..."
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "✅ 服务器正在运行 (http://localhost:8080)"
else
    echo "⚠️  服务器未运行，尝试启动开发服务器..."
    npm run dev &
    DEV_SERVER_PID=$!
    echo "🔄 等待服务器启动..."
    sleep 10

    # 再次检查服务器状态
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ 开发服务器已启动 (http://localhost:5173)"
        # 更新配置文件使用开发服务器端口
        export BASE_URL=http://localhost:5173
    else
        echo "❌ 服务器启动失败，请手动启动服务器"
        exit 1
    fi
fi

# 运行测试
echo "🧪 开始运行测试..."
echo "==========================================="

# 运行基础测试
echo "📋 运行基础Agent注册测试..."
npm run test -- tests/agent-contract-registration.spec.ts

# 运行增强版测试
echo "📋 运行增强版Agent注册测试..."
npm run test -- tests/agent-registration-enhanced.spec.ts

# 生成测试报告
echo "📊 生成测试报告..."
npm run test:report

# 清理
if [ ! -z "$DEV_SERVER_PID" ]; then
    echo "🛑 停止开发服务器..."
    kill $DEV_SERVER_PID
fi

echo "==========================================="
echo "✅ 测试完成！"
echo "📊 测试报告已生成: open playwright-report/index.html"
echo "📸 截图保存在: test-results/screenshots/"
echo "==========================================="

# 自动打开测试报告（如果支持）
if command -v open &> /dev/null; then
    echo "🌐 自动打开测试报告..."
    open playwright-report/index.html
elif command -v xdg-open &> /dev/null; then
    echo "🌐 自动打开测试报告..."
    xdg-open playwright-report/index.html
fi