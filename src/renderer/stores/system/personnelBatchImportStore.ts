import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  Personnel,
  PersonnelBatchImportItemResult,
  PersonnelBatchImportSession,
  PersonnelBatchResumeScanItem,
  PersonnelResumeParsedData,
} from '../../../shared/types/personnel.types';
import { useTaskMonitorStore } from './taskMonitorStore';

const createEmptySession = (): PersonnelBatchImportSession => ({
  taskId: '',
  folderPath: '',
  stage: 'idle',
  total: 0,
  completed: 0,
  successCount: 0,
  failedCount: 0,
  message: '',
  items: [],
});

const buildTaskId = () => `batch-personnel-import-${Date.now()}`;

export const usePersonnelBatchImportStore = defineStore('personnelBatchImport', () => {
  const session = ref<PersonnelBatchImportSession>(createEmptySession());
  const running = ref(false);
  const taskMonitorStore = useTaskMonitorStore();
  let runToken = 0;

  const hasSession = computed(() => session.value.stage !== 'idle' || session.value.items.length > 0);
  const progressPercent = computed(() => {
    if (session.value.total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((session.value.completed / session.value.total) * 100)));
  });

  const refreshCounts = () => {
    session.value.total = session.value.items.length;
    session.value.completed = session.value.items.filter(item => item.status === 'saved' || item.status === 'failed').length;
    session.value.successCount = session.value.items.filter(item => item.status === 'saved').length;
    session.value.failedCount = session.value.items.filter(item => item.status === 'failed').length;
  };

  const syncTaskProgress = (message?: string) => {
    if (!session.value.taskId) return;
    taskMonitorStore.updateProgress(session.value.taskId, {
      progress: progressPercent.value,
      current: session.value.completed,
      total: session.value.total,
      message: message || session.value.message,
    });
  };

  const reset = () => {
    runToken += 1;
    running.value = false;
    session.value = createEmptySession();
  };

  const prepareSessionItems = (items: PersonnelBatchResumeScanItem[]) => items.map<PersonnelBatchImportItemResult>((item) => ({
    filePath: item.filePath,
    fileName: item.fileName,
    extension: item.extension,
    relativePath: item.relativePath,
    status: 'pending',
    created: false,
  }));

  const scanFolder = async (folderPath: string) => {
    session.value.stage = 'scanning';
    session.value.folderPath = folderPath;
    session.value.message = '正在扫描文件夹中的简历文件...';
    session.value.startedAt = Date.now();
    const res = await window.electronAPI.personnel.scanResumeFolder(folderPath);
    if (!res.success || !res.data) {
      session.value.stage = 'failed';
      session.value.message = res.error || '扫描失败';
      throw new Error(session.value.message);
    }
    session.value = {
      taskId: session.value.taskId || buildTaskId(),
      folderPath: res.data.folderPath,
      stage: 'idle',
      total: res.data.total,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: Date.now(),
      finishedAt: undefined,
      message: res.data.total > 0 ? `已扫描到 ${res.data.total} 份简历，可开始自动入库。` : '未发现可导入简历文件。',
      items: prepareSessionItems(res.data.items),
    };
    return res.data;
  };

  const runImport = async (
    filePaths?: string[],
    options?: { onSaved?: (personnelId: string) => Promise<void> | void },
  ) => {
    if (running.value) return;
    const targets = (filePaths && filePaths.length > 0)
      ? session.value.items.filter(item => filePaths.includes(item.filePath))
      : session.value.items.filter(item => item.status !== 'saved');
    if (targets.length === 0) return;

    running.value = true;
    runToken += 1;
    const currentToken = runToken;
    session.value.stage = 'running';
    session.value.taskId = session.value.taskId || buildTaskId();
    session.value.startedAt = session.value.startedAt || Date.now();
    session.value.finishedAt = undefined;
    taskMonitorStore.register({
      id: session.value.taskId,
      name: '员工简历批量导入',
      type: 'import',
      total: session.value.total,
    });

    try {
      for (const item of targets) {
        if (currentToken !== runToken) return;
        const target = session.value.items.find(entry => entry.filePath === item.filePath);
        if (!target) continue;
        target.status = 'processing';
        target.error = '';
        session.value.currentFilePath = target.filePath;
        session.value.currentFileName = target.fileName;
        session.value.message = `正在处理 ${target.fileName}`;
        syncTaskProgress(session.value.message);

        const res = await window.electronAPI.personnel.batchImportResumes({
          folderPath: session.value.folderPath,
          filePaths: [target.filePath],
        });
        if (currentToken !== runToken) return;
        const imported = res.success && res.data ? res.data.results[0] : undefined;
        const nextResult = imported || {
          ...target,
          status: 'failed' as const,
          created: false,
          error: res.error || '导入失败',
        };
        Object.assign(target, nextResult);
        refreshCounts();
        syncTaskProgress(nextResult.error || nextResult.personnelName || session.value.message);
        if (nextResult.status === 'saved' && nextResult.personnelId) {
          await options?.onSaved?.(nextResult.personnelId);
        }
      }

      refreshCounts();
      session.value.stage = 'completed';
      session.value.currentFilePath = '';
      session.value.currentFileName = '';
      session.value.finishedAt = Date.now();
      session.value.message = `导入完成：成功 ${session.value.successCount}，失败 ${session.value.failedCount}`;
      syncTaskProgress(session.value.message);
      taskMonitorStore.complete(session.value.taskId, {
        total: session.value.total,
        successCount: session.value.successCount,
        failedCount: session.value.failedCount,
      });
    } catch (error) {
      session.value.stage = 'failed';
      session.value.finishedAt = Date.now();
      session.value.message = error instanceof Error ? error.message : '批量导入失败';
      syncTaskProgress(session.value.message);
      taskMonitorStore.fail(session.value.taskId, session.value.message);
      throw error;
    } finally {
      running.value = false;
    }
  };

  const retryItem = async (filePath: string, options?: { onSaved?: (personnelId: string) => Promise<void> | void }) => {
    await runImport([filePath], options);
  };

  const markItemSavedFromManual = (filePath: string, personnel?: Personnel | null) => {
    const item = session.value.items.find(entry => entry.filePath === filePath);
    if (!item) return;
    item.status = 'saved';
    item.created = true;
    item.error = '';
    item.personnelId = personnel?.id || item.personnelId;
    item.personnelName = personnel?.name || item.personnelName || item.draft?.name || '';
    refreshCounts();
    session.value.message = `已手工补录 ${item.fileName}`;
  };

  const buildManualDraft = (filePath: string): PersonnelResumeParsedData | null => {
    const item = session.value.items.find(entry => entry.filePath === filePath);
    return item?.draft || null;
  };

  return {
    session,
    running,
    hasSession,
    progressPercent,
    reset,
    scanFolder,
    runImport,
    retryItem,
    markItemSavedFromManual,
    buildManualDraft,
  };
});
