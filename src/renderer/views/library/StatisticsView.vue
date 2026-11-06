<template>
  <div
    class="statistics-view h-full flex flex-col transition-colors duration-200"
    :style="{ backgroundColor: 'var(--content-bg)' }"
  >
    <!-- 顶部工具栏 -->
    <div
      class="toolbar flex items-center justify-between px-4 py-3 border-b transition-colors duration-200"
      :style="{ borderColor: 'var(--content-border)' }"
    >
      <div class="flex items-center gap-3">
        <!-- 返回按钮 -->
        <Button
          icon="pi pi-arrow-left"
          text
          size="small"
          @click="goBack"
          :style="{ color: 'var(--content-text)' }"
        />
        <span
          class="text-base font-medium transition-colors duration-200"
          :style="{ color: 'var(--content-text)' }"
        >
          统计
        </span>

        <!-- 时间范围筛选 -->
        <Dropdown
          v-model="selectedRange"
          :options="timeRanges"
          optionLabel="name"
          optionValue="key"
          class="w-28 text-sm"
        />
      </div>

      <!-- 导出报表按钮 -->
      <Button
        label="导出报表"
        icon="pi pi-download"
        size="small"
        @click="exportReport"
        :style="{
          backgroundColor: 'var(--btn-secondary-bg)',
          borderColor: 'var(--btn-secondary-bg)',
          color: 'var(--btn-secondary-text)'
        }"
      />
    </div>

    <!-- 统计主体 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧图表区域 -->
      <div class="flex-1 p-4 overflow-y-auto">
        <div class="space-y-6">
          <!-- 项目状态分布 -->
          <div
            class="chart-card p-4 rounded-xl border transition-colors duration-200"
            :style="{
              backgroundColor: 'var(--content-card-bg)',
              borderColor: 'var(--content-border)'
            }"
          >
            <h3
              class="text-sm font-semibold mb-4 transition-colors duration-200"
              :style="{ color: 'var(--content-text)' }"
            >
              项目状态分布
            </h3>
            <div class="flex items-center gap-8">
              <!-- 饼图区域 -->
              <div class="w-48 h-48 relative">
                <svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
                  <circle
                    v-for="(slice, index) in pieSlices"
                    :key="index"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    :stroke="slice.color"
                    :stroke-width="20"
                    :stroke-dasharray="`${slice.percent * 2.51} 251.2`"
                    :stroke-dashoffset="slice.offset"
                    class="transition-all duration-500"
                  />
                </svg>
                <!-- 中心文字 -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <span
                    class="text-2xl font-bold transition-colors duration-200"
                    :style="{ color: 'var(--content-text)' }"
                  >
                    {{ totalProjects }}
                  </span>
                </div>
              </div>
              <!-- 图例 -->
              <div class="flex-1 space-y-2">
                <div
                  v-for="item in statusStats"
                  :key="item.status"
                  class="flex items-center justify-between py-1"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="w-3 h-3 rounded-full"
                      :style="{ backgroundColor: item.color }"
                    ></span>
                    <span
                      class="text-sm transition-colors duration-200"
                      :style="{ color: 'var(--content-text)' }"
                    >
                      {{ item.status }}
                    </span>
                  </div>
                  <span
                    class="text-sm font-medium transition-colors duration-200"
                    :style="{ color: 'var(--content-text-secondary)' }"
                  >
                    {{ item.count }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 月度申请趋势 -->
          <div
            class="chart-card p-4 rounded-xl border transition-colors duration-200"
            :style="{
              backgroundColor: 'var(--content-card-bg)',
              borderColor: 'var(--content-border)'
            }"
          >
            <h3
              class="text-sm font-semibold mb-4 transition-colors duration-200"
              :style="{ color: 'var(--content-text)' }"
            >
              月度申请趋势
            </h3>
            <div class="h-40 flex items-end gap-2">
              <div
                v-for="(month, index) in monthlyTrend"
                :key="index"
                class="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  class="w-full rounded-t transition-all duration-500"
                  :style="{
                    height: `${(month.count / maxMonthlyCount) * 100}%`,
                    backgroundColor: month.count > 0 ? 'var(--btn-primary-bg)' : 'var(--content-border)',
                    opacity: month.count > 0 ? 1 : 0.3
                  }"
                ></div>
                <span
                  class="text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  {{ month.shortName }}
                </span>
              </div>
            </div>
          </div>

          <!-- 申请类型分布 -->
          <div
            class="chart-card p-4 rounded-xl border transition-colors duration-200"
            :style="{
              backgroundColor: 'var(--content-card-bg)',
              borderColor: 'var(--content-border)'
            }"
          >
            <h3
              class="text-sm font-semibold mb-4 transition-colors duration-200"
              :style="{ color: 'var(--content-text)' }"
            >
              申请类型分布
            </h3>
            <div class="flex items-center gap-8">
              <!-- 柱状图 -->
              <div class="flex-1 flex items-end gap-4 h-32">
                <div
                  v-for="item in typeStats"
                  :key="item.type"
                  class="flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    class="w-12 rounded-t transition-all duration-500"
                    :style="{
                      height: `${(item.count / maxTypeCount) * 100}%`,
                      backgroundColor: item.color
                    }"
                  ></div>
                  <span
                    class="text-xs transition-colors duration-200"
                    :style="{ color: 'var(--content-text-secondary)' }"
                  >
                    {{ item.type }}
                  </span>
                </div>
              </div>
              <!-- 数据 -->
              <div class="w-32 space-y-2">
                <div
                  v-for="item in typeStats"
                  :key="item.type"
                  class="flex items-center justify-between"
                >
                  <span
                    class="text-sm transition-colors duration-200"
                    :style="{ color: 'var(--content-text)' }"
                  >
                    {{ item.type }}
                  </span>
                  <span
                    class="text-sm font-medium transition-colors duration-200"
                    :style="{ color: 'var(--content-text-secondary)' }"
                  >
                    {{ item.count }} ({{ item.percent }}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧数据概览面板 -->
      <div
        class="overview-panel w-72 border-l p-4 overflow-y-auto transition-colors duration-200"
        :style="{
          borderColor: 'var(--content-border)',
          backgroundColor: 'var(--sidebar-bg)'
        }"
      >
        <!-- 数据概览 -->
        <div class="mb-6">
          <h4
            class="text-xs font-semibold uppercase tracking-wide mb-3 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            数据概览
          </h4>
          <div class="space-y-3">
            <div
              class="stat-item p-3 rounded-lg transition-colors duration-200"
              :style="{ backgroundColor: 'var(--content-card-bg)' }"
            >
              <div
                class="text-xs mb-1 transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                总项目
              </div>
              <div
                class="text-2xl font-bold transition-colors duration-200"
                :style="{ color: 'var(--content-text)' }"
              >
                {{ totalProjects }}
              </div>
            </div>
            <div
              class="stat-item p-3 rounded-lg transition-colors duration-200"
              :style="{ backgroundColor: 'var(--content-card-bg)' }"
            >
              <div
                class="text-xs mb-1 transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                进行中
              </div>
              <div
                class="text-2xl font-bold transition-colors duration-200"
                :style="{ color: 'var(--btn-primary-bg)' }"
              >
                {{ inProgressCount }}
              </div>
            </div>
            <div
              class="stat-item p-3 rounded-lg transition-colors duration-200"
              :style="{ backgroundColor: 'var(--content-card-bg)' }"
            >
              <div
                class="text-xs mb-1 transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                已完成
              </div>
              <div
                class="text-2xl font-bold transition-colors duration-200"
                :style="{ color: '#22c55e' }"
              >
                {{ completedCount }}
              </div>
            </div>
            <div
              class="stat-item p-3 rounded-lg transition-colors duration-200"
              :style="{ backgroundColor: 'var(--content-card-bg)' }"
            >
              <div
                class="text-xs mb-1 transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                待处理
              </div>
              <div
                class="text-2xl font-bold transition-colors duration-200"
                :style="{ color: '#ef4444' }"
              >
                {{ pendingCount }}
              </div>
            </div>
          </div>
        </div>

        <!-- 本月新增 -->
        <div class="mb-6">
          <h4
            class="text-xs font-semibold uppercase tracking-wide mb-3 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            本月新增
          </h4>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span
                class="text-sm transition-colors duration-200"
                :style="{ color: 'var(--content-text)' }"
              >
                新增
              </span>
              <span
                class="text-sm font-medium transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                +{{ monthlyStats.new }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="text-sm transition-colors duration-200"
                :style="{ color: 'var(--content-text)' }"
              >
                完成
              </span>
              <span
                class="text-sm font-medium transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                {{ monthlyStats.completed }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="text-sm transition-colors duration-200"
                :style="{ color: 'var(--content-text)' }"
              >
                待缴费
              </span>
              <span
                class="text-sm font-medium transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                {{ monthlyStats.payment }}
              </span>
            </div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div>
          <h4
            class="text-xs font-semibold uppercase tracking-wide mb-3 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            快捷操作
          </h4>
          <div class="space-y-2">
            <Button
              label="导出报表"
              icon="pi pi-download"
              class="w-full"
              size="small"
              @click="exportReport"
            />
            <Button
              label="打印统计"
              icon="pi pi-print"
              class="w-full"
              size="small"
              severity="secondary"
              outlined
              @click="printStatistics"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { createRendererLogger } from '@/utils/logger'

