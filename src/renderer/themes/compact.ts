// themes/compact.ts - 紧凑型布局主题配置
export const compactTheme = {
  // 间距配置 (Tailwind)
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.25rem',   // 20px
  },
  
  // 字体大小
  fontSize: {
    xs: '0.6875rem',   // 11px
    sm: '0.75rem',     // 12px
    base: '0.8125rem', // 13px
    lg: '0.875rem',    // 14px
    xl: '1rem',        // 16px
  },
  
  // 元素高度
  height: {
    xs: '1.5rem',    // 24px
    sm: '1.75rem',   // 28px
    base: '2rem',    // 32px
    lg: '2.25rem',   // 36px
  },
  
  // 侧边栏配置
  sidebar: {
    width: 220,           // 侧边栏宽度
    itemPadding: '0.375rem 0.5rem',  // 6px 8px
    itemGap: '0.25rem',   // 4px
    iconSize: '0.875rem', // 14px
    menuItemHeight: '1.75rem', // 28px
  },
  
  // 资源卡片配置
  card: {
    thumbnailHeight: '6rem',  // 96px (h-24)
    padding: '0.5rem',        // 8px (p-2)
    gap: '0.75rem',           // 12px (gap-3)
    gridCols: 5,              // 每行5列
  },
  
  // 属性面板配置
  propertiesPanel: {
    width: 240,
    padding: '0.75rem',       // 12px (p-3)
    previewHeight: '9rem',    // 144px (h-36)
    sectionGap: '0.75rem',    // 12px
    itemGap: '0.25rem',       // 4px
  },
  
  // 工具栏配置
  toolbar: {
    padding: '0.5rem',        // 8px (p-2)
    height: '2.5rem',         // 40px
  },
  
  // 列表配置
  list: {
    headerPadding: '0.375rem 0.75rem',  // 6px 12px
    itemPadding: '0.5rem 0.75rem',      // 8px 12px
    itemHeight: '2rem',       // 32px
  }
}

// 辅助函数：获取紧凑样式
export const getCompactStyle = (key: keyof typeof compactTheme) => {
  return compactTheme[key]
}

export default compactTheme
