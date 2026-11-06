import { IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  UNIT_DOCUMENT_ADD,
  UNIT_DOCUMENT_APPLY_DRAFT,
  UNIT_DOCUMENT_DELETE,
  UNIT_DOCUMENT_LIST,
  UNIT_DOCUMENT_REJECT_DRAFT,
  UNIT_DOCUMENT_UPDATE,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { ok, fail, IpcResponse } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { FileConversionService } from '../../../services/file/FileConversionService';
import { PdfOcrService } from '../../../services/file/PdfOcrService';
import { AIService } from '../../../services/system/AIService';
import { ensureDir, makeUniquePath, sanitizeFolderName } from '../library/library/shared';
import { ensureUnitLibraryDirectory, resolveLibraryRootPathFromDbPath } from '../../../utils/unitLibrary';
import {
  UnitDocument,
  UnitDocumentApplyDraftDTO,
  UnitDocumentCreateRequest,
  UnitDocumentCreateResult,
  UnitDocumentOwnerType,
  UnitDocumentPatchDraft,
  UnitDocumentType,
  UnitDocumentUpdateDTO,
} from '../../../../shared/types/unitDocument.types';

const logger = createLogger('UnitDocumentHandlers');
const UNIT_DOCUMENTS_DIR = '证件';
const IMAGE_FILE_REGEXP = /\.(png|jpe?g|webp|bmp|gif)$/i;
const PDF_FILE_REGEXP = /\.pdf$/i;

const UNIT_DOCUMENT_PARSE_SCHEMA = [
  { key: 'doc_name', type: 'string', description: '证件名称' },
  { key: 'doc_number', type: 'string', description: '证件号码或统一社会信用代码' },
  { key: 'issuer', type: 'string', description: '发证机构' },
  { key: 'issue_date', type: 'string', description: '发证日期，尽量 YYYY-MM-DD' },
  { key: 'expiry_date', type: 'string', description: '有效期截止日期，尽量 YYYY-MM-DD' },
  { key: 'company_name', type: 'string', description: '单位名称' },
  { key: 'unified_social_credit_code', type: 'string', description: '统一社会信用代码' },
  { key: 'legal_representative', type: 'string', description: '法定代表人' },
  { key: 'address', type: 'string', description: '住所或注册地址' },
  { key: 'reg_date', type: 'string', description: '成立日期或注册日期，尽量 YYYY-MM-DD' },
  { key: 'company_type', type: 'string', description: '公司类型或主体类型' },
] as const;

const getDocumentTypeLabel = (docType: UnitDocumentType): string => (
  docType === 'business_license' ? '营业执照' : '其他证件'
);

const getOwnerFolder = (ownerType: UnitDocumentOwnerType) => (
  ownerType === 'customer' ? 'party-a' : 'party-b'
) as 'party-a' | 'party-b';

const getCurrentLibraryRootPath = (): string => {
  const dbPath = DatabaseService.getInstance().getDbPath();
  return resolveLibraryRootPathFromDbPath(dbPath);
};

const getOwnerEntity = (ownerType: UnitDocumentOwnerType, ownerId: string) => (
  ownerType === 'customer'
    ? DatabaseService.getInstance().getCustomerById(ownerId)
    : DatabaseService.getInstance().getSupplierById(ownerId)
);

const buildUnitDocumentPrompt = (docType: UnitDocumentType): string => [
  `你是单位证件解析助手。当前证件类型：${getDocumentTypeLabel(docType)}。`,
  '请仅输出 schema 中字段，无法确认留空，不要编造。',
  '如果是营业执照，请优先提取单位名称、统一社会信用代码、法定代表人、注册地址、成立日期、公司类型。',
  '其中：统一社会信用代码填写到 unified_social_credit_code，法定代表人填写到 legal_representative，住所填写到 address。',
  '日期尽量规范为 YYYY-MM-DD。',
].join('\n');

const normalizeUscc = (value: unknown): string => {
  const text = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
  if (text.length !== 18) return '';
  const charset = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  for (const ch of text) {
    if (!charset.includes(ch)) return '';
  }
  return text;
};

const parseUnitDocument = async (filePath: string, docType: UnitDocumentType): Promise<{
  aiExtractJson: string;
  docName: string;
  docNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  draft: UnitDocumentPatchDraft;
}> => {
  const ext = path.extname(filePath).toLowerCase();
  const conversion = await FileConversionService.getInstance().convertToMarkdown(filePath, { allowOcr: true });
  let sourceText = String(conversion.markdown || '').trim();
  if (!sourceText && ext === '.pdf') {
    const ocrResult = await PdfOcrService.getInstance().getMarkdownForPdf(filePath);
    sourceText = String(ocrResult.markdown || '').trim();
  }
  if (!sourceText) {
    return {
      aiExtractJson: '{}',
      docName: '',
      docNumber: '',
      issuer: '',
      issueDate: '',
      expiryDate: '',
      draft: {},
    };
  }
  const parsed = await AIService.getInstance().generateStructured<Record<string, unknown>>({
    scene: 'unit-document-parse',
    prompt: buildUnitDocumentPrompt(docType),
    sourceText,
    schema: UNIT_DOCUMENT_PARSE_SCHEMA.map(item => ({ ...item })),
  });
  const data = parsed.data || {};
  const unifiedSocialCreditCode = normalizeUscc(data.unified_social_credit_code);
  const documentNumberAsUscc = normalizeUscc(data.doc_number);
  const taxNumber = unifiedSocialCreditCode || documentNumberAsUscc || '';
  return {
    aiExtractJson: JSON.stringify(data),
    docName: String(data.doc_name || '').trim(),
    docNumber: String(data.doc_number || unifiedSocialCreditCode || '').trim(),
    issuer: String(data.issuer || '').trim(),
    issueDate: String(data.issue_date || '').trim(),
    expiryDate: String(data.expiry_date || '').trim(),
    draft: {
      name: String(data.company_name || '').trim() || undefined,
      tax_number: taxNumber || undefined,
      legal_rep_name: String(data.legal_representative || '').trim() || undefined,
      address: String(data.address || '').trim() || undefined,
      reg_date: String(data.reg_date || '').trim() || undefined,
      company_type: String(data.company_type || '').trim() || undefined,
    },
  };
};

const copyDocumentFilesIntoLibrary = async (ownerType: UnitDocumentOwnerType, ownerName: string, docType: UnitDocumentType, sourcePaths: string[]): Promise<string[]> => {
  const libraryRootPath = getCurrentLibraryRootPath();
  const unitDir = ensureUnitLibraryDirectory(getOwnerFolder(ownerType), ownerName, libraryRootPath);
  const baseDir = path.join(unitDir.directoryPath, UNIT_DOCUMENTS_DIR, getDocumentTypeLabel(docType));
  await ensureDir(baseDir);
  const relativePaths: string[] = [];
  for (const sourcePath of sourcePaths) {
    const resolved = path.resolve(String(sourcePath || '').trim());
    if (!resolved || !fs.existsSync(resolved)) continue;
    const desiredPath = path.join(baseDir, sanitizeFolderName(path.basename(resolved)));
    const targetPath = await makeUniquePath(desiredPath);
    await fs.promises.copyFile(resolved, targetPath);
    relativePaths.push(path.relative(libraryRootPath, targetPath));
  }
  return relativePaths;
};

const buildDocumentPreviewImage = async (storedRelativePath?: string): Promise<string> => {
  const libraryRootPath = getCurrentLibraryRootPath();
  const relativePath = String(storedRelativePath || '').trim();
  if (!relativePath) return '';
  const absolutePath = path.resolve(libraryRootPath, relativePath);
  if (!fs.existsSync(absolutePath)) return '';
  if (IMAGE_FILE_REGEXP.test(absolutePath)) return relativePath;
  if (!PDF_FILE_REGEXP.test(absolutePath)) return '';
  const parsedPath = path.parse(absolutePath);
  const previewPath = await makeUniquePath(path.join(parsedPath.dir, `${parsedPath.name}.preview.png`));
  const previewBytes = await PdfOcrService.getInstance().renderPdfPagePreviewAsPng(absolutePath, 1);
  await fs.promises.writeFile(previewPath, previewBytes);
  return path.relative(libraryRootPath, previewPath);
};

export const unitDocumentHandlers = {
  [UNIT_DOCUMENT_ADD]: async (_event: IpcMainInvokeEvent, payload: UnitDocumentCreateRequest): Promise<IpcResponse<UnitDocumentCreateResult>> => {
    try {
      const db = DatabaseService.getInstance();
      const ownerType = String(payload?.ownerType || '').trim() as UnitDocumentOwnerType;
      const ownerId = String(payload?.ownerId || '').trim();
      const owner = getOwnerEntity(ownerType, ownerId);
      if (!owner) throw new Error('单位不存在');
      const docType = (String(payload?.docType || 'other').trim() as UnitDocumentType) || 'other';
      const files = Array.isArray(payload?.localFilePaths) ? payload.localFilePaths.map(item => String(item || '').trim()).filter(Boolean) : [];
      if (!files.length) throw new Error('缺少证件文件');
      const storedRelativePaths = await copyDocumentFilesIntoLibrary(ownerType, String(owner.name || '').trim(), docType, files);
      if (!storedRelativePaths.length) throw new Error('证件文件复制失败');
      let previewImageRelativePath = '';
      try {
        previewImageRelativePath = await buildDocumentPreviewImage(storedRelativePaths[0]);
      } catch (error) {
        logger.warn('生成单位证件预览图失败，将回退到文件预览', { filePath: storedRelativePaths[0], error });
      }
      const firstAbsolutePath = path.resolve(getCurrentLibraryRootPath(), storedRelativePaths[0]);
      const parsed = await parseUnitDocument(firstAbsolutePath, docType);
      const created = db.addUnitDocument({
        ownerType,
        ownerId,
        docType,
        localFilePaths: files,
        storedRelativePaths,
        previewImageRelativePath,
        manualDocName: String(payload?.manualDocName || '').trim() || parsed.docName || getDocumentTypeLabel(docType),
        aiExtractJson: parsed.aiExtractJson,
        draft: parsed.draft,
      });
      const updated = db.updateUnitDocument({
        id: created.document.id,
        doc_number: parsed.docNumber,
        issuer: parsed.issuer,
        issue_date: parsed.issueDate,
        expiry_date: parsed.expiryDate,
      });
      return ok({ ...created, document: updated || created.document });
    } catch (error) {
      logger.error('新增单位证件失败:', error);
      return fail(error);
    }
  },
  [UNIT_DOCUMENT_LIST]: async (_event: IpcMainInvokeEvent, payload: { ownerType: UnitDocumentOwnerType; ownerId: string }): Promise<IpcResponse<UnitDocument[]>> => {
    try {
      const ownerType = String(payload?.ownerType || '').trim() as UnitDocumentOwnerType;
      const ownerId = String(payload?.ownerId || '').trim();
      return ok(DatabaseService.getInstance().listUnitDocuments(ownerType, ownerId));
    } catch (error) {
      logger.error('获取单位证件失败:', error);
      return fail(error);
    }
  },
  [UNIT_DOCUMENT_UPDATE]: async (_event: IpcMainInvokeEvent, dto: UnitDocumentUpdateDTO): Promise<IpcResponse<UnitDocument | null>> => {
    try {
      return ok(DatabaseService.getInstance().updateUnitDocument(dto));
    } catch (error) {
      logger.error('更新单位证件失败:', error);
      return fail(error);
    }
  },
  [UNIT_DOCUMENT_DELETE]: async (_event: IpcMainInvokeEvent, id: string): Promise<IpcResponse<{ success: boolean }>> => {
    try {
      DatabaseService.getInstance().deleteUnitDocument(String(id || '').trim());
      return ok({ success: true });
    } catch (error) {
      logger.error('删除单位证件失败:', error);
      return fail(error);
    }
  },
  [UNIT_DOCUMENT_APPLY_DRAFT]: async (_event: IpcMainInvokeEvent, dto: UnitDocumentApplyDraftDTO): Promise<IpcResponse<any>> => {
    try {
      return ok(DatabaseService.getInstance().applyUnitDocumentDraft(dto));
    } catch (error) {
      logger.error('应用单位证件回填失败:', error);
      return fail(error);
    }
  },
  [UNIT_DOCUMENT_REJECT_DRAFT]: async (_event: IpcMainInvokeEvent, documentId: string): Promise<IpcResponse<UnitDocument | null>> => {
    try {
      return ok(DatabaseService.getInstance().rejectUnitDocumentDraft(String(documentId || '').trim()));
    } catch (error) {
      logger.error('拒绝单位证件回填失败:', error);
      return fail(error);
    }
  },
};
