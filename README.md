# 合同与项目管理桌面应用

这是一个基于 Electron + Vue 3 + TypeScript 的 Windows 桌面应用。当前代码以 `contract` 分支为准，产品形态已经从早期的演示型资源工具，扩展为一个围绕合同、客户、供应商、项目和资料管理的本地业务工作台。
![AI问询.png](images/AI%E9%97%AE%E8%AF%A2.png)
![合同信息.png](images/%E5%90%88%E5%90%8C%E4%BF%A1%E6%81%AF.png)
![合同详情.png](images/%E5%90%88%E5%90%8C%E8%AF%A6%E6%83%85.png)
![合同预览.png](images/%E5%90%88%E5%90%8C%E9%A2%84%E8%A7%88.png)
![批量导入合同.png](images/%E6%89%B9%E9%87%8F%E5%AF%BC%E5%85%A5%E5%90%88%E5%90%8C.png)
![收款计划.png](images/%E6%94%B6%E6%AC%BE%E8%AE%A1%E5%88%92.png)
![甲方信息.png](images/%E7%94%B2%E6%96%B9%E4%BF%A1%E6%81%AF.png)
它的核心思路是：

1. 先创建或加载本地资源库
2. 使用 SQLite 在资源库目录中保存合同、文件、客户、供应商和业务字典数据
3. 在桌面端统一管理合同台账、文件目录、项目台账和回款信息
4. 通过 AI、OCR、全文检索和缩略图能力提升录入与查找效率

## 当前定位

当前更适合把它理解为一个“本地优先的合同与项目管理工作台”，而不是单纯的文件管理器。现有代码更贴近以下使用场景：

- 合同信息台账与合同附件归档
- 客户、供应商与合同关联关系维护
- 合同执行、合同产品、收款计划、合同收付跟踪
- 项目管理台账录入、导入、汇总和导出
- 资源库内合同文档的索引、检索、预览辅助与 AI 抽取

软著项目管理功能仍然保留，但在当前分支中已经不再是唯一主线。

## 已实现的核心模块

### 1. 资源库与初始化

- 首次运行时创建新资源库，或加载已有资源库
- 使用 `bootstrap.json` 记录当前资源库路径和初始化状态
- 使用 `global-config.json` 保存资源库列表、快捷分类、日志设置等全局配置
- 资源库列表不再依赖数据库表，而是由全局配置维护

### 2. 合同台账

- 默认资源视图已切换为合同资源列表
- 支持创建、查询、读取、更新、删除、批量删除、排序移动合同记录
- 合同字段已覆盖合同编号、签约日期、甲方、乙方、金额、状态、执行方式、摘要、标签等
- 支持合同详情弹窗和编辑弹窗

### 3. 合同文件管理

- 每份合同会自动生成独立目录
- 合同目录下会初始化：
  - `documents`
  - `source_code`
  - `certificates`
- 支持合同文件列表、从路径写入索引、复制、删除、重命名、创建文件夹
- 支持合同文件缩略图生成与状态更新
- 合同文件已具备全文索引和全文搜索基础能力

### 4. 客户与供应商管理

- 已有单独的甲方单位管理页面
- 已有单独的乙方单位管理页面
- 主进程和预加载层都暴露了完整的 CRUD IPC 接口

### 5. 合同业务扩展模块

当前分支已经拆出了多块合同相关业务页面和数据模型：

- 合同产品管理
- 合同执行管理
- 收款计划
- 合同收付
- 项目管理台账

这些模块已经有独立的前端视图、类型定义、IPC handler 和数据库操作入口。

### 6. 项目管理台账

- 支持项目台账的新增、编辑、删除、排序和重新编码
- 支持按分组统计
- 支持 CSV 导入与导出
- 字段覆盖项目编号、名称、内容、分组、立项日期、概算批复、合同截止、工程地点、面积等

### 7. 字典与树形字典

- 支持普通字典管理
- 支持树形字典管理
- 支持分组改名、清空分组、导入 CSV、导出 CSV、排序更新
- 合同表单中的很多下拉选项已经可以接字典数据

### 8. AI、OCR 与文件转换

- 支持 AI 辅助解析合同文件
- AI 设置页支持云端模式和本地模型模式配置
- 主进程已提供 AI 连接测试、本地模型校验和结构化生成能力
- 支持文件转 Markdown
- 支持 OCR 引擎状态检测和 OCR 测试

### 9. 搜索、日志与开发辅助

- 提供全文搜索和重建索引接口
- 提供日志写入、日志设置、日志目录打开功能
- 设置面板中已包含 AI 配置、日志配置、开发者工具区域

### 10. 保留的原有模块

当前分支仍保留原先的一些能力：

- 软著项目创建与读取
- 标签与标签分组管理
- 旧项目列表与项目状态管理
- 日历、模板、统计等页面结构

