import { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as channels from '../../channels';
import { ok, fail, IpcResponse } from '../../../../shared/types/ipc.types';
import { BootstrapService } from '../../../services/system/BootstrapService';

const BATCH_IMPORT_SUPPORTED_EXTS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.pdf',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
]);

const scanContractFilesInFolder = (folderPath: string): string[] => {
  const queue = [path.resolve(folderPath)];
  const results: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        return;
      }
      if (!entry.isFile()) return;
      const ext = path.extname(entry.name).toLowerCase();
      if (!BATCH_IMPORT_SUPPORTED_EXTS.has(ext)) return;
      results.push(fullPath);
    });
  }
  return results.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
};

export const contractHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {
  [channels.CONTRACT_UPLOAD]: async (_, sourcePath: unknown): Promise<IpcResponse<{ fileId: string; tempPath: string; previewPath: string }>> => {
    try {
      const src = String(sourcePath);
      if (!fs.existsSync(src)) {
        throw new Error('文件不存在');
      }

      const config = BootstrapService.getInstance().readConfig();
      const libraryRoot = String(config?.projectPath || '').trim();
      if (!libraryRoot) {
        throw new Error('资源库未初始化，无法上传文件');
      }

      const fileId = crypto.randomUUID();
      const originalName = path.basename(src);
      const uploadRootDir = path.join(path.resolve(libraryRoot), '.tmp', 'contract_uploads', fileId);
      fs.mkdirSync(uploadRootDir, { recursive: true });
      const originalTempPath = path.join(uploadRootDir, originalName);

      fs.copyFileSync(src, originalTempPath);

      const tempPath = originalTempPath;
      return ok({ fileId, tempPath, previewPath: originalTempPath });
    } catch (e: any) {
      return fail(e.message || String(e));
    }
  },
  [channels.CONTRACT_SCAN_FOLDER]: async (_event, folderPath: unknown): Promise<IpcResponse<{ folderPath: string; filePaths: string[]; total: number }>> => {
    try {
      const targetPath = path.resolve(String(folderPath || '').trim());
      if (!targetPath) {
        throw new Error('文件夹路径不能为空');
      }
      if (!fs.existsSync(targetPath)) {
        throw new Error('文件夹不存在');
      }
      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        throw new Error('目标路径不是文件夹');
      }
      const filePaths = scanContractFilesInFolder(targetPath);
      return ok({
        folderPath: targetPath,
        filePaths,
        total: filePaths.length,
      });
    } catch (e: any) {
      return fail(e.message || String(e));
    }
  },
};
