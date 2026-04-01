#!/bin/bash
# 蓝湖 MCP 服务器环境配置脚本

set -e
cd "$(dirname "$0")/.."

echo "🔧 蓝湖 MCP 服务器 - 环境配置"
echo "=================================="

if [ -f ".env" ]; then
    echo "⚠️  .env 文件已存在"
    read -p "是否覆盖？(y/N) " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消"
        exit 0
    fi
fi

cp config.example.env .env
echo "✅ .env 文件已创建"
echo ""
echo "请设置蓝湖 Cookie："
echo "  1. 登录 https://lanhuapp.com"
echo "  2. 打开 F12 开发者工具 → Network 标签"
echo "  3. 刷新页面，点击任意请求"
echo "  4. 从 Request Headers 复制 Cookie 值"
echo ""
read -p "请粘贴 Cookie: " cookie

if [ -n "$cookie" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|your_lanhu_cookie_here|$cookie|" .env
    else
        sed -i "s|your_lanhu_cookie_here|$cookie|" .env
    fi
    echo "✅ Cookie 已保存到 .env"
else
    echo "⚠️  Cookie 为空，请手动编辑 .env 文件"
fi
