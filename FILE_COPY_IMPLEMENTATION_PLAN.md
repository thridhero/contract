# Electron 文件拷贝保障方案 - 执行计划

## 一、项目目标

实现一套可靠的文件拷贝系统，支持：
- 大文件（>100MB）分块断点续传
- 海量小文件（上万个）批量并发拷贝
- 终端中断后恢复
- 数据完整性校验

---

## 二、技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 核心框架 | Node.js + Electron | 主进程执行文件操作 |
| 文件操作 | `fs-extra` + 原生 `fs` | 增强文件系统操作 |
| 并发控制 | `p-limit` | 限制并发数，防止资源耗尽 |
| 哈希计算 | `xxhash-addon` 或 `crypto` | 快速校验（xxHash 比 MD5 快 10 倍） |
| 进度通信 | Electron IPC | 主进程 ↔ 渲染进程通信 |
| 任务持久化 | SQLite / JSON | 记录拷贝任务状态 |
| Windows 优化 | `node-powershell` + Robocopy | 调用系统级可靠拷贝 |

---

## 三、项目结构

```
src/
├── main/
│   ├── fileCopy/
│   │   ├── core/
│   │   │   ├── ChunkedCopier.js      # 大文件分块拷贝
│   │   │   ├── BatchCopier.js        # 批量小文件拷贝
│   │   │   └── AtomicWriter.js       # 原子写入（临时文件+重命名）
│   │   ├── strategies/
│   │   │   ├── RobocopyStrategy.js   # Windows Robocopy 封装
│   │   │   ├── RsyncStrategy.js      # 类 rsync 差量同步
│   │   │   └── NativeStrategy.js     # 原生 Node.js 实现
│   │   ├── utils/
│   │   │   ├── HashCalculator.js     # 哈希计算工具
│   │   │   ├── ProgressTracker.js    # 进度跟踪
│   │   │   └── TaskPersistence.js    # 任务持久化
│   │   ├── FileCopyManager.js        # 统一入口管理器
│   │   └── index.js                  # 导出模块
│   └── ipc/
│       └── fileCopyIPC.js            # IPC 通信处理
├── renderer/
│   └── components/
│       └── FileCopyDialog.vue        # 拷贝进度对话框
└── shared/
    └── constants.js                  # 常量定义（分块大小、并发数等）
```

---

## 四、开发阶段

### Phase 1: 基础架构（Week 1）

#### 4.1.1 核心工具类实现

```javascript
// src/main/fileCopy/utils/HashCalculator.js
const { createHash } = require('crypto');
const { createReadStream } = require('fs');

class HashCalculator {
  // MD5 计算（兼容性好）
  static async md5(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5');
      const stream = createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  // 抽样哈希（大文件快速比对）
  static async sampleHash(filePath, sampleSize = 1024 * 1024) {
    const fs = require('fs').promises;
    const stats = await fs.stat(filePath);
    const file = await fs.open(filePath, 'r');
    
    try {
      const hash = createHash('md5');
      // 读取头部、中部、尾部样本
      const positions = [0, Math.floor(stats.size / 2), Math.max(0, stats.size - sampleSize)];
      
      for (const pos of positions) {
        const buffer = Buffer.alloc(Math.min(sampleSize, stats.size - pos));
        await file.read(buffer, 0, buffer.length, pos);
        hash.update(buffer);
      }
      
      return hash.digest('hex');
    } finally {
      await file.close();
    }
  }
}
```

```javascript
// src/main/fileCopy/utils/TaskPersistence.js
const path = require('path');
const fs = require('fs-extra');

class TaskPersistence {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'copy-tasks.json');
    this.tasks = new Map();
    this.autoSaveInterval = null;
  }

  async init() {
    await fs.ensureFile(this.dbPath);
    const data = await fs.readJson(this.dbPath).catch(() => ({}));
    this.tasks = new Map(Object.entries(data));
    
    // 自动保存（每 5 秒）
    this.autoSaveInterval = setInterval(() => this.save(), 5000);
  }

  async save() {
    const data = Object.fromEntries(this.tasks);
    await fs.writeJson(this.dbPath, data, { spaces: 2 });
  }

  createTask(taskId, source, target, options) {
    const task = {
      id: taskId,
      source,
      target,
      status: 'pending', // pending, running, paused, completed, failed
      progress: {
        totalBytes: 0,
        copiedBytes: 0,
        currentFile: null,
        startedAt: null,
        completedAt: null
      },
      files: [], // 文件列表及状态
      options,
      createdAt: Date.now()
    };
    this.tasks.set(taskId, task);
    return task;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getPendingTasks() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'paused');
  }

  async cleanup() {
    clearInterval(this.autoSaveInterval);
    await this.save();
  }
}
```

