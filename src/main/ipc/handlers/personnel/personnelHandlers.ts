import { IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  PERSONNEL_CREATE,
  PERSONNEL_UPDATE,
  PERSONNEL_DELETE,
  PERSONNEL_RESTORE,
  PERSONNEL_PURGE,
  PERSONNEL_GET,
  PERSONNEL_GET_LIST,
  PERSONNEL_UPDATE_SORT,
  PERSONNEL_PARSE_RESUME,
  PERSONNEL_SCAN_RESUME_FOLDER,
  PERSONNEL_BATCH_IMPORT_RESUMES,
  PERSONNEL_ADD_DOCUMENTS,
  PERSONNEL_LIST_DOCUMENTS,
  PERSONNEL_UPDATE_DOCUMENT,
  PERSONNEL_DELETE_DOCUMENT,
  PERSONNEL_APPLY_DOCUMENT_DRAFT,
  PERSONNEL_REJECT_DOCUMENT_DRAFT,
} from '../../channels';
import { DatabaseService } from '../../../services/system/DatabaseService';
import { BootstrapService } from '../../../services/system/BootstrapService';
import { ok, fail, IpcResponse } from '../../../../shared/types/ipc.types';
import { createLogger } from '../../../utils/logger';
import { AIService } from '../../../services/system/AIService';
import { FileConversionService } from '../../../services/file/FileConversionService';
import { PdfOcrService } from '../../../services/file/PdfOcrService';
import { ensureDir, makeUniqueContractFolderName, makeUniquePath, sanitizeFolderName } from '../library/library/shared';
import {
  PersonnelBatchImportItemResult,
  PersonnelBatchImportRequest,
  PersonnelBatchImportResult,
  PersonnelBatchResumeScanItem,
  PersonnelBatchResumeScanResult,
  PersonnelDocument,
  PersonnelDocumentApplyDraftDTO,
  PersonnelDocumentCreateRequest,
  PersonnelDocumentCreateResult,
  PersonnelDocumentPatchDraft,
  PersonnelDocumentType,
  PersonnelDocumentUpdateDTO,
  PersonnelCreateDTO,
  PersonnelUpdateDTO,
  PersonnelQueryDTO,
  PersonnelResumeParseRequest,
  PersonnelResumeParseResult,
  PersonnelResumeParsedData,
  PersonnelSortOrderUpdate,
} from '../../../../shared/types/personnel.types';
import { IdGenerator } from '../../../../shared/utils/idGenerator';

const logger = createLogger('PersonnelHandlers');
const PERSONNEL_RESUME_BASE_DIR = 'department-personnel';
const PERSONNEL_PHOTO_DIR = '照片';
const PERSONNEL_DOCUMENTS_DIR = '证件';
const PERSONNEL_BATCH_RESUME_SUPPORTED_EXTS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
]);
const IMAGE_FILE_REGEXP = /\.(png|jpe?g|webp|bmp|gif)$/i;
const PDF_FILE_REGEXP = /\.pdf$/i;

const PERSONNEL_RESUME_PARSE_SCHEMA = [
  { key: 'name', type: 'string', description: '候选人姓名' },
  { key: 'position', type: 'string', description: '当前或目标岗位/职务' },
  { key: 'phone', type: 'string', description: '手机号' },
  { key: 'email', type: 'string', description: '邮箱' },
  { key: 'gender', type: 'string', description: '性别' },
  { key: 'birth_date', type: 'string', description: '出生日期，优先输出 YYYY-MM-DD' },
  { key: 'id_card_number', type: 'string', description: '身份证号或证件号' },
  { key: 'address', type: 'string', description: '现居住地址或联系地址' },
  { key: 'education', type: 'string', description: '最高学历' },
  { key: 'graduate_school', type: 'string', description: '毕业院校' },
  { key: 'major', type: 'string', description: '专业' },
  { key: 'salary_base', type: 'number', description: '基本工资，能确定时输出数值' },
  { key: 'salary_monthly', type: 'number', description: '月薪总额，能确定时输出数值' },
  { key: 'salary_currency', type: 'string', description: '工资币种，默认 CNY' },
  { key: 'salary_bank_name', type: 'string', description: '工资卡开户行' },
  { key: 'salary_bank_account', type: 'string', description: '工资卡账号' },
  { key: 'emergency_contact', type: 'string', description: '紧急联系人' },
  { key: 'emergency_contact_phone', type: 'string', description: '紧急联系人电话' },
  { key: 'work_experience', type: 'string', description: '工作经历摘要，控制在 300 字以内' },
  { key: 'remark', type: 'string', description: '其他适合写入员工备注的摘要信息' },
] as const;

