import * as fs from 'fs-extra';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

import copy = require('@apexearth/copy');

type NodeCallback = (err?: NodeJS.ErrnoException | null) => void;

export type CopyFileFn = (from: string, to: string, cb: NodeCallback) => void;

export interface ResumableBatchCopyOptions {
  recursive?: boolean;
  overwrite?: boolean;
  overwriteMismatches?: boolean;
  ignoreErrors?: boolean;
  parallelJobs?: number;
  stateFile?: string;
  stateFrequency?: number;
  copyFile?: CopyFileFn;
}

export class ResumableBatchCopyService {
  private logger = createLogger('ResumableBatchCopyService');

  async copyDir(from: string, to: string, options: ResumableBatchCopyOptions = {}): Promise<void> {
    const {
      recursive = true,
      overwrite = true,
      overwriteMismatches = false,
      ignoreErrors = false,
      parallelJobs = 4,
      stateFile,
      stateFrequency = 100,
      copyFile = this.createDefaultCopyFile(),
    } = options;

    await fs.ensureDir(to);

    this.logger.info(
      `copyDir start: from=${from}, to=${to}, recursive=${recursive}, parallelJobs=${parallelJobs}, state=${stateFile ? 'on' : 'off'}`
    );

    await copy({
      from,
      to,
      recursive,
      overwrite,
      overwriteMismatches,
      ignoreErrors,
      parallelJobs,
      state: stateFile,
      stateFrequency,
      copyFile,
    });
  }

  createDefaultCopyFile(): CopyFileFn {
    return (from, to, cb) => {
      fs.ensureDir(path.dirname(to))
        .then(() => fs.copyFile(from, to))
        .then(() => cb(null))
        .catch((err) => cb(err));
    };
  }
}

export async function runResumableBatchCopyIntegrationVerify(baseDir: string): Promise<void> {
  const root = baseDir;
  const srcDir = path.join(root, 'src');
  const destDir = path.join(root, 'dest');
  const stateFile = path.join(root, 'copy.state.json');

  await fs.remove(root);
  await fs.ensureDir(srcDir);

  const files: Array<{ rel: string; content: string }> = [
    { rel: 'a/1.txt', content: 'one' },
    { rel: 'a/2.txt', content: 'two' },
    { rel: 'a/b/3.txt', content: 'three' },
    { rel: 'a/b/4.txt', content: 'four' },
    { rel: 'c/5.txt', content: 'five' },
    { rel: 'c/d/6.txt', content: 'six' },
    { rel: 'c/d/e/7.txt', content: 'seven' },
    { rel: '8.txt', content: 'eight' },
  ];

  for (const f of files) {
    const abs = path.join(srcDir, f.rel);
    await fs.ensureDir(path.dirname(abs));
    await fs.writeFile(abs, f.content, 'utf8');
  }

  const service = new ResumableBatchCopyService();
  const defaultCopyFile = service.createDefaultCopyFile();

  let copiedCount = 0;
  const flakyCopyFile: CopyFileFn = (from, to, cb) => {
    copiedCount += 1;
    if (copiedCount === 4) {
      const err: NodeJS.ErrnoException = new Error('Simulated copy failure') as any;
      err.code = 'EIO';
      cb(err);
      return;
    }
    defaultCopyFile(from, to, cb);
  };

  let failedAsExpected = false;
  try {
    await service.copyDir(srcDir, destDir, {
      recursive: true,
      overwrite: true,
      parallelJobs: 4,
      stateFile,
      stateFrequency: 1,
      copyFile: flakyCopyFile,
    });
  } catch {
    failedAsExpected = true;
  }

  if (!failedAsExpected) {
    throw new Error('Expected simulated copy failure, but copy completed');
  }

  const hasState = await fs.pathExists(stateFile);
  if (!hasState) {
    throw new Error('State file was not created, cannot resume');
  }

  await service.copyDir(srcDir, destDir, {
    recursive: true,
    overwrite: true,
    parallelJobs: 4,
    stateFile,
    stateFrequency: 1,
  });

  for (const f of files) {
    const destAbs = path.join(destDir, f.rel);
    const exists = await fs.pathExists(destAbs);
    if (!exists) {
      throw new Error(`Missing file after resume: ${f.rel}`);
    }
    const content = await fs.readFile(destAbs, 'utf8');
    if (content !== f.content) {
      throw new Error(`Content mismatch after resume: ${f.rel}`);
    }
  }
}

