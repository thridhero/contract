@echo off
chcp 65001 >nul
echo === 软件注册管理系统 ===

:: 安装依赖
echo 正在安装依赖...
call npm install
if errorlevel 1 (
    echo 依赖安装失败
    pause
    exit /b 1
)

:: 构建项目
echo 正在构建项目...
call npm run build
if errorlevel 1 (
    echo 构建失败
    pause
    exit /b 1
)

:: 启动应用
echo 启动应用...
npm start