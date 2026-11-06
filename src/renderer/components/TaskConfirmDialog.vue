<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="task-confirm-overlay" @click.self="handleOverlayClick">
        <div class="task-confirm-dialog">
          <div class="dialog-header">
            <div class="header-title">
              <i class="pi pi-exclamation-triangle warning-icon"></i>
              <span>有任务正在执行</span>
            </div>
          </div>

          <div class="dialog-body">
            <div class="warning-message">
              关闭窗口将中断以下正在执行的任务，确定要退出吗？
            </div>

            <div class="task-list" v-if="activeTasks.length > 0">
              <div
                v-for="task in activeTasks"
                :key="task.id"
                class="task-item"
              >
                <div class="task-info">
                  <i :class="getTaskTypeIcon(task.type)"></i>
                  <span class="task-name" :title="task.name">{{ task.name }}</span>
                  <span class="task-type">{{ getTaskTypeName(task.type) }}</span>
                </div>
                <div class="task-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: task.progress + '%' }"
                    ></div>
                  </div>
                  <span class="progress-text">{{ task.progress }}%</span>
                </div>
              </div>
            </div>
            <div v-else class="no-tasks">
              <i class="pi pi-check-circle"></i>
              <span>没有正在执行的任务</span>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-danger" @click="handleConfirm">
              <i class="pi pi-exclamation-triangle"></i>
              确定退出
            </button>
            <button class="btn btn-secondary" @click="handleCancel">
              <i class="pi pi-times"></i>
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTaskMonitorStore } from '../stores/system/taskMonitorStore';
import type { TaskInfo, TaskType } from '../../shared/types/taskMonitor.types';

interface Props {
  visible: boolean;
  tasks?: TaskInfo[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'confirm': [];
  'cancel': [];
}>();

const taskMonitorStore = useTaskMonitorStore();

const activeTasks = computed(() => {
  if (Array.isArray(props.tasks) && props.tasks.length > 0) {
    return props.tasks;
  }
  return taskMonitorStore.activeTasks;
});

const taskTypeIcons: Record<TaskType, string> = {
  import: 'pi pi-upload',
  export: 'pi pi-download',
  delete: 'pi pi-trash',
  copy: 'pi pi-copy',
  sync: 'pi pi-sync',
  move: 'pi pi-directions-alt',
  other: 'pi pi-cog',
};

const taskTypeNames: Record<TaskType, string> = {
  import: '导入',
  export: '导出',
  delete: '删除',
  copy: '复制',
  sync: '同步',
  move: '移动',
  other: '其他',
};

function getTaskTypeIcon(type: TaskType): string {
  return taskTypeIcons[type] || taskTypeIcons.other;
}

function getTaskTypeName(type: TaskType): string {
  return taskTypeNames[type] || '其他';
}

function handleOverlayClick(): void {
  emit('cancel');
}

async function handleConfirm(): Promise<void> {
  if (window.electronAPI?.closeGuard?.forceClose) {
    await window.electronAPI.closeGuard.forceClose();
  }
  emit('confirm');
}

function handleCancel(): void {
  if (window.electronAPI?.closeGuard?.cancel) {
    window.electronAPI.closeGuard.cancel();
  }
  emit('cancel');
}
</script>

<style scoped>
.task-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.task-confirm-dialog {
  background: var(--surface-card, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--surface-border, #e0e0e0);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--content-text, #333);
}

.warning-icon {
  font-size: 20px;
  color: var(--orange-500, #f97316);
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.warning-message {
  font-size: 14px;
  color: var(--content-text-secondary, #666);
  margin-bottom: 16px;
  line-height: 1.5;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  background: var(--surface-ground, #f5f5f5);
  border-radius: 6px;
  padding: 12px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.task-info i {
  font-size: 14px;
  color: var(--content-text-secondary, #666);
}

.task-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--content-text, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-type {
  font-size: 12px;
  color: var(--content-text-secondary, #999);
  background: var(--surface-border, #e0e0e0);
  padding: 2px 8px;
  border-radius: 4px;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--surface-border, #e0e0e0);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #3b82f6);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--content-text-secondary, #666);
  min-width: 36px;
  text-align: right;
}

.no-tasks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--content-text-secondary, #666);
  gap: 8px;
}

.no-tasks i {
  font-size: 32px;
  color: var(--green-500, #22c55e);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--surface-border, #e0e0e0);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn i {
  font-size: 14px;
}

.btn-danger {
  background: var(--red-500, #ef4444);
  color: white;
}

.btn-danger:hover {
  background: var(--red-600, #dc2626);
}

.btn-secondary {
  background: var(--surface-ground, #f5f5f5);
  color: var(--content-text, #333);
  border: 1px solid var(--surface-border, #e0e0e0);
}

.btn-secondary:hover {
  background: var(--surface-border, #e0e0e0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