const buildResumeParsePrompt = (customPrompt?: string): string => {
  const basePrompt = [
    '你是员工档案录入助手，请从简历文本中提取适合写入人员档案的数据。',
    '要求：',
    '1. 仅输出 schema 中定义的字段。',
    '2. 无法确认的字段留空，不要编造。',
    '3. 工资字段仅在文本中明确出现时填写数值，不要输出范围或带单位字符串。',
    '4. 日期尽量标准化为 YYYY-MM-DD，无法精确到日时可仅保留原文中最明确的信息。',
    '5. work_experience 输出概括后的工作经历摘要，remark 输出补充说明。',
  ].join('\n');
  const extraPrompt = String(customPrompt || '').trim();
  return extraPrompt ? `${basePrompt}\n6. 额外要求：${extraPrompt}` : basePrompt;
};

const buildResumeDraft = (filePath: string, resumeText: string, extracted?: PersonnelResumeParsedData): PersonnelResumeParsedData => ({
  ...(extracted || {}),
  salary_currency: String(extracted?.salary_currency || 'CNY').trim() || 'CNY',
  resume_file_path: filePath,
  resume_text: resumeText,
});

const getCurrentLibraryPath = (): string => {
  const bootstrapConfig = BootstrapService.getInstance().readConfig();
  const libraryPath = String(bootstrapConfig?.projectPath || '').trim();
  if (!libraryPath) {
    throw new Error('当前未加载资源库，无法保存员工简历文件');
  }
  return path.resolve(libraryPath);
};

const sanitizePersonnelName = (value: unknown): string => {
  const text = String(value || '').trim();
  return sanitizeFolderName(text || '未命名员工');
};

const getFileStem = (filePath: string): string => {
  const ext = path.extname(filePath);
  return path.basename(filePath, ext);
};

const toBatchScanItem = (folderPath: string, filePath: string): PersonnelBatchResumeScanItem => ({
  filePath,
  fileName: path.basename(filePath),
  extension: path.extname(filePath).toLowerCase(),
  relativePath: path.relative(folderPath, filePath) || path.basename(filePath),
});

const scanResumeFilesInFolder = (folderPath: string): PersonnelBatchResumeScanItem[] => {
  const root = path.resolve(folderPath);
  const queue = [root];
  const results: PersonnelBatchResumeScanItem[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !fs.existsSync(current)) continue;
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        return;
      }
      if (!entry.isFile()) return;
      const ext = path.extname(entry.name).toLowerCase();
      if (!PERSONNEL_BATCH_RESUME_SUPPORTED_EXTS.has(ext)) return;
      results.push(toBatchScanItem(root, fullPath));
    });
  }
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
};

const copyResumeIntoLibrary = async (sourcePath: string, personnelName?: string): Promise<string> => {
  const resolvedSourcePath = path.resolve(String(sourcePath || '').trim());
  if (!resolvedSourcePath) {
    throw new Error('简历文件路径不能为空');
  }
  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error('简历源文件不存在');
  }

  const libraryPath = getCurrentLibraryPath();
  const baseDir = path.join(libraryPath, PERSONNEL_RESUME_BASE_DIR);
  await ensureDir(baseDir);

  const folderName = makeUniqueContractFolderName(baseDir, sanitizePersonnelName(personnelName || getFileStem(resolvedSourcePath)));
  const targetDir = path.join(baseDir, folderName);
  await ensureDir(targetDir);

  const originalName = path.basename(resolvedSourcePath);
  const desiredTargetPath = path.join(targetDir, sanitizeFolderName(originalName));
  const targetPath = await makeUniquePath(desiredTargetPath);
  await fs.promises.copyFile(resolvedSourcePath, targetPath);
  return targetPath;
};

const normalizeStoredLibraryPath = (absolutePath: string, libraryPath: string): string => {
  const resolvedFilePath = path.resolve(absolutePath);
  const resolvedLibraryPath = path.resolve(libraryPath);
  if (resolvedFilePath === resolvedLibraryPath || resolvedFilePath.startsWith(`${resolvedLibraryPath}${path.sep}`)) {
    return resolvedFilePath;
  }
  return '';
};

