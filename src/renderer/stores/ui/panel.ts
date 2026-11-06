import { defineStore } from 'pinia'

export const usePanelStore = defineStore('panel', {
  state: () => ({
    leftPanelWidth: 50, // 默认各占50%
    rightPanelWidth: 50,
    minPanelWidth: 20,   // 最小面板宽度百分比
    maxPanelWidth: 80    // 最大面板宽度百分比
  }),

  getters: {
    getLeftPanelWidth: (state) => state.leftPanelWidth,
    getRightPanelWidth: (state) => state.rightPanelWidth,
    getPanelRatio: (state) => `${state.leftPanelWidth}/${100 - state.leftPanelWidth}`,
  },

  actions: {
    setLeftPanelWidth(width: number) {
      // 限制在最小和最大宽度之间
      const clampedWidth = Math.min(Math.max(width, this.minPanelWidth), this.maxPanelWidth);
      this.leftPanelWidth = clampedWidth;
      this.rightPanelWidth = 100 - clampedWidth;
    },
    
    resetPanels() {
      this.leftPanelWidth = 50;
      this.rightPanelWidth = 50;
    },
    
    updatePanelSizes(newLeftWidth: number) {
      this.setLeftPanelWidth(newLeftWidth);
    }
  }
})