import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import * as channels from '../../../channels';
import { ok, fail } from '../../../../../shared/types/ipc.types';
import {
  ContractInfoBatchDeleteDTO,
  ContractInfoCreateDTO,
  ContractInfoCreateResult,
  ContractInfoDeleteDTO,
  ContractInfoEntity,
  ContractInfoMoveDTO,
  ContractInfoUpdateDTO,
} from '../../../../../shared/types/contractInfo.types';
import type { CustomerContact } from '../../../../../shared/types/customer.types';
import type { Supplier, SupplierContact } from '../../../../../shared/types/supplier.types';
import { IdGenerator } from '../../../../../shared/utils/idGenerator';
import {
  ensureDir,
  ensurePathWithin,
  ensureValidFolderName,
  formatCompactDate,
  hasTable,
  LibraryHandlerMap,
  logger,
  makeUniquePath,
  makeUniqueContractFolderName,
  moveFolder,
  openLibraryDb,
  sanitizeFolderName,
  serializeContractExtDataFromDto,
  validateContractFormDto,
} from './shared';
import { markContractCalendarEventsDeleted, markProductCalendarEventsDeletedByContractId, syncContractCalendarEventsById } from './calendarEvents';
import { ensureUnitLibraryDirectory } from '../../../../utils/unitLibrary';

const trimText = (value: unknown): string => String(value || '').trim();

const normalizeNameKey = (value: unknown) => String(value || '').trim().toLowerCase();

const normalizeCustomerContacts = (raw: unknown): CustomerContact[] => {
  const normalizeArray = (parsed: unknown[]) => {
    return parsed.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const obj = item as Record<string, unknown>;
      return {
        id: String(obj.id || '').trim() || IdGenerator.generateCode('CUSC'),
        name: String(obj.name || '').trim(),
        department: String(obj.department || '').trim(),
        mobile: String(obj.mobile || '').trim(),
        phone: String(obj.phone || '').trim(),
        email: String(obj.email || '').trim(),
        id_number: String(obj.id_number || '').trim(),
        is_legal_representative: Boolean(obj.is_legal_representative),
        is_primary: Boolean(obj.is_primary),
      } satisfies CustomerContact;
    }).filter((item): item is CustomerContact => Boolean(item));
  };

  if (Array.isArray(raw)) return normalizeArray(raw as unknown[]);

  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeArray(parsed);
  } catch {
    return [];
  }
};

const normalizeSupplierContacts = (raw: unknown): SupplierContact[] => {
  const normalizeArray = (parsed: unknown[]) => {
    return parsed.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const obj = item as Record<string, unknown>;
      return {
        id: String(obj.id || '').trim() || IdGenerator.generateCode('SUPC'),
        name: String(obj.name || '').trim(),
        department: String(obj.department || '').trim(),
        mobile: String(obj.mobile || '').trim(),
        phone: String(obj.phone || '').trim(),
        email: String(obj.email || '').trim(),
        id_number: String(obj.id_number || '').trim(),
        wechat: String(obj.wechat || '').trim(),
        is_legal_representative: Boolean(obj.is_legal_representative),
        is_primary: Boolean(obj.is_primary),
      } satisfies SupplierContact;
    }).filter((item): item is SupplierContact => Boolean(item));
  };

  if (Array.isArray(raw)) return normalizeArray(raw as unknown[]);

  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeArray(parsed);
  } catch {
    return [];
  }
};

const buildCustomerContactsJson = (
  dto: ContractInfoCreateDTO,
  existingContactsRaw: unknown,
): { json: string; changed: boolean } => {
  const contactName = trimText(dto.partyAContact);
  const contactMobile = trimText(dto.partyAContactMobile);
  const contactPhone = trimText(dto.partyAContactPhone || dto.partyAPhone);
  const contactEmail = trimText(dto.partyAContactEmail);
  const contactIdNumber = trimText(dto.partyAContactIdNumber);
  const hasInput = Boolean(contactName || contactMobile || contactPhone || contactEmail || contactIdNumber);
  if (!hasInput) return { json: '', changed: false };

  const fillIfEmpty = (current: string, incoming: string) => {
    if (String(current || '').trim()) return current;
    return incoming;
  };

  const existing = normalizeCustomerContacts(existingContactsRaw);
  const updated = [...existing];

  const normalizedName = normalizeNameKey(contactName || '联系人');
  let idx = updated.findIndex((item) => Boolean(item.is_primary) && !item.is_legal_representative);
  if (idx < 0 && normalizedName) {
    idx = updated.findIndex((item) => normalizeNameKey(item.name) === normalizedName);
  }
  const original = idx >= 0 ? updated[idx] : null;
  const next: CustomerContact = {
    id: original?.id || IdGenerator.generateCode('CUSC'),
    name: original?.name || '',
    department: original?.department || '',
    mobile: original?.mobile || '',
    phone: original?.phone || '',
    email: original?.email || '',
    id_number: original?.id_number || '',
    is_legal_representative: original?.is_legal_representative ?? false,
    is_primary: true,
  };
  next.name = fillIfEmpty(next.name, contactName || '联系人');
  next.mobile = fillIfEmpty(next.mobile, contactMobile);
  next.phone = fillIfEmpty(next.phone, contactPhone);
  next.email = fillIfEmpty(next.email, contactEmail);
  next.id_number = fillIfEmpty(next.id_number, contactIdNumber);

  if (idx >= 0) updated[idx] = next;
  else updated.push(next);

  const nextJson = JSON.stringify(updated);
  const currentJson = typeof existingContactsRaw === 'string'
    ? String(existingContactsRaw || '').trim()
    : (Array.isArray(existingContactsRaw) ? JSON.stringify(existingContactsRaw) : '');
  return { json: nextJson, changed: nextJson !== currentJson };
};

