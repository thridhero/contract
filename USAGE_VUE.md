# Vue 前端架构使用说明

## 开始使用

将项目从前端 React 架构迁移到 Vue 3 + TypeScript + Tailwind CSS 3。

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建渲染进程
npm run build:renderer

# 构建完整应用
npm run build
```

## 主要变更

- 前端框架: 从 React 迁移到 Vue 3
- 组件系统: 使用 Vue 单文件组件 (.vue)
- 样式系统: 从 styled-components 迁移到 Tailwind CSS 3
- 类型检查: 保持 TypeScript 支持

## 文件位置

- Vue 组件位于 `src/renderer/components/`
- 主应用入口为 `src/renderer/App.vue`
- 样式文件为 `src/renderer/styles.css`
- Webpack 配置为 `webpack.renderer.config.js`

## 架构概览

- Vue 3 (Options API)
- TypeScript 类型安全
- Tailwind CSS 3 实用优先的样式
- Webpack 模块打包
- Electron 桌面应用容器