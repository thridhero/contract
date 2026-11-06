import { IpcMainInvokeEvent, shell, BrowserWindow, dialog, clipboard, nativeImage } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as iconv from 'iconv-lite';
import jschardet from 'jschardet';
import * as channels from '../../channels';
import { ok, IpcResponse } from '../../../../shared/types/ipc.types';
import type { FileSystemEntry } from '../../../../shared/types/fileSystem.types';
import { createLogger } from '../../../utils/logger';
import { BootstrapService } from '../../../services/system/BootstrapService';

const logger = createLogger('FileSystemHandlers');

interface FileInfo {
  name: string;
  size: number;
  type: string;
  createdAt: number;
  lastModified: number;
  imageWidth?: number;
  imageHeight?: number;
}

interface CopyResult {
  success: boolean;
  destPath: string;
  checksum: string;
  fileSize: number;
}

type CopyFilesOptions = {
  destNames?: string[];
};

interface ReadFileTextOptions {
  maxBytes?: number;
}

interface ReadFileTextResult {
  text: string;
  encoding: string;
  truncated: boolean;
  bytesRead: number;
  fileSize: number;
}

const getRootPath = () => {
  const config = BootstrapService.getInstance().readConfig();
  const rootPath = String(config?.projectPath || '').trim();
  if (!rootPath) {
    throw new Error('资源库未初始化，无法执行文件操作');
  }
  return path.resolve(rootPath);
};

const assertWithinRoot = (targetPath: string) => {
  const root = getRootPath();
  const requested = path.resolve(String(targetPath || ''));
  const rel = path.relative(root, requested);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('无权限访问该路径');
  }
  return { root, requested };
};

const resolveReadablePath = (targetPath: string) => {
  const requested = path.resolve(String(targetPath || '').trim());
  if (!requested) {
    throw new Error('路径不能为空');
  }
  if (!fs.existsSync(requested)) {
    throw new Error('目标路径不存在');
  }
  return requested;
};

function detectBom(sample: Buffer): { encoding: string; bomBytes: number } | null {
  if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) return { encoding: 'utf8', bomBytes: 3 };
  if (sample.length >= 2 && sample[0] === 0xff && sample[1] === 0xfe) return { encoding: 'utf16-le', bomBytes: 2 };
  if (sample.length >= 2 && sample[0] === 0xfe && sample[1] === 0xff) return { encoding: 'utf16-be', bomBytes: 2 };
  return null;
}

function scoreDecodedText(text: string): number {
  let score = 0;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  score -= replacementCount * 8;
  const mojibakePenaltyTokens = ['锟', '鍚', '缂', '搴', '鏁', '澶', '鑳'];
  for (const token of mojibakePenaltyTokens) {
    const count = (text.match(new RegExp(token, 'g')) || []).length;
    score -= Math.min(count, 30);
  }
  const controlChars = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  score -= Math.min(controlChars, 50);
  return score;
}

function normalizeEncodingName(input: string): string {
  const v = String(input || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('utf-8') || v === 'utf8' || v === 'unicode-1-1-utf-8') return 'utf8';
  if (v.includes('utf-16le') || v === 'utf16le') return 'utf16-le';
  if (v.includes('utf-16be') || v === 'utf16be') return 'utf16-be';
  if (v.includes('ascii')) return 'utf8';
  if (v.includes('gb')) return 'gb18030';
  if (v.includes('big5')) return 'big5';
  return v;
}

function guessTextEncoding(sample: Buffer): { encoding: string; bomBytes: number } {
  const bom = detectBom(sample);
  if (bom) return bom;

  const utf8Text = sample.toString('utf8');
  const gbkText = iconv.decode(sample, 'gbk');
  const utf8Score = scoreDecodedText(utf8Text);
  const gbkScore = scoreDecodedText(gbkText);
  if (utf8Score !== gbkScore) return { encoding: utf8Score > gbkScore ? 'utf8' : 'gb18030', bomBytes: 0 };

  const detection = jschardet.detect(sample);
  const enc = normalizeEncodingName(String(detection?.encoding || ''));
  if (enc && iconv.encodingExists(enc)) return { encoding: enc, bomBytes: 0 };

  return { encoding: 'utf8', bomBytes: 0 };
}

