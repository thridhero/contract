import type Database from 'better-sqlite3';
import type { ContractChunk } from '../ai/contracts/chunking';
import type { AIContractChunkRecord, AIContractFieldEvidenceRecord } from '../../../../shared/types/ai.types';

export interface ContractFieldEvidenceRecord {
  fieldKey: string;
  fieldValue: string;
  chunkId: string;
  chunkIndex: number;
  evidenceText: string;
  confidence?: number;
}

export type AiLogMethods = {
  logAIContractExtraction: (fileId: string, extractJson: string, status: string, errorMsg?: string) => void;
  replaceContractAiChunks: (fileId: string, filePath: string, chunks: ContractChunk[]) => void;
  replaceContractFieldEvidence: (fileId: string, rows: ContractFieldEvidenceRecord[]) => void;
  getContractAiChunks: (fileId: string) => AIContractChunkRecord[];
  getContractFieldEvidence: (fileId: string) => AIContractFieldEvidenceRecord[];
};

export function createAiLogMethods(
  getDb: () => Database.Database,
  onError: (message: string, error: unknown) => void,
): AiLogMethods {
  return {
    logAIContractExtraction: (fileId, extractJson, status, errorMsg = '') => {
      const db = getDb();
      db.prepare(
        'INSERT INTO contract_ai_log (file_id, extract_json, status, error_msg) VALUES (?, ?, ?, ?)',
      ).run(fileId, extractJson, status, errorMsg);

      try {
        db.prepare("DELETE FROM contract_ai_log WHERE created_time < datetime('now', '-90 days')").run();
      } catch (e) {
        onError('清理过期 AI 日志失败', e);
      }
    },

    replaceContractAiChunks: (fileId, filePath, chunks) => {
      const db = getDb();
      const rows = Array.isArray(chunks) ? chunks : [];
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM contract_ai_chunks WHERE file_id = ?').run(fileId);
        if (rows.length === 0) return;

        const stmt = db.prepare(`
          INSERT INTO contract_ai_chunks (
            file_id, file_path, chunk_id, chunk_index, title, section_type, importance_score, is_noise, keywords_json, content, compact_content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        rows.forEach((chunk) => {
          stmt.run(
            fileId,
            filePath,
            String(chunk.id || ''),
            Number(chunk.index || 0),
            String(chunk.title || ''),
            String(chunk.sectionType || 'unknown'),
            Number(chunk.importanceScore || 0),
            chunk.isNoise ? 1 : 0,
            JSON.stringify(Array.isArray(chunk.keywords) ? chunk.keywords : []),
            String(chunk.content || ''),
            String(chunk.compactContent || ''),
          );
        });
      });
      tx();
    },

    replaceContractFieldEvidence: (fileId, rows) => {
      const db = getDb();
      const normalized = Array.isArray(rows) ? rows : [];
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM contract_field_evidence WHERE file_id = ?').run(fileId);
        if (normalized.length === 0) return;

        const stmt = db.prepare(`
          INSERT INTO contract_field_evidence (
            file_id, field_key, field_value, chunk_id, chunk_index, evidence_text, confidence
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        normalized.forEach((row) => {
          stmt.run(
            fileId,
            String(row.fieldKey || ''),
            String(row.fieldValue || ''),
            String(row.chunkId || ''),
            Number(row.chunkIndex || 0),
            String(row.evidenceText || ''),
            row.confidence === undefined ? null : Number(row.confidence),
          );
        });
      });
      tx();
    },

    getContractAiChunks: (fileId) => {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, file_id, file_path, chunk_id, chunk_index, title, section_type, importance_score, is_noise, keywords_json, content, compact_content, created_at
        FROM contract_ai_chunks
        WHERE file_id = ?
        ORDER BY chunk_index ASC, id ASC
      `).all(fileId) as Array<Record<string, unknown>>;

      return rows.map((row) => ({
        id: Number(row.id || 0),
        fileId: String(row.file_id || ''),
        filePath: String(row.file_path || ''),
        chunkId: String(row.chunk_id || ''),
        chunkIndex: Number(row.chunk_index || 0),
        title: String(row.title || ''),
        sectionType: String(row.section_type || 'unknown'),
        importanceScore: Number(row.importance_score || 0),
        isNoise: Number(row.is_noise || 0) > 0,
        keywords: safeJsonArray(row.keywords_json),
        content: String(row.content || ''),
        compactContent: String(row.compact_content || ''),
        createdAt: String(row.created_at || ''),
      }));
    },

    getContractFieldEvidence: (fileId) => {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, file_id, field_key, field_value, chunk_id, chunk_index, evidence_text, confidence, created_at
        FROM contract_field_evidence
        WHERE file_id = ?
        ORDER BY field_key ASC, chunk_index ASC, id ASC
      `).all(fileId) as Array<Record<string, unknown>>;

      return rows.map((row) => ({
        id: Number(row.id || 0),
        fileId: String(row.file_id || ''),
        fieldKey: String(row.field_key || ''),
        fieldValue: String(row.field_value || ''),
        chunkId: String(row.chunk_id || ''),
        chunkIndex: Number(row.chunk_index || 0),
        evidenceText: String(row.evidence_text || ''),
        confidence: row.confidence === null || row.confidence === undefined ? undefined : Number(row.confidence),
        createdAt: String(row.created_at || ''),
      }));
    },
  };
}

function safeJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
