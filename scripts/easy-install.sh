#!/bin/bash
# 蓝湖 MCP 服务器一键安装脚本 (TypeScript)

set -e
cd "$(dirname "$0")/.."

echo "🎨 蓝湖 MCP 服务器 - 一键安装"
echo "=================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ 错误：未安装 Node.js"
    echo "请安装 Node.js 20+: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js: $(node -v)"

echo ""
echo "📦 安装依赖..."
npm install

echo ""
echo "🔨 构建项目..."
npm run build

echo ""
echo "🧪 运行测试..."
npm test

if [ ! -f ".env" ]; then
    cp config.example.env .env
    echo ""
    echo "📝 已创建 .env 配置文件"
    echo "⚠️  请编辑 .env 并设置 LANHU_COOKIE"
    echo ""
    echo "获取 Cookie："
    echo "  1. 登录 https://lanhuapp.com"
    echo "  2. 打开浏览器 F12 开发者工具"
    echo "  3. 从请求头复制 Cookie"
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "启动方式："
echo "  npm run dev       # 开发模式"
echo "  npm start         # 生产模式（需先 npm run build）"
echo ""
echo "Cursor 配置："
echo '{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "'$(pwd)'",
      "env": { "LANHU_COOKIE": "your_cookie" }
    }
  }
}'