/** 计算文件 SHA256 checksum */
function computeChecksum(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

/** 流式拷贝文件，每隔一段时间向渲染进程推送进度 */
function copyFileWithProgress(
  src: string,
  dest: string,
  win: BrowserWindow,
  fileIndex: number,
  totalFiles: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(src);
    const total = stat.size;
    let copied = 0;
    let lastReport = Date.now();

    const readStream = fs.createReadStream(src);
    const writeStream = fs.createWriteStream(dest);

    readStream.on('data', (chunk: Buffer) => {
      copied += chunk.length;
      const now = Date.now();
      if (now - lastReport >= 100) {
        lastReport = now;
        try {
          win.webContents.send(channels.FS_COPY_PROGRESS, {
            fileIndex,
            totalFiles,
            fileName: path.basename(src),
            bytesWritten: copied,
            totalBytes: total,
            percent: total > 0 ? Math.round((copied / total) * 100) : 0,
          });
        } catch { /* 窗口可能已关闭 */ }
      }
    });

    readStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    readStream.on('error', reject);
    writeStream.on('error', reject);
  });
}

function buildCfHdropBuffer(filePaths: string[]): Buffer {
  const paths = (filePaths || []).map((p) => path.resolve(String(p || '').trim())).filter(Boolean);
  if (paths.length === 0) throw new Error('文件路径不能为空');

  const list = `${paths.join('\0')}\0\0`;
  const fileList = Buffer.from(list, 'utf16le');

  const headerSize = 20;
  const buf = Buffer.alloc(headerSize + fileList.length);
  buf.writeUInt32LE(headerSize, 0);
  buf.writeInt32LE(0, 4);
  buf.writeInt32LE(0, 8);
  buf.writeUInt32LE(0, 12);
  buf.writeUInt32LE(1, 16);
  fileList.copy(buf, headerSize);
  return buf;
}

function writeFileDropListToClipboardWithPowershell(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$paths = New-Object System.Collections.Specialized.StringCollection',
      '$paths.Add($env:TRAE_CLIPBOARD_FILE_PATH) | Out-Null',
      '[System.Windows.Forms.Clipboard]::SetFileDropList($paths)',
    ].join('; ');
    const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
    let stderr = '';
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
      {
        windowsHide: true,
        env: {
          ...process.env,
          TRAE_CLIPBOARD_FILE_PATH: filePath,
        },
      },
    );

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      stderr += text;
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `写入文件剪贴板失败，退出码: ${String(code)}`));
    });
  });
}

function writeFileDropListToClipboard(filePath: string): Promise<void> {
  try {
    const p = path.resolve(String(filePath || '').trim());
    clipboard.clear();
    clipboard.writeBuffer('CF_HDROP', buildCfHdropBuffer([p]));
    return Promise.resolve();
  } catch {
    return writeFileDropListToClipboardWithPowershell(filePath);
  }
}

function sanitizeFileName(input: string): string {
  let name = String(input || '').trim();
  name = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  name = name.replace(/[. ]+$/g, '');
  if (!name) name = 'file';

  const reserved = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ]);
  const baseUpper = path.basename(name, path.extname(name)).toUpperCase();
  if (reserved.has(baseUpper)) {
    name = `_${name}`;
  }

  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const maxBaseLen = 180;
  if (base.length > maxBaseLen) {
    name = `${base.slice(0, maxBaseLen)}${ext}`;
  }
  return name;
}

