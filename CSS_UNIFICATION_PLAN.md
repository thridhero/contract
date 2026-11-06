# CSS 样式统一计划

## 1. 现状分析

### 当前 CSS 结构
```
src/renderer/
├── styles.css                 # 样式入口（仅导入 theme.css + Tailwind）
├── styles/
│   └── theme.css             # 主题变量、滚动条、工具类（265行）
├── index.ts                  # 入口，导入 styles.css
└── **/*.vue                  # 18个 Vue 组件，各自包含 <style scoped>
```

### 当前样式分布统计
| 位置 | 类型 | 数量 | 说明 |
|------|------|------|------|
| `theme.css` | 全局 CSS 变量 | 80+ 个变量 | 亮色/暗色主题 |
| `theme.css` | 全局样式 | 约 50 行 | 滚动条、选择文本、焦点等 |
| `App.vue` | 全局布局 | 约 20 行 | html/body/#app 基础样式 |
| `MainLayout.vue` | PrimeVue 适配 | 约 60 行 | 输入框、按钮、对话框等 |
| 其他组件 | Scoped 样式 | 每个 20-100 行 | 组件特定样式 |

---

## 2. 统一目标

### 目标架构
```
src/renderer/
├── styles/
│   ├── index.css             # 新的统一入口（原 styles.css 内容）
│   ├── variables.css         # CSS 变量（原 theme.css 变量部分）
│   ├── base.css              # 基础样式（重置、全局）
│   ├── components.css        # 组件通用样式
│   ├── primevue-theme.css    # PrimeVue 主题适配
│   └── utilities.css         # 工具类
```

### 设计原则
1. **单一职责**：每个 CSS 文件只负责一类样式
2. **变量驱动**：所有颜色、尺寸使用 CSS 变量
3. **避免重复**：公用样式提取到全局
4. **保持 Scoped**：组件特有样式保留 scoped
5. **渐进式迁移**：分阶段实施，避免一次性改动过大

---

## 3. 实施步骤

### 阶段一：准备与规划（1-2 天）

#### 3.1.1 创建新的样式目录结构
```bash
src/renderer/styles/
├── index.css                 # 统一入口
├── variables.css             # CSS 变量
├── base.css                  # 基础/重置样式
├── components.css            # 通用组件样式
├── primevue-theme.css        # PrimeVue 适配
└── utilities.css             # 工具类
```

#### 3.1.2 变量系统整理（`variables.css`）
将 `theme.css` 中的变量提取并优化：

```css
/* variables.css - 变量分层 */
:root {
  /* 1. 原始色板（不直接使用） */
  --color-blue-500: #0D6EFD;
  --color-gray-100: #F8F9FA;
  /* ... */

  /* 2. 语义层（按用途） */
  --color-primary: var(--color-blue-500);
  --color-surface: var(--color-gray-100);
  /* ... */

  /* 3. 组件层（具体应用） */
  --sidebar-bg: var(--color-surface);
  --btn-primary-bg: var(--color-primary);
  /* ... */
}

/* 深色模式 */
.dark {
  --color-surface: #1E2127;
  /* ... */
}
```

#### 3.1.3 提取 PrimeVue 主题适配
从 `MainLayout.vue` 中提取所有 `:deep()` 样式到 `primevue-theme.css`：

```css
/* primevue-theme.css */
@layer primevue-theme {
  /* 输入框 */
  .p-inputtext {
    background: var(--input-bg);
    border-color: var(--input-border);
    color: var(--input-text);
  }
  .p-inputtext:hover { border-color: var(--input-border-hover); }
  .p-inputtext:focus { 
    border-color: var(--input-border-focus); 
    box-shadow: 0 0 0 2px var(--btn-primary-bg);
  }
  
  /* 按钮、对话框、复选框等... */
}
```

---

### 阶段二：核心样式迁移（2-3 天）

