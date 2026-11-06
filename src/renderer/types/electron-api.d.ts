import type { AppInfoData, IpcResponse, InitStatusData, InitProjectData, LoadLibraryData, SelectFolderData } from '../../shared/types/ipc.types';
import type { Setting } from '../../shared/types/database.types';
import type { GlobalConfig } from '../../shared/types/config.types';
import type { Project, ProjectCreateDTO, ProjectUpdateDTO } from '../../shared/types/project.types';
import type {
  ProjectManagementCreateDTO,
  ProjectManagementItem,
  ProjectManagementMoveDTO,
  ProjectManagementQueryDTO,
  ProjectManagementQueryResult,
  ProjectManagementRecodeResult,
  ProjectManagementSummary,
  ProjectManagementUpdateDTO,
} from '../../shared/types/projectManagement.types';
import type { Document, DocumentInsertDTO, DocumentCategory } from '../../shared/types/document.types';
import type { WorkflowNode } from '../../shared/types/workflow.types';
import type { Reminder, ReminderCreateDTO, ReminderPriority } from '../../shared/types/reminder.types';
import type { Library, LibraryCreateDTO } from '../../shared/types/library.types';
import type { TagEntity, TagGroupEntity } from '../../shared/types/tag.types';
import type { FolderColorMapGetDTO, FolderColorMapResult, FolderColorMapSetDTO } from '../../shared/types/folderColor.types';
import type {
  SoftwareCopyrightCreateDTO,
  SoftwareCopyrightCreateResult,
  SoftwareCopyrightProject,
} from '../../shared/types/softwareCopyright.types';
import type {
  ContractInfoCreateDTO,
  ContractInfoCreateResult,
  ContractInfoBatchDeleteDTO,
  ContractInfoDeleteDTO,
  ContractInfoRestoreDTO,
  ContractInfoBatchRestoreDTO,
  ContractInfoPurgeDTO,
  ContractInfoBatchPurgeDTO,
  ContractInfoEntity,
  ContractInfoGetDTO,
  ContractInfoMoveDTO,
  ContractInfoQueryDTO,
  ContractInfoQueryResult,
  ContractInfoSummaryStatsDTO,
  ContractInfoSummaryStatsResult,
  ContractInfoUpdateDTO,
} from '../../shared/types/contractInfo.types';
import type {
  ContractFormSchemaConfig,
  ContractFormSchemaExportDTO,
  ContractFormSchemaExportResult,
  ContractFormSchemaGetDTO,
  ContractFormSchemaImportDTO,
  ContractFormSchemaSaveDTO,
} from '../../shared/types/contractFormSchema.types';
import type {
  LibraryCalendarEventEntity,
  LibraryCalendarEventQueryDTO,
  LibraryCalendarEventRebuildDTO,
  LibraryCalendarManualReminderCreateDTO,
} from '../../shared/types/libraryCalendarEvent.types';
import type {
  AIContractExtractionEvidenceResult,
  AIContractExtractionResult,
  AIExtractContractInfoRequest,
  AILocalModelValidationRequest,
  AILocalModelValidationResult,
  AIStructuredGenerateRequest,
  AIStructuredGenerateResult,
  AITestConnectionRequest,
  AITestConnectionResult,
} from '../../shared/types/ai.types';
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
} from '../../shared/types/aiAgent.types';
import type {
  ContractStatisticsAIPlan,
  ContractStatisticsExecutionResult,
} from '../../shared/types/contractStatistics.types';
import type { SupplierCreateDTO, SupplierUpdateDTO, SupplierQueryDTO, SupplierQueryResult, Supplier } from '../../shared/types/supplier.types';
import type { CustomerCreateDTO, CustomerUpdateDTO, CustomerQueryDTO, CustomerQueryResult, Customer } from '../../shared/types/customer.types';
import type { DepartmentCreateDTO, DepartmentUpdateDTO, DepartmentQueryDTO, DepartmentQueryResult, Department } from '../../shared/types/department.types';
import type {
  PersonnelDocument,
  PersonnelDocumentApplyDraftDTO,
  PersonnelDocumentCreateRequest,
  PersonnelDocumentCreateResult,
  PersonnelDocumentUpdateDTO,
  PersonnelBatchImportRequest,
  PersonnelBatchImportResult,
  Personnel,
  PersonnelBatchResumeScanResult,
  PersonnelCreateDTO,
  PersonnelQueryDTO,
  PersonnelQueryResult,
  PersonnelResumeParseRequest,
  PersonnelResumeParseResult,
  PersonnelUpdateDTO,
} from '../../shared/types/personnel.types';
import type {
  UnitDocument,
  UnitDocumentApplyDraftDTO,
  UnitDocumentCreateRequest,
  UnitDocumentCreateResult,
  UnitDocumentOwnerType,
  UnitDocumentUpdateDTO,
} from '../../shared/types/unitDocument.types';
import type { ContractProductCreateDTO, ContractProductUpdateDTO, ContractProductQueryDTO, ContractProductQueryResult, ContractProduct } from '../../shared/types/contractProduct.types';
import type { ContractExecutionCreateDTO, ContractExecutionUpdateDTO, ContractExecutionQueryDTO, ContractExecutionQueryResult, ContractExecution } from '../../shared/types/contractExecution.types';
import type {
  ContractInvoice,
  ContractInvoiceCreateDTO,
  ContractInvoiceQueryDTO,
  ContractInvoiceQueryResult,
  ContractInvoiceUpdateDTO,
} from '../../shared/types/contractInvoice.types';
import type { DictionaryCreateDTO, DictionaryUpdateDTO, DictionaryQueryDTO, DictionaryQueryResult, DictionaryItem, DictionaryGroupBundleExportResult, DictionaryGroupBundleImportResult } from '../../shared/types/dictionary.types';
import type { TreeDictionaryCreateDTO, TreeDictionaryUpdateDTO, TreeDictionaryQueryDTO, TreeDictionaryQueryResult, TreeDictionaryItem } from '../../shared/types/treeDictionary.types';
import type { FileSystemEntry } from '../../shared/types/fileSystem.types';
import type {
  ImportTaskCancelRequest,
  ImportTaskCancelResponse,
  ImportTaskGetStatusRequest,
  ImportTaskGetStatusResponse,
  ImportTaskProgressPayload,
  ImportTaskStartRequest,
  ImportTaskStartResponse,
} from '../../shared/types/importTask.types';
import type {
  ContractFileCopyDTO,
  ContractFileCreateFolderDTO,
  ContractFileDeleteDTO,
  ContractFileAllListDTO,
  ContractFileAllListPagedDTO,
  ContractFileAllListPagedResult,
  ContractFileAllListResult,
  ContractFileListDTO,
  ContractFileListResult,
  ContractFileMoveDTO,
  ContractFileMoveResult,
  ContractFileTrashListDTO,
  ContractFilePurgeDTO,
  ContractFileStartDragOutDTO,
  ContractFileStartDragOutResult,
  ContractFileRenameDTO,
  ContractFileRecord,
  ContractFileRestoreDTO,
  ContractFileRestoreResult,
  ContractFileUpsertFromPathsDTO,
  ContractFileSaveThumbnailFileDTO,
  ContractFileUpdateThumbnailDTO,
} from '../../shared/types/contractFile.types';
import type {
  OtherFileCopyDTO,
  OtherFileCreateFolderDTO,
  OtherFileDeleteDTO,
  OtherFileListDTO,
  OtherFileListResult,
  OtherFileMoveDTO,
  OtherFileMoveResult,
  OtherFileTrashListDTO,
  OtherFilePurgeDTO,
  OtherFileStartDragOutDTO,
  OtherFileStartDragOutResult,
  OtherFileRenameDTO,
  OtherFileRecord,
  OtherFileRestoreDTO,
  OtherFileRestoreResult,
  OtherFileUpsertFromPathsDTO,
  OtherFileSaveThumbnailFileDTO,
  OtherFileUpdateThumbnailDTO,
} from '../../shared/types/otherFile.types';
import type {
  FileConversionResult,
  PdfTextSearchHighlightResult,
} from '../../shared/types/fileConversion.types';
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
  MergePdfFilesResult,
  PdfCompressionProgressPayload,
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
  ToolboxImageItem,
} from '../../shared/types/toolbox.types';
import type { LoggingSettings, LogWritePayload } from '../../shared/types/log.types';
import type { RegisterTaskInput, TaskInfo } from '../../shared/types/taskMonitor.types';
import type { BackupInfo, CreateBackupResult, RestoreBackupResult } from '../../shared/types/backup.types';

