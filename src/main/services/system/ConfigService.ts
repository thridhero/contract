import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IS_DEV } from '../../config/app.config';
import { normalizeLoggingSettings } from '../../../shared/utils/log';

const DEFAULT_BACKEND_CLIENT_ID = 'fd15ef26eb89afc6425b0f0570b84e57';
const LEGACY_BACKEND_CLIENT_ID = 'electron-desktop-client';

/**
 * 全局配置管理器
 * 负责读写全局配置文件，保存在应用默认数据目录 (userData)
 */
export class ConfigService {
  private static instance: ConfigService;
  private configPath: string;
  private defaultConfig: Record<string, any>;

  private constructor() {
    const userDataDir = (app && typeof (app as any).getPath === 'function')
      ? app.getPath('userData')
      : path.join(os.homedir(), '.software-registration-manager');
    fs.mkdirSync(userDataDir, { recursive: true });
    this.configPath = path.join(userDataDir, 'global-config.json');
    this.defaultConfig = {
      libraries: [],
      backendAuth: {
        baseUrl: 'https://contract.hongqikeji.cn/api',
        tenantId: 1,
        clientId: DEFAULT_BACKEND_CLIENT_ID,
        redirectMatch: '/social-callback',
      },
      auth: null,
      loggingSettings: normalizeLoggingSettings(),
      autoStartAtLogin: false,
      shortcutSettings: {
        'open-aggregated-search': 'Ctrl+Shift+F',
        'open-ai-workbench': 'Ctrl+Shift+A',
        'open-contract-tab': 'Ctrl+Shift+C',
      },
      backupSettings: {
        enabled: false,
        directoryMode: 'library',
        intervalHours: 24,
        keepLastN: 10,
      },
      quickCategories: [
        { key: 'all', name: '全部', icon: 'inbox', count: 1063 },
        { key: 'untagged', name: '全库合同', icon: 'tags', count: 777 },
        { key: 'calendar', name: '日历', icon: 'calendar', count: 0 },
        { key: 'templates', name: '模板', icon: 'file-edit', count: 0 },
        { key: 'statistics', name: '统计', icon: 'chart-bar', count: 0 },
        { key: 'tags', name: '标签管理', icon: 'tag', count: 28 },
        { key: 'suppliers', name: '乙方单位', icon: 'users', count: 0 },
        { key: 'customers', name: '甲方单位', icon: 'briefcase', count: 0 },
        { key: 'departments', name: '部门管理', icon: 'sitemap', count: 0 },
        { key: 'personnel', name: '人员管理', icon: 'id-card', count: 0 },
        { key: 'contract-products', name: '合同产品管理', icon: 'box', count: 0 },
        { key: 'project-management', name: '项目管理', icon: 'folder-open', count: 0 },
        { key: 'dictionaries', name: '字典设置', icon: 'book', count: 0 },
        { key: 'tree-dictionaries', name: '树形字典', icon: 'sitemap', count: 0 },
        { key: 'trash', name: '回收站', icon: 'trash', count: 764 }
      ]
    };
    this.init();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private normalizeBackendBaseUrl(rawValue: string): string {
    const fallback = String(this.defaultConfig.backendAuth.baseUrl || 'https://contract.hongqikeji.cn/api');
    const raw = String(rawValue || '').trim() || fallback;
    try {
      const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
      const hostname = parsed.hostname || '';
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (hostname === 'contract.hongqikeji.cn') {
        parsed.protocol = 'https:';
      }
      if (!pathname || pathname === '') {
        parsed.pathname = '/api';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return fallback;
    }
  }

  /** 初始化配置，不存在则创建默认配置 */
  private init() {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.defaultConfig);
    } else {
      // 合并默认配置，防止新增的配置项缺失
      const currentConfig = this.readConfig();
      const mergedConfig = { ...this.defaultConfig, ...currentConfig };
      mergedConfig.backendAuth = { ...this.defaultConfig.backendAuth, ...(currentConfig.backendAuth || {}) };
      const legacyBaseUrl = String(currentConfig.baseUrl || '').trim();
      const currentBackendBaseUrl = String(mergedConfig.backendAuth?.baseUrl || '').trim();
      const migratedBaseUrl = this.normalizeBackendBaseUrl(legacyBaseUrl || currentBackendBaseUrl);
      mergedConfig.backendAuth.baseUrl = migratedBaseUrl;
      mergedConfig.baseUrl = migratedBaseUrl;
      const currentClientId = String(mergedConfig.backendAuth?.clientId || '').trim();
      if (!currentClientId || currentClientId === LEGACY_BACKEND_CLIENT_ID) {
        mergedConfig.backendAuth.clientId = DEFAULT_BACKEND_CLIENT_ID;
      }
      if (mergedConfig.backendAuth && typeof mergedConfig.backendAuth === 'object') {
        delete mergedConfig.backendAuth.wechatSource;
      }
      if (!IS_DEV) {
        const rawBaseUrl = String(mergedConfig.backendAuth?.baseUrl || '').trim();
        const parsed = (() => {
          try {
            const url = new URL(rawBaseUrl.includes('://') ? rawBaseUrl : `http://${rawBaseUrl}`);
            return url;
          } catch {
            return null;
          }
        })();
        const hostname = parsed?.hostname || '';
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
          mergedConfig.backendAuth.baseUrl = this.defaultConfig.backendAuth.baseUrl;
          mergedConfig.baseUrl = mergedConfig.backendAuth.baseUrl;
        }
        if (hostname === 'contract.hongqikeji.cn') {
          const pathname = String(parsed?.pathname || '/');
          if (pathname === '/' || pathname === '') {
            mergedConfig.backendAuth.baseUrl = `${parsed?.origin || 'https://contract.hongqikeji.cn'}/api`;
            mergedConfig.baseUrl = mergedConfig.backendAuth.baseUrl;
          }
        }
      }
      mergedConfig.backupSettings = { ...this.defaultConfig.backupSettings, ...(currentConfig.backupSettings || {}) };
      
      // 特别处理 quickCategories，确保新增的模块能够显示
      if (currentConfig.quickCategories && Array.isArray(currentConfig.quickCategories)) {
        const categories = currentConfig.quickCategories.filter((c: any) => c && c.key !== 'uncategorized');
        const ensureCategory = (key: string) => {
          const exists = categories.some((c: any) => c.key === key);
          if (exists) return;
          const item = this.defaultConfig.quickCategories.find((c: any) => c.key === key);
          if (!item) return;
          const trashIndex = categories.findIndex((c: any) => c.key === 'trash');
          if (trashIndex !== -1) {
            categories.splice(trashIndex, 0, item);
          } else {
            categories.push(item);
          }
        };

        ensureCategory('suppliers');
        ensureCategory('customers');
        ensureCategory('departments');
        ensureCategory('personnel');
        ensureCategory('contract-products');
        ensureCategory('project-management');
        ensureCategory('dictionaries');
        ensureCategory('tree-dictionaries');
        mergedConfig.quickCategories = categories;
      }
      
      this.saveConfig(mergedConfig);
    }
  }

  /** 读取配置 */
  public readConfig(): Record<string, any> {
    try {
      if (!fs.existsSync(this.configPath)) return this.defaultConfig;
      const data = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('读取全局配置失败:', err);
      return this.defaultConfig;
    }
  }

  /** 获取指定配置项 */
  public getConfigItem(key: string): any {
    const config = this.readConfig();
    return config[key];
  }

  /** 保存完整配置 */
  public saveConfig(config: Record<string, any>): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.notifyConfigChange();
    } catch (err) {
      console.error('保存全局配置失败:', err);
    }
  }

  /** 更新指定配置项 */
  public updateConfigItem(key: string, value: any): void {
    const config = this.readConfig();
    if (key === 'baseUrl') {
      const normalizedBaseUrl = this.normalizeBackendBaseUrl(String(value || ''));
      config.baseUrl = normalizedBaseUrl;
      config.backendAuth = {
        ...this.defaultConfig.backendAuth,
        ...(config.backendAuth || {}),
        baseUrl: normalizedBaseUrl
      };
    } else if (key === 'backendAuth' && value && typeof value === 'object') {
      const nextBackendAuth = {
        ...this.defaultConfig.backendAuth,
        ...(config.backendAuth || {}),
        ...value
      };
      nextBackendAuth.baseUrl = this.normalizeBackendBaseUrl(String(nextBackendAuth.baseUrl || config.baseUrl || ''));
      delete nextBackendAuth.wechatSource;
      config.backendAuth = nextBackendAuth;
      config.baseUrl = nextBackendAuth.baseUrl;
    } else {
      config[key] = value;
    }
    this.saveConfig(config);
  }

  /** 获取默认配置 */
  public getDefaultConfig(): Record<string, any> {
    return this.defaultConfig;
  }

  /** 通知渲染进程配置已改变 */
  private notifyConfigChange(): void {
    if (!BrowserWindow || typeof (BrowserWindow as any).getAllWindows !== 'function') return;
    const windows = BrowserWindow.getAllWindows();
    const currentConfig = this.readConfig();
    windows.forEach(win => {
      win.webContents.send('config:changed', currentConfig);
    });
  }
}