#### 4.1.2 原子写入模块

```javascript
// src/main/fileCopy/core/AtomicWriter.js
const fs = require('fs-extra');
const path = require('path');
const HashCalculator = require('../utils/HashCalculator');

class AtomicWriter {
  constructor(options = {}) {
    this.verifyHash = options.verifyHash !== false; // 默认开启校验
    this.tempSuffix = options.tempSuffix || '.tmp';
  }

  async write(src, dest, onProgress) {
    const tempPath = dest + this.tempSuffix + '.' + Date.now();
    
    try {
      // 1. 确保目标目录存在
      await fs.ensureDir(path.dirname(dest));
      
      // 2. 拷贝到临时文件
      await fs.copy(src, tempPath, {
        overwrite: true,
        preserveTimestamps: true,
        filter: (src, dest) => {
          // 可以在这里添加进度回调
          return true;
        }
      });
      
      // 3. 校验（可选）
      if (this.verifyHash) {
        const [srcHash, destHash] = await Promise.all([
          HashCalculator.sampleHash(src),
          HashCalculator.sampleHash(tempPath)
        ]);
        
        if (srcHash !== destHash) {
          throw new Error(`文件校验失败: ${src}`);
        }
      }
      
      // 4. 原子重命名
      await fs.move(tempPath, dest, { overwrite: true });
      
    } catch (error) {
      // 清理临时文件
      await fs.remove(tempPath).catch(() => {});
      throw error;
    }
  }
}
```

### Phase 2: 大文件分块拷贝（Week 2）

```javascript
// src/main/fileCopy/core/ChunkedCopier.js
const fs = require('fs-extra');
const { createReadStream, createWriteStream } = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ChunkedCopier extends EventEmitter {
  constructor(options = {}) {
    super();
    this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 10MB
    this.retryTimes = options.retryTimes || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  async copy(src, dest, taskId, onProgress) {
    const stat = await fs.stat(src);
    const totalSize = stat.size;
    
    // 小文件直接拷贝
    if (totalSize < this.chunkSize) {
      return this._simpleCopy(src, dest, totalSize, onProgress);
    }
    
    // 大文件分块拷贝
    return this._chunkedCopy(src, dest, totalSize, taskId, onProgress);
  }

  async _chunkedCopy(src, dest, totalSize, taskId, onProgress) {
    const tempDest = dest + '.partial';
    const progressFile = dest + '.progress';
    
    // 读取断点进度
    let startOffset = 0;
    try {
      const progress = await fs.readJson(progressFile);
      if (progress.taskId === taskId && await fs.pathExists(tempDest)) {
        const tempStat = await fs.stat(tempDest);
        if (tempStat.size <= totalSize) {
          startOffset = tempStat.size;
          this.emit('resume', { taskId, startOffset, totalSize });
        }
      }
    } catch {
      // 无断点或损坏，从头开始
      startOffset = 0;
    }

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(src, {
        start: startOffset,
        highWaterMark: this.chunkSize
      });
      
      const writeStream = createWriteStream(tempDest, {
        flags: startOffset > 0 ? 'a' : 'w',
        start: startOffset
      });

      let copied = startOffset;
      let lastProgressUpdate = Date.now();

      readStream.on('data', (chunk) => {
        copied += chunk.length;
        
        // 节流进度更新（每 100ms）
        const now = Date.now();
        if (now - lastProgressUpdate > 100) {
          onProgress?.({
            copied,
            total: totalSize,
            percent: ((copied / totalSize) * 100).toFixed(2),
            speed: this._calculateSpeed(chunk.length, now - lastProgressUpdate)
          });
          lastProgressUpdate = now;
          
          // 保存进度
          this._saveProgress(progressFile, { taskId, copied, totalSize });
        }
      });

      writeStream.on('finish', async () => {
        try {
          // 删除进度文件
          await fs.remove(progressFile);
          // 重命名为最终文件
          await fs.move(tempDest, dest, { overwrite: true });
          resolve({ copied, total: totalSize });
        } catch (err) {
          reject(err);
        }
      });

      writeStream.on('error', reject);
      readStream.on('error', reject);

      readStream.pipe(writeStream);
    });
  }

  async _simpleCopy(src, dest, totalSize, onProgress) {
    await fs.copy(src, dest, { overwrite: true });
    onProgress?.({ copied: totalSize, total: totalSize, percent: '100.00' });
    return { copied: totalSize, total: totalSize };
  }

  _calculateSpeed(bytes, ms) {
    const seconds = ms / 1000;
    const speed = bytes / seconds;
    return this._formatBytes(speed) + '/s';
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async _saveProgress(progressFile, data) {
    await fs.writeJson(progressFile, data).catch(() => {});
  }
}
```