const buildSupplierContactsJson = (
  dto: ContractInfoCreateDTO,
  existingContactsRaw: unknown,
  existingSupplier?: Supplier | null,
): { json: string; changed: boolean } => {
  const repName = trimText(dto.partyBLegalRepName || existingSupplier?.legal_rep_name);
  const repMobile = trimText(dto.partyBLegalRepMobile || existingSupplier?.legal_rep_mobile);
  const repEmail = trimText(dto.partyBLegalRepEmail || existingSupplier?.legal_rep_email);
  const repId = trimText(dto.partyBLegalRepIdNumber || existingSupplier?.legal_rep_id_number || dto.partyBContactIdNumber);

  const contactName = trimText(dto.partyBContact);
  const contactMobile = trimText(dto.partyBContactMobile);
  const contactPhone = trimText(dto.partyBContactPhone || dto.partyBPhone || dto.partyBContactMobile);
  const contactEmail = trimText(dto.partyBContactEmail);
  const contactIdNumber = trimText(dto.partyBContactIdNumber);

  const hasInput = Boolean(
    repName || repMobile || repEmail || repId
    || contactName || contactMobile || contactPhone || contactEmail || contactIdNumber,
  );
  if (!hasInput) return { json: '', changed: false };

  const fillIfEmpty = (current: string, incoming: string) => {
    if (String(current || '').trim()) return current;
    return incoming;
  };

  const existing = normalizeSupplierContacts(existingContactsRaw);
  const updated = [...existing];

  if (repName || repMobile || repEmail || repId) {
    const idx = updated.findIndex((item) => Boolean(item.is_legal_representative));
    const original = idx >= 0 ? updated[idx] : null;
    const next: SupplierContact = {
      id: original?.id || IdGenerator.generateCode('SUPC'),
      name: original?.name || '',
      department: original?.department || '',
      mobile: original?.mobile || '',
      phone: original?.phone || '',
      email: original?.email || '',
      id_number: original?.id_number || '',
      wechat: original?.wechat || '',
      is_legal_representative: true,
      is_primary: original?.is_primary ?? true,
    };
    next.name = fillIfEmpty(next.name, repName || '法人');
    next.mobile = fillIfEmpty(next.mobile, repMobile);
    next.email = fillIfEmpty(next.email, repEmail);
    next.id_number = fillIfEmpty(next.id_number, repId);
    if (idx >= 0) updated[idx] = next;
    else updated.push(next);
  }

  if (contactName || contactMobile || contactPhone || contactEmail || contactIdNumber) {
    const normalizedContactName = normalizeNameKey(contactName || '联系人');
    let idx = updated.findIndex((item) => Boolean(item.is_primary) && !item.is_legal_representative);
    if (idx < 0 && normalizedContactName) {
      idx = updated.findIndex((item) => normalizeNameKey(item.name) === normalizedContactName);
    }
    const original = idx >= 0 ? updated[idx] : null;
    const next: SupplierContact = {
      id: original?.id || IdGenerator.generateCode('SUPC'),
      name: original?.name || '',
      department: original?.department || '',
      mobile: original?.mobile || '',
      phone: original?.phone || '',
      email: original?.email || '',
      id_number: original?.id_number || '',
      wechat: original?.wechat || '',
      is_legal_representative: original?.is_legal_representative ?? false,
      is_primary: true,
    };
    next.name = fillIfEmpty(next.name, contactName || '联系人');
    next.mobile = fillIfEmpty(next.mobile, contactMobile);
    next.phone = fillIfEmpty(next.phone, contactPhone);
    next.email = fillIfEmpty(next.email, contactEmail);
    next.id_number = fillIfEmpty(next.id_number, contactIdNumber);
    if (idx >= 0) updated[idx] = next;
    else updated.push(next);
  }

  const nextJson = JSON.stringify(updated);
  const currentJson = typeof existingContactsRaw === 'string'
    ? String(existingContactsRaw || '').trim()
    : (Array.isArray(existingContactsRaw) ? JSON.stringify(existingContactsRaw) : '');
  return { json: nextJson, changed: nextJson !== currentJson };
};

