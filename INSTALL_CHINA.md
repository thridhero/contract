# Electron 双面板应用 - 安装指南（中国用户）

## 快速安装

### 方法一：使用批处理脚本（推荐）
直接运行项目根目录下的 `install_electron_china.bat` 文件

### 方法二：手动配置镜像源
打开命令行，依次执行以下命令：

```bash
# 配置 Electron 国内镜像源
npm config set electron_mirror=https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir="{{ version }}"

# 安装依赖
npm install

# 构建项目
npm run build

# 启动应用
npm start
```

### 方法三：使用 npm 脚本
```bash
# 配置镜像源
npm run setup-electron-cn

# 安装依赖
npm install

# 构建并启动
npm run build
npm start
```

## 故障排除

### 1. 如果仍然无法下载
尝试清除 npm 缓存：
```bash
npm cache clean --force
```

### 2. 如果遇到权限问题
以管理员身份运行命令提示符

### 3. 使用 cnpm（淘宝镜像）
```bash
# 安装 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com

# 使用 cnpm 安装依赖
cnpm install
```

### 4. 手动下载 Electron
1. 访问 https://npmmirror.com/mirrors/electron/
2. 手动下载对应版本的 Electron
3. 重新执行安装命令

## 验证安装
安装完成后，可以运行以下命令验证：
```bash
npx electron --version
```

## 运行应用
配置完成后，使用以下命令启动应用：
```bash
npm start
```

应用启动后，您将看到左侧的网页浏览器和右侧的聊天界面。