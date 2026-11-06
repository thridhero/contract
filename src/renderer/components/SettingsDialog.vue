<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '800px', height: '620px' }"
    :closable="false"
    :draggable="false"
    @hide="handleClose"
  >
    <template #container="{ closeCallback }">
      <div class="flex h-full w-full bg-content-card bg-content-card-bg rounded-lg shadow-xl overflow-hidden text-content-text" style="height: 620px;">
        <!-- 左侧菜单 -->
        <div class="w-[200px] bg-sidebar-bg flex flex-col border-r border-sidebar-divider h-full">
          <!-- 偏好设置标题 -->
          <div class="p-5 pb-3 text-base font-bold text-sidebar-text">
            偏好设置
          </div>
          <!-- 菜单列表 -->
          <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-[2px] custom-scrollbar">
            <template v-for="item in menuItems" :key="item.id || item.divider">
              <div v-if="item.divider" class="h-px bg-sidebar-divider my-2 mx-2"></div>
              <div
                v-else
                class="flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors"
                :class="activeMenu === item.id ? 'bg-sidebar-active-bg text-sidebar-text font-medium border-l-2 border-sidebar-active-border' : 'text-sidebar-text-secondary hover:bg-sidebar-hover'"
                @click="activeMenu = item.id"
              >
                <div v-if="item.iconText" class="w-4 mr-3 text-sidebar-text-secondary font-mono text-center  font-bold">{{ item.iconText }}</div>
                <i v-else-if="item.icon" :class="[item.icon, 'mr-3 text-sidebar-text-secondary']" style="font-size: 1rem"></i>
                {{ item.label }}
              </div>
            </template>
          </div>
        </div>

        <!-- 右侧内容 -->
        <div class="flex-1 flex flex-col h-full bg-content-bg relative">
          <!-- 顶部标题和关闭按钮 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-content-divider">
            <h2 class="text-base font-bold text-content-text">
              {{ activeMenuLabel }}
            </h2>
            <button @click="closeCallback" class="text-content-text-muted hover:text-content-text focus:outline-none transition-colors">
              <i class="pi pi-times text-lg"></i>
            </button>
          </div>

          <!-- 滚动内容区 -->
          <div class="flex-1 overflow-y-auto px-6 py-4 bg-content-bg custom-scrollbar">
            <!-- 常用设置 -->
            <div v-if="activeMenu === 'general'" class="space-y-6">
              
              <!-- 外观 -->
              <div>
                <div class="text-sm text-content-text-secondary mb-2 ml-1">外观</div>
                <div class="border border-content-border rounded-lg p-5 space-y-5 bg-content-card-bg">
                  
                  <!-- 主题 -->
                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">主题</span>
                    <div class="flex gap-3">
                      <div @click="general.theme = 'auto'" class="w-6 h-6 rounded-full bg-gradient-to-r from-black to-white border cursor-pointer hover:opacity-80" :class="general.theme === 'auto' ? 'border-[2.5px] border-btn-primary-bg' : 'border-input-border'"></div>
                      <div @click="general.theme = 'light'" class="w-6 h-6 rounded-full bg-white border cursor-pointer" :class="general.theme === 'light' ? 'border-[2.5px] border-btn-primary-bg' : 'border-input-border'"></div>
                      <div @click="general.theme = 'dark'" class="w-6 h-6 rounded-full bg-black border cursor-pointer hover:opacity-80" :class="general.theme === 'dark' ? 'border-[2.5px] border-btn-primary-bg' : 'border-input-border'"></div>
                    </div>
                  </div>
                  
                  <div class="h-px bg-content-divider w-full"></div>

                  <!-- 基础颜色 (主色调) -->
                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">基础颜色</span>
                    <div class="flex gap-3 flex-wrap flex-1">
                      <div v-for="color in primaryColors" :key="color.value"
                           @click="general.primaryColor = color.value" 
                           class="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                           :style="{ backgroundColor: color.value }"
                           :title="color.label">
                        <i v-if="general.primaryColor === color.value" class="pi pi-check text-white "></i>
                      </div>
                    </div>
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <!-- PrimeVue 预设主题 -->
                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">组件主题</span>
                    <div class="flex gap-3">
                      <Select v-model="general.primeVuePreset" :options="presetOptions" optionLabel="label" optionValue="value" class="w-48 !bg-input-bg !" />
                    </div>
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <!-- 字体大小 -->
                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">字体大小</span>
                    <div class="flex gap-3">
                      <Select v-model="general.fontSize" :options="fontSizeOptions" optionLabel="label" optionValue="value" class="w-48 !bg-input-bg !" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 启动项 -->
              <div>
                <div class="text-sm text-content-text-secondary mb-2 ml-1">启动项</div>
                <div class="border border-content-border rounded-lg p-5 space-y-4 bg-content-card-bg">
                  <div class="flex items-center">
                    <Checkbox v-model="general.autoStart" :binary="true" inputId="autoStart" />
                    <label for="autoStart" class="ml-3 text-sm text-content-text cursor-pointer select-none">开机自动启动</label>
                  </div>
                </div>
              </div>

            </div>

            <!-- 其他占位或旧设置 -->
            <!-- AI 配置 -->
            <div v-if="activeMenu === 'ai'" class="space-y-6">
              <AISettingsSection v-model:settings="ai" />
              <div class="flex justify-end">
                <Button label="保存 AI 设置" class="!bg-btn-primary-bg !border-btn-primary-bg !text-btn-primary-text hover:!bg-btn-primary-hover !px-4 !py-1.5 text-sm !font-normal rounded" @click="saveAISettings" />
              </div>
            </div>

            <div v-if="activeMenu === 'backup'" class="space-y-6">
              <div>
                <div class="text-sm text-content-text-secondary mb-2 ml-1">数据备份</div>
                <div class="border border-content-border rounded-lg p-5 space-y-5 bg-content-card-bg">
                  <div class="flex items-center">
                    <Checkbox v-model="backupSettings.enabled" :binary="true" inputId="backupEnabledDialog" @change="saveBackupSettings" />
                    <label for="backupEnabledDialog" class="ml-3 text-sm text-content-text cursor-pointer select-none">启用自动备份</label>
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">备份目录</span>
                    <div class="flex items-center gap-2 flex-1">
                      <div class="flex-1 text-sm text-content-text-secondary truncate" :title="backupDirText">{{ backupDirText }}</div>
                      <Button label="选择" class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-3 !py-1.5 text-sm !font-normal rounded" @click="selectBackupDir" />
                      <Button v-if="backupSettings.directoryMode === 'custom'" label="恢复默认" class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-3 !py-1.5 text-sm !font-normal rounded" @click="resetBackupDir" />
                    </div>
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">间隔小时</span>
                    <InputNumber v-model="backupSettings.intervalHours" :min="1" class="w-40 text-sm" @blur="saveBackupSettings" />
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div class="flex items-center">
                    <span class="w-24 text-sm text-content-text">保留份数</span>
                    <InputNumber v-model="backupSettings.keepLastN" :min="1" class="w-40 text-sm" @blur="saveBackupSettings" />
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div class="flex items-start">
                    <span class="w-24 text-sm text-content-text pt-0.5">最近状态</span>
                    <div class="flex-1 text-sm text-content-text-secondary">
                      <div>{{ backupStatusText }}</div>
                      <div v-if="backupSettings.lastBackupPath" class="truncate mt-1" :title="backupSettings.lastBackupPath">{{ backupSettings.lastBackupPath }}</div>
                    </div>
                  </div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div class="flex items-center justify-between gap-4">
                    <div class="flex gap-2">
                      <Button label="立即备份" :loading="backupBusy" class="!bg-btn-primary-bg !border-btn-primary-bg !text-btn-primary-text !px-4 !py-1.5 text-sm !font-normal rounded" @click="runBackupNow" />
                      <Button label="从备份恢复" :disabled="backupBusy" class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-4 !py-1.5 text-sm !font-normal rounded" @click="restoreFromBackup" />
                    </div>
                    <Button label="刷新列表" :disabled="backupBusy" class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-4 !py-1.5 text-sm !font-normal rounded" @click="refreshBackupList" />
                  </div>

                  <div v-if="backupList.length > 0" class="space-y-2">
                    <div class="text-sm text-content-text">最近备份文件</div>
                    <div
                      v-for="item in backupList.slice(0, 5)"
                      :key="item.path"
                      class="text-sm text-content-text-secondary truncate"
                      :title="item.path"
                    >
                      {{ formatDateTime(item.mtimeMs) }} · {{ item.path }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeMenu === 'logs'" class="space-y-6">
              <LoggingSettingsSection v-model:settings="logging" />
              <div class="flex justify-end">
                <Button label="保存日志设置" class="!bg-btn-primary-bg !border-btn-primary-bg !text-btn-primary-text hover:!bg-btn-primary-hover !px-4 !py-1.5 text-sm !font-normal rounded" @click="saveLoggingSettings" />
              </div>
            </div>

            <div v-if="activeMenu === 'shortcuts'" class="space-y-6">
              <div>
                <div class="text-sm text-content-text-secondary mb-2 ml-1">快捷键</div>
                <div class="border border-content-border rounded-lg p-5 space-y-4 bg-content-card-bg">
                  <div class=" text-content-text-muted">格式示例：Ctrl+Shift+F。点击“录制”后按下组合键即可。</div>

                  <div class="h-px bg-content-divider w-full"></div>

                  <div v-for="item in shortcutItems" :key="item.id" class="flex items-center gap-3">
                    <div class="w-40 text-sm text-content-text">
                      <div>{{ item.label }}</div>
                      <div class=" text-content-text-muted mt-0.5">{{ item.description }}</div>
                    </div>
                    <InputText
                      v-model="item.accelerator"
                      class="flex-1 !bg-input-bg !text-sm"
                      :placeholder="shortcutDefaults[item.id]"
                      :disabled="shortcutCapturingId === item.id"
                    />
                    <Button
                      :label="shortcutCapturingId === item.id ? '录制中...' : '录制'"
                      class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-3 !py-1.5 text-sm !font-normal rounded"
                      :disabled="shortcutCapturingId !== null && shortcutCapturingId !== item.id"
                      @click="shortcutCapturingId === item.id ? stopShortcutCapture() : startShortcutCapture(item.id)"
                    />
                    <Button
                      label="恢复默认"
                      class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-3 !py-1.5 text-sm !font-normal rounded"
                      :disabled="shortcutCapturingId !== null"
                      @click="resetShortcutToDefault(item.id)"
                    />
                  </div>

                  <div v-if="shortcutError" class=" text-red-500">{{ shortcutError }}</div>
                </div>
              </div>
            </div>

            <div v-if="activeMenu === 'developer'" class="space-y-6">
              <DeveloperSettingsSection />
            </div>

            <!-- 其他暂无内容的占位提示 -->
            <div v-if="!['general', 'ai', 'backup', 'logs', 'shortcuts', 'developer'].includes(activeMenu)" class="h-full flex items-center justify-center text-content-text-muted">
              正在开发中...
            </div>
          </div>

          <!-- 底部按钮区 -->
          <div class="px-6 py-4 border-t border-content-divider flex justify-end gap-3 bg-content-bg">
            <Button label="保存设置" class="!bg-btn-primary-bg !border-btn-primary-bg !text-btn-primary-text !px-6 !py-1.5 text-sm !font-normal rounded shadow-sm hover:!bg-btn-primary-hover transition-colors" @click="handleSaveAndClose" />
            <Button label="取消" class="!bg-btn-ghost-bg !border-input-border !text-content-text !px-6 !py-1.5 text-sm !font-normal rounded shadow-sm hover:!bg-btn-ghost-hover transition-colors" @click="closeCallback" />
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useThemeStore } from '../stores/ui/themeStore'
import { useAIStore } from '../stores/system/aiStore'
import type { AISettings } from '../../shared/types/ai.types'
import type { BackupInfo, BackupSettings } from '../../shared/types/backup.types'
import type { LoggingSettings } from '../../shared/types/log.types'
import { normalizeAISettings } from '../../shared/utils/ai'
import { normalizeLoggingSettings } from '../../shared/utils/log'
import { createRendererLogger } from '../utils/logger'