export interface CopyProgressPayload {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  bytesWritten: number;
  totalBytes: number;
  percent: number;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  createdAt: number;
  lastModified: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface CopyResult {
  success: boolean;
  destPath: string;
  checksum: string;
  fileSize: number;
}

export interface ReadFileTextResult {
  text: string;
  encoding: string;
  truncated: boolean;
  bytesRead: number;
  fileSize: number;
}

/**
 * window.electronAPI 完整类型声明
 * 渲染进程中调用 window.electronAPI.xxx 时有完整类型提示和检查。
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ElectronAPI {
  // ── 窗口控制（扁平化 API）────────────────────────────────────
  minimizeWindow(): Promise<IpcResponse>;
  toggleMaximizeWindow(): Promise<IpcResponse>;
  closeWindow(): Promise<IpcResponse>;
  isWindowMaximized(): Promise<IpcResponse<boolean>>;
  toggleFullscreen(): Promise<IpcResponse<{ isFullscreen: boolean }>>;
  isFullscreen(): Promise<IpcResponse<boolean>>;
  onMaximizeStatusChange(callback: (isMaximized: boolean) => void): void;
  onFullscreenChanged(callback: (isFullscreen: boolean) => void): void;

  // ── 窗口控制（嵌套结构 - 预留）────────────────────────────────
  window?: {
    minimize(): Promise<IpcResponse>;
    toggleMaximize(): Promise<IpcResponse>;
    close(): Promise<IpcResponse>;
    isMaximized(): Promise<IpcResponse<boolean>>;
    toggleFullscreen(): Promise<IpcResponse<{ isFullscreen: boolean }>>;
    isFullscreen(): Promise<IpcResponse<boolean>>;
    onMaximizeChanged(callback: (isMaximized: boolean) => void): () => void;
    onFullscreenChanged(callback: (isFullscreen: boolean) => void): () => void;
  };

  webContents: {
    findInPage(payload: { text: string; options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean } }): Promise<IpcResponse<{ requestId: number }>>;
    stopFindInPage(payload: { action?: 'clearSelection' | 'keepSelection' | 'activateSelection' }): Promise<IpcResponse>;
    onFoundInPage(callback: (payload: { requestId: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void): () => void;
  };

  crypto: {
    rsaEncryptBase64(publicKeyBase64: string, plaintext: string): string;
  };

  device: {
    getIdentity(): {
      deviceId: string;
      deviceName: string;
      primaryMac: string;
      macAddresses: string[];
      fingerprintSource: 'mac' | 'host';
      platform: string;
      arch: string;
    };
  };

  // ── 初始化 / Bootstrap ────────────────────────────────────────
  bootstrap: {
    getInitStatus(): Promise<IpcResponse<InitStatusData>>;
    selectFolder(): Promise<IpcResponse<SelectFolderData>>;
    initProject(projectName: string, basePath: string): Promise<IpcResponse<InitProjectData>>;
    validateLibraryPath(path: string): Promise<IpcResponse<boolean>>;
    loadExistingLibrary(path: string): Promise<IpcResponse<LoadLibraryData>>;
  };

  // ── 数据库 Settings CRUD ──────────────────────────────────────
  db: {
    insertSetting(key: string, value: string, description?: string): Promise<IpcResponse<Setting>>;
    updateSetting(key: string, value: string, description?: string): Promise<IpcResponse<Setting>>;
    deleteSetting(key: string): Promise<IpcResponse>;
    getSetting(key: string): Promise<IpcResponse<Setting | null>>;
    getAllSettings(): Promise<IpcResponse<Setting[]>>;
    searchSettings(term: string): Promise<IpcResponse<Setting[]>>;
    getTags(): Promise<IpcResponse<TagEntity[]>>;
    getTagGroups(): Promise<IpcResponse<TagGroupEntity[]>>;
  };

  // ── 项目管理 ──────────────────────────────────────────────────
  project: {
    create(dto: ProjectCreateDTO): Promise<IpcResponse<Project>>;
    update(dto: ProjectUpdateDTO): Promise<IpcResponse<Project>>;
    delete(id: string): Promise<IpcResponse>;
    get(id: string): Promise<IpcResponse<Project | null>>;
    getAll(includeArchived?: boolean): Promise<IpcResponse<Project[]>>;
    search(term: string): Promise<IpcResponse<Project[]>>;
    getStats(): Promise<IpcResponse<{ total: number; by_status: Record<string, number> }>>;
    getByStatus(status: string): Promise<IpcResponse<Project[]>>;
  };

  projectManagement: {
    create(dto: ProjectManagementCreateDTO): Promise<IpcResponse<ProjectManagementItem>>;
    update(dto: ProjectManagementUpdateDTO): Promise<IpcResponse<ProjectManagementItem>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<ProjectManagementItem | null>>;
    getList(query: ProjectManagementQueryDTO): Promise<IpcResponse<ProjectManagementQueryResult>>;
    deleteByQuery(dto: { query?: ProjectManagementQueryDTO }): Promise<IpcResponse<{ deletedCount: number }>>;
    move(dto: ProjectManagementMoveDTO): Promise<IpcResponse<ProjectManagementItem>>;
    recode(query: ProjectManagementQueryDTO): Promise<IpcResponse<ProjectManagementRecodeResult>>;
    renameGroup(groupKey: string, oldName: string, newName: string): Promise<IpcResponse<{ updatedCount: number }>>;
    countInGroups(groupKeys: string[], groupNames: string[]): Promise<IpcResponse<{ count: number }>>;
    getSummary(query: ProjectManagementQueryDTO): Promise<IpcResponse<ProjectManagementSummary>>;
    importCsv(filePath: string, defaultGroupKey?: string, defaultGroupName?: string): Promise<IpcResponse<{ importedCount: number }>>;
    exportCsv(query: ProjectManagementQueryDTO, filePath: string): Promise<IpcResponse<{ exportedCount: number; filePath: string }>>;
  };

  // ── 文档管理 ──────────────────────────────────────────────────
  document: {
    insert(dto: DocumentInsertDTO): Promise<IpcResponse<Document>>;
    update(id: string, updates: { name?: string; status?: string; checksum?: string }): Promise<IpcResponse<Document>>;
    delete(id: string): Promise<IpcResponse>;
    getByProject(projectId: string): Promise<IpcResponse<Document[]>>;
  };

  // ── 工作流 ────────────────────────────────────────────────────
  workflow: {
    initDefault(projectId: string): Promise<IpcResponse<WorkflowNode[]>>;
    get(projectId: string): Promise<IpcResponse<WorkflowNode[]>>;
    updateNode(id: string, updates: { status?: string; actual_date?: string; expected_date?: string; remark?: string }): Promise<IpcResponse<WorkflowNode>>;
  };

  // ── 提醒 ──────────────────────────────────────────────────────
  reminder: {
    create(dto: ReminderCreateDTO): Promise<IpcResponse<Reminder>>;
    update(id: string, updates: { title?: string; content?: string; reminder_date?: string; priority?: ReminderPriority; is_read?: number; is_completed?: number }): Promise<IpcResponse<Reminder>>;
    delete(id: string): Promise<IpcResponse>;
    get(projectId?: string): Promise<IpcResponse<Reminder[]>>;
    markRead(id: string): Promise<IpcResponse>;
  };

  // ── 文件系统 ──────────────────────────────────────────────────
  fs: {
    copyFiles(srcPaths: string[], destDir: string, options?: { destNames?: string[] }): Promise<IpcResponse<CopyResult[]>>;
    openFile(filePath: string): Promise<IpcResponse>;
    openFolder(folderPath: string): Promise<IpcResponse>;
    getFileInfo(filePath: string): Promise<IpcResponse<FileInfo>>;
    listDir(dirPath: string): Promise<IpcResponse<FileSystemEntry[]>>;
    deleteFile(filePath: string): Promise<IpcResponse<{ success: boolean }>>;
    createFolder(folderPath: string): Promise<IpcResponse<{ success: boolean }>>;
    getFilePath(file: File): string;
    selectFile(options?: any): Promise<IpcResponse<any>>;
    saveFile(options?: any): Promise<IpcResponse<any>>;
    writeFile(filePath: string, content: string): Promise<IpcResponse<{ success: boolean }>>;
    readFileBytes(filePath: string): Promise<IpcResponse<Uint8Array>>;
    readFileText(filePath: string, options?: { maxBytes?: number }): Promise<IpcResponse<ReadFileTextResult>>;
    writeFileBytes(filePath: string, bytes: Uint8Array): Promise<IpcResponse<{ success: boolean }>>;
    clipboardWriteFile(filePath: string): Promise<IpcResponse<{ success: boolean }>>;
    clipboardWriteImageBytes(bytes: Uint8Array): Promise<IpcResponse<{ success: boolean }>>;
    onCopyProgress(callback: (progress: any) => void): () => void;
  };

  // ── 快捷键 ────────────────────────────────────────────────────
  shortcut: {
    register(config: { id: string; accelerator: string; description?: string; global?: boolean }): Promise<IpcResponse<{ id: string; accelerator: string }>>;
    unregister(id: string): Promise<IpcResponse<{ id: string }>>;
    unregisterAll(): Promise<IpcResponse<{ count: number }>>;
    isRegistered(id: string): Promise<IpcResponse<{ registered: boolean }>>;
    onTriggered(callback: (payload: { id: string; accelerator: string }) => void): () => void;
  };

  // ── 资源库 ────────────────────────────────────────────────────
  library: {
    create(dto: LibraryCreateDTO): Promise<IpcResponse<Library>>;
    getAll(): Promise<IpcResponse<Library[]>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    getTags(libraryPath: string): Promise<IpcResponse<TagEntity[]>>;
    getTagGroups(libraryPath: string): Promise<IpcResponse<TagGroupEntity[]>>;
    createTagGroup(libraryPath: string, name: string): Promise<IpcResponse<TagGroupEntity>>;
    createTag(libraryPath: string, dto: { name: string; groupId?: string }): Promise<IpcResponse<TagEntity>>;
    createSoftwareProject(dto: SoftwareCopyrightCreateDTO): Promise<IpcResponse<SoftwareCopyrightCreateResult>>;
    getSoftwareProjects(libraryPath: string): Promise<IpcResponse<SoftwareCopyrightProject[]>>;
    getContractFormSchema(dto: ContractFormSchemaGetDTO): Promise<IpcResponse<ContractFormSchemaConfig>>;
    saveContractFormSchema(dto: ContractFormSchemaSaveDTO): Promise<IpcResponse<ContractFormSchemaConfig>>;
    exportContractFormSchema(dto: ContractFormSchemaExportDTO): Promise<IpcResponse<ContractFormSchemaExportResult>>;
    importContractFormSchema(dto: ContractFormSchemaImportDTO): Promise<IpcResponse<ContractFormSchemaConfig>>;
    createContractInfo(dto: ContractInfoCreateDTO): Promise<IpcResponse<ContractInfoCreateResult>>;
    getContractInfos(libraryPath: string, options?: { includeDeleted?: boolean }): Promise<IpcResponse<ContractInfoEntity[]>>;
    queryContractInfos(dto: ContractInfoQueryDTO): Promise<IpcResponse<ContractInfoQueryResult>>;
    getContractSummaryStats(dto: ContractInfoSummaryStatsDTO): Promise<IpcResponse<ContractInfoSummaryStatsResult>>;
    executeContractStatistics(payload: { libraryPath: string; aiPlan: ContractStatisticsAIPlan }): Promise<IpcResponse<ContractStatisticsExecutionResult>>;
    getSidebarStats(libraryPath: string): Promise<IpcResponse<{ activeContracts: number; trashContracts: number; totalTags: number }>>;
    getContractInfo(dto: ContractInfoGetDTO): Promise<IpcResponse<ContractInfoEntity>>;
    updateContractInfo(dto: ContractInfoUpdateDTO): Promise<IpcResponse<ContractInfoEntity>>;
    deleteContractInfo(dto: ContractInfoDeleteDTO): Promise<IpcResponse<{ success: boolean }>>;
    deleteContractInfos(dto: ContractInfoBatchDeleteDTO): Promise<IpcResponse<{ success: boolean; deleted: number }>>;
    restoreContractInfo(dto: ContractInfoRestoreDTO): Promise<IpcResponse<{ success: boolean }>>;
    restoreContractInfos(dto: ContractInfoBatchRestoreDTO): Promise<IpcResponse<{ success: boolean; restored: number }>>;
    purgeContractInfo(dto: ContractInfoPurgeDTO): Promise<IpcResponse<{ success: boolean }>>;
    purgeContractInfos(dto: ContractInfoBatchPurgeDTO): Promise<IpcResponse<{ success: boolean; purged: number }>>;
    moveContractInfo(dto: ContractInfoMoveDTO): Promise<IpcResponse<{ success: boolean }>>;
    getCalendarEvents(dto: LibraryCalendarEventQueryDTO): Promise<IpcResponse<LibraryCalendarEventEntity[]>>;
    rebuildCalendarEvents(dto: LibraryCalendarEventRebuildDTO): Promise<IpcResponse<{ processed: number }>>;
    createManualCalendarReminder(dto: LibraryCalendarManualReminderCreateDTO): Promise<IpcResponse<LibraryCalendarEventEntity>>;
  };

  ui: {
    getFolderColorMap(dto: FolderColorMapGetDTO): Promise<IpcResponse<FolderColorMapResult>>;
    setFolderColorMap(dto: FolderColorMapSetDTO): Promise<IpcResponse<{ success: boolean }>>;
  };

  contractFiles: {
    getList(dto: ContractFileListDTO): Promise<IpcResponse<ContractFileListResult>>;
    getAllList(dto: ContractFileAllListDTO): Promise<IpcResponse<ContractFileAllListResult>>;
    getAllListPaged(dto: ContractFileAllListPagedDTO): Promise<IpcResponse<ContractFileAllListPagedResult>>;
    getTrashList(dto: ContractFileTrashListDTO): Promise<IpcResponse<{ rootDir: string; contractNo: string; items: ContractFileRecord[] }>>;
    upsertFromPaths(dto: ContractFileUpsertFromPathsDTO): Promise<IpcResponse<{ upserted: number }>>;
    delete(dto: ContractFileDeleteDTO): Promise<IpcResponse<{ success: boolean }>>;
    restore(dto: ContractFileRestoreDTO): Promise<IpcResponse<ContractFileRestoreResult>>;
    purge(dto: ContractFilePurgeDTO): Promise<IpcResponse<{ success: boolean }>>;
    copy(dto: ContractFileCopyDTO): Promise<IpcResponse<{ record: ContractFileRecord }>>;
    move(dto: ContractFileMoveDTO): Promise<IpcResponse<ContractFileMoveResult>>;
    createFolder(dto: ContractFileCreateFolderDTO): Promise<IpcResponse<{ record: ContractFileRecord }>>;
    rename(dto: ContractFileRenameDTO): Promise<IpcResponse<{ record: ContractFileRecord }>>;
    updateThumbnail(dto: ContractFileUpdateThumbnailDTO): Promise<IpcResponse<{ success: boolean }>>;
    saveThumbnailFile(dto: ContractFileSaveThumbnailFileDTO): Promise<IpcResponse<{ filePath: string }>>;
    startDragOut(dto: ContractFileStartDragOutDTO): Promise<IpcResponse<ContractFileStartDragOutResult>>;
  };

  otherFiles: {
    getList(dto: OtherFileListDTO): Promise<IpcResponse<OtherFileListResult>>;
    getTrashList(dto: OtherFileTrashListDTO): Promise<IpcResponse<{ rootDir: string; items: OtherFileRecord[] }>>;
    upsertFromPaths(dto: OtherFileUpsertFromPathsDTO): Promise<IpcResponse<{ upserted: number }>>;
    delete(dto: OtherFileDeleteDTO): Promise<IpcResponse<{ success: boolean }>>;
    restore(dto: OtherFileRestoreDTO): Promise<IpcResponse<OtherFileRestoreResult>>;
    purge(dto: OtherFilePurgeDTO): Promise<IpcResponse<{ success: boolean }>>;
    copy(dto: OtherFileCopyDTO): Promise<IpcResponse<{ record: OtherFileRecord }>>;
    move(dto: OtherFileMoveDTO): Promise<IpcResponse<OtherFileMoveResult>>;
    createFolder(dto: OtherFileCreateFolderDTO): Promise<IpcResponse<{ record: OtherFileRecord }>>;
    rename(dto: OtherFileRenameDTO): Promise<IpcResponse<{ record: OtherFileRecord }>>;
    updateThumbnail(dto: OtherFileUpdateThumbnailDTO): Promise<IpcResponse<{ success: boolean }>>;
    saveThumbnailFile(dto: OtherFileSaveThumbnailFileDTO): Promise<IpcResponse<{ filePath: string }>>;
    startDragOut(dto: OtherFileStartDragOutDTO): Promise<IpcResponse<OtherFileStartDragOutResult>>;
  };

  // ── AI 功能 ──────────────────────────────────────────────────────
  ai: {
    extractContractInfo(payload: AIExtractContractInfoRequest): Promise<IpcResponse<AIContractExtractionResult>>;
    getExtractionEvidence(payload: { fileId: string }): Promise<IpcResponse<AIContractExtractionEvidenceResult>>;
    generateStructured<T = Record<string, unknown>>(payload: AIStructuredGenerateRequest): Promise<IpcResponse<AIStructuredGenerateResult<T>>>;
    testConnection(config: AITestConnectionRequest): Promise<IpcResponse<AITestConnectionResult>>;
    validateLocalModel(payload: AILocalModelValidationRequest): Promise<IpcResponse<AILocalModelValidationResult>>;
    promoteContractVectors(payload: { filePath: string; contractId: string }): Promise<IpcResponse<{ success: boolean }>>;
  };

  aiAgent: {
    createSession(payload: AIAgentCreateSessionRequest): Promise<IpcResponse<AIAgentCreateSessionResult>>;
    listSessions(): Promise<IpcResponse<AIAgentSessionSummary[]>>;
    getSession(payload: AIAgentGetSessionRequest): Promise<IpcResponse<AIAgentSession | null>>;
    renameSession(payload: AIAgentRenameSessionRequest): Promise<IpcResponse<AIAgentRenameSessionResult>>;
    sendMessage(payload: AIAgentSendMessageRequest): Promise<IpcResponse<AIAgentSendMessageResult>>;
    deleteSession(payload: AIAgentDeleteSessionRequest): Promise<IpcResponse<{ success: boolean }>>;
  };

  fileConversion: {
    convertToMarkdown(filePath: string): Promise<IpcResponse<FileConversionResult>>;
    checkOcrStatus(): Promise<IpcResponse<{
      usable: boolean;
      engine: string;
      version: string;
      executablePath: string;
      modelsPath: string;
      error?: string;
    }>>;
    ocrTest(imagePath: string): Promise<IpcResponse<{
      text: string;
      elapsedMs: number;
    }>>;
    findPdfTextHighlights(payload: { filePath: string; query: string; pageNumbers?: number[] }): Promise<IpcResponse<PdfTextSearchHighlightResult>>;
  };

  toolbox: {
    scanImageFolder(payload: ScanImageFolderRequest): Promise<IpcResponse<ScanImageFolderResult>>;
    scanOcrImageFolder(payload: ScanOcrImageFolderRequest): Promise<IpcResponse<ScanOcrImageFolderResult>>;
    batchImageOcr(payload: BatchImageOcrRequest): Promise<IpcResponse<BatchImageOcrResult>>;
    exportImageOcrDocx(payload: ExportImageOcrDocxRequest): Promise<IpcResponse<ExportImageOcrDocxResult>>;
    createImagePdf(payload: CreateImagePdfRequest): Promise<IpcResponse<CreateImagePdfResult>>;
    processSignatureImage(payload: ProcessSignatureImageRequest): Promise<IpcResponse<ProcessSignatureImageResult>>;
    processSealImage(payload: ProcessSealImageRequest): Promise<IpcResponse<ProcessSealImageResult>>;
    inspectPdfFiles(payload: InspectPdfFilesRequest): Promise<IpcResponse<InspectPdfFilesResult>>;
    mergePdfFiles(payload: MergePdfFilesRequest): Promise<IpcResponse<MergePdfFilesResult>>;
    splitPdfFiles(payload: SplitPdfFilesRequest): Promise<IpcResponse<SplitPdfFilesResult>>;
    estimatePdfCompression(payload: EstimatePdfCompressionRequest): Promise<IpcResponse<EstimatePdfCompressionResult>>;
    compressPdfFile(payload: CompressPdfFileRequest): Promise<IpcResponse<CompressPdfFileResult>>;
    onPdfCompressionProgress(callback: (payload: PdfCompressionProgressPayload) => void): () => void;
    batchStampPdfFiles(payload: BatchStampPdfFilesRequest): Promise<IpcResponse<BatchStampPdfFilesResult>>;
  };

  search: {
    fullText(query: string): Promise<Array<{ file_path: string; snippet: string }>>;
    fullTextInPath(payload: { query: string; baseDir: string; libraryPath?: string; recursive?: boolean; ensureIndexed?: boolean; limit?: number; offset?: number; sourceType?: 'contract' | 'other' }): Promise<{
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
    }>;
    reindex(libraryPath: string): Promise<{ success: boolean }>;
    indexStatus(baseDir: string): Promise<{ indexing: boolean; lastIndexedAt?: number; lastError?: string }>;
  };

  // ── 合同 ──────────────────────────────────────────────────────
  contract: {
    upload(filePath: string): Promise<IpcResponse<{ fileId: string; tempPath: string; previewPath: string }>>;
    scanFolder(folderPath: string): Promise<IpcResponse<{ folderPath: string; filePaths: string[]; total: number }>>;
  };

  // ── 供应商 ──────────────────────────────────────────────────────
  supplier: {
    create(dto: SupplierCreateDTO): Promise<IpcResponse<Supplier>>;
    update(dto: SupplierUpdateDTO): Promise<IpcResponse<Supplier>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<Supplier>>;
    getList(query: SupplierQueryDTO): Promise<IpcResponse<SupplierQueryResult>>;
  };

  // ── 客户 ──────────────────────────────────────────────────────
  customer: {
    create(dto: CustomerCreateDTO): Promise<IpcResponse<Customer>>;
    update(dto: CustomerUpdateDTO): Promise<IpcResponse<Customer>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<Customer>>;
    getList(query: CustomerQueryDTO): Promise<IpcResponse<CustomerQueryResult>>;
  };

  // ── 部门 ──────────────────────────────────────────────────────
  department: {
    create(dto: DepartmentCreateDTO): Promise<IpcResponse<Department>>;
    update(dto: DepartmentUpdateDTO): Promise<IpcResponse<Department>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<Department>>;
    getList(query: DepartmentQueryDTO): Promise<IpcResponse<DepartmentQueryResult>>;
  };

  // ── 人员 ──────────────────────────────────────────────────────
  personnel: {
    create(dto: PersonnelCreateDTO): Promise<IpcResponse<Personnel>>;
    update(dto: PersonnelUpdateDTO): Promise<IpcResponse<Personnel>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<Personnel>>;
    getList(query: PersonnelQueryDTO): Promise<IpcResponse<PersonnelQueryResult>>;
    parseResume(payload: PersonnelResumeParseRequest): Promise<IpcResponse<PersonnelResumeParseResult>>;
    scanResumeFolder(folderPath: string): Promise<IpcResponse<PersonnelBatchResumeScanResult>>;
    batchImportResumes(payload: PersonnelBatchImportRequest): Promise<IpcResponse<PersonnelBatchImportResult>>;
    updateSort(updates: { id: string; sort_order: number }[]): Promise<IpcResponse<{ updatedCount: number }>>;
    addDocuments(payload: PersonnelDocumentCreateRequest): Promise<IpcResponse<PersonnelDocumentCreateResult>>;
    listDocuments(personnelId: string): Promise<IpcResponse<PersonnelDocument[]>>;
    updateDocument(dto: PersonnelDocumentUpdateDTO): Promise<IpcResponse<PersonnelDocument | null>>;
    deleteDocument(id: string): Promise<IpcResponse<{ success: boolean }>>;
    applyDocumentDraft(dto: PersonnelDocumentApplyDraftDTO): Promise<IpcResponse<Personnel | null>>;
    rejectDocumentDraft(documentId: string): Promise<IpcResponse<PersonnelDocument | null>>;
  };

  unitDocument: {
    add(payload: UnitDocumentCreateRequest): Promise<IpcResponse<UnitDocumentCreateResult>>;
    list(ownerType: UnitDocumentOwnerType, ownerId: string): Promise<IpcResponse<UnitDocument[]>>;
    update(dto: UnitDocumentUpdateDTO): Promise<IpcResponse<UnitDocument | null>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    applyDraft(dto: UnitDocumentApplyDraftDTO): Promise<IpcResponse<Customer | Supplier | null>>;
    rejectDraft(documentId: string): Promise<IpcResponse<UnitDocument | null>>;
  };

  contractProduct: {
    create(dto: ContractProductCreateDTO): Promise<IpcResponse<ContractProduct>>;
    update(dto: ContractProductUpdateDTO): Promise<IpcResponse<ContractProduct>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    restore(id: string): Promise<IpcResponse<{ success: boolean }>>;
    purge(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<ContractProduct>>;
    getList(query: ContractProductQueryDTO): Promise<IpcResponse<ContractProductQueryResult>>;
  };

  contractExecution: {
    create(dto: ContractExecutionCreateDTO): Promise<IpcResponse<ContractExecution>>;
    update(dto: ContractExecutionUpdateDTO): Promise<IpcResponse<ContractExecution>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    restore(id: string): Promise<IpcResponse<{ success: boolean }>>;
    purge(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<ContractExecution | null>>;
    getList(query: ContractExecutionQueryDTO): Promise<IpcResponse<ContractExecutionQueryResult>>;
  };`r`n
  contractInvoice: {
    create(dto: ContractInvoiceCreateDTO): Promise<IpcResponse<ContractInvoice>>;
    update(dto: ContractInvoiceUpdateDTO): Promise<IpcResponse<ContractInvoice>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    restore(id: string): Promise<IpcResponse<{ success: boolean }>>;
    purge(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<ContractInvoice | null>>;
    getList(query: ContractInvoiceQueryDTO): Promise<IpcResponse<ContractInvoiceQueryResult>>;
    batchDelete(ids: string[]): Promise<IpcResponse<{ deletedCount: number }>>;
    batchRestore(ids: string[]): Promise<IpcResponse<{ restoredCount: number }>>;
    batchPurge(ids: string[]): Promise<IpcResponse<{ purgedCount: number }>>;
  };

  log: {
    write(payload: LogWritePayload): Promise<IpcResponse<{ logged: true }>>;
    getSettings(): Promise<IpcResponse<LoggingSettings>>;
    saveSettings(settings: LoggingSettings): Promise<IpcResponse<LoggingSettings>>;
    openFolder(): Promise<IpcResponse<{ opened: true; path: string }>>;
  };

  // ── 字典管理 ──────────────────────────────────────────────────────
  dictionary: {
    create(dto: DictionaryCreateDTO): Promise<IpcResponse<DictionaryItem>>;
    update(dto: DictionaryUpdateDTO): Promise<IpcResponse<DictionaryItem>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<DictionaryItem>>;
    getList(query: DictionaryQueryDTO): Promise<IpcResponse<DictionaryQueryResult>>;
    importCsv(filePath: string, groupName: string): Promise<IpcResponse<{ importedCount: number }>>;
    renameGroup(oldName: string, newName: string): Promise<IpcResponse<{ updatedCount: number }>>;
    clearGroups(groupNames: string[]): Promise<IpcResponse<{ updatedCount: number }>>;
    exportCsv(groupName: string, filePath: string): Promise<IpcResponse<{ exportedCount: number; filePath: string }>>;
    exportGroupBundle(groupKey: string, filePath: string): Promise<IpcResponse<DictionaryGroupBundleExportResult>>;
    importGroupBundle(filePath: string, targetGroupKey: string): Promise<IpcResponse<DictionaryGroupBundleImportResult>>;
    countInGroups(groupNames: string[]): Promise<IpcResponse<{ count: number }>>;
    moveToGroup(ids: string[], targetGroupName: string): Promise<IpcResponse<{ updatedCount: number }>>;
    moveToTop(id: string): Promise<IpcResponse<{ updatedCount: number }>>;
    moveToBottom(id: string): Promise<IpcResponse<{ updatedCount: number }>>;
    onImportProgress(callback: (payload: { status: string; current: number; total: number; percent: number }) => void): () => void;
  };

  // ── 树形字典 ──────────────────────────────────────────────────
  treeDictionary: {
    create(dto: TreeDictionaryCreateDTO): Promise<IpcResponse<TreeDictionaryItem>>;
    update(dto: TreeDictionaryUpdateDTO): Promise<IpcResponse<TreeDictionaryItem>>;
    delete(id: string): Promise<IpcResponse<{ success: boolean }>>;
    get(id: string): Promise<IpcResponse<TreeDictionaryItem>>;
    getList(query: TreeDictionaryQueryDTO): Promise<IpcResponse<TreeDictionaryQueryResult>>;
    importCsv(filePath: string, groupName: string): Promise<IpcResponse<{ importedCount: number }>>;
    renameGroup(oldName: string, newName: string): Promise<IpcResponse<{ updatedCount: number }>>;
    clearGroups(groupNames: string[]): Promise<IpcResponse<{ updatedCount: number }>>;
    updateSort(updates: { id: string; sort_order: number }[]): Promise<IpcResponse<{ updatedCount: number }>>;
    onImportProgress(callback: (payload: { status: string; current: number; total: number; percent: number }) => void): () => void;
  };

  // ── 全局配置 ──────────────────────────────────────────────────
  config: {
    getAll(): Promise<IpcResponse<GlobalConfig>>;
    getItem(key: string): Promise<IpcResponse<unknown>>;
    save(config: GlobalConfig): Promise<IpcResponse<boolean>>;
    updateItem(key: string, value: unknown): Promise<IpcResponse<boolean>>;
    getDefault(): Promise<IpcResponse<GlobalConfig>>;
    onChanged(callback: (config: GlobalConfig) => void): () => void;
  };

  app: {
    getInfo(): Promise<IpcResponse<AppInfoData>>;
    getAutoStart(): Promise<IpcResponse<{ enabled: boolean; openAtLogin: boolean }>>;
    setAutoStart(enabled: boolean): Promise<IpcResponse<{ enabled: boolean; openAtLogin: boolean }>>;
  };

  backup: {
    create(): Promise<IpcResponse<CreateBackupResult>>;
    list(): Promise<IpcResponse<BackupInfo[]>>;
    restore(backupPath: string): Promise<IpcResponse<RestoreBackupResult>>;
  };

  // ── 智能文件拷贝 ──────────────────────────────────────────────
  fileCopy: {
    expandSources(srcPaths: string[]): Promise<{ items: Array<{ src: string; name: string; relativePath?: string }>; truncated: boolean }>;
    start(files: Array<{ src: string; name: string; relativePath?: string }>, destDir: string, options?: unknown): Promise<{ taskId: string; strategy: string; success: Array<{ src: string; name: string; relativePath?: string }>; failed: Array<{ file: { src: string; name: string; relativePath?: string }; error: string }>; total: number; completed: number }>;
    cancel(taskId: string): Promise<{ success: boolean }>;
    getActiveTasks(): Promise<string[]>;
    onStarted(callback: (payload: { taskId: string; total: number; destDir: string }) => void): () => void;
    onProgress(callback: (payload: { taskId: string; current: number; total: number; percent: string; currentFile?: string; bytesCopied?: number; totalBytes?: number; speed?: string }) => void): () => void;
    onFileCompleted(callback: (payload: { taskId: string; fileIndex: number; totalFiles: number; completed: number; total: number; fileResult: { file: { src: string; name: string; relativePath?: string }; srcPath: string; destPath: string; finalDestPath: string; size: number; outcome: 'copied' | 'skipped'; resumedFromBytes?: number; srcHashes?: { md5?: string; sha256?: string }; destHashes?: { md5?: string; sha256?: string }; conflict?: { reason: 'dest-exists' | 'duplicate'; decision: { action: 'replace' | 'skip' | 'rename' | 'keep-both'; newName?: string } } } }) => void): () => void;
    onFileFailed(callback: (payload: { taskId: string; fileIndex: number; totalFiles: number; completed: number; total: number; fileResult: { file: { src: string; name: string; relativePath?: string }; srcPath: string; destPath: string; finalDestPath: string; size: number; outcome: 'failed'; error?: string } }) => void): () => void;
    onCompleted(callback: (payload: { taskId: string; result: unknown }) => void): () => void;
    onCancelled(callback: (payload: { taskId: string }) => void): () => void;
    onConflict(callback: (payload: unknown) => void): () => void;
    decideConflict(payload: { requestId: string; decision: unknown }): Promise<{ success: boolean }>;
  };

  importTasks: {
    start(payload: ImportTaskStartRequest): Promise<IpcResponse<ImportTaskStartResponse>>;
    getStatus(payload: ImportTaskGetStatusRequest): Promise<IpcResponse<ImportTaskGetStatusResponse>>;
    cancel(payload: ImportTaskCancelRequest): Promise<IpcResponse<ImportTaskCancelResponse>>;
    onProgress(callback: (payload: ImportTaskProgressPayload) => void): () => void;
  };

  taskMonitor: {
    getActiveTasks(): Promise<IpcResponse<TaskInfo[]>>;
    registerTask(input: RegisterTaskInput): Promise<IpcResponse<{ taskId: string }>>;
    updateTask(taskId: string, progress: Partial<TaskInfo>): Promise<IpcResponse<{ success: boolean }>>;
    completeTask(taskId: string, result?: unknown): Promise<IpcResponse<{ success: boolean }>>;
    failTask(taskId: string, error?: unknown): Promise<IpcResponse<{ success: boolean }>>;
    cancelTask(taskId: string): Promise<IpcResponse<{ success: boolean }>>;
    unregisterTask(taskId: string): Promise<IpcResponse<{ success: boolean }>>;
    onActiveTasksChanged(callback: (tasks: TaskInfo[]) => void): () => void;
  };

  closeGuard: {
    checkBeforeClose(): Promise<IpcResponse<{ hasActiveTasks: boolean; tasks: TaskInfo[] }>>;
    forceClose(): Promise<IpcResponse<void>>;
    cancelClose(): Promise<IpcResponse<void>>;
    cancel(): Promise<IpcResponse<void>>;
    onShowConfirm(callback: (data: { hasActiveTasks: boolean; tasks: TaskInfo[] }) => void): () => void;
  };
}

