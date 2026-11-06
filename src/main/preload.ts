import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import * as crypto from 'crypto';
import * as os from 'os';
import * as channels from '../main/ipc/channels';
import {
  SoftwareCopyrightCreateDTO,
  SoftwareCopyrightCreateResult,
  SoftwareCopyrightProject,
} from '../shared/types/softwareCopyright.types';
import {
  ContractInfoCreateDTO,
  ContractInfoCreateResult,
  ContractInfoEntity,
  ContractInfoBatchDeleteDTO,
  ContractInfoDeleteDTO,
  ContractInfoRestoreDTO,
  ContractInfoBatchRestoreDTO,
  ContractInfoPurgeDTO,
  ContractInfoBatchPurgeDTO,
  ContractInfoGetDTO,
  ContractInfoMoveDTO,
  ContractInfoQueryDTO,
  ContractInfoQueryResult,
  ContractInfoSummaryStatsDTO,
  ContractInfoSummaryStatsResult,
  ContractInfoUpdateDTO,
} from '../shared/types/contractInfo.types';
import {
  ContractFormSchemaConfig,
  ContractFormSchemaExportDTO,
  ContractFormSchemaExportResult,
  ContractFormSchemaGetDTO,
  ContractFormSchemaImportDTO,
  ContractFormSchemaSaveDTO,
} from '../shared/types/contractFormSchema.types';
import {
  AIContractExtractionEvidenceResult,
  AIContractExtractionResult,
  AIExtractContractInfoRequest,
  AILocalModelValidationRequest,
  AILocalModelValidationResult,
  AIStructuredGenerateRequest,
  AIStructuredGenerateResult,
  AITestConnectionRequest,
  AITestConnectionResult,
} from '../shared/types/ai.types';
import type {
  AIAgentCreateSessionRequest,
  AIAgentCreateSessionResult,
  AIAgentDeleteSessionRequest,
  AIAgentGetSessionRequest,
  AIAgentRenameSessionRequest,
  AIAgentRenameSessionResult,
  AIAgentSendMessageRequest,
  AIAgentSendMessageResult,
  AIAgentSession,
  AIAgentSessionSummary,
} from '../shared/types/aiAgent.types';
import type {
  ContractStatisticsAIPlan,
  ContractStatisticsExecutionResult,
} from '../shared/types/contractStatistics.types';
import {
  LoggingSettings,
  LogWritePayload,
} from '../shared/types/log.types';
import type { AppInfoData, IpcResponse } from '../shared/types/ipc.types';
import type { GlobalConfig } from '../shared/types/config.types';
import type {
  FileConversionResult,
  PdfTextSearchHighlightResult,
} from '../shared/types/fileConversion.types';
import type {
  BatchImageOcrRequest,
  BatchImageOcrResult,
  BatchStampPdfFilesRequest,
  BatchStampPdfFilesResult,
  CompressPdfFileRequest,
  CompressPdfFileResult,
  CreateImagePdfRequest,
  CreateImagePdfResult,
  EstimatePdfCompressionRequest,
  EstimatePdfCompressionResult,
  ExportImageOcrDocxRequest,
  ExportImageOcrDocxResult,
  InspectPdfFilesRequest,
  InspectPdfFilesResult,
  MergePdfFilesRequest,
  PdfCompressionProgressPayload,
  MergePdfFilesResult,
  ProcessSignatureImageRequest,
  ProcessSignatureImageResult,
  ProcessSealImageRequest,
  ProcessSealImageResult,
  ScanOcrImageFolderRequest,
  ScanOcrImageFolderResult,
  SplitPdfFilesRequest,
  SplitPdfFilesResult,
  ScanImageFolderRequest,
  ScanImageFolderResult,
} from '../shared/types/toolbox.types';
import {
  ContractProduct,
  ContractProductCreateDTO,
  ContractProductQueryDTO,
  ContractProductQueryResult,
  ContractProductUpdateDTO,
} from '../shared/types/contractProduct.types';
import {
  ContractExecution,
  ContractExecutionCreateDTO,
  ContractExecutionQueryDTO,
  ContractExecutionQueryResult,
  ContractExecutionUpdateDTO,
} from '../shared/types/contractExecution.types';
import type {
  ContractInvoice,
  ContractInvoiceCreateDTO,
  ContractInvoiceQueryDTO,
  ContractInvoiceQueryResult,
  ContractInvoiceUpdateDTO,
} from '../shared/types/contractInvoice.types';
import {
  ContractFileCopyDTO,
  ContractFileCreateFolderDTO,
  ContractFileDeleteDTO,
  ContractFileAllListDTO,
  ContractFileAllListPagedDTO,
  ContractFileListDTO,
  ContractFileMoveDTO,
  ContractFileMoveResult,
  ContractFileTrashListDTO,
  ContractFilePurgeDTO,
  ContractFileRenameDTO,
  ContractFileRestoreDTO,
  ContractFileRestoreResult,
  ContractFileStartDragOutDTO,
  ContractFileStartDragOutResult,
  ContractFileUpsertFromPathsDTO,
  ContractFileUpdateThumbnailDTO,
  ContractFileSaveThumbnailFileDTO,
} from '../shared/types/contractFile.types';
import {
  OtherFileCopyDTO,
  OtherFileCreateFolderDTO,
  OtherFileDeleteDTO,
  OtherFileListDTO,
  OtherFileMoveDTO,
  OtherFileMoveResult,
  OtherFileTrashListDTO,
  OtherFilePurgeDTO,
  OtherFileRenameDTO,
  OtherFileRestoreDTO,
  OtherFileRestoreResult,
  OtherFileStartDragOutDTO,
  OtherFileStartDragOutResult,
  OtherFileUpsertFromPathsDTO,
  OtherFileUpdateThumbnailDTO,
  OtherFileSaveThumbnailFileDTO,
} from '../shared/types/otherFile.types';
import {
  TaskInfo,
  RegisterTaskInput,
} from '../shared/types/taskMonitor.types';
import type { BackupInfo, CreateBackupResult, RestoreBackupResult } from '../shared/types/backup.types';
import type {
  LibraryCalendarEventEntity,
  LibraryCalendarEventQueryDTO,
  LibraryCalendarEventRebuildDTO,
  LibraryCalendarManualReminderCreateDTO,
} from '../shared/types/libraryCalendarEvent.types';
import type {
  PersonnelDocument,
  PersonnelDocumentApplyDraftDTO,
  PersonnelDocumentCreateRequest,
  PersonnelDocumentCreateResult,
  PersonnelDocumentUpdateDTO,
  PersonnelBatchImportRequest,
  PersonnelBatchImportResult,
  PersonnelBatchResumeScanResult,
  PersonnelResumeParseRequest,
  PersonnelResumeParseResult,
} from '../shared/types/personnel.types';
import type {
  UnitDocument,
  UnitDocumentApplyDraftDTO,
  UnitDocumentCreateRequest,
  UnitDocumentCreateResult,
  UnitDocumentOwnerType,
  UnitDocumentUpdateDTO,
} from '../shared/types/unitDocument.types';
import type {
  FolderColorMapGetDTO,
  FolderColorMapResult,
  FolderColorMapSetDTO,
} from '../shared/types/folderColor.types'

/**
 * 预加载脚本
 *
 * 安全原则：
 * - 仅通过 contextBridge 暴露有限、明确的 API，不暴露 ipcRenderer 本身
 * - 所有监听事件的 channel 必须在 ALLOWED_LISTEN_CHANNELS 白名单中
 * - 移除监听器时只允许移除本 preload 注册的 listener，不暴露全量清除接口
 */

