# Electron 双面板应用开发计划

## 项目概述

本项目旨在创建一个基于 Electron 的桌面应用程序，具有独特的双面板布局：左侧为网页浏览器，右侧为聊天对话界面。这种设计允许用户在浏览网页的同时进行实时聊天交流。

## 技术架构

### 技术栈选择
- **Electron**: 构建跨平台桌面应用
- **React**: 构建现代化用户界面
- **TypeScript**: 提供类型安全和更好的开发体验
- **Styled Components**: 实现动态样式管理
- **Webpack**: 模块打包和资源管理
- **Babel**: JavaScript 编译转换

### 项目结构
```
electron-dual-panel-app/
├── src/
│   ├── main/                 # 主进程代码
│   │   ├── main.ts          # 主进程入口点
│   │   ├── createWindow.ts  # 窗口创建逻辑
│   │   └── preload.ts       # 预加载脚本，处理主渲染进程通信
│   ├── renderer/             # 渲染进程代码
│   │   ├── index.html       # 应用主页面
│   │   ├── index.tsx        # React 应用入口
│   │   ├── App.tsx          # 主应用组件，整合左右面板
│   │   └── components/      # React 组件
│   │       ├── Browser.tsx  # 左侧浏览器组件
│   │       └── Chat.tsx     # 右侧聊天组件
│   ├── shared/               # 主进程与渲染进程共享代码
│   └── types/                # 类型定义
├── assets/                   # 静态资源
├── package.json              # 项目配置和依赖
├── tsconfig.main.json        # 主进程 TypeScript 配置
├── tsconfig.renderer.json    # 渲染进程 TypeScript 配置
├── webpack.renderer.config.js # Webpack 配置
└── README.md                 # 项目说明文档
```

## 功能实现详情

### 1. 左侧网页浏览器功能

**实现文件**: `src/renderer/components/Browser.tsx`

**功能特性**:
- 地址栏输入和导航
- 前进、后退、刷新按钮
- 内嵌网页显示（使用 iframe）
- 默认加载 GitHub 页面

**技术实现**:
- 使用 iframe 标签嵌入网页内容
- React 状态管理 URL 和导航历史
- Styled Components 实现响应式布局

### 2. 右侧聊天对话界面

**实现文件**: `src/renderer/components/Chat.tsx`

**功能特性**:
- 消息气泡显示（区分自己和他人消息）
- 时间戳显示
- 消息输入框和发送按钮
- 自动滚动到底部
- 模拟自动回复功能

**技术实现**:
- React 状态管理消息列表
- 自定义消息对象结构（id, text, timestamp, isOwn）
- 自动回复模拟（setTimeout）

### 3. 双面板布局整合

**实现文件**: `src/renderer/App.tsx`

**布局特点**:
- 使用 Flexbox 实现左右分栏
- 固定分隔线，可调整面板大小
- 响应式设计适应不同屏幕尺寸
- 保持最小宽度确保可用性

## 通信机制

### 主进程与渲染进程通信
- 使用 Electron 的 `contextBridge` 和 `ipcRenderer` 进行安全通信
- 预加载脚本暴露有限的 API 接口
- 防止渲染进程中直接访问 Node.js API

## 安全考虑

- 使用 `contextIsolation: true` 隔离渲染进程上下文
- 通过预加载脚本控制对主进程的访问
- 验证和过滤用户输入URL
- 不启用不安全的选项如 `nodeIntegration`

## 构建和部署

### 开发命令
- `npm install`: 安装依赖
- `npm run build`: 构建项目
- `npm start`: 运行应用
- `npm run dev`: 开发模式运行

### 打包配置
- 使用 electron-builder 创建安装包
- 支持多平台打包（Windows、macOS、Linux）
- NSIS 安装程序（Windows）

## 扩展建议

### 未来功能增强
1. **浏览器功能增强**:
   - 添加标签页支持
   - 历史记录功能
   - 书签管理
   - 下载管理

2. **聊天功能增强**:
   - 用户认证系统
   - 消息持久化
   - 多人聊天室
   - 文件传输功能
   - 表情符号和多媒体消息

3. **UI/UX 改进**:
   - 主题切换（深色/浅色模式）
   - 自定义分隔线拖拽
   - 消息搜索功能
   - 快捷键支持

### 性能优化
- 虚拟滚动处理大量消息
- Webview 资源隔离
- 内存泄漏防护

## 总结

该项目成功实现了一个功能完整的双面板 Electron 应用，结合了网页浏览和即时通讯功能。采用了现代前端技术栈，遵循最佳实践，具有良好的扩展性和维护性。整体架构清晰，模块化程度高，便于后续功能扩展和维护。