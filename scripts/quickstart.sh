#!/bin/bash
# 蓝湖 MCP 服务器快速启动脚本 (TypeScript)

set -e
cd "$(dirname "$0")/.."

echo "🎨 蓝湖 MCP 服务器 - 快速启动"
echo "=================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ 错误：未安装 Node.js"
    echo "请安装 Node.js 20 或更高版本: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本：$NODE_VERSION"

if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 正在安装依赖..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo ""
    if [ -f "config.example.env" ]; then
        echo "📝 正在从模板创建 .env..."
        cp config.example.env .env
        echo "⚠️  请编辑 .env 文件并设置 LANHU_COOKIE"
        echo ""
        read -p "配置完成后按 Enter 继续..."
    else
        echo "❌ 错误：未找到 config.example.env"
        exit 1
    fi
fi

set -a
source .env
set +a

if [ -z "$LANHU_COOKIE" ] || [ "$LANHU_COOKIE" = "your_lanhu_cookie_here" ]; then
    echo "❌ 错误：LANHU_COOKIE 未配置"
    echo "请编辑 .env 文件并设置你的蓝湖 Cookie"
    exit 1
fi

echo "✅ 配置加载完成"

echo ""
echo "🔨 正在构建..."
npm run build

echo ""
echo "🚀 正在启动蓝湖 MCP 服务器 (TypeScript)..."
echo "=================================="
echo ""
echo "传输方式：stdio"
echo "在 Cursor 中配置："
echo '{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "'$(pwd)'"
    }
  }
}'
echo ""
echo "按 Ctrl+C 停止"
echo ""

node dist/server.js
