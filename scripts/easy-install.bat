@echo off
setlocal
chcp 65001 >nul 2>&1
REM 蓝湖 MCP 服务器一键安装 (TypeScript / Windows)

cd /d "%~dp0\.."

echo ======================================
echo 蓝湖 MCP 服务器 - 一键安装
echo ======================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未安装 Node.js
    echo 请从 https://nodejs.org/ 安装 Node.js 20+
    pause
    exit /b 1
)

echo [OK] Node.js 已安装
node --version

echo.
echo 安装依赖...
call npm install

echo.
echo 构建项目...
call npm run build

echo.
echo 运行测试...
call npm test

if not exist ".env" (
    copy config.example.env .env
    echo.
    echo [OK] 已创建 .env 配置文件
    echo [WARN] 请编辑 .env 并设置 LANHU_COOKIE
)

echo.
echo [OK] 安装完成！
echo.
echo 启动方式：
echo   npm run dev       开发模式
echo   npm start         生产模式
echo.

pause
