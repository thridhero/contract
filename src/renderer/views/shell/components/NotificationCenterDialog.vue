<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    header="通知中心"
    :style="{ width: '82vw', maxWidth: '1180px', minHeight: '80vh' }"
    :closable="true"
    :draggable="true"
    maximizable
    class="theme-dialog notification-center-dialog"
  >
    <div class="flex flex-col gap-3 h-full p-4 min-h-[80vh]">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm" :style="{ color: 'var(--content-text-secondary)' }">
          {{ summaryText }}
        </div>
        <Button
          text
          size="small"
          icon="pi pi-refresh"
          label="刷新"
          :loading="loadingList"
          @click="loadUnreadNotices()"
        />
      </div>

      <div class="flex flex-1 gap-3 ">
        <div
          class="w-[360px] shrink-0 rounded-lg border overflow-hidden flex flex-col"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
        >
          <div
            class="px-4 py-3 border-b text-sm font-medium"
            :style="{ borderColor: 'var(--content-border)', color: 'var(--content-text)' }"
          >
            未读通知
          </div>
          <div v-if="loadingList" class="flex-1 flex items-center justify-center">
            <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="6" />
          </div>
          <div
            v-else-if="notices.length === 0"
            class="flex-1 flex items-center justify-center px-6 text-sm text-center"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            暂无未读通知
          </div>
          <div v-else class="flex-1 min-h-0 flex flex-col">
            <div class="flex-1 overflow-y-auto p-2">
              <button
                v-for="notice in pagedNotices"
                :key="notice.noticeId"
                type="button"
                class="w-full text-left rounded-md px-3 py-3 transition-colors duration-150 border mb-2 last:mb-0"
                :style="getNoticeItemStyle(notice.noticeId)"
                @click="handleNoticeClick(notice)"
              >
                <div class="font-medium text-sm line-clamp-2 break-all">{{ notice.noticeTitle || '未命名通知' }}</div>
                <div
                  class="text-xs mt-2 flex items-center justify-between gap-2"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  <span>{{ formatNoticeType(notice.noticeType) }}</span>
                  <span>{{ formatDateTime(notice.createTime) }}</span>
                </div>
              </button>
            </div>
            <div
              class="border-t px-3 py-2 shrink-0"
              :style="{ borderColor: 'var(--content-border)' }"
            >
              <div class="text-xs mb-2" :style="{ color: 'var(--content-text-secondary)' }">
                {{ pageReportText }}
              </div>
              <Paginator
                :first="pageFirst"
                :rows="pagination.pageSize"
                :totalRecords="notices.length"
                :rowsPerPageOptions="[5, 10, 20]"
                class="bg-transparent border-none custom-paginator !p-0"
                @page="onPageChange"
              />
            </div>
          </div>
        </div>

        <div
          class="flex-1 rounded-lg border overflow-hidden flex flex-col min-w-0"
          :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-card-bg)' }"
        >
          <div v-if="loadingDetail" class="flex-1 flex items-center justify-center">
            <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="6" />
          </div>
          <div
            v-else-if="selectedNotice"
            class="flex-1 min-h-0 flex flex-col"
          >
            <div class="px-5 py-4 border-b" :style="{ borderColor: 'var(--content-border)' }">
              <div class="text-xl font-semibold break-all" :style="{ color: 'var(--content-text)' }">
                {{ selectedNotice.noticeTitle || '未命名通知' }}
              </div>
              <div class="mt-2 text-sm flex items-center gap-4 flex-wrap" :style="{ color: 'var(--content-text-secondary)' }">
                <span>类型：{{ formatNoticeType(selectedNotice.noticeType) }}</span>
                <span>时间：{{ formatDateTime(selectedNotice.createTime) }}</span>
                <span v-if="selectedNotice.createByName">发布人：{{ selectedNotice.createByName }}</span>
              </div>
            </div>
            <div
              class="flex-1 overflow-y-auto px-5 py-4 text-sm leading-7 notice-content"
              :style="{ color: 'var(--content-text)' }"
              v-html="selectedNotice.noticeContent || '<p>暂无通知内容</p>'"
            ></div>
          </div>
          <div
            v-else
            class="flex-1 flex items-center justify-center px-6 text-sm text-center"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            请选择左侧通知查看详情
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../../../stores/system/authStore'
import { backendFetch, getBackendAuthConfig } from '../../../utils/backendAuth'

