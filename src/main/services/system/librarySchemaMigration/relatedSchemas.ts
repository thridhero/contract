import Database from 'better-sqlite3';
import { ensureColumns, rebuildTable } from './shared';

const SUPPLIER_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    contact TEXT,
    group_name TEXT,
    bank_account TEXT,
    bank_name TEXT,
    phone TEXT,
    address TEXT,
    tax_number TEXT,
    invoice_type TEXT,
    reg_date TEXT,
    legal_rep_name TEXT,
    legal_rep_id_number TEXT,
    legal_rep_mobile TEXT,
    legal_rep_email TEXT,
    contacts TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const SUPPLIER_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_suppliers_updated_at
  AFTER UPDATE ON suppliers
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE suppliers
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const SUPPLIER_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'code', ddl: "TEXT DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contact', ddl: "TEXT DEFAULT ''" },
  { name: 'group_name', ddl: "TEXT DEFAULT ''" },
  { name: 'bank_account', ddl: "TEXT DEFAULT ''" },
  { name: 'bank_name', ddl: "TEXT DEFAULT ''" },
  { name: 'phone', ddl: "TEXT DEFAULT ''" },
  { name: 'address', ddl: "TEXT DEFAULT ''" },
  { name: 'tax_number', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_type', ddl: "TEXT DEFAULT ''" },
  { name: 'reg_date', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_name', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_id_number', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_mobile', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_email', ddl: "TEXT DEFAULT ''" },
  { name: 'contacts', ddl: "TEXT DEFAULT '[]'" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateSupplierSchema(db: Database.Database): void {
  db.exec(SUPPLIER_SCHEMA_SQL);
  ensureColumns(db, 'suppliers', SUPPLIER_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_id ON suppliers(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at)');
  db.exec(SUPPLIER_UPDATED_AT_TRIGGER_SQL);
}

const CUSTOMER_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    group_name TEXT,
    code TEXT,
    name TEXT NOT NULL,
    contact TEXT,
    department TEXT,
    mobile TEXT,
    wechat TEXT,
    phone TEXT,
    fax TEXT,
    email TEXT,
    address TEXT,
    msn TEXT,
    company_type TEXT,
    industry TEXT,
    products TEXT,
    website TEXT,
    capital TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    reg_date TEXT,
    legal_rep_name TEXT,
    legal_rep_id_number TEXT,
    legal_rep_mobile TEXT,
    legal_rep_email TEXT,
    tax_number TEXT,
    bank_name TEXT,
    bank_account TEXT,
    invoice_type TEXT,
    custom1 TEXT,
    custom2 TEXT,
    custom3 TEXT,
    custom4 TEXT,
    contacts TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CUSTOMER_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_customers_updated_at
  AFTER UPDATE ON customers
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE customers
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CUSTOMER_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'group_name', ddl: "TEXT DEFAULT ''" },
  { name: 'code', ddl: "TEXT DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contact', ddl: "TEXT DEFAULT ''" },
  { name: 'department', ddl: "TEXT DEFAULT ''" },
  { name: 'mobile', ddl: "TEXT DEFAULT ''" },
  { name: 'wechat', ddl: "TEXT DEFAULT ''" },
  { name: 'phone', ddl: "TEXT DEFAULT ''" },
  { name: 'fax', ddl: "TEXT DEFAULT ''" },
  { name: 'email', ddl: "TEXT DEFAULT ''" },
  { name: 'address', ddl: "TEXT DEFAULT ''" },
  { name: 'msn', ddl: "TEXT DEFAULT ''" },
  { name: 'company_type', ddl: "TEXT DEFAULT ''" },
  { name: 'industry', ddl: "TEXT DEFAULT ''" },
  { name: 'products', ddl: "TEXT DEFAULT ''" },
  { name: 'website', ddl: "TEXT DEFAULT ''" },
  { name: 'capital', ddl: "TEXT DEFAULT ''" },
  { name: 'country', ddl: "TEXT DEFAULT ''" },
  { name: 'province', ddl: "TEXT DEFAULT ''" },
  { name: 'city', ddl: "TEXT DEFAULT ''" },
  { name: 'reg_date', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_name', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_id_number', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_mobile', ddl: "TEXT DEFAULT ''" },
  { name: 'legal_rep_email', ddl: "TEXT DEFAULT ''" },
  { name: 'tax_number', ddl: "TEXT DEFAULT ''" },
  { name: 'bank_name', ddl: "TEXT DEFAULT ''" },
  { name: 'bank_account', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_type', ddl: "TEXT DEFAULT ''" },
  { name: 'custom1', ddl: "TEXT DEFAULT ''" },
  { name: 'custom2', ddl: "TEXT DEFAULT ''" },
  { name: 'custom3', ddl: "TEXT DEFAULT ''" },
  { name: 'custom4', ddl: "TEXT DEFAULT ''" },
  { name: 'contacts', ddl: "TEXT DEFAULT '[]'" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateCustomerSchema(db: Database.Database): void {
  db.exec(CUSTOMER_SCHEMA_SQL);
  ensureColumns(db, 'customers', CUSTOMER_COLUMNS);
  const tableInfo = db.prepare('PRAGMA table_info(customers)').all() as Array<{ name: string }>;
  const hasInitialBalance = tableInfo.some(col => col.name === 'initial_balance');
  if (hasInitialBalance) {
    const columns = [
      'id',
      'group_name',
      'code',
      'name',
      'contact',
      'department',
      'mobile',
      'wechat',
      'phone',
      'fax',
      'email',
      'address',
      'msn',
      'company_type',
      'industry',
      'products',
      'website',
      'capital',
      'country',
      'province',
      'city',
      'reg_date',
      'legal_rep_name',
      'legal_rep_id_number',
      'legal_rep_mobile',
      'legal_rep_email',
      'tax_number',
      'bank_name',
      'bank_account',
      'invoice_type',
      'custom1',
      'custom2',
      'custom3',
      'custom4',
      'contacts',
      'deleted_at',
      'created_at',
      'updated_at',
    ];
    rebuildTable(db, {
      tableName: 'customers',
      reason: 'drop-legacy-column:initial_balance',
      droppedColumns: ['initial_balance'],
      copyColumns: columns,
      createReplacementTableSql: (tempTableName) => `
        CREATE TABLE ${tempTableName} (
          id TEXT PRIMARY KEY,
          group_name TEXT,
          code TEXT,
          name TEXT NOT NULL,
          contact TEXT,
          department TEXT,
          mobile TEXT,
          wechat TEXT,
          phone TEXT,
          fax TEXT,
          email TEXT,
          address TEXT,
          msn TEXT,
          company_type TEXT,
          industry TEXT,
          products TEXT,
          website TEXT,
          capital TEXT,
          country TEXT,
          province TEXT,
          city TEXT,
          reg_date TEXT,
          legal_rep_name TEXT,
          legal_rep_id_number TEXT,
          legal_rep_mobile TEXT,
          legal_rep_email TEXT,
          tax_number TEXT,
          bank_name TEXT,
          bank_account TEXT,
          invoice_type TEXT,
          custom1 TEXT,
          custom2 TEXT,
          custom3 TEXT,
          custom4 TEXT,
          contacts TEXT,
          deleted_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    });
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_id ON customers(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at)');
  db.exec(CUSTOMER_UPDATED_AT_TRIGGER_SQL);
}

const DEPARTMENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    leader TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    sort_order INTEGER DEFAULT 0,
    remark TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const DEPARTMENT_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_departments_updated_at
  AFTER UPDATE ON departments
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE departments
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const DEPARTMENT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'parent_id', ddl: "TEXT DEFAULT ''" },
  { name: 'code', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'leader', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'phone', ddl: "TEXT DEFAULT ''" },
  { name: 'email', ddl: "TEXT DEFAULT ''" },
  { name: 'sort_order', ddl: 'INTEGER DEFAULT 0' },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateDepartmentSchema(db: Database.Database): void {
  db.exec(DEPARTMENT_SCHEMA_SQL);
  ensureColumns(db, 'departments', DEPARTMENT_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_id ON departments(id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code ON departments(code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_departments_deleted_at ON departments(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON departments(sort_order)');
  db.exec(DEPARTMENT_UPDATED_AT_TRIGGER_SQL);
}

const PERSONNEL_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS personnel (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    entry_date TEXT,
    status TEXT NOT NULL DEFAULT '在职',
    salary_base REAL,
    salary_monthly REAL,
    salary_currency TEXT,
    salary_bank_name TEXT,
    salary_bank_account TEXT,
    archive_no TEXT,
    gender TEXT,
    birth_date TEXT,
    id_card_number TEXT,
    photo_file_path TEXT,
    address TEXT,
    education TEXT,
    graduate_school TEXT,
    major TEXT,
    emergency_contact TEXT,
    emergency_contact_phone TEXT,
    resume_file_path TEXT,
    resume_text TEXT,
    work_experience TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const PERSONNEL_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_personnel_updated_at
  AFTER UPDATE ON personnel
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE personnel
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const PERSONNEL_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'code', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'position', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'phone', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'email', ddl: "TEXT DEFAULT ''" },
  { name: 'entry_date', ddl: "TEXT DEFAULT ''" },
  { name: 'status', ddl: "TEXT NOT NULL DEFAULT '在职'" },
  { name: 'salary_base', ddl: 'REAL' },
  { name: 'salary_monthly', ddl: 'REAL' },
  { name: 'salary_currency', ddl: "TEXT DEFAULT 'CNY'" },
  { name: 'salary_bank_name', ddl: "TEXT DEFAULT ''" },
  { name: 'salary_bank_account', ddl: "TEXT DEFAULT ''" },
  { name: 'archive_no', ddl: "TEXT DEFAULT ''" },
  { name: 'gender', ddl: "TEXT DEFAULT ''" },
  { name: 'birth_date', ddl: "TEXT DEFAULT ''" },
  { name: 'id_card_number', ddl: "TEXT DEFAULT ''" },
  { name: 'photo_file_path', ddl: "TEXT DEFAULT ''" },
  { name: 'address', ddl: "TEXT DEFAULT ''" },
  { name: 'education', ddl: "TEXT DEFAULT ''" },
  { name: 'graduate_school', ddl: "TEXT DEFAULT ''" },
  { name: 'major', ddl: "TEXT DEFAULT ''" },
  { name: 'emergency_contact', ddl: "TEXT DEFAULT ''" },
  { name: 'emergency_contact_phone', ddl: "TEXT DEFAULT ''" },
  { name: 'resume_file_path', ddl: "TEXT DEFAULT ''" },
  { name: 'resume_text', ddl: "TEXT DEFAULT ''" },
  { name: 'work_experience', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'sort_order', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const PERSONNEL_DEPARTMENTS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS personnel_departments (
    personnel_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (personnel_id, department_id)
  )
`;

const PERSONNEL_DOCUMENTS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS personnel_documents (
    id TEXT PRIMARY KEY,
    personnel_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    doc_name TEXT NOT NULL,
    doc_number TEXT,
    issuer TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    file_paths_json TEXT NOT NULL DEFAULT '[]',
    preview_image_path TEXT DEFAULT '',
    ai_extract_json TEXT,
    ai_fill_status TEXT NOT NULL DEFAULT 'pending',
    is_primary INTEGER NOT NULL DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const PERSONNEL_DOCUMENTS_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_personnel_documents_updated_at
  AFTER UPDATE ON personnel_documents
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE personnel_documents
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const PERSONNEL_DOCUMENTS_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'personnel_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'doc_type', ddl: "TEXT NOT NULL DEFAULT 'other'" },
  { name: 'doc_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'doc_number', ddl: "TEXT DEFAULT ''" },
  { name: 'issuer', ddl: "TEXT DEFAULT ''" },
  { name: 'issue_date', ddl: "TEXT DEFAULT ''" },
  { name: 'expiry_date', ddl: "TEXT DEFAULT ''" },
  { name: 'file_paths_json', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'preview_image_path', ddl: "TEXT DEFAULT ''" },
  { name: 'ai_extract_json', ddl: "TEXT DEFAULT ''" },
  { name: 'ai_fill_status', ddl: "TEXT NOT NULL DEFAULT 'pending'" },
  { name: 'is_primary', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

const UNIT_DOCUMENTS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS unit_documents (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    doc_name TEXT NOT NULL,
    doc_number TEXT,
    issuer TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    file_paths_json TEXT NOT NULL DEFAULT '[]',
    preview_image_path TEXT DEFAULT '',
    ai_extract_json TEXT,
    ai_fill_status TEXT NOT NULL DEFAULT 'pending',
    is_primary INTEGER NOT NULL DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const UNIT_DOCUMENTS_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_unit_documents_updated_at
  AFTER UPDATE ON unit_documents
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE unit_documents
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const UNIT_DOCUMENTS_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'owner_type', ddl: "TEXT NOT NULL DEFAULT 'customer'" },
  { name: 'owner_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'doc_type', ddl: "TEXT NOT NULL DEFAULT 'other'" },
  { name: 'doc_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'doc_number', ddl: "TEXT DEFAULT ''" },
  { name: 'issuer', ddl: "TEXT DEFAULT ''" },
  { name: 'issue_date', ddl: "TEXT DEFAULT ''" },
  { name: 'expiry_date', ddl: "TEXT DEFAULT ''" },
  { name: 'file_paths_json', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'preview_image_path', ddl: "TEXT DEFAULT ''" },
  { name: 'ai_extract_json', ddl: "TEXT DEFAULT ''" },
  { name: 'ai_fill_status', ddl: "TEXT NOT NULL DEFAULT 'pending'" },
  { name: 'is_primary', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migratePersonnelSchema(db: Database.Database): void {
  db.exec(PERSONNEL_SCHEMA_SQL);
  ensureColumns(db, 'personnel', PERSONNEL_COLUMNS);
  db.exec(PERSONNEL_DEPARTMENTS_SCHEMA_SQL);
  db.exec(PERSONNEL_DOCUMENTS_SCHEMA_SQL);
  ensureColumns(db, 'personnel_documents', PERSONNEL_DOCUMENTS_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_id ON personnel(id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_code ON personnel(code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_deleted_at ON personnel(deleted_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_sort_order ON personnel(sort_order)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_departments_personnel ON personnel_departments(personnel_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_departments_department ON personnel_departments(department_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_documents_id ON personnel_documents(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_documents_personnel ON personnel_documents(personnel_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_documents_type ON personnel_documents(doc_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_documents_fill_status ON personnel_documents(ai_fill_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_personnel_documents_deleted_at ON personnel_documents(deleted_at)');
  db.exec(PERSONNEL_UPDATED_AT_TRIGGER_SQL);
  db.exec(PERSONNEL_DOCUMENTS_UPDATED_AT_TRIGGER_SQL);
}

export function migrateUnitDocumentSchema(db: Database.Database): void {
  db.exec(UNIT_DOCUMENTS_SCHEMA_SQL);
  ensureColumns(db, 'unit_documents', UNIT_DOCUMENTS_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_documents_id ON unit_documents(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_unit_documents_owner ON unit_documents(owner_type, owner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_unit_documents_type ON unit_documents(doc_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_unit_documents_fill_status ON unit_documents(ai_fill_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_unit_documents_deleted_at ON unit_documents(deleted_at)');
  db.exec(UNIT_DOCUMENTS_UPDATED_AT_TRIGGER_SQL);
}

const CONTRACT_PRODUCT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_products (
    id TEXT PRIMARY KEY,
    contract_id TEXT,
    contract_code TEXT,
    contract_name TEXT,
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    specification TEXT,
    unit TEXT,
    unit_price REAL,
    quantity REAL,
    cost_price REAL,
    total_price REAL,
    purchase_date TEXT,
    warranty_date TEXT,
    origin TEXT,
    customer_name TEXT,
    supplier_name TEXT,
    remark TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_PRODUCT_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_products_updated_at
  AFTER UPDATE ON contract_products
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_products
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_PRODUCT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'contract_id', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_code', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_name', ddl: "TEXT DEFAULT ''" },
  { name: 'code', ddl: "TEXT DEFAULT ''" },
  { name: 'name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'category', ddl: "TEXT DEFAULT ''" },
  { name: 'specification', ddl: "TEXT DEFAULT ''" },
  { name: 'unit', ddl: "TEXT DEFAULT ''" },
  { name: 'unit_price', ddl: 'REAL' },
  { name: 'quantity', ddl: 'REAL' },
  { name: 'cost_price', ddl: 'REAL' },
  { name: 'total_price', ddl: 'REAL' },
  { name: 'purchase_date', ddl: "TEXT DEFAULT ''" },
  { name: 'warranty_date', ddl: "TEXT DEFAULT ''" },
  { name: 'origin', ddl: "TEXT DEFAULT ''" },
  { name: 'customer_name', ddl: "TEXT DEFAULT ''" },
  { name: 'supplier_name', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateContractProductSchema(db: Database.Database): void {
  db.exec(CONTRACT_PRODUCT_SCHEMA_SQL);
  ensureColumns(db, 'contract_products', CONTRACT_PRODUCT_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_products_id ON contract_products(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_products_deleted_at ON contract_products(deleted_at)');
  db.exec(CONTRACT_PRODUCT_UPDATED_AT_TRIGGER_SQL);
}

const CONTRACT_EXECUTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_executions (
    id TEXT PRIMARY KEY,
    contract_id TEXT,
    contract_code TEXT,
    contract_name TEXT,
    execution_time TEXT,
    execution_status TEXT,
    salesperson TEXT,
    content TEXT,
    register_date TEXT,
    progress TEXT,
    remark TEXT,
    custom2 TEXT,
    custom3 TEXT,
    custom4 TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_EXECUTION_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_executions_updated_at
  AFTER UPDATE ON contract_executions
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_executions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_EXECUTION_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'contract_id', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_code', ddl: "TEXT DEFAULT ''" },
  { name: 'contract_name', ddl: "TEXT DEFAULT ''" },
  { name: 'execution_time', ddl: "TEXT DEFAULT ''" },
  { name: 'execution_status', ddl: "TEXT DEFAULT ''" },
  { name: 'salesperson', ddl: "TEXT DEFAULT ''" },
  { name: 'content', ddl: "TEXT DEFAULT ''" },
  { name: 'register_date', ddl: "TEXT DEFAULT ''" },
  { name: 'progress', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'custom2', ddl: "TEXT DEFAULT ''" },
  { name: 'custom3', ddl: "TEXT DEFAULT ''" },
  { name: 'custom4', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateContractExecutionSchema(db: Database.Database): void {
  db.exec(CONTRACT_EXECUTION_SCHEMA_SQL);
  ensureColumns(db, 'contract_executions', CONTRACT_EXECUTION_COLUMNS);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_executions_id ON contract_executions(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_executions_deleted_at ON contract_executions(deleted_at)');
  db.exec(CONTRACT_EXECUTION_UPDATED_AT_TRIGGER_SQL);
}

const CONTRACT_RECEIPT_PAYMENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_receipt_payment (
    id TEXT PRIMARY KEY,
    serial_no TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    contract_code TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    direction TEXT NOT NULL,
    plan_id TEXT,
    plan_name TEXT NOT NULL,
    ratio REAL,
    expected_amount REAL,
    expected_date DATE,
    received_amount REAL,
    current_amount REAL NOT NULL,
    actual_date DATE NOT NULL,
    invoice_amount REAL,
    invoice_no TEXT,
    invoice_date DATE,
    handler TEXT,
    remark TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_RECEIPT_PAYMENT_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_receipt_payment_updated_at
  AFTER UPDATE ON contract_receipt_payment
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_receipt_payment
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_RECEIPT_PAYMENT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'serial_no', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_code', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'direction', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'plan_id', ddl: "TEXT DEFAULT ''" },
  { name: 'plan_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'ratio', ddl: 'REAL' },
  { name: 'expected_amount', ddl: 'REAL' },
  { name: 'expected_date', ddl: 'DATE' },
  { name: 'received_amount', ddl: 'REAL' },
  { name: 'current_amount', ddl: 'REAL NOT NULL DEFAULT 0' },
  { name: 'actual_date', ddl: 'DATE' },
  { name: 'invoice_amount', ddl: 'REAL' },
  { name: 'invoice_no', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_date', ddl: 'DATE' },
  { name: 'handler', ddl: "TEXT DEFAULT ''" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateContractReceiptPaymentSchema(db: Database.Database): void {
  db.exec(CONTRACT_RECEIPT_PAYMENT_SCHEMA_SQL);
  ensureColumns(db, 'contract_receipt_payment', CONTRACT_RECEIPT_PAYMENT_COLUMNS);
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_receipt_payment_deleted_at ON contract_receipt_payment(deleted_at)');
  db.exec(CONTRACT_RECEIPT_PAYMENT_UPDATED_AT_TRIGGER_SQL);
}

const CONTRACT_INVOICES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contract_invoices (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    contract_code TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    file_id TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    source_path TEXT,
    invoice_type TEXT,
    invoice_code TEXT,
    invoice_no TEXT,
    invoice_date DATE,
    issue_date DATE,
    seller_name TEXT,
    seller_tax_no TEXT,
    buyer_name TEXT,
    buyer_tax_no TEXT,
    amount_without_tax REAL,
    tax_amount REAL,
    amount_with_tax REAL,
    total_amount REAL,
    invoice_items_json TEXT,
    remark TEXT,
    issuer_name TEXT,
    currency TEXT,
    parse_status TEXT,
    parse_confidence REAL,
    parse_error TEXT,
    parse_errors TEXT,
    parse_engine TEXT,
    parse_result_json TEXT,
    raw_text_excerpt TEXT,
    parse_started_at DATETIME,
    parse_finished_at DATETIME,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CONTRACT_INVOICES_UPDATED_AT_TRIGGER_SQL = `
  CREATE TRIGGER IF NOT EXISTS trg_contract_invoices_updated_at
  AFTER UPDATE ON contract_invoices
  FOR EACH ROW
  WHEN NEW.updated_at <= OLD.updated_at
  BEGIN
    UPDATE contract_invoices
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
  END
`;

const CONTRACT_INVOICES_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'id', ddl: 'TEXT' },
  { name: 'contract_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_code', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'contract_name', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'file_id', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'source_sha256', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'source_path', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'invoice_type', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_code', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_no', ddl: "TEXT DEFAULT ''" },
  { name: 'invoice_date', ddl: 'DATE' },
  { name: 'issue_date', ddl: 'DATE' },
  { name: 'seller_name', ddl: "TEXT DEFAULT ''" },
  { name: 'seller_tax_no', ddl: "TEXT DEFAULT ''" },
  { name: 'buyer_name', ddl: "TEXT DEFAULT ''" },
  { name: 'buyer_tax_no', ddl: "TEXT DEFAULT ''" },
  { name: 'amount_without_tax', ddl: 'REAL' },
  { name: 'tax_amount', ddl: 'REAL' },
  { name: 'amount_with_tax', ddl: 'REAL' },
  { name: 'total_amount', ddl: 'REAL' },
  { name: 'invoice_items_json', ddl: "TEXT DEFAULT '[]'" },
  { name: 'remark', ddl: "TEXT DEFAULT ''" },
  { name: 'issuer_name', ddl: "TEXT DEFAULT ''" },
  { name: 'currency', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'parse_status', ddl: "TEXT DEFAULT ''" },
  { name: 'parse_confidence', ddl: 'REAL' },
  { name: 'parse_error', ddl: "TEXT DEFAULT ''" },
  { name: 'parse_errors', ddl: "TEXT NOT NULL DEFAULT '[]'" },
  { name: 'parse_engine', ddl: "TEXT DEFAULT ''" },
  { name: 'parse_result_json', ddl: "TEXT DEFAULT '{}'" },
  { name: 'raw_text_excerpt', ddl: "TEXT NOT NULL DEFAULT ''" },
  { name: 'parse_started_at', ddl: 'DATETIME' },
  { name: 'parse_finished_at', ddl: 'DATETIME' },
  { name: 'deleted_at', ddl: 'DATETIME' },
  { name: 'created_at', ddl: 'DATETIME' },
  { name: 'updated_at', ddl: 'DATETIME' },
];

export function migrateContractInvoicesSchema(db: Database.Database): void {
  db.exec(CONTRACT_INVOICES_SCHEMA_SQL);
  ensureColumns(db, 'contract_invoices', CONTRACT_INVOICES_COLUMNS);
  db.exec(`
    UPDATE contract_invoices
    SET source_path = COALESCE(
      NULLIF(source_path, ''),
      (SELECT path FROM contract_files WHERE file_id = contract_invoices.file_id LIMIT 1)
    )
    WHERE source_path IS NULL OR source_path = ''
  `);
  db.exec(`
    UPDATE contract_invoices
    SET issue_date = invoice_date
    WHERE (issue_date IS NULL OR issue_date = '')
      AND invoice_date IS NOT NULL
      AND invoice_date <> ''
  `);
  db.exec(`
    UPDATE contract_invoices
    SET total_amount = amount_with_tax
    WHERE total_amount IS NULL
      AND amount_with_tax IS NOT NULL
  `);
  db.exec(`
    UPDATE contract_invoices
    SET currency = COALESCE(
      NULLIF(currency, ''),
      (SELECT currency FROM contract_info WHERE id = contract_invoices.contract_id LIMIT 1),
      ''
    )
    WHERE currency IS NULL OR currency = ''
  `);
  db.exec(`
    UPDATE contract_invoices
    SET parse_errors = parse_error
    WHERE (parse_errors IS NULL OR parse_errors = '' OR parse_errors = '[]')
      AND parse_error IS NOT NULL
      AND parse_error <> ''
  `);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_invoices_id ON contract_invoices(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract_id ON contract_invoices(contract_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract_code ON contract_invoices(contract_code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_file_id ON contract_invoices(file_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_source_sha256 ON contract_invoices(source_sha256)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_source_path ON contract_invoices(source_path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_invoice_type ON contract_invoices(invoice_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_invoice_no ON contract_invoices(invoice_no)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_invoice_date ON contract_invoices(invoice_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_issue_date ON contract_invoices(issue_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_total_amount ON contract_invoices(total_amount)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_currency ON contract_invoices(currency)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_parse_status ON contract_invoices(parse_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_parse_confidence ON contract_invoices(parse_confidence)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_contract_invoices_deleted_at ON contract_invoices(deleted_at)');
  db.exec(CONTRACT_INVOICES_UPDATED_AT_TRIGGER_SQL);
}
