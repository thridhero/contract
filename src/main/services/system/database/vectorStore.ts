import * as crypto from 'crypto';
import type Database from 'better-sqlite3';

export interface ContractVectorChunkRecord {
  id: number;
  contractId: string;
  fileId: string;
  filePath: string;
  chunkId: string;
  chunkIndex: number;
  sourceText: string;
  compactText: string;
  keywords: string[];
  embedding: number[];
  embeddingModelId: string;
  contentHash: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContractVectorChunkInput {
  contractId?: string;
  fileId: string;
  filePath: string;
  chunkId: string;
  chunkIndex: number;
  sourceText: string;
  compactText: string;
  keywords?: string[];
  embedding: number[];
  embeddingModelId: string;
}

export type VectorStoreMethods = {
  replaceContractVectorChunks: (fileId: string, rows: ContractVectorChunkInput[]) => void;
  promoteContractVectorChunksByFilePath: (filePath: string, contractId: string) => void;
  deleteContractVectorChunksByContractId: (contractId: string) => void;
  deleteContractVectorChunksByFileId: (fileId: string) => void;
  searchContractVectorChunks: (queryEmbedding: number[], options?: {
    limit?: number;
    threshold?: number;
    excludeFileId?: string;
    excludeFilePath?: string;
  }) => Array<ContractVectorChunkRecord & { score: number }>;
};

function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
}

function normalizeVector(vector: number[]): number[] {
  const input = normalizeEmbedding(vector);
  if (input.length === 0) return [];
  const magnitude = Math.sqrt(input.reduce((sum, item) => sum + item * item, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 0) return input;
  return input.map(item => item / magnitude);
}

function cosineSimilarity(left: number[], right: number[]): number {
  const a = normalizeVector(left);
  const b = normalizeVector(right);
  if (a.length === 0 || b.length === 0) return 0;
  const max = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < max; i += 1) {
    sum += a[i] * b[i];
  }
  return Number.isFinite(sum) ? sum : 0;
}

function safeJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeJsonEmbedding(value: unknown): number[] {
  try {
    return normalizeEmbedding(JSON.parse(String(value || '[]')));
  } catch {
    return [];
  }
}

function buildContentHash(row: ContractVectorChunkInput): string {
  const hash = crypto.createHash('sha256');
  hash.update(String(row.compactText || ''));
  hash.update('\n');
  hash.update(String(row.sourceText || ''));
  hash.update('\n');
  hash.update(String(row.embeddingModelId || ''));
  return hash.digest('hex');
}

export function createVectorStoreMethods(getDb: () => Database.Database): VectorStoreMethods {
  return {
    replaceContractVectorChunks: (fileId, rows) => {
      const db = getDb();
      const normalizedRows = Array.isArray(rows) ? rows : [];
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM contract_vector_chunks WHERE file_id = ?').run(fileId);
        if (normalizedRows.length === 0) return;
        const stmt = db.prepare(`
          INSERT INTO contract_vector_chunks (
            contract_id, file_id, file_path, chunk_id, chunk_index, source_text, compact_text,
            keywords_json, embedding_json, embedding_model_id, content_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        normalizedRows.forEach((row) => {
          const embedding = normalizeVector(row.embedding);
          if (embedding.length === 0) return;
          stmt.run(
            String(row.contractId || '').trim(),
            String(row.fileId || fileId).trim(),
            String(row.filePath || '').trim(),
            String(row.chunkId || '').trim(),
            Number(row.chunkIndex || 0),
            String(row.sourceText || '').trim(),
            String(row.compactText || '').trim(),
            JSON.stringify(Array.isArray(row.keywords) ? row.keywords : []),
            JSON.stringify(embedding),
            String(row.embeddingModelId || '').trim(),
            buildContentHash({ ...row, embedding, fileId }),
          );
        });
      });
      tx();
    },

    promoteContractVectorChunksByFilePath: (filePath, contractId) => {
      const db = getDb();
      db.prepare(`
        UPDATE contract_vector_chunks
        SET contract_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE file_path = ?
      `).run(String(contractId || '').trim(), String(filePath || '').trim());
    },

    deleteContractVectorChunksByContractId: (contractId) => {
      const db = getDb();
      db.prepare('DELETE FROM contract_vector_chunks WHERE contract_id = ?').run(String(contractId || '').trim());
    },

    deleteContractVectorChunksByFileId: (fileId) => {
      const db = getDb();
      db.prepare('DELETE FROM contract_vector_chunks WHERE file_id = ?').run(String(fileId || '').trim());
    },

    searchContractVectorChunks: (queryEmbedding, options) => {
      const db = getDb();
      const limit = Math.max(1, Number(options?.limit || 6));
      const threshold = Number.isFinite(options?.threshold as number) ? Number(options?.threshold) : 0;
      const excludeFileId = String(options?.excludeFileId || '').trim();
      const excludeFilePath = String(options?.excludeFilePath || '').trim();

      const rows = db.prepare(`
        SELECT id, contract_id, file_id, file_path, chunk_id, chunk_index, source_text, compact_text,
               keywords_json, embedding_json, embedding_model_id, content_hash, created_at, updated_at
        FROM contract_vector_chunks
        ORDER BY updated_at DESC, id DESC
      `).all() as Array<Record<string, unknown>>;

      return rows
        .map((row) => {
          const record: ContractVectorChunkRecord = {
            id: Number(row.id || 0),
            contractId: String(row.contract_id || ''),
            fileId: String(row.file_id || ''),
            filePath: String(row.file_path || ''),
            chunkId: String(row.chunk_id || ''),
            chunkIndex: Number(row.chunk_index || 0),
            sourceText: String(row.source_text || ''),
            compactText: String(row.compact_text || ''),
            keywords: safeJsonArray(row.keywords_json),
            embedding: safeJsonEmbedding(row.embedding_json),
            embeddingModelId: String(row.embedding_model_id || ''),
            contentHash: String(row.content_hash || ''),
            createdAt: String(row.created_at || ''),
            updatedAt: String(row.updated_at || ''),
          };
          return {
            ...record,
            score: cosineSimilarity(queryEmbedding, record.embedding),
          };
        })
        .filter((row) => row.embedding.length > 0)
        .filter((row) => !excludeFileId || row.fileId !== excludeFileId)
        .filter((row) => !excludeFilePath || row.filePath !== excludeFilePath)
        .filter((row) => row.score >= threshold)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.contractId && b.contractId && a.contractId !== b.contractId) return 0;
          return a.chunkIndex - b.chunkIndex;
        })
        .slice(0, limit);
    },
  };
}