// ─── 工具函数 ──────────────────────────────────────────────────────

/** 封装 invoke，加入 channel 类型安全 */
function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

/** 安全的单向事件监听（仅限白名单 channel） */
function listenSafe(channel: string, callback: (payload: unknown) => void): () => void {
  if (!channels.ALLOWED_LISTEN_CHANNELS.includes(channel)) {
    throw new Error(`[Preload] 不允许监听 channel: ${channel}`);
  }
  const listener = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
  ipcRenderer.on(channel, listener);
  // 返回取消监听函数，让调用方自主管理
  return () => ipcRenderer.removeListener(channel, listener);
}

function toPemPublicKey(publicKeyBase64: string): string {
  const body = publicKeyBase64.replace(/\s+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.slice(i, i + 64));
  }
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
}

function rsaEncryptBase64(publicKeyBase64: string, plaintext: string): string {
  const pem = toPemPublicKey(publicKeyBase64);
  const keyObject = crypto.createPublicKey(pem);
  const modulusLength = (keyObject.asymmetricKeyDetails && 'modulusLength' in keyObject.asymmetricKeyDetails)
    ? (keyObject.asymmetricKeyDetails as { modulusLength: number }).modulusLength
    : 1024;
  const maxChunkSize = Math.max(1, Math.floor(modulusLength / 8) - 11);
  const encoded = encodeURIComponent(plaintext);
  const input = Buffer.from(encoded, 'utf8');
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < input.length; offset += maxChunkSize) {
    const slice = input.subarray(offset, offset + maxChunkSize);
    const encrypted = crypto.publicEncrypt(
      { key: keyObject, padding: crypto.constants.RSA_PKCS1_PADDING },
      slice
    );
    chunks.push(encrypted);
  }
  return Buffer.concat(chunks).toString('base64');
}

type DeviceIdentity = {
  deviceId: string;
  deviceName: string;
  primaryMac: string;
  macAddresses: string[];
  fingerprintSource: 'mac' | 'host';
  platform: string;
  arch: string;
};

function normalizeMacAddress(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^0-9a-fA-F]/g, '')
    .toUpperCase()
    .match(/.{1,2}/g)?.join(':') || '';
}

function getDeviceIdentity(): DeviceIdentity {
  const networks = os.networkInterfaces();
  const macSet = new Set<string>();
  Object.values(networks).forEach((items) => {
    (items || []).forEach((item) => {
      if (!item || item.internal) return;
      const normalized = normalizeMacAddress(item.mac || '');
      if (!normalized || normalized === '00:00:00:00:00:00') return;
      macSet.add(normalized);
    });
  });

  const macAddresses = Array.from(macSet).sort();
  const deviceName = os.hostname();
  const fingerprintSource: DeviceIdentity['fingerprintSource'] = macAddresses.length > 0 ? 'mac' : 'host';
  const rawFingerprint = macAddresses.length > 0
    ? macAddresses.join('|')
    : [deviceName, os.platform(), os.arch()].join('|');
  const deviceId = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

  return {
    deviceId,
    deviceName,
    primaryMac: macAddresses[0] || '',
    macAddresses,
    fingerprintSource,
    platform: os.platform(),
    arch: os.arch(),
  };
}