// PrimeVue 组件
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import AISettingsSection from './settings/AISettingsSection.vue'
import LoggingSettingsSection from './settings/LoggingSettingsSection.vue'
import DeveloperSettingsSection from './settings/DeveloperSettingsSection.vue'

// Props 定义
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const logger = createRendererLogger('SettingsDialog')

// Emits 定义
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

// 使用主题 Store
const themeStore = useThemeStore()

// 本地可见性状态
const visible = ref(props.modelValue)

// 监听 props 变化
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

// 监听本地状态变化
watch(() => visible.value, (newVal) => {
  emit('update:modelValue', newVal)
})

// 当前选中的菜单
const activeMenu = ref('general')

// 菜单项
const menuItems = [
  { id: 'general', label: '常用', icon: 'pi pi-cog' },
  { divider: true, id: 'd1' },
  { id: 'shortcuts', label: '快捷键', icon: 'pi pi-th-large' },
  { divider: true, id: 'd2' },
  { id: 'developer', label: '开发者/缓存', iconText: '</>' },
  { id: 'logs', label: '日志', icon: 'pi pi-file-edit' },
  { id: 'ai', label: 'AI 配置', icon: 'pi pi-sparkles' },
  { id: 'backup', label: '数据备份', icon: 'pi pi-database' }
]

