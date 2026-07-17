#!/bin/bash
# 启用 Docker 沙箱权限脚本

echo "=== SwiftClaw Docker 沙箱权限配置 ==="
echo ""

# 1. 添加用户到 docker 组
if ! groups $USER | grep -q docker; then
    echo "正在将用户 $USER 添加到 docker 组..."
    sudo usermod -aG docker $USER
    echo "✅ 已添加用户到 docker 组"
else
    echo "✅ 用户已在 docker 组"
fi

# 2. 检查 Docker 服务
if ! systemctl is-active --quiet docker; then
    echo "正在启动 Docker 服务..."
    sudo systemctl start docker
    echo "✅ Docker 服务已启动"
else
    echo "✅ Docker 服务运行中"
fi

# 3. 拉取基础镜像
echo "正在拉取 alpine 镜像..."
sudo docker pull alpine:latest
echo "✅ 镜像准备完成"

echo ""
echo "=== 配置完成 ==="
echo "请注销并重新登录，或运行: newgrp docker"
echo "然后运行测试: python test_sandbox.py"
