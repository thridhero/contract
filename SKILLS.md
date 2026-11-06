# Skills - 技术栈与架构文档

## 项目概述

**项目名称**: 软件注册管理系统 (Software Registration Manager)  
**技术栈**: Electron + Vue 3 + TypeScript + Tailwind CSS  
**应用类型**: 跨平台桌面应用程序

---

## 核心技能 (Core Skills)

### 1. Electron 桌面开发
- **Electron 25.9.8** - 跨平台桌面应用框架
- **主进程 (Main Process)**: `src/main/`
  - 窗口管理 (`createWindow.ts`)
  - IPC 通信 (`ipcMain`)
  - 数据库操作 (`database.ts`)
  - 初始化引导 (`bootstrap.ts`)
- **预加载脚本 (Preload)**: `src/main/preload.ts`
  - contextBridge API 桥接
  - 安全的主/渲染进程通信

### 2. Vue 3 前端框架
- **Vue 3.4.0** - 渐进式前端框架
- **组合式 API (Composition API)**: 使用 `<script setup>` 语法
- **组件化开发**: 组件目录 `src/renderer/components/`

### 3. TypeScript 类型系统
- **TypeScript 4.8.0** - 类型安全的 JavaScript 超集
- **类型定义**: `src/renderer/types/`
- **接口定义**: 如 `Theme`, `Setting` 等

### 4. 状态管理
- **Pinia 3.0.4** - 轻量级状态管理
- **Store 示例**: `src/renderer/stores/panel.ts` (双面板宽度管理)

### 5. 客户端路由
- **Vue Router 4.2.0** - 路由管理
- **Hash 模式**: `createWebHashHistory()`
- **路由配置**: `src/renderer/router/index.ts`

### 6. 数据库
- **sql.js 1.14.0** - 内存中的 SQLite 实现
- **CRUD 操作**: 增删改查配置项
- **数据持久化**: 保存到文件系统

### 7. UI 样式
- **Tailwind CSS 3.4.15** - 原子化 CSS 框架
- **PostCSS** - CSS 后处理器
- **暗黑模式**: 支持 auto/light/dark 三种模式

### 8. 构建工具
- **Webpack 5.73.0** - 模块打包
- **Babel** - JavaScript 转译
- **Electron Builder** - 打包为可执行文件

---

## 项目结构 (Project Structure)

```
electron-dual-panel-app/
├── src/
│   ├── main/                          # 主进程 (Electron)
│   │   ├── main.ts                   # 应用入口
│   │   ├── preload.ts                # 预加载脚本
│   │   ├── createWindow.ts           # 窗口管理
│   │   ├── database.ts               # 数据库操作
│   │   ├── bootstrap.ts              # 初始化配置
│   │   └── types/                    # 类型定义
│   │
│   └── renderer/                     # 渲染进程 (Vue)
│       ├── App.vue                   # 根组件
│       ├── index.ts                  # 入口文件
│       ├── index.html                # HTML 模板
│       ├── styles.css                # 全局样式
│       │
│       ├── router/                   # 路由
│       │   └── index.ts
│       │
│       ├── stores/                   # Pinia 状态
│       │   ├── panel.ts              # 面板管理
│       │   └── windowState.ts        # 窗口状态
│       │
│       ├── views/                    # 页面视图
│       │   ├── HomeView.vue
│       │   ├── SettingsView.vue
│       │   ├── FirstRunView.vue
│       │   ├── ResourceView.vue
│       │   ├── PropertiesPanel.vue
│       │   └── projects/
│       │
│       ├── components/               # 公共组件
│       │   ├── TitleBar.vue          # 标题栏
│       │   ├── ToolbarRight.vue      # 工具栏
│       │   ├── Browser.vue           # 浏览器组件
│       │   ├── Chat.vue              # 聊天组件
│       │   ├── Separator.vue         # 分隔线
│       │   └── icons/                # SVG 图标
│       │
│       ├── composables/              # 组合式 API
│       │   └── useTheme.ts           # 主题管理
│       │
│       ├── themes/                   # 主题配置
│       │   └── default.ts
│       │
│       └── types/                    # 类型定义
│           └── vue-shim.d.ts
│
├── package.json                      # 项目配置
├── tsconfig.main.json                # 主进程 TypeScript 配置
├── tsconfig.renderer.json            # 渲染进程 TypeScript 配置
├── webpack.renderer.config.js        # Webpack 配置
├── tailwind.config.js                # Tailwind 配置
├── postcss.config.js                 # PostCSS 配置
└── babel.config.js                   # Babel 配置
```

---

## 关键特性 (Key Features)

### 1. 箭头函数编程
```typescript
// 示例：箭头函数在项目中的使用
const getLinkStyle = (routeName: string) => {
  const isActive = route.name === routeName
  return isActive ? { ...activeStyle } : { ...normalStyle }
}

const checkInitAndRedirect = async () => {
  const status = await window.electronAPI.getInitStatus()
  // ...
}
```

### 2. 暗黑模式支持
```typescript
// composables/useTheme.ts
const detectSystemTheme = () => 
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (themeMode.value === 'auto') {
    isDarkMode.value = e.matches
  }
})
```

**支持模式：**
- `auto` - 跟随系统偏好
- `light` - 手动切换浅色
- `dark` - 手动切换深色

### 3. IPC 通信架构
```
Renderer (Vue) ←→ contextBridge ←→ preload.ts ←→ ipcRenderer ←→ ipcMain ←→ Main Process
```

---

## 依赖版本 (Dependencies Version)

| 包名 | 版本 |
|------|------|
| electron | ^25.9.8 |
| vue | ^3.4.0 |
| typescript | ^4.8.0 |
| pinia | ^3.0.4 |
| vue-router | ^4.2.0 |
| sql.js | ^1.14.0 |
| tailwindcss | ^3.4.15 |
| webpack | ^5.73.0 |

---

## 运行命令 (Scripts)

```bash
npm run dev     # 开发模式运行
npm run build   # 构建项目
npm run start   # 运行已构建的应用
npm run watch   # 监听文件变化自动构建
```

---

## 通信模式 (IPC Channels)

| 通道 | 方向 | 功能 |
|------|------|------|
| `db:insert-setting` | Renderer → Main | 插入配置 |
| `db:update-setting` | Renderer → Main | 更新配置 |
| `db:delete-setting` | Renderer → Main | 删除配置 |
| `db:get-setting` | Renderer → Main | 查询单个配置 |
| `db:get-all-settings` | Renderer → Main | 查询所有配置 |
| `db:search-settings` | Renderer → Main | 搜索配置 |
| `minimize-window` | Renderer → Main | 最小化窗口 |
| `toggle-maximize-window` | Renderer → Main | 切换最大化 |
| `close-window` | Renderer → Main | 关闭窗口 |
| `get-init-status` | Renderer → Main | 获取初始化状态 |
| `initialize-project` | Renderer → Main | 初始化项目 |

---

## 总结

本项目采用现代前端技术栈，具有以下特点：

✅ **Electron + Vue 3** 跨平台桌面应用  
✅ **TypeScript** 类型安全  
✅ **Tailwind CSS** 原子化样式  
✅ **箭头函数** 现代化编程  
✅ **暗黑模式** 系统偏好 + 手动切换  
✅ **Pinia** 状态管理  
✅ **sql.js** 本地数据库  
✅ **安全 IPC** 通信架构

项目架构清晰，职责分离良好，适合学习和参考。