const syncCustomerFromContract = (
  db: Database.Database,
  libraryPath: string,
  dto: ContractInfoCreateDTO,
): void => {
  const name = trimText(dto.clientName);
  if (!name) return;

  const contact = trimText(dto.partyAContact);
  const mobile = trimText(dto.partyAContactMobile);
  const phone = trimText(dto.partyAPhone || dto.partyAContactPhone);
  const email = trimText(dto.partyAContactEmail);
  const address = trimText(dto.partyAAddress);
  const taxNumber = trimText(dto.partyATaxNumber);
  const bankName = trimText(dto.partyABankName);
  const bankAccount = trimText(dto.partyABankAccount);
  const invoiceType = trimText(dto.partyAInvoiceType);
  const existing = db.prepare(`
    SELECT id, deleted_at, contacts
    FROM customers
    WHERE TRIM(name) = ?
    ORDER BY CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC, datetime(created_at) DESC
    LIMIT 1
  `).get(name) as { id: string; deleted_at?: string | null; contacts?: string | null } | undefined;

  const contactsJson = buildCustomerContactsJson(dto, existing?.contacts);

  if (existing?.id) {
    db.prepare(`
      UPDATE customers
      SET
        deleted_at = NULL,
        contact = CASE
          WHEN TRIM(COALESCE(contact, '')) = '' AND ? <> '' THEN ?
          ELSE contact
        END,
        mobile = CASE
          WHEN TRIM(COALESCE(mobile, '')) = '' AND ? <> '' THEN ?
          ELSE mobile
        END,
        phone = CASE
          WHEN TRIM(COALESCE(phone, '')) = '' AND ? <> '' THEN ?
          ELSE phone
        END,
        email = CASE
          WHEN TRIM(COALESCE(email, '')) = '' AND ? <> '' THEN ?
          ELSE email
        END,
        address = CASE
          WHEN TRIM(COALESCE(address, '')) = '' AND ? <> '' THEN ?
          ELSE address
        END,
        tax_number = CASE
          WHEN TRIM(COALESCE(tax_number, '')) = '' AND ? <> '' THEN ?
          ELSE tax_number
        END,
        bank_name = CASE
          WHEN TRIM(COALESCE(bank_name, '')) = '' AND ? <> '' THEN ?
          ELSE bank_name
        END,
        bank_account = CASE
          WHEN TRIM(COALESCE(bank_account, '')) = '' AND ? <> '' THEN ?
          ELSE bank_account
        END,
        invoice_type = CASE
          WHEN TRIM(COALESCE(invoice_type, '')) = '' AND ? <> '' THEN ?
          ELSE invoice_type
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      contact, contact,
      mobile, mobile,
      phone, phone,
      email, email,
      address, address,
      taxNumber, taxNumber,
      bankName, bankName,
      bankAccount, bankAccount,
      invoiceType, invoiceType,
      existing.id,
    );
    if (contactsJson.changed && contactsJson.json) {
      db.prepare(`
        UPDATE customers
        SET contacts = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(contactsJson.json, existing.id);
    }
  } else {
    db.prepare(`
      INSERT INTO customers (
        id, group_name, code, name, contact, department, mobile, wechat, phone, fax, email, address, msn,
        company_type, industry, products, website, capital, country, province, city, reg_date, tax_number,
        bank_name, bank_account, invoice_type, custom1, custom2, custom3, custom4, contacts
      ) VALUES (
        ?, '', ?, ?, ?, '', ?, '', ?, '', ?, '', '',
        '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', ?
      )
    `).run(
      crypto.randomUUID(),
      IdGenerator.generateCode('CUS'),
      name,
      contact,
      mobile,
      phone,
      email,
      contactsJson.json || '[]',
    );

    const inserted = db.prepare(`
      SELECT id
      FROM customers
      WHERE TRIM(name) = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).get(name) as { id: string } | undefined;

    if (inserted?.id) {
      db.prepare(`
        UPDATE customers
        SET
          address = CASE WHEN TRIM(COALESCE(address, '')) = '' AND ? <> '' THEN ? ELSE address END,
          tax_number = CASE WHEN TRIM(COALESCE(tax_number, '')) = '' AND ? <> '' THEN ? ELSE tax_number END,
          bank_name = CASE WHEN TRIM(COALESCE(bank_name, '')) = '' AND ? <> '' THEN ? ELSE bank_name END,
          bank_account = CASE WHEN TRIM(COALESCE(bank_account, '')) = '' AND ? <> '' THEN ? ELSE bank_account END,
          invoice_type = CASE WHEN TRIM(COALESCE(invoice_type, '')) = '' AND ? <> '' THEN ? ELSE invoice_type END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        address, address,
        taxNumber, taxNumber,
        bankName, bankName,
        bankAccount, bankAccount,
        invoiceType, invoiceType,
        inserted.id,
      );
    }
  }

  ensureUnitLibraryDirectory('party-a', name, libraryPath);
};

const syncSupplierFromContract = (
  db: Database.Database,
  libraryPath: string,
  dto: ContractInfoCreateDTO,
): void => {
  const name = trimText(dto.partyBName);
  if (!name) return;

  const contact = trimText(dto.partyBContact);
  const phone = trimText(dto.partyBPhone || dto.partyBContactPhone || dto.partyBContactMobile);
  const email = trimText(dto.partyBContactEmail);
  const legalRepIdNumber = trimText(dto.partyBContactIdNumber);
  const address = trimText(dto.partyBAddress);
  const taxNumber = trimText(dto.partyBTaxNumber);
  const bankName = trimText(dto.partyBBankName);
  const bankAccount = trimText(dto.partyBBankAccount);
  const invoiceType = trimText(dto.partyBInvoiceType);
  const legalRepName = trimText(dto.partyBLegalRepName);
  const legalRepMobile = trimText(dto.partyBLegalRepMobile);
  const legalRepEmail = trimText(dto.partyBLegalRepEmail);
  const legalRepId = trimText(dto.partyBLegalRepIdNumber || legalRepIdNumber);
  const existing = db.prepare(`
    SELECT id, deleted_at, contacts, legal_rep_name, legal_rep_mobile, legal_rep_email, legal_rep_id_number
    FROM suppliers
    WHERE TRIM(name) = ?
    ORDER BY CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC, datetime(created_at) DESC
    LIMIT 1
  `).get(name) as {
    id: string;
    deleted_at?: string | null;
    contacts?: string | null;
    legal_rep_name?: string | null;
    legal_rep_mobile?: string | null;
    legal_rep_email?: string | null;
    legal_rep_id_number?: string | null;
  } | undefined;

  const contactsJson = buildSupplierContactsJson(dto, existing?.contacts, existing ? (existing as Supplier) : null);

  if (existing?.id) {
    db.prepare(`
      UPDATE suppliers
      SET
        deleted_at = NULL,
        contact = CASE
          WHEN TRIM(COALESCE(contact, '')) = '' AND ? <> '' THEN ?
          ELSE contact
        END,
        phone = CASE
          WHEN TRIM(COALESCE(phone, '')) = '' AND ? <> '' THEN ?
          ELSE phone
        END,
        address = CASE
          WHEN TRIM(COALESCE(address, '')) = '' AND ? <> '' THEN ?
          ELSE address
        END,
        tax_number = CASE
          WHEN TRIM(COALESCE(tax_number, '')) = '' AND ? <> '' THEN ?
          ELSE tax_number
        END,
        bank_name = CASE
          WHEN TRIM(COALESCE(bank_name, '')) = '' AND ? <> '' THEN ?
          ELSE bank_name
        END,
        bank_account = CASE
          WHEN TRIM(COALESCE(bank_account, '')) = '' AND ? <> '' THEN ?
          ELSE bank_account
        END,
        invoice_type = CASE
          WHEN TRIM(COALESCE(invoice_type, '')) = '' AND ? <> '' THEN ?
          ELSE invoice_type
        END,
        legal_rep_name = CASE
          WHEN TRIM(COALESCE(legal_rep_name, '')) = '' AND ? <> '' THEN ?
          ELSE legal_rep_name
        END,
        legal_rep_mobile = CASE
          WHEN TRIM(COALESCE(legal_rep_mobile, '')) = '' AND ? <> '' THEN ?
          ELSE legal_rep_mobile
        END,
        legal_rep_email = CASE
          WHEN TRIM(COALESCE(legal_rep_email, '')) = '' AND ? <> '' THEN ?
          ELSE legal_rep_email
        END,
        legal_rep_id_number = CASE
          WHEN TRIM(COALESCE(legal_rep_id_number, '')) = '' AND ? <> '' THEN ?
          ELSE legal_rep_id_number
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      contact, contact,
      phone, phone,
      address, address,
      taxNumber, taxNumber,
      bankName, bankName,
      bankAccount, bankAccount,
      invoiceType, invoiceType,
      legalRepName, legalRepName,
      legalRepMobile, legalRepMobile,
      legalRepEmail, legalRepEmail,
      legalRepId, legalRepId,
      existing.id,
    );
    if (contactsJson.changed && contactsJson.json) {
      db.prepare(`
        UPDATE suppliers
        SET contacts = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(contactsJson.json, existing.id);
    }
  } else {
    db.prepare(`
      INSERT INTO suppliers (
        id, code, name, contact, group_name, bank_account, bank_name, phone, address, tax_number, invoice_type,
        reg_date, legal_rep_name, legal_rep_id_number, legal_rep_mobile, legal_rep_email, contacts
      ) VALUES (
        ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?,
        '', ?, ?, ?, ?, ?
      )
    `).run(
      crypto.randomUUID(),
      IdGenerator.generateCode('SUP'),
      name,
      contact,
      bankAccount,
      bankName,
      phone,
      address,
      taxNumber,
      invoiceType,
      legalRepName,
      legalRepId,
      legalRepMobile || trimText(dto.partyBContactMobile),
      legalRepEmail || email,
      contactsJson.json || '[]',
    );
  }

  ensureUnitLibraryDirectory('party-b', name, libraryPath);
};