const activeMenuLabel = computed(() => {
  const item = menuItems.find(i => i.id === activeMenu.value)
  return item ? item.label : ''
})

// 常用设置数据
const general = ref({
  theme: 'auto',
  primeVuePreset: 'aura',
  fontSize: '14px',
  primaryColor: '#0D6EFD',
  transparent: true,
  showCount: true,
  autoStart: false,
  gpuAccel: true,
  autoSelectNew: true,
  notifyDuplicate: true,
  browserExtCategory: false,
  retinaScreenshot: true
})

// 主色调预设选项
const primaryColors = [
  { label: '蓝色 (默认)', value: '#0D6EFD' },
  { label: '靛蓝', value: '#6366F1' },
  { label: '紫色', value: '#8B5CF6' },
  { label: '粉色', value: '#EC4899' },
  { label: '玫瑰红', value: '#F43F5E' },
  { label: '橙色', value: '#F97316' },
  { label: '琥珀色', value: '#F59E0B' },
  { label: '绿色', value: '#10B981' },
  { label: '青色', value: '#06B6D4' },
  { label: '青蓝', value: '#0EA5E9' },
  { label: '板岩灰', value: '#64748B' }
]

const presetOptions = [
  { label: 'Aura (默认)', value: 'aura' },
  { label: 'Material', value: 'material' },
  { label: 'Lara', value: 'lara' },
  { label: 'Nora', value: 'nora' }
]

