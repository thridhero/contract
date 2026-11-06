<template>
  <div class="h-full flex flex-col" :style="{ backgroundColor: 'var(--content-bg)' }">
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        <section
          class="rounded-2xl border p-5 flex flex-col gap-3"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1">
              <h1 class="text-xl font-semibold m-0" :style="{ color: 'var(--content-text)' }">意见反馈</h1>
              <p class="text-sm m-0" :style="{ color: 'var(--content-text-secondary)' }">
                提交功能建议、使用问题或异常现象。
              </p>
            </div>

          </div>
        </section>

        <section
          class="rounded-2xl border p-5 flex flex-col gap-5"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
        >
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
              标题
            </label>
            <InputText
              v-model.trim="form.title"
              placeholder="请简要概括问题或建议"
              :maxlength="120"
            />
            <small :style="{ color: 'var(--content-text-secondary)' }">
              {{ form.title.length }}/120
            </small>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-3">
              <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">反馈内容</label>
              <div class="flex items-center gap-2">
                <small :style="{ color: 'var(--content-text-secondary)' }">支持富文本描述、分点说明与图片插入</small>
                <Button
                  label="插入图片"
                  icon="pi pi-image"
                  severity="secondary"
                  size="small"
                  :loading="editorImageUploading"
                  :disabled="submitting || editorImageUploading"
                  @click="openEditorImagePicker"
                />
              </div>
            </div>
            <Editor
              ref="editorRef"
              v-model="form.opinion"
              editorStyle="height: 280px"
            />
            <small :style="{ color: 'var(--content-text-secondary)' }">
              纯文本字数：{{ opinionTextLength }}
            </small>
            <input
              ref="editorImageInputRef"
              type="file"
              class="hidden"
              accept="image/*"
              multiple
              @change="handleEditorImageInput"
            />
          </div>
        </section>

        <section
          class="rounded-2xl border p-5 flex flex-col gap-4"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--sidebar-bg)' }"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">普通文件附件</div>
              <div class="text-xs mt-1" :style="{ color: 'var(--content-text-secondary)' }">
                可附加日志、文档、压缩包、导出文件等辅助材料。
              </div>
            </div>
            <Button label="选择附件" icon="pi pi-paperclip" severity="secondary" @click="openAttachmentPicker" />
          </div>

          <div
            class="rounded-xl border p-3 flex flex-col gap-2"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div v-if="attachments.length === 0" class="text-sm py-3" :style="{ color: 'var(--content-text-secondary)' }">
              暂无普通附件。
            </div>
            <div
              v-for="item in attachments"
              :key="item.id"
              class="rounded-lg border px-3 py-2 flex items-center justify-between gap-3"
              :style="{ borderColor: 'var(--content-border)' }"
            >
              <div class="min-w-0 flex items-center gap-3">
                <i class="pi pi-file" :style="{ color: 'var(--primary-color)' }"></i>
                <div class="min-w-0">
                  <div class="text-sm truncate" :title="item.file.name" :style="{ color: 'var(--content-text)' }">
                    {{ item.file.name }}
                  </div>
                  <div class="text-xs" :style="{ color: 'var(--content-text-secondary)' }">
                    {{ formatFileSize(item.file.size) }}
                  </div>
                </div>
              </div>
              <Button
                label="移除"
                icon="pi pi-times"
                severity="danger"
                variant="text"
                size="small"
                @click="removeAttachment(item.id)"
              />
            </div>
          </div>

          <input
            ref="attachmentInputRef"
            type="file"
            class="hidden"
            multiple
            @change="handleAttachmentFileInput"
          />
        </section>
      </div>
    </div>

    <div
      class="shrink-0 border-t px-6 py-3 flex items-center justify-end gap-3"
      :style="{ borderColor: 'var(--content-border)' }"
    >
      <Button
        label="重置"
        icon="pi pi-refresh"
        severity="secondary"
        :disabled="submitting || editorImageUploading"
        @click="resetForm"
      />
      <Button
        label="提交反馈"
        icon="pi pi-send"
        :loading="submitting"
        :disabled="editorImageUploading"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Editor from 'primevue/editor'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useAuthStore } from '../../stores/system/authStore'
import { getBackendAuthConfig } from '../../utils/backendAuth'
import {
  submitFeedback,
  uploadFeedbackFile,
  type FeedbackSubmitPayload,
  type FeedbackType,
  type FeedbackUploadedFile,
} from '../../utils/backendFeedback'

type LocalFileItem = {
  id: string
  file: File
}

const toast = useToast()
const authStore = useAuthStore()
const emit = defineEmits<{
  (e: 'submitted'): void
}>()

