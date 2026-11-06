<template>
  <div class="flex h-full w-full bg-content-bg text-content-text font-sans">
    <!-- Left Sidebar -->
    <div class="w-[220px] bg-sidebar-bg flex flex-col h-full shrink-0 border-r border-sidebar-divider">
      <div class="p-4 pt-6">
        <h2 class="text-base font-bold mb-4 px-2 text-sidebar-text">偏好设置</h2>
        <div class="px-2 mb-4">
          <IconField>
            <InputIcon class="pi pi-search text-sidebar-text-secondary" />
            <InputText placeholder="搜索..." class="w-full text-sm rounded-lg bg-input-bg border-input-border shadow-sm py-1.5" />
          </IconField>
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto px-3 pb-4">
        <div
          v-for="menu in menus"
          :key="menu.id"
          @click="activeMenu = menu.id"
          class="flex items-center px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-colors text-sm"
          :class="activeMenu === menu.id ? 'bg-sidebar-active-bg text-sidebar-text font-bold' : 'text-sidebar-text-secondary hover:bg-sidebar-hover hover:text-sidebar-text'"
        >
          <i :class="[menu.icon, 'mr-3 text-[15px] w-5 text-center']" :style="{ color: activeMenu === menu.id ? 'inherit' : 'var(--sidebar-text-secondary)' }"></i>
          <span>{{ menu.label }}</span>
        </div>
      </div>
    </div>

    <!-- Right Content Area -->
    <div class="flex-1 flex flex-col h-full bg-content-bg relative">
      <!-- Header -->
      <div class="h-[44px] flex items-center justify-between px-5 shrink-0 border-b border-content-divider">
        <h2 class="text-sm font-bold text-content-text">{{ currentMenuLabel }}</h2>
        <button class="text-content-text-muted hover:text-content-text transition-colors leading-none" @click="handleClose">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-6 bg-content-bg">
        <!-- 常用 (Common) 视图 -->
        <div v-if="activeMenu === 'common'" class="max-w-[700px]">
          <!-- 外观 -->
          <div class="mb-6">
            <h3 class=" text-content-text-muted mb-2 px-1">外观</h3>
            <div class="border border-content-border rounded-xl bg-content-card overflow-hidden">
              
              <!-- 主题行 -->
              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text">主题</span>
                <div class="flex gap-3 items-center">
                  <!-- Auto (Half black/half white) -->
                  <div 
                    @click="handleThemeChange('auto')"
                    class="w-[26px] h-[26px] rounded-full cursor-pointer relative overflow-hidden border transition-all"
                    :class="themeStore.themeMode === 'auto' ? 'border-btn-primary-bg ring-2 ring-btn-primary-bg/30 ring-offset-1' : 'border-content-border'"
                  >
                    <div class="absolute left-0 top-0 bottom-0 right-1/2 bg-black"></div>
                    <div class="absolute left-1/2 top-0 bottom-0 right-0 bg-white"></div>
                  </div>
                  <!-- Light -->
                  <div 
                    @click="handleThemeChange('light')"
                    class="w-[26px] h-[26px] rounded-full cursor-pointer bg-white border transition-all"
                    :class="themeStore.themeMode === 'light' ? 'border-btn-primary-bg ring-2 ring-btn-primary-bg/30 ring-offset-1' : 'border-content-border'"
                  ></div>
                  <!-- Dark -->
                  <div 
                    @click="handleThemeChange('dark')"
                    class="w-[26px] h-[26px] rounded-full cursor-pointer bg-[#343a40] border transition-all"
                    :class="themeStore.themeMode === 'dark' ? 'border-btn-primary-bg ring-2 ring-btn-primary-bg/30 ring-offset-1' : 'border-transparent'"
                  ></div>
                </div>
              </div>

              <!-- 字体大小行 -->
              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-16">字体大小</span>
                <div class="flex-1">
                  <Select 
                    v-model="themeStore.fontSize" 
                    :options="fontSizeOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    class="w-48 text-sm !bg-input-bg" 
                    @change="handleFontSizeChange"
                  />
                </div>
              </div>

              <!-- 主色调行 -->
              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-16">基础颜色</span>
                <div class="flex flex-wrap gap-2 flex-1 ml-4">
                  <div 
                    v-for="color in primaryColors" 
                    :key="color.value"
                    @click="themeStore.setPrimaryColor(color.value)"
                    class="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform flex items-center justify-center border border-content-border"
                    :style="{ backgroundColor: color.value }"
                    :title="color.label"
                  >
                    <i v-if="themeStore.primaryColor === color.value" class="pi pi-check text-white text-[10px]"></i>
                  </div>
                </div>
              </div>

              <!-- 启用透明效果 -->
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.transparent" :binary="true" inputId="transparent" />
                  <label for="transparent" class="text-sm text-content-text cursor-pointer select-none">启用透明效果</label>
                </div>
              </div>

              <!-- 在侧栏显示数量 -->
              <div class="flex items-center justify-between p-4 hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.showCount" :binary="true" inputId="showCount" />
                  <label for="showCount" class="text-sm text-content-text cursor-pointer select-none">在侧栏显示数量</label>
                </div>
              </div>
            </div>
          </div>

          <!-- 启动项 -->
          <div class="mb-6">
            <h3 class=" text-content-text-muted mb-2 px-1">启动项</h3>
            <div class="border border-content-border rounded-xl bg-content-card overflow-hidden">
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.autoStart" :binary="true" inputId="autoStart" />
                  <label for="autoStart" class="text-sm text-content-text cursor-pointer select-none">开机自动启动</label>
                </div>
              </div>
              <div class="flex items-center justify-between p-4 hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.gpuAcceleration" :binary="true" inputId="gpuAcceleration" />
                  <label for="gpuAcceleration" class="text-sm text-content-text cursor-pointer select-none">启用 GPU 硬件加速 (可能会占用较多内存)</label>
                </div>
              </div>
            </div>
          </div>

          <!-- 收藏设置 -->
          <div class="mb-6">
            <h3 class=" text-content-text-muted mb-2 px-1">收藏设置</h3>
            <div class="border border-content-border rounded-xl bg-content-card overflow-hidden">
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.autoSelect" :binary="true" inputId="autoSelect" />
                  <label for="autoSelect" class="text-sm text-content-text cursor-pointer select-none">自动选择添加的新项目</label>
                </div>
              </div>
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.duplicateNotify" :binary="true" inputId="duplicateNotify" />
                  <label for="duplicateNotify" class="text-sm text-content-text cursor-pointer select-none">添加重复文件，弹出通知</label>
                </div>
              </div>
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.browserExt" :binary="true" inputId="browserExt" />
                  <label for="browserExt" class="text-sm text-content-text cursor-pointer select-none">浏览器扩展添加图片时，弹出分类窗口</label>
                </div>
              </div>
              <div class="flex items-center justify-between p-4 hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="mockSettings.retina" :binary="true" inputId="retina" />
                  <label for="retina" class="text-sm text-content-text cursor-pointer select-none">使用 Retina 品质截图 (需为 Retina 屏幕设备)</label>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <h3 class=" text-content-text-muted mb-2 px-1">数据备份</h3>
            <div class="border border-content-border rounded-xl bg-content-card overflow-hidden">
              <div class="flex items-center justify-between p-4 border-b border-content-divider hover:bg-content-card-hover transition-colors">
                <div class="flex items-center gap-3">
                  <Checkbox v-model="backupSettings.enabled" :binary="true" inputId="backupEnabled" @change="saveBackupSettings" />
                  <label for="backupEnabled" class="text-sm text-content-text cursor-pointer select-none">启用自动备份</label>
                </div>
              </div>

              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-16">备份目录</span>
                <div class="flex items-center gap-2 flex-1 justify-end">
                  <span class=" text-content-text-secondary truncate max-w-[360px]" :title="backupDirText">{{ backupDirText }}</span>
                  <Button
                    label="选择"
                    class="text-sm py-1.5 px-3 rounded-lg bg-content-bg border border-content-border hover:bg-content-card-hover"
                    @click="selectBackupDir"
                  />
                  <Button
                    v-if="backupSettings.directoryMode === 'custom'"
                    label="恢复默认"
                    class="text-sm py-1.5 px-3 rounded-lg bg-content-bg border border-content-border hover:bg-content-card-hover"
                    @click="resetBackupDir"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-28">备份间隔(小时)</span>
                <div class="flex items-center gap-2">
                  <InputText v-model.number="backupSettings.intervalHours" type="number" class="w-28 text-sm !bg-input-bg" @blur="saveBackupSettings" />
                </div>
              </div>

              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-28">最多保留(份)</span>
                <div class="flex items-center gap-2">
                  <InputText v-model.number="backupSettings.keepLastN" type="number" class="w-28 text-sm !bg-input-bg" @blur="saveBackupSettings" />
                </div>
              </div>

              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-28">最近备份</span>
                <div class="flex-1 text-right  text-content-text-secondary">
                  <span v-if="backupSettings.lastBackupAt">{{ formatDateTime(backupSettings.lastBackupAt) }}</span>
                  <span v-else>无</span>
                  <span v-if="backupSettings.lastBackupOk === false" class="ml-2 text-red-500">{{ backupSettings.lastBackupMessage || '失败' }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between p-4 border-b border-content-divider">
                <span class="text-sm text-content-text w-28">最近文件</span>
                <div class="flex-1 text-right  text-content-text-secondary truncate" :title="backupSettings.lastBackupPath || ''">
                  <span v-if="backupSettings.lastBackupPath">{{ backupSettings.lastBackupPath }}</span>
                  <span v-else>无</span>
                </div>
              </div>

              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-2">
                  <Button
                    label="立即备份"
                    class="bg-btn-primary-bg border-btn-primary-bg hover:bg-btn-primary-hover text-sm py-2 px-4 rounded-lg text-white"
                    :loading="backupBusy"
                    @click="runBackupNow"
                  />
                  <Button
                    label="从备份恢复"
                    class="text-sm py-2 px-4 rounded-lg bg-content-bg border border-content-border hover:bg-content-card-hover"
                    :disabled="backupBusy"
                    @click="restoreFromBackup"
                  />
                </div>
                <Button
                  label="刷新列表"
                  class="text-sm py-2 px-4 rounded-lg bg-content-bg border border-content-border hover:bg-content-card-hover"
                  :disabled="backupBusy"
                  @click="refreshBackupList"
                />
              </div>

              <div v-if="backupList.length > 0" class="px-4 pb-4">
                <div class=" text-content-text-muted mb-2">最近备份文件</div>
                <div class="space-y-1">
                  <div v-for="item in backupList.slice(0, 5)" :key="item.path" class=" text-content-text-secondary truncate" :title="item.path">
                    {{ formatDateTime(item.mtimeMs) }} · {{ item.path }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 开发者选项 (Developer) - 原有配置管理表格 -->
        <div v-else-if="activeMenu === 'developer'" class="max-w-[800px]">
          <div class="mb-6">
            <h3 class=" text-content-text-muted mb-2 px-1">业务缓存重置</h3>
            <div class="border border-content-border rounded-xl bg-content-card p-4 mb-4">
              <div class="text-[13px] text-content-text-secondary leading-relaxed mb-3">
                清除渲染进程中用于业务数据回退读取的本地缓存（如字典分组与项目管理缓存），然后重新加载当前窗口。
              </div>
              <Button
                label="清除缓存并重新加载"
                icon="pi pi-refresh"
                size="small"
                severity="warning"
                :loading="isResettingBusinessCache"
                :disabled="isResettingBusinessCache"
                @click="handleResetBusinessCache"
              />
            </div>

            <h3 class=" text-content-text-muted mb-2 px-1">配置设置管理</h3>
            <div class="border border-content-border rounded-xl bg-content-card p-4">
              <!-- 搜索框和新增按钮 -->
              <div class="mb-4 flex gap-2">
                <IconField class="flex-grow">
                  <InputIcon class="pi pi-search text-content-text-muted" />
                  <InputText
                    v-model="searchTerm"
                    placeholder="搜索配置..."
                    class="w-full text-sm py-2 rounded-lg bg-input-bg border-input-border"
                    @input="handleSearch"
                  />
                </IconField>
                <Button
                  label="新增配置"
                  icon="pi pi-plus"
                  @click="showAddModal = true"
                  class="bg-btn-primary-bg border-btn-primary-bg hover:bg-btn-primary-hover text-sm py-2 px-4 rounded-lg text-white"
                />
              </div>

              <!-- 配置列表表格 -->
              <DataTable
                :value="filteredSettings"
                :paginator="filteredSettings.length > 10"
                :rows="10"
                :rowsPerPageOptions="[5, 10, 20]"
                tableStyle="min-width: 50rem"
                :loading="loading"
                stripedRows
                class="text-sm"
              >
                <Column field="key" header="Key" sortable></Column>
                <Column field="value" header="Value" sortable></Column>
                <Column field="description" header="Description" sortable></Column>
                <Column header="操作" :exportable="false" style="min-width: 8rem">
                  <template #body="slotProps">
                    <div class="flex gap-2">
                      <Button
                        icon="pi pi-pencil"
                        aria-label="编辑"
                        severity="secondary"
                        rounded
                        text
                        @click="editSetting(slotProps.data)"
                        v-tooltip.top="'编辑'"
                      />
                      <Button
                        icon="pi pi-trash"
                        aria-label="删除"
                        severity="danger"
                        rounded
                        text
                        @click="confirmDelete(slotProps.data)"
                        v-tooltip.top="'删除'"
                      />
                    </div>
                  </template>
                </Column>
                <template #empty>
                  <div class="text-center p-4 text-content-text-muted text-sm">暂无配置数据</div>
                </template>
              </DataTable>
            </div>
          </div>
        </div>

        <!-- AI 配置 -->
        <AISettingsSection
          v-else-if="activeMenu === 'ai'"
          v-model:settings="aiSettings"
          class="max-w-[800px]"
        />

        <!-- 其他菜单暂未实现 -->
        <div v-else class="flex items-center justify-center h-[400px] text-content-text-muted">
          <div class="text-center">
            <i :class="[menus.find(m => m.id === activeMenu)?.icon, 'text-4xl mb-3 opacity-50']"></i>
            <p class="text-sm">{{ currentMenuLabel }}功能开发中...</p>
          </div>
        </div>
      </div>

      <!-- Footer Action Bar -->
      <div class="h-[60px] shrink-0 border-t border-content-divider flex items-center justify-end px-6 gap-3 bg-content-card">
        <Button label="应用" severity="secondary" outlined class="text-sm px-6 py-2 border-content-border text-content-text hover:bg-content-card-hover rounded-lg" />
        <Button label="保存设置" @click="saveAllSettings" class="text-sm px-6 py-2 bg-btn-primary-bg border-btn-primary-bg hover:bg-btn-primary-hover text-white rounded-lg" />
      </div>
    </div>

    <!-- 模态框保持原有逻辑但更新样式 -->
    <Dialog
      v-model:visible="showAddModal"
      modal
      header="新增配置"
      :style="{ width: '25rem' }"
      :closable="true"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Key</label>
          <InputText v-model="formData.key" class="w-full text-sm rounded-lg bg-input-bg border-input-border" placeholder="配置键名" />
        </div>
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Value</label>
          <InputText v-model="formData.value" class="w-full text-sm rounded-lg bg-input-bg border-input-border" placeholder="配置值" />
        </div>
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Description</label>
          <Textarea v-model="formData.description" class="w-full text-sm rounded-lg bg-input-bg border-input-border" placeholder="配置描述" rows="3" autoResize />
        </div>
      </div>
      <template #footer>
        <Button label="取消" severity="secondary" outlined @click="closeModal" class="text-sm px-4 py-2 rounded-lg" />
        <Button label="保存" @click="saveSetting" class="text-sm px-4 py-2 bg-btn-primary-bg border-btn-primary-bg hover:bg-btn-primary-hover text-white rounded-lg" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showEditModal"
      modal
      header="编辑配置"
      :style="{ width: '25rem' }"
      :closable="true"
    >
      <div class="flex flex-col gap-4 pt-2">
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Key</label>
          <InputText v-model="formData.key" disabled class="w-full text-sm rounded-lg bg-input-bg border-input-border opacity-60" placeholder="配置键名" />
        </div>
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Value</label>
          <InputText v-model="formData.value" class="w-full text-sm rounded-lg bg-input-bg border-input-border" placeholder="配置值" />
        </div>
        <div>
          <label class="block text-sm font-bold mb-2 text-content-text">Description</label>
          <Textarea v-model="formData.description" class="w-full text-sm rounded-lg bg-input-bg border-input-border" placeholder="配置描述" rows="3" autoResize />
        </div>
      </div>
      <template #footer>
        <Button label="取消" severity="secondary" outlined @click="closeModal" class="text-sm px-4 py-2 rounded-lg" />
        <Button label="保存" @click="saveSetting" class="text-sm px-4 py-2 bg-btn-primary-bg border-btn-primary-bg hover:bg-btn-primary-hover text-white rounded-lg" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showDeleteModal"
      modal
      header="确认删除"
      :style="{ width: '20rem' }"
      :closable="true"
    >
      <div class="flex items-center gap-3 pt-2">
        <i class="pi pi-exclamation-triangle text-xl text-red-500"></i>
        <span class="text-content-text text-sm">
          确定要删除配置 <strong>{{ settingToDelete?.key }}</strong> 吗？
        </span>
      </div>
      <template #footer>
        <Button label="取消" severity="secondary" outlined @click="showDeleteModal = false" class="text-sm px-4 py-2 rounded-lg" />
        <Button label="删除" severity="danger" @click="deleteSetting" class="text-sm px-4 py-2 rounded-lg" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '../../stores/ui/themeStore'
import { useAIStore } from '../../stores/system/aiStore'
import { createRendererLogger } from '@/utils/logger'
import { useToast } from 'primevue/usetoast'
import { clearBusinessBrowserCache } from '../../utils/businessCacheReset'

const logger = createRendererLogger('SettingsView')
const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const emit = defineEmits<{ (e: 'close'): void }>()
const router = useRouter()
const toast = useToast()

// PrimeVue 组件
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import type { Setting } from '@shared/types/database.types'
import type { BackupInfo, BackupSettings } from '@shared/types/backup.types'
import type { AISettings } from '../../../shared/types/ai.types'
import { normalizeAISettings } from '../../../shared/utils/ai'
import AISettingsSection from '../../components/settings/AISettingsSection.vue'

// 使用主题 Store
const themeStore = useThemeStore()

const handleClose = () => {
  if (props.embedded) {
    emit('close')
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/resource')
}

// 菜单数据
const menus = [
  { id: 'common', label: '常用', icon: 'pi pi-cog' },
  { id: 'ai', label: 'AI 配置', icon: 'pi pi-sparkles' },
  { id: 'leftPanel', label: '左栏', icon: 'pi pi-align-left' },
  { id: 'control', label: '操控', icon: 'pi pi-sliders-h' },
  { id: 'viewing', label: '看图习惯', icon: 'pi pi-eye' },
  { id: 'screenshot', label: '截图', icon: 'pi pi-camera' },
  { id: 'shortcuts', label: '快捷键', icon: 'pi pi-th-large' },
  { id: 'notifications', label: '通知', icon: 'pi pi-bell' },
  { id: 'autoImport', label: '自动导入', icon: 'pi pi-download' },
  { id: 'developer', label: '开发者/缓存', icon: 'pi pi-code' }
]

const activeMenu = ref('common')
const currentMenuLabel = computed(() => {
  return menus.find(m => m.id === activeMenu.value)?.label || ''
})

const isResettingBusinessCache = ref(false)

async function handleResetBusinessCache() {
  if (isResettingBusinessCache.value) return
  const confirmed = window.confirm('该操作将清除业务缓存并立即重新加载窗口，是否继续？')
  if (!confirmed) return

  isResettingBusinessCache.value = true
  try {
    clearBusinessBrowserCache()
    toast.add({
      severity: 'success',
      summary: '业务缓存已清理',
      detail: '窗口将立即重新加载',
      life: 1200,
    })
    setTimeout(() => {
      window.location.reload()
    }, 200)
  } catch (error) {
    logger.error('清理业务缓存失败', error)
    toast.add({
      severity: 'error',
      summary: '清理失败',
      detail: error instanceof Error ? error.message : String(error),
      life: 4000,
    })
    isResettingBusinessCache.value = false
  }
}

const fontSizeOptions = [
  { label: '小 (12px)', value: '12px' },
  { label: '较小 (13px)', value: '13px' },
  { label: '标准 (14px)', value: '14px' },
  { label: '较大 (15px)', value: '15px' },
  { label: '大 (16px)', value: '16px' }
]

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

// 模拟设置数据 (用于展示复选框状态)
const mockSettings = ref({
  transparent: true,
  showCount: true,
  autoStart: false,
  gpuAcceleration: true,
  autoSelect: true,
  duplicateNotify: true,
  browserExt: false,
  retina: true
})

const autoStartHydrating = ref(false)

const loadAutoStart = async () => {
  autoStartHydrating.value = true
  try {
    const res = await window.electronAPI.app.getAutoStart()
    if (res.success && res.data) {
      mockSettings.value.autoStart = Boolean((res.data as { enabled?: unknown }).enabled)
    }
  } catch (err) {
    logger.warn('加载开机自启动设置失败', err)
  } finally {
    Promise.resolve().then(() => {
      autoStartHydrating.value = false
    })
  }
}

const backupSettings = ref<BackupSettings>({
  enabled: false,
  directoryMode: 'library',
  intervalHours: 24,
  keepLastN: 10,
})
const backupList = ref<BackupInfo[]>([])
const backupBusy = ref(false)
const unsubscribeConfig = ref<null | (() => void)>(null)

const baseUrlInput = ref('')
const baseUrlError = ref('')
const baseUrlBusy = ref(false)
const baseUrlDirty = ref(false)

const backupDirText = computed(() => {
  if (backupSettings.value.directoryMode === 'custom' && backupSettings.value.customDir) {
    return backupSettings.value.customDir
  }
  return '资源库/backups'
})

// AI 设置数据
const aiStore = useAIStore()
const aiSettings = ref<AISettings>(normalizeAISettings({}))
// 响应式数据 - 开发者选项 (原有配置)
const searchTerm = ref('')
const settings = ref<Setting[]>([])
const filteredSettings = ref<Setting[]>([])
const loading = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const formData = ref({
  key: '',
  value: '',
  description: ''
})
const settingToDelete = ref<any>(null)

// 方法
const handleThemeChange = (mode: 'light' | 'dark' | 'auto') => {
  themeStore.setThemeMode(mode)
}

const handleFontSizeChange = (event: any) => {
  if (event.value) {
    themeStore.setFontSize(event.value)
  }
}

const loadSettings = async () => {
  try {
    loading.value = true
    const res = await window.electronAPI.db.getAllSettings()
    if (res.success && res.data) {
      settings.value = res.data
      filteredSettings.value = res.data

      // 确保 AI 配置已初始化
      if (!aiStore.isInitialized) {
        await aiStore.initAISettings()
      }

      aiSettings.value = aiStore.getAISettings()
    } 
  } catch (error) {
    logger.error('加载配置失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  if (searchTerm.value.trim() === '') {
    filteredSettings.value = settings.value
  } else {
    filteredSettings.value = settings.value.filter((setting: Setting) =>
      setting.key.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      setting.description.toLowerCase().includes(searchTerm.value.toLowerCase())
    )
  }
}

const editSetting = (setting: any) => {
  formData.value = { ...setting }
  showEditModal.value = true
}

const confirmDelete = (setting: any) => {
  settingToDelete.value = setting
  showDeleteModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  formData.value = { key: '', value: '', description: '' }
}

const saveSetting = async () => {
  try {
    let success = false
    if (showAddModal.value) {
      const res = await window.electronAPI.db.insertSetting(
        formData.value.key,
        formData.value.value,
        formData.value.description
      )
      success = res.success
    } else {
      const res = await window.electronAPI.db.updateSetting(
        formData.value.key,
        formData.value.value,
        formData.value.description
      )
      success = res.success
    }

    if (success) {
      await loadSettings()
      closeModal()
    } else {
      alert('保存失败，请检查 Key 是否重复')
    }
  } catch (error) {
    logger.error('保存配置失败:', error)
    alert('保存失败：' + (error as Error).message)
  }
}

const deleteSetting = async () => {
  try {
    const res = await window.electronAPI.db.deleteSetting(settingToDelete.value.key)
    const success = res.success
    if (success) {
      await loadSettings()
      showDeleteModal.value = false
      settingToDelete.value = null
    } else {
      alert('删除失败')
    }
  } catch (error) {
    logger.error('删除配置失败:', error)
    alert('删除失败：' + (error as Error).message)
  }
}

const saveSettingItem = async (key: string, value: string, description: string) => {
  const existing = await window.electronAPI.db.getSetting(key);
  if (existing.success && existing.data) {
    await window.electronAPI.db.updateSetting(key, value, description);
  } else {
    await window.electronAPI.db.insertSetting(key, value, description);
  }
}

const saveAllSettings = async () => {
  if (activeMenu.value === 'ai') {
    try {
      await aiStore.saveAISettings(aiSettings.value)
      alert('AI 设置保存成功')
      await loadSettings()
    } catch (error) {
      logger.error('保存AI配置失败:', error)
      alert('保存AI配置失败：' + (error as Error).message)
    }
  } else {
    alert('该页面的设置保存功能开发中...')
  }
}

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

const normalizeBaseUrlLocal = (raw: unknown): { normalized: string; error: string } => {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return { normalized: '', error: '' }
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return { normalized: s, error: '请输入合法的 URL（需包含 http:// 或 https://）' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { normalized: s, error: '仅支持 http:// 或 https://' }
  }
  const pathname = url.pathname.replace(/\/+$/, '')
  const normalized = `${url.origin}${pathname === '/' ? '' : pathname}${url.search}`.replace(/\/+$/, '')
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
      if (!res.success) return
      const backendAuth = (res.data && typeof res.data === 'object') ? (res.data as any) : {}
    baseUrlInput.value = typeof backendAuth.baseUrl === 'string' ? backendAuth.baseUrl : ''
    }
    baseUrlDirty.value = false
    baseUrlError.value = ''
  } catch (error) {
    logger.error('加载 baseUrl 失败:', error)
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
      baseUrl: normalized,
    })
    if (!saveBackendAuthRes.success) {
      baseUrlError.value = saveBackendAuthRes.error || '保存失败'
      return
    }
    baseUrlInput.value = normalized
    baseUrlDirty.value = false
    baseUrlError.value = ''
  } catch (error) {
    logger.error('保存 baseUrl 失败:', error)
    baseUrlError.value = (error as Error).message
  } finally {
    baseUrlBusy.value = false
  }
}