const copyPersonnelPhotoIntoLibrary = async (sourcePath: string, personnelName?: string): Promise<string> => {
  const resolvedSourcePath = path.resolve(String(sourcePath || '').trim());
  if (!resolvedSourcePath) {
    throw new Error('员工照片路径不能为空');
  }
  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error('员工照片源文件不存在');
  }

  const libraryPath = getCurrentLibraryPath();
  const storedPath = normalizeStoredLibraryPath(resolvedSourcePath, libraryPath);
  if (storedPath) {
    return storedPath;
  }

  const baseDir = path.join(libraryPath, PERSONNEL_RESUME_BASE_DIR, sanitizePersonnelName(personnelName), PERSONNEL_PHOTO_DIR);
  await ensureDir(baseDir);

  const originalName = path.basename(resolvedSourcePath);
  const desiredTargetPath = path.join(baseDir, sanitizeFolderName(originalName));
  const targetPath = await makeUniquePath(desiredTargetPath);
  await fs.promises.copyFile(resolvedSourcePath, targetPath);
  return targetPath;
};

const normalizePersonnelPhotoPath = async (photoFilePath: unknown, personnelName?: string): Promise<string> => {
  const rawPath = String(photoFilePath || '').trim();
  if (!rawPath) return '';
  return copyPersonnelPhotoIntoLibrary(rawPath, personnelName || '未命名员工');
};

const parseResumeFile = async (payload: PersonnelResumeParseRequest): Promise<PersonnelResumeParseResult> => {
  const filePath = String(payload?.filePath || '').trim();
  if (!filePath) {
    throw new Error('缺少简历文件路径');
  }

  const conversion = await FileConversionService.getInstance().convertToMarkdown(filePath);
  const sourceText = String(conversion.markdown || '').trim();
  if (!sourceText) {
    throw new Error('简历转换结果为空，无法解析');
  }

  const parsed = await AIService.getInstance().generateStructured<PersonnelResumeParsedData>({
    scene: 'personnel-resume-parse',
    prompt: buildResumeParsePrompt(payload?.prompt),
    sourceText,
    schema: PERSONNEL_RESUME_PARSE_SCHEMA.map(item => ({ ...item })),
  });

  const storedFilePath = await copyResumeIntoLibrary(filePath, parsed.data?.name);

  return {
    conversion,
    parsed,
    draft: buildResumeDraft(storedFilePath, sourceText, parsed.data),
  };
};

const buildPersonnelCreatePayloadFromDraft = (draft: PersonnelResumeParsedData): PersonnelCreateDTO => ({
  code: IdGenerator.generateCode('PER'),
  name: String(draft.name || '').trim(),
  department_ids: [],
  position: String(draft.position || '').trim(),
  phone: String(draft.phone || '').trim(),
  email: String(draft.email || '').trim(),
  entry_date: '',
  status: '在职',
  salary_base: draft.salary_base ?? null,
  salary_monthly: draft.salary_monthly ?? null,
  salary_currency: String(draft.salary_currency || 'CNY').trim() || 'CNY',
  salary_bank_name: String(draft.salary_bank_name || '').trim(),
  salary_bank_account: String(draft.salary_bank_account || '').trim(),
  archive_no: String(draft.archive_no || '').trim(),
  gender: String(draft.gender || '').trim(),
  birth_date: String(draft.birth_date || '').trim(),
  id_card_number: String(draft.id_card_number || '').trim(),
  address: String(draft.address || '').trim(),
  education: String(draft.education || '').trim(),
  graduate_school: String(draft.graduate_school || '').trim(),
  major: String(draft.major || '').trim(),
  emergency_contact: String(draft.emergency_contact || '').trim(),
  emergency_contact_phone: String(draft.emergency_contact_phone || '').trim(),
  resume_file_path: String(draft.resume_file_path || '').trim(),
  resume_text: String(draft.resume_text || '').trim(),
  work_experience: String(draft.work_experience || '').trim(),
  remark: String(draft.remark || '').trim(),
});

const PERSONNEL_DOCUMENT_PARSE_SCHEMA = [
  { key: 'doc_name', type: 'string', description: '证件名称' },
  { key: 'doc_number', type: 'string', description: '证件号码' },
  { key: 'issuer', type: 'string', description: '发证机构' },
  { key: 'issue_date', type: 'string', description: '发证日期，尽量 YYYY-MM-DD' },
  { key: 'expiry_date', type: 'string', description: '有效期截止日期，尽量 YYYY-MM-DD' },
  { key: 'id_card_number', type: 'string', description: '身份证号码（身份证时尽量提取）' },
  { key: 'address', type: 'string', description: '身份证地址（身份证时尽量提取）' },
  { key: 'birth_date', type: 'string', description: '出生日期（身份证时尽量提取）' },
  { key: 'graduate_school', type: 'string', description: '毕业院校（毕业证时尽量提取）' },
  { key: 'education', type: 'string', description: '学历层次（毕业证时尽量提取）' },
] as const;

