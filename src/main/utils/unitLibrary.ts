import * as fs from 'fs';
import * as path from 'path';
import {
  getUnitLibraryPartyMeta,
  sanitizeUnitLibraryFolderName,
  type UnitLibraryPartyType,
} from '../../shared/utils/unitLibrary';

export interface EnsureUnitLibraryDirectoryResult {
  rootDirectoryPath: string;
  directoryPath: string;
  folderName: string;
  status: 'created' | 'reused';
}

export function resolveLibraryRootPathFromDbPath(dbPath: string | null): string {
  const normalizedDbPath = String(dbPath || '').trim();
  if (!normalizedDbPath) {
    throw new Error('当前未加载资源库，无法准备单位资料库目录');
  }

  return path.dirname(path.resolve(normalizedDbPath));
}

export function ensureUnitLibraryDirectory(
  partyType: UnitLibraryPartyType,
  unitName: string,
  libraryRootPath: string,
): EnsureUnitLibraryDirectoryResult {
  const normalizedUnitName = String(unitName || '').trim();
  if (!normalizedUnitName) {
    throw new Error('单位名称不能为空，无法准备资料库目录');
  }

  const normalizedLibraryRootPath = String(libraryRootPath || '').trim();
  if (!normalizedLibraryRootPath) {
    throw new Error('资源库路径不能为空，无法准备单位资料库目录');
  }

  const partyMeta = getUnitLibraryPartyMeta(partyType);
  const folderName = sanitizeUnitLibraryFolderName(normalizedUnitName);
  const rootDirectoryPath = path.join(path.resolve(normalizedLibraryRootPath), partyMeta.rootDirName);
  const directoryPath = path.join(rootDirectoryPath, folderName);

  const existedBefore = fs.existsSync(directoryPath);
  if (existedBefore && !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`${partyMeta.unitLabel}资料库目录已被同名文件占用: ${directoryPath}`);
  }

  fs.mkdirSync(directoryPath, { recursive: true });

  return {
    rootDirectoryPath,
    directoryPath,
    folderName,
    status: existedBefore ? 'reused' : 'created',
  };
}
