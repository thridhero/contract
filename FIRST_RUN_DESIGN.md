# 首次启动引导设计文档

## 1. 功能概述

软件启动时，首先检查当前启动的文件夹下是否存在数据库。如果不存在，则创建一个，并弹出一个设置页面，让用户选择一个路径文件夹。输入选择文件夹后，将在该目标文件夹下创建一个文件夹，并初始化一个数据库，并将项目路径保存到数据库中。下次再启动时则无需再次校验。

---

## 2. 启动流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        软件启动                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   检查 bootstrap.json 是否存在                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   是                  否
                    │                   │
                    ▼                   ▼
┌───────────────────────────┐  ┌───────────────────────────────────┐
│  读取已保存的项目路径        │  │  打开首次启动引导页面              │
│  加载该路径下的数据库       │  │  (FirstRunView)                  │
└───────────────────────────┘  └───────────────────────────────────┘
                    │                   │
                    │                   ▼
                    │          ┌───────────────────────────────────┐
                    │          │  用户输入资源库名称                │
                    │          │  用户选择保存路径                  │
                    │          └───────────────────────────────────┘
                    │                   │
                    │                   ▼
                    │          ┌───────────────────────────────────┐
                    │          │  在选定路径下创建项目文件夹         │
                    │          │  初始化数据库 (settings.db)        │
                    │          │  保存 bootstrap.json               │
                    │          └───────────────────────────────────┘
                    │                   │
                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        进入主界面                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 文件结构

### 3.1 新增文件

```
src/
├── main/
│   ├── bootstrap.ts          # 引导配置管理（新增）
│   └── ...
├── renderer/
│   ├── views/
│   │   ├── onboarding/
│   │   │   ├── FirstRunView.vue  # 首次启动引导页（新增）
│   │   └── ...
│   └── ...
└── ...

数据文件（运行时创建）:
%APPDATA%/electron-dual-panel-app/
├── bootstrap.json            # 引导配置（记录项目路径）
└── ...

用户选择的路径/
└── 资源库名称/
    └── settings.db           # 数据库文件
```

---

## 4. 首次启动引导页面设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    ┌─────────────────────────────────────────────────┐     │
│    │                                                 │     │
│    │    📁          创建资源库                        │     │
│    │                                                 │     │
│    │    请输入资源库的名称（例：我的灵感、设计素      │     │
│    │    材），并点击下方按钮选择资源库保存的路径。    │     │
│    │                                                 │     │
│    │    ┌─────────────────────────────────────────┐ │     │
│    │    │  资源库名称                              │ │     │
│    │    └─────────────────────────────────────────┘ │     │
│    │                                                 │     │
│    │    ┌──────────────┐    ┌─────────────────────┐ │     │
│    │    │    取消      │    │  选择保存路径   ▶   │ │     │
│    │    └──────────────┘    └─────────────────────┘ │     │
│    │                                                 │     │
│    └─────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 页面元素说明

| 元素 | 类型 | 说明 |
|------|------|------|
| 📁 图标 | Icon | 视觉引导，使用文件夹/数据库图标 |
| 标题 | Text | "创建资源库" |
| 说明文字 | Text | 引导用户输入名称并选择路径 |
| 资源库名称 | Input | 文本输入框，必填 |
| 取消按钮 | Button | 关闭应用（或返回，视需求而定） |
| 选择保存路径按钮 | Button | 打开文件夹选择对话框，蓝色主色调 |

### 4.3 交互流程

1. **输入资源库名称**
   - 用户输入名称（如：我的设计素材）
   - 名称不能为空，需进行校验

2. **选择保存路径**
   - 点击"选择保存路径"按钮
   - 弹出系统文件夹选择对话框
   - 用户选择目标文件夹（如：D:\MyFiles）

