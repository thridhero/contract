import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Ripple from 'primevue/ripple'
import 'primeicons/primeicons.css'

// 创建 Pinia 实例
const pinia = createPinia()

const zhCNLocale = {
  startsWith: 1,
  firstDayOfWeek: 1,
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  today: '今天',
  clear: '清除',
  weekHeader: '周',
  emptyMessage: '暂无可用选项',
  emptyFilterMessage: '未找到结果',
  emptySearchMessage: '未找到结果',
  selectionMessage: '已选择 {0} 项',
  emptySelectionMessage: '未选择任何项',
  searchMessage: '有 {0} 条可选结果'
}

// PrimeVue 配置 - 紧凑型布局
const primeVueConfig = {
  theme: {
    preset: Aura as any,
    options: {
      // 启用暗色模式自动检测
      darkModeSelector: '.dark-mode',
      // 不使用 CSS 变量覆盖
      cssLayer: false
    }
  },
  ripple: true,
  locale: zhCNLocale
}

export { pinia, primeVueConfig }

// 导出安装函数
export function installPrimeVue(app: any) {
  app.use(pinia)
  app.use(PrimeVue, primeVueConfig)
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)
  app.directive('ripple', Ripple)
}