不过这部分已经不再是唯一中心能力。

## 技术栈

- Electron 25
- Vue 3
- TypeScript
- PrimeVue 4
- Pinia
- Tailwind CSS 4
- better-sqlite3
- Webpack 5
- PDF / Office / Markdown 相关文件处理依赖
- 可选 AI 与本地 OCR 工具链集成

## 适用平台

当前项目明显偏向 Windows 桌面环境：

- `npm start` 和 `npm run dev` 使用 `chcp 65001`
- 打包配置目标为 Windows NSIS
- 仓库中包含多个 `.bat` 脚本

如果要正式支持 macOS 或 Linux，还需要补充启动脚本、安装说明和打包配置。

## 目录结构

```text
.
├── src
│   ├── main
│   │   ├── config                 # 应用常量与路径配置
│   │   ├── ipc                    # IPC channel、注册器与 handlers
│   │   ├── services               # 数据库、AI、文件转换、拷贝、配置等服务
│   │   ├── utils                  # 日志、CSV 等工具
│   │   ├── windows                # 窗口管理
│   │   ├── main.ts                # 主进程入口
│   │   └── preload.ts             # 向渲染进程暴露 electronAPI
│   ├── renderer
│   │   ├── components             # 通用组件与设置面板
│   │   ├── composables            # 组合式逻辑
│   │   ├── router                 # 路由定义
│   │   ├── stores                 # Pinia 状态管理
│   │   ├── styles                 # 全局样式与主题变量
│   │   ├── themes                 # 主题配置
│   │   ├── views
│   │   │   ├── shell              # 主布局
│   │   │   ├── library/resource   # 合同资源中心
│   │   │   ├── library/contract-* # 合同相关业务模块
│   │   │   ├── library/customer   # 客户管理
│   │   │   ├── library/supplier   # 供应商管理
│   │   │   ├── library/project-management
│   │   │   ├── library/dictionary
│   │   │   └── library/tree-dictionary
│   │   ├── App.vue
│   │   └── index.ts
│   └── shared                     # 共享类型、校验和工具函数
├── docs                           # 模块说明和方案文档
├── tests                          # 单元/集成/压力测试脚本
├── webpack.renderer.config.js
├── tsconfig.main.json
├── tsconfig.renderer.json
└── package.json
```

## 数据与持久化

### 1. Electron userData 目录

主要会写入两个全局文件：

- `bootstrap.json`
  记录当前加载的资源库路径、数据库路径、初始化状态
- `global-config.json`
  保存资源库列表、快捷分类、日志设置等全局配置

### 2. 资源库数据库

每个资源库目录下会维护一个 `settings.db`，这是当前业务数据的主要持久化入口。

当前已明确存在的核心表包括：

- `settings`
- `projects`
- `managed_projects`
- `documents`
- `workflow_nodes`
- `reminders`
- `tag_groups`
- `tags`
- `software_copyright`
- `contract_info`
- `contract_files`
- `suppliers`
- `customers`
- `contract_products`
- `contract_executions`
- `contract_receipt_payment`
- `dictionaries`
- `tree_dictionaries`
- `contract_ai_log`
- `file_content_fts`
- `file_metadata`

### 3. 合同目录

创建合同后，资源库中会生成带有日期和 ID 的合同目录，并至少初始化：

- `documents`
- `source_code`
- `certificates`

## 主要页面与导航

当前侧边栏和路由已经能看到这些业务入口：

- 全部
- 日历
- 模板
- 统计
- 标签管理
- 乙方单位
- 甲方单位
- 合同产品管理
- 合同执行管理
- 收款计划
- 合同收付
- 项目管理
- 字典设置
- 树形字典
- 合同文件页
- 设置页

默认资源页当前主要面向合同资源。

## 架构说明

### 主进程

- `main.ts` 统一注册全部 IPC handlers，并在启动时预加载当前资源库数据库
- `DatabaseService` 负责主业务 CRUD 和全文索引表
- `librarySchemaMigration.ts` 负责资源库层面的合同、客户、供应商、字典等结构迁移
- `FileCopyService` 负责批量拷贝与大文件处理
- `AIService` 负责 AI 提取、结构化生成、连接测试和本地模型校验
- `FileConversionService` / `PdfOcrService` 提供 Markdown 转换和 OCR 支持

### 预加载层

`preload.ts` 通过 `contextBridge` 向前端暴露 `window.electronAPI`，当前主要模块包括：

- `window`
- `bootstrap`
- `db`
- `project`
- `projectManagement`
- `document`
- `workflow`
- `reminder`
- `fs`
- `fileCopy`
- `library`
- `contractFiles`
- `dictionary`
- `treeDictionary`
- `ai`
- `fileConversion`
- `search`
- `contract`
- `supplier`
- `customer`
- `contractProduct`
- `contractExecution`
- `contractReceiptPayment`
- `log`
- `config`

