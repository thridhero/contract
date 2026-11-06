export type DocumentCategory =
  | '01-software-info'      // 软件基本信息
  | '02-applicant-docs'     // 申请人材料
  | '03-source-code'        // 源代码材料
  | '04-documents'          // 文档材料
  | '05-application-forms'  // 申请表格
  | '06-acceptance-cert';   // 受理与证书

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  '01-software-info':     '01 软件基本信息',
  '02-applicant-docs':    '02 申请人材料',
  '03-source-code':       '03 源代码材料',
  '04-documents':         '04 文档材料',
  '05-application-forms': '05 申请表格',
  '06-acceptance-cert':   '06 受理与证书',
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  '01-software-info',
  '02-applicant-docs',
  '03-source-code',
  '04-documents',
  '05-application-forms',
  '06-acceptance-cert',
];

export type DocumentStatus = 'active' | 'deleted' | 'replaced';

export interface Document {
  id: string;
  project_id: string;
  category: DocumentCategory;
  name: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  version: number;
  is_required: number;
  status: DocumentStatus;
  checksum: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentInsertDTO {
  id: string;
  project_id: string;
  category: DocumentCategory;
  name: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  is_required?: number;
  checksum?: string;
}