### Phase 3: 批量小文件并发拷贝（Week 2-3）

```javascript
// src/main/fileCopy/core/BatchCopier.js
const pLimit = require('p-limit');
const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');
const AtomicWriter = require('./AtomicWriter');

class BatchCopier extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 3; // 默认 3 并发
    this.atomicWriter = new AtomicWriter(options);
  }

  async copy(fileList, destDir, options = {}) {
    const limit = pLimit(this.concurrency);
    const results = {
      success: [],
      failed: [],
      total: fileList.length,
      completed: 0
    };

    // 预分析：分类大文件和小文件
    const categorized = await this._categorizeFiles(fileList);
    
    // 先处理大文件（单线程）
    for (const file of categorized.large) {
      try {
        await this._copySingleFile(file, destDir, options);
        results.success.push(file);
      } catch (err) {
        results.failed.push({ file, error: err.message });
      }
      results.completed++;
      this.emit('progress', this._createProgress(results, file));
    }

    // 批量处理小文件（并发）
    const tasks = categorized.small.map(file => 
      limit(async () => {
        try {
          await this._copySingleFile(file, destDir, options);
          results.success.push(file);
        } catch (err) {
          results.failed.push({ file, error: err.message });
        }
        results.completed++;
        this.emit('progress', this._createProgress(results, file));
      })
    );

    await Promise.all(tasks);
    return results;
  }

  async _categorizeFiles(fileList) {
    const largeFiles = [];
    const smallFiles = [];
    const threshold = 100 * 1024 * 1024; // 100MB

    for (const file of fileList) {
      try {
        const stat = await fs.stat(file.src);
        const fileWithSize = { ...file, size: stat.size };
        
        if (stat.size > threshold) {
          largeFiles.push(fileWithSize);
        } else {
          smallFiles.push(fileWithSize);
        }
      } catch (err) {
        // 文件不存在或无法访问，视为小文件处理
        smallFiles.push(file);
      }
    }

    return { large: largeFiles, small: smallFiles };
  }

  async _copySingleFile(file, destDir, options) {
    const destPath = path.join(destDir, file.relativePath || file.name);
    await fs.ensureDir(path.dirname(destPath));
    
    if (options.atomic !== false) {
      await this.atomicWriter.write(file.src, destPath);
    } else {
      await fs.copy(file.src, destPath, { overwrite: true });
    }
  }

  _createProgress(results, currentFile) {
    return {
      current: results.completed,
      total: results.total,
      percent: ((results.completed / results.total) * 100).toFixed(2),
      currentFile: currentFile?.src || currentFile?.name,
      successCount: results.success.length,
      failedCount: results.failed.length
    };
  }
}
```

### Phase 4: Windows Robocopy 封装（Week 3）

