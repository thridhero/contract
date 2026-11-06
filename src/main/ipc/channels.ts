/**
 * IPC Channel 名称常量
 *
 * 所有 ipcMain.handle / ipcRenderer.invoke 调用必须通过此文件的常量，
 * 禁止在代码中直接使用字符串字面量，确保重构安全性与 IDE 提示。
 *
 * 命名规范：<domain>:<action>
 */

// ─── 窗口控制 ────────────────────────────────────────────────────
export const WIN_MINIMIZE         = 'win:minimize';
export const WIN_TOGGLE_MAXIMIZE  = 'win:toggle-maximize';
export const WIN_CLOSE            = 'win:close';
export const WIN_IS_MAXIMIZED     = 'win:is-maximized';
export const WIN_TOGGLE_FULLSCREEN = 'win:toggle-fullscreen';
export const WIN_IS_FULLSCREEN    = 'win:is-fullscreen';

/** 主进程 → 渲染进程推送事件（单向，用 webContents.send） */
export const WIN_MAXIMIZE_CHANGED = 'win:maximize-changed';
export const WIN_FULLSCREEN_CHANGED = 'win:fullscreen-changed';

// ─── 初始化 / Bootstrap ──────────────────────────────────────────
export const BOOT_GET_INIT_STATUS   = 'boot:get-init-status';
export const BOOT_SELECT_FOLDER     = 'boot:select-folder';
export const BOOT_INIT_PROJECT      = 'boot:init-project';
export const BOOT_VALIDATE_PATH     = 'boot:validate-library-path';
export const BOOT_LOAD_LIBRARY      = 'boot:load-existing-library';

// ─── 数据库 Settings CRUD ────────────────────────────────────────
export const DB_INSERT_SETTING  = 'db:insert-setting';
export const DB_UPDATE_SETTING  = 'db:update-setting';
export const DB_DELETE_SETTING  = 'db:delete-setting';
export const DB_GET_SETTING     = 'db:get-setting';
export const DB_GET_ALL         = 'db:get-all-settings';
export const DB_SEARCH          = 'db:search-settings';
export const DB_GET_TAGS        = 'db:get-tags';
export const DB_GET_TAG_GROUPS  = 'db:get-tag-groups';

// ─── 项目 CRUD ───────────────────────────────────────────────────
export const PROJECT_CREATE     = 'project:create';
export const PROJECT_UPDATE     = 'project:update';
export const PROJECT_DELETE     = 'project:delete';
export const PROJECT_RESTORE    = 'project:restore';
export const PROJECT_PURGE      = 'project:purge';
export const PROJECT_GET        = 'project:get';
export const PROJECT_GET_ALL    = 'project:get-all';
export const PROJECT_SEARCH     = 'project:search';
export const PROJECT_GET_STATS  = 'project:get-stats';
export const PROJECT_GET_BY_STATUS = 'project:get-by-status';

// ─── 项目管理页面 ────────────────────────────────────────────────
export const PROJECT_MANAGEMENT_CREATE = 'project-management:create';
export const PROJECT_MANAGEMENT_UPDATE = 'project-management:update';
export const PROJECT_MANAGEMENT_DELETE = 'project-management:delete';
export const PROJECT_MANAGEMENT_RESTORE = 'project-management:restore';
export const PROJECT_MANAGEMENT_PURGE = 'project-management:purge';
export const PROJECT_MANAGEMENT_GET = 'project-management:get';
export const PROJECT_MANAGEMENT_GET_LIST = 'project-management:get-list';
export const PROJECT_MANAGEMENT_DELETE_BY_QUERY = 'project-management:delete-by-query';
export const PROJECT_MANAGEMENT_RESTORE_BY_QUERY = 'project-management:restore-by-query';
export const PROJECT_MANAGEMENT_PURGE_BY_QUERY = 'project-management:purge-by-query';
export const PROJECT_MANAGEMENT_MOVE = 'project-management:move';
export const PROJECT_MANAGEMENT_RECODE = 'project-management:recode';
export const PROJECT_MANAGEMENT_RENAME_GROUP = 'project-management:rename-group';
export const PROJECT_MANAGEMENT_COUNT_IN_GROUPS = 'project-management:count-in-groups';
export const PROJECT_MANAGEMENT_GET_SUMMARY = 'project-management:get-summary';
export const PROJECT_MANAGEMENT_IMPORT_CSV = 'project-management:import-csv';
export const PROJECT_MANAGEMENT_EXPORT_CSV = 'project-management:export-csv';