const feedbackTypeOptions: Array<{ label: string; value: FeedbackType }> = [
  { label: '意见建议', value: 'opinion' },
  { label: '问题反馈', value: 'issue' },
]

const form = reactive<{
  feedbackType: FeedbackType
  title: string
  opinion: string
}>({
  feedbackType: 'issue',
  title: '',
  opinion: '',
})

const attachments = ref<LocalFileItem[]>([])
const submitting = ref(false)
const editorImageUploading = ref(false)
const attachmentInputRef = ref<HTMLInputElement | null>(null)
const editorImageInputRef = ref<HTMLInputElement | null>(null)
const editorRef = ref<any>(null)
let editorPasteHandler: ((event: ClipboardEvent) => void) | null = null

const feedbackTypeLabel = computed(() => {
  return feedbackTypeOptions.find((item) => item.value === form.feedbackType)?.label || '意见反馈'
})

const opinionTextLength = computed(() => stripHtml(form.opinion).length)

function createLocalId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatFileSize(size: number): string {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function dedupeFiles(files: File[], existing: LocalFileItem[]): File[] {
  const existingKeys = new Set(
    existing.map((item) => `${item.file.name}__${item.file.size}__${item.file.lastModified}`)
  )
  return files.filter((file) => {
    const key = `${file.name}__${file.size}__${file.lastModified}`
    if (existingKeys.has(key)) {
      return false
    }
    existingKeys.add(key)
    return true
  })
}

function addAttachmentFiles(files: File[]) {
  const normalized = dedupeFiles(files, attachments.value)
  if (normalized.length === 0) return
  attachments.value = attachments.value.concat(
    normalized.map((file) => ({
      id: createLocalId(),
      file,
    }))
  )
}

function openAttachmentPicker() {
  attachmentInputRef.value?.click()
}

function handleAttachmentFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  addAttachmentFiles(files)
  input.value = ''
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((item) => item.id !== id)
}

function resetForm() {
  if (submitting.value || editorImageUploading.value) return
  form.feedbackType = 'issue'
  form.title = ''
  form.opinion = ''
  attachments.value = []
}

function normalizeUploadedFile(localFile: File, uploaded: FeedbackUploadedFile, isImage: boolean): FeedbackUploadedFile {
  return {
    ...uploaded,
    id: String(uploaded.id || uploaded.fileId || uploaded.ossId || ''),
    fileId: String(uploaded.fileId || uploaded.id || uploaded.ossId || ''),
    ossId: String(uploaded.ossId || uploaded.fileId || uploaded.id || ''),
    name: String(uploaded.name || uploaded.fileName || uploaded.originalName || localFile.name || ''),
    fileName: String(uploaded.fileName || uploaded.name || localFile.name || ''),
    originalName: String(uploaded.originalName || uploaded.fileName || uploaded.name || localFile.name || ''),
    size: Number(uploaded.size || localFile.size || 0),
    isImage: typeof uploaded.isImage === 'boolean' ? uploaded.isImage : isImage,
  }
}

function normalizeImageUrl(raw: unknown, baseUrl: string): string {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) return url
  if (url.startsWith('/')) return `${String(baseUrl || '').replace(/\/+$/, '')}${url}`
  return url
}

function getUploadedImageUrl(file: FeedbackUploadedFile, baseUrl: string): string {
  return (
    normalizeImageUrl(file.url, baseUrl) ||
    normalizeImageUrl(file.fileUrl, baseUrl) ||
    normalizeImageUrl(file.ossUrl, baseUrl) ||
    normalizeImageUrl(file.previewUrl, baseUrl) ||
    ''
  )
}

async function uploadLocalFiles(items: LocalFileItem[], isImage: boolean): Promise<FeedbackUploadedFile[]> {
  if (items.length === 0) return []
  const cfg = await getBackendAuthConfig()
  const auth = {
    accessToken: authStore.accessToken,
    clientId: authStore.clientId,
  }
  const uploaded: FeedbackUploadedFile[] = []
  for (const item of items) {
    const result = await uploadFeedbackFile(cfg, auth, item.file, { isImg: isImage })
    uploaded.push(normalizeUploadedFile(item.file, result, isImage))
  }
  return uploaded
}

function validateForm(): boolean {
  const title = form.title.trim()
  const contentText = stripHtml(form.opinion)
  if (!title) {
    toast.add({
      severity: 'warn',
      summary: '请填写标题',
      detail: '标题用于快速定位问题或建议。',
      life: 2500,
    })
    return false
  }
  if (!contentText) {
    toast.add({
      severity: 'warn',
      summary: '请填写反馈内容',
      detail: '请描述复现步骤、期望表现或实际问题。',
      life: 2500,
    })
    return false
  }
  return true
}

