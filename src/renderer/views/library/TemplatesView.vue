<template>
  <div
    class="templates-view h-full flex flex-col transition-colors duration-200 "
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
          模板
        </span>

        <!-- 分类筛选 -->
        <Dropdown
          v-model="selectedCategory"
          :options="categories"
          optionLabel="name"
          optionValue="key"
          placeholder="全部"
          class="w-28 text-sm"
        />

        <!-- 新建模板按钮 -->
        <Button
          label="新建模板"
          icon="pi pi-plus"
          size="small"
          @click="createTemplate"
          :style="{
            backgroundColor: 'var(--btn-primary-bg)',
            borderColor: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)'
          }"
        />
      </div>

      <!-- 搜索框 -->
      <div class="flex items-center gap-2">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search text-xs" />
          <InputText
            v-model="searchQuery"
            placeholder="搜索模板..."
            class="text-xs w-48"
          />
        </IconField>
      </div>
    </div>

    <!-- 模板主体 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧模板网格 -->
      <div class="flex-1 p-4 overflow-y-auto">
        <!-- 模板网格 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          <div
            v-for="template in filteredTemplates"
            :key="template.id"
            class="template-card group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-lg"
            :style="{
              backgroundColor: 'var(--content-card-bg)',
              borderColor: selectedTemplate?.id === template.id ? 'var(--sidebar-active-border)' : 'var(--content-border)'
            }"
            @click="selectTemplate(template)"
          >
            <!-- 文件图标 -->
            <div
              class="w-full h-24 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200"
              :style="{ backgroundColor: 'var(--content-bg)' }"
            >
              <i
                :class="getFileIcon(template.type)"
                class="text-4xl"
                :style="{ color: getFileColor(template.type) }"
              ></i>
            </div>

            <!-- 模板信息 -->
            <div class="space-y-1">
              <div
                class="text-sm font-medium truncate transition-colors duration-200"
                :style="{ color: 'var(--content-text)' }"
              >
                {{ template.name }}
              </div>
              <div
                class="text-xs transition-colors duration-200"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                {{ template.category }}
              </div>
              <div class="flex items-center justify-between mt-2">
                <span
                  class="text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-muted)' }"
                >
                  {{ template.size }}
                </span>
                <span
                  class="text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-muted)' }"
                >
                  {{ template.type.toUpperCase() }}
                </span>
              </div>
            </div>

            <!-- 悬停操作按钮 -->
            <div
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1"
            >
              <Button
                icon="pi pi-pencil"
                text
                size="small"
                class="w-7 h-7"
                @click.stop="editTemplate(template)"
              />
              <Button
                icon="pi pi-trash"
                text
                size="small"
                class="w-7 h-7"
                severity="danger"
                @click.stop="deleteTemplate(template)"
              />
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="filteredTemplates.length === 0"
          class="flex flex-col items-center justify-center h-64 opacity-50"
        >
          <i class="pi pi-file text-5xl mb-4" :style="{ color: 'var(--content-text-secondary)' }"></i>
          <p class="text-sm" :style="{ color: 'var(--content-text-secondary)' }">
            暂无模板
          </p>
        </div>
      </div>

      <!-- 右侧模板详情面板 -->
      <div
        v-if="selectedTemplate"
        class="template-detail w-72 border-l p-4 overflow-y-auto transition-colors duration-200"
        :style="{
          borderColor: 'var(--content-border)',
          backgroundColor: 'var(--sidebar-bg)'
        }"
      >
        <!-- 模板预览 -->
        <div
          class="w-full h-32 rounded-lg flex items-center justify-center mb-4 transition-colors duration-200"
          :style="{ backgroundColor: 'var(--content-bg)' }"
        >
          <i
            :class="getFileIcon(selectedTemplate.type)"
            class="text-6xl"
            :style="{ color: getFileColor(selectedTemplate.type) }"
          ></i>
        </div>

        <!-- 模板信息 -->
        <div class="space-y-4">
          <div>
            <h4
              class="text-xs font-semibold uppercase tracking-wide mb-2 transition-colors duration-200"
              :style="{ color: 'var(--content-text-secondary)' }"
            >
              模板信息
            </h4>
            <div class="space-y-2">
              <div class="flex items-center">
                <span
                  class="w-16 text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  名称
                </span>
                <span
                  class="flex-1 text-sm transition-colors duration-200"
                  :style="{ color: 'var(--content-text)' }"
                >
                  {{ selectedTemplate.name }}
                </span>
              </div>
              <div class="flex items-center">
                <span
                  class="w-16 text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  类型
                </span>
                <span
                  class="flex-1 text-sm transition-colors duration-200"
                  :style="{ color: 'var(--content-text)' }"
                >
                  {{ selectedTemplate.type.toUpperCase() }}
                </span>
              </div>
              <div class="flex items-center">
                <span
                  class="w-16 text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  分类
                </span>
                <span
                  class="flex-1 text-sm transition-colors duration-200"
                  :style="{ color: 'var(--content-text)' }"
                >
                  {{ selectedTemplate.category }}
                </span>
              </div>
              <div class="flex items-center">
                <span
                  class="w-16 text-xs transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  创建时间
                </span>
                <span
                  class="flex-1 text-sm transition-colors duration-200"
                  :style="{ color: 'var(--content-text)' }"
                >
                  {{ selectedTemplate.createTime }}
                </span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="space-y-2 pt-4 border-t" :style="{ borderColor: 'var(--content-border)' }">
            <Button
              label="使用"
              icon="pi pi-copy"
              class="w-full"
              size="small"
              @click="useTemplate"
            />
            <Button
              label="编辑"
              icon="pi pi-pencil"
              class="w-full"
              size="small"
              severity="secondary"
              outlined
              @click="editTemplate(selectedTemplate)"
            />
            <Button
              label="导出"
              icon="pi pi-download"
              class="w-full"
              size="small"
              severity="secondary"
              outlined
              @click="exportTemplate"
            />
            <Button
              label="删除"
              icon="pi pi-trash"
              class="w-full"
              size="small"
              severity="danger"
              outlined
              @click="deleteTemplate(selectedTemplate)"
            />
          </div>
        </div>
      </div>

      <!-- 未选中模板时的空面板 -->
      <div
        v-else
        class="template-detail w-72 border-l p-4 flex flex-col items-center justify-center transition-colors duration-200"
        :style="{
          borderColor: 'var(--content-border)',
          backgroundColor: 'var(--sidebar-bg)'
        }"
      >
        <i class="pi pi-file text-4xl mb-3 opacity-40" :style="{ color: 'var(--content-text-secondary)' }"></i>
        <p class="text-sm opacity-40" :style="{ color: 'var(--content-text)' }">
          选择模板查看详情
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { createRendererLogger } from '@/utils/logger'

