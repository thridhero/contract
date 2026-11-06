<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="添加软著项目"
    :style="{ width: '760px' }"
    :draggable="false"
    :closable="true"
  >
    <div class="grid grid-cols-2 gap-4 pt-2">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          软件名称 <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.softwareName"
          placeholder="请输入软件名称"
          class="w-full"
          :invalid="!!errors.softwareName"
          @input="validateSoftwareName"
        />
        <small v-if="errors.softwareName" class="text-red-500">{{ errors.softwareName }}</small>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          版本号 <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.version"
          placeholder="例如 V1.0.0"
          class="w-full"
          :invalid="!!errors.version"
        />
        <small v-if="errors.version" class="text-red-500">{{ errors.version }}</small>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          开发完成日期 <span class="text-red-500">*</span>
        </label>
        <DatePicker
          v-model="form.completionDate"
          date-format="yy-mm-dd"
          class="w-full"
          show-icon
          :invalid="!!errors.completionDate"
        />
        <small v-if="errors.completionDate" class="text-red-500">{{ errors.completionDate }}</small>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          软件分类 <span class="text-red-500">*</span>
        </label>
        <Select
          v-model="form.softwareCategory"
          :options="softwareCategoryOptions"
          option-label="label"
          option-value="value"
          placeholder="请选择软件分类"
          class="w-full"
          :invalid="!!errors.softwareCategory"
        />
        <small v-if="errors.softwareCategory" class="text-red-500">{{ errors.softwareCategory }}</small>
      </div>

      <div class="col-span-2 flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          著作权人 <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-[220px_1fr] gap-2">
          <InputText
            v-model="ownerSearchKeyword"
            placeholder="按目录或标签名搜索"
            class="w-full"
            @focus="ensureOwnerCandidates"
          />
          <Select
            v-model="form.copyrightOwner"
            :options="filteredOwnerOptions"
            option-label="label"
            option-value="value"
            placeholder="请选择著作权人（标签来源）"
            class="w-full"
            :invalid="!!errors.copyrightOwner"
            @focus="ensureOwnerCandidates"
          />
        </div>
        <small v-if="errors.copyrightOwner" class="text-red-500">{{ errors.copyrightOwner }}</small>
        <small v-else-if="filteredOwnerOptions.length === 0" class="opacity-70" :style="{ color: 'var(--content-text-secondary)' }">
          未检索到匹配标签，请调整关键词
        </small>
      </div>

      <div class="col-span-2 flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">
          技术特点简述 <span class="text-red-500">*</span>
        </label>
        <Textarea
          v-model="form.technicalFeatures"
          rows="3"
          autoResize
          class="w-full"
          placeholder="请描述技术特点"
          :invalid="!!errors.technicalFeatures"
        />
        <small v-if="errors.technicalFeatures" class="text-red-500">{{ errors.technicalFeatures }}</small>
      </div>

      <div class="col-span-2 grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">项目 Icon</label>
          <InputText v-model="iconSearchKeyword" placeholder="搜索 PrimeVue Icon" class="w-full" />
          <div class="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto rounded-md border p-2" :style="{ borderColor: 'var(--content-border)' }">
            <button
              v-for="icon in filteredIcons"
              :key="icon"
              type="button"
              class="h-9 rounded-md border flex items-center justify-center transition-colors"
              :style="{
                borderColor: form.projectIcon === icon ? 'var(--btn-primary-bg)' : 'var(--content-border)',
                color: form.projectIcon === icon ? 'var(--btn-primary-bg)' : 'var(--content-text)'
              }"
              @click="form.projectIcon = icon"
            >
              <i :class="icon"></i>
            </button>
          </div>
          <div class="text-xs opacity-75 flex items-center gap-2" :style="{ color: 'var(--content-text-secondary)' }">
            <i :class="form.projectIcon"></i>
            <span>{{ form.projectIcon }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" :style="{ color: 'var(--content-text)' }">项目颜色（Tailwind 700）</label>
          <div class="grid grid-cols-5 gap-2 rounded-md border p-2" :style="{ borderColor: 'var(--content-border)' }">
            <button
              v-for="color in tailwind700Colors"
              :key="color.name"
              type="button"
              class="h-9 rounded-md border-2 transition-transform"
              :style="{
                backgroundColor: color.value,
                borderColor: form.projectColor === color.value ? '#111827' : 'transparent',
                transform: form.projectColor === color.value ? 'scale(1.05)' : 'scale(1)'
              }"
              :title="color.name"
              @click="form.projectColor = color.value"
            ></button>
          </div>
          <div class="text-xs opacity-75" :style="{ color: 'var(--content-text-secondary)' }">
            {{ selectedColorName }} · {{ form.projectColor }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="取消" severity="secondary" @click="visible = false" />
      <Button label="确认" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import type { TagEntity, TagGroupEntity } from '../../../../../shared/types/tag.types'
import { validateRequiredFields } from '../../../../../shared/validation/softwareProject'

type OwnerOption = {
  value: string
  label: string
  tagName: string
  groupName: string
}

type TailwindColor = {
  name: string
  value: string
}

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  confirm: [payload: {
    softwareName: string
    version: string
    completionDate: string
    copyrightOwner: string
    softwareCategory: string
    technicalFeatures: string
    projectIcon: string
    projectColor: string
  }]
}>()

