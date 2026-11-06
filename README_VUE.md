# Electron 双面板应用

一个基于 Electron 的桌面应用程序，具有左右双面板布局：左侧为 Web 浏览器面板，右侧为聊天面板。

## 项目特点

- **双面板布局**: 左侧浏览器，右侧聊天
- **现代技术栈**: Vue 3, TypeScript, Tailwind CSS 3
- **跨平台**: 支持 Windows, macOS, Linux
- **实时交互**: 集成聊天功能
- **响应式设计**: 适配不同屏幕尺寸

## 技术架构

- **框架**: Vue 3 (Options API)
- **语言**: TypeScript
- **样式**: Tailwind CSS 3
- **运行时**: Electron
- **打包工具**: Webpack
- **构建工具**: electron-builder

## 快速开始

### 环境要求

- Node.js (>=16.x)
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动开发服务器
npm run dev
```

### 生产构建

```bash
# 构建应用
npm run build

# 构建安装包
npm run electron-builder
```

## 项目结构

```
src/
├── main/                 # Electron 主进程代码
├── renderer/             # Vue 渲染进程代码
│   ├── components/       # Vue 组件
│   ├── types/            # TypeScript 类型定义
│   ├── App.vue           # 主应用组件
│   ├── index.ts          # 应用入口
│   └── styles.css        # 样式文件
├── shared/               # 主进程和渲染进程共享代码
└── types/                # 全局类型定义
```

## 功能模块

### 浏览器面板

- 内嵌网页显示
- 支持自定义 URL
- 响应式布局

### 聊天面板

- 实时消息收发
- 消息历史记录
- 用户区分显示

### 分隔符

- 可拖拽调整面板大小
- 视觉反馈

## 前端架构

此项目使用 Vue 3 + TypeScript + Tailwind CSS 3 的现代前端架构。详细信息请参考 [VUE_FRONTEND_GUIDE.md](./VUE_FRONTEND_GUIDE.md)。

## 配置文件

- `webpack.renderer.config.js` - 渲染进程 Webpack 配置
- `tsconfig.renderer.json` - 渲染进程 TypeScript 配置
- `tailwind.config.js` - Tailwind CSS 配置
- `postcss.config.js` - PostCSS 配置

## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

### 开发规范

- 使用 TypeScript 进行类型安全编程
- 遵循 Vue 3 最佳实践
- 使用 Tailwind CSS 进行样式开发
- 组件保持单一职责

## 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件