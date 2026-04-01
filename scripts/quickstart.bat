@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
REM 蓝湖 MCP 服务器快速启动脚本 (TypeScript / Windows)

cd /d "%~dp0\.."

echo ======================================
echo 蓝湖 MCP 服务器 - 快速启动
echo ======================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未安装 Node.js
    echo 请从 https://nodejs.org/ 安装 Node.js 20 或更高版本
    pause
    exit /b 1
)

echo [OK] Node.js 已安装
node --version

if not exist "node_modules" (
    echo.
    echo 正在安装依赖...
    npm install
)

if not exist ".env" (
    if exist "config.example.env" (
        echo 正在从模板创建 .env...
        copy config.example.env .env
        echo [WARN] 请编辑 .env 文件并设置 LANHU_COOKIE
        pause
    ) else (
        echo [ERROR] 未找到 config.example.env
        pause
        exit /b 1
    )
)

for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" if not "!line!"=="" (
        set "value=%%b"
        set "value=!value:"=!"
        set "%%a=!value!"
    )
)

if not defined LANHU_COOKIE (
    echo [ERROR] LANHU_COOKIE 未配置
    pause
    exit /b 1
)

echo [OK] 配置加载完成

echo.
echo 正在构建...
call npm run build

echo.
echo 正在启动蓝湖 MCP 服务器 (TypeScript)...
echo ======================================
echo.
echo 传输方式：stdio
echo 按 Ctrl+C 停止
echo.

node dist\server.js

pause