const softwareCategoryOptions = [
  { label: '应用软件', value: 'application' },
  { label: '系统软件', value: 'system' },
  { label: '嵌入式软件', value: 'embedded' },
  { label: '中间件', value: 'middleware' },
  { label: '工具软件', value: 'tool' },
]

const tailwind700Colors: TailwindColor[] = [
  { name: 'slate-700', value: '#334155' },
  { name: 'gray-700', value: '#374151' },
  { name: 'zinc-700', value: '#3f3f46' },
  { name: 'neutral-700', value: '#404040' },
  { name: 'stone-700', value: '#44403c' },
  { name: 'red-700', value: '#b91c1c' },
  { name: 'orange-700', value: '#c2410c' },
  { name: 'amber-700', value: '#b45309' },
  { name: 'yellow-700', value: '#a16207' },
  { name: 'lime-700', value: '#4d7c0f' },
  { name: 'green-700', value: '#15803d' },
  { name: 'emerald-700', value: '#047857' },
  { name: 'teal-700', value: '#0f766e' },
  { name: 'cyan-700', value: '#0e7490' },
  { name: 'sky-700', value: '#0369a1' },
  { name: 'blue-700', value: '#1d4ed8' },
  { name: 'indigo-700', value: '#4338ca' },
  { name: 'violet-700', value: '#6d28d9' },
  { name: 'purple-700', value: '#7e22ce' },
  { name: 'fuchsia-700', value: '#a21caf' },
  { name: 'pink-700', value: '#be185d' },
  { name: 'rose-700', value: '#be123c' },
]

const primeIcons = [
  'pi pi-folder',
  'pi pi-folder-open',
  'pi pi-file',
  'pi pi-file-edit',
  'pi pi-book',
  'pi pi-briefcase',
  'pi pi-desktop',
  'pi pi-globe',
  'pi pi-cog',
  'pi pi-code',
  'pi pi-database',
  'pi pi-server',
  'pi pi-cloud',
  'pi pi-android',
  'pi pi-apple',
  'pi pi-microsoft',
  'pi pi-github',
  'pi pi-box',
  'pi pi-shield',
  'pi pi-key',
  'pi pi-lock',
  'pi pi-bolt',
  'pi pi-star',
  'pi pi-heart',
  'pi pi-tag',
  'pi pi-tags',
  'pi pi-sitemap',
  'pi pi-th-large',
  'pi pi-compass',
  'pi pi-chart-line',
  'pi pi-chart-bar',
  'pi pi-sliders-h',
  'pi pi-palette',
  'pi pi-images',
  'pi pi-video',
  'pi pi-microchip',
  'pi pi-sync',
  'pi pi-send',
  'pi pi-upload',
  'pi pi-download',
  'pi pi-link',
  'pi pi-share-alt',
  'pi pi-check-circle',
  'pi pi-verified',
  'pi pi-sparkles',
  'pi pi-objects-column',
  'pi pi-wifi',
  'pi pi-mobile',
  'pi pi-tablet',
]

