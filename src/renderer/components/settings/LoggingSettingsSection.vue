<template>
  <div class="space-y-6">
    <div>
      <div class="mb-2 flex items-center justify-between px-1">
        <h3 class="text-xs text-content-text-muted">日志级别</h3>
        <Button label="打开日志文件夹" size="small" severity="secondary" outlined :loading="isOpening" @click="openLogFolder" />
      </div>
      <div class="flex flex-col gap-4 rounded-xl border border-content-border bg-content-card overflow-hidden p-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm text-content-text">最小输出级别</label>
            <Select
              :modelValue="normalizedSettings.level"
              :options="levelOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
              @update:modelValue="value => updateField('level', value as LoggingSettings['level'])"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm text-content-text">保留天数</label>
            <InputNumber
              :modelValue="normalizedSettings.retentionDays"
              :min="1"
              :max="365"
              :step="1"
              class="w-full"
              @update:modelValue="value => updateField('retentionDays', Number(value || 14))"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm text-content-text">单文件大小上限（MB）</label>
            <InputNumber
              :modelValue="normalizedSettings.maxSizeMb"
              :min="1"
              :max="1024"
              :step="1"
              class="w-full"
              @update:modelValue="value => updateField('maxSizeMb', Number(value || 20))"
            />
          </div>
          <div class="flex items-end">
            <div class="flex items-center gap-3">
              <Checkbox
                :modelValue="normalizedSettings.consoleEnabled"
                :binary="true"
                inputId="loggingConsoleEnabled"
                @update:modelValue="value => updateField('consoleEnabled', Boolean(value))"
              />
              <label for="loggingConsoleEnabled" class="cursor-pointer select-none text-sm text-content-text">同时输出到控制台</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <h3 class="mb-2 px-1 text-xs text-content-text-muted">输出格式</h3>
      <div class="rounded-xl border border-content-border bg-content-card overflow-hidden p-4">
        <label class="mb-2 block text-sm text-content-text">日志格式模板</label>
        <InputText
          :modelValue="normalizedSettings.pattern"
          class="w-full"
          placeholder="[{timestamp}] [{level}] [{process}] [{module}] {message}"
          @update:modelValue="value => updateField('pattern', String(value || ''))"
        />
        <div class="mt-3 rounded-lg bg-content-bg border border-content-divider px-3 py-2 text-xs leading-6 text-content-text-muted">
          可用占位符：{timestamp}、{level}、{process}、{module}、{message}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LoggingSettings } from '../../../shared/types/log.types'
import { normalizeLoggingSettings } from '../../../shared/utils/log'
import { createRendererLogger } from '../../utils/logger'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const props = defineProps<{ settings: LoggingSettings }>()
const emit = defineEmits<{ (e: 'update:settings', value: LoggingSettings): void }>()

const levelOptions = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
]

const normalizedSettings = computed(() => normalizeLoggingSettings(props.settings))
const logger = createRendererLogger('LoggingSettingsSection')
const isOpening = ref(false)

async function openLogFolder() {
  if (isOpening.value) return
  isOpening.value = true
  try {
    const res = await window.electronAPI.log.openFolder()
    if (!res.success) {
      logger.error('打开日志文件夹失败', res.error)
    }
  } catch (error) {
    logger.error('打开日志文件夹失败', error)
  } finally {
    isOpening.value = false
  }
}

function updateField<K extends keyof LoggingSettings>(key: K, value: LoggingSettings[K]) {
  emit('update:settings', normalizeLoggingSettings({
    ...normalizedSettings.value,
    [key]: value,
  }))
}
</script>
