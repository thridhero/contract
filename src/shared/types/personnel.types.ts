import type { AIStructuredGenerateResult } from './ai.types';
import type { FileConversionResult } from './fileConversion.types';

export interface PersonnelSalaryFields {
  salary_base?: number | null;
  salary_monthly?: number | null;
  salary_currency?: string;
  salary_bank_name?: string;
  salary_bank_account?: string;
}

export interface PersonnelArchiveFields {
  archive_no?: string;
  gender?: string;
  birth_date?: string;
  id_card_number?: string;
  photo_file_path?: string;
  address?: string;
  education?: string;
  graduate_school?: string;
  major?: string;
  emergency_contact?: string;
  emergency_contact_phone?: string;
  resume_file_path?: string;
  resume_text?: string;
  work_experience?: string;
}

export interface Personnel extends PersonnelSalaryFields, PersonnelArchiveFields {
  id: string;
  code: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  entry_date: string;
  status: string;
  remark: string;
  sort_order: number;
  department_ids: string[];
  department_names: string[];
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelCreateDTO extends PersonnelSalaryFields, PersonnelArchiveFields {
  code: string;
  name: string;
  position: string;
  phone: string;
  email?: string;
  entry_date?: string;
  status: string;
  remark?: string;
  department_ids: string[];
}

export interface PersonnelUpdateDTO extends Partial<PersonnelCreateDTO> {
  id: string;
  sort_order?: number;
}

export interface PersonnelQueryDTO {
  search?: string;
  searchFields?: string[];
  department_id?: string;
  page?: number;
  pageSize?: number;
}

export interface PersonnelQueryResult {
  data: Personnel[];
  total: number;
}

export type PersonnelSortOrderUpdate = { id: string; sort_order: number };

export interface PersonnelResumeParsedData extends PersonnelSalaryFields, PersonnelArchiveFields {
  name?: string;
  position?: string;
  phone?: string;
  email?: string;
  remark?: string;
}

export interface PersonnelResumeParseRequest {
  filePath: string;
  prompt?: string;
}

export interface PersonnelResumeParseResult {
  conversion: FileConversionResult;
  parsed: AIStructuredGenerateResult<PersonnelResumeParsedData>;
  draft: PersonnelResumeParsedData;
}

export type PersonnelDocumentType = 'id_card' | 'diploma' | 'other';
export type PersonnelDocumentFillStatus = 'pending' | 'confirmed' | 'rejected';

export interface PersonnelDocument {
  id: string;
  personnel_id: string;
  doc_type: PersonnelDocumentType;
  doc_name: string;
  doc_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  file_paths: string[];
  preview_image_path?: string;
  ai_extract_json?: string;
  ai_fill_status: PersonnelDocumentFillStatus;
  is_primary: number;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelDocumentPatchDraft {
  id_card_number?: string;
  address?: string;
  birth_date?: string;
  graduate_school?: string;
  education?: string;
}

export interface PersonnelDocumentCreateRequest {
  personnelId: string;
  docType: PersonnelDocumentType;
  localFilePaths: string[];
  manualDocName?: string;
}

export interface PersonnelDocumentCreateResult {
  document: PersonnelDocument;
  draft: PersonnelDocumentPatchDraft;
}

export interface PersonnelDocumentUpdateDTO {
  id: string;
  doc_name?: string;
  doc_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  is_primary?: number;
}

export interface PersonnelDocumentApplyDraftDTO {
  documentId: string;
  approvedPatch: PersonnelDocumentPatchDraft;
}

export interface PersonnelBatchResumeScanItem {
  filePath: string;
  fileName: string;
  extension: string;
  relativePath: string;
}

export interface PersonnelBatchResumeScanResult {
  folderPath: string;
  total: number;
  items: PersonnelBatchResumeScanItem[];
}

export type PersonnelBatchImportItemStatus = 'pending' | 'processing' | 'saved' | 'failed';

export interface PersonnelBatchImportItemResult {
  filePath: string;
  fileName: string;
  extension: string;
  relativePath?: string;
  status: PersonnelBatchImportItemStatus;
  created: boolean;
  personnelId?: string;
  personnelName?: string;
  error?: string;
  draft?: PersonnelResumeParsedData;
  summary?: Pick<PersonnelResumeParsedData, 'name' | 'position' | 'phone' | 'email'>;
}

export interface PersonnelBatchImportRequest {
  filePaths: string[];
  folderPath?: string;
  prompt?: string;
}

export interface PersonnelBatchImportResult {
  folderPath?: string;
  total: number;
  results: PersonnelBatchImportItemResult[];
}

export interface PersonnelBatchImportSession {
  taskId: string;
  folderPath: string;
  stage: 'idle' | 'scanning' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  successCount: number;
  failedCount: number;
  currentFilePath?: string;
  currentFileName?: string;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
  items: PersonnelBatchImportItemResult[];
}