function makeUniqueDestPath(destDir: string, fileName: string): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = path.join(destDir, fileName);
  if (!fs.existsSync(candidate)) return candidate;
  let index = 2;
  while (true) {
    candidate = path.join(destDir, `${base} (${index})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    index += 1;
  }
}

export const fileSystemHandlers: Record<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>> = {

  /** 批量拷贝文件到目标目录，带进度推送 */
  [channels.FS_COPY_FILES]: async (event, srcPaths: unknown, destDir: unknown, options?: unknown): Promise<IpcResponse<CopyResult[]>> => {
    const sources = srcPaths as string[];
    const target = String(destDir);
    fs.mkdirSync(target, { recursive: true });

    const win = BrowserWindow.fromWebContents(event.sender);
    const results: CopyResult[] = [];

    const opts = (options && typeof options === 'object') ? (options as CopyFilesOptions) : undefined;
    const destNames = Array.isArray(opts?.destNames) ? opts!.destNames!.map((v) => String(v || '')) : undefined;

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const rawName = destNames?.[i] ? destNames[i] : path.basename(src);
      const fileName = sanitizeFileName(path.basename(rawName));
      const dest = destNames?.[i] ? makeUniqueDestPath(target, fileName) : path.join(target, fileName);

      if (win) {
        await copyFileWithProgress(src, dest, win, i, sources.length);
      } else {
        fs.copyFileSync(src, dest);
      }

      const checksum = computeChecksum(dest);
      const fileSize = fs.statSync(dest).size;
      results.push({ success: true, destPath: dest, checksum, fileSize });
    }

    return ok(results);
  },

  [channels.FS_LIST_DIR]: async (_event, dirPath: unknown): Promise<IpcResponse<FileSystemEntry[]>> => {
    const config = BootstrapService.getInstance().readConfig();
    const rootPath = String(config?.projectPath || '').trim();
    if (!rootPath) {
      throw new Error('资源库未初始化，无法读取目录');
    }

    const requested = path.resolve(String(dirPath || ''));
    const root = path.resolve(rootPath);
    const rel = path.relative(root, requested);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('无权限访问该路径');
    }

    const stat = fs.statSync(requested);
    if (!stat.isDirectory()) {
      throw new Error('目标路径不是文件夹');
    }

    const entries = fs.readdirSync(requested, { withFileTypes: true }).map((dirent) => {
      const fullPath = path.join(requested, dirent.name);
      const itemStat = fs.statSync(fullPath);
      const kind: FileSystemEntry['kind'] = dirent.isDirectory() ? 'directory' : 'file';
      return {
        name: dirent.name,
        path: fullPath,
        kind,
        size: kind === 'file' ? itemStat.size : 0,
        lastModified: itemStat.mtimeMs,
      } satisfies FileSystemEntry;
    });

    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    });

    return ok(entries);
  },

  /** 用系统默认应用打开文件 */
  [channels.FS_OPEN_FILE]: async (_, filePath: unknown): Promise<IpcResponse> => {
    // bypass assertWithinRoot for external paths (like files saved via dialog)
    const requested = path.resolve(String(filePath || ''));
    if (!fs.existsSync(requested)) {
      throw new Error('文件不存在');
    }
    await shell.openPath(requested);
    return ok();
  },

  /** 在资源管理器中打开文件夹 */
  [channels.FS_OPEN_FOLDER]: async (_, folderPath: unknown): Promise<IpcResponse> => {
    // bypass assertWithinRoot for external folders
    const requested = path.resolve(String(folderPath || ''));
    if (!fs.existsSync(requested)) {
      throw new Error('文件夹不存在');
    }
    await shell.openPath(requested);
    return ok();
  },

  /** 获取文件元信息 */
  [channels.FS_GET_FILE_INFO]: async (_, filePath: unknown): Promise<IpcResponse<FileInfo>> => {
    const requested = resolveReadablePath(String(filePath || ''));
    const stat = fs.statSync(requested);
    const ext = path.extname(requested).toLowerCase();

    const info: FileInfo = {
      name: path.basename(requested),
      size: stat.isFile() ? stat.size : 0,
      type: ext,
      createdAt: stat.birthtimeMs,
      lastModified: stat.mtimeMs,
    };

    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'];
    if (stat.isFile() && imageExts.includes(ext)) {
      try {
        const img = nativeImage.createFromPath(requested);
        const { width, height } = img.getSize();
        if (width > 0 && height > 0) {
          info.imageWidth = width;
          info.imageHeight = height;
        }
      } catch (e: any) {
        logger.warn(`读取图片尺寸失败: ${requested}`, { error: e?.message || String(e) });
      }
    }

    return ok<FileInfo>(info);
  },

  /** 删除文件（移入系统回收站） */
  [channels.FS_DELETE_FILE]: async (_, filePath: unknown): Promise<IpcResponse> => {
    const { requested } = assertWithinRoot(String(filePath));
    await shell.trashItem(requested);
    return ok();
  },

  /** 创建文件夹 */
  [channels.FS_CREATE_FOLDER]: async (_, folderPath: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    const { requested } = assertWithinRoot(String(folderPath));
    fs.mkdirSync(requested, { recursive: true });
    return ok({ success: true });
  },

  /** 选择文件对话框 */
  [channels.FS_SELECT_FILE]: async (event, options?: Electron.OpenDialogOptions): Promise<IpcResponse<Electron.OpenDialogReturnValue>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const defaultOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      ...options
    };
    const result = win 
      ? await dialog.showOpenDialog(win, defaultOptions)
      : await dialog.showOpenDialog(defaultOptions);
    return ok(result);
  },

  [channels.FS_SAVE_FILE]: async (event, options?: Electron.SaveDialogOptions): Promise<IpcResponse<Electron.SaveDialogReturnValue>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = win
      ? await dialog.showSaveDialog(win, options || {})
      : await dialog.showSaveDialog(options || {});
    return ok(result);
  },

  [channels.FS_WRITE_FILE]: async (_, filePath: unknown, content: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    const p = String(filePath);
    const c = String(content);
    fs.writeFileSync(p, c, 'utf-8');
    return ok({ success: true });
  },

  [channels.FS_READ_FILE_BYTES]: async (_event, filePath: unknown): Promise<IpcResponse<Uint8Array>> => {
    const requested = resolveReadablePath(String(filePath || ''));
    const buf = fs.readFileSync(requested);
    return ok(new Uint8Array(buf));
  },

  [channels.FS_READ_FILE_TEXT]: async (_event, filePath: unknown, options?: ReadFileTextOptions): Promise<IpcResponse<ReadFileTextResult>> => {
    const { requested } = assertWithinRoot(String(filePath));
    const stat = fs.statSync(requested);
    if (!stat.isFile()) throw new Error('目标不是文件');

    const fileSize = Number(stat.size || 0);
    const maxBytesRaw = Number((options as any)?.maxBytes ?? 2 * 1024 * 1024);
    const maxBytes = Math.max(1024, Math.min(10 * 1024 * 1024, Math.floor(Number.isFinite(maxBytesRaw) ? maxBytesRaw : 2 * 1024 * 1024)));
    const toRead = Math.max(0, Math.min(fileSize, maxBytes));

    const buffer = Buffer.alloc(Math.max(0, toRead));
    let bytesRead = 0;
    if (toRead > 0) {
      const fd = fs.openSync(requested, 'r');
      try {
        bytesRead = fs.readSync(fd, buffer, 0, toRead, 0);
      } finally {
        fs.closeSync(fd);
      }
    }

    const slice = buffer.subarray(0, Math.max(0, bytesRead));
    const { encoding, bomBytes } = guessTextEncoding(slice.subarray(0, Math.min(slice.length, 65536)));
    const body = slice.subarray(Math.min(slice.length, Math.max(0, bomBytes)));
    const text = iconv.decode(body, encoding);
    const truncated = fileSize > bytesRead;

    return ok({
      text,
      encoding,
      truncated,
      bytesRead,
      fileSize,
    });
  },

  [channels.FS_WRITE_FILE_BYTES]: async (_event, filePath: unknown, bytes: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    // bypass assertWithinRoot to allow writing to external paths chosen via saveDialog
    const p = path.resolve(String(filePath || '').trim());
    if (!p) throw new Error('保存路径不能为空');

    const b: any = bytes as any;
    let buf: Buffer;
    if (Buffer.isBuffer(b)) {
      buf = b;
    } else if (b instanceof Uint8Array) {
      buf = Buffer.from(b);
    } else if (Array.isArray(b)) {
      buf = Buffer.from(b);
    } else if (b && b.type === 'Buffer' && Array.isArray(b.data)) {
      buf = Buffer.from(b.data);
    } else if (b instanceof ArrayBuffer) {
      buf = Buffer.from(new Uint8Array(b));
    } else {
      throw new Error('无效的文件数据');
    }

    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, buf);
    return ok({ success: true });
  },

  [channels.CLIPBOARD_WRITE_FILE]: async (_, filePath: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    const p = String(filePath);
    if (!p) throw new Error('文件路径不能为空');
    if (!fs.existsSync(p)) throw new Error('文件不存在');

    const ext = path.extname(p).toLowerCase().slice(1);
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'];
    if (imageExts.includes(ext)) {
      const buf = fs.readFileSync(p);
      const image = nativeImage.createFromBuffer(buf);
      clipboard.writeImage(image);
    } else {
      await writeFileDropListToClipboard(p);
    }
    return ok({ success: true });
  },

  [channels.CLIPBOARD_WRITE_IMAGE_BYTES]: async (_, bytes: unknown): Promise<IpcResponse<{ success: boolean }>> => {
    const b: any = bytes as any;
    let buf: Buffer;
    if (Buffer.isBuffer(b)) {
      buf = b;
    } else if (b instanceof Uint8Array) {
      buf = Buffer.from(b);
    } else if (Array.isArray(b)) {
      buf = Buffer.from(b);
    } else if (b && b.type === 'Buffer' && Array.isArray(b.data)) {
      buf = Buffer.from(b.data);
    } else if (b instanceof ArrayBuffer) {
      buf = Buffer.from(new Uint8Array(b));
    } else {
      throw new Error('无效的图片数据');
    }

    const image = nativeImage.createFromBuffer(buf);
    if (image.isEmpty()) {
      throw new Error('图片数据无法写入剪贴板');
    }

    clipboard.writeImage(image);
    return ok({ success: true });
  },
};