#### 3.2.1 创建 `index.css` 入口
```css
/* index.css - 统一入口 */
@layer tailwind-base, primevue-base, variables, base, components, primevue-theme, utilities, tailwind-utilities;

@import './variables.css' layer(variables);
@import './base.css' layer(base);
@import './components.css' layer(components);
@import './primevue-theme.css' layer(primevue-theme);
@import './utilities.css' layer(utilities);

@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 3.2.2 迁移基础样式（`base.css`）
包含内容：
- `App.vue` 中的 html/body/#app 样式
- `theme.css` 中的全局样式（滚动条、选择文本等）
- 通用重置样式

```css
/* base.css */
@layer base {
  html, body, #app {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* 滚动条 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }
  /* ... */

  /* 选择文本 */
  ::selection {
    background-color: var(--btn-primary-bg);
    color: var(--btn-primary-text);
  }
}
```

#### 3.2.3 创建通用组件样式（`components.css`）
提取各组件中可复用的样式模式：

```css
/* components.css - 通用组件样式 */
@layer components {
  /* 卡片 */
  .card {
    background: var(--content-card-bg);
    border: 1px solid var(--content-border);
    border-radius: 8px;
    padding: 16px;
  }

  /* 页面容器 */
  .page-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* 工具栏 */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid var(--content-border);
  }

  /* 侧边栏通用样式 */
  .sidebar {
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
  }

  /* 表单元素 */
  .form-label {
    display: block;
    margin-bottom: 8px;
    color: var(--content-text-secondary);
    font-size: 14px;
  }
}
```

#### 3.2.4 工具类整理（`utilities.css`）
```css
/* utilities.css */
@layer utilities {
  .theme-bg-sidebar { background-color: var(--sidebar-bg); }
  .theme-bg-content { background-color: var(--content-bg); }
  .theme-bg-card { background-color: var(--content-card-bg); }
  .theme-text-primary { color: var(--content-text); }
  .theme-text-secondary { color: var(--content-text-secondary); }
  .theme-text-muted { color: var(--content-text-muted); }
  .theme-border { border-color: var(--content-border); }
  .theme-divider { border-color: var(--content-divider); }
  
  /* 布局工具类 */
  .flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

---

### 阶段三：组件样式优化（3-5 天）

#### 3.3.1 组件样式审查清单
对每个 Vue 组件进行审查：

| 组件 | 当前样式行数 | 优化策略 |
|------|-------------|----------|
| MainLayout.vue | ~80行 | 移除 PrimeVue 样式，保留布局 |
| TitleBar.vue | ~40行 | 保留 scoped，简化重复样式 |
| HomeView.vue | ~40行 | 提取通用卡片样式 |
| ResourceView.vue | ~400行 | 分解为多个子组件或提取通用样式 |
| ProjectsView.vue | ~400行 | 同上 |
| SettingsView.vue | ~300行 | 提取表单通用样式 |
| ... | ... | ... |

#### 3.3.2 具体优化示例

**优化前（MainLayout.vue）：**
```vue
<style scoped>
.left-sidebar { flex-shrink: 0; }
.main-content { flex: 1; min-width: 0; }
.right-panel { flex-shrink: 0; }

/* 60+ 行 PrimeVue 样式... */
:deep(.p-inputtext) { /* ... */ }
:deep(.p-button) { /* ... */ }
</style>
```

**优化后（MainLayout.vue）：**
```vue
<style scoped>
/* 仅保留布局相关的 scoped 样式 */
.left-sidebar { flex-shrink: 0; }
.main-content { flex: 1; min-width: 0; }
.right-panel { flex-shrink: 0; }
</style>
```

#### 3.3.3 复杂组件分解
对于 `ResourceView.vue` 和 `ProjectsView.vue` 这类大型组件：

1. **选项 A：保持现状，提取可复用样式**
   - 将通用样式提取到 `components.css`
   - 保留组件特定的 scoped 样式

2. **选项 B：组件分解（推荐）**
   ```
   views/resource/
   ├── ResourceView.vue        # 主视图（简化）
   ├── components/
   │   ├── ResourceList.vue    # 列表组件
   │   ├── ResourceToolbar.vue # 工具栏
   │   └── ResourceFilters.vue # 筛选面板
   ```

---

### 阶段四：验证与清理（1-2 天）

#### 3.4.1 回归测试清单
- [ ] 亮色主题正常显示
- [ ] 暗色主题正常显示
- [ ] 主题切换无闪烁
- [ ] 所有 PrimeVue 组件样式正确
- [ ] 滚动条样式一致
- [ ] 响应式布局正常
- [ ] 无边距/布局断裂问题

#### 3.4.2 清理旧文件
```bash
# 删除旧文件
rm src/renderer/styles.css
rm src/renderer/styles/theme.css

# 更新 index.ts 导入
# 从: import './styles.css'
# 改为: import './styles/index.css'
```

---

## 4. 实施时间表

| 阶段 | 预计时间 | 产出 |
|------|---------|------|
| 阶段一：准备与规划 | 1-2 天 | 新目录结构、变量系统 |
| 阶段二：核心样式迁移 | 2-3 天 | 5 个新的 CSS 文件 |
| 阶段三：组件样式优化 | 3-5 天 | 18 个 Vue 组件优化 |
| 阶段四：验证与清理 | 1-2 天 | 测试通过、旧文件清理 |
| **总计** | **7-12 天** | |

---

## 5. 文件映射关系

### 迁移映射表

| 原内容 | 新位置 | 说明 |
|--------|--------|------|
| `styles.css` | `styles/index.css` | 入口文件 |
| `theme.css` CSS 变量 | `styles/variables.css` | 主题变量 |
| `theme.css` 滚动条 | `styles/base.css` | 基础样式 |
| `theme.css` 工具类 | `styles/utilities.css` | 工具类 |
| `App.vue` 全局样式 | `styles/base.css` | 基础布局 |
| `MainLayout.vue` PrimeVue 样式 | `styles/primevue-theme.css` | UI 库适配 |
| 各组件通用样式 | `styles/components.css` | 通用组件 |

---

## 6. 最佳实践建议

### 6.1 样式编写规范
```css
/* ✅ 推荐使用 CSS 变量 */
.button {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

/* ❌ 避免硬编码 */
.button {
  background: #0D6EFD;
  color: white;
}
```

### 6.2 Scoped 样式使用原则
```vue
<script setup>
// 优先使用 Tailwind 类名
</script>

<template>
  <!-- ✅ 使用 Tailwind -->
  <div class="flex items-center justify-between p-4">
    ...
  </div>
</template>

<style scoped>
/* ✅ 仅组件特有且无法 Tailwind 实现的样式 */
.custom-animation {
  animation: slideIn 0.3s ease;
}

/* ❌ 避免重复 Tailwind 已有的样式 */
/* .flex-center { display: flex; justify-content: center; } */
</style>
```

### 6.3 命名规范
| 类型 | 命名方式 | 示例 |
|------|---------|------|
| CSS 变量 | kebab-case | `--btn-primary-bg` |
| 工具类 | kebab-case | `.theme-bg-sidebar` |
| 组件类 | 语义化 | `.card`, `.toolbar` |

---

## 7. 回滚计划

如遇问题，可按以下步骤回滚：
1. 恢复 `src/renderer/styles.css` 和 `theme.css`
2. 恢复 `index.ts` 中的导入语句
3. 恢复各 Vue 组件的原始样式
4. 删除新的 `styles/` 目录下的新文件

---

## 8. 附录：快速参考

### 常用命令
```bash
# 查找所有 style 标签
grep -r "<style" src/renderer --include="*.vue"

# 统计各文件 CSS 行数
find src/renderer -name "*.vue" -exec grep -c "<style" {} \;

# 查找重复样式模式
grep -r "display: flex" src/renderer --include="*.vue"
```

### 开发检查清单
- [ ] 新样式文件创建完成
- [ ] `index.ts` 导入更新
- [ ] 所有 CSS 变量迁移
- [ ] PrimeVue 样式提取
- [ ] 组件 scoped 样式简化
- [ ] 视觉回归测试通过
- [ ] 亮色/暗色主题测试通过
