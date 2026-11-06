import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let db: Database | null = null;
let currentDbPath: string | null = null;
const DEFAULT_DB_FILE_NAME = 'settings.db';

/**
 * 获取默认数据库文件路径（未初始化时使用）
 */
function getDefaultDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, DEFAULT_DB_FILE_NAME);
}

/**
 * 初始化数据库（支持自定义路径）
 */
export async function initDatabase(customDbPath?: string): Promise<Database> {
  const SQL = await initSqlJs();
  const dbPath = customDbPath || getDefaultDatabasePath();
  currentDbPath = dbPath;

  // 如果数据库文件存在，则加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    // 创建新数据库
    db = new SQL.Database();
    // 创建配置表
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 保存数据库到文件
    saveDatabase();
  }

  return db;
}

/**
 * 根据自定义路径初始化数据库（用于首次启动）
 */
export async function initDatabaseWithPath(dbPath: string): Promise<Database> {
  return initDatabase(dbPath);
}

/**
 * 获取当前数据库文件路径
 */
export function getDatabasePath(): string {
  return currentDbPath || getDefaultDatabasePath();
}

/**
 * 保存数据库到文件
 */
export function saveDatabase(): void {
  if (!db) return;
  
  const dbPath = getDatabasePath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * 获取当前数据库路径
 */
export function getCurrentDbPath(): string | null {
  return currentDbPath;
}

/**
 * 创建项目数据库（用于首次启动）
 * @param projectPath 项目根目录路径
 * @param projectName 项目名称
 */
export async function createProjectDatabase(
  projectPath: string,
  projectName: string
): Promise<{ success: boolean; error?: string; dbPath?: string }> {
  try {
    // 创建项目目录
    const fullProjectPath = path.join(projectPath, projectName);
    
    if (!fs.existsSync(fullProjectPath)) {
      fs.mkdirSync(fullProjectPath, { recursive: true });
    }
    
    // 数据库文件路径
    const dbPath = path.join(fullProjectPath, 'settings.db');
    
    // 如果数据库已存在，返回错误
    if (fs.existsSync(dbPath)) {
      return {
        success: false,
        error: '该位置已存在数据库，请选择其他路径或名称'
      };
    }
    
    // 初始化数据库
    await initDatabase(dbPath);
    
    // 插入项目路径记录
    const insertResult = insertSetting('project_path', fullProjectPath, '项目根目录路径');
    console.log('[Database] 插入 project_path 结果:', insertResult);
    
    // 通过 SQL 查询验证路径是否已保存
    const queryResult = getSetting('project_path');
    console.log('[Database] 通过 SQL 查询 project_path 结果:', queryResult);
    console.log('[Database] 用户选择的保存路径:', projectPath);
    console.log('[Database] 完整项目路径:', fullProjectPath);
    console.log('[Database] 数据库文件路径:', dbPath);
    
    return {
      success: true,
      dbPath: dbPath,
      error: undefined
    };
  } catch (error) {
    console.error('Error creating project database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建数据库失败'
    };
  }
}

/**
 * 插入配置
 */
export function insertSetting(key: string, value: string, description: string): boolean {
  if (!db) return false;
  
  try {
    db.run(
      'INSERT INTO settings (key, value, description) VALUES (?, ?, ?)',
      [key, value, description]
    );
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Error inserting setting:', error);
    return false;
  }
}

/**
 * 更新配置
 */
export function updateSetting(key: string, value: string, description: string): boolean {
  if (!db) return false;
  
  try {
    db.run(
      'UPDATE settings SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, description, key]
    );
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Error updating setting:', error);
    return false;
  }
}

/**
 * 删除配置
 */
export function deleteSetting(key: string): boolean {
  if (!db) return false;
  
  try {
    db.run('DELETE FROM settings WHERE key = ?', [key]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Error deleting setting:', error);
    return false;
  }
}

/**
 * 查询单个配置
 */
export function getSetting(key: string): { key: string; value: string; description: string; created_at: string; updated_at: string } | null {
  if (!db) return null;
  
  try {
    const stmt = db.prepare('SELECT * FROM settings WHERE key = ?');
    stmt.bind([key]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        key: row.key as string,
        value: row.value as string,
        description: row.description as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string
      };
    }
    stmt.free();
    return null;
  } catch (error) {
    console.error('Error getting setting:', error);
    return null;
  }
}

/**
 * 查询所有配置
 */
export function getAllSettings(): Array<{ id: number; key: string; value: string; description: string; created_at: string; updated_at: string }> {
  if (!db) return [];
  
  try {
    const result = db.exec('SELECT * FROM settings ORDER BY key');
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map((row: any[]) => {
      const setting: any = {};
      columns.forEach((col: string, index: number) => {
        setting[col] = row[index];
      });
      return setting as { id: number; key: string; value: string; description: string; created_at: string; updated_at: string };
    });
  } catch (error) {
    console.error('Error getting all settings:', error);
    return [];
  }
}

/**
 * 搜索配置（按 key 或 description）
 */
export function searchSettings(searchTerm: string): Array<{ id: number; key: string; value: string; description: string; created_at: string; updated_at: string }> {
  if (!db) return [];
  
  try {
    const pattern = `%${searchTerm}%`;
    const result = db.exec(
      'SELECT * FROM settings WHERE key LIKE ? OR description LIKE ? ORDER BY key'
    );
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map((row: any[]) => {
      const setting: any = {};
      columns.forEach((col: string, index: number) => {
        setting[col] = row[index];
      });
      return setting as { id: number; key: string; value: string; description: string; created_at: string; updated_at: string };
    });
  } catch (error) {
    console.error('Error searching settings:', error);
    return [];
  }
}
