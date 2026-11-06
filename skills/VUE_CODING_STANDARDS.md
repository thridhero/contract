# Vue 文件编写规范

> 本规范基于本项目（Electron + Vue 3 + TypeScript + Tailwind CSS）的 Vue 单文件组件（SFC）最佳实践

## 目录

1. [文件结构规范](#1-文件结构规范)
2. [组件命名规范](#2-组件命名规范)
3. [模板（Template）规范](#3-模板template规范)
4. [脚本（Script）规范](#4-脚本script规范)
5. [样式（Style）规范](#5-样式style规范)
6. [状态管理规范](#6-状态管理规范)
7. [事件处理规范](#7-事件处理规范)
8. [注释规范](#8-注释规范)

---

## 1. 文件结构规范

### 1.1 基本结构

```vue
<template>
  <!-- 组件模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入 Vue 核心库
import { ref, computed, onMounted } from 'vue'

// 2. 导入第三方库/组件
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

// 3. 导入项目内部模块
import { useThemeStore } from '@/stores/themeStore'
import type { Resource } from '@/types'

// 4. 组件逻辑
// ...
</script>

<style scoped>
/* 组件私有样式 */
</style>
```

### 1.2 导入顺序

```typescript
// 1. Vue 核心库
import { ref, computed, watch, onMounted } from 'vue'

// 2. 第三方库和组件
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

// 3. 项目内部模块（stores, composables, components）
import { useThemeStore } from '@/stores/themeStore'
import { useProjectStore } from '@/stores/projectStore'
import ResourceToolbar from '../components/ResourceToolbar.vue'

// 4. 类型定义
import type { Resource, Project } from '@/types'
import type { ProjectCreateDTO } from '../../../shared/types/project.types'
```

---

## 2. 组件命名规范

### 2.1 文件名

| 类型 | 命名方式 | 示例 |
|------|----------|------|
| 视图组件 | PascalCase | `ResourceView.vue` |
| 布局组件 | PascalCase | `MainLayout.vue` |
| 普通组件 | PascalCase | `ResourceToolbar.vue` |
| 图标组件 | PascalCase + Icon 后缀 | `BaseIcon.vue` |
| 对话框组件 | PascalCase + Modal/Dialog | `CreateProjectModal.vue` |

### 2.2 组件名称

```typescript
// 推荐：组件名使用 PascalCase
export default defineComponent({
  name: 'ResourceToolbar'
})
```

---

## 3. 模板（Template）规范

### 3.1 基础结构

```vue
<template>
  <div
    class="component-container flex flex-col h-full transition-colors duration-200"
    :style="{ backgroundColor: 'var(--content-bg)' }"
  >
    <!-- 有明确语义化的注释 -->
    <header class="header-area">
      <h2 class="text-sm font-medium">标题</h2>
    </header>
    
    <main class="content-area flex-1">
      <!-- 内容区域 -->
    </main>
  </div>
</template>
```

### 3.2 属性绑定规范

```vue
<!-- 推荐：简单属性使用 kebab-case -->
<Button
  icon="pi pi-plus"
  severity="secondary"
  text
  size="small"
  @click="handleClick"
/>

<!-- 推荐：动态绑定使用 : 前缀 -->
<div
  class="dynamic-class"
  :class="{ active: isActive }"
  :style="{ backgroundColor: bgColor }"
>
  {{ dynamicContent }}
</div>

<!-- 推荐：多行属性对齐 -->
<ResourceToolbar
  :title="currentTitle"
  :zoom-level="zoomLevel"
  :has-cloud-notification="hasNotification"
  v-model:search-query="searchQuery"
  @navigate-back="handleBack"
/>
```

### 3.3 条件渲染

```vue
<!-- 推荐：使用 v-if 和 v-else -->
<div v-if="selectedResource" class="content">
  <!-- 有选中资源时显示 -->
</div>
<div v-else class="empty-state">
  <!-- 空状态 -->
</div>

<!-- 推荐：多个条件使用 v-else-if -->
<template v-if="currentView === 'calendar'">
  <CalendarView />
</template>
<template v-else-if="currentView === 'templates'">
  <TemplatesView />
</template>
<template v-else>
  <ResourceView />
</template>
```

### 3.4 列表渲染

```vue
<!-- 推荐：始终使用 key -->
<div
  v-for="resource in resources"
  :key="resource.id"
  class="resource-item"
>
  {{ resource.name }}
</div>

<!-- 推荐：解构语法（需要时） -->
<Chip
  v-for="tag in selectedResource.tags"
  :key="tag"
  :label="tag"
  removable
  @remove="removeTag(tag)"
/>
```

### 3.5 事件处理

```vue
<!-- 推荐：事件使用 kebab-case -->
<Button @click="handleClick" />
<ResourceToolbar @navigate-back="handleBack" />

<!-- 推荐：带修饰符 -->
<form @submit.prevent="submitForm">
<input @keyup.enter="handleEnter" />
```

### 3.6 v-model 使用

```vue
<!-- 推荐：标准 v-model -->
<InputText v-model="form.name" />

<!-- 推荐：自定义 v-model 名称 -->
<Dialog v-model:visible="showDialog" />
<ResourceToolbar v-model:search-query="searchQuery" />
```

---

## 4. 脚本（Script）规范

### 4.1 Props 定义

```typescript
// 推荐：使用 TypeScript 接口定义 Props
interface Props {
  /** 搜索关键词 */
  searchQuery?: string
  /** 当前选中的分类 */
  selectedCategory?: string
  /** 当前选中的文件夹ID */
  selectedFolderId?: number | null
}

// 方式1：使用 withDefaults 提供默认值
const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  selectedCategory: 'all',
  selectedFolderId: null
})

// 方式2：不使用默认值
const props = defineProps<Props>()

// 方式3：简单类型定义
const props = defineProps<{
  title: string
  count: number
  items: Resource[]
}>()
```

### 4.2 Emits 定义

```typescript
// 推荐：使用类型化定义
const emit = defineEmits<{
  (e: 'search', value: string): void
  (e: 'select-category', key: string): void
  (e: 'select-resource', resource: Resource): void
  (e: 'update:modelValue', value: boolean): void
}>()

// 推荐：简单场景使用数组
const emit = defineEmits([
  'navigate-back',
  'navigate-forward',
  'zoom-out',
  'zoom-in'
])
```

### 4.3 defineModel（Vue 3.4+）

```typescript
// 推荐：使用 defineModel 替代 props + emit
const visible = defineModel<boolean>('visible', { default: false })

// 使用 emit 发送额外事件
const emit = defineEmits<{ created: [projectId: string] }>()
```

### 4.4 响应式状态定义

```typescript
// 推荐：使用 ref 定义基本类型
const count = ref(0)
const message = ref('Hello')
const isActive = ref(false)

// 推荐：使用 reactive 定义复杂对象
const form = reactive({
  name: '',
  email: '',
  age: 0
})

// 推荐：使用 computed 定义计算属性
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// 推荐：使用 readonly 防止意外修改
const config = readonly({ apiUrl: 'https://api.example.com' })
```

### 4.5 生命周期钩子

```typescript
// 推荐：使用组合式 API 生命周期钩子
import { onMounted, onUnmounted, watch } from 'vue'

onMounted(() => {
  // 组件挂载时的初始化逻辑
  loadData()
})

onUnmounted(() => {
  // 清理工作
  clearTimer()
})

// 推荐：使用 watch 监听变化
watch(() => props.selectedCategory, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    handleCategoryChange(newVal)
  }
}, { immediate: true })
```

### 4.6 方法定义

```typescript
// 推荐：使用箭头函数
const handleClick = () => {
  count.value++
}

// 推荐：异步方法
const loadData = async () => {
  try {
    const data = await fetchData()
    resources.value = data
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 推荐：带参数的函数
const updateResource = (id: number, updates: Partial<Resource>) => {
  const index = resources.value.findIndex(r => r.id === id)
  if (index !== -1) {
    Object.assign(resources.value[index], updates)
  }
}
```

---

## 5. 样式（Style）规范

### 5.1 基本规则

```vue
<style scoped>
/* 推荐：始终使用 scoped */
.component-container {
  padding: 16px;
}

/* 推荐：使用 CSS 变量支持主题 */
.dynamic-bg {
  background-color: var(--content-bg);
  color: var(--content-text);
}
</style>
```

### 5.2 Tailwind CSS 使用

```vue
<template>
  <!-- 推荐：优先使用 Tailwind 工具类 -->
  <div class="flex items-center justify-between p-4 gap-2">
    <h1 class="text-lg font-semibold">标题</h1>
    <Button class="px-4 py-2 rounded hover:bg-blue-600">
      按钮
    </Button>
  </div>
</template>
```

### 5.3 常用 Tailwind 类

| 分类 | 类名 | 说明 |
|------|------|------|
| 布局 | `flex`, `flex-col`, `items-center`, `justify-between` | 弹性布局 |
| 间距 | `p-4`, `m-2`, `space-y-4`, `gap-2` | 内边距/外边距/间距 |
| 尺寸 | `w-full`, `h-full`, `flex-1`, `flex-shrink-0` | 尺寸控制 |
| 字体 | `text-sm`, `text-lg`, `font-medium`, `font-semibold` | 字体样式 |
| 颜色 | `text-white`, `bg-blue-500`, `border-gray-200` | 颜色 |
| 过渡 | `transition-colors`, `duration-200` | 过渡动画 |

### 5.4 主题变量使用

```vue
<template>
  <!-- 推荐：使用 CSS 变量实现主题切换 -->
  <div
    class="panel"
    :style="{ 
      backgroundColor: 'var(--sidebar-bg)',
      borderColor: 'var(--content-border)',
      color: 'var(--content-text)'
    }"
  >
    内容
  </div>
</template>
```

### 5.5 窗口拖动支持

```vue
<template>
  <!-- 标题栏支持拖动 -->
  <div class="title-bar" style="-webkit-app-region: drag">
    <!-- 按钮区域不拖动 -->
    <div class="buttons" style="-webkit-app-region: no-drag">
      <Button @click="minimize">最小化</Button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
```

---

## 6. 状态管理规范

### 6.1 使用 Pinia Store

```typescript
// 推荐：在 setup 中使用 store
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()

// 读取状态
const isDarkMode = computed(() => themeStore.isDarkMode)

// 调用 action
themeStore.toggleTheme()
```

### 6.2 本地状态管理

```typescript
// 推荐：简单状态使用 ref/reactive
const isLoading = ref(false)
const error = ref<string | null>(null)

// 推荐：表单数据使用 reactive
const form = reactive({
  name: '',
  email: '',
  submitted: false
})
```

---

## 7. 事件处理规范

### 7.1 事件命名

```typescript
// 推荐：事件名使用 kebab-case
emit('select-resource', resource)
emit('update-search-query', value)
emit('navigate-back')

// 避免：使用 camelCase
emit('selectResource', resource)
```

### 7.2 事件处理函数

```typescript
// 推荐：事件处理函数以 handle 开头
const handleClick = () => { }
const handleSubmit = async () => { }
const handleResourceSelect = (resource: Resource) => { }

// 避免：简写命名
const click = () => { }
const submit = () => { }
```

---

## 8. 注释规范

### 8.1 文件头部注释

```vue
<script setup lang="ts">
/**
 * 组件名称
 * 组件功能描述
 */
```

### 8.2 代码块分隔注释

```typescript
// 推荐：使用特殊分隔线
// ─── 响应式状态 ─────────────────────────────────────────────────
const state = ref('')

// ─── 计算属性 ───────────────────────────────────────────────────
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

// ─── 方法 ───────────────────────────────────────────────────────
const handleClick = () => { }

// ─── 生命周期钩子 ───────────────────────────────────────────────
onMounted(() => { })
```

### 8.3 JSDoc 注释

```typescript
// 推荐：对复杂类型和方法添加 JSDoc
/**
 * 资源对象
 */
interface Resource {
  /** 唯一标识符 */
  id: number
  /** 资源名称 */
  name: string
  /** 资源类型：image, video, document */
  type: string
}

/**
 * 根据ID获取资源
 * @param id - 资源ID
 * @returns 找到的资源对象，未找到返回 null
 */
const getResourceById = (id: number): Resource | null => {
  return resources.value.find(r => r.id === id) || null
}
```

### 8.4 行内注释

```typescript
// 推荐：关键逻辑添加注释
// 检查是否已存在相同名称的资源
const existing = resources.value.find(r => r.name === file.name)
if (existing) {
  return handleDuplicate(existing)
}
```

---

## 附录：完整示例

```vue
<template>
  <div
    class="example-component flex flex-col h-full transition-colors duration-200"
    :style="{ backgroundColor: 'var(--content-bg)' }"
  >
    <!-- 标题栏 -->
    <header class="header flex items-center justify-between p-4">
      <h2 class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
        {{ title }}
      </h2>
      <Button
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        @click="handleAdd"
      />
    </header>

    <!-- 内容区域 -->
    <main class="content flex-1 p-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="item mb-2 p-2 rounded"
        :class="{ active: selectedId === item.id }"
        @click="selectItem(item)"
      >
        {{ item.name }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'

/**
 * 示例组件
 * 展示 Vue 文件编写的完整规范
 */

// ─── Props 定义 ─────────────────────────────────────────────────
interface Props {
  /** 组件标题 */
  title?: string
  /** 初始选中项ID */
  initialSelectedId?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '默认标题',
  initialSelectedId: null as any
})

// ─── Emits 定义 ─────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'select', item: Item): void
  (e: 'add'): void
}>()

// ─── 类型定义 ───────────────────────────────────────────────────
interface Item {
  id: number
  name: string
  description?: string
}

// ─── 响应式状态 ─────────────────────────────────────────────────
const selectedId = ref<number | null>(props.initialSelectedId)
const items = ref<Item[]>([])
const loading = ref(false)

// ─── 计算属性 ───────────────────────────────────────────────────
const selectedItem = computed(() => 
  items.value.find(item => item.id === selectedId.value)
)

// ─── 方法 ───────────────────────────────────────────────────────
const selectItem = (item: Item) => {
  selectedId.value = item.id
  emit('select', item)
}

const handleAdd = () => {
  emit('add')
}

const loadItems = async () => {
  loading.value = true
  try {
    // 加载数据的逻辑
    items.value = await fetchItems()
  } finally {
    loading.value = false
  }
}

// ─── 生命周期钩子 ───────────────────────────────────────────────
onMounted(() => {
  loadItems()
})
</script>

<style scoped>
.example-component {
  border: 1px solid var(--content-border);
}

.item {
  cursor: pointer;
  transition: background-color 0.2s;
}

.item:hover {
  background-color: var(--sidebar-hover-bg);
}

.item.active {
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}
</style>
```

---

## 总结

本 Vue 文件编写规范涵盖了：

- **文件结构** - 清晰的模板/脚本/样式组织  
- **命名规范** - 统一的组件、文件命名规则  
- **模板规范** - Props、事件、条件/列表渲染  
- **脚本规范** - TypeScript、响应式状态、生命周期  
- **样式规范** - Tailwind CSS + CSS 变量主题  
- **状态管理** - Pinia Store 和本地状态  
- **事件规范** - 命名约定和最佳实践  
- **注释规范** - 文档化代码的标准格式

遵循这些规范可以确保 Vue 组件的一致性、可维护性和可读性。
