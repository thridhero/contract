<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    header="发现重复文件"
    :style="{ width: '720px' }"
    :closable="false"
    :draggable="false"
    class="theme-dialog"
  >
    <div v-if="current" class="flex flex-col gap-4 pt-1">
      <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-4 py-3">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-medium text-[var(--content-text)] truncate" :title="displayName">
              {{ displayName }}
            </div>
            <div class="mt-1 text-xs text-[var(--content-text-secondary)]">
              {{ reasonText }}
            </div>
          </div>
          <div class="text-xs text-[var(--content-text-secondary)] whitespace-nowrap">
            task {{ current.taskId }}
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-2">
          <div class="text-xs text-[var(--content-text-secondary)]">
            源：<span class="text-[var(--content-text)] break-all">{{ current.srcPath }}</span>
          </div>
          <div class="text-xs text-[var(--content-text-secondary)]">
            目标：<span class="text-[var(--content-text)] break-all">{{ current.destPath }}</span>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="text-xs text-[var(--content-text-secondary)]">
            源大小：<span class="text-[var(--content-text)]">{{ formatBytes(current.srcSize) }}</span>
          </div>
          <div class="text-xs text-[var(--content-text-secondary)]">
            目标大小：<span class="text-[var(--content-text)]">{{ formatBytes(current.destSize) }}</span>
          </div>
        </div>

        <div v-if="hasAnyHash" class="mt-3 grid grid-cols-1 gap-2">
          <div v-if="current.srcHashes?.sha256 || current.destHashes?.sha256" class="text-xs text-[var(--content-text-secondary)]">
            SHA256：
            <div class="mt-1 grid grid-cols-1 gap-1">
              <div class="break-all">源 {{ current.srcHashes?.sha256 || '-' }}</div>
              <div class="break-all">目标 {{ current.destHashes?.sha256 || '-' }}</div>
            </div>
          </div>
          <div v-if="current.srcHashes?.md5 || current.destHashes?.md5" class="text-xs text-[var(--content-text-secondary)]">
            MD5：
            <div class="mt-1 grid grid-cols-1 gap-1">
              <div class="break-all">源 {{ current.srcHashes?.md5 || '-' }}</div>
              <div class="break-all">目标 {{ current.destHashes?.md5 || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)] px-4 py-3">
        <div class="text-sm font-medium text-[var(--content-text)]">处理方式</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <Button
            label="替换"
            :outlined="selectedAction !== 'replace'"
            :severity="selectedAction === 'replace' ? 'primary' : 'secondary'"
            class="w-full justify-center"
            @click="setAction('replace')"
          />
          <Button
            label="跳过"
            :outlined="selectedAction !== 'skip'"
            :severity="selectedAction === 'skip' ? 'primary' : 'secondary'"
            class="w-full justify-center"
            @click="setAction('skip')"
          />
          <Button
            label="重命名"
            :outlined="selectedAction !== 'rename'"
            :severity="selectedAction === 'rename' ? 'primary' : 'secondary'"
            class="w-full justify-center"
            @click="setAction('rename')"
          />
          <Button
            label="保留两者"
            :outlined="selectedAction !== 'keep-both'"
            :severity="selectedAction === 'keep-both' ? 'primary' : 'secondary'"
            class="w-full justify-center"
            @click="setAction('keep-both')"
          />
        </div>

        <div v-if="selectedAction === 'rename' || selectedAction === 'keep-both'" class="mt-3 flex flex-col gap-1">
          <label class="text-xs text-[var(--content-text-secondary)]">新文件名</label>
          <InputText
            v-model="newName"
            class="w-full"
            placeholder="请输入新文件名（不含路径）"
            @keydown.enter.prevent="handleSubmit"
          />
          <div class="text-xs text-[var(--content-text-secondary)]">
            仅修改文件名，不包含目录；若仍冲突会自动追加序号。
          </div>
        </div>

        <div v-if="submitError" class="mt-3 text-xs text-[var(--red-500)]">
          {{ submitError }}
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        label="确定并继续"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useFileCopyConflictStore, type FileCopyConflictAction } from '../stores/file/fileCopyConflictStore'

const store = useFileCopyConflictStore()

onMounted(() => {
  store.ensureSubscribed()
})

const visibleProxy = computed({
  get: () => store.visible,
  set: () => {},
})

const current = computed(() => store.current)
const reasonText = computed(() => store.reasonText)
const selectedAction = computed(() => store.selectedAction)
const newName = computed({
  get: () => store.newName,
  set: (v: string) => (store.newName = v),
})
const submitError = computed(() => store.submitError)
const submitting = computed(() => store.submitting)
const canSubmit = computed(() => store.canSubmit)

const displayName = computed(() => {
  const c = store.current
  const n = c?.file?.relativePath || c?.file?.name || ''
  return String(n || '').trim() || '文件'
})

const hasAnyHash = computed(() => {
  const c = store.current
  return Boolean(c?.srcHashes?.md5 || c?.srcHashes?.sha256 || c?.destHashes?.md5 || c?.destHashes?.sha256)
})

const setAction = (a: FileCopyConflictAction) => store.setAction(a)

const handleSubmit = async () => {
  await store.submit()
}

const formatBytes = (n?: number) => {
  const bytes = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (bytes <= 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const v = bytes / Math.pow(k, i)
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${sizes[i]}`
}
</script>

