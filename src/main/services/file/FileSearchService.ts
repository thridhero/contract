import { DatabaseService } from '../system/DatabaseService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('FileSearchService');

export class FileSearchService {
  private static instance: FileSearchService;

  private constructor() {}

  static getInstance(): FileSearchService {
    if (!FileSearchService.instance) {
      FileSearchService.instance = new FileSearchService();
    }
    return FileSearchService.instance;
  }

  /**
   * 执行全文本检索
   * @param query 关键词
   */
  async searchFullText(query: string): Promise<Array<{ file_path: string; snippet: string }>> {
    if (!query || !query.trim()) return [];
    
    logger.info(`执行全文本搜索: ${query}`);
    const db = DatabaseService.getInstance();
    return db.searchFullText(query);
  }

  async searchFullTextInPath(payload: {
    query: string;
    baseDir: string;
    libraryPath?: string;
    recursive?: boolean;
    limit?: number;
    offset?: number;
    sourceType?: 'contract' | 'other';
  }): Promise<{ total: number; items: Array<{ file_path: string; snippet: string }> }> {
    const q = String(payload?.query || '').trim();
    if (!q) return { total: 0, items: [] };
    const baseDir = String(payload?.baseDir || '').trim();
    const sourceType = payload?.sourceType;
    if (!baseDir && sourceType !== 'contract' && sourceType !== 'other') {
      return { total: 0, items: [] };
    }
    const recursive = payload?.recursive !== false;
    const limit = payload?.limit;
    const offset = payload?.offset;

    logger.info(`执行目录范围全文本搜索: ${q} @ ${baseDir}`);
    const db = DatabaseService.getInstance();
    return db.searchFullTextPaged(q, {
      baseDir,
      recursive,
      limit,
      offset,
      sourceType,
    });
  }
}