3. **确认创建**
   - 在 `D:\MyFiles\我的设计素材\` 下创建 `settings.db`
   - 保存 `bootstrap.json` 到 `%APPDATA%/electron-dual-panel-app/`
   - 显示成功提示

4. **跳转主页**
   - 自动关闭引导页
   - 跳转到应用主界面

---

## 5. 数据结构

### 5.1 bootstrap.json

```json
{
  "projectName": "我的设计素材",
  "projectPath": "D:\\MyFiles\\我的设计素材",
  "databasePath": "D:\\MyFiles\\我的设计素材\\settings.db",
  "initialized": true,
  "initializedAt": "2026-03-03T08:00:00.000Z"
}
```

### 5.2 数据库表结构（settings.db）

```sql
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化时插入项目路径记录
INSERT INTO settings (key, value, description) 
VALUES ('project_path', 'D:\\MyFiles\\我的设计素材', '项目根目录路径');
```

---

## 6. IPC 通信设计

### 6.1 主进程 → 渲染进程

| 通道 | 方向 | 说明 |
|------|------|------|
| `get-init-status` | R→L | 获取初始化状态 |
| `select-folder` | R→L | 打开文件夹选择对话框 |
| `initialize-project` | R→L | 执行项目初始化 |

### 6.2 请求/响应格式

#### `get-init-status`
```typescript
// 响应
{
  initialized: boolean;
  projectPath?: string;
  projectName?: string;
}
```

#### `select-folder`
```typescript
// 响应
{
  canceled: boolean;
  filePaths: string[];
}
```

#### `initialize-project`
```typescript
// 请求
{
  projectName: string;
  basePath: string;
}

// 响应
{
  success: boolean;
  error?: string;
  projectPath?: string;
}
```

---

## 7. 核心代码接口设计

### 7.1 main/bootstrap.ts

```typescript
// 读取引导配置
export function readBootstrapConfig(): BootstrapConfig | null;

// 保存引导配置
export function saveBootstrapConfig(config: BootstrapConfig): void;

// 检查是否已初始化
export function isProjectInitialized(): boolean;

// 获取项目路径
export function getProjectPath(): string | null;
```

### 7.2 main/database.ts（扩展）

```typescript
// 初始化数据库（支持自定义路径）
export async function initDatabaseWithPath(dbPath: string): Promise<Database>;

// 创建项目数据库
export async function createProjectDatabase(
  projectPath: string,
  projectName: string
): Promise<boolean>;
```

### 7.3 preload.ts（扩展）

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有 API
  
  // 首次启动相关
  getInitStatus: () => ipcRenderer.invoke('get-init-status'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  initializeProject: (name: string, path: string) => 
    ipcRenderer.invoke('initialize-project', name, path),
});
```

---

## 8. 异常处理

| 场景 | 处理方式 |
|------|----------|
| 用户未输入名称 | 禁用"选择保存路径"按钮，提示"请输入资源库名称" |
| 用户取消选择路径 | 关闭对话框，不做任何操作 |
| 路径无写入权限 | 提示"所选路径无写入权限，请选择其他路径" |
| 数据库创建失败 | 提示错误信息，允许重试 |
| 已存在同名数据库 | 提示"该位置已存在数据库，是否覆盖？" |

---

## 9. 后续扩展

- [ ] 支持多项目管理（切换不同资源库）
- [ ] 支持数据库备份与恢复
- [ ] 支持路径有效性预检
- [ ] 支持自定义数据库文件名

---

## 10. 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/main/bootstrap.ts` | ✅ 已创建 | 引导配置管理 |
| `src/main/database.ts` | ✅ 已修改 | 扩展数据库路径支持 |
| `src/main/main.ts` | ✅ 已修改 | 启动流程改造 |
| `src/main/preload.ts` | ✅ 已修改 | 暴露首次启动 API |
| `src/renderer/views/onboarding/FirstRunView.vue` | ✅ 已创建 | 首次启动页面 |
| `src/renderer/router/index.ts` | ✅ 已修改 | 添加 first-run 路由 |
| `src/renderer/App.vue` | ✅ 已修改 | 添加初始化检查 |
| `src/renderer/types/vue-shim.d.ts` | ✅ 已修改 | 添加类型声明 |

---

## 11. 视觉设计参考

```
配色方案（参考当前主题）:
- 主按钮蓝色：#3B82F6
- 取消按钮灰色：#6B7280
- 输入框边框：#D1D5DB
- 文字颜色：#1F2937
- 背景颜色：#FFFFFF

字体大小:
- 标题：24px
- 说明：14px
- 输入框：16px
- 按钮：14px

间距:
- 卡片内边距：24px
- 元素间距：16px
- 按钮内边距：12px 24px
```

---

**文档版本**: v1.0  
**创建时间**: 2026-03-03  
**最后更新**: 2026-03-03
