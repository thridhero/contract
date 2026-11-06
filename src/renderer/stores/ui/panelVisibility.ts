import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePanelVisibilityStore = defineStore('panelVisibility', () => {
  // 属性面板是否始终显示
  const alwaysShowPanel = ref(true)
  
  // 切换属性面板的始终显示状态
  const toggleAlwaysShowPanel = () => {
    alwaysShowPanel.value = !alwaysShowPanel.value
  }
  
  // 设置属性面板始终显示状态
  const setAlwaysShowPanel = (value: boolean) => {
    alwaysShowPanel.value = value
  }
  
  return {
    alwaysShowPanel,
    toggleAlwaysShowPanel,
    setAlwaysShowPanel
  }
})
