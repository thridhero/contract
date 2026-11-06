import type { AIModelStrategy, AISettings } from '../../../../../shared/types/ai.types';
import { DatabaseService } from '../../DatabaseService';
import { EmbeddingService } from '../embedding/EmbeddingService';

export interface RagRetrievalResult {
  contextText: string;
  usedChunkIds: string[];
  retrievedCount: number;
  strategy: AIModelStrategy;
}

export class RagRetrievalService {
  private static instance: RagRetrievalService;

  static getInstance(): RagRetrievalService {
    if (!RagRetrievalService.instance) {
      RagRetrievalService.instance = new RagRetrievalService();
    }
    return RagRetrievalService.instance;
  }

  async retrieve(params: {
    sourceText: string;
    config: AISettings;
    excludeFileId?: string;
    excludeFilePath?: string;
    strategy: AIModelStrategy;
  }): Promise<RagRetrievalResult> {
    if (!params.config.ragEnabled) {
      return {
        contextText: '',
        usedChunkIds: [],
        retrievedCount: 0,
        strategy: params.strategy,
      };
    }

    const embedding = await EmbeddingService.getInstance().generateEmbedding(params.sourceText, params.config);
    const rows = DatabaseService.getInstance().searchContractVectorChunks(embedding, {
      limit: params.config.retrievalTopK,
      threshold: params.config.retrievalScoreThreshold,
      excludeFileId: params.excludeFileId,
      excludeFilePath: params.excludeFilePath,
    });

    const contextText = rows
      .map((row, index) => [
        `### 检索片段 ${index + 1}`,
        `chunkId: ${row.chunkId}`,
        `score: ${row.score.toFixed(4)}`,
        row.compactText || row.sourceText,
      ].join('\n'))
      .join('\n\n')
      .trim();

    return {
      contextText,
      usedChunkIds: rows.map(row => row.chunkId),
      retrievedCount: rows.length,
      strategy: params.strategy,
    };
  }
}