const normalizeDocumentTypeLabel = (docType: PersonnelDocumentType): string => {
  if (docType === 'id_card') return '身份证';
  if (docType === 'diploma') return '毕业证';
  return '其他';
};

const buildPersonnelDocumentPrompt = (docType: PersonnelDocumentType): string => [
  `你是员工证件解析助手。当前证件类型：${normalizeDocumentTypeLabel(docType)}。`,
  '请仅输出 schema 中字段，无法确认留空，不要编造。',
  '如果是其他证件，请优先识别 doc_name。',
  '日期尽量规范为 YYYY-MM-DD。',
].join('\n');

const parsePersonnelDocument = async (filePath: string, docType: PersonnelDocumentType): Promise<{
  aiExtractJson: string;
  docName: string;
  docNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  draft: PersonnelDocumentPatchDraft;
}> => {
  const conversion = await FileConversionService.getInstance().convertToMarkdown(filePath);
  const sourceText = String(conversion.markdown || '').trim();
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
    scene: 'personnel-document-parse',
    prompt: buildPersonnelDocumentPrompt(docType),
    sourceText,
    schema: PERSONNEL_DOCUMENT_PARSE_SCHEMA.map(item => ({ ...item })),
  });
  const data = parsed.data || {};
  return {
    aiExtractJson: JSON.stringify(data),
    docName: String(data.doc_name || '').trim(),
    docNumber: String(data.doc_number || '').trim(),
    issuer: String(data.issuer || '').trim(),
    issueDate: String(data.issue_date || '').trim(),
    expiryDate: String(data.expiry_date || '').trim(),
    draft: {
      id_card_number: String(data.id_card_number || '').trim() || undefined,
      address: String(data.address || '').trim() || undefined,
      birth_date: String(data.birth_date || '').trim() || undefined,
      graduate_school: String(data.graduate_school || '').trim() || undefined,
      education: String(data.education || '').trim() || undefined,
    },
  };
};

const copyDocumentFilesIntoLibrary = async (personnelName: string, docType: PersonnelDocumentType, sourcePaths: string[]): Promise<string[]> => {
  const libraryPath = getCurrentLibraryPath();
  const baseDir = path.join(libraryPath, PERSONNEL_RESUME_BASE_DIR, sanitizePersonnelName(personnelName || '未命名员工'), PERSONNEL_DOCUMENTS_DIR, normalizeDocumentTypeLabel(docType));
  await ensureDir(baseDir);
  const relativePaths: string[] = [];
  for (const sourcePath of sourcePaths) {
    const resolved = path.resolve(String(sourcePath || '').trim());
    if (!resolved || !fs.existsSync(resolved)) continue;
    const originalName = path.basename(resolved);
    const desiredPath = path.join(baseDir, sanitizeFolderName(originalName));
    const targetPath = await makeUniquePath(desiredPath);
    await fs.promises.copyFile(resolved, targetPath);
    relativePaths.push(path.relative(libraryPath, targetPath));
  }
  return relativePaths;
};

const buildDocumentPreviewImage = async (storedRelativePath?: string): Promise<string> => {
  const libraryPath = getCurrentLibraryPath();
  const relativePath = String(storedRelativePath || '').trim();
  if (!relativePath) return '';
  const absolutePath = path.resolve(libraryPath, relativePath);
  if (!fs.existsSync(absolutePath)) return '';
  if (IMAGE_FILE_REGEXP.test(absolutePath)) {
    return relativePath;
  }
  if (!PDF_FILE_REGEXP.test(absolutePath)) {
    return '';
  }

  const parsedPath = path.parse(absolutePath);
  const previewPath = await makeUniquePath(path.join(parsedPath.dir, `${parsedPath.name}.preview.png`));
  const previewBytes = await PdfOcrService.getInstance().renderPdfPagePreviewAsPng(absolutePath, 1);
  await fs.promises.writeFile(previewPath, previewBytes);
  return path.relative(libraryPath, previewPath);
};

