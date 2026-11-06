import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/index.css'
import 'quill/dist/quill.snow.css'
import { installPrimeVue } from './plugins/primevue'
import { createRendererLogger } from './utils/logger'

const logger = createRendererLogger('RendererApp')

const app = createApp(App)

// 使用 PrimeVue 配置（包含 Pinia）
installPrimeVue(app)

window.addEventListener('error', event => {
  logger.error('渲染进程未捕获异常', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  })
})

window.addEventListener('unhandledrejection', event => {
  logger.error('渲染进程未处理的 Promise 拒绝', event.reason)
})

app.use(router)
app.mount('#app')
