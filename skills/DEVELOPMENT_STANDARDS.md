# 软件注册管理系统 - 开发规范

> 本规范基于本项目（Electron + Vue 3 + TypeScript + Tailwind CSS）总结的开发最佳实践

## 目录

1. [技术栈规范](#1-技术栈规范)
2. [项目结构规范](#2-项目结构规范)
3. [代码规范](#3-代码规范)
4. [组件开发规范](#4-组件开发规范)
5. [TypeScript 规范](#5-typescript-规范)
6. [样式规范](#6-样式规范)
7. [Electron 开发规范](#7-electron-开发规范)
8. [状态管理规范](#8-状态管理规范)
9. [IPC 通信规范](#9-ipc-通信规范)
10. [Git 提交规范](#10-git-提交规范)

---

## 1. 技术栈规范

### 1.1 核心技术版本

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | ^25.9.8 | 跨平台桌面应用框架 |
| Vue | ^3.4.0 | 前端框架 |
| TypeScript | ^4.8.0 | 类型安全 |
| Pinia | ^3.0.4 | 状态管理 |
| Vue Router | ^4.2.0 | 路由管理 |
| Tailwind CSS | ^3.4.15 | 样式框架 |
| sql.js | ^1.14.0 | 内存数据库 |
| Webpack | ^5.73.0 | 模块打包 |

### 1.2 开发环境

- Node.js: 18.x+
- npm: 9.x+
- 操作系统: Windows 11 / macOS / Linux

---

## 2. 项目结构规范

### 2.1 目录结构

```
electron-dual-panel-app/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── main.ts             # 应用入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── createWindow.ts     # 窗口管理
│   │   ├── database.ts         # 数据库操作
│   │   ├── bootstrap.ts        # 初始化配置
│   │   └── types/              # 类型定义
│   │
│   ├── renderer/               # Vue 渲染进程
│   │   ├── App.vue            # 根组件
│   │   ├── index.ts           # 应用入口
│   │   ├── index.html         # HTML 模板
│   │   ├── styles.css         # 全局样式
│   │   ├── router/            # 路由配置
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── views/             # 页面视图
│   │   ├── components/        # 公共组件
│   │   ├── composables/       # 组合式 API
│   │   ├── themes/            # 主题配置
│   │   └── types/             # 类型定义
│   │
│   ├── shared/                 # 共享代码
│   └── types/                  # 全局类型定义
│
├── skills/                     # 开发规范文档
├── package.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── webpack.renderer.config.js
├── tailwind.config.js
└── postcss.config.js
```

### 2.2 命名规范

| 类型 | 命名方式 | 示例 |
|------|----------|------|
| 文件夹 | kebab-case | `src/renderer/components/` |
| Vue 组件 | PascalCase | `BrowserPanel.vue` |
| TypeScript 文件 | kebab-case | `create-window.ts` |
| 组件目录 | kebab-case | `src/renderer/views/project/` |
| 图片资源 | kebab-case | `add-icon.svg` |

---

## 3. 代码规范

### 3.1 通用规范

- **使用 ES6+ 语法**: 优先使用箭头函数、模板字符串、解构赋值
- **使用 const/let**: 避免使用 var
- **使用 async/await**: 处理异步操作
- **使用可选链**: `obj?.prop?.nested`
- **使用空值合并**: `value ?? default`

### 3.2 箭头函数规范

```typescript
// ✅ 推荐：使用箭头函数
const getLinkStyle = (routeName: string) => {
  const isActive = route.name === routeName
  return isActive ? { ...activeStyle } : { ...normalStyle }
}

const checkInitAndRedirect = async () => {
  const status = await window.electronAPI.getInitStatus()
  // ...
}

// ✅ 推荐：简写形式
const multiply = (a: number, b: number) => a * b
```

### 3.3 导入规范

```typescript
// ✅ 推荐：按顺序导入
// 1. Vue/React 核心库
import { ref, computed, onMounted } from 'vue'

// 2. 第三方库
import { useRouter } from 'vue-router'
import { defineStore } from 'pinia'

// 3. 项目内部模块
import { usePanelStore } from '@/stores/panel'

// 4. 组件
import BrowserPanel from '@/components/Browser.vue'

// 5. 类型
import type { Theme, Setting } from '@/types'

// ❌ 避免：混在一起导入
import { ref } from 'vue'
import SomeClass from './someClass'
import type { Props } from './types'
```

---

## 4. 组件开发规范

### 4.1 Vue 组件规范

```vue
<template>
  <!-- 组件模板内容 -->
  <div class="component-wrapper">
    <h2 class="text-lg font-semibold">{{ title }}</h2>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ComponentName',
  props: {
    title: {
      type: String,
      required: true,
      default: 'Default Title'
    }
  },
  emits: ['update', 'delete'],
  setup(props, { emit }) {
    // 组合式 API 逻辑
    
    return {
      // 暴露给模板使用的变量和方法
    }
  }
})
</script>

<style scoped>
/* 组件样式 */
</style>
```

### 4.2 组件文件组织

```
components/
├── Browser.vue           # 浏览器面板组件
├── Chat.vue              # 聊天面板组件
├── Separator.vue         # 分隔线组件
└── icons/                # 图标组件目录
    ├── BaseIcon.vue
    ├── AddIcon.vue
    └── CloseIcon.vue
```

### 4.3 Props 定义规范

```typescript
// ✅ 推荐：完整的 props 定义
props: {
  // 基础类型
  title: {
    type: String,
    required: false,
    default: '默认标题'
  },
  // 带验证
  count: {
    type: Number,
    required: true,
    validator: (value: number) => value >= 0
  },
  // 对象类型
  options: {
    type: Object as () => AppOptions,
    required: false,
    default: () => ({ theme: 'light' })
  }
}

// ❌ 避免：简单声明
props: ['title', 'count', 'options']
```

---

## 5. TypeScript 规范

### 5.1 类型定义

```typescript
// ✅ 推荐：使用接口定义对象类型
interface Setting {
  id: number
  key: string
  value: string
  description: string
  created_at: string
  updated_at: string
}

// ✅ 推荐：使用类型别名
type ThemeMode = 'auto' | 'light' | 'dark'

// ✅ 推荐：使用泛型
interface StoreResult<T> {
  success: boolean
  data: T | null
  error?: string
}
```

### 5.2 tsconfig 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noImplicitAny": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### 5.3 类型使用规范

```typescript
// ✅ 推荐：明确类型注解
const count: number = 0
const name: string = 'Alice'
const items: string[] = []
const settings: Map<string, Setting> = new Map()

// ✅ 推荐：函数参数和返回值类型
function add(a: number, b: number): number {
  return a + b
}

// ✅ 推荐：接口作为函数参数
function updateSetting(setting: Setting): void {
  // ...
}

// ❌ 避免：使用 any 类型
const data: any = getData()
```

---

## 6. 样式规范

### 6.1 Tailwind CSS 使用规范

```vue
<template>
  <!-- 常用 Tailwind 类 -->
  <div class="flex items-center justify-between p-4 m-2">
    <h1 class="text-lg font-semibold text-gray-800">标题</h1>
    <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      按钮
    </button>
  </div>
</template>
```

### 6.2 常用类名速查

| 分类 | 类名 | 说明 |
|------|------|------|
| Flex | `flex`, `flex-col`, `items-center`, `justify-between` | 弹性布局 |
| Spacing | `p-4`, `m-2`, `space-y-4` | 间距 |
| Sizing | `w-full`, `h-screen`, `max-w-md` | 尺寸 |
| Typography | `text-lg`, `font-semibold`, `text-gray-800` | 字体 |
| Border | `border`, `rounded`, `rounded-lg` | 边框 |
| Color | `bg-white`, `text-blue-500` | 颜色 |
| Responsive | `md:flex`, `lg:px-8` | 响应式 |

### 6.3 自定义样式

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3490dc',
        secondary: '#ffed4a'
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      }
    }
  }
}
```

---

## 7. Electron 开发规范

### 7.1 主进程规范

```typescript
// src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { createWindow } from './createWindow'
import { initDatabase } from './database'

// ✅ 推荐：使用 app.whenReady()
app.whenReady().then(async () => {
  // 初始化数据库
  await initDatabase()
  
  // 创建主窗口
  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// ✅ 推荐：处理所有平台的退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

### 7.2 预加载脚本规范

```typescript
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

// ✅ 推荐：使用 contextBridge 暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('toggle-maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // 数据库操作
  getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', key),
  setSetting: (key: string, value: string) => 
    ipcRenderer.invoke('db:set-setting', key, value),
    
  // 事件监听
  onMaximizeStatusChange: (callback: (status: boolean) => void) => {
    ipcRenderer.on('maximize-status-change', (_, status) => callback(status))
  }
})

// ❌ 避免：直接暴露 ipcRenderer
// contextBridge.exposeInMainWorld('api', ipcRenderer) // 不安全！
```

### 7.3 安全规范

- ✅ 使用 `contextIsolation: true`
- ✅ 使用 `nodeIntegration: false`
- ✅ 通过 preload 脚本暴露有限的 API
- ✅ 验证和过滤用户输入

---

## 8. 状态管理规范

### 8.1 Pinia Store 规范

```typescript
// src/renderer/stores/panel.ts
import { defineStore } from 'pinia'

export const usePanelStore = defineStore('panel', {
  // ✅ 推荐：使用箭头函数的 getter
  state: () => ({
    leftPanelWidth: 50,
    rightPanelWidth: 50,
    minPanelWidth: 20,
    maxPanelWidth: 80
  }),

  getters: {
    getLeftPanelWidth: (state) => state.leftPanelWidth,
    getPanelRatio: (state) => `${state.leftPanelWidth}/${100 - state.leftPanelWidth}`
  },

  actions: {
    setLeftPanelWidth(width: number) {
      const clampedWidth = Math.min(
        Math.max(width, this.minPanelWidth), 
        this.maxPanelWidth
      )
      this.leftPanelWidth = clampedWidth
      this.rightPanelWidth = 100 - clampedWidth
    },
    
    resetPanels() {
      this.leftPanelWidth = 50
      this.rightPanelWidth = 50
    }
  }
})
```

### 8.2 使用 Store

```typescript
import { usePanelStore } from '@/stores/panel'

// 在 setup 中使用
const panelStore = usePanelStore()
const width = panelStore.getLeftPanelWidth

// 修改状态
panelStore.setLeftPanelWidth(60)
```

---

## 9. IPC 通信规范

### 9.1 IPC 通道命名规范

```typescript
// ✅ 推荐：使用冒号分隔的命名空间
// 数据库操作
'db:insert-setting'
'db:update-setting'
'db:delete-setting'
'db:get-setting'
'db:get-all-settings'
'db:search-settings'

// 窗口操作
'minimize-window'
'toggle-maximize-window'
'close-window'
'is-window-maximized'

// 业务操作
'get-init-status'
'initialize-project'
'select-folder'
```

### 9.2 主进程处理 IPC

```typescript
// src/main/main.ts
import { ipcMain } from 'electron'

// 注册 IPC 处理器
ipcMain.handle('db:get-setting', async (event, key: string) => {
  try {
    const result = await database.getSetting(key)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})
```

### 9.3 渲染进程调用 IPC

```typescript
// 在 Vue 组件中
const getSetting = async () => {
  const result = await window.electronAPI.getSetting('theme')
  if (result.success) {
    console.log(result.data)
  }
}

// 监听事件
window.electronAPI.onMaximizeStatusChange((status: boolean) => {
  console.log('窗口最大化状态:', status)
})
```

---

## 10. Git 提交规范

### 10.1 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 10.2 Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/工具 |

### 10.3 提交示例

```bash
# 功能
git commit -m "feat(components): 添加浏览器面板组件"

# 修复
git commit -m "fix(database): 修复数据库初始化问题"

# 文档
git commit -m "docs: 更新开发规范文档"
```

---

## 附录：常用命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建项目
npm run build

# 运行应用
npm start

# 监听文件变化
npm run watch

# 构建发布版本
npm run electron-builder
```

---

## 总结

本开发规范涵盖了：

✅ **技术栈规范** - 明确的版本选择和环境要求  
✅ **项目结构规范** - 清晰的目录组织和命名规范  
✅ **代码规范** - ES6+ 语法和最佳实践  
✅ **组件规范** - Vue 组件开发标准  
✅ **TypeScript 规范** - 类型安全和类型定义  
✅ **样式规范** - Tailwind CSS 使用指南  
✅ **Electron 规范** - 主进程和预加载脚本规范  
✅ **状态管理** - Pinia 使用规范  
✅ **IPC 通信** - 进程间通信规范  
✅ **Git 规范** - 提交信息规范

遵循这些规范可以确保代码的一致性、可维护性和可读性。
