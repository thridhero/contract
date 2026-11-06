import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BootstrapConfig {
  projectName: string;
  projectPath: string;
  databasePath: string;
  initialized: boolean;
  initializedAt: string;
}

const BOOTSTRAP_FILE_NAME = 'bootstrap.json';

/**
 * 获取 bootstrap 配置文件路径
 */
function getBootstrapPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, BOOTSTRAP_FILE_NAME);
}

/**
 * 读取引导配置
 */
export function readBootstrapConfig(): BootstrapConfig | null {
  const bootstrapPath = getBootstrapPath();
  
  try {
    if (!fs.existsSync(bootstrapPath)) {
      return null;
    }
    
    const content = fs.readFileSync(bootstrapPath, 'utf-8');
    return JSON.parse(content) as BootstrapConfig;
  } catch (error) {
    console.error('Error reading bootstrap config:', error);
    return null;
  }
}

/**
 * 保存引导配置
 */
export function saveBootstrapConfig(config: BootstrapConfig): void {
  const bootstrapPath = getBootstrapPath();
  
  try {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(bootstrapPath, content, 'utf-8');
  } catch (error) {
    console.error('Error saving bootstrap config:', error);
    throw error;
  }
}

/**
 * 检查是否已初始化
 */
export function isProjectInitialized(): boolean {
  const config = readBootstrapConfig();
  return config?.initialized === true;
}

/**
 * 获取项目路径
 */
export function getProjectPath(): string | null {
  const config = readBootstrapConfig();
  return config?.projectPath || null;
}

/**
 * 获取数据库路径
 */
export function getDatabasePath(): string | null {
  const config = readBootstrapConfig();
  return config?.databasePath || null;
}