type BackendR<T> = {
  code?: number
  msg?: string
  message?: string
  data?: T
}

type BackendRows<T> = {
  code?: number
  msg?: string
  rows?: T[]
  total?: number
}

type NoticeSummary = {
  noticeId: number
  noticeTitle?: string
  noticeType?: string
  createTime?: string
  createByName?: string
}

type NoticeDetail = NoticeSummary & {
  noticeContent?: string
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const visibleProxy = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const toast = useToast()
const authStore = useAuthStore()

const loadingList = ref(false)
const loadingDetail = ref(false)
const notices = ref<NoticeSummary[]>([])
const selectedNoticeId = ref<number | null>(null)
const selectedNotice = ref<NoticeDetail | null>(null)
const listRequestSeq = ref(0)
const detailRequestSeq = ref(0)
const pagination = ref({
  page: 1,
  pageSize: 5,
})

const pageFirst = computed(() => (pagination.value.page - 1) * pagination.value.pageSize)
const pagedNotices = computed(() => {
  return notices.value.slice(pageFirst.value, pageFirst.value + pagination.value.pageSize)
})
const pageReportText = computed(() => {
  if (notices.value.length === 0) return '暂无数据'
  const start = pageFirst.value + 1
  const end = Math.min(pageFirst.value + pagination.value.pageSize, notices.value.length)
  return `显示 ${start} - ${end}，共 ${notices.value.length} 条`
})

const summaryText = computed(() => {
  if (loadingList.value) return '正在加载未读通知...'
  if (notices.value.length === 0) return '当前没有未读通知'
  return `当前共有 ${notices.value.length} 条未读通知`
})

const ensurePageInRange = () => {
  const totalPages = Math.max(1, Math.ceil(notices.value.length / pagination.value.pageSize))
  if (pagination.value.page > totalPages) {
    pagination.value.page = totalPages
  }
  if (notices.value.length === 0) {
    pagination.value.page = 1
  }
}

const getBaseUrl = async () => {
  const cfg = await getBackendAuthConfig()
  return cfg.baseUrl.replace(/\/+$/, '')
}

const ensureAuth = async () => {
  await authStore.init()
  if (!authStore.accessToken || !authStore.clientId) {
    throw new Error('当前未登录，无法获取通知')
  }
  return {
    accessToken: authStore.accessToken,
    clientId: authStore.clientId,
  }
}

const parseBackendJson = async <T>(response: Response) => {
  const json = (await response.json().catch(() => null)) as BackendR<T> | BackendRows<T> | null
  if (!response.ok || !json || typeof json !== 'object') {
    throw new Error((json as BackendR<T> | null)?.msg || (json as BackendR<T> | null)?.message || '请求失败')
  }
  return json
}

const loadUnreadNotices = async () => {
  const requestSeq = ++listRequestSeq.value
  loadingList.value = true
  try {
    const auth = await ensureAuth()
    const baseUrl = await getBaseUrl()
    const response = await backendFetch(`${baseUrl}/system/noticeRead/unread`, {
      method: 'GET',
      auth,
    })
    const json = await parseBackendJson<NoticeSummary[]>(response) as BackendR<NoticeSummary[]>
    if (requestSeq !== listRequestSeq.value) return
    const rows = Array.isArray(json.data) ? json.data : []
    notices.value = rows
    ensurePageInRange()
    if (!rows.some(item => item.noticeId === selectedNoticeId.value)) {
      selectedNoticeId.value = null
      selectedNotice.value = null
    }
  } catch (error) {
    if (requestSeq !== listRequestSeq.value) return
    notices.value = []
    selectedNoticeId.value = null
    selectedNotice.value = null
    toast.add({
      severity: 'error',
      summary: '通知加载失败',
      detail: error instanceof Error ? error.message : '获取通知列表失败',
      life: 3000,
    })
  } finally {
    if (requestSeq === listRequestSeq.value) {
      loadingList.value = false
    }
  }
}

const loadNoticeDetail = async (noticeId: number) => {
  const requestSeq = ++detailRequestSeq.value
  loadingDetail.value = true
  try {
    const auth = await ensureAuth()
    const baseUrl = await getBaseUrl()
    const response = await backendFetch(`${baseUrl}/system/notice/${noticeId}`, {
      method: 'GET',
      auth,
    })
    const json = await parseBackendJson<NoticeDetail>(response) as BackendR<NoticeDetail>
    if (requestSeq !== detailRequestSeq.value) return
    selectedNotice.value = json.data || null
  } catch (error) {
    if (requestSeq !== detailRequestSeq.value) return
    selectedNotice.value = null
    toast.add({
      severity: 'error',
      summary: '通知加载失败',
      detail: error instanceof Error ? error.message : '获取通知详情失败',
      life: 3000,
    })
  } finally {
    if (requestSeq === detailRequestSeq.value) {
      loadingDetail.value = false
    }
  }
}

const markNoticeAsRead = async (noticeId: number) => {
  const auth = await ensureAuth()
  const baseUrl = await getBaseUrl()
  const response = await backendFetch(`${baseUrl}/system/noticeRead/read/${noticeId}?isRead=1`, {
    method: 'PUT',
    auth,
  })
  const json = await parseBackendJson<void>(response) as BackendR<void>
  const code = typeof json.code === 'number' ? json.code : 500
  if (code !== 200) {
    throw new Error(json.msg || json.message || '标记已读失败')
  }
}

const handleNoticeClick = async (notice: NoticeSummary) => {
  selectedNoticeId.value = notice.noticeId
  await loadNoticeDetail(notice.noticeId)
  try {
    await markNoticeAsRead(notice.noticeId)
    notices.value = notices.value.filter(item => item.noticeId !== notice.noticeId)
    ensurePageInRange()
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: '标记已读失败',
      detail: error instanceof Error ? error.message : '通知已打开，但写入已读状态失败',
      life: 3000,
    })
  }
}