const fontSizeOptions = [
  { label: '小 (12px)', value: '12px' },
  { label: '较小 (13px)', value: '13px' },
  { label: '标准 (14px)', value: '14px' },
  { label: '较大 (15px)', value: '15px' },
  { label: '大 (16px)', value: '16px' }
]

// 使用 AI Store
const aiStore = useAIStore()

const ai = ref<AISettings>(normalizeAISettings({}))
const logging = ref<LoggingSettings>(normalizeLoggingSettings())
const baseUrlInput = ref('')
const baseUrlError = ref('')
const baseUrlBusy = ref(false)
const baseUrlDirty = ref(false)
const backupSettings = ref<BackupSettings>({
  enabled: false,
  directoryMode: 'library',
  intervalHours: 24,
  keepLastN: 10,
})
const backupList = ref<BackupInfo[]>([])
const backupBusy = ref(false)

const shortcutDefaults: Record<string, string> = {
  'open-library-menu': 'Ctrl+Shift+L',
  'toggle-sidebar-collapse': 'Ctrl+B',
  'open-aggregated-search': 'Ctrl+Shift+F',
  'open-preferences': 'Ctrl+,',
  'app-exit': 'Ctrl+Q',
  'open-ai-workbench': 'Ctrl+Shift+A',
  'open-contract-tab': 'Ctrl+Shift+C',
}

