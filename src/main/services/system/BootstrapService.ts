import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BootstrapConfig } from '../../../shared/types/bootstrap.types';
import { BOOTSTRAP_FILE } from '../../config/app.config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BootstrapService');

/**
 * Bootstrap 配置服务（单例）
 *
 * bootstrap.json 存储于 Electron userData 目录，
 * 是应用初始化状态的唯一可信来源。
 */
export class BootstrapService {
  private static instance: BootstrapService;
  private configPath: string;

  private constructor() {
    const userDataDir = app && typeof (app as any).getPath === 'function'
      ? app.getPath('userData')
      : path.join(os.homedir(), '.software-registration-manager');
    fs.mkdirSync(userDataDir, { recursive: true });
    this.configPath = path.join(userDataDir, BOOTSTRAP_FILE);
  }

  static getInstance(): BootstrapService {
    if (!BootstrapService.instance) {
      BootstrapService.instance = new BootstrapService();
    }
    return BootstrapService.instance;
  }

  /** 读取 bootstrap.json，文件不存在或解析失败时返回 null */
  readConfig(): BootstrapConfig | null {
    try {
      if (!fs.existsSync(this.configPath)) return null;
      return JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as BootstrapConfig;
    } catch (err) {
      logger.error(`读取 bootstrap.json 失败: ${err}`);
      return null;
    }
  }

  /** 写入 bootstrap.json */
  saveConfig(config: BootstrapConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info(`bootstrap.json 已保存: ${this.configPath}`);
  }

  isInitialized(): boolean {
    return this.readConfig()?.initialized === true;
  }

  getDatabasePath(): string | null {
    return this.readConfig()?.databasePath ?? null;
  }
}