const importResumeFile = async (filePath: string, folderPath?: string, prompt?: string): Promise<PersonnelBatchImportItemResult> => {
  const resolvedFilePath = path.resolve(String(filePath || '').trim());
  const result: PersonnelBatchImportItemResult = {
    filePath: resolvedFilePath,
    fileName: path.basename(resolvedFilePath),
    extension: path.extname(resolvedFilePath).toLowerCase(),
    relativePath: folderPath ? (path.relative(folderPath, resolvedFilePath) || path.basename(resolvedFilePath)) : path.basename(resolvedFilePath),
    status: 'failed',
    created: false,
  };

  try {
    const parsed = await parseResumeFile({ filePath: resolvedFilePath, prompt });
    const draft = parsed.draft;
    const createdPersonnel = DatabaseService.getInstance().createPersonnel(buildPersonnelCreatePayloadFromDraft(draft));
    result.status = 'saved';
    result.created = true;
    result.personnelId = createdPersonnel.id;
    result.personnelName = createdPersonnel.name;
    result.draft = draft;
    result.summary = {
      name: draft.name,
      position: draft.position,
      phone: draft.phone,
      email: draft.email,
    };
    return result;
  } catch (error) {
    result.status = 'failed';
    result.created = false;
    result.error = error instanceof Error ? error.message : String(error || '导入失败');
    return result;
  }
};

