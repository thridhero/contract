import { defineStore } from 'pinia'

export const useWindowStateStore = defineStore('windowState', {
  state: () => ({
    isMaximized: false,
    isMinimized: false,
    isVisible: true,
    windowBounds: {
      x: 0,
      y: 0,
      width: 800,
      height: 600
    }
  }),

  getters: {
    getWindowBounds: (state) => state.windowBounds,
    getIsMaximized: (state) => state.isMaximized,
    getIsMinimized: (state) => state.isMinimized,
    getVisibility: (state) => state.isVisible
  },

  actions: {
    setMaximized(status: boolean) {
      this.isMaximized = status
    },
    
    setMinimized(status: boolean) {
      this.isMinimized = status
    },
    
    setVisible(status: boolean) {
      this.isVisible = status
    },
    
    setWindowBounds(bounds: {x: number, y: number, width: number, height: number}) {
      this.windowBounds = {...bounds}
    },
    
    updateWindowState(newState: Partial<typeof this.$state>) {
      Object.assign(this.$state, newState)
    }
  }
})