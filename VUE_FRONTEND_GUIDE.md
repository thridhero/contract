# Vue + TypeScript + Tailwind CSS 3 前端架构指南

## 项目概述

本项目是一个基于 Electron 的双面板应用程序，左侧为 Web 浏览器面板，右侧为聊天面板。前端架构已从 React 迁移到 Vue 3 + TypeScript + Tailwind CSS 3。

## 技术栈

- **框架**: Vue 3 (Composition API 和 Options API)
- **语言**: TypeScript
- **样式**: Tailwind CSS 3
- **打包工具**: Webpack
- **运行时**: Electron

## 项目结构

```
src/
├── renderer/                 # 渲染进程源码
│   ├── components/           # Vue 组件
│   │   ├── Browser.vue       # 浏览器面板组件
│   │   ├── Chat.vue          # 聊天面板组件
│   │   └── Separator.vue     # 分隔符组件
│   ├── types/                # TypeScript 类型定义
│   │   └── vue-shim.d.ts     # Vue 文件类型声明
│   ├── App.vue               # 主应用组件
│   ├── index.html            # 主页面 HTML
│   ├── index.ts              # 应用入口文件
│   └── styles.css            # Tailwind 样式
├── main/                     # 主进程源码
├── shared/                   # 共享代码
└── types/                    # 全局类型定义
```

## 开发环境设置

### 依赖安装

```bash
npm install
```

### 开发模式启动

```bash
npm run dev
```

### 构建项目

```bash
npm run build
```

## 核心功能模块

### 1. BrowserPanel 组件

- 显示网页内容的 iframe
- 使用 Tailwind CSS 实现响应式布局
- 可自定义 URL 地址

### 2. ChatPanel 组件

- 实时聊天界面
- 支持消息发送和接收
- 消息历史记录展示
- 使用 TypeScript 定义消息接口

### 3. Separator 组件

- 分隔两个面板的可拖拽分隔线
- 支持悬停效果
- 使用 Tailwind CSS 实现交互状态

## 样式系统

### Tailwind CSS 配置

- **配置文件**: `tailwind.config.js`
- **前处理器**: PostCSS
- **插件**: autoprefixer

### CSS 自定义

- 所有样式都通过 `src/renderer/styles.css` 引入
- 包含 Tailwind 的 base、components 和 utilities

## TypeScript 配置

### 编译选项 (`tsconfig.renderer.json`)

- 启用严格类型检查
- 支持 ES 模块
- Vue 文件类型支持
- Source map 生成

### 类型定义

- Vue 文件类型声明 (`vue-shim.d.ts`)
- 组件属性和方法类型定义
- 消息接口定义

## Webpack 配置

### 加载器配置

- **ts-loader**: 处理 TypeScript 文件
- **vue-loader**: 处理 Vue 单文件组件
- **css-loader & postcss-loader**: 处理 CSS 和 Tailwind
- **babel-loader**: 处理 JavaScript 转换

### 构建流程

1. 编译主进程代码 (TypeScript)
2. 编译渲染进程代码 (Vue + TypeScript + CSS)
3. 生成 Electron 应用程序包

## 组件开发指南

### 创建新组件

```vue
<template>
  <!-- 使用 Tailwind CSS 类 -->
  <div class="bg-white p-4 rounded shadow">
    <h2 class="text-lg font-semibold">组件标题</h2>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'NewComponent',
  props: {
    // 定义属性
  },
  data() {
    return {
      // 响应式数据
    }
  },
  methods: {
    // 方法定义
  }
})
</script>
```

### TypeScript 最佳实践

- 在 data 中定义所有响应式数据
- 为 props 提供明确的类型定义
- 使用 Composition API 或 Options API 保持一致性
- 在方法中使用类型注解（如需要）

## Tailwind CSS 使用

### 常用类名

- **Flexbox**: `flex`, `flex-row`, `flex-col`, `items-center`, `justify-between`
- **Spacing**: `p-4`, `m-2`, `space-y-4`
- **Sizing**: `w-full`, `h-screen`, `max-w-md`
- **Typography**: `text-lg`, `font-semibold`, `text-gray-800`
- **Layout**: `grid`, `grid-cols-2`, `overflow-hidden`

### 自定义主题

可在 `tailwind.config.js` 中扩展默认主题：

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3490dc',
        secondary: '#ffed4a'
      }
    }
  }
}
```

## 调试与故障排除

### 常见问题

1. **Vue 组件无法识别**
   - 确保组件已正确导入和注册
   - 检查文件扩展名是否为 `.vue`

2. **Tailwind 类不生效**
   - 检查 `styles.css` 是否已正确引入
   - 确认内容路径已在 `tailwind.config.js` 中配置

3. **TypeScript 错误**
   - 验证类型定义是否正确
   - 检查 `vue-shim.d.ts` 是否存在

### 开发工具

- **Vue DevTools**: 用于调试 Vue 组件
- **Electron DevTools**: 用于调试主进程和渲染进程
- **VS Code 扩展**: Vetur 或 Volar, TypeScript, Tailwind CSS IntelliSense

## 部署

### 生产构建

```bash
npm run build
```

### 应用打包

```bash
npm run electron-builder
```

## 贡献指南

1. Fork 仓库
2. 创建特性分支
3. 提交更改
4. 发起 Pull Request

### 代码规范

- 使用 PascalCase 命名 Vue 组件
- 使用 kebab-case 命名 CSS 类
- 遵循 TypeScript 严格模式
- 组件遵循单一职责原则
- 使用 Tailwind CSS 而非自定义 CSS

## 许可证

本项目采用 MIT 许可证 - 查看 LICENSE 文件了解详情。