const logger = createRendererLogger('TemplatesView')

/**
 * 模板管理视图组件
 * 管理软著申请所需的文档模板
 */

// 模板类型定义
interface Template {
  id: string
  name: string
  type: 'docx' | 'xlsx' | 'pdf'
  category: string
  size: string
  createTime: string
  description?: string
}

// 响应式状态
const searchQuery = ref('')
const selectedCategory = ref('all')
const selectedTemplate = ref<Template | null>(null)

// 分类选项
const categories = [
  { key: 'all', name: '全部' },
  { key: 'document', name: '文档模板' },
  { key: 'form', name: '表格模板' },
  { key: 'code', name: '代码说明' }
]

// 模拟模板数据
const templates = ref<Template[]>([
  {
    id: '1',
    name: '软件说明文档',
    type: 'docx',
    category: '文档模板',
    size: '15 KB',
    createTime: '2024-01-15',
    description: '软件著作权申请所需的软件说明文档模板'
  },
  {
    id: '2',
    name: '用户手册模板',
    type: 'docx',
    category: '文档模板',
    size: '12 KB',
    createTime: '2024-01-10',
    description: '软件用户手册标准模板'
  },
  {
    id: '3',
    name: '申请表格',
    type: 'xlsx',
    category: '表格模板',
    size: '8 KB',
    createTime: '2024-01-08',
    description: '软著申请信息登记表'
  },
  {
    id: '4',
    name: '源代码说明',
    type: 'docx',
    category: '代码说明',
    size: '20 KB',
    createTime: '2024-01-05',
    description: '源代码说明文档模板'
  }
])

// 计算属性：筛选后的模板
const filteredTemplates = computed(() => {
  let result = templates.value

  // 按分类筛选
  if (selectedCategory.value !== 'all') {
    const categoryMap: Record<string, string> = {
      document: '文档模板',
      form: '表格模板',
      code: '代码说明'
    }
    result = result.filter(t => t.category === categoryMap[selectedCategory.value])
  }

  // 按搜索词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    )
  }

  return result
})

// 方法：获取文件图标
const getFileIcon = (type: string) => {
  const icons: Record<string, string> = {
    docx: 'pi pi-file-word',
    xlsx: 'pi pi-file-excel',
    pdf: 'pi pi-file-pdf'
  }
  return icons[type] || 'pi pi-file'
}

// 方法：获取文件颜色
const getFileColor = (type: string) => {
  const colors: Record<string, string> = {
    docx: '#3b82f6',
    xlsx: '#22c55e',
    pdf: '#ef4444'
  }
  return colors[type] || 'var(--content-text-secondary)'
}

// 方法：选择模板
const selectTemplate = (template: Template) => {
  selectedTemplate.value = template
}

// 方法：返回
const goBack = () => {
  // 返回资源库视图
  logger.info('返回资源库')
}

// 方法：创建模板
const createTemplate = () => {
  logger.info('创建新模板')
}

// 方法：编辑模板
const editTemplate = (template: Template) => {
  logger.info('编辑模板:', template)
}

// 方法：删除模板
const deleteTemplate = (template: Template) => {
  logger.info('删除模板:', template)
  templates.value = templates.value.filter(t => t.id !== template.id)
  if (selectedTemplate.value?.id === template.id) {
    selectedTemplate.value = null
  }
}

// 方法：使用模板
const useTemplate = () => {
  logger.info('使用模板:', selectedTemplate.value)
}

// 方法：导出模板
const exportTemplate = () => {
  logger.info('导出模板:', selectedTemplate.value)
}
</script>

<style scoped>
/* 组件特定样式 */
</style>