// ─── 暴露给渲染进程的 API ──────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {

  // ── 窗口控制 ────────────────────────────────────────────────────
  window: {
    minimize:       () => invoke<IpcResponse>(channels.WIN_MINIMIZE),
    toggleMaximize: () => invoke<IpcResponse>(channels.WIN_TOGGLE_MAXIMIZE),
    close:          () => invoke<IpcResponse>(channels.WIN_CLOSE),
    isMaximized:    () => invoke<IpcResponse<boolean>>(channels.WIN_IS_MAXIMIZED),
    toggleFullscreen: () => invoke<IpcResponse<{ isFullscreen: boolean }>>(channels.WIN_TOGGLE_FULLSCREEN),
    isFullscreen:   () => invoke<IpcResponse<boolean>>(channels.WIN_IS_FULLSCREEN),
    /** 订阅最大化状态变化，返回取消订阅函数 */
    onMaximizeChanged: (callback: (isMaximized: boolean) => void) =>
      listenSafe(channels.WIN_MAXIMIZE_CHANGED, payload => callback(payload as boolean)),
    /** 订阅全屏状态变化，返回取消订阅函数 */
    onFullscreenChanged: (callback: (isFullscreen: boolean) => void) =>
      listenSafe(channels.WIN_FULLSCREEN_CHANGED, payload => callback(payload as boolean)),
  },

  webContents: {
    findInPage: (payload: { text: string; options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean } }) =>
      invoke<IpcResponse<{ requestId: number }>>(channels.WEB_FIND_IN_PAGE, payload),
    stopFindInPage: (payload: { action?: 'clearSelection' | 'keepSelection' | 'activateSelection' }) =>
      invoke<IpcResponse>(channels.WEB_STOP_FIND_IN_PAGE, payload),
    onFoundInPage: (callback: (payload: unknown) => void) => listenSafe(channels.WEB_FOUND_IN_PAGE, callback),
  },

  crypto: {
    rsaEncryptBase64,
  },

  device: {
    getIdentity: getDeviceIdentity,
  },

  // ── 初始化 / Bootstrap ──────────────────────────────────────────
  bootstrap: {
    getInitStatus:       () => invoke(channels.BOOT_GET_INIT_STATUS),
    selectFolder:        () => invoke(channels.BOOT_SELECT_FOLDER),
    initProject:         (projectName: string, basePath: string) =>
                           invoke(channels.BOOT_INIT_PROJECT, projectName, basePath),
    validateLibraryPath: (path: string) => invoke(channels.BOOT_VALIDATE_PATH, path),
    loadExistingLibrary: (path: string) => invoke(channels.BOOT_LOAD_LIBRARY, path),
  },

  // ── 数据库 Settings CRUD ────────────────────────────────────────
  db: {
    insertSetting:  (key: string, value: string, description?: string) =>
                      invoke(channels.DB_INSERT_SETTING, key, value, description),
    updateSetting:  (key: string, value: string, description?: string) =>
                      invoke(channels.DB_UPDATE_SETTING, key, value, description),
    deleteSetting:  (key: string) => invoke(channels.DB_DELETE_SETTING, key),
    getSetting:     (key: string) => invoke(channels.DB_GET_SETTING, key),
    getAllSettings:  () => invoke(channels.DB_GET_ALL),
    searchSettings: (term: string) => invoke(channels.DB_SEARCH, term),
    getTags:        () => invoke(channels.DB_GET_TAGS),
    getTagGroups:   () => invoke(channels.DB_GET_TAG_GROUPS),
  },

  // ── 项目管理 ──────────────────────────────────────────────────
  project: {
    create:       (dto: unknown) => invoke(channels.PROJECT_CREATE, dto),
    update:       (dto: unknown) => invoke(channels.PROJECT_UPDATE, dto),
    delete:       (id: string) => invoke(channels.PROJECT_DELETE, id),
    get:          (id: string) => invoke(channels.PROJECT_GET, id),
    getAll:       (includeArchived?: boolean) => invoke(channels.PROJECT_GET_ALL, includeArchived),
    search:       (term: string) => invoke(channels.PROJECT_SEARCH, term),
    getStats:     () => invoke(channels.PROJECT_GET_STATS),
    getByStatus:  (status: string) => invoke(channels.PROJECT_GET_BY_STATUS, status),
  },

  projectManagement: {
    create:        (dto: unknown) => invoke(channels.PROJECT_MANAGEMENT_CREATE, dto),
    update:        (dto: unknown) => invoke(channels.PROJECT_MANAGEMENT_UPDATE, dto),
    delete:        (id: string) => invoke(channels.PROJECT_MANAGEMENT_DELETE, id),
    get:           (id: string) => invoke(channels.PROJECT_MANAGEMENT_GET, id),
    getList:       (query: unknown) => invoke(channels.PROJECT_MANAGEMENT_GET_LIST, query),
    deleteByQuery: (dto: unknown) => invoke(channels.PROJECT_MANAGEMENT_DELETE_BY_QUERY, dto),
    move:          (dto: unknown) => invoke(channels.PROJECT_MANAGEMENT_MOVE, dto),
    recode:        (query: unknown) => invoke(channels.PROJECT_MANAGEMENT_RECODE, query),
    renameGroup:   (groupKey: string, oldName: string, newName: string) => invoke(channels.PROJECT_MANAGEMENT_RENAME_GROUP, groupKey, oldName, newName),
    countInGroups: (groupKeys: string[], groupNames: string[]) => invoke(channels.PROJECT_MANAGEMENT_COUNT_IN_GROUPS, groupKeys, groupNames),
    getSummary:    (query: unknown) => invoke(channels.PROJECT_MANAGEMENT_GET_SUMMARY, query),
    importCsv:     (filePath: string, defaultGroupKey?: string, defaultGroupName?: string) => invoke(channels.PROJECT_MANAGEMENT_IMPORT_CSV, filePath, defaultGroupKey, defaultGroupName),
    exportCsv:     (query: unknown, filePath: string) => invoke(channels.PROJECT_MANAGEMENT_EXPORT_CSV, query, filePath),
  },

  // ── 文档管理 ──────────────────────────────────────────────────
  document: {
    insert:         (dto: unknown) => invoke(channels.DOC_INSERT, dto),
    update:         (id: string, updates: unknown) => invoke(channels.DOC_UPDATE, id, updates),
    delete:         (id: string) => invoke(channels.DOC_DELETE, id),
    getByProject:   (projectId: string) => invoke(channels.DOC_GET_BY_PROJECT, projectId),
  },

  // ── 工作流 ────────────────────────────────────────────────────
  workflow: {
    initDefault:    (projectId: string) => invoke(channels.WORKFLOW_INIT, projectId),
    get:            (projectId: string) => invoke(channels.WORKFLOW_GET, projectId),
    updateNode:     (id: string, updates: unknown) => invoke(channels.WORKFLOW_UPDATE, id, updates),
  },

  // ── 提醒 ──────────────────────────────────────────────────────
  reminder: {
    create:       (dto: unknown) => invoke(channels.REMINDER_CREATE, dto),
    update:       (id: string, updates: unknown) => invoke(channels.REMINDER_UPDATE, id, updates),
    delete:       (id: string) => invoke(channels.REMINDER_DELETE, id),
    get:          (projectId?: string) => invoke(channels.REMINDER_GET, projectId),
    markRead:     (id: string) => invoke(channels.REMINDER_MARK_READ, id),
  },

  // ── 文件系统 ──────────────────────────────────────────────────
  fs: {
    copyFiles:    (srcPaths: string[], destDir: string, options?: { destNames?: string[] }) => invoke(channels.FS_COPY_FILES, srcPaths, destDir, options),
    openFile:     (filePath: string) => invoke(channels.FS_OPEN_FILE, filePath),
    openFolder:   (folderPath: string) => invoke(channels.FS_OPEN_FOLDER, folderPath),
    getFileInfo:  (filePath: string) => invoke(channels.FS_GET_FILE_INFO, filePath),
    listDir:      (dirPath: string) => invoke(channels.FS_LIST_DIR, dirPath),
    deleteFile:   (filePath: string) => invoke(channels.FS_DELETE_FILE, filePath),
    createFolder: (folderPath: string) => invoke(channels.FS_CREATE_FOLDER, folderPath),
    selectFile:   (options?: any) => invoke(channels.FS_SELECT_FILE, options),
    saveFile:     (options?: any) => invoke(channels.FS_SAVE_FILE, options),
    writeFile:    (filePath: string, content: string) => invoke<IpcResponse<{ success: boolean }>>(channels.FS_WRITE_FILE, filePath, content),
    readFileBytes: (filePath: string) => invoke<IpcResponse<Uint8Array>>(channels.FS_READ_FILE_BYTES, filePath),
    readFileText: (filePath: string, options?: { maxBytes?: number }) => invoke(channels.FS_READ_FILE_TEXT, filePath, options),
    writeFileBytes: (filePath: string, bytes: Uint8Array) => invoke<IpcResponse<{ success: boolean }>>(channels.FS_WRITE_FILE_BYTES, filePath, bytes),
    clipboardWriteFile: (filePath: string) => invoke<IpcResponse<{ success: boolean }>>(channels.CLIPBOARD_WRITE_FILE, filePath),
    clipboardWriteImageBytes: (bytes: Uint8Array) => invoke<IpcResponse<{ success: boolean }>>(channels.CLIPBOARD_WRITE_IMAGE_BYTES, bytes),
    /** 订阅文件拷贝进度，返回取消订阅函数 */
    onCopyProgress: (callback: (progress: unknown) => void) =>
      listenSafe(channels.FS_COPY_PROGRESS, callback),
    /** 获取文件的绝对路径（用于拖拽文件） */
    getFilePath:  (file: File) => (file as any).path,
  },

  // ── 智能文件拷贝 ──────────────────────────────────────────────
  fileCopy: {
    expandSources: (srcPaths: string[]) =>
      invoke<{ items: Array<{ src: string; name: string; relativePath?: string }>; truncated: boolean }>(
        channels.FILE_COPY_EXPAND_SOURCES,
        srcPaths
      ),
    /** 开始文件拷贝任务 */
    start: (files: Array<{ src: string; name: string; relativePath?: string }>, destDir: string, options?: unknown) =>
      invoke<{ taskId: string; strategy: string; success: unknown[]; failed: unknown[]; total: number; completed: number }>
        (channels.FILE_COPY_START, files, destDir, options),
    /** 取消拷贝任务 */
    cancel: (taskId: string) => invoke<{ success: boolean }>(channels.FILE_COPY_CANCEL, taskId),
    /** 获取进行中的任务 */
    getActiveTasks: () => invoke<string[]>(channels.FILE_COPY_ACTIVE_TASKS),
    onStarted: (callback: (payload: { taskId: string; total: number; destDir: string }) => void) =>
      listenSafe(channels.FILE_COPY_STARTED, callback),
    /** 订阅拷贝进度，返回取消订阅函数 */
    onProgress: (callback: (payload: { taskId: string; current: number; total: number; percent: string; currentFile?: string; bytesCopied?: number; totalBytes?: number; speed?: string }) => void) =>
      listenSafe(channels.FILE_COPY_PROGRESS, callback),
    onFileCompleted: (callback: (payload: unknown) => void) =>
      listenSafe(channels.FILE_COPY_FILE_COMPLETED, callback),
    onFileFailed: (callback: (payload: unknown) => void) =>
      listenSafe(channels.FILE_COPY_FILE_FAILED, callback),
    /** 订阅拷贝完成事件 */
    onCompleted: (callback: (payload: { taskId: string; result: unknown }) => void) =>
      listenSafe(channels.FILE_COPY_COMPLETED, callback),
    /** 订阅拷贝取消事件 */
    onCancelled: (callback: (payload: { taskId: string }) => void) =>
      listenSafe(channels.FILE_COPY_CANCELLED, callback),
    onConflict: (callback: (payload: unknown) => void) =>
      listenSafe(channels.FILE_COPY_CONFLICT, callback),
    decideConflict: (payload: { requestId: string; decision: unknown }) =>
      invoke<{ success: boolean }>(channels.FILE_COPY_CONFLICT_DECIDE, payload),
  },

  // ── 任务监控 ────────────────────────────────────────────────────
  taskMonitor: {
    getActiveTasks: () => invoke(channels.TASK_MONITOR_GET_ACTIVE),
    registerTask: (input: RegisterTaskInput) => invoke(channels.TASK_MONITOR_REGISTER, input),
    updateTask: (taskId: string, progress: Partial<TaskInfo>) =>
      invoke(channels.TASK_MONITOR_UPDATE, { taskId, ...progress }),
    completeTask: (taskId: string, result?: unknown) =>
      invoke(channels.TASK_MONITOR_COMPLETE, { taskId, result }),
    failTask: (taskId: string, error?: unknown) =>
      invoke(channels.TASK_MONITOR_FAIL, { taskId, error }),
    cancelTask: (taskId: string) => invoke(channels.TASK_MONITOR_CANCEL, { taskId }),
    unregisterTask: (taskId: string) => invoke(channels.TASK_MONITOR_UNREGISTER, { taskId }),
    onActiveTasksChanged: (callback: (tasks: TaskInfo[]) => void) =>
      listenSafe(channels.TASK_MONITOR_ACTIVE_CHANGED, payload => callback(((payload as { activeTasks?: TaskInfo[] })?.activeTasks || []))),
  },

  // ── 关闭保护 ────────────────────────────────────────────────────
  closeGuard: {
    checkBeforeClose: () => invoke<{ hasActiveTasks: boolean; tasks: TaskInfo[] }>(channels.CLOSE_GUARD_CHECK),
    forceClose: () => invoke(channels.CLOSE_GUARD_FORCE_CLOSE),
    cancelClose: () => invoke(channels.CLOSE_GUARD_CANCEL),
    cancel: () => invoke(channels.CLOSE_GUARD_CANCEL),
    onShowConfirm: (callback: (data: { hasActiveTasks: boolean; tasks: TaskInfo[] }) => void) =>
      listenSafe('close-guard:show-confirm', callback),
  },

  importTasks: {
    start: (payload: unknown) => invoke(channels.IMPORT_TASK_START, payload),
    getStatus: (payload: unknown) => invoke(channels.IMPORT_TASK_GET_STATUS, payload),
    cancel: (payload: unknown) => invoke(channels.IMPORT_TASK_CANCEL, payload),
    onProgress: (callback: (payload: unknown) => void) => listenSafe(channels.IMPORT_TASK_PROGRESS, callback),
  },

  // ── 资源库 ─────────────────────────────────────────────────────
  library: {
    /** 创建资源库 */
    create: (dto: { name: string; path: string }) => invoke<{ id: string; name: string; path: string; createdAt: string; updatedAt: string }>(channels.LIBRARY_CREATE, dto),
    /** 获取所有资源库 */
    getAll: () => invoke<Array<{ id: string; name: string; path: string; createdAt: string; updatedAt: string }>>(channels.LIBRARY_GET_ALL),
    /** 删除资源库 */
    delete: (id: string) => invoke<{ success: boolean }>(channels.LIBRARY_DELETE, id),
    /** 获取指定资源库的标签 */
    getTags: (libraryPath: string) => invoke(channels.LIBRARY_GET_TAGS, libraryPath),
    /** 获取指定资源库的标签分组 */
    getTagGroups: (libraryPath: string) => invoke(channels.LIBRARY_GET_TAG_GROUPS, libraryPath),
    /** 创建标签分组 */
    createTagGroup: (libraryPath: string, name: string) => invoke(channels.LIBRARY_CREATE_TAG_GROUP, libraryPath, name),
    /** 创建标签 */
    createTag: (libraryPath: string, dto: { name: string; groupId?: string }) => invoke(channels.LIBRARY_CREATE_TAG, libraryPath, dto),
    createSoftwareProject: (dto: SoftwareCopyrightCreateDTO) =>
      invoke<SoftwareCopyrightCreateResult>(channels.LIBRARY_CREATE_SOFTWARE_PROJECT, dto),
    getSoftwareProjects: (libraryPath: string) =>
      invoke<SoftwareCopyrightProject[]>(channels.LIBRARY_GET_SOFTWARE_PROJECTS, libraryPath),
    getContractFormSchema: (dto: ContractFormSchemaGetDTO) =>
      invoke<IpcResponse<ContractFormSchemaConfig>>(channels.LIBRARY_GET_CONTRACT_FORM_SCHEMA, dto),
    saveContractFormSchema: (dto: ContractFormSchemaSaveDTO) =>
      invoke<IpcResponse<ContractFormSchemaConfig>>(channels.LIBRARY_SAVE_CONTRACT_FORM_SCHEMA, dto),
    exportContractFormSchema: (dto: ContractFormSchemaExportDTO) =>
      invoke<IpcResponse<ContractFormSchemaExportResult>>(channels.LIBRARY_EXPORT_CONTRACT_FORM_SCHEMA, dto),
    importContractFormSchema: (dto: ContractFormSchemaImportDTO) =>
      invoke<IpcResponse<ContractFormSchemaConfig>>(channels.LIBRARY_IMPORT_CONTRACT_FORM_SCHEMA, dto),
    createContractInfo: (dto: ContractInfoCreateDTO) =>
      invoke<ContractInfoCreateResult>(channels.LIBRARY_CREATE_CONTRACT_INFO, dto),
    getContractInfos: (libraryPath: string, options?: { includeDeleted?: boolean }) =>
      invoke<ContractInfoEntity[]>(channels.LIBRARY_GET_CONTRACT_INFOS, libraryPath, options),
    queryContractInfos: (dto: ContractInfoQueryDTO) =>
      invoke<ContractInfoQueryResult>(channels.LIBRARY_QUERY_CONTRACT_INFOS, dto),
    getContractSummaryStats: (dto: ContractInfoSummaryStatsDTO) =>
      invoke<ContractInfoSummaryStatsResult>(channels.LIBRARY_GET_CONTRACT_SUMMARY_STATS, dto),
    executeContractStatistics: (payload: { libraryPath: string; aiPlan: ContractStatisticsAIPlan }) =>
      invoke<ContractStatisticsExecutionResult>(channels.LIBRARY_EXECUTE_CONTRACT_STATISTICS, payload),
    getSidebarStats: (libraryPath: string) =>
      invoke<{ activeContracts: number; trashContracts: number; totalTags: number }>(channels.LIBRARY_GET_SIDEBAR_STATS, libraryPath),
    getContractInfo: (dto: ContractInfoGetDTO) =>
      invoke<ContractInfoEntity>(channels.LIBRARY_GET_CONTRACT_INFO, dto),
    updateContractInfo: (dto: ContractInfoUpdateDTO) =>
      invoke<ContractInfoEntity>(channels.LIBRARY_UPDATE_CONTRACT_INFO, dto),
    deleteContractInfo: (dto: ContractInfoDeleteDTO) =>
      invoke<{ success: boolean }>(channels.LIBRARY_DELETE_CONTRACT_INFO, dto),
    deleteContractInfos: (dto: ContractInfoBatchDeleteDTO) =>
      invoke<{ success: boolean; deleted: number }>(channels.LIBRARY_DELETE_CONTRACT_INFOS, dto),
    restoreContractInfo: (dto: ContractInfoRestoreDTO) =>
      invoke<{ success: boolean }>(channels.LIBRARY_RESTORE_CONTRACT_INFO, dto),
    restoreContractInfos: (dto: ContractInfoBatchRestoreDTO) =>
      invoke<{ success: boolean; restored: number }>(channels.LIBRARY_RESTORE_CONTRACT_INFOS, dto),
    purgeContractInfo: (dto: ContractInfoPurgeDTO) =>
      invoke<{ success: boolean }>(channels.LIBRARY_PURGE_CONTRACT_INFO, dto),
    purgeContractInfos: (dto: ContractInfoBatchPurgeDTO) =>
      invoke<{ success: boolean; purged: number }>(channels.LIBRARY_PURGE_CONTRACT_INFOS, dto),
    moveContractInfo: (dto: ContractInfoMoveDTO) =>
      invoke<{ success: boolean }>(channels.LIBRARY_MOVE_CONTRACT_INFO, dto),
    getCalendarEvents: (dto: LibraryCalendarEventQueryDTO) =>
      invoke<IpcResponse<LibraryCalendarEventEntity[]>>(channels.LIBRARY_GET_CALENDAR_EVENTS, dto),
    rebuildCalendarEvents: (dto: LibraryCalendarEventRebuildDTO) =>
      invoke<IpcResponse<{ processed: number }>>(channels.LIBRARY_REBUILD_CALENDAR_EVENTS, dto),
    createManualCalendarReminder: (dto: LibraryCalendarManualReminderCreateDTO) =>
      invoke<IpcResponse<LibraryCalendarEventEntity>>(channels.LIBRARY_CREATE_MANUAL_CALENDAR_REMINDER, dto),
  },

  ui: {
    getFolderColorMap: (dto: FolderColorMapGetDTO) =>
      invoke<IpcResponse<FolderColorMapResult>>(channels.LIBRARY_UI_GET_FOLDER_COLOR_MAP, dto),
    setFolderColorMap: (dto: FolderColorMapSetDTO) =>
      invoke<IpcResponse<{ success: boolean }>>(channels.LIBRARY_UI_SET_FOLDER_COLOR_MAP, dto),
  },

  contractFiles: {
    getList: (dto: ContractFileListDTO) =>
      invoke(channels.CONTRACT_FILES_GET_LIST, dto),
    getAllList: (dto: ContractFileAllListDTO) =>
      invoke(channels.CONTRACT_FILES_GET_ALL_LIST, dto),
    getAllListPaged: (dto: ContractFileAllListPagedDTO) =>
      invoke(channels.CONTRACT_FILES_GET_ALL_LIST_PAGED, dto),
    getTrashList: (dto: ContractFileTrashListDTO) =>
      invoke(channels.CONTRACT_FILES_GET_TRASH_LIST, dto),
    upsertFromPaths: (dto: ContractFileUpsertFromPathsDTO) =>
      invoke(channels.CONTRACT_FILES_UPSERT_FROM_PATHS, dto),
    delete: (dto: ContractFileDeleteDTO) =>
      invoke(channels.CONTRACT_FILES_DELETE, dto),
    restore: (dto: ContractFileRestoreDTO) =>
      invoke<ContractFileRestoreResult>(channels.CONTRACT_FILES_RESTORE, dto),
    purge: (dto: ContractFilePurgeDTO) =>
      invoke(channels.CONTRACT_FILES_PURGE, dto),
    copy: (dto: ContractFileCopyDTO) =>
      invoke(channels.CONTRACT_FILES_COPY, dto),
    move: (dto: ContractFileMoveDTO) =>
      invoke<ContractFileMoveResult>(channels.CONTRACT_FILES_MOVE, dto),
    createFolder: (dto: ContractFileCreateFolderDTO) =>
      invoke(channels.CONTRACT_FILES_CREATE_FOLDER, dto),
    rename: (dto: ContractFileRenameDTO) =>
      invoke(channels.CONTRACT_FILES_RENAME, dto),
    updateThumbnail: (dto: ContractFileUpdateThumbnailDTO) =>
      invoke(channels.CONTRACT_FILES_UPDATE_THUMBNAIL, dto),
    saveThumbnailFile: (dto: ContractFileSaveThumbnailFileDTO) =>
      invoke(channels.CONTRACT_FILES_SAVE_THUMBNAIL_FILE, dto),
    startDragOut: (dto: ContractFileStartDragOutDTO) =>
      invoke<ContractFileStartDragOutResult>(channels.CONTRACT_FILES_START_DRAG_OUT, dto),
  },

  otherFiles: {
    getList: (dto: OtherFileListDTO) =>
      invoke(channels.OTHER_FILES_GET_LIST, dto),
    getTrashList: (dto: OtherFileTrashListDTO) =>
      invoke(channels.OTHER_FILES_GET_TRASH_LIST, dto),
    upsertFromPaths: (dto: OtherFileUpsertFromPathsDTO) =>
      invoke(channels.OTHER_FILES_UPSERT_FROM_PATHS, dto),
    delete: (dto: OtherFileDeleteDTO) =>
      invoke(channels.OTHER_FILES_DELETE, dto),
    restore: (dto: OtherFileRestoreDTO) =>
      invoke<OtherFileRestoreResult>(channels.OTHER_FILES_RESTORE, dto),
    purge: (dto: OtherFilePurgeDTO) =>
      invoke(channels.OTHER_FILES_PURGE, dto),
    copy: (dto: OtherFileCopyDTO) =>
      invoke(channels.OTHER_FILES_COPY, dto),
    move: (dto: OtherFileMoveDTO) =>
      invoke<OtherFileMoveResult>(channels.OTHER_FILES_MOVE, dto),
    createFolder: (dto: OtherFileCreateFolderDTO) =>
      invoke(channels.OTHER_FILES_CREATE_FOLDER, dto),
    rename: (dto: OtherFileRenameDTO) =>
      invoke(channels.OTHER_FILES_RENAME, dto),
    updateThumbnail: (dto: OtherFileUpdateThumbnailDTO) =>
      invoke(channels.OTHER_FILES_UPDATE_THUMBNAIL, dto),
    saveThumbnailFile: (dto: OtherFileSaveThumbnailFileDTO) =>
      invoke(channels.OTHER_FILES_SAVE_THUMBNAIL_FILE, dto),
    startDragOut: (dto: OtherFileStartDragOutDTO) =>
      invoke<OtherFileStartDragOutResult>(channels.OTHER_FILES_START_DRAG_OUT, dto),
  },

  // ── 快捷键 ────────────────────────────────────────────────────
  shortcut: {
    /** 注册快捷键 */
    register: (config: { id: string; accelerator: string; description?: string; global?: boolean }) =>
      invoke(channels.SHORTCUT_REGISTER, config),
    /** 注销指定快捷键 */
    unregister: (id: string) => invoke(channels.SHORTCUT_UNREGISTER, id),
    /** 注销所有快捷键 */
    unregisterAll: () => invoke(channels.SHORTCUT_UNREGISTER_ALL),
    /** 检查快捷键是否已注册 */
    isRegistered: (id: string) => invoke<{ registered: boolean }>(channels.SHORTCUT_IS_REGISTERED, id),
    /** 订阅快捷键触发事件，返回取消订阅函数 */
    onTriggered: (callback: (payload: { id: string; accelerator: string }) => void) =>
      listenSafe(channels.SHORTCUT_TRIGGERED, callback),
  },

  // ── 字典设置 ───────────────────────────────────────────────────
  dictionary: {
    create: (dto: unknown) => invoke(channels.DICTIONARY_CREATE, dto),
    update: (dto: unknown) => invoke(channels.DICTIONARY_UPDATE, dto),
    delete: (id: string) => invoke(channels.DICTIONARY_DELETE, id),
    get: (id: string) => invoke(channels.DICTIONARY_GET, id),
    getList: (query: unknown) => invoke(channels.DICTIONARY_GET_LIST, query),
    importCsv: (filePath: string, groupName: string) => invoke(channels.DICTIONARY_IMPORT_CSV, filePath, groupName),
    renameGroup: (oldName: string, newName: string) => invoke(channels.DICTIONARY_RENAME_GROUP, oldName, newName),
    clearGroups: (groupNames: string[]) => invoke(channels.DICTIONARY_CLEAR_GROUPS, groupNames),
    exportCsv: (groupName: string, filePath: string) => invoke(channels.DICTIONARY_EXPORT_CSV, groupName, filePath),
    exportGroupBundle: (groupKey: string, filePath: string) => invoke(channels.DICTIONARY_EXPORT_GROUP_BUNDLE, groupKey, filePath),
    importGroupBundle: (filePath: string, targetGroupKey: string) => invoke(channels.DICTIONARY_IMPORT_GROUP_BUNDLE, filePath, targetGroupKey),
    countInGroups: (groupNames: string[]) => invoke(channels.DICTIONARY_COUNT_IN_GROUPS, groupNames),
    moveToGroup: (ids: string[], targetGroupName: string) => invoke(channels.DICTIONARY_MOVE_TO_GROUP, ids, targetGroupName),
    moveToTop: (id: string) => invoke(channels.DICTIONARY_MOVE_TO_TOP, id),
    moveToBottom: (id: string) => invoke(channels.DICTIONARY_MOVE_TO_BOTTOM, id),
    onImportProgress: (callback: (payload: { status: string; current: number; total: number; percent: number }) => void) =>
      listenSafe(channels.DICTIONARY_IMPORT_PROGRESS, payload => callback(payload as { status: string; current: number; total: number; percent: number })),
  },

  // ── 树形字典设置 ───────────────────────────────────────────────────
  treeDictionary: {
    create: (dto: unknown) => invoke(channels.TREE_DICTIONARY_CREATE, dto),
    update: (dto: unknown) => invoke(channels.TREE_DICTIONARY_UPDATE, dto),
    delete: (id: string) => invoke(channels.TREE_DICTIONARY_DELETE, id),
    get: (id: string) => invoke(channels.TREE_DICTIONARY_GET, id),
    getList: (query: unknown) => invoke(channels.TREE_DICTIONARY_GET_LIST, query),
    importCsv: (filePath: string, groupName: string) => invoke(channels.TREE_DICTIONARY_IMPORT_CSV, filePath, groupName),
    renameGroup: (oldName: string, newName: string) => invoke(channels.TREE_DICTIONARY_RENAME_GROUP, oldName, newName),
    clearGroups: (groupNames: string[]) => invoke(channels.TREE_DICTIONARY_CLEAR_GROUPS, groupNames),
    updateSort: (updates: { id: string; sort_order: number }[]) => invoke(channels.TREE_DICTIONARY_UPDATE_SORT, updates),
    onImportProgress: (callback: (payload: { status: string; current: number; total: number; percent: number }) => void) =>
      listenSafe(channels.TREE_DICTIONARY_IMPORT_PROGRESS, payload => callback(payload as { status: string; current: number; total: number; percent: number })),
  },

  // ── AI 功能 ──────────────────────────────────────────────────────
  ai: {
    extractContractInfo: (payload: AIExtractContractInfoRequest) =>
      invoke<AIContractExtractionResult>(channels.AI_EXTRACT_CONTRACT, payload),
    getExtractionEvidence: (payload: { fileId: string }) =>
      invoke<AIContractExtractionEvidenceResult>(channels.AI_GET_EXTRACTION_EVIDENCE, payload),
    generateStructured: (payload: AIStructuredGenerateRequest) =>
      invoke<AIStructuredGenerateResult>(channels.AI_GENERATE_STRUCTURED, payload),
    testConnection: (config: AITestConnectionRequest) =>
      invoke<AITestConnectionResult>(channels.AI_TEST_CONNECTION, config),
    validateLocalModel: (payload: AILocalModelValidationRequest) =>
      invoke<AILocalModelValidationResult>(channels.AI_VALIDATE_LOCAL_MODEL, payload),
    promoteContractVectors: (payload: { filePath: string; contractId: string }) =>
      invoke<{ success: boolean }>(channels.AI_PROMOTE_CONTRACT_VECTORS, payload),
  },

  aiAgent: {
    createSession: (payload: AIAgentCreateSessionRequest) =>
      invoke<AIAgentCreateSessionResult>(channels.AI_AGENT_CREATE_SESSION, payload),
    listSessions: () =>
      invoke<AIAgentSessionSummary[]>(channels.AI_AGENT_LIST_SESSIONS),
    getSession: (payload: AIAgentGetSessionRequest) =>
      invoke<AIAgentSession | null>(channels.AI_AGENT_GET_SESSION, payload),
    renameSession: (payload: AIAgentRenameSessionRequest) =>
      invoke<AIAgentRenameSessionResult>(channels.AI_AGENT_RENAME_SESSION, payload),
    sendMessage: (payload: AIAgentSendMessageRequest) =>
      invoke<AIAgentSendMessageResult>(channels.AI_AGENT_SEND_MESSAGE, payload),
    deleteSession: (payload: AIAgentDeleteSessionRequest) =>
      invoke<{ success: boolean }>(channels.AI_AGENT_DELETE_SESSION, payload),
  },

  // ── 文件转换 ──────────────────────────────────────────────────────
  fileConversion: {
    convertToMarkdown: (filePath: string) =>
      invoke<IpcResponse<FileConversionResult>>(channels.FILE_CONVERT_TO_MD, filePath),
    checkOcrStatus: () =>
      invoke<IpcResponse<{
        usable: boolean;
        engine: string;
        version: string;
        executablePath: string;
        modelsPath: string;
        error?: string;
      }>>(channels.FILE_OCR_CHECK_STATUS),
    ocrTest: (imagePath: string) =>
      invoke<IpcResponse<{
        text: string;
        elapsedMs: number;
      }>>(channels.FILE_OCR_TEST, imagePath),
    findPdfTextHighlights: (payload: { filePath: string; query: string; pageNumbers?: number[] }) =>
      invoke<IpcResponse<PdfTextSearchHighlightResult>>(channels.FILE_PDF_SEARCH_HIGHLIGHTS, payload),
  },

  toolbox: {
    scanImageFolder: (payload: ScanImageFolderRequest) =>
      invoke<IpcResponse<ScanImageFolderResult>>(channels.TOOLBOX_SCAN_IMAGE_FOLDER, payload),
    scanOcrImageFolder: (payload: ScanOcrImageFolderRequest) =>
      invoke<IpcResponse<ScanOcrImageFolderResult>>(channels.TOOLBOX_SCAN_OCR_IMAGE_FOLDER, payload),
    batchImageOcr: (payload: BatchImageOcrRequest) =>
      invoke<IpcResponse<BatchImageOcrResult>>(channels.TOOLBOX_BATCH_IMAGE_OCR, payload),
    exportImageOcrDocx: (payload: ExportImageOcrDocxRequest) =>
      invoke<IpcResponse<ExportImageOcrDocxResult>>(channels.TOOLBOX_EXPORT_IMAGE_OCR_DOCX, payload),
    createImagePdf: (payload: CreateImagePdfRequest) =>
      invoke<IpcResponse<CreateImagePdfResult>>(channels.TOOLBOX_CREATE_IMAGE_PDF, payload),
    processSignatureImage: (payload: ProcessSignatureImageRequest) =>
      invoke<IpcResponse<ProcessSignatureImageResult>>(channels.TOOLBOX_PROCESS_SIGNATURE_IMAGE, payload),
    processSealImage: (payload: ProcessSealImageRequest) =>
      invoke<IpcResponse<ProcessSealImageResult>>(channels.TOOLBOX_PROCESS_SEAL_IMAGE, payload),
    inspectPdfFiles: (payload: InspectPdfFilesRequest) =>
      invoke<IpcResponse<InspectPdfFilesResult>>(channels.TOOLBOX_INSPECT_PDF_FILES, payload),
    mergePdfFiles: (payload: MergePdfFilesRequest) =>
      invoke<IpcResponse<MergePdfFilesResult>>(channels.TOOLBOX_MERGE_PDF_FILES, payload),
    splitPdfFiles: (payload: SplitPdfFilesRequest) =>
      invoke<IpcResponse<SplitPdfFilesResult>>(channels.TOOLBOX_SPLIT_PDF_FILES, payload),
    estimatePdfCompression: (payload: EstimatePdfCompressionRequest) =>
      invoke<IpcResponse<EstimatePdfCompressionResult>>(channels.TOOLBOX_ESTIMATE_PDF_COMPRESSION, payload),
    compressPdfFile: (payload: CompressPdfFileRequest) =>
      invoke<IpcResponse<CompressPdfFileResult>>(channels.TOOLBOX_COMPRESS_PDF_FILE, payload),
    onPdfCompressionProgress: (callback: (payload: PdfCompressionProgressPayload) => void) =>
      listenSafe(channels.TOOLBOX_PDF_COMPRESSION_PROGRESS, payload => callback(payload as PdfCompressionProgressPayload)),
    batchStampPdfFiles: (payload: BatchStampPdfFilesRequest) =>
      invoke<IpcResponse<BatchStampPdfFilesResult>>(channels.TOOLBOX_BATCH_STAMP_PDF_FILES, payload),
  },

  search: {
    fullText: (query: string) => invoke<Array<{ file_path: string; snippet: string }>>(channels.SEARCH_FULL_TEXT, query),
    fullTextInPath: (payload: { query: string; baseDir: string; libraryPath?: string; recursive?: boolean; ensureIndexed?: boolean; limit?: number; offset?: number; sourceType?: 'contract' | 'other' }) =>
      invoke<{
        total: number;
        items: Array<{
          file_path: string;
          snippet: string;
          source_type?: 'contract' | 'other';
          file_id?: string;
          contract_id?: string;
          contract_no?: string;
          contract_name?: string;
          file_name?: string;
          relative_path?: string;
          directory_label?: string;
          can_preview?: boolean;
        }>;
        indexing: boolean;
        lastIndexedAt?: number;
        lastError?: string;
      }>(channels.SEARCH_FULL_TEXT_IN_PATH, payload),
    reindex: (libraryPath: string) => invoke<{ success: boolean }>(channels.SEARCH_REINDEX, libraryPath),
    indexStatus: (baseDir: string) => invoke<{ indexing: boolean; lastIndexedAt?: number; lastError?: string }>(channels.SEARCH_INDEX_STATUS, baseDir),
  },

  // ── 合同功能 ────────────────────────────────────────────────────
  contract: {
    upload: (filePath: string) => invoke(channels.CONTRACT_UPLOAD, filePath),
    scanFolder: (folderPath: string) => invoke(channels.CONTRACT_SCAN_FOLDER, folderPath),
  },

  // ── 供应商功能 ────────────────────────────────────────────────────
  supplier: {
    create: (dto: any) => invoke(channels.SUPPLIER_CREATE, dto),
    update: (dto: any) => invoke(channels.SUPPLIER_UPDATE, dto),
    delete: (id: string) => invoke(channels.SUPPLIER_DELETE, id),
    get: (id: string) => invoke(channels.SUPPLIER_GET, id),
    getList: (query: any) => invoke(channels.SUPPLIER_GET_LIST, query),
  },

  // ── 客户功能 ────────────────────────────────────────────────────
  customer: {
    create: (dto: any) => invoke(channels.CUSTOMER_CREATE, dto),
    update: (dto: any) => invoke(channels.CUSTOMER_UPDATE, dto),
    delete: (id: string) => invoke(channels.CUSTOMER_DELETE, id),
    get: (id: string) => invoke(channels.CUSTOMER_GET, id),
    getList: (query: any) => invoke(channels.CUSTOMER_GET_LIST, query),
  },

  // ── 部门功能 ────────────────────────────────────────────────────
  department: {
    create: (dto: any) => invoke(channels.DEPARTMENT_CREATE, dto),
    update: (dto: any) => invoke(channels.DEPARTMENT_UPDATE, dto),
    delete: (id: string) => invoke(channels.DEPARTMENT_DELETE, id),
    get: (id: string) => invoke(channels.DEPARTMENT_GET, id),
    getList: (query: any) => invoke(channels.DEPARTMENT_GET_LIST, query),
  },

  // ── 人员功能 ────────────────────────────────────────────────────
  personnel: {
    create: (dto: any) => invoke(channels.PERSONNEL_CREATE, dto),
    update: (dto: any) => invoke(channels.PERSONNEL_UPDATE, dto),
    delete: (id: string) => invoke(channels.PERSONNEL_DELETE, id),
    get: (id: string) => invoke(channels.PERSONNEL_GET, id),
    getList: (query: any) => invoke(channels.PERSONNEL_GET_LIST, query),
    parseResume: (payload: PersonnelResumeParseRequest) =>
      invoke<IpcResponse<PersonnelResumeParseResult>>(channels.PERSONNEL_PARSE_RESUME, payload),
    scanResumeFolder: (folderPath: string) =>
      invoke<IpcResponse<PersonnelBatchResumeScanResult>>(channels.PERSONNEL_SCAN_RESUME_FOLDER, folderPath),
    batchImportResumes: (payload: PersonnelBatchImportRequest) =>
      invoke<IpcResponse<PersonnelBatchImportResult>>(channels.PERSONNEL_BATCH_IMPORT_RESUMES, payload),
    updateSort: (updates: { id: string; sort_order: number }[]) => invoke(channels.PERSONNEL_UPDATE_SORT, updates),
    addDocuments: (payload: PersonnelDocumentCreateRequest) =>
      invoke<IpcResponse<PersonnelDocumentCreateResult>>(channels.PERSONNEL_ADD_DOCUMENTS, payload),
    listDocuments: (personnelId: string) =>
      invoke<IpcResponse<PersonnelDocument[]>>(channels.PERSONNEL_LIST_DOCUMENTS, personnelId),
    updateDocument: (dto: PersonnelDocumentUpdateDTO) =>
      invoke<IpcResponse<PersonnelDocument | null>>(channels.PERSONNEL_UPDATE_DOCUMENT, dto),
    deleteDocument: (id: string) =>
      invoke<IpcResponse<{ success: boolean }>>(channels.PERSONNEL_DELETE_DOCUMENT, id),
    applyDocumentDraft: (dto: PersonnelDocumentApplyDraftDTO) =>
      invoke<IpcResponse<any>>(channels.PERSONNEL_APPLY_DOCUMENT_DRAFT, dto),
    rejectDocumentDraft: (documentId: string) =>
      invoke<IpcResponse<PersonnelDocument | null>>(channels.PERSONNEL_REJECT_DOCUMENT_DRAFT, documentId),
  },

  unitDocument: {
    add: (payload: UnitDocumentCreateRequest) =>
      invoke<IpcResponse<UnitDocumentCreateResult>>(channels.UNIT_DOCUMENT_ADD, payload),
    list: (ownerType: UnitDocumentOwnerType, ownerId: string) =>
      invoke<IpcResponse<UnitDocument[]>>(channels.UNIT_DOCUMENT_LIST, { ownerType, ownerId }),
    update: (dto: UnitDocumentUpdateDTO) =>
      invoke<IpcResponse<UnitDocument | null>>(channels.UNIT_DOCUMENT_UPDATE, dto),
    delete: (id: string) =>
      invoke<IpcResponse<{ success: boolean }>>(channels.UNIT_DOCUMENT_DELETE, id),
    applyDraft: (dto: UnitDocumentApplyDraftDTO) =>
      invoke<IpcResponse<any>>(channels.UNIT_DOCUMENT_APPLY_DRAFT, dto),
    rejectDraft: (documentId: string) =>
      invoke<IpcResponse<UnitDocument | null>>(channels.UNIT_DOCUMENT_REJECT_DRAFT, documentId),
  },

  contractProduct: {
    create: (dto: ContractProductCreateDTO) => invoke<ContractProduct>(channels.CONTRACT_PRODUCT_CREATE, dto),
    update: (dto: ContractProductUpdateDTO) => invoke<ContractProduct>(channels.CONTRACT_PRODUCT_UPDATE, dto),
    delete: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_PRODUCT_DELETE, id),
    restore: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_PRODUCT_RESTORE, id),
    purge: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_PRODUCT_PURGE, id),
    get: (id: string) => invoke<ContractProduct>(channels.CONTRACT_PRODUCT_GET, id),
    getList: (query: ContractProductQueryDTO) => invoke<ContractProductQueryResult>(channels.CONTRACT_PRODUCT_GET_LIST, query),
  },

  contractExecution: {
    create: (dto: ContractExecutionCreateDTO) => invoke<ContractExecution>(channels.CONTRACT_EXECUTION_CREATE, dto),
    update: (dto: ContractExecutionUpdateDTO) => invoke<ContractExecution>(channels.CONTRACT_EXECUTION_UPDATE, dto),
    delete: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_EXECUTION_DELETE, id),
    restore: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_EXECUTION_RESTORE, id),
    purge: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_EXECUTION_PURGE, id),
    get: (id: string) => invoke<ContractExecution>(channels.CONTRACT_EXECUTION_GET, id),
    getList: (query: ContractExecutionQueryDTO) => invoke<ContractExecutionQueryResult>(channels.CONTRACT_EXECUTION_GET_LIST, query),
  },

  contractInvoice: {
    create: (dto: ContractInvoiceCreateDTO) => invoke<ContractInvoice>(channels.CONTRACT_INVOICE_CREATE, dto),
    update: (dto: ContractInvoiceUpdateDTO) => invoke<ContractInvoice>(channels.CONTRACT_INVOICE_UPDATE, dto),
    delete: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_INVOICE_DELETE, id),
    restore: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_INVOICE_RESTORE, id),
    purge: (id: string) => invoke<{ success: boolean }>(channels.CONTRACT_INVOICE_PURGE, id),
    get: (id: string) => invoke<ContractInvoice | null>(channels.CONTRACT_INVOICE_GET, id),
    getList: (query: ContractInvoiceQueryDTO) => invoke<ContractInvoiceQueryResult>(channels.CONTRACT_INVOICE_GET_LIST, query),
    batchDelete: (ids: string[]) => invoke<{ success: boolean; data?: { deletedCount: number } }>(channels.CONTRACT_INVOICE_BATCH_DELETE, ids),
    batchRestore: (ids: string[]) => invoke<{ success: boolean; data?: { restoredCount: number } }>(channels.CONTRACT_INVOICE_BATCH_RESTORE, ids),
    batchPurge: (ids: string[]) => invoke<{ success: boolean; data?: { purgedCount: number } }>(channels.CONTRACT_INVOICE_BATCH_PURGE, ids),
  },

  log: {
    write: (payload: LogWritePayload) => invoke<{ logged: true }>(channels.LOG_WRITE, payload),
    getSettings: () => invoke<LoggingSettings>(channels.LOG_GET_SETTINGS),
    saveSettings: (settings: LoggingSettings) => invoke<LoggingSettings>(channels.LOG_SAVE_SETTINGS, settings),
    openFolder: () => invoke<{ opened: true; path: string }>(channels.LOG_OPEN_FOLDER),
  },

  // ── 全局配置 Config ─────────────────────────────────────────────
  config: {
    getAll: () => invoke<IpcResponse<GlobalConfig>>(channels.CONFIG_GET_ALL),
    getItem: (key: string) => invoke<IpcResponse<unknown>>(channels.CONFIG_GET_ITEM, key),
    save: (config: GlobalConfig) => invoke<IpcResponse<boolean>>(channels.CONFIG_SAVE, config),
    updateItem: (key: string, value: unknown) => invoke<IpcResponse<boolean>>(channels.CONFIG_UPDATE_ITEM, key, value),
    getDefault: () => invoke<IpcResponse<GlobalConfig>>(channels.CONFIG_GET_DEFAULT),
    onChanged: (callback: (config: GlobalConfig) => void) =>
      listenSafe(channels.CONFIG_CHANGED, payload => callback(payload as GlobalConfig)),
  },

  app: {
    getInfo: () => invoke<IpcResponse<AppInfoData>>(channels.APP_GET_INFO),
    getAutoStart: () => invoke<IpcResponse<{ enabled: boolean; openAtLogin: boolean }>>(channels.APP_GET_AUTO_START),
    setAutoStart: (enabled: boolean) => invoke<IpcResponse<{ enabled: boolean; openAtLogin: boolean }>>(channels.APP_SET_AUTO_START, enabled),
  },

  backup: {
    create: () => invoke<IpcResponse<CreateBackupResult>>(channels.BACKUP_CREATE),
    list: () => invoke<IpcResponse<BackupInfo[]>>(channels.BACKUP_LIST),
    restore: (backupPath: string) => invoke<IpcResponse<RestoreBackupResult>>(channels.BACKUP_RESTORE, backupPath),
  },

  // ── 兼容旧版 API（TitleBar.vue 等组件使用）───────────────────────
  minimizeWindow: () => invoke<IpcResponse>(channels.WIN_MINIMIZE),
  toggleMaximizeWindow: () => invoke<IpcResponse>(channels.WIN_TOGGLE_MAXIMIZE),
  closeWindow: () => invoke<IpcResponse>(channels.WIN_CLOSE),
  isWindowMaximized: () => invoke<IpcResponse<boolean>>(channels.WIN_IS_MAXIMIZED),
  toggleFullscreen: () => invoke<IpcResponse<{ isFullscreen: boolean }>>(channels.WIN_TOGGLE_FULLSCREEN),
  isFullscreen: () => invoke<IpcResponse<boolean>>(channels.WIN_IS_FULLSCREEN),
  onMaximizeStatusChange: (callback: (isMaximized: boolean) => void) => {
    listenSafe(channels.WIN_MAXIMIZE_CHANGED, payload => (callback as unknown as (event: unknown, isMaximized: boolean) => void)(undefined, payload as boolean))
  },
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
    listenSafe(channels.WIN_FULLSCREEN_CHANGED, payload => (callback as unknown as (event: unknown, isFullscreen: boolean) => void)(undefined, payload as boolean))
  },
});
