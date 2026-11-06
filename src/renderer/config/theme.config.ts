export interface IThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

export interface IThemeTypography {
  fontFamily: string;
  fontSizeBase: string;
  fontSizeSmall: string;
  fontSizeLarge: string;
  fontWeightNormal: string | number;
  fontWeightBold: string | number;
}

export interface IThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface IThemeShadows {
  sm: string;
  md: string;
  lg: string;
}

export interface IThemeAnimations {
  transitionFast: string;
  transitionNormal: string;
  transitionSlow: string;
}

export interface IThemeConfig {
  id: string; // 主题唯一标识
  name: string; // 主题名称，用于展示
  version: string; // 主题版本号，用于版本管理和回滚
  type: 'light' | 'dark' | 'high-contrast'; // 基础色调模式
  colors: IThemeColors;
  typography: IThemeTypography;
  spacing: IThemeSpacing;
  shadows: IThemeShadows;
  animations: IThemeAnimations;
}

export const defaultThemeConfig: IThemeConfig = {
  id: 'theme-light',
  name: 'Default Light',
  version: '1.0.0',
  type: 'light',
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#0ea5e9',
    background: '#ffffff',
    surface: '#f8fafc',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
  },
  typography: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    fontSizeBase: '16px',
    fontSizeSmall: '14px',
    fontSizeLarge: '18px',
    fontWeightNormal: 400,
    fontWeightBold: 600,
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  animations: {
    transitionFast: '100ms ease-in-out',
    transitionNormal: '200ms ease-in-out',
    transitionSlow: '300ms ease-in-out',
  }
};