// ─── 资源库 CRUD ─────────────────────────────────────────────────
export const LIBRARY_CREATE     = 'library:create';
export const LIBRARY_GET_ALL    = 'library:get-all';
export const LIBRARY_DELETE     = 'library:delete';
export const LIBRARY_GET_TAGS   = 'library:get-tags';
export const LIBRARY_GET_TAG_GROUPS = 'library:get-tag-groups';
export const LIBRARY_CREATE_TAG = 'library:create-tag';
export const LIBRARY_CREATE_TAG_GROUP = 'library:create-tag-group';
export const LIBRARY_CREATE_SOFTWARE_PROJECT = 'library:create-software-project';
export const LIBRARY_GET_SOFTWARE_PROJECTS = 'library:get-software-projects';
export const LIBRARY_GET_CONTRACT_FORM_SCHEMA = 'library:get-contract-form-schema';
export const LIBRARY_SAVE_CONTRACT_FORM_SCHEMA = 'library:save-contract-form-schema';
export const LIBRARY_EXPORT_CONTRACT_FORM_SCHEMA = 'library:export-contract-form-schema';
export const LIBRARY_IMPORT_CONTRACT_FORM_SCHEMA = 'library:import-contract-form-schema';
export const LIBRARY_CREATE_CONTRACT_INFO = 'library:create-contract-info';
export const LIBRARY_GET_CONTRACT_INFOS = 'library:get-contract-infos';
export const LIBRARY_QUERY_CONTRACT_INFOS = 'library:query-contract-infos';
export const LIBRARY_GET_CONTRACT_SUMMARY_STATS = 'library:get-contract-summary-stats';
export const LIBRARY_EXECUTE_CONTRACT_STATISTICS = 'library:execute-contract-statistics';
export const LIBRARY_GET_SIDEBAR_STATS = 'library:get-sidebar-stats';
export const LIBRARY_GET_CONTRACT_INFO = 'library:get-contract-info';
export const LIBRARY_UPDATE_CONTRACT_INFO = 'library:update-contract-info';
export const LIBRARY_DELETE_CONTRACT_INFO = 'library:delete-contract-info';
export const LIBRARY_DELETE_CONTRACT_INFOS = 'library:delete-contract-infos';
export const LIBRARY_RESTORE_CONTRACT_INFO = 'library:restore-contract-info';
export const LIBRARY_RESTORE_CONTRACT_INFOS = 'library:restore-contract-infos';
export const LIBRARY_PURGE_CONTRACT_INFO = 'library:purge-contract-info';
export const LIBRARY_PURGE_CONTRACT_INFOS = 'library:purge-contract-infos';
export const LIBRARY_MOVE_CONTRACT_INFO = 'library:move-contract-info';
export const LIBRARY_GET_CALENDAR_EVENTS = 'library:calendar-events:get';
export const LIBRARY_REBUILD_CALENDAR_EVENTS = 'library:calendar-events:rebuild';
export const LIBRARY_CREATE_MANUAL_CALENDAR_REMINDER = 'library:calendar-events:create-manual-reminder';
export const LIBRARY_UI_GET_FOLDER_COLOR_MAP = 'library:ui:get-folder-color-map';
export const LIBRARY_UI_SET_FOLDER_COLOR_MAP = 'library:ui:set-folder-color-map';
export const CONTRACT_UPLOAD = 'contract:upload';

export const CONTRACT_FILES_GET_LIST = 'contract-files:get-list';
export const CONTRACT_FILES_GET_TRASH_LIST = 'contract-files:get-trash-list';
export const CONTRACT_FILES_GET_ALL_LIST = 'contract-files:get-all-list';
export const CONTRACT_FILES_GET_ALL_LIST_PAGED = 'contract-files:get-all-list-paged';
export const CONTRACT_FILES_UPSERT_FROM_PATHS = 'contract-files:upsert-from-paths';
export const CONTRACT_FILES_DELETE = 'contract-files:delete';
export const CONTRACT_FILES_RESTORE = 'contract-files:restore';
export const CONTRACT_FILES_PURGE = 'contract-files:purge';
export const CONTRACT_FILES_COPY = 'contract-files:copy';
export const CONTRACT_FILES_MOVE = 'contract-files:move';
export const CONTRACT_FILES_CREATE_FOLDER = 'contract-files:create-folder';
export const CONTRACT_FILES_RENAME = 'contract-files:rename';
export const CONTRACT_FILES_UPDATE_THUMBNAIL = 'contract-files:update-thumbnail';
export const CONTRACT_FILES_SAVE_THUMBNAIL_FILE = 'contract-files:save-thumbnail-file';
export const CONTRACT_FILES_START_DRAG_OUT = 'contract-files:start-drag-out';