export const personnelHandlers = {
  [PERSONNEL_CREATE]: async (_event: IpcMainInvokeEvent, dto: PersonnelCreateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const payload: PersonnelCreateDTO = {
        ...dto,
        photo_file_path: await normalizePersonnelPhotoPath(dto.photo_file_path, dto.name),
      };
      const result = db.createPersonnel(payload);
      return ok(result);
    } catch (error) {
      logger.error('创建人员失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_UPDATE]: async (_event: IpcMainInvokeEvent, dto: PersonnelUpdateDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const current = db.getPersonnelById(String(dto.id || '').trim());
      const result = db.updatePersonnel({
        ...dto,
        photo_file_path: dto.photo_file_path === undefined
          ? undefined
          : await normalizePersonnelPhotoPath(dto.photo_file_path, dto.name || current?.name),
      });
      return ok(result);
    } catch (error) {
      logger.error('更新人员失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_DELETE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.deletePersonnel(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('删除人员失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_RESTORE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.restorePersonnel(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('还原人员失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_PURGE]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      db.purgePersonnel(id);
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除人员失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_GET]: async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getPersonnelById(id);
      return ok(result);
    } catch (error) {
      logger.error('获取人员详情失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_GET_LIST]: async (_event: IpcMainInvokeEvent, query: PersonnelQueryDTO) => {
    try {
      const db = DatabaseService.getInstance();
      const result = db.getPersonnels(query || {});
      return ok(result);
    } catch (error) {
      logger.error('获取人员列表失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_PARSE_RESUME]: async (_event: IpcMainInvokeEvent, payload: PersonnelResumeParseRequest): Promise<IpcResponse<PersonnelResumeParseResult>> => {
    try {
      return ok(await parseResumeFile(payload));
    } catch (error) {
      logger.error('解析简历失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_SCAN_RESUME_FOLDER]: async (_event: IpcMainInvokeEvent, folderPath: string): Promise<IpcResponse<PersonnelBatchResumeScanResult>> => {
    try {
      const targetPath = path.resolve(String(folderPath || '').trim());
      if (!targetPath) {
        throw new Error('文件夹路径不能为空');
      }
      if (!fs.existsSync(targetPath)) {
        throw new Error('文件夹不存在');
      }
      if (!fs.statSync(targetPath).isDirectory()) {
        throw new Error('目标路径不是文件夹');
      }
      const items = scanResumeFilesInFolder(targetPath);
      return ok({
        folderPath: targetPath,
        total: items.length,
        items,
      });
    } catch (error) {
      logger.error('扫描简历文件夹失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_BATCH_IMPORT_RESUMES]: async (_event: IpcMainInvokeEvent, payload: PersonnelBatchImportRequest): Promise<IpcResponse<PersonnelBatchImportResult>> => {
    try {
      const filePaths = Array.isArray(payload?.filePaths)
        ? payload.filePaths.map(item => path.resolve(String(item || '').trim())).filter(Boolean)
        : [];
      if (!filePaths.length) {
        throw new Error('缺少待导入的简历文件');
      }
      const folderPath = String(payload?.folderPath || '').trim();
      const results: PersonnelBatchImportItemResult[] = [];
      for (const filePath of filePaths) {
        results.push(await importResumeFile(filePath, folderPath || undefined, payload?.prompt));
      }
      return ok({
        folderPath: folderPath || undefined,
        total: results.length,
        results,
      });
    } catch (error) {
      logger.error('批量导入简历失败:', error);
      return fail(error);
    }
  },

  [PERSONNEL_UPDATE_SORT]: async (_event: IpcMainInvokeEvent, updates: PersonnelSortOrderUpdate[]) => {
    try {
      const db = DatabaseService.getInstance();
      const updatedCount = db.updatePersonnelSortOrder(Array.isArray(updates) ? updates : []);
      return ok({ updatedCount });
    } catch (error) {
      logger.error('更新人员排序失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_ADD_DOCUMENTS]: async (_event: IpcMainInvokeEvent, payload: PersonnelDocumentCreateRequest): Promise<IpcResponse<PersonnelDocumentCreateResult>> => {
    try {
      const db = DatabaseService.getInstance();
      const personnel = db.getPersonnelById(String(payload?.personnelId || '').trim());
      if (!personnel) {
        throw new Error('员工不存在');
      }
      const docType = (String(payload?.docType || 'other').trim() as PersonnelDocumentType) || 'other';
      const files = Array.isArray(payload?.localFilePaths) ? payload.localFilePaths.map(item => String(item || '').trim()).filter(Boolean) : [];
      if (!files.length) {
        throw new Error('缺少证件文件');
      }
      const storedRelativePaths = await copyDocumentFilesIntoLibrary(personnel.name, docType, files);
      if (!storedRelativePaths.length) {
        throw new Error('证件文件复制失败');
      }
      let previewImageRelativePath = '';
      try {
        previewImageRelativePath = await buildDocumentPreviewImage(storedRelativePaths[0]);
      } catch (error) {
        logger.warn('生成员工证件预览图失败，将回退到文件预览', {
          filePath: storedRelativePaths[0],
          error,
        });
      }
      const firstAbsolutePath = path.resolve(getCurrentLibraryPath(), storedRelativePaths[0]);
      const parsed = await parsePersonnelDocument(firstAbsolutePath, docType);
      const created = db.addPersonnelDocument({
        personnelId: personnel.id,
        docType,
        localFilePaths: files,
        storedRelativePaths,
        previewImageRelativePath,
        manualDocName: String(payload?.manualDocName || '').trim() || parsed.docName || normalizeDocumentTypeLabel(docType),
        aiExtractJson: parsed.aiExtractJson,
        draft: parsed.draft,
      });
      const updated = db.updatePersonnelDocument({
        id: created.document.id,
        doc_number: parsed.docNumber,
        issuer: parsed.issuer,
        issue_date: parsed.issueDate,
        expiry_date: parsed.expiryDate,
      });
      return ok({
        ...created,
        document: updated || created.document,
      });
    } catch (error) {
      logger.error('新增员工证件失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_LIST_DOCUMENTS]: async (_event: IpcMainInvokeEvent, personnelId: string): Promise<IpcResponse<PersonnelDocument[]>> => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.listPersonnelDocuments(String(personnelId || '').trim()));
    } catch (error) {
      logger.error('获取员工证件失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_UPDATE_DOCUMENT]: async (_event: IpcMainInvokeEvent, dto: PersonnelDocumentUpdateDTO): Promise<IpcResponse<PersonnelDocument | null>> => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.updatePersonnelDocument(dto));
    } catch (error) {
      logger.error('更新员工证件失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_DELETE_DOCUMENT]: async (_event: IpcMainInvokeEvent, id: string): Promise<IpcResponse<{ success: boolean }>> => {
    try {
      const db = DatabaseService.getInstance();
      db.deletePersonnelDocument(String(id || '').trim());
      return ok({ success: true });
    } catch (error) {
      logger.error('删除员工证件失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_APPLY_DOCUMENT_DRAFT]: async (_event: IpcMainInvokeEvent, dto: PersonnelDocumentApplyDraftDTO): Promise<IpcResponse<any>> => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.applyPersonnelDocumentDraft(dto));
    } catch (error) {
      logger.error('应用证件回填失败:', error);
      return fail(error);
    }
  },
  [PERSONNEL_REJECT_DOCUMENT_DRAFT]: async (_event: IpcMainInvokeEvent, documentId: string): Promise<IpcResponse<PersonnelDocument | null>> => {
    try {
      const db = DatabaseService.getInstance();
      return ok(db.rejectPersonnelDocumentDraft(String(documentId || '').trim()));
    } catch (error) {
      logger.error('拒绝证件回填失败:', error);
      return fail(error);
    }
  },
};