type ShortcutItem = { id: string; label: string; description: string; accelerator: string }
const shortcutItems = ref<ShortcutItem[]>([
  { id: 'open-library-menu', label: '资源库', description: '打开资源库菜单', accelerator: shortcutDefaults['open-library-menu'] },
  { id: 'toggle-sidebar-collapse', label: '折叠菜单', description: '折叠/展开左侧菜单', accelerator: shortcutDefaults['toggle-sidebar-collapse'] },
  { id: 'open-aggregated-search', label: '聚合搜索', description: '打开聚合搜索', accelerator: shortcutDefaults['open-aggregated-search'] },
  { id: 'open-preferences', label: '偏好设置', description: '打开偏好设置', accelerator: shortcutDefaults['open-preferences'] },
  { id: 'app-exit', label: '退出', description: '退出应用', accelerator: shortcutDefaults['app-exit'] },
  { id: 'open-ai-workbench', label: 'AI 工作台', description: '打开 AI 工作台', accelerator: shortcutDefaults['open-ai-workbench'] },
  { id: 'open-contract-tab', label: '合同选项卡', description: '打开合同列表（资源视图）', accelerator: shortcutDefaults['open-contract-tab'] },
])
const shortcutError = ref('')
const shortcutCapturingId = ref<string | null>(null)
let shortcutCaptureHandler: ((e: KeyboardEvent) => void) | null = null

const backupDirText = computed(() => {
  if (backupSettings.value.directoryMode === 'custom' && backupSettings.value.customDir) {
    return backupSettings.value.customDir
  }
  return '资源库/backups'
})

const backupStatusText = computed(() => {
  if (!backupSettings.value.lastBackupAt) {
    return '暂无备份记录'
  }
  const base = `${formatDateTime(backupSettings.value.lastBackupAt)}`
  if (backupSettings.value.lastBackupOk === false) {
    return `${base} · 失败${backupSettings.value.lastBackupMessage ? `：${backupSettings.value.lastBackupMessage}` : ''}`
  }
  return `${base} · 成功`
})

const normalizeBackupSettingsLocal = (input: any): BackupSettings => {
  const raw = (input && typeof input === 'object') ? input : {}
  const directoryMode = raw.directoryMode === 'custom' ? 'custom' : 'library'
  const customDir = typeof raw.customDir === 'string' && raw.customDir.trim() ? raw.customDir.trim() : undefined
  const intervalHours = Number.isFinite(Number(raw.intervalHours)) ? Math.max(1, Math.floor(Number(raw.intervalHours))) : 24
  const keepLastN = Number.isFinite(Number(raw.keepLastN)) ? Math.max(1, Math.floor(Number(raw.keepLastN))) : 10
  return {
    enabled: Boolean(raw.enabled),
    directoryMode,
    customDir,
    intervalHours,
    keepLastN,
    lastBackupAt: typeof raw.lastBackupAt === 'number' ? raw.lastBackupAt : undefined,
    lastBackupPath: typeof raw.lastBackupPath === 'string' ? raw.lastBackupPath : undefined,
    lastBackupOk: typeof raw.lastBackupOk === 'boolean' ? raw.lastBackupOk : undefined,
    lastBackupMessage: typeof raw.lastBackupMessage === 'string' ? raw.lastBackupMessage : undefined,
  }
}

const loadBackupSettings = async () => {
  const res = await window.electronAPI.config.getItem('backupSettings')
  if (res.success) {
    backupSettings.value = normalizeBackupSettingsLocal(res.data)
  }
}

const normalizeShortcutSettingsLocal = (input: unknown): Record<string, string> => {
  const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  Object.keys(shortcutDefaults).forEach((id) => {
    const v = raw[id]
    out[id] = typeof v === 'string' && v.trim() ? v.trim() : shortcutDefaults[id]
  })
  return out
}

const normalizeAcceleratorText = (input: string): string => {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const parts = raw.split('+').map(s => s.trim()).filter(Boolean)
  const mods = new Set<string>()
  let key = ''
  for (const p of parts) {
    const lower = p.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') mods.add('Ctrl')
    else if (lower === 'shift') mods.add('Shift')
    else if (lower === 'alt' || lower === 'option') mods.add('Alt')
    else if (lower === 'cmd' || lower === 'command' || lower === 'meta') mods.add('Cmd')
    else key = p.length === 1 ? p.toUpperCase() : p
  }
  const orderedMods = ['Ctrl', 'Shift', 'Alt', 'Cmd'].filter(m => mods.has(m))
  if (!key) return orderedMods.join('+')
  return orderedMods.length ? `${orderedMods.join('+')}+${key}` : key
}

