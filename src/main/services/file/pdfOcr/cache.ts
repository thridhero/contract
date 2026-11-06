import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';

export type SourceSnapshot = {
  size: number;
  mtimeMs: number;
};

export type CacheManifest = {
  filePath: string;
  sourceSize: number;
  sourceMtime: number;
  markdownPath: string;
  pageCount: number;
  engine: string;
  engineVersion: string;
  updatedAt: string;
};

export type OcrPipelineResult = {
  markdown: string;
  pageCount: number;
  engineVersion: string;
};

export function getCacheDir(ocrRootDir: string, filePath: string): string {
  const fileKey = crypto.createHash('sha1').update(path.resolve(filePath)).digest('hex');
  return path.join(ocrRootDir, fileKey.slice(0, 2), fileKey);
}

export async function writeCache(
  args: {
    filePath: string;
    snapshot: SourceSnapshot;
    result: OcrPipelineResult;
    ocrRootDir: string;
    engine: string;
  },
): Promise<CacheManifest> {
  const cacheDir = getCacheDir(args.ocrRootDir, args.filePath);
  await fs.ensureDir(cacheDir);

  const markdownPath = path.join(
    cacheDir,
    `${path.basename(args.filePath, path.extname(args.filePath))}.ocr.md`,
  );
  const manifestPath = path.join(cacheDir, 'manifest.json');
  const manifest: CacheManifest = {
    filePath: args.filePath,
    sourceSize: args.snapshot.size,
    sourceMtime: args.snapshot.mtimeMs,
    markdownPath,
    pageCount: args.result.pageCount,
    engine: args.engine,
    engineVersion: args.result.engineVersion,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(markdownPath, args.result.markdown, 'utf-8');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });

  return manifest;
}

export async function readValidCache(
  args: {
    filePath: string;
    snapshot: SourceSnapshot;
    ocrRootDir: string;
    onWarn?: (message: string, error: unknown) => void;
  },
): Promise<{ manifest: CacheManifest; markdown: string } | null> {
  const cacheDir = getCacheDir(args.ocrRootDir, args.filePath);
  const manifestPath = path.join(cacheDir, 'manifest.json');
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  try {
    const manifest = await fs.readJson(manifestPath) as CacheManifest;
    if (
      manifest.filePath !== args.filePath
      || manifest.sourceSize !== args.snapshot.size
      || manifest.sourceMtime !== args.snapshot.mtimeMs
      || !(await fs.pathExists(manifest.markdownPath))
    ) {
      return null;
    }

    const markdown = await fs.readFile(manifest.markdownPath, 'utf-8');
    if (!markdown.trim()) {
      return null;
    }

    return { manifest, markdown };
  } catch (error) {
    args.onWarn?.(`读取 PDF OCR 缓存失败: ${args.filePath}`, error);
    return null;
  }
}