```javascript
// src/main/fileCopy/strategies/RobocopyStrategy.js
const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class RobocopyStrategy extends EventEmitter {
  constructor(options = {}) {
    super();
    this.retryTimes = options.retryTimes || 3;
    this.waitTime = options.waitTime || 5; // 秒
    this.threads = options.threads || 8;
  }

  isAvailable() {
    return process.platform === 'win32';
  }

  async copy(source, dest, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Robocopy 仅支持 Windows 平台');
    }

    const args = this._buildArgs(source, dest, options);
    
    return new Promise((resolve, reject) => {
      const proc = spawn('robocopy', args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        this._parseProgress(text);
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Robocopy exit codes:
        // 0-7: Success (0=no changes, 1=files copied, 2=extra files, 4=mismatches, 6=2+4, 7=1+2+4)
        // 8+: Error
        if (code <= 7) {
          resolve({
            exitCode: code,
            stdout,
            stderr,
            stats: this._parseStats(stdout)
          });
        } else {
          reject(new Error(`Robocopy failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  _buildArgs(source, dest, options) {
    const args = [
      source,
      dest,
      '/E',                       // 包含子目录
      '/Z',                       // 可重启模式（断点续传）
      `/R:${this.retryTimes}`,    // 重试次数
      `/W:${this.waitTime}`,      // 重试等待时间
      `/MT:${this.threads}`,      // 多线程
      '/NP',                      // 无进度百分比（减少输出）
      '/NDL',                     // 不记录目录名
      '/NC',                      // 不记录类别
      '/BYTES',                   // 以字节显示大小
      '/UNILOG+:robocopy.log'     // 记录到日志文件
    ];

    if (options.mirror) {
      args.push('/MIR');          // 镜像模式（会删除目标多余文件）
    }

    if (options.include) {
      args.push(options.include); // 文件过滤，如 *.jpg
    }

    if (options.exclude) {
      args.push('/XF', options.exclude);
    }

    return args;
  }

  _parseProgress(text) {
    // 解析 Robocopy 输出中的进度信息
    // 示例: "100%\tNew File\t123456\tfile.txt"
    const match = text.match(/(\d+)%\s+\w+\s+([\d,]+)\s+(.+)/);
    if (match) {
      this.emit('progress', {
        percent: match[1],
        bytes: parseInt(match[2].replace(/,/g, '')),
        file: match[3].trim()
      });
    }
  }

  _parseStats(stdout) {
    // 解析最终统计信息
    const stats = {};
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      if (line.includes('Files :')) {
        const match = line.match(/Files :\s*(\d+)/);
        if (match) stats.files = parseInt(match[1]);
      }
      if (line.includes('Bytes :')) {
        const match = line.match(/Bytes :\s*([\d,]+)/);
        if (match) stats.bytes = parseInt(match[1].replace(/,/g, ''));
      }
    }
    
    return stats;
  }
}
```

### Phase 5: 统一入口管理器（Week 4）

```javascript
// src/main/fileCopy/FileCopyManager.js
const ChunkedCopier = require('./core/ChunkedCopier');
const BatchCopier = require('./core/BatchCopier');
const RobocopyStrategy = require('./strategies/RobocopyStrategy');
const TaskPersistence = require('./utils/TaskPersistence');
const { v4: uuidv4 } = require('uuid');

class FileCopyManager {
  constructor(options = {}) {
    this.options = {
      chunkSize: 10 * 1024 * 1024,
      concurrency: 3,
      largeFileThreshold: 100 * 1024 * 1024,
      useRobocopy: true, // Windows 下优先使用 Robocopy
      ...options
    };
    
    this.chunkedCopier = new ChunkedCopier(this.options);
    this.batchCopier = new BatchCopier(this.options);
    this.robocopy = new RobocopyStrategy(this.options);
    this.persistence = new TaskPersistence(this.options.dbPath);
    
    this.activeTasks = new Map();
  }

  async init() {
    await this.persistence.init();
    
    // 恢复中断的任务
    const pendingTasks = this.persistence.getPendingTasks();
    for (const task of pendingTasks) {
      console.log(`发现中断的任务: ${task.id}`);
    }
  }

