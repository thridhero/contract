<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="新建软著申请项目"
    :style="{ width: '520px' }"
    :draggable="false"
    :closable="true"
  >
    <div class="flex flex-col gap-4 pt-2">

      <!-- 软件名称 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: theme.content.text }">
          软件名称 <span class="text-red-500">*</span>
        </label>
        <InputText
          v-model="form.name"
          placeholder="例：XX管理系统"
          class="w-full"
          :invalid="!!errors.name"
        />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>

      <!-- 简称 + 版本号 -->
      <div class="flex gap-3">
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-sm font-medium" :style="{ color: theme.content.text }">简称</label>
          <InputText v-model="form.short_name" placeholder="可选" class="w-full" />
        </div>
        <div class="flex flex-col gap-1" style="width: 120px">
          <label class="text-sm font-medium" :style="{ color: theme.content.text }">版本号</label>
          <InputText v-model="form.version" placeholder="V1.0" class="w-full" />
        </div>
      </div>

      <!-- 申请人类型 + 申请人名称 -->
      <div class="flex gap-3">
        <div class="flex flex-col gap-1" style="width: 140px">
          <label class="text-sm font-medium" :style="{ color: theme.content.text }">
            申请人类型 <span class="text-red-500">*</span>
          </label>
          <Select
            v-model="form.applicant_type"
            :options="applicantTypeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1 flex-1">
          <label class="text-sm font-medium" :style="{ color: theme.content.text }">
            申请人名称 <span class="text-red-500">*</span>
          </label>
          <InputText
            v-model="form.applicant_name"
            placeholder="个人姓名或单位名称"
            class="w-full"
            :invalid="!!errors.applicant_name"
          />
          <small v-if="errors.applicant_name" class="text-red-500">{{ errors.applicant_name }}</small>
        </div>
      </div>

      <!-- 完成日期 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: theme.content.text }">
          软件完成日期 <span class="text-red-500">*</span>
        </label>
        <DatePicker
          v-model="completionDate"
          date-format="yy-mm-dd"
          class="w-full"
          :invalid="!!errors.completion_date"
          show-icon
        />
        <small v-if="errors.completion_date" class="text-red-500">{{ errors.completion_date }}</small>
      </div>

      <!-- 项目保存路径 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: theme.content.text }">
          项目保存路径 <span class="text-red-500">*</span>
        </label>
        <div class="flex gap-2">
          <InputText
            v-model="form.folder_path"
            placeholder="选择保存目录..."
            class="flex-1"
            readonly
            :invalid="!!errors.folder_path"
          />
          <Button label="浏览" severity="secondary" @click="selectFolder" />
        </div>
        <small v-if="errors.folder_path" class="text-red-500">{{ errors.folder_path }}</small>
      </div>

      <!-- 备注 -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" :style="{ color: theme.content.text }">备注</label>
        <Textarea v-model="form.remark" placeholder="可选备注..." rows="2" class="w-full" autoResize />
      </div>

    </div>

    <template #footer>
      <Button label="取消" severity="secondary" @click="visible = false" />
      <Button label="创建项目" :loading="creating" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import { defaultTheme } from '../../../themes/default'
import { useProjectStore } from '../../../stores/project/projectStore'
import type { ProjectCreateDTO } from '@shared/types/project.types'

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ created: [projectId: string] }>()

const theme = defaultTheme
const store = useProjectStore()
const creating = ref(false)

const applicantTypeOptions = [
  { label: '个人', value: 'individual' },
  { label: '企业/单位', value: 'enterprise' },
]

const form = reactive({
  name: '',
  short_name: '',
  version: 'V1.0',
  applicant_type: 'individual' as 'individual' | 'enterprise',
  applicant_name: '',
  folder_path: '',
  remark: '',
})

const completionDate = ref<Date | null>(new Date())
const errors = reactive<Record<string, string>>({})

// Reset when dialog opens
watch(visible, (v) => {
  if (v) {
    form.name = ''
    form.short_name = ''
    form.version = 'V1.0'
    form.applicant_type = 'individual'
    form.applicant_name = ''
    form.folder_path = ''
    form.remark = ''
    completionDate.value = new Date()
    Object.keys(errors).forEach(k => delete errors[k])
  }
})

async function selectFolder() {
  const res = await window.electronAPI.bootstrap.selectFolder()
  if (res.success && res.data && !res.data.canceled && res.data.filePaths.length > 0) {
    form.folder_path = res.data.filePaths[0]
    delete errors.folder_path
  }
}

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.name.trim()) errors.name = '请输入软件名称'
  if (!form.applicant_name.trim()) errors.applicant_name = '请输入申请人名称'
  if (!form.folder_path) errors.folder_path = '请选择保存路径'
  if (!completionDate.value) errors.completion_date = '请选择完成日期'
  return Object.keys(errors).length === 0
}

async function submit() {
  if (!validate()) return

  const date = completionDate.value!
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const dto: ProjectCreateDTO = {
    name: form.name.trim(),
    short_name: form.short_name.trim() || undefined,
    version: form.version.trim() || 'V1.0',
    applicant_type: form.applicant_type,
    applicant_name: form.applicant_name.trim(),
    folder_path: form.folder_path,
    completion_date: dateStr,
    remark: form.remark.trim() || undefined,
  }

  creating.value = true
  try {
    const project = await store.createProject(dto)
    if (project) {
      visible.value = false
      emit('created', project.id)
    }
  } finally {
    creating.value = false
  }
}
</script>
