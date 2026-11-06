<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">EventBus 使用示例</h2>

    <!-- 发送事件区域 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold mb-4 text-gray-700">发送事件</h3>
      <div class="space-y-3">
        <button
          @click="sendNotification"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          发送通知事件
        </button>
        <button
          @click="selectProject"
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition ml-2"
        >
          选择项目事件
        </button>
        <button
          @click="refreshProjects"
          class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition ml-2"
        >
          刷新项目事件
        </button>
      </div>
    </div>

    <!-- 接收事件区域 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold mb-4 text-gray-700">接收的事件日志</h3>
      <div class="bg-gray-100 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
        <div v-if="logs.length === 0" class="text-gray-500">
          等待接收事件...
        </div>
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="mb-2 p-2 rounded"
          :class="{
            'bg-blue-100': log.type === 'notification',
            'bg-green-100': log.type === 'project',
            'bg-purple-100': log.type === 'refresh'
          }"
        >
          <span class="text-gray-600">[{{ log.time }}]</span>
          <span class="font-semibold ml-2">{{ log.event }}</span>
          <span class="ml-2 text-gray-700">{{ JSON.stringify(log.data) }}</span>
        </div>
      </div>
      <button
        @click="clearLogs"
        class="mt-3 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
      >
        清空日志
      </button>
    </div>

    <!-- 使用说明 -->
    <div class="bg-blue-50 rounded-lg p-6 border border-blue-200">
      <h3 class="text-lg font-semibold mb-2 text-blue-800">使用说明</h3>
      <ul class="list-disc list-inside text-blue-700 space-y-1">
        <li>点击上方按钮发送不同类型的事件</li>
        <li>本组件使用 <code>useEventBus</code> 自动监听事件</li>
        <li>组件卸载时会自动清理所有事件监听</li>
        <li>支持 TypeScript 类型提示和检查</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useEventBus } from '../../composables/useEventBus';

const { emit, on } = useEventBus();

interface LogEntry {
  time: string;
  event: string;
  data: any;
  type: 'notification' | 'project' | 'refresh';
}

const logs = ref<LogEntry[]>([]);

// 添加日志
const addLog = (type: LogEntry['type'], event: string, data: any) => {
  logs.value.unshift({
    time: new Date().toLocaleTimeString(),
    event,
    data,
    type
  });
  // 限制日志数量
  if (logs.value.length > 50) {
    logs.value = logs.value.slice(0, 50);
  }
};

// 清空日志
const clearLogs = () => {
  logs.value = [];
};

// 发送通知事件
const sendNotification = () => {
  emit('ui:notification', {
    type: 'success',
    message: '这是一条测试通知消息！'
  });
};

// 选择项目事件
const selectProject = () => {
  emit('project:selected', {
    id: Math.floor(Math.random() * 1000),
    name: `测试项目 ${Math.floor(Math.random() * 100)}`
  });
};

// 刷新项目事件
const refreshProjects = () => {
  emit('project:refresh');
};

// 监听通知事件
on('ui:notification', (data) => {
  addLog('notification', 'ui:notification', data);
});

// 监听项目选择事件
on('project:selected', (data) => {
  addLog('project', 'project:selected', data);
});

// 监听项目刷新事件
on('project:refresh', () => {
  addLog('refresh', 'project:refresh', null);
});
</script>
