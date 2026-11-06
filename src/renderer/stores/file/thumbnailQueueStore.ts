import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createRendererLogger } from '@/utils/logger';
import { PreviewAdapter } from '../../utils/PreviewAdapter';
import eventBus from '../../utils/eventBus';
import type { ContractFileRecord } from '../../../shared/types/contractFile.types';

const logger = createRendererLogger('ThumbnailQueueStore');

export interface ThumbnailTask {
  libraryPath: string;
  fileId: string;
  filePath: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export const useThumbnailQueueStore = defineStore('thumbnailQueue', () => {
  const queue = ref<ThumbnailTask[]>([]);
  const isProcessing = ref(false);
  const concurrency = 2;
  const activeCount = ref(0);
  const pendingUpdates = new Map<string, any>()
  let flushTimer: number | null = null

  const scheduleFlush = () => {
    if (flushTimer !== null) return
    flushTimer = window.setTimeout(() => {
      flushTimer = null
      if (pendingUpdates.size === 0) return
      const batch = Array.from(pendingUpdates.values())
      pendingUpdates.clear()
      eventBus.emit('contract-files:thumbnails-updated', batch)
    }, 80)
  }

  const pushUpdate = (payload: any) => {
    const fileId = String(payload?.fileId || '')
    if (!fileId) return
    pendingUpdates.set(fileId, payload)
    scheduleFlush()
  }

  const dataUrlToBytes = (dataUrl: string) => {
    const s = String(dataUrl || '')
    const idx = s.indexOf(',')
    if (idx < 0) return new Uint8Array()
    const base64 = s.slice(idx + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  const enqueue = (libraryPath: string, records: ContractFileRecord[], forceRetry = false) => {
    let added = 0;
    const existing = new Set(queue.value.map(t => String(t.fileId)));
    for (const record of records) {
      if (record.type !== 'file') continue;
      // Skip if already generated or permanently failed, unless forced
      if (!forceRetry && (record.previewStatus === 'completed' || record.previewStatus === 'failed')) continue;
      
      // Skip if already in queue
      const fileId = String(record.fileId);
      if (!fileId) continue;
      if (existing.has(fileId)) continue;

      queue.value.push({
        libraryPath,
        fileId,
        filePath: record.path,
        retryCount: 0,
        status: 'pending'
      });
      existing.add(fileId);
      added++;
    }

    if (added > 0) {
      for (let i = 0; i < concurrency; i++) {
        processQueue();
      }
    }
  };

  const processQueue = async () => {
    if (activeCount.value >= concurrency) return;
    
    const taskIndex = queue.value.findIndex(t => t.status === 'pending');
    if (taskIndex === -1) return;

    const task = queue.value[taskIndex];
    task.status = 'processing';
    activeCount.value++;

    try {
      const dataUrl = await PreviewAdapter.extractPreview(task.filePath, {
        quality: 0.75,
        width: 480
      });

      const thumbnailBytes = dataUrlToBytes(dataUrl)
      const res = await window.electronAPI.contractFiles.saveThumbnailFile({
        libraryPath: task.libraryPath,
        fileId: task.fileId,
        thumbnailBytes,
        ext: 'webp'
      });

      if (res.success) {
        task.status = 'completed';
        pushUpdate({
          libraryPath: task.libraryPath,
          fileId: task.fileId,
          firstPageThumb: res.data?.filePath || null,
          previewStatus: 'completed'
        });
      } else {
        throw new Error(res.error || 'Failed to update database');
      }
    } catch (error) {
      logger.error(`Failed to generate thumbnail for ${task.filePath}:`, error);
      task.retryCount++;
      if (task.retryCount >= 3) {
        task.status = 'failed';
        // Update DB to mark as failed so we don't try again indefinitely
        await window.electronAPI.contractFiles.updateThumbnail({
          libraryPath: task.libraryPath,
          fileId: task.fileId,
          firstPageThumb: null,
          previewStatus: 'failed'
        }).catch(err => logger.error('Failed to update thumbnail status', err));
        pushUpdate({
          libraryPath: task.libraryPath,
          fileId: task.fileId,
          firstPageThumb: null,
          previewStatus: 'failed'
        });
      } else {
        task.status = 'pending'; // Retry
      }
    } finally {
      activeCount.value--;
      
      // Clean up completed or failed tasks from memory queue
      if (task.status === 'completed' || task.status === 'failed') {
        const idx = queue.value.findIndex(t => t.fileId === task.fileId);
        if (idx !== -1) {
          queue.value.splice(idx, 1);
        }
      }

      // Process next
      processQueue();
    }
  };

  return {
    queue,
    isProcessing,
    enqueue
  };
});