const formatDateTime = (value?: string) => {
  if (!value) return '未知时间'
  const normalized = value.replace('T', ' ')
  return normalized.length > 19 ? normalized.slice(0, 19) : normalized
}

const formatNoticeType = (value?: string) => {
  if (value === '1') return '通知'
  if (value === '2') return '公告'
  return '消息'
}

const getNoticeItemStyle = (noticeId: number) => {
  const active = selectedNoticeId.value === noticeId
  return {
    borderColor: active ? 'var(--btn-primary-bg)' : 'var(--content-border)',
    backgroundColor: active ? 'var(--sidebar-hover-bg)' : 'transparent',
    color: 'var(--content-text)',
  }
}

const onPageChange = (event: { page: number; rows: number }) => {
  pagination.value.page = event.page + 1
  pagination.value.pageSize = event.rows
}

watch(() => props.visible, async (visible) => {
  if (!visible) {
    return
  }
  await loadUnreadNotices()
}, { immediate: false })
</script>

<style scoped>
:deep(.notification-center-dialog .p-dialog-content) {
  padding: 0;
  overflow: hidden;
  height: min(82vh, 900px);
}

:deep(.notification-center-dialog.p-dialog-maximized .p-dialog-content) {
  height: calc(100vh - 2.5rem);
}

.notice-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.notice-content :deep(*) {
  word-break: break-word;
}
</style>
