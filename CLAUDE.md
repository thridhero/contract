# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electron + Vue 3 + TypeScript desktop application for contract and project management (合同与项目管理桌面工作台). It is a local-first business workbench centered around contract ledgers, customer/supplier management, project tracking, and file management.

**Current branch**: `contract-worktree` (active development). Product has evolved from a demo resource tool into a full contract management platform.

## Build & Development Commands

```bash
npm install                          # Install dependencies (postinstall runs electron-builder install-app-deps)
npm run build                        # Full build: main (tsc) + renderer (webpack)
npm run dev                          # Build + launch Electron
npm run start                        # Launch already-built Electron app
npm run build:main                   # Only compile main process TypeScript
npm run build:renderer               # Only build renderer (webpack)
npm run watch                        # Watch src/ and auto-rebuild
npm run dev:renderer                 # Webpack dev server (port 5174)
npm run electron:dev                 # Dev mode: build main + launch Electron with NODE_ENV=development
npm run setup-electron-cn            # Configure Electron mirror for China (npmmirror)
npm run build:win                    # Full build + pack Windows NSIS installer
npm run pack:win                     # Validate inputs + pack NSIS installer
```

### Test Commands

Tests run via Node.js or `ELECTRON_RUN_AS_NODE=1 electron` (many need the main process compiled first with `npm run build:main`):

```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Individual test files (all in tests/ directory):
node tests/unit-forms-validation.js
cross-env ELECTRON_RUN_AS_NODE=1 electron tests/unit-contract-create-read.js
cross-env ELECTRON_RUN_AS_NODE=1 electron tests/unit-project-management.js
cross-env ELECTRON_RUN_AS_NODE=1 electron tests/unit-contract-dialog-task5.js
cross-env ELECTRON_RUN_AS_NODE=1 electron tests/unit-theme.js
node tests/unit-ai-extract.js
node tests/integration-create-project.js
node tests/integration-project-management.js
node tests/stress-create-project.js
```

## Architecture

### Tech Stack
- **Runtime**: Electron 25
- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript, Pinia, Vue Router (hash-based)
- **UI**: PrimeVue 4, Tailwind CSS 4, PrimeIcons + custom SVG icons
- **Database**: better-sqlite3 (sync API, WAL mode, foreign keys ON) — NOT sql.js
- **Bundler**: Webpack 5 (renderer), tsc (main process)
- **Other**: winston (logging), vee-validate + yup (form validation)

### Process Communication
- **Preload** (`src/main/preload.ts`): All IPC exposed via `contextBridge` as `window.electronAPI`. Direct `ipcRenderer` access is not available.
- **Channels** (`src/main/ipc/channels.ts`): Single source of truth for all IPC channel name constants. Naming convention: `<domain>:<action>`.
- **Handlers**: Organized by domain in `src/main/ipc/handlers/<domain>/`. System handlers (window, bootstrap, database, config, etc.) plus business domain handlers (contract, customer, supplier, dictionary, invoice, etc.).
- **Push events**: Main→Renderer one-way events (progress, status changes) use `webContents.send` with channels listed in `ALLOWED_LISTEN_CHANNELS`.

### Main Process (`src/main/`)
- `main.ts` — Bootstrap sequence: (1) register all IPC handlers, (2) preload database if initialized, (3) start background services (trash purge, backup scheduler), (4) create main window
- `services/system/DatabaseService.ts` — Singleton, sync better-sqlite3. All CRUD organized into composable method groups (settingsTags, projects, documents, workflow, suppliers, customers, departments, personnel, managedProjects, contractProducts, contractExecutions, contractReceiptPayments, contractInvoices, dictionaries, treeDictionaries, stats, aiLog, fileSearch)
- `services/system/BootstrapService.ts` — Manages `bootstrap.json` in userData (projectPath, databasePath, initialized flag)
- `services/system/ConfigService.ts` — Manages `global-config.json` (library list, log settings, etc.)
- `services/system/AIService.ts` — Cloud/local AI extraction, structured generation, connection testing
- `services/file/` — FileCopyService, FileConversionService, FileIndexerService, PdfOcrService, etc.
- `windows/WindowManager.ts` — Window creation and management

### Renderer (`src/renderer/`)
- `views/shell/MainLayout.vue` — Three-column shell (sidebar + content + properties panel)
- `router/index.ts` — Hash-based routing. Auth guard + subscription check in `beforeEach`. Routes: Login, billing, home, projects, tags, suppliers, customers, department-personnel, contract-products, contract-executions, receipt-plans, contract-receipt-payments, contract-files, other-files, settings, first-run
- **Stores**: Organized by domain — `stores/contract/`, `stores/project/`, `stores/system/` (auth, subscription, ai, importTask, taskMonitor), `stores/ui/`
- **Views**: Business modules under `views/library/` — contract-*, customer, supplier, department-personnel, dictionary, tree-dictionary, project-management, tag, resource, other-files, calendar, statistics, templates

### Shared (`src/shared/`)
- `types/` — 35+ type definition files covering all business domains (contractInfo, contractFile, supplier, customer, project, dictionary, etc.)
- `validation/` — Form validation schemas
- `utils/` — Shared utility functions

### Database Schema (settings.db, created per-library)
Major tables: `settings`, `projects`, `managed_projects`, `documents`, `workflow_nodes`, `reminders`, `tag_groups`, `tags`, `software_copyright`, `contract_info`, `contract_files`, `suppliers`, `customers`, `contract_products`, `contract_executions`, `contract_receipt_payment`, `contract_invoice`, `dictionaries`, `tree_dictionaries`, `contract_ai_log`, `file_content_fts`, `file_metadata`

Schema migrations handled by: `services/system/librarySchemaMigration.ts`

### Key Conventions
- **Path alias**: `@/` and `@renderer/` both resolve to `src/renderer/`
- **TypeScript configs**: `tsconfig.main.json` (CommonJS for main), `tsconfig.renderer.json` (ES2020 for renderer)
- **Styling**: Tailwind CSS utility classes + PrimeVue theme config. Theme objects in `src/renderer/themes/`
- **Icons**: `pi pi-*` (PrimeIcons) or custom SVG components in `src/renderer/components/icons/`
- **IPC naming**: All channel constants in `channels.ts` follow `<domain>:<action>` pattern. String literals are NOT used directly.
- **File organization**: Each business domain has parallel structure — IPC handlers (main), Pinia stores (renderer), shared types (shared), and views (renderer)

### Startup Flow
1. `app.whenReady()` → `bootstrap()` function
2. Register all IPC handlers via `IpcManager.registerAll()`
3. Check `bootstrap.json` in userData — if initialized, preload database
4. Start background services (trash auto-purge, backup scheduler)
5. Create main window via `WindowManager.createMainWindow()`
6. Renderer loads → auth guard checks WeChat login status → subscription check → route to target page

### Data Flow
- Each library (resource repository) has its own `settings.db` inside the user-chosen project folder
- Global config (`global-config.json`) lives in Electron's `userData` directory alongside `bootstrap.json`
- Contract files are physically stored in subdirectories under the library path (e.g., `contracts/2026-04-29-<id>/documents/`)