const syncPartyUnitsFromContract = (
  db: Database.Database,
  libraryPath: string,
  dto: ContractInfoCreateDTO,
): void => {
  syncCustomerFromContract(db, libraryPath, dto);
  syncSupplierFromContract(db, libraryPath, dto);
};

export const libraryContractMutationHandlers: LibraryHandlerMap = {
  [channels.LIBRARY_CREATE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const createDto = dto as ContractInfoCreateDTO;
      const libraryPath = createDto.libraryPath?.trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }

      db = openLibraryDb(libraryPath);
      const validationError = validateContractFormDto(db, createDto);
      if (validationError) {
        return fail(new Error(validationError));
      }

      const contractCode = createDto.contractCode.trim();
      const existed = db.prepare('SELECT id FROM contract_info WHERE contract_code = ? LIMIT 1')
        .get(contractCode) as { id?: string } | undefined;
      if (existed && existed.id) {
        return fail(new Error('合同编号已存在'));
      }

      const contractName = createDto.contractName.trim();
      const existedName = db.prepare('SELECT id FROM contract_info WHERE contract_name = ? AND deleted_at IS NULL LIMIT 1')
        .get(contractName) as { id?: string } | undefined;
      if (existedName && existedName.id) {
        return fail(new Error('合同名称已存在'));
      }

      const id = crypto.randomUUID();
      const partyBName = createDto.partyBName.trim();
      const folderName = makeUniqueContractFolderName(path.resolve(libraryPath), contractName);
      const projectPath = path.join(path.resolve(libraryPath), folderName);
      const sortOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxSortOrder FROM contract_info WHERE deleted_at IS NULL')
        .get() as { maxSortOrder?: number } | undefined;
      const sortOrder = Number(sortOrderRow?.maxSortOrder || 0) + 1;
      db.prepare(`
        INSERT INTO contract_info (
          id,
          contract_name,
          contract_code,
          signing_date,
          contract_type,
          group_name,
          currency,
          client_name,
          party_a_contact,
          party_a_contact_mobile,
          party_a_contact_phone,
          party_a_contact_email,
          party_a_contact_id_number,
          party_b_name,
          party_b_contact,
          party_b_contact_mobile,
          party_b_contact_phone,
          party_b_contact_email,
          party_b_contact_id_number,
          contract_summary,
          contract_amount,
          contract_status,
          department,
          responsible_person,
          end_date,
          settlement_method,
          signing_form,
          procurement_source,
          execution_method,
          remark,
          contract_tags,
          ext_data,
          folder_name,
          project_icon,
          project_color,
          sort_order
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        id,
        contractName,
        contractCode,
        createDto.signingDate.trim(),
        createDto.contractType.trim(),
        createDto.groupName?.trim() || null,
        createDto.currency?.trim() || null,
        createDto.clientName.trim(),
        createDto.partyAContact?.trim() || null,
        createDto.partyAContactMobile?.trim() || null,
        createDto.partyAContactPhone?.trim() || null,
        createDto.partyAContactEmail?.trim() || null,
        createDto.partyAContactIdNumber?.trim() || null,
        partyBName,
        createDto.partyBContact?.trim() || null,
        createDto.partyBContactMobile?.trim() || null,
        createDto.partyBContactPhone?.trim() || null,
        createDto.partyBContactEmail?.trim() || null,
        createDto.partyBContactIdNumber?.trim() || null,
        createDto.contractSummary.trim(),
        createDto.contractAmount ?? null,
        createDto.contractStatus?.trim() || null,
        createDto.department?.trim() || null,
        createDto.responsiblePerson?.trim() || null,
        createDto.endDate?.trim() || null,
        createDto.settlementMethod?.trim() || null,
        createDto.signingForm?.trim() || null,
        createDto.procurementSource?.trim() || null,
        createDto.executionMethod?.trim() || null,
        createDto.remark?.trim() || null,
        Array.isArray(createDto.contractTags) && createDto.contractTags.length > 0
          ? JSON.stringify(createDto.contractTags)
          : null,
        serializeContractExtDataFromDto(db, createDto),
        folderName,
        createDto.projectIcon?.trim() || null,
        createDto.projectColor?.trim() || null,
        sortOrder,
      );

      try {
        fs.mkdirSync(path.join(projectPath, 'documents'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'source_code'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'certificates'), { recursive: true });
        if (createDto.autoCreatePartyUnits) {
          syncPartyUnitsFromContract(db, libraryPath, createDto);
        }
      } catch (error) {
        db.prepare('DELETE FROM contract_info WHERE id = ?').run(id);
        throw error;
      }

      const result: ContractInfoCreateResult = {
        id,
        folderName,
        projectPath,
      };
      try {
        syncContractCalendarEventsById(db, id);
      } catch (error) {
        logger.error('同步日历事件失败:', error);
      }
      return ok(result);
    } catch (error) {
      logger.error('创建合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_UPDATE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const updateDto = dto as ContractInfoUpdateDTO;
      const libraryPath = String(updateDto.libraryPath || '').trim();
      const id = String(updateDto.id || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!id) {
        return fail(new Error('合同ID不能为空'));
      }

      db = openLibraryDb(libraryPath);
      const validationError = validateContractFormDto(db, updateDto);
      if (validationError) {
        return fail(new Error(validationError));
      }

      const existing = db.prepare(`
        SELECT id, contract_name, contract_code, folder_name, created_at
        FROM contract_info
        WHERE id = ?
        LIMIT 1
      `).get(id) as { id: string; contract_name: string; contract_code: string; folder_name: string; created_at: string | null } | undefined;

      if (!existing) {
        return fail(new Error('未找到合同信息'));
      }

      const nextContractCode = String(updateDto.contractCode || '').trim();
      const existed = db.prepare('SELECT id FROM contract_info WHERE contract_code = ? AND id != ? LIMIT 1')
        .get(nextContractCode, id) as { id?: string } | undefined;
      if (existed && existed.id) {
        return fail(new Error('合同编号已存在'));
      }

      const nextContractName = String(updateDto.contractName || '').trim();
      const existedName = db.prepare('SELECT id FROM contract_info WHERE contract_name = ? AND deleted_at IS NULL AND id != ? LIMIT 1')
        .get(nextContractName, id) as { id?: string } | undefined;
      if (existedName && existedName.id) {
        return fail(new Error('合同名称已存在'));
      }

      let folderName = existing.folder_name;
      const baseDir = path.resolve(libraryPath);
      const baseDirLower = baseDir.toLowerCase();
      if (nextContractName && nextContractName !== String(existing.contract_name || '').trim()) {
        const desiredFolderName = makeUniqueContractFolderName(baseDir, nextContractName);
        if (desiredFolderName && desiredFolderName !== folderName) {
          const oldPath = path.resolve(baseDir, folderName);
          const newPath = path.resolve(baseDir, desiredFolderName);
          if (oldPath.toLowerCase().startsWith(baseDirLower) && newPath.toLowerCase().startsWith(baseDirLower)) {
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
            }
            folderName = path.basename(newPath);
          }
        }
      }

      const tx = db.transaction(() => {
        db!.prepare(`
          UPDATE contract_info SET
            contract_name = ?,
            contract_code = ?,
            signing_date = ?,
            contract_type = ?,
            group_name = ?,
            currency = ?,
            client_name = ?,
            party_a_contact = ?,
            party_a_contact_mobile = ?,
            party_a_contact_phone = ?,
            party_a_contact_email = ?,
            party_a_contact_id_number = ?,
            party_b_name = ?,
            party_b_contact = ?,
            party_b_contact_mobile = ?,
            party_b_contact_phone = ?,
            party_b_contact_email = ?,
            party_b_contact_id_number = ?,
            contract_summary = ?,
            contract_amount = ?,
            contract_status = ?,
            department = ?,
            responsible_person = ?,
            end_date = ?,
            settlement_method = ?,
            signing_form = ?,
            procurement_source = ?,
            execution_method = ?,
            remark = ?,
            contract_tags = ?,
            ext_data = ?,
            folder_name = ?,
            project_icon = ?,
            project_color = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          nextContractName,
          nextContractCode,
          String(updateDto.signingDate || '').trim(),
          String(updateDto.contractType || '').trim(),
          String(updateDto.groupName || '').trim() || null,
          String(updateDto.currency || '').trim() || null,
          String(updateDto.clientName || '').trim(),
          String(updateDto.partyAContact || '').trim() || null,
          String(updateDto.partyAContactMobile || '').trim() || null,
          String(updateDto.partyAContactPhone || '').trim() || null,
          String(updateDto.partyAContactEmail || '').trim() || null,
          String(updateDto.partyAContactIdNumber || '').trim() || null,
          String(updateDto.partyBName || '').trim(),
          String(updateDto.partyBContact || '').trim() || null,
          String(updateDto.partyBContactMobile || '').trim() || null,
          String(updateDto.partyBContactPhone || '').trim() || null,
          String(updateDto.partyBContactEmail || '').trim() || null,
          String(updateDto.partyBContactIdNumber || '').trim() || null,
          String(updateDto.contractSummary || '').trim(),
          updateDto.contractAmount ?? null,
          String(updateDto.contractStatus || '').trim() || null,
          String(updateDto.department || '').trim() || null,
          String(updateDto.responsiblePerson || '').trim() || null,
          String(updateDto.endDate || '').trim() || null,
          String(updateDto.settlementMethod || '').trim() || null,
          String(updateDto.signingForm || '').trim() || null,
          String(updateDto.procurementSource || '').trim() || null,
          String(updateDto.executionMethod || '').trim() || null,
          String(updateDto.remark || '').trim() || null,
          Array.isArray(updateDto.contractTags) && updateDto.contractTags.length > 0
            ? JSON.stringify(updateDto.contractTags)
            : null,
          serializeContractExtDataFromDto(db!, updateDto),
          folderName,
          String(updateDto.projectIcon || '').trim() || null,
          String(updateDto.projectColor || '').trim() || null,
          id,
        );
      });

      tx();

      try {
        syncContractCalendarEventsById(db, id);
      } catch (error) {
        logger.error('同步日历事件失败:', error);
      }

      const row = db.prepare(`
        SELECT
          id,
          contract_name,
          contract_code,
          signing_date,
          contract_type,
          group_name,
          currency,
          client_name,
          party_a_contact,
          party_a_contact_mobile,
          party_a_contact_phone,
          party_a_contact_email,
          party_a_contact_id_number,
          party_b_name,
          party_b_contact,
          party_b_contact_mobile,
          party_b_contact_phone,
          party_b_contact_email,
          party_b_contact_id_number,
          contract_summary,
          contract_amount,
          contract_status,
          department,
          responsible_person,
          end_date,
          settlement_method,
          signing_form,
          procurement_source,
          execution_method,
          remark,
          contract_tags,
          ext_data,
          folder_name,
          project_icon,
          project_color,
          sort_order,
          trash_path,
          deleted_at,
          created_at,
          updated_at
        FROM contract_info
        WHERE id = ?
        LIMIT 1
      `).get(id) as ContractInfoEntity | undefined;

      if (!row) {
        return fail(new Error('更新后读取合同信息失败'));
      }
      return ok(row);
    } catch (error) {
      logger.error('更新合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_DELETE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const deleteDto = (dto || {}) as Partial<ContractInfoDeleteDTO>;
      const libraryPath = String(deleteDto.libraryPath || '').trim();
      const id = String(deleteDto.id || '').trim();
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!id) {
        return fail(new Error('合同ID不能为空'));
      }

      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const row = db.prepare('SELECT id, folder_name FROM contract_info WHERE id = ? LIMIT 1')
        .get(id) as { id: string; folder_name?: string | null } | undefined;
      if (!row) {
        return ok({ success: true });
      }

      const folderName = ensureValidFolderName(String(row.folder_name || '').trim());
      const contractDir = path.join(libraryRoot, folderName);
      ensurePathWithin(libraryRoot, contractDir);

      const trashBase = path.join(libraryRoot, '.trash', 'contracts');
      await ensureDir(trashBase);
      const trashPath = path.join(trashBase, folderName);
      const trashFinal = await makeUniquePath(trashPath);
      ensurePathWithin(trashBase, trashFinal);

      const contractDirPrefix = path.resolve(contractDir) + path.sep;
      let moved = false;
      if (fs.existsSync(contractDir)) {
        await moveFolder(contractDir, trashFinal);
        moved = true;
      }

      db.exec('BEGIN');
      try {
        if (hasTable(db, 'file_content_fts')) {
          db.prepare('DELETE FROM file_content_fts WHERE file_path LIKE ?').run(`${contractDirPrefix}%`);
        }
        if (hasTable(db, 'file_metadata')) {
          db.prepare('DELETE FROM file_metadata WHERE file_path LIKE ?').run(`${contractDirPrefix}%`);
        }
        if (hasTable(db, 'contract_vector_chunks')) {
          db.prepare('DELETE FROM contract_vector_chunks WHERE contract_id = ?').run(id);
        }
        
        db.prepare('UPDATE contract_info SET deleted_at = CURRENT_TIMESTAMP, trash_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(trashFinal, id);
        
        // Also soft delete children to prevent them from showing up in global queries
        db.prepare('UPDATE contract_files SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(id);
        db.prepare('UPDATE contract_products SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(id);
        db.prepare('UPDATE contract_executions SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(id);
        db.prepare('UPDATE contract_receipt_payment SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(id);
        
        try {
          markContractCalendarEventsDeleted(db, id);
          markProductCalendarEventsDeletedByContractId(db, id);
        } catch (error) {
          logger.error('同步日历事件失败:', error);
        }
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
        }
        if (moved) {
          try {
            await moveFolder(trashFinal, contractDir);
          } catch (rollbackError) {
            logger.error('删除回滚失败:', rollbackError);
          }
        }
        throw error;
      }

      return ok({ success: true });
    } catch (error) {
      logger.error('删除合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_DELETE_CONTRACT_INFOS]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const deleteDto = (dto || {}) as Partial<ContractInfoBatchDeleteDTO>;
      const libraryPath = String(deleteDto.libraryPath || '').trim();
      const ids = Array.isArray(deleteDto.ids) ? deleteDto.ids.map((v: unknown) => String(v || '').trim()).filter(Boolean) : [];
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!ids.length) {
        return fail(new Error('ids 不能为空'));
      }

      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const placeholders = ids.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, folder_name FROM contract_info WHERE id IN (${placeholders})`)
        .all(...ids) as Array<{ id: string; folder_name?: string | null }>;

      if (!rows.length) {
        return ok({ success: true, deleted: 0 });
      }

      const pendingBase = path.join(libraryRoot, '.trash', 'contracts');
      await ensureDir(pendingBase);

      let deleted = 0;
      for (const r of rows) {
        const cid = String(r.id || '').trim();
        if (!cid) continue;
        const folderName = ensureValidFolderName(String(r.folder_name || '').trim());
        const contractDir = path.join(libraryRoot, folderName);
        ensurePathWithin(libraryRoot, contractDir);

        const trashPath = path.join(pendingBase, folderName);
        const trashFinal = await makeUniquePath(trashPath);
        ensurePathWithin(pendingBase, trashFinal);

        const contractDirPrefix = path.resolve(contractDir) + path.sep;
        let moved = false;
        if (fs.existsSync(contractDir)) {
          await moveFolder(contractDir, trashFinal);
          moved = true;
        }

        db.exec('BEGIN');
        try {
          if (hasTable(db, 'file_content_fts')) {
            db.prepare('DELETE FROM file_content_fts WHERE file_path LIKE ?').run(`${contractDirPrefix}%`);
          }
          if (hasTable(db, 'file_metadata')) {
            db.prepare('DELETE FROM file_metadata WHERE file_path LIKE ?').run(`${contractDirPrefix}%`);
          }
          if (hasTable(db, 'contract_vector_chunks')) {
            db.prepare('DELETE FROM contract_vector_chunks WHERE contract_id = ?').run(cid);
          }
          
          db.prepare('UPDATE contract_info SET deleted_at = CURRENT_TIMESTAMP, trash_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(trashFinal, cid);
          
          // Also soft delete children
          db.prepare('UPDATE contract_files SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(cid);
          db.prepare('UPDATE contract_products SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(cid);
          db.prepare('UPDATE contract_executions SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(cid);
          db.prepare('UPDATE contract_receipt_payment SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = ? AND deleted_at IS NULL').run(cid);
          
          try {
            markContractCalendarEventsDeleted(db, cid);
            markProductCalendarEventsDeletedByContractId(db, cid);
          } catch (error) {
            logger.error('同步日历事件失败:', error);
          }
          db.exec('COMMIT');
          deleted += 1;
        } catch (error) {
          try {
            db.exec('ROLLBACK');
          } catch {
          }
          if (moved) {
            try {
              await moveFolder(trashFinal, contractDir);
            } catch (rollbackError) {
              logger.error('批量删除回滚失败:', rollbackError);
            }
          }
          throw error;
        }
      }

      return ok({ success: true, deleted });
    } catch (error) {
      logger.error('批量删除合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_RESTORE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractInfoDeleteDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const id = String(payload.id || '').trim();
      if (!libraryPath || !id) {
        return fail(new Error('参数缺失'));
      }
      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const row = db.prepare('SELECT id, folder_name, trash_path, deleted_at FROM contract_info WHERE id = ? LIMIT 1').get(id) as any;
      if (!row || !row.deleted_at) {
        return ok({ success: true });
      }

      const trashPath = String(row.trash_path || '').trim();
      let newFolderName = String(row.folder_name || '').trim();
      let moved = false;

      if (trashPath && fs.existsSync(trashPath)) {
        const targetDir = path.join(libraryRoot, newFolderName);
        const uniqueTarget = await makeUniquePath(targetDir);
        newFolderName = path.basename(uniqueTarget);
        await moveFolder(trashPath, uniqueTarget);
        moved = true;
      }

      db.exec('BEGIN');
      try {
        db.prepare('UPDATE contract_info SET deleted_at = NULL, trash_path = ?, folder_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('', newFolderName, id);
        
        // Restore children that were cascade deleted
        db.prepare('UPDATE contract_files SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL AND (trash_path IS NULL OR trash_path = "")').run(id);
        db.prepare('UPDATE contract_products SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(id);
        db.prepare('UPDATE contract_executions SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(id);
        db.prepare('UPDATE contract_receipt_payment SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(id);
        
        try {
          syncContractCalendarEventsById(db, id);
        } catch (e) {
          logger.error('恢复日历事件失败:', e);
        }
        
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        if (moved) {
          const revertTarget = path.join(libraryRoot, newFolderName);
          try {
            await moveFolder(revertTarget, trashPath);
          } catch (e) {
            logger.error('还原回滚失败:', e);
          }
        }
        throw error;
      }
      return ok({ success: true });
    } catch (error) {
      logger.error('还原合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_RESTORE_CONTRACT_INFOS]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractInfoBatchDeleteDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const ids = Array.isArray(payload.ids) ? payload.ids.map(v => String(v || '').trim()).filter(Boolean) : [];
      if (!libraryPath || !ids.length) return fail(new Error('参数缺失'));

      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const placeholders = ids.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, folder_name, trash_path, deleted_at FROM contract_info WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`).all(...ids) as any[];

      let restored = 0;
      for (const row of rows) {
        const cid = row.id;
        const trashPath = String(row.trash_path || '').trim();
        let newFolderName = String(row.folder_name || '').trim();
        let moved = false;

        if (trashPath && fs.existsSync(trashPath)) {
          const targetDir = path.join(libraryRoot, newFolderName);
          const uniqueTarget = await makeUniquePath(targetDir);
          newFolderName = path.basename(uniqueTarget);
          await moveFolder(trashPath, uniqueTarget);
          moved = true;
        }

        db.exec('BEGIN');
        try {
          db.prepare('UPDATE contract_info SET deleted_at = NULL, trash_path = ?, folder_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('', newFolderName, cid);
          
          db.prepare('UPDATE contract_files SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL AND (trash_path IS NULL OR trash_path = "")').run(cid);
          db.prepare('UPDATE contract_products SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(cid);
          db.prepare('UPDATE contract_executions SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(cid);
          db.prepare('UPDATE contract_receipt_payment SET deleted_at = NULL WHERE contract_id = ? AND deleted_at IS NOT NULL').run(cid);
          
          try {
            syncContractCalendarEventsById(db, cid);
          } catch (e) {}
          
          db.exec('COMMIT');
          restored++;
        } catch (error) {
          try { db.exec('ROLLBACK'); } catch {}
          if (moved) {
            const revertTarget = path.join(libraryRoot, newFolderName);
            try { await moveFolder(revertTarget, trashPath); } catch {}
          }
          throw error;
        }
      }
      return ok({ success: true, restored });
    } catch (error) {
      logger.error('批量还原合同信息失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_PURGE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractInfoDeleteDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const id = String(payload.id || '').trim();
      if (!libraryPath || !id) return fail(new Error('参数缺失'));
      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const row = db.prepare('SELECT id, folder_name, trash_path FROM contract_info WHERE id = ? AND deleted_at IS NOT NULL LIMIT 1').get(id) as any;
      if (!row) return ok({ success: true });

      const trashPath = String(row.trash_path || '').trim();
      if (trashPath && fs.existsSync(trashPath)) {
        await fs.promises.rm(trashPath, { recursive: true, force: true }).catch(() => {});
      }

      db.exec('BEGIN');
      try {
        if (hasTable(db, 'contract_ai_log')) {
          db.prepare('DELETE FROM contract_ai_log WHERE file_id IN (SELECT file_id FROM contract_files WHERE contract_id = ?)').run(id);
        }
        if (hasTable(db, 'contract_vector_chunks')) {
          db.prepare('DELETE FROM contract_vector_chunks WHERE contract_id = ?').run(id);
        }
        db.prepare('DELETE FROM contract_files WHERE contract_id = ?').run(id);
        db.prepare('DELETE FROM contract_products WHERE contract_id = ?').run(id);
        db.prepare('DELETE FROM contract_executions WHERE contract_id = ?').run(id);
        db.prepare('DELETE FROM contract_receipt_payment WHERE contract_id = ?').run(id);
        db.prepare('DELETE FROM contract_info WHERE id = ?').run(id);
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return ok({ success: true });
    } catch (error) {
      logger.error('彻底删除合同失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_PURGE_CONTRACT_INFOS]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const payload = (dto || {}) as Partial<ContractInfoBatchDeleteDTO>;
      const libraryPath = String(payload.libraryPath || '').trim();
      const ids = Array.isArray(payload.ids) ? payload.ids.map(v => String(v || '').trim()).filter(Boolean) : [];
      if (!libraryPath || !ids.length) return fail(new Error('参数缺失'));
      const libraryRoot = path.resolve(libraryPath);
      db = openLibraryDb(libraryPath);

      const placeholders = ids.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, folder_name, trash_path FROM contract_info WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`).all(...ids) as any[];

      let purged = 0;
      for (const row of rows) {
        const cid = row.id;
        const trashPath = String(row.trash_path || '').trim();
        if (trashPath && fs.existsSync(trashPath)) {
          await fs.promises.rm(trashPath, { recursive: true, force: true }).catch(() => {});
        }

        db.exec('BEGIN');
        try {
          if (hasTable(db, 'contract_ai_log')) {
            db.prepare('DELETE FROM contract_ai_log WHERE file_id IN (SELECT file_id FROM contract_files WHERE contract_id = ?)').run(cid);
          }
          if (hasTable(db, 'contract_vector_chunks')) {
            db.prepare('DELETE FROM contract_vector_chunks WHERE contract_id = ?').run(cid);
          }
          db.prepare('DELETE FROM contract_files WHERE contract_id = ?').run(cid);
          db.prepare('DELETE FROM contract_products WHERE contract_id = ?').run(cid);
          db.prepare('DELETE FROM contract_executions WHERE contract_id = ?').run(cid);
          db.prepare('DELETE FROM contract_receipt_payment WHERE contract_id = ?').run(cid);
          db.prepare('DELETE FROM contract_info WHERE id = ?').run(cid);
          db.exec('COMMIT');
          purged++;
        } catch (error) {
          try { db.exec('ROLLBACK'); } catch {}
          throw error;
        }
      }
      return ok({ success: true, purged });
    } catch (error) {
      logger.error('批量彻底删除合同失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },

  [channels.LIBRARY_MOVE_CONTRACT_INFO]: async (_event, dto: unknown) => {
    let db: Database.Database | null = null;
    try {
      const moveDto = (dto || {}) as Partial<ContractInfoMoveDTO>;
      const libraryPath = String(moveDto.libraryPath || '').trim();
      const id = String(moveDto.id || '').trim();
      const direction = String(moveDto.direction || '').trim() as ContractInfoMoveDTO['direction'];
      if (!libraryPath) {
        return fail(new Error('资源库路径不能为空'));
      }
      if (!id) {
        return fail(new Error('合同ID不能为空'));
      }
      if (!['top', 'up', 'down', 'bottom'].includes(direction)) {
        return fail(new Error('direction 参数不合法'));
      }

      db = openLibraryDb(libraryPath);

      const ids = db.prepare(`
        SELECT id
        FROM contract_info
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, datetime(NULLIF(signing_date, '')) DESC, datetime(updated_at) DESC, datetime(created_at) DESC
      `).all() as Array<{ id: string }>;

      const currentIndex = ids.findIndex((item) => item.id === id);
      if (currentIndex === -1) {
        return fail(new Error('未找到待排序合同'));
      }

      let nextIndex = currentIndex;
      if (direction === 'top') nextIndex = 0;
      if (direction === 'up') nextIndex = Math.max(0, currentIndex - 1);
      if (direction === 'down') nextIndex = Math.min(ids.length - 1, currentIndex + 1);
      if (direction === 'bottom') nextIndex = ids.length - 1;

      if (nextIndex === currentIndex) {
        return ok({ success: true });
      }

      const [target] = ids.splice(currentIndex, 1);
      ids.splice(nextIndex, 0, target);

      const tx = db.transaction((ordered: Array<{ id: string }>) => {
        const stmt = db!.prepare('UPDATE contract_info SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        ordered.forEach((item, index) => {
          stmt.run(index + 1, item.id);
        });
      });

      tx(ids);
      return ok({ success: true });
    } catch (error) {
      logger.error('移动合同排序失败:', error);
      return fail(error);
    } finally {
      db?.close();
    }
  },
};