const logger = createRendererLogger('StatisticsView')

/**
 * 数据统计视图组件
 * 展示软著申请项目的统计数据和图表
 */

// 响应式状态
const selectedRange = ref('all')

// 时间范围选项
const timeRanges = [
  { key: 'all', name: '全部' },
  { key: 'year', name: '本年' },
  { key: 'month', name: '本月' },
  { key: 'quarter', name: '本季度' }
]

// 状态统计数据
const statusStats = ref([
  { status: '准备', count: 3, color: '#3b82f6' },
  { status: '审查', count: 5, color: '#f59e0b' },
  { status: '已完成', count: 4, color: '#22c55e' }
])

// 月度趋势数据
const monthlyTrend = ref([
  { name: '1月', shortName: '1月', count: 2 },
  { name: '2月', shortName: '2月', count: 1 },
  { name: '3月', shortName: '3月', count: 3 },
  { name: '4月', shortName: '4月', count: 2 },
  { name: '5月', shortName: '5月', count: 4 },
  { name: '6月', shortName: '6月', count: 0 },
  { name: '7月', shortName: '7月', count: 1 },
  { name: '8月', shortName: '8月', count: 3 },
  { name: '9月', shortName: '9月', count: 2 },
  { name: '10月', shortName: '10月', count: 1 },
  { name: '11月', shortName: '11月', count: 2 },
  { name: '12月', shortName: '12月', count: 1 }
])