### 渲染进程

- `MainLayout.vue` 负责三栏式桌面主界面
- `ResourceView.vue` 负责合同资源列表、分页、搜索、全文检索和资源跳转
- `ContractFilesView.vue` 负责合同目录和文件管理
- 各业务模块已有独立管理页和组件目录
- `SettingsDialog.vue` 已承载 AI、日志和开发者相关设置

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动已构建的 Electron 应用 |
| `npm run dev` | 先构建再启动 Electron |
| `npm run build` | 构建主进程和渲染进程 |
| `npm run build:main` | 仅编译主进程 TypeScript |
| `npm run build:renderer` | 仅构建渲染进程 |
| `npm run watch` | 监听源码并重新构建 |
| `npm run dev:renderer` | 启动 Webpack Dev Server |
| `npm run electron:dev` | 以开发环境变量启动 Electron |
| `npm run setup-electron-cn` | 配置 Electron 国内镜像源 |
| `npm run check:win-packaging-inputs` | 校验 Windows 打包前置输入（构建产物、资源、目录写权限） |
| `npm run pack:win` | 执行前置校验后打包 Windows NSIS 安装包 |
| `npm run build:win` | 一键构建并打包 Windows 安装包（推荐发布命令） |

## 测试现状

仓库中当前能直接看到的测试文件主要包括：

- `tests/unit-forms-validation.js`
- `tests/unit-contract-create-read.js`
- `tests/unit-contract-dialog-task5.js`
- `tests/unit-project-management.js`
- `tests/unit-ai-extract.js`
- `tests/unit-theme.js`
- `tests/integration-create-project.js`
- `tests/integration-project-management.js`
- `tests/stress-create-project.js`

`package.json` 中还定义了更多测试脚本，但其中一部分脚本引用的测试文件目前并不在仓库内，例如：

- `unit-contract-file-icons.js`
- `unit-ai-structured.js`
- `unit-ai-local-e2e.js`
- `integration-ai-cloud-regression.js`
- `unit-pdf-ocr-markdown.js`
- `integration-copy-lib.js`
- `integration-file-copy-engine.js`
- `perf-thumbnail-generation.js`

因此在执行完整测试命令前，建议先核对这些文件是否已经补齐。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

中国大陆网络环境建议先执行：

```bash
npm run setup-electron-cn
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动应用

```bash
npm start
```

## Windows 打包与验收

### 1. 一键打包命令

```bash
npm run build:win
```

该命令会按顺序执行：

1. `npm run build`（构建主进程与渲染进程）
2. `npm run check:win-packaging-inputs`（校验 `out/`、`resources/ocr`、`release/` 可写）
3. `electron-builder --win nsis`（生成 NSIS 安装包）

### 2. 产物位置与命名

- 默认输出目录：`release/`
- 安装包命名：`${productName}-Setup-${version}.exe`
- 示例：`软件注册管理-Setup-1.0.0.exe`

### 3. 常见失败与处理

- 构建产物缺失：先执行 `npm run build`，确认 `out/main/main.js` 与 `out/renderer/*` 存在
- OCR 资源缺失：确认 `resources/ocr` 目录存在且包含运行时资源
- 输出目录不可写：检查 `release/` 目录权限，或使用可写工作目录重试

### 4. 最小人工验收流程

1. 运行 `npm run build:win`，确认命令 0 退出且 `release/` 生成 `.exe` 文件
2. 双击安装包，按向导完成安装（支持自定义安装目录）
3. 首次启动应用，确认主界面可正常打开
4. 执行卸载流程，确认卸载完成且不误删安装目录外的用户资源库数据

## 当前已知情况

- 仓库里仍保留了一些历史文档和早期模块命名，功能判断请以当前 `src` 实现为准
- 部分页面的成熟度不一致，像日历、模板、统计等页面仍有展示型或占位内容
- 一些通用设置仍在迭代中，不是所有界面选项都已经形成完整持久化闭环
- `dev` 脚本本质上仍然是“构建后启动”，不是完整热更新开发流
- 测试脚本与仓库内实际测试文件之间目前存在不完全一致的情况

## 后续建议方向

如果继续把这套项目往产品推进，比较自然的下一步是：

- 把合同管理、合同文件、客户/供应商、回款管理打磨成完整业务闭环
- 为统计页接入真实业务数据，而不是展示型占位数据
- 补齐合同审批、日志审计、回款提醒和权限管理
- 继续完善 AI 录入、OCR、全文检索和文件预览体验
- 清理历史文档和失配测试脚本，降低维护成本
  ](E:\hqkj\contract\code\contract)
