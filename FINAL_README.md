# Electron 双面板应用

这是一个具有独特双面板布局的 Electron 应用，左侧为网页浏览器，右侧为聊天对话界面。

## 功能特性

- **左侧面板**：集成网页浏览器，支持地址输入和页面导航
- **右侧面板**：聊天界面，支持消息发送和接收
- **现代化UI**：使用 React 和 Styled Components 构建
- **响应式布局**：双面板设计，支持调整大小

## 技术栈

- Electron: 跨平台桌面应用框架
- React: 用户界面库
- TypeScript: 类型安全
- Styled Components: 样式管理
- Webpack: 模块打包工具
- Babel: JavaScript 编译器

## 安装与运行

### 国内用户特殊配置

由于国内网络环境，Electron 下载可能受限，我们已配置了国内镜像：

1. 运行安装脚本（推荐）：
   ```bash
   .\install_electron_china.bat
   ```

2. 或手动配置镜像源：
   ```bash
   npm config set electron_mirror https://npmmirror.com/mirrors/electron/
   npm config set electron_custom_dir="{{ version }}"
   ```

### 一般安装步骤

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建项目：
   ```bash
   npm run build
   ```

3. 启动应用：
   ```bash
   npm start
   ```

### 使用安装向导（Windows）

对于 Windows 用户，可以直接运行：
```
installer.bat
```

## 项目结构

```
electron-dual-panel-app/
├── src/
│   ├── main/                 # 主进程代码
│   │   ├── main.ts          # 主进程入口
│   │   ├── createWindow.ts  # 窗口创建逻辑
│   │   └── preload.ts       # 预加载脚本
│   ├── renderer/             # 渲染进程代码
│   │   ├── index.html       # 主页面
│   │   ├── index.tsx        # React 入口
│   │   ├── App.tsx          # 主应用组件
│   │   └── components/      # React 组件
│   │       ├── Browser.tsx  # 浏览器组件
│   │       └── Chat.tsx     # 聊天组件
├── package.json              # 项目配置
├── babel.config.js           # Babel 配置
├── .npmrc                    # npm 配置（包含镜像源）
└── ...
```

## 自定义配置

- 修改 `src/renderer/components/Browser.tsx` 来调整浏览器功能
- 修改 `src/renderer/components/Chat.tsx` 来调整聊天功能
- 更改默认起始页面可在 Browser.tsx 中修改

## 常见问题

1. **应用启动后无法加载某些网站**：这是出于安全考虑，某些网站不允许在 iframe 中加载
2. **构建错误**：请确保安装了 Node.js >= 14
3. **Electron 下载失败**：使用国内镜像源配置

## 扩展功能

应用设计为模块化结构，易于扩展：
- 添加标签页浏览功能
- 集成真实聊天后端
- 增加主题切换
- 添加书签和历史记录功能

## 许可证

MIT