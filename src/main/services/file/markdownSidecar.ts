import * as fs from 'fs-extra';
import * as path from 'path';

const HIDDEN_SIDECAR_DIR = '.tmp';

const uniquePaths = (paths: string[]): string[] => Array.from(new Set(paths.filter(Boolean)));

export const buildHiddenMarkdownSidecarPath = (filePath: string): string => {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), HIDDEN_SIDECAR_DIR, `${base}.md`);
};

export const buildLegacyMarkdownSidecarPath = (filePath: string): string => {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), `${base}.md`);
};

export const listMarkdownSidecarCandidates = (filePath: string): string[] => {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!filePath || ext === '.md') return [];
  return uniquePaths([
    buildHiddenMarkdownSidecarPath(filePath),
    buildLegacyMarkdownSidecarPath(filePath),
  ]);
};

export const findExistingMarkdownSidecarPath = async (filePath: string): Promise<string | null> => {
  const candidates = listMarkdownSidecarCandidates(filePath);
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

export const buildWritableMarkdownSidecarPath = async (filePath: string): Promise<string> => {
  const candidate = buildHiddenMarkdownSidecarPath(filePath);
  if (!(await fs.pathExists(candidate))) {
    return candidate;
  }

  try {
    const [srcStat, mdStat] = await Promise.all([fs.stat(filePath), fs.stat(candidate)]);
    if (Number(mdStat.mtimeMs) <= Number(srcStat.mtimeMs)) {
      return candidate;
    }
  } catch {
  }

  const parsed = path.parse(candidate);
  for (let i = 1; i < 1000; i += 1) {
    const next = path.join(parsed.dir, `${parsed.name} (${i})${parsed.ext}`);
    if (!(await fs.pathExists(next))) {
      return next;
    }
  }
  return candidate;
};