export const OTHER_FILES_GET_LIST = 'other-files:get-list';
export const OTHER_FILES_GET_TRASH_LIST = 'other-files:get-trash-list';
export const OTHER_FILES_UPSERT_FROM_PATHS = 'other-files:upsert-from-paths';
export const OTHER_FILES_DELETE = 'other-files:delete';
export const OTHER_FILES_RESTORE = 'other-files:restore';
export const OTHER_FILES_PURGE = 'other-files:purge';
export const OTHER_FILES_COPY = 'other-files:copy';
export const OTHER_FILES_MOVE = 'other-files:move';
export const OTHER_FILES_CREATE_FOLDER = 'other-files:create-folder';
export const OTHER_FILES_RENAME = 'other-files:rename';
export const OTHER_FILES_UPDATE_THUMBNAIL = 'other-files:update-thumbnail';
export const OTHER_FILES_SAVE_THUMBNAIL_FILE = 'other-files:save-thumbnail-file';
export const OTHER_FILES_START_DRAG_OUT = 'other-files:start-drag-out';

// ─── 供应商管理 ──────────────────────────────────────────────────
export const SUPPLIER_CREATE    = 'supplier:create';
export const SUPPLIER_UPDATE    = 'supplier:update';
export const SUPPLIER_DELETE    = 'supplier:delete';
export const SUPPLIER_RESTORE   = 'supplier:restore';
export const SUPPLIER_PURGE     = 'supplier:purge';
export const SUPPLIER_GET       = 'supplier:get';
export const SUPPLIER_GET_LIST  = 'supplier:get-list';

// ─── 客户管理 ──────────────────────────────────────────────────
export const CUSTOMER_CREATE    = 'customer:create';
export const CUSTOMER_UPDATE    = 'customer:update';
export const CUSTOMER_DELETE    = 'customer:delete';
export const CUSTOMER_RESTORE   = 'customer:restore';
export const CUSTOMER_PURGE     = 'customer:purge';
export const CUSTOMER_GET       = 'customer:get';
export const CUSTOMER_GET_LIST  = 'customer:get-list';

// ─── 部门管理 ──────────────────────────────────────────────────
export const DEPARTMENT_CREATE    = 'department:create';
export const DEPARTMENT_UPDATE    = 'department:update';
export const DEPARTMENT_DELETE    = 'department:delete';
export const DEPARTMENT_RESTORE   = 'department:restore';
export const DEPARTMENT_PURGE     = 'department:purge';
export const DEPARTMENT_GET       = 'department:get';
export const DEPARTMENT_GET_LIST  = 'department:get-list';

// ─── 人员管理 ──────────────────────────────────────────────────
export const PERSONNEL_CREATE    = 'personnel:create';
export const PERSONNEL_UPDATE    = 'personnel:update';
export const PERSONNEL_DELETE    = 'personnel:delete';
export const PERSONNEL_RESTORE   = 'personnel:restore';
export const PERSONNEL_PURGE     = 'personnel:purge';
export const PERSONNEL_GET       = 'personnel:get';
export const PERSONNEL_GET_LIST  = 'personnel:get-list';
export const PERSONNEL_UPDATE_SORT = 'personnel:update-sort';
export const PERSONNEL_PARSE_RESUME = 'personnel:parse-resume';
export const PERSONNEL_SCAN_RESUME_FOLDER = 'personnel:scan-resume-folder';
export const PERSONNEL_BATCH_IMPORT_RESUMES = 'personnel:batch-import-resumes';
export const PERSONNEL_ADD_DOCUMENTS = 'personnel:add-documents';
export const PERSONNEL_LIST_DOCUMENTS = 'personnel:list-documents';
export const PERSONNEL_UPDATE_DOCUMENT = 'personnel:update-document';
export const PERSONNEL_DELETE_DOCUMENT = 'personnel:delete-document';
export const PERSONNEL_APPLY_DOCUMENT_DRAFT = 'personnel:apply-document-draft';
export const PERSONNEL_REJECT_DOCUMENT_DRAFT = 'personnel:reject-document-draft';

