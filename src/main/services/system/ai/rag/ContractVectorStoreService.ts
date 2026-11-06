import type { AISettings } from '../../../../../shared/types/ai.types';
import { DatabaseService } from '../../DatabaseService';
import type { ContractChunk } from '../contracts/chunking';
import { EmbeddingService } from '../embedding/EmbeddingService';

export class ContractVectorStoreService {
  private static instance: ContractVectorStoreService;

  static getInstance(): ContractVectorStoreService {
    if (!ContractVectorStoreService.instance) {
      ContractVectorStoreService.instance = new ContractVectorStoreService();
    }
    return ContractVectorStoreService.instance;
  }

  async replaceFileChunks(params: {
    fileId: string;
    filePath: string;
    contractId?: string;
    chunks: ContractChunk[];
    config: AISettings;
  }): Promise<void> {
    const fileId = String(params.fileId || '').trim();
    const filePath = String(params.filePath || '').trim();
    if (!fileId || !filePath || !Array.isArray(params.chunks) || params.chunks.length === 0) return;

    const embeddingService = EmbeddingService.getInstance();
    const rows = [];
    for (const chunk of params.chunks) {
      const text = String(chunk.compactContent || chunk.content || '').trim();
      if (!text) continue;
      rows.push({
        contractId: String(params.contractId || '').trim(),
        fileId,
        filePath,
        chunkId: String(chunk.id || '').trim(),
        chunkIndex: Number(chunk.index || 0),
        sourceText: String(chunk.content || '').trim(),
        compactText: text,
        keywords: Array.isArray(chunk.keywords) ? chunk.keywords : [],
        embedding: await embeddingService.generateEmbedding(text, params.config),
        embeddingModelId: params.config.embeddingModelPath || `hash:${params.config.embeddingDimension}`,
      });
    }

    DatabaseService.getInstance().replaceContractVectorChunks(fileId, rows);
  }

  promoteFileChunks(filePath: string, contractId: string): void {
    DatabaseService.getInstance().promoteContractVectorChunksByFilePath(filePath, contractId);
  }

  deleteByContractId(contractId: string): void {
    DatabaseService.getInstance().deleteContractVectorChunksByContractId(contractId);
  }
}