const buildAcceleratorFromKeyboardEvent = (e: KeyboardEvent): string => {
  const modifiers: string[] = []
  if (e.ctrlKey) modifiers.push('Ctrl')
  if (e.shiftKey) modifiers.push('Shift')
  if (e.altKey) modifiers.push('Alt')
  if (e.metaKey) modifiers.push('Cmd')

  const keyMap: Record<string, string> = {
    ' ': 'Space',
    '+': 'Plus',
    '-': 'Minus',
    '=': 'Equal',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    ';': 'Semicolon',
    '\'': 'Quote',
    '`': 'Backquote',
    '\\': 'Backslash',
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
    'arrowup': 'Up',
    'arrowdown': 'Down',
    'arrowleft': 'Left',
    'arrowright': 'Right',
  }

  let key = e.key || ''
  const lower = key.toLowerCase()
  if (keyMap[lower]) {
    key = keyMap[lower]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  if (modifiers.length > 0) {
    return `${modifiers.join('+')}+${key}`
  }
  return key
}

const isModifierKey = (key: string) => {
  return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta'
}

const loadShortcutSettings = async () => {
  shortcutError.value = ''
  const res = await window.electronAPI.config.getItem('shortcutSettings')
  const merged = normalizeShortcutSettingsLocal(res.success ? res.data : undefined)
  shortcutItems.value = shortcutItems.value.map(item => ({
    ...item,
    accelerator: merged[item.id] || shortcutDefaults[item.id] || item.accelerator
  }))
}

const validateShortcutSettings = (payload: Record<string, string>): string => {
  const used = new Map<string, string>()
  for (const [id, acc] of Object.entries(payload)) {
    const key = acc.toLowerCase()
    const other = used.get(key)
    if (other) {
      return `快捷键冲突：${acc} 同时被 “${other}” 和 “${id}” 使用`
    }
    used.set(key, id)
  }
  return ''
}

const saveShortcutSettings = async () => {
  shortcutError.value = ''
  const payload: Record<string, string> = {}
  for (const item of shortcutItems.value) {
    const normalized = normalizeAcceleratorText(item.accelerator)
    if (!normalized) {
      shortcutError.value = `快捷键不能为空：${item.label}`
      return
    }
    payload[item.id] = normalized
  }
  const conflict = validateShortcutSettings(payload)
  if (conflict) {
    shortcutError.value = conflict
    return
  }

  const res = await window.electronAPI.config.updateItem('shortcutSettings', payload)
  if (!res.success) {
    shortcutError.value = `保存失败：${res.error || '未知错误'}`
  } else {
    await loadShortcutSettings()
  }
}

const resetShortcutToDefault = (id: string) => {
  const def = shortcutDefaults[id]
  if (!def) return
  const target = shortcutItems.value.find(i => i.id === id)
  if (target) target.accelerator = def
}

const stopShortcutCapture = () => {
  if (shortcutCaptureHandler) {
    window.removeEventListener('keydown', shortcutCaptureHandler, true)
    shortcutCaptureHandler = null
  }
  shortcutCapturingId.value = null
}

const startShortcutCapture = (id: string) => {
  stopShortcutCapture()
  shortcutCapturingId.value = id
  shortcutCaptureHandler = (e: KeyboardEvent) => {
    if (!shortcutCapturingId.value) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      stopShortcutCapture()
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const target = shortcutItems.value.find(i => i.id === shortcutCapturingId.value)
      if (target) target.accelerator = ''
      stopShortcutCapture()
      return
    }
    if (isModifierKey(e.key)) {
      return
    }
    const acc = buildAcceleratorFromKeyboardEvent(e)
    const target = shortcutItems.value.find(i => i.id === shortcutCapturingId.value)
    if (target) target.accelerator = normalizeAcceleratorText(acc)
    stopShortcutCapture()
  }
  window.addEventListener('keydown', shortcutCaptureHandler, true)
}

const saveBackupSettings = async () => {
  const payload: any = { ...backupSettings.value }
  if (payload.directoryMode !== 'custom') {
    delete payload.customDir
  }
  const res = await window.electronAPI.config.updateItem('backupSettings', payload)
  if (!res.success) {
    alert(`保存备份设置失败：${res.error || '未知错误'}`)
  }
}

const refreshBackupList = async () => {
  const res = await window.electronAPI.backup.list()
  if (res.success && res.data) {
    backupList.value = res.data
  }
}