async function ensureAuthReady() {
  await authStore.init()
  if (!authStore.isLoggedIn) {
    throw new Error('登录状态已失效，请重新登录后再提交反馈')
  }
}

function openEditorImagePicker() {
  editorImageInputRef.value?.click()
}

async function insertImagesToEditor(files: File[]) {
  if (files.length === 0) return
  editorImageUploading.value = true
  try {
    await ensureAuthReady()
    const cfg = await getBackendAuthConfig()
    const auth = { accessToken: authStore.accessToken, clientId: authStore.clientId }
    const quill = editorRef.value?.getQuill?.()
    for (const file of files) {
      const uploaded = normalizeUploadedFile(file, await uploadFeedbackFile(cfg, auth, file, { isImg: true }), true)
      const imageUrl = getUploadedImageUrl(uploaded, cfg.baseUrl)
      if (!imageUrl) {
        throw new Error('图片上传成功但未返回可用链接')
      }
      const range = quill?.getSelection?.(true)
      const index = typeof range?.index === 'number' ? range.index : quill?.getLength?.() ?? 0
      quill?.insertEmbed?.(index, 'image', imageUrl, 'user')
      quill?.setSelection?.(index + 1, 0, 'user')
    }
    toast.add({
      severity: 'success',
      summary: '图片已插入',
      detail: `已插入 ${files.length} 张图片`,
      life: 2000,
    })
  } finally {
    editorImageUploading.value = false
  }
}

async function handleEditorImageInput(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'))
  input.value = ''
  if (files.length === 0) return
  try {
    await insertImagesToEditor(files)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '插入图片失败',
      detail: String((error as Error)?.message || error || '图片上传失败'),
      life: 3200,
    })
  }
}

async function handleEditorPaste(event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items || [])
  const imageItems = items.filter((item) => item.type.startsWith('image/'))
  if (imageItems.length === 0) {
    return
  }

  event.preventDefault()
  const files: File[] = []
  for (const item of imageItems) {
    const file = item.getAsFile()
    if (!file) continue
    const ext = file.type.split('/')[1] || 'png'
    files.push(new File([file], `paste-image-${Date.now()}.${ext}`, { type: file.type }))
  }
  if (files.length === 0) {
    return
  }
  try {
    await insertImagesToEditor(files)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '粘贴图片失败',
      detail: String((error as Error)?.message || error || '图片上传失败'),
      life: 3200,
    })
  }
}

async function handleSubmit() {
  if (submitting.value || editorImageUploading.value || !validateForm()) {
    return
  }
  submitting.value = true
  try {
    await ensureAuthReady()

    toast.add({
      severity: 'info',
      summary: '开始上传',
      detail: '正在上传附件并提交反馈，请稍候。',
      life: 1800,
    })

    const uploadedAttachments = await uploadLocalFiles(attachments.value, false)
    const ossIdsOf = (files: FeedbackUploadedFile[]) =>
      files
        .map((item) => String(item.ossId || item.fileId || item.id || '').trim())
        .filter(Boolean)

    const contentHtml = String(form.opinion || '').trim()
    const contentText = stripHtml(form.opinion)

    const payload: FeedbackSubmitPayload = {
      feedbackType: form.feedbackType,
      title: form.title.trim(),
      contentHtml,
      contentText,
      screenshotOssIds: [],
      attachmentOssIds: ossIdsOf(uploadedAttachments),
    }

    const cfg = await getBackendAuthConfig()
    await submitFeedback(cfg, {
      accessToken: authStore.accessToken,
      clientId: authStore.clientId,
    }, payload)

    toast.add({
      severity: 'success',
      summary: '提交成功',
      detail: '意见反馈已提交，感谢你的反馈。',
      life: 3000,
    })
    resetForm()
    emit('submitted')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '提交失败',
      detail: String((error as Error)?.message || error || '提交失败'),
      life: 4200,
    })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  const quill = editorRef.value?.getQuill?.()
  const root = quill?.root as HTMLElement | undefined
  if (!root) return
  editorPasteHandler = (event: ClipboardEvent) => {
    void handleEditorPaste(event)
  }
  root.addEventListener('paste', editorPasteHandler)
})

onBeforeUnmount(() => {
  const quill = editorRef.value?.getQuill?.()
  const root = quill?.root as HTMLElement | undefined
  if (root && editorPasteHandler) {
    root.removeEventListener('paste', editorPasteHandler)
  }
  editorPasteHandler = null
})
</script>