  /**
   * 智能拷贝 - 自动选择最佳策略
   */
  async copy(files, destDir, options = {}) {
    const taskId = options.taskId || uuidv4();
    
    // 分析任务特征
    const analysis = await this._analyzeFiles(files);
    
    // 选择策略
    const strategy = this._selectStrategy(analysis, options);
    
    // 创建任务记录
    const task = this.persistence.createTask(taskId, files, destDir, {
      strategy,
      analysis,
      ...options
    });

    // 执行拷贝
    try {
      this.persistence.updateTask(taskId, { status: 'running', 'progress.startedAt': Date.now() });
      this.activeTasks.set(taskId, { abortController: new AbortController() });
      
      const result = await this._executeWithStrategy(strategy, files, destDir, taskId, options);
      
      this.persistence.updateTask(taskId, { 
        status: 'completed', 
        'progress.completedAt': Date.now() 
      });
      
      return { taskId, ...result };
      
    } catch (error) {
      this.persistence.updateTask(taskId, { status: 'failed', error: error.message });
      throw error;
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  async _analyzeFiles(files) {
    const fs = require('fs-extra');
    let totalSize = 0;
    let largeFiles = 0;
    let smallFiles = 0;
    
    for (const file of files) {
      try {
        const stat = await fs.stat(file.src || file);
        totalSize += stat.size;
        if (stat.size > this.options.largeFileThreshold) {
          largeFiles++;
        } else {
          smallFiles++;
        }
      } catch {
        smallFiles++;
      }
    }
    
    return {
      fileCount: files.length,
      totalSize,
      largeFiles,
      smallFiles,
      avgSize: files.length > 0 ? totalSize / files.length : 0
    };
  }

  _selectStrategy(analysis, options) {
    // 强制指定
    if (options.strategy) return options.strategy;
    
    // Windows 大目录使用 Robocopy
    if (process.platform === 'win32' && 
        this.options.useRobocopy && 
        analysis.fileCount > 100) {
      return 'robocopy';
    }
    
    // 大文件为主使用分块拷贝
    if (analysis.largeFiles > 0 && analysis.smallFiles === 0) {
      return 'chunked';
    }
    
    // 默认批量拷贝
    return 'batch';
  }

  async _executeWithStrategy(strategy, files, destDir, taskId, options) {
    const onProgress = (progress) => {
      this.persistence.updateTask(taskId, { progress });
      options.onProgress?.(progress);
    };

    switch (strategy) {
      case 'robocopy':
        // 注意：Robocopy 需要源是目录
        const sourceDir = path.dirname(files[0].src || files[0]);
        return this.robocopy.copy(sourceDir, destDir, { onProgress });
        
      case 'chunked':
        // 大文件逐个处理
        const results = [];
        for (const file of files) {
          const src = file.src || file;
          const dest = require('path').join(destDir, file.name || path.basename(src));
          const result = await this.chunkedCopier.copy(src, dest, taskId, onProgress);
          results.push(result);
        }
        return { files: results };
        
      case 'batch':
      default:
        return this.batchCopier.copy(files, destDir, { onProgress });
    }
  }

  /**
   * 暂停任务
   */
  pause(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task?.abortController) {
      task.abortController.abort();
      this.persistence.updateTask(taskId, { status: 'paused' });
    }
  }

  /**
   * 恢复任务
   */
  async resume(taskId, options = {}) {
    const task = this.persistence.getTask(taskId);
    if (!task || task.status !== 'paused') {
      throw new Error('任务不存在或无法恢复');
    }
    
    return this.copy(task.source, task.target, {
      ...task.options,
      ...options,
      taskId
    });
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    return this.persistence.getTask(taskId);
  }

  async cleanup() {
    await this.persistence.cleanup();
  }
}
```

### Phase 6: IPC 通信层（Week 4）

```javascript
// src/main/ipc/fileCopyIPC.js
const { ipcMain } = require('electron');
const FileCopyManager = require('../fileCopy/FileCopyManager');

let fileCopyManager = null;

function initFileCopyIPC() {
  fileCopyManager = new FileCopyManager();
  fileCopyManager.init();

  // 开始拷贝
  ipcMain.handle('file-copy:start', async (event, { files, dest, options }) => {
    try {
      const result = await fileCopyManager.copy(files, dest, {
        ...options,
        onProgress: (progress) => {
          // 发送进度到渲染进程
          event.sender.send('file-copy:progress', {
            taskId: result?.taskId,
            ...progress
          });
        }
      });
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 暂停任务
  ipcMain.handle('file-copy:pause', (event, { taskId }) => {
    fileCopyManager.pause(taskId);
    return { success: true };
  });

  // 恢复任务
  ipcMain.handle('file-copy:resume', async (event, { taskId, options }) => {
    try {
      const result = await fileCopyManager.resume(taskId, {
        ...options,
        onProgress: (progress) => {
          event.sender.send('file-copy:progress', {
            taskId,
            ...progress
          });
        }
      });
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 查询任务状态
  ipcMain.handle('file-copy:status', (event, { taskId }) => {
    const status = fileCopyManager.getTaskStatus(taskId);
    return { success: true, status };
  });

  // 获取中断的任务列表
  ipcMain.handle('file-copy:pending-tasks', () => {
    const tasks = fileCopyManager.persistence.getPendingTasks();
    return { success: true, tasks };
  });
}

module.exports = { initFileCopyIPC };
```

---

## 五、测试方案

### 5.1 单元测试

```javascript
// tests/fileCopy/ChunkedCopier.test.js
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ChunkedCopier = require('../../src/main/fileCopy/core/ChunkedCopier');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ChunkedCopier', () => {
  let copier;
  let tempDir;

  beforeEach(async () => {
    copier = new ChunkedCopier({ chunkSize: 1024 }); // 1KB 分块便于测试
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('应正确拷贝小文件', async () => {
    const src = path.join(tempDir, 'small.txt');
    const dest = path.join(tempDir, 'small-copy.txt');
    await fs.writeFile(src, 'Hello World');

    const result = await copier.copy(src, dest, 'task-1');
    
    expect(result.copied).toBe(11);
    expect(await fs.readFile(dest, 'utf8')).toBe('Hello World');
  });

  it('应支持断点续传', async () => {
    const src = path.join(tempDir, 'large.bin');
    const dest = path.join(tempDir, 'large-copy.bin');
    
    // 创建 10KB 文件
    const data = Buffer.alloc(10 * 1024, 'A');
    await fs.writeFile(src, data);

    // 模拟部分拷贝中断
    const partialData = Buffer.alloc(5 * 1024, 'A');
    await fs.writeFile(dest + '.partial', partialData);
    await fs.writeJson(dest + '.progress', { taskId: 'task-2', copied: 5 * 1024 });

    const progressEvents = [];
    await copier.copy(src, dest, 'task-2', (p) => progressEvents.push(p));

    // 验证从中断处继续
    expect(progressEvents[0].copied).toBeGreaterThanOrEqual(5 * 1024);
    expect(await fs.readFile(dest)).toEqual(data);
  });
});
```

### 5.2 集成测试

```javascript
// tests/fileCopy/FileCopyManager.test.js
describe('FileCopyManager 集成测试', () => {
  it('应正确处理混合文件（大小文件混合）', async () => {
    const manager = new FileCopyManager();
    await manager.init();

    // 创建测试文件：1 个大文件(150MB) + 100 个小文件(1MB)
    const files = await createMixedFiles(tempDir, { large: 1, small: 100 });
    const destDir = path.join(tempDir, 'dest');

    const progressEvents = [];
    const result = await manager.copy(files, destDir, {
      onProgress: (p) => progressEvents.push(p)
    });

    expect(result.success).toBe(true);
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[progressEvents.length - 1].percent).toBe('100.00');
  });

  it('应在中断后恢复', async () => {
    const manager = new FileCopyManager();
    await manager.init();

    const files = await createLargeFiles(tempDir, 5); // 5 个大文件
    const destDir = path.join(tempDir, 'dest');

    // 开始拷贝
    const copyPromise = manager.copy(files, destDir, {
      taskId: 'resume-test'
    });

    // 500ms 后暂停
    setTimeout(() => manager.pause('resume-test'), 500);

    try {
      await copyPromise;
    } catch {
      // 预期会中断
    }

    // 验证任务状态为 paused
    const status = manager.getTaskStatus('resume-test');
    expect(status.status).toBe('paused');

    // 恢复任务
    const resumeResult = await manager.resume('resume-test');
    expect(resumeResult.success).toBe(true);
  });
});
```

### 5.3 性能测试基准

| 测试场景 | 文件规格 | 目标性能 |
|---------|---------|---------|
| 单个大文件 | 10GB | 速度 ≥ 磁盘顺序写入速度的 80%，支持中断恢复 |
| 海量小文件 | 10000 个 × 1MB | 完成时间 < 10 分钟（SSD） |
| 混合场景 | 1×10GB + 1000×1MB | 智能分配策略，大文件不阻塞小文件队列 |
| 中断恢复 | 10GB 文件 @ 50% | 恢复时间 < 5 秒，数据不丢失 |

---

## 六、部署与集成

### 6.1 在主进程中初始化

```javascript
// src/main/index.js
const { app } = require('electron');
const { initFileCopyIPC } = require('./ipc/fileCopyIPC');

app.whenReady().then(() => {
  // 初始化文件拷贝 IPC
  initFileCopyIPC();
  
  // ... 其他初始化
});
```

### 6.2 渲染进程调用示例

```javascript
// src/renderer/composables/useFileCopy.js
import { ipcRenderer } from 'electron';
import { ref } from 'vue';

export function useFileCopy() {
  const progress = ref(0);
  const status = ref('idle');
  const currentFile = ref('');

  // 监听进度
  ipcRenderer.on('file-copy:progress', (event, data) => {
    progress.value = parseFloat(data.percent);
    currentFile.value = data.currentFile || '';
  });

  async function startCopy(files, dest) {
    status.value = 'copying';
    const result = await ipcRenderer.invoke('file-copy:start', {
      files: files.map(f => ({ src: f.path, name: f.name })),
      dest
    });
    status.value = result.success ? 'completed' : 'failed';
    return result;
  }

  async function pauseCopy(taskId) {
    await ipcRenderer.invoke('file-copy:pause', { taskId });
    status.value = 'paused';
  }

  async function resumeCopy(taskId) {
    status.value = 'copying';
    const result = await ipcRenderer.invoke('file-copy:resume', { taskId });
    status.value = result.success ? 'completed' : 'failed';
    return result;
  }

  return {
    progress,
    status,
    currentFile,
    startCopy,
    pauseCopy,
    resumeCopy
  };
}
```

### 6.3 Vue 组件示例

```vue
<!-- src/renderer/components/FileCopyDialog.vue -->
<template>
  <div class="copy-dialog" v-if="status !== 'idle'">
    <div class="header">
      <h3>文件拷贝中...</h3>
      <span class="status">{{ statusText }}</span>
    </div>
    
    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="percent">{{ progress.toFixed(1) }}%</span>
    </div>
    
    <div class="file-info" v-if="currentFile">
      当前文件: {{ currentFile }}
    </div>
    
    <div class="actions">
      <button v-if="status === 'copying'" @click="pause">
        暂停
      </button>
      <button v-if="status === 'paused'" @click="resume">
        继续
      </button>
      <button @click="cancel">取消</button>
    </div>
  </div>
</template>

<script setup>
import { useFileCopy } from '../composables/useFileCopy';

const { progress, status, currentFile, pauseCopy, resumeCopy } = useFileCopy();

const statusText = computed(() => ({
  idle: '就绪',
  copying: '拷贝中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败'
}[status.value]));

async function pause() {
  await pauseCopy(props.taskId);
}

async function resume() {
  await resumeCopy(props.taskId);
}
</script>
```

---

## 七、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 磁盘空间不足 | 拷贝中断，临时文件残留 | 拷贝前检查空间，临时文件定期清理 |
| 权限不足 | 无法写入目标目录 | 提前检测权限，友好提示用户 |
| 文件名冲突 | 数据覆盖或失败 | 提供重命名、跳过、覆盖策略选项 |
| 网络存储超时 | NAS/SMB 拷贝失败 | 增加重试机制，降低并发数 |
| 内存溢出 | 海量文件导致内存耗尽 | 流式处理，限制并发，定期 GC |

---

## 八、里程碑

| 阶段 | 时间 | 交付物 |
|------|------|-------|
| Phase 1 | Week 1 | 基础工具类（哈希、持久化、原子写入） |
| Phase 2 | Week 2 | 大文件分块拷贝 + 断点续传 |
| Phase 3 | Week 2-3 | 批量小文件并发拷贝 |
| Phase 4 | Week 3 | Windows Robocopy 封装 |
| Phase 5 | Week 4 | 统一入口管理器 + IPC 通信 |
| Phase 6 | Week 4-5 | 测试 + 集成 + 文档 |

---

## 九、依赖安装

```bash
# 核心依赖
npm install fs-extra p-limit xxhash-addon uuid

# 开发依赖
npm install --save-dev jest @jest/globals

# Windows 特定（可选）
npm install node-powershell
```

---

## 十、注意事项

1. **xxHash 优势**: 比 MD5 快 10 倍以上，适合大文件校验
2. **Robocopy 限制**: 仅 Windows，源必须是目录
3. **并发控制**: 并发数过高会导致磁盘 IO 争用，建议 3-5
4. **临时文件**: 定期清理 `.tmp`、`.partial`、`.progress` 文件
5. **电源管理**: 大文件拷贝时阻止系统休眠

```javascript
// 防止休眠
const { powerSaveBlocker } = require('electron');
const id = powerSaveBlocker.start('prevent-app-suspension');
// 拷贝完成后...
powerSaveBlocker.stop(id);
```
