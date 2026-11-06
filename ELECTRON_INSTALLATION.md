# Electron 国内镜像源配置方法

## 方法一：使用环境变量（推荐）

### 临时设置
```bash
# 设置 Electron 镜像源
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_CUSTOM_DIR="v{{version}}"
npm install electron --save-dev
```

### 永久设置
```bash
# 设置 Electron 镜像源
npm config set electron_mirror=https://npmmirror.com/mirrors/electron/
npm config set electron_custom_dir="{{ version }}"
npm config set electron_build={{ version }}-{{ flavor }}

# 如果是 Linux 或 macOS，使用以下命令
# export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
# npm install electron --save-dev
```

## 方法二：使用 .npmrc 文件

在项目根目录创建 `.npmrc` 文件，添加以下内容：
```
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_custom_dir={{ version }}
```

## 方法三：使用 cnpm

```bash
# 安装 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com

# 使用 cnpm 安装 electron
cnpm install electron --save-dev
```

## 方法四：使用 yarn 并配置镜像

```bash
# 如果使用 yarn，可以配置镜像
yarn config set electron-mirror https://npmmirror.com/mirrors/electron/

# 然后安装
yarn add electron --dev
```

## 方法五：手动下载

1. 访问镜像站点：https://npmmirror.com/mirrors/electron/
2. 手动下载所需版本的 Electron
3. 将其放置到本地缓存目录

## 其他常用镜像源

- 华为云镜像：https://mirrors.huaweicloud.com/electron/
- 腾讯云镜像：https://mirrors.cloud.tencent.com/electron/
- 阿里云镜像：https://registry.npmmirror.com/-/binary/electron/

## 验证安装

安装完成后，可以通过以下命令验证：
```bash
npx electron --version
```

## 注意事项

1. 确保镜像源 URL 最后有斜杠 /
2. 如果遇到权限问题，可以尝试使用管理员权限运行命令
3. 如果多次尝试失败，可以清除 npm 缓存：
   ```bash
   npm cache clean --force
   ```