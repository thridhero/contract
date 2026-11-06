<template>
  <Dialog
    :visible="visible"
    modal
    maximizable
    header="批量导入简历"
    :style="{ width: '1100px', maxWidth: '96vw' }"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="space-y-4">
      <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-[var(--content-text)]">扫描结果</div>
            <div class="text-sm text-[var(--content-text-secondary)]">选择本地文件夹后，系统会扫描其中全部支持的简历文件。</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button icon="pi pi-folder-open" label="选择文件夹" severity="secondary" :disabled="store.running" @click="emit('select-folder')" />
            <Button
              icon="pi pi-play"
              label="开始自动入库"
              :disabled="store.running || session.items.length === 0"
              :loading="store.running"
              @click="emit('start-import')"
            />
            <Button
              v-if="hasResults"
              icon="pi pi-refresh"
              label="重新扫描"
              text
              severity="secondary"
              :disabled="store.running"
              @click="emit('select-folder')"
            />
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">文件夹</div>
            <div class="mt-1 truncate text-sm font-medium text-[var(--content-text)]" :title="session.folderPath || '-'">{{ session.folderPath || '-' }}</div>
          </div>
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">总数</div>
            <div class="mt-1 text-xl font-semibold text-[var(--content-text)]">{{ session.total }}</div>
          </div>
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">成功</div>
            <div class="mt-1 text-xl font-semibold text-emerald-600">{{ session.successCount }}</div>
          </div>
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">失败</div>
            <div class="mt-1 text-xl font-semibold text-rose-600">{{ session.failedCount }}</div>
          </div>
        </div>

        <div class="mt-3 rounded-lg border border-dashed border-[var(--content-border)] px-3 py-2 text-sm text-[var(--content-text-secondary)]">
          {{ session.message || '请选择文件夹开始批量导入。' }}
        </div>

        <div v-if="session.items.length === 0" class="mt-4 rounded-lg bg-[var(--sidebar-bg)] px-4 py-10 text-center text-sm text-[var(--content-text-secondary)]">
          尚未扫描到简历文件。
        </div>
        <div v-else class="mt-4 max-h-64 overflow-auto rounded-lg border border-[var(--content-border)]">
          <div
            v-for="item in session.items"
            :key="item.filePath"
            class="flex items-center justify-between gap-3 border-b border-[var(--content-border)] px-4 py-3 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-[var(--content-text)]" :title="item.relativePath || item.filePath">
                {{ item.relativePath || item.fileName }}
              </div>
              <div class="truncate text-xs text-[var(--content-text-secondary)]" :title="item.filePath">{{ item.filePath }}</div>
            </div>
            <Tag :severity="getItemSeverity(item.status)" :value="getItemText(item.status)" />
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-[var(--content-text)]">任务进度</div>
            <div class="text-sm text-[var(--content-text-secondary)]">自动入库期间会逐条更新当前处理项和结果状态。</div>
          </div>
          <Tag :severity="progressSeverity" :value="progressLabel" />
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">已完成</div>
            <div class="mt-1 text-xl font-semibold text-[var(--content-text)]">{{ session.completed }} / {{ session.total }}</div>
          </div>
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">当前文件</div>
            <div class="mt-1 truncate text-sm font-medium text-[var(--content-text)]">{{ session.currentFileName || '-' }}</div>
          </div>
          <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
            <div class="text-xs text-[var(--content-text-secondary)]">整体进度</div>
            <div class="mt-1 text-xl font-semibold text-[var(--content-text)]">{{ store.progressPercent }}%</div>
          </div>
        </div>

        <div class="mt-4">
          <ProgressBar :value="store.progressPercent" style="height: 12px" />
        </div>
      </section>

      <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-[var(--content-text)]">结果汇总</div>
            <div class="text-sm text-[var(--content-text-secondary)]">成功项可直接查看员工详情，失败项可重试或转为手工补录。</div>
          </div>
        </div>

        <div v-if="!hasResults" class="mt-4 rounded-lg bg-[var(--sidebar-bg)] px-4 py-10 text-center text-sm text-[var(--content-text-secondary)]">
          任务完成后会在这里显示成功与失败结果。
        </div>
        <div v-else class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div class="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold text-emerald-700">成功项</div>
              <div class="text-xs text-emerald-600">{{ savedItems.length }} 条</div>
            </div>
            <div v-if="savedItems.length === 0" class="mt-3 text-sm text-[var(--content-text-secondary)]">暂无成功项。</div>
            <div v-else class="mt-3 max-h-72 space-y-2 overflow-auto">
              <div v-for="item in savedItems" :key="item.filePath" class="rounded-lg bg-white/80 px-3 py-2">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.personnelName || item.summary?.name || item.fileName }}</div>
                    <div class="truncate text-xs text-[var(--content-text-secondary)]">{{ item.relativePath || item.fileName }}</div>
                  </div>
                  <Button
                    v-if="item.personnelId"
                    icon="pi pi-eye"
                    label="查看"
                    size="small"
                    text
                    @click="emit('open-personnel', item.personnelId)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold text-rose-700">失败项</div>
              <div class="text-xs text-rose-600">{{ failedItems.length }} 条</div>
            </div>
            <div v-if="failedItems.length === 0" class="mt-3 text-sm text-[var(--content-text-secondary)]">暂无失败项。</div>
            <div v-else class="mt-3 max-h-72 space-y-2 overflow-auto">
              <div v-for="item in failedItems" :key="item.filePath" class="rounded-lg bg-white/80 px-3 py-2">
                <div class="truncate text-sm font-medium text-[var(--content-text)]">{{ item.relativePath || item.fileName }}</div>
                <div class="mt-1 text-xs text-rose-600">{{ item.error || '导入失败' }}</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <Button icon="pi pi-refresh" label="重试" size="small" text @click="emit('retry-item', item.filePath)" />
                  <Button icon="pi pi-pencil" label="手工补录" size="small" text severity="secondary" @click="emit('manual-fix', item.filePath)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import type { PersonnelBatchImportItemStatus } from '../../../../../shared/types/personnel.types';