// ─── 单位证件 ──────────────────────────────────────────────────
export const UNIT_DOCUMENT_ADD = 'unit-document:add';
export const UNIT_DOCUMENT_LIST = 'unit-document:list';
export const UNIT_DOCUMENT_UPDATE = 'unit-document:update';
export const UNIT_DOCUMENT_DELETE = 'unit-document:delete';
export const UNIT_DOCUMENT_APPLY_DRAFT = 'unit-document:apply-draft';
export const UNIT_DOCUMENT_REJECT_DRAFT = 'unit-document:reject-draft';

export const CONTRACT_PRODUCT_CREATE   = 'contract-product:create';
export const CONTRACT_PRODUCT_UPDATE   = 'contract-product:update';
export const CONTRACT_PRODUCT_DELETE   = 'contract-product:delete';
export const CONTRACT_PRODUCT_RESTORE  = 'contract-product:restore';
export const CONTRACT_PRODUCT_PURGE    = 'contract-product:purge';
export const CONTRACT_PRODUCT_GET      = 'contract-product:get';
export const CONTRACT_PRODUCT_GET_LIST = 'contract-product:get-list';

export const CONTRACT_EXECUTION_CREATE   = 'contract-execution:create';
export const CONTRACT_EXECUTION_UPDATE   = 'contract-execution:update';
export const CONTRACT_EXECUTION_DELETE   = 'contract-execution:delete';
export const CONTRACT_EXECUTION_RESTORE  = 'contract-execution:restore';
export const CONTRACT_EXECUTION_PURGE    = 'contract-execution:purge';
export const CONTRACT_EXECUTION_GET      = 'contract-execution:get';
export const CONTRACT_EXECUTION_GET_LIST = 'contract-execution:get-list';

export const CONTRACT_INVOICE_CREATE   = 'contract-invoice:create';
export const CONTRACT_INVOICE_UPDATE   = 'contract-invoice:update';
export const CONTRACT_INVOICE_DELETE   = 'contract-invoice:delete';
export const CONTRACT_INVOICE_RESTORE  = 'contract-invoice:restore';
export const CONTRACT_INVOICE_PURGE    = 'contract-invoice:purge';
export const CONTRACT_INVOICE_GET      = 'contract-invoice:get';
export const CONTRACT_INVOICE_GET_LIST = 'contract-invoice:get-list';
export const CONTRACT_INVOICE_BATCH_DELETE  = 'contract-invoice:batch-delete';
export const CONTRACT_INVOICE_BATCH_RESTORE = 'contract-invoice:batch-restore';
export const CONTRACT_INVOICE_BATCH_PURGE   = 'contract-invoice:batch-purge';

// ─── 字典管理 ──────────────────────────────────────────────────
export const DICTIONARY_CREATE    = 'dictionary:create';
export const DICTIONARY_UPDATE    = 'dictionary:update';
export const DICTIONARY_DELETE    = 'dictionary:delete';
export const DICTIONARY_RESTORE   = 'dictionary:restore';
export const DICTIONARY_PURGE     = 'dictionary:purge';
export const DICTIONARY_GET       = 'dictionary:get';
export const DICTIONARY_GET_LIST  = 'dictionary:get-list';
export const DICTIONARY_IMPORT_CSV = 'dictionary:importCsv';
export const DICTIONARY_IMPORT_PROGRESS = 'dictionary:import-progress';
export const DICTIONARY_RENAME_GROUP = 'dictionary:rename-group';
export const DICTIONARY_CLEAR_GROUPS = 'dictionary:clear-groups';
export const DICTIONARY_EXPORT_CSV = 'dictionary:export-csv';
export const DICTIONARY_COUNT_IN_GROUPS = 'dictionary:count-in-groups';
export const DICTIONARY_MOVE_TO_GROUP = 'dictionary:move-to-group';
export const DICTIONARY_MOVE_TO_TOP = 'dictionary:move-to-top';
export const DICTIONARY_MOVE_TO_BOTTOM = 'dictionary:move-to-bottom';
export const DICTIONARY_EXPORT_GROUP_BUNDLE = 'dictionary:export-group-bundle';
export const DICTIONARY_IMPORT_GROUP_BUNDLE = 'dictionary:import-group-bundle';

