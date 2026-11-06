import * as path from 'path';

/** 判断当前是否为开发模式 */
export const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Windows 应用标识，用于任务栏分组与图标识别。
 * 开发模式使用独立 ID（加 .dev 后缀），避免与已安装的生产版本
 * 产生 Windows 图标缓存冲突，导致任务栏图标显示不正确。
 */
export const APP_USER_MODEL_ID = IS_DEV
  ? 'com.example.software-registration-manager.dev'
  : 'com.example.software-registration-manager';

/** 渲染进程开发服务器地址 */
export const DEV_SERVER_URL = 'http://localhost:5174';

/** 生产模式下渲染层 HTML 文件路径（相对于 __dirname = out/main/config/） */
export const RENDERER_HTML_PATH = path.join(__dirname, '..', '..', 'renderer', 'index.html');

/** 预加载脚本路径（相对于 __dirname = out/main/config/） */
export const PRELOAD_PATH = path.join(__dirname, '..', 'preload.js');

/**
 * 应用图标路径。
 * 开发态与打包态都指向同一份 build/icon.ico：
 * - 开发态：项目根目录/build/icon.ico
 * - 打包态：app.asar/build/icon.ico（需在 electron-builder files 中包含）
 * - 使用 ICO 格式确保 Windows 任务栏图标正常显示
 */
export const APP_ICON_PATH = path.join(__dirname, '..', '..', '..', 'build', 'icon.ico');

/** 窗口默认尺寸 */
export const WINDOW_CONFIG = {
  width: 1440,
  height: 1080,
  minWidth: 900,
  minHeight: 600,
} as const;

/** Bootstrap 配置文件名 */
export const BOOTSTRAP_FILE = 'bootstrap.json';

/** 数据库文件名 */
export const DATABASE_FILE = 'settings.db';