const selectBackupDir = async () => {
  const res = await window.electronAPI.fs.selectFile({
    title: '选择备份目录',
    properties: ['openDirectory'],
  })
  if (!res.success || !res.data || res.data.canceled) return
  const dir = res.data.filePaths?.[0]
  if (!dir) return
  backupSettings.value.directoryMode = 'custom'
  backupSettings.value.customDir = dir
  await saveBackupSettings()
}

const resetBackupDir = async () => {
  backupSettings.value.directoryMode = 'library'
  backupSettings.value.customDir = undefined
  await saveBackupSettings()
}

const runBackupNow = async () => {
  if (backupBusy.value) return
  backupBusy.value = true
  try {
    const res = await window.electronAPI.backup.create()
    if (!res.success) {
      alert(`备份失败：${res.error || '未知错误'}`)
      return
    }
    await loadBackupSettings()
    await refreshBackupList()
    alert(`备份成功：${res.data?.backupPath || ''}`)
  } finally {
    backupBusy.value = false
  }
}

const restoreFromBackup = async () => {
  if (backupBusy.value) return
  const selected = await window.electronAPI.fs.selectFile({
    title: '选择备份文件',
    properties: ['openFile'],
    filters: [{ name: 'SQLite 备份', extensions: ['db'] }],
  })
  if (!selected.success || !selected.data || selected.data.canceled) return
  const backupPath = selected.data.filePaths?.[0]
  if (!backupPath) return
  if (!confirm('恢复会覆盖当前数据库，建议先确认已有备份。是否继续？')) return

  backupBusy.value = true
  try {
    const res = await window.electronAPI.backup.restore(backupPath)
    if (!res.success) {
      alert(`恢复失败：${res.error || '未知错误'}`)
      return
    }
    alert('恢复已执行，窗口将重新加载。')
  } finally {
    backupBusy.value = false
  }
}