// ─── 树形字典管理 ────────────────────────────────────────────────
export const TREE_DICTIONARY_CREATE    = 'tree-dictionary:create';
export const TREE_DICTIONARY_UPDATE    = 'tree-dictionary:update';
export const TREE_DICTIONARY_DELETE    = 'tree-dictionary:delete';
export const TREE_DICTIONARY_RESTORE   = 'tree-dictionary:restore';
export const TREE_DICTIONARY_PURGE     = 'tree-dictionary:purge';
export const TREE_DICTIONARY_GET       = 'tree-dictionary:get';
export const TREE_DICTIONARY_GET_LIST  = 'tree-dictionary:get-list';
export const TREE_DICTIONARY_IMPORT_CSV = 'tree-dictionary:importCsv';
export const TREE_DICTIONARY_IMPORT_PROGRESS = 'tree-dictionary:import-progress';
export const TREE_DICTIONARY_RENAME_GROUP = 'tree-dictionary:rename-group';
export const TREE_DICTIONARY_CLEAR_GROUPS = 'tree-dictionary:clear-groups';
export const TREE_DICTIONARY_UPDATE_SORT = 'tree-dictionary:update-sort';

// ─── 文档 CRUD ───────────────────────────────────────────────────
export const DOC_INSERT         = 'doc:insert';
export const DOC_UPDATE         = 'doc:update';
export const DOC_DELETE         = 'doc:delete';
export const DOC_GET_BY_PROJECT = 'doc:get-by-project';

// ─── 流程节点 ────────────────────────────────────────────────────
export const WORKFLOW_INIT      = 'workflow:init-default';
export const WORKFLOW_GET       = 'workflow:get-by-project';
export const WORKFLOW_UPDATE    = 'workflow:update-node';

// ─── 提醒 ────────────────────────────────────────────────────────
export const REMINDER_CREATE    = 'reminder:create';
export const REMINDER_UPDATE    = 'reminder:update';
export const REMINDER_DELETE    = 'reminder:delete';
export const REMINDER_GET       = 'reminder:get';
export const REMINDER_MARK_READ = 'reminder:mark-read';

// ─── 文件系统操作 ────────────────────────────────────────────────
export const FS_COPY_FILES      = 'fs:copy-files';
export const FS_OPEN_FILE       = 'fs:open-file';
export const FS_OPEN_FOLDER     = 'fs:open-folder';
export const FS_GET_FILE_INFO   = 'fs:get-file-info';
export const FS_DELETE_FILE     = 'fs:delete-file';
export const FS_LIST_DIR        = 'fs:list-dir';
export const FS_CREATE_FOLDER     = 'fs:create-folder';
export const FS_SELECT_FILE       = 'fs:select-file';
export const FS_SAVE_FILE         = 'fs:save-file';
export const FS_WRITE_FILE        = 'fs:write-file';
export const FS_READ_FILE_BYTES   = 'fs:read-file-bytes';
export const FS_READ_FILE_TEXT    = 'fs:read-file-text';
export const FS_WRITE_FILE_BYTES  = 'fs:write-file-bytes';
export const FS_COPY_PROGRESS     = 'fs:copy-progress';
export const CLIPBOARD_WRITE_FILE = 'clipboard:write-file';
export const CLIPBOARD_WRITE_IMAGE_BYTES = 'clipboard:write-image-bytes';

// ─── AI 操作 ─────────────────────────────────────────────────────
export const AI_EXTRACT_CONTRACT = 'ai:extract-contract';
export const AI_GET_EXTRACTION_EVIDENCE = 'ai:get-extraction-evidence';
export const AI_GENERATE_STRUCTURED = 'ai:generate-structured';
export const AI_TEST_CONNECTION  = 'ai:test-connection';
export const AI_VALIDATE_LOCAL_MODEL = 'ai:validate-local-model';
export const AI_PROMOTE_CONTRACT_VECTORS = 'ai:promote-contract-vectors';
export const AI_AGENT_CREATE_SESSION = 'ai-agent:create-session';
export const AI_AGENT_LIST_SESSIONS = 'ai-agent:list-sessions';
export const AI_AGENT_GET_SESSION = 'ai-agent:get-session';
export const AI_AGENT_RENAME_SESSION = 'ai-agent:rename-session';
export const AI_AGENT_SEND_MESSAGE = 'ai-agent:send-message';
export const AI_AGENT_DELETE_SESSION = 'ai-agent:delete-session';

