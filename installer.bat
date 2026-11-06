@echo off
title Electron 双面板应用安装向导

echo ===============================================
echo     Electron 双面板应用安装向导
echo ===============================================
echo.

:menu
echo 请选择安装方式：
echo.
echo 1. 自动配置镜像源并安装（推荐）
echo 2. 使用 CNPM 安装
echo 3. 仅配置镜像源（如果您想手动安装）
echo 4. 验证安装结果
echo 5. 退出
echo.

set /p choice=请输入选项 (1-5): 

if "%choice%"=="1" goto option1
if "%choice%"=="2" goto option2
if "%choice%"=="3" goto option3
if "%choice%"=="4" goto option4
if "%choice%"=="5" goto exit
echo 无效选项，请重新选择。
echo.
goto menu

:option1
echo.
echo 正在配置 Electron 国内镜像源...
npm config set electron_mirror=https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir="{{ version }}"
echo 镜像源配置完成！
echo.

echo 检查 Node.js 版本...
node --version
echo.

echo 检查 NPM 版本...
npm --version
echo.

echo 正在安装依赖（可能需要较长时间，请耐心等待）...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo 安装过程中出现错误，请检查：
    echo 1. 网络连接是否正常
    echo 2. Node.js 版本是否 >= 14
    echo 3. 是否有足够的磁盘空间
    echo 4. 防火墙或杀毒软件是否阻止了下载
    echo.
    pause
    goto menu
)

echo.
echo 依赖安装完成！正在构建项目...
call npm run build

if %errorlevel% neq 0 (
    echo 构建过程中出现错误
    pause
    goto menu
)

echo.
echo 项目构建完成！
echo.
echo 您可以使用以下命令启动应用：
echo npm start
echo.
echo 或者运行 start.bat 脚本
echo.
pause
goto menu

:option2
echo.
echo 正在安装 CNPM...
npm install -g cnpm --registry=https://registry.npmmirror.com

if %errorlevel% neq 0 (
    echo CNPM 安装失败
    pause
    goto menu
)

echo.
echo CNPM 安装完成！正在使用 CNPM 安装依赖...
call cnpm install

if %errorlevel% neq 0 (
    echo.
    echo CNPM 安装依赖失败
    pause
    goto menu
)

echo.
echo 依赖安装完成！正在构建项目...
call npm run build

if %errorlevel% neq 0 (
    echo 构建过程中出现错误
    pause
    goto menu
)

echo.
echo 项目构建完成！
echo.
echo 您可以使用以下命令启动应用：
echo npm start
echo.
pause
goto menu

:option3
echo.
echo 正在配置 Electron 国内镜像源...
npm config set electron_mirror=https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir="{{ version }}"
echo.
echo 镜像源已配置完成！
echo 现在您可以手动运行 'npm install' 来安装依赖
echo.
pause
goto menu

:option4
echo.
echo 正在验证 Electron 安装...
npx electron --version
echo.
if %errorlevel% equ 0 (
    echo Electron 安装成功！
) else (
    echo Electron 未正确安装
)
echo.
pause
goto menu

:exit
echo.
echo 感谢使用 Electron 双面板应用安装向导！
exit /b 0