const formatDateTime = (ms?: number) => {
  if (!ms) return '暂无'
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const normalizeBaseUrlLocal = (input: string): { normalized: string; error: string } => {
  const raw = String(input || '').trim()
  if (!raw) {
    return { normalized: '', error: '' }
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { normalized: raw, error: 'Base URL 不是合法的 URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { normalized: raw, error: 'Base URL 仅支持 http:// 或 https://' }
  }
  const normalized = raw.replace(/\/+$/, '')
  return { normalized, error: '' }
}

const loadBaseUrl = async () => {
  try {
    const backendAuthRes = await window.electronAPI.config.getItem('backendAuth')
    const backendBaseUrl = backendAuthRes.success && backendAuthRes.data && typeof backendAuthRes.data === 'object'
      ? String((backendAuthRes.data as Record<string, unknown>).baseUrl || '')
      : ''
    if (backendBaseUrl) {
      baseUrlInput.value = backendBaseUrl
    } else {
      const res = await window.electronAPI.config.getItem('backendAuth')
      if (res.success) {
        const backendAuth = (res.data && typeof res.data === 'object') ? (res.data as any) : {}
      baseUrlInput.value = typeof backendAuth.baseUrl === 'string' ? backendAuth.baseUrl : ''
      }
    }
    baseUrlDirty.value = false
    baseUrlError.value = ''
  } catch (err) {
    logger.error('加载 baseUrl 失败', err)
  }
}

const saveBaseUrl = async () => {
  if (baseUrlBusy.value) return
  baseUrlBusy.value = true
  try {
    const { normalized, error } = normalizeBaseUrlLocal(baseUrlInput.value)
    if (error) {
      baseUrlError.value = error
      return
    }

    const backendAuthRes = await window.electronAPI.config.getItem('backendAuth')
    const backendAuth = backendAuthRes.success && backendAuthRes.data && typeof backendAuthRes.data === 'object'
      ? { ...(backendAuthRes.data as Record<string, unknown>) }
      : {}
    const saveBackendAuthRes = await window.electronAPI.config.updateItem('backendAuth', {
      ...backendAuth,
      baseUrl: normalized
    })
    if (!saveBackendAuthRes.success) {
      baseUrlError.value = saveBackendAuthRes.error || '保存失败'
      return
    }
    baseUrlInput.value = normalized
    baseUrlDirty.value = false
    baseUrlError.value = ''
  } catch (err) {
    logger.error('保存 baseUrl 失败', err)
    baseUrlError.value = err instanceof Error ? err.message : String(err)
  } finally {
    baseUrlBusy.value = false
  }
}

const autoStartHydrating = ref(false)

const loadAutoStart = async () => {
  autoStartHydrating.value = true
  try {
    const res = await window.electronAPI.app.getAutoStart()
    if (res.success && res.data) {
      general.value.autoStart = Boolean((res.data as { enabled?: unknown }).enabled)
    }
  } catch (err) {
    logger.warn('加载开机自启动设置失败', err)
  } finally {
    Promise.resolve().then(() => {
      autoStartHydrating.value = false
    })
  }
}

// 处理关闭
const handleClose = () => {
  emit('close')
}

// 应用设置（不关闭）
const handleApply = async () => {
  // 根据当前激活的菜单保存对应的设置
  if (activeMenu.value === 'ai') {
    await saveAISettings()
  } else if (activeMenu.value === 'logs') {
    await saveLoggingSettings()
  } else if (activeMenu.value === 'backup') {
    await saveBackupSettings()
  } else if (activeMenu.value === 'shortcuts') {
    await saveShortcutSettings()
  } else if (activeMenu.value === 'general') {
    await saveBaseUrl()
    logger.info('应用常用设置', general.value)
  }
}

// 保存设置并关闭
const handleSaveAndClose = async () => {
  await handleApply()
  emit('close')
  visible.value = false
}

const loadAISettings = async () => {
  if (!aiStore.isInitialized) {
    await aiStore.initAISettings()
  }
  ai.value = aiStore.getAISettings()
}

const saveAISettings = async () => {
  const success = await aiStore.saveAISettings(ai.value)
  if (success) {
    ai.value = aiStore.getAISettings()
  }
}

const loadLoggingSettings = async () => {
  const res = await window.electronAPI.log.getSettings()
  if (res.success && res.data) {
    logging.value = normalizeLoggingSettings(res.data)
    return
  }
  logging.value = normalizeLoggingSettings()
}

const saveLoggingSettings = async () => {
  const res = await window.electronAPI.log.saveSettings(logging.value)
  if (res.success && res.data) {
    logging.value = normalizeLoggingSettings(res.data)
    return
  }
  logger.error('保存日志设置失败', res.error)
}

watch(visible, async (v) => {
  if (v) {
    try {
      if (!themeStore.isInitialized) {
        themeStore.initTheme()
      }
      general.value.theme = themeStore.themeMode
      general.value.primeVuePreset = themeStore.primeVuePreset
      general.value.fontSize = themeStore.fontSize
      general.value.primaryColor = themeStore.primaryColor
    } catch {}
    await Promise.all([
      loadAISettings(),
      loadLoggingSettings(),
      loadBaseUrl(),
      loadAutoStart(),
      loadBackupSettings(),
      refreshBackupList(),
      loadShortcutSettings(),
    ])
  } else {
    stopShortcutCapture()
  }
})

onUnmounted(() => {
  stopShortcutCapture()
})

watch(() => general.value.theme, (mode) => {
  if (!mode) return
  if (['light', 'dark', 'auto'].includes(mode)) {
    themeStore.setThemeMode(mode as 'light' | 'dark' | 'auto')
  }
})

watch(() => general.value.primeVuePreset, (preset) => {
  if (!preset) return
  themeStore.setPrimeVuePreset(preset as any)
})

watch(() => general.value.fontSize, (size) => {
  if (!size) return
  themeStore.setFontSize(size)
})

watch(() => general.value.primaryColor, (color) => {
  if (!color) return
  themeStore.setPrimaryColor(color)
})

watch(() => general.value.autoStart, async (enabled, prev) => {
  if (autoStartHydrating.value) return
  autoStartHydrating.value = true
  try {
    const res = await window.electronAPI.app.setAutoStart(Boolean(enabled))
    if (!res.success) {
      general.value.autoStart = Boolean(prev)
      alert(`设置开机自启动失败：${res.error || '未知错误'}`)
      return
    }
    if (res.data) {
      general.value.autoStart = Boolean((res.data as { enabled?: unknown }).enabled)
    }
  } catch (err) {
    general.value.autoStart = Boolean(prev)
    alert(`设置开机自启动失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    Promise.resolve().then(() => {
      autoStartHydrating.value = false
    })
  }
})
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--color-scrollbar-thumb);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-scrollbar-thumb-hover);
}
</style>