import { usePersonnelBatchImportStore } from '../../../../stores/system/personnelBatchImportStore';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'select-folder'): void;
  (e: 'start-import'): void;
  (e: 'retry-item', filePath: string): void;
  (e: 'manual-fix', filePath: string): void;
  (e: 'open-personnel', personnelId: string): void;
}>();

const store = usePersonnelBatchImportStore();
const session = computed(() => store.session);
const savedItems = computed(() => session.value.items.filter(item => item.status === 'saved'));
const failedItems = computed(() => session.value.items.filter(item => item.status === 'failed'));
const hasResults = computed(() => savedItems.value.length > 0 || failedItems.value.length > 0);
const progressLabel = computed(() => {
  if (store.running) return '导入中';
  if (session.value.stage === 'completed') return '已完成';
  if (session.value.stage === 'failed') return '已失败';
  if (session.value.stage === 'scanning') return '扫描中';
  return '待开始';
});
const progressSeverity = computed<'secondary' | 'info' | 'success' | 'danger'>(() => {
  if (store.running || session.value.stage === 'scanning') return 'info';
  if (session.value.stage === 'completed') return 'success';
  if (session.value.stage === 'failed') return 'danger';
  return 'secondary';
});

const getItemText = (status: PersonnelBatchImportItemStatus) => {
  switch (status) {
    case 'pending': return '待处理';
    case 'processing': return '处理中';
    case 'saved': return '已录入';
    case 'failed': return '失败';
    default: return status;
  }
};

const getItemSeverity = (status: PersonnelBatchImportItemStatus): 'secondary' | 'info' | 'success' | 'danger' => {
  switch (status) {
    case 'processing': return 'info';
    case 'saved': return 'success';
    case 'failed': return 'danger';
    default: return 'secondary';
  }
};
</script>