// ─── 文件转换 ─────────────────────────────────────────────────────
export const FILE_CONVERT_TO_MD = 'file:convert-to-md';
export const FILE_OCR_CHECK_STATUS = 'file:ocr-check-status';
export const FILE_OCR_TEST = 'file:ocr-test';
export const FILE_PDF_SEARCH_HIGHLIGHTS = 'file:pdf-search-highlights';

// ─── 工具箱 ───────────────────────────────────────────────────────
export const TOOLBOX_SCAN_IMAGE_FOLDER = 'toolbox:scan-image-folder';
export const TOOLBOX_SCAN_OCR_IMAGE_FOLDER = 'toolbox:scan-ocr-image-folder';
export const TOOLBOX_BATCH_IMAGE_OCR = 'toolbox:batch-image-ocr';
export const TOOLBOX_EXPORT_IMAGE_OCR_DOCX = 'toolbox:export-image-ocr-docx';
export const TOOLBOX_CREATE_IMAGE_PDF = 'toolbox:create-image-pdf';
export const TOOLBOX_PROCESS_SIGNATURE_IMAGE = 'toolbox:process-signature-image';
export const TOOLBOX_PROCESS_SEAL_IMAGE = 'toolbox:process-seal-image';
export const TOOLBOX_INSPECT_PDF_FILES = 'toolbox:inspect-pdf-files';
export const TOOLBOX_MERGE_PDF_FILES = 'toolbox:merge-pdf-files';
export const TOOLBOX_SPLIT_PDF_FILES = 'toolbox:split-pdf-files';
export const TOOLBOX_ESTIMATE_PDF_COMPRESSION = 'toolbox:estimate-pdf-compression';
export const TOOLBOX_COMPRESS_PDF_FILE = 'toolbox:compress-pdf-file';
export const TOOLBOX_PDF_COMPRESSION_PROGRESS = 'toolbox:pdf-compression-progress';
export const TOOLBOX_BATCH_STAMP_PDF_FILES = 'toolbox:batch-stamp-pdf-files';

// ─── 发票解析 ─────────────────────────────────────────────────────
export const INVOICE_DETECT_FROM_MD = 'invoice:detect-from-md';
export const INVOICE_PARSE_FROM_MD = 'invoice:parse-from-md';

// ─── 导入任务 ─────────────────────────────────────────────────────
export const IMPORT_TASK_START = 'import-task:start';
export const IMPORT_TASK_GET_STATUS = 'import-task:get-status';
export const IMPORT_TASK_CANCEL = 'import-task:cancel';

/** 主进程 → 渲染进程：导入任务进度 */
export const IMPORT_TASK_PROGRESS = 'import-task:progress';

// ─── 快捷键 ──────────────────────────────────────────────────────
export const SHORTCUT_REGISTER        = 'shortcut:register';
export const SHORTCUT_UNREGISTER      = 'shortcut:unregister';
export const SHORTCUT_UNREGISTER_ALL  = 'shortcut:unregister-all';
export const SHORTCUT_IS_REGISTERED   = 'shortcut:is-registered';

/** 主进程 → 渲染进程：快捷键被触发 */
export const SHORTCUT_TRIGGERED       = 'shortcut:triggered';

// ─── 智能文件拷贝 ────────────────────────────────────────────────
export const FILE_COPY_START         = 'file-copy:start';
export const FILE_COPY_EXPAND_SOURCES = 'file-copy:expand-sources';
export const FILE_COPY_CANCEL        = 'file-copy:cancel';
export const FILE_COPY_ACTIVE_TASKS  = 'file-copy:active-tasks';
export const FILE_COPY_CONFLICT_DECIDE = 'file-copy:conflict-decide';

/** 主进程 → 渲染进程：文件拷贝进度 */
export const FILE_COPY_STARTED       = 'file-copy:started';
export const FILE_COPY_PROGRESS      = 'file-copy:progress';
export const FILE_COPY_FILE_COMPLETED = 'file-copy:file-completed';
export const FILE_COPY_FILE_FAILED    = 'file-copy:file-failed';
export const FILE_COPY_COMPLETED     = 'file-copy:completed';
export const FILE_COPY_CANCELLED     = 'file-copy:cancelled';
export const FILE_COPY_CONFLICT      = 'file-copy:conflict';

