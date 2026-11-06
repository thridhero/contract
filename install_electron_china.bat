@echo off
echo 正在配置 Electron 国内镜像源...

:: 设置 Electron 镜像源
npm config set electron_mirror=https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir="{{ version }}"

echo 镜像源配置完成！

echo 检查 Node.js 版本...
node --version

echo 检查 NPM 版本...
npm --version

echo.
echo 使用 npm install 安装依赖...
npm install

if %errorlevel% neq 0 (
    echo 安装过程中出现错误，请检查网络连接或尝试以下步骤：
    echo 1. 确保网络连接正常
    echo 2. 清除 npm 缓存：npm cache clean --force
    echo 3. 删除 node_modules 文件夹和 package-lock.json 文件，然后重新运行此脚本
    echo 4. 检查是否有代理或防火墙阻止访问
    pause
    exit /b %errorlevel%
)

echo 依赖安装完成！
echo.
echo 正在构建项目...
npm run build

if %errorlevel% neq 0 (
    echo 构建过程中出现错误
    pause
    exit /b %errorlevel%
)

echo 项目构建完成！
echo.
echo 您可以通过以下命令启动应用：
echo npm start
echo.
echo 按任意键退出...
pause >nul