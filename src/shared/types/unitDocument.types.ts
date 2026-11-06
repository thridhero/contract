export type UnitDocumentOwnerType = 'customer' | 'supplier';
export type UnitDocumentType = 'business_license' | 'other';
export type UnitDocumentFillStatus = 'pending' | 'confirmed' | 'rejected';

export interface UnitDocument {
  id: string;
  owner_type: UnitDocumentOwnerType;
  owner_id: string;
  doc_type: UnitDocumentType;
  doc_name: string;
  doc_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  file_paths: string[];
  preview_image_path?: string;
  ai_extract_json?: string;
  ai_fill_status: UnitDocumentFillStatus;
  is_primary: number;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UnitDocumentPatchDraft {
  name?: string;
  tax_number?: string;
  legal_rep_name?: string;
  address?: string;
  reg_date?: string;
  company_type?: string;
}

export interface UnitDocumentCreateRequest {
  ownerType: UnitDocumentOwnerType;
  ownerId: string;
  docType: UnitDocumentType;
  localFilePaths: string[];
  manualDocName?: string;
}

export interface UnitDocumentCreateResult {
  document: UnitDocument;
  draft: UnitDocumentPatchDraft;
}

export interface UnitDocumentUpdateDTO {
  id: string;
  doc_name?: string;
  doc_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  is_primary?: number;
}

export interface UnitDocumentApplyDraftDTO {
  documentId: string;
  approvedPatch: UnitDocumentPatchDraft;
}