const loadBackupSettings = async () => {
  try {
    const res = await window.electronAPI.config.getItem('backupSettings')
    if (res.success) {
      backupSettings.value = normalizeBackupSettingsLocal(res.data)
    }
  } catch (error) {
    logger.error('加载备份设置失败:', error)
  }
}

const saveBackupSettings = async () => {
  try {
    const payload: any = { ...backupSettings.value }
    if (payload.directoryMode !== 'custom') {
      delete payload.customDir
    }
    const res = await window.electronAPI.config.updateItem('backupSettings', payload)
    if (!res.success) {
      alert('保存备份设置失败：' + (res.error || '未知错误'))
    }
  } catch (error) {
    logger.error('保存备份设置失败:', error)
    alert('保存备份设置失败：' + (error as Error).message)
  }
}

const refreshBackupList = async () => {
  try {
    const res = await window.electronAPI.backup.list()
    if (res.success && res.data) {
      backupList.value = res.data
    }
  } catch (error) {
    logger.error('刷新备份列表失败:', error)
  }
}

const selectBackupDir = async () => {
  try {
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
  } catch (error) {
    logger.error('选择备份目录失败:', error)
  }
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
    if (res.success && res.data) {
      await loadBackupSettings()
      await refreshBackupList()
      alert('备份成功：' + res.data.backupPath)
    } else {
      alert('备份失败：' + (res.error || '未知错误'))
    }
  } catch (error) {
    logger.error('立即备份失败:', error)
    alert('备份失败：' + (error as Error).message)
  } finally {
    backupBusy.value = false
  }
}