const form = reactive({
  softwareName: '',
  version: '',
  completionDate: null as Date | null,
  copyrightOwner: '',
  softwareCategory: '',
  technicalFeatures: '',
  projectIcon: 'pi pi-folder',
  projectColor: '#1d4ed8',
})

const errors = reactive<Record<string, string>>({})
const ownerSearchKeyword = ref('')
const iconSearchKeyword = ref('')
const tags = ref<TagEntity[]>([])
const tagGroups = ref<TagGroupEntity[]>([])

const ownerOptions = computed<OwnerOption[]>(() => {
  const groupMap = new Map(tagGroups.value.map(group => [group.id, group.name]))
  return tags.value.map(tag => {
    const groupName = tag.group_id ? groupMap.get(tag.group_id) || '未分组' : '未分组'
    return {
      value: tag.name,
      label: `${tag.name}（${groupName}）`,
      tagName: tag.name,
      groupName,
    }
  })
})

const filteredOwnerOptions = computed(() => {
  const keyword = ownerSearchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return ownerOptions.value
  }
  return ownerOptions.value.filter(option =>
    option.tagName.toLowerCase().includes(keyword) || option.groupName.toLowerCase().includes(keyword)
  )
})

const filteredIcons = computed(() => {
  const keyword = iconSearchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return primeIcons
  }
  return primeIcons.filter(icon => icon.toLowerCase().includes(keyword))
})

const selectedColorName = computed(() => {
  return tailwind700Colors.find(color => color.value === form.projectColor)?.name || 'custom'
})

watch(visible, async value => {
  if (!value) {
    return
  }
  form.softwareName = ''
  form.version = ''
  form.completionDate = null
  form.copyrightOwner = ''
  form.softwareCategory = ''
  form.technicalFeatures = ''
  form.projectIcon = 'pi pi-folder'
  form.projectColor = '#1d4ed8'
  ownerSearchKeyword.value = ''
  iconSearchKeyword.value = ''
  Object.keys(errors).forEach(key => delete errors[key])
  await loadOwnerCandidates()
})

const validateSoftwareName = () => {
  if (!form.softwareName.trim()) {
    errors.softwareName = '软件名称不能为空'
    return
  }
  delete errors.softwareName
}

const validateForm = () => {
  Object.keys(errors).forEach(key => delete errors[key])
  const result = validateRequiredFields({
    softwareName: form.softwareName,
    version: form.version,
    completionDate: form.completionDate,
    copyrightOwner: form.copyrightOwner,
    softwareCategory: form.softwareCategory,
    technicalFeatures: form.technicalFeatures,
  })
  Object.assign(errors, result)
  return Object.keys(errors).length === 0
}

const formatDate = (date?: Date | null) => {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadOwnerCandidates = async () => {
  const libraryPath = localStorage.getItem('currentLibraryPath')
  if (libraryPath) {
    const [tagResult, groupResult] = await Promise.all([
      window.electronAPI.library.getTags(libraryPath),
      window.electronAPI.library.getTagGroups(libraryPath),
    ])
    tags.value = tagResult.success && tagResult.data ? tagResult.data : []
    tagGroups.value = groupResult.success && groupResult.data ? groupResult.data : []
    return
  }
  const [tagResult, groupResult] = await Promise.all([
    window.electronAPI.db.getTags(),
    window.electronAPI.db.getTagGroups(),
  ])
  tags.value = tagResult.success && tagResult.data ? tagResult.data : []
  tagGroups.value = groupResult.success && groupResult.data ? groupResult.data : []
}

const ensureOwnerCandidates = async () => {
  try {
    if (!tags.value || tags.value.length === 0) {
      await loadOwnerCandidates()
    }
  } catch {
    // ignore
  }
}

const submit = () => {
  if (!validateForm() || !form.completionDate) {
    return
  }
  emit('confirm', {
    softwareName: form.softwareName.trim(),
    version: form.version.trim(),
    completionDate: formatDate(form.completionDate),
    copyrightOwner: form.copyrightOwner,
    softwareCategory: form.softwareCategory,
    technicalFeatures: form.technicalFeatures.trim(),
    projectIcon: form.projectIcon,
    projectColor: form.projectColor,
  })
  visible.value = false
}
</script>