// 类型统计数据
const typeStats = ref([
  { type: '企业', count: 8, percent: 67, color: '#3b82f6' },
  { type: '个人', count: 4, percent: 33, color: '#22c55e' }
])

// 本月统计数据
const monthlyStats = ref({
  new: 2,
  completed: 1,
  payment: 1
})

// 计算属性：总项目数
const totalProjects = computed(() => {
  return statusStats.value.reduce((sum, item) => sum + item.count, 0)
})

// 计算属性：进行中数量
const inProgressCount = computed(() => {
  return statusStats.value
    .filter(item => item.status === '准备' || item.status === '审查')
    .reduce((sum, item) => sum + item.count, 0)
})

// 计算属性：已完成数量
const completedCount = computed(() => {
  return statusStats.value
    .find(item => item.status === '已完成')?.count || 0
})

// 计算属性：待处理数量
const pendingCount = computed(() => {
  return statusStats.value
    .find(item => item.status === '准备')?.count || 0
})

// 计算属性：最大月度数量
const maxMonthlyCount = computed(() => {
  return Math.max(...monthlyTrend.value.map(m => m.count), 1)
})

// 计算属性：最大类型数量
const maxTypeCount = computed(() => {
  return Math.max(...typeStats.value.map(t => t.count), 1)
})

// 计算属性：饼图切片
const pieSlices = computed(() => {
  let offset = 0
  return statusStats.value.map(item => {
    const percent = totalProjects.value > 0 ? (item.count / totalProjects.value) * 100 : 0
    const slice = {
      color: item.color,
      percent,
      offset: -offset
    }
    offset += percent * 2.51
    return slice
  })
})

// 方法：返回
const goBack = () => {
  logger.info('返回资源库')
}

// 方法：导出报表
const exportReport = () => {
  logger.info('导出报表')
}

// 方法：打印统计
const printStatistics = () => {
  logger.info('打印统计')
}
</script>

<style scoped>/* 组件特定样式 */</style>