const restoreFromBackup = async () => {
  if (backupBusy.value) return
  try {
    const selected = await window.electronAPI.fs.selectFile({
      title: '选择备份文件',
      properties: ['openFile'],
      filters: [{ name: 'SQLite 备份', extensions: ['db'] }],
    })
    if (!selected.success || !selected.data || selected.data.canceled) return
    const p = selected.data.filePaths?.[0]
    if (!p) return

    const confirmed = confirm('恢复会覆盖当前数据库数据，建议先确认已备份。是否继续？')
    if (!confirmed) return

    backupBusy.value = true
    const res = await window.electronAPI.backup.restore(p)
    if (!res.success) {
      alert('恢复失败：' + (res.error || '未知错误'))
      return
    }
    alert('恢复已执行，应用将重新加载。')
  } catch (error) {
    logger.error('从备份恢复失败:', error)
    alert('恢复失败：' + (error as Error).message)
  } finally {
    backupBusy.value = false
  }
}

const formatDateTime = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

watch(() => mockSettings.value.autoStart, async (enabled, prev) => {
  if (autoStartHydrating.value) return
  autoStartHydrating.value = true
  try {
    const res = await window.electronAPI.app.setAutoStart(Boolean(enabled))
    if (!res.success) {
      mockSettings.value.autoStart = Boolean(prev)
      alert(`设置开机自启动失败：${res.error || '未知错误'}`)
      return
    }
    if (res.data) {
      mockSettings.value.autoStart = Boolean((res.data as { enabled?: unknown }).enabled)
    }
  } catch (err) {
    mockSettings.value.autoStart = Boolean(prev)
    alert(`设置开机自启动失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    Promise.resolve().then(() => {
      autoStartHydrating.value = false
    })
  }
})

// 生命周期
onMounted(async () => {
  await loadSettings()
  await loadBackupSettings()
  await loadBaseUrl()
  await loadAutoStart()
  await refreshBackupList()
  unsubscribeConfig.value = window.electronAPI.config.onChanged((cfg) => {
    backupSettings.value = normalizeBackupSettingsLocal((cfg as any).backupSettings)
    if (!baseUrlDirty.value) {
      const backendAuth = ((cfg as any).backendAuth && typeof (cfg as any).backendAuth === 'object')
        ? (cfg as any).backendAuth
        : {}
      baseUrlInput.value = typeof backendAuth.baseUrl === 'string' ? backendAuth.baseUrl : ''
    }
  })
})

onUnmounted(() => {
  try {
    unsubscribeConfig.value?.()
  } catch {}
})
</script>

<style scoped>
/* 隐藏主滚动条，但内容可滚动 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
</style>
