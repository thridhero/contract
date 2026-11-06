/**
 * Bootstrap 配置类型
 * bootstrap.json 是应用初始化状态的唯一可信来源，
 * 存储于 Electron 的 userData 目录。
 */
export interface BootstrapConfig {
  projectName: string;
  projectPath: string;
  databasePath: string;
  initialized: boolean;
  initializedAt: string;
}