// ─── 全文本搜索 ──────────────────────────────────────────────────
export const SEARCH_FULL_TEXT      = 'search:full-text';
export const SEARCH_FULL_TEXT_IN_PATH = 'search:full-text-in-path';
export const SEARCH_REINDEX        = 'search:reindex';
export const SEARCH_INDEX_STATUS   = 'search:index-status';
export const WEB_FIND_IN_PAGE = 'web:find-in-page';
export const WEB_STOP_FIND_IN_PAGE = 'web:stop-find-in-page';
export const WEB_FOUND_IN_PAGE = 'web:found-in-page';

// ─── 合同批量导入 ──────────────────────────────────────────────────
export const CONTRACT_SCAN_FOLDER = 'contract:scan-folder';

// ─── 全局配置 Config ─────────────────────────────────────────────
export const CONFIG_GET_ALL     = 'config:get-all';
export const CONFIG_GET_ITEM    = 'config:get-item';
export const CONFIG_SAVE        = 'config:save';
export const CONFIG_UPDATE_ITEM = 'config:update-item';
export const CONFIG_GET_DEFAULT = 'config:get-default';
export const CONFIG_CHANGED     = 'config:changed';

// ─── 数据备份 ─────────────────────────────────────────────────────
export const BACKUP_CREATE      = 'backup:create';
export const BACKUP_LIST        = 'backup:list';
export const BACKUP_RESTORE     = 'backup:restore';

// ─── 应用信息 ─────────────────────────────────────────────────────
export const APP_GET_INFO = 'app:get-info';
export const APP_GET_AUTO_START = 'app:get-auto-start';
export const APP_SET_AUTO_START = 'app:set-auto-start';

// ─── 关闭保护 ─────────────────────────────────────────────────────
export const CLOSE_GUARD_CHECK      = 'close-guard:check';
export const CLOSE_GUARD_FORCE_CLOSE = 'close-guard:force-close';
export const CLOSE_GUARD_CANCEL     = 'close-guard:cancel';

// ─── 任务监控 ─────────────────────────────────────────────────────
export const TASK_MONITOR_GET_ACTIVE   = 'task-monitor:get-active';
export const TASK_MONITOR_REGISTER     = 'task-monitor:register';
export const TASK_MONITOR_UPDATE       = 'task-monitor:update';
export const TASK_MONITOR_COMPLETE     = 'task-monitor:complete';
export const TASK_MONITOR_FAIL         = 'task-monitor:fail';
export const TASK_MONITOR_CANCEL       = 'task-monitor:cancel';
export const TASK_MONITOR_UNREGISTER   = 'task-monitor:unregister';
export const TASK_MONITOR_ACTIVE_CHANGED = 'task-monitor:active-changed';

export const LOG_WRITE          = 'log:write';
export const LOG_GET_SETTINGS   = 'log:get-settings';
export const LOG_SAVE_SETTINGS  = 'log:save-settings';
export const LOG_OPEN_FOLDER    = 'log:open-folder';

// ─── 允许渲染进程订阅的单向事件白名单 ─────────────────────────────
export const ALLOWED_LISTEN_CHANNELS: string[] = [
  WIN_MAXIMIZE_CHANGED,
  WIN_FULLSCREEN_CHANGED,
  FS_COPY_PROGRESS,
  SHORTCUT_TRIGGERED,
  DICTIONARY_IMPORT_PROGRESS,
  TREE_DICTIONARY_IMPORT_PROGRESS,
  FILE_COPY_STARTED,
  FILE_COPY_PROGRESS,
  FILE_COPY_FILE_COMPLETED,
  FILE_COPY_FILE_FAILED,
  FILE_COPY_COMPLETED,
  FILE_COPY_CANCELLED,
  FILE_COPY_CONFLICT,
  IMPORT_TASK_PROGRESS,
  CONFIG_CHANGED,
  TASK_MONITOR_ACTIVE_CHANGED,
  TOOLBOX_PDF_COMPRESSION_PROGRESS,
  'close-guard:show-confirm',
  WEB_FOUND_IN_PAGE,
];
