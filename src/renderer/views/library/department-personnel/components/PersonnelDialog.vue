<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    modal
    maximizable
    :header="isEdit ? '编辑员工' : '新增员工'"
    :style="{ width: '1440px', maxWidth: '98vw' }"
  >
    <div class="grid grid-cols-1 xl:grid-cols-[620px_minmax(0,1fr)] gap-4">
      <section class="min-w-0 overflow-hidden rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)]">
        <div class="flex items-start justify-between gap-3 border-b border-[var(--content-border)] bg-[var(--sidebar-bg)] px-4 py-3">
          <div class="min-w-0">
            <div class="font-semibold text-[var(--content-text)]">简历源文件预览</div>
            <div class="text-sm text-[var(--content-text-secondary)]">
              支持 PDF、Word、图片、Markdown、TXT，识别后直接回填到表单，再进行保存
            </div>
          </div>
          <Button
            icon="pi pi-file-import"
            label="选择简历并识别"
            severity="secondary"
            :loading="parsingResume"
            @click="openResumeImport"
          />
        </div>

        <div class="border-b border-[var(--content-border)] px-4 py-3 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-if="resumePreviewPath"
              :label="resumePreviewDisplayName"
              icon="pi pi-file"
              size="small"
              outlined
              @click="openResumeFile"
            />
            <span v-else class="text-sm text-[var(--content-text-secondary)]">尚未选择简历源文件</span>
            <Button
              v-if="resumePreviewPath"
              icon="pi pi-copy"
              size="small"
              text
              severity="secondary"
              @click="copyPreviewFileName"
              v-tooltip.top="'复制文件名'"
            />
            <Button
              v-if="resumePreviewPath"
              icon="pi pi-clipboard"
              size="small"
              text
              severity="secondary"
              @click="copyPreviewFileToClipboard"
              v-tooltip.top="'复制文件到剪贴板'"
            />
          </div>
          <p class="text-xs text-[var(--content-text-secondary)] break-all">
            {{ resumePreviewPath || '选择文件后会在这里显示源文件路径' }}
          </p>
        </div>

        <div class="h-[72vh] min-h-[640px] bg-[var(--content-bg)]">
          <ContractFilesPreviewPane
            v-if="visible && resumePreviewPath"
            :filePath="resumePreviewPath"
            :displayName="resumePreviewDisplayName"
            class="h-full"
          />
          <div v-else class="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--content-text-secondary)]">
            请选择一份简历源文件，左侧将显示预览，右侧可确认并补充员工信息。
          </div>
        </div>
      </section>

      <section class="max-h-[72vh] min-w-0 overflow-y-auto rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
        <Tabs v-model:value="activeTab">
          <TabList class="sticky top-0 z-10 bg-[var(--content-card-bg)]">
            <Tab value="basic">基本信息</Tab>
            <Tab value="salary">工资信息</Tab>
            <Tab value="archive">档案信息</Tab>
          </TabList>
          <TabPanels class="pt-4">
            <TabPanel value="basic">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <FieldItem label="编号" :error="errors.code">
                  <InputText v-model="form.code" class="w-full" :class="{ 'p-invalid': !!errors.code }" placeholder="不填则自动生成" />
                </FieldItem>
                <FieldItem label="姓名" required :error="errors.name">
                  <InputText v-model="form.name" class="w-full" :class="{ 'p-invalid': !!errors.name }" />
                </FieldItem>
                <FieldItem label="员工照片" class="md:col-span-2">
                  <div class="flex flex-col gap-3 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-4 md:flex-row md:items-center">
                    <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--content-border)] bg-[var(--sidebar-bg)]">
                      <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="员工照片预览" class="h-full w-full object-cover" />
                      <span v-else class="text-xl font-semibold tracking-wide text-[var(--content-text-secondary)]">{{ photoFallbackText }}</span>
                    </div>
                    <div class="min-w-0 flex-1 space-y-2">
                      <div class="flex flex-wrap gap-2">
                        <Button icon="pi pi-image" label="选择照片" severity="secondary" size="small" @click="openPhotoImport" />
                        <Button v-if="form.photo_file_path" icon="pi pi-times" label="移除照片" text severity="secondary" size="small" @click="clearPhoto" />
                      </div>
                      <p class="break-all text-xs text-[var(--content-text-secondary)]">
                        {{ form.photo_file_path || '支持 JPG、PNG、WEBP、BMP，保存时会自动复制到当前资源库。' }}
                      </p>
                    </div>
                  </div>
                </FieldItem>
                <FieldItem label="所属部门" required class="md:col-span-2" :error="errors.department_ids">
                  <TreeSelect
                    v-model="selectedDepartmentKeys"
                    :options="departmentOptions"
                    selectionMode="checkbox"
                    placeholder="请选择所属部门"
                    class="w-full"
                    :class="{ 'p-invalid': !!errors.department_ids }"
                    display="chip"
                    filter
                  />
                </FieldItem>
                <FieldItem label="岗位/职务" required :error="errors.position">
                  <InputText v-model="form.position" class="w-full" :class="{ 'p-invalid': !!errors.position }" />
                </FieldItem>
                <FieldItem label="手机号" required :error="errors.phone">
                  <InputText v-model="form.phone" class="w-full" :class="{ 'p-invalid': !!errors.phone }" />
                </FieldItem>
                <FieldItem label="邮箱" :error="errors.email">
                  <InputText v-model="form.email" class="w-full" :class="{ 'p-invalid': !!errors.email }" />
                </FieldItem>
                <FieldItem label="入职日期">
                  <InputText v-model="form.entry_date" type="date" class="w-full" />
                </FieldItem>
                <FieldItem label="状态" required :error="errors.status">
                  <Select
                    v-model="form.status"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :class="{ 'p-invalid': !!errors.status }"
                  />
                </FieldItem>
                <FieldItem label="性别">
                  <Select
                    v-model="form.gender"
                    :options="genderOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                  />
                </FieldItem>
                <FieldItem label="出生日期">
                  <InputText v-model="form.birth_date" type="date" class="w-full" />
                </FieldItem>
                <FieldItem label="档案编号">
                  <InputText v-model="form.archive_no" class="w-full" />
                </FieldItem>
                <FieldItem label="身份证号">
                  <InputText v-model="form.id_card_number" class="w-full" />
                </FieldItem>
                <FieldItem label="联系地址" class="md:col-span-2">
                  <Textarea v-model="form.address" class="w-full" rows="2" autoResize />
                </FieldItem>
              </div>
            </TabPanel>

            <TabPanel value="salary">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <FieldItem label="基本工资">
                  <InputNumber v-model="form.salary_base" class="w-full" :minFractionDigits="0" :maxFractionDigits="2" fluid />
                </FieldItem>
                <FieldItem label="月薪总额">
                  <InputNumber v-model="form.salary_monthly" class="w-full" :minFractionDigits="0" :maxFractionDigits="2" fluid />
                </FieldItem>
                <FieldItem label="工资币种">
                  <InputText v-model="form.salary_currency" class="w-full" placeholder="默认 CNY" />
                </FieldItem>
                <FieldItem label="开户行">
                  <InputText v-model="form.salary_bank_name" class="w-full" />
                </FieldItem>
                <FieldItem label="工资卡账号" class="md:col-span-2">
                  <InputText v-model="form.salary_bank_account" class="w-full" />
                </FieldItem>
              </div>
            </TabPanel>

            <TabPanel value="archive">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <FieldItem label="学历">
                  <InputText v-model="form.education" class="w-full" />
                </FieldItem>
                <FieldItem label="毕业院校">
                  <InputText v-model="form.graduate_school" class="w-full" />
                </FieldItem>
                <FieldItem label="专业">
                  <InputText v-model="form.major" class="w-full" />
                </FieldItem>
                <FieldItem label="紧急联系人">
                  <InputText v-model="form.emergency_contact" class="w-full" />
                </FieldItem>
                <FieldItem label="紧急联系人电话">
                  <InputText v-model="form.emergency_contact_phone" class="w-full" />
                </FieldItem>
                <FieldItem label="简历文件路径" class="md:col-span-2">
                  <InputText v-model="form.resume_file_path" class="w-full" readonly />
                </FieldItem>
                <FieldItem label="工作经历摘要" class="md:col-span-2">
                  <Textarea v-model="form.work_experience" class="w-full" rows="4" autoResize />
                </FieldItem>
                <FieldItem label="备注" class="md:col-span-2">
                  <Textarea v-model="form.remark" class="w-full" rows="3" autoResize />
                </FieldItem>
                <FieldItem label="简历识别文本" class="md:col-span-2">
                  <Textarea v-model="form.resume_text" class="w-full" rows="8" autoResize />
                </FieldItem>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </section>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" class="p-button-text" @click="emit('update:visible', false)" :disabled="saving" />
        <Button label="保存" class="p-button-primary" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, reactive, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import TreeSelect from 'primevue/treeselect';
import Select from 'primevue/select';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import { IdGenerator } from '../../../../../shared/utils/idGenerator';
import ContractFilesPreviewPane from '../../contract-files/components/ContractFilesPreviewPane.vue';
import { copyTextToClipboard } from '../../contract-files/contractFilesHelpers';
import { getPersonnelPhotoFallbackText, resolvePersonnelPhotoUrl } from '../personnelPhoto';
import type {
  Personnel,
  PersonnelCreateDTO,
  PersonnelResumeParseResult,
  PersonnelResumeParsedData,
  PersonnelUpdateDTO,
} from '../../../../../shared/types/personnel.types';

type TreeNode = { key: string; label: string; children?: TreeNode[] };
type TreeSelectSelection = Record<string, boolean | { checked?: boolean; partialChecked?: boolean }>;
type PersonnelFormModel = PersonnelCreateDTO & { resume_text: string; resume_file_path: string; work_experience: string };

const FieldItem = defineComponent({
  name: 'FieldItem',
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    error: { type: String, default: '' },
    class: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: props.class }, [
        h('label', { class: 'mb-1.5 block text-sm font-medium text-[var(--content-text)]' }, [
          props.required ? h('span', { class: 'text-red-500 mr-1' }, '*') : null,
          props.label,
        ]),
        slots.default?.(),
        h('small', { class: props.error ? 'text-red-500' : 'opacity-0 block select-none' }, props.error || '占位'),
      ]);
  },
});

const props = defineProps<{
  visible: boolean;
  isEdit?: boolean;
  initialData?: Personnel | null;
  initialDraft?: Partial<PersonnelCreateDTO> & Partial<PersonnelResumeParsedData> & { resume_text?: string; resume_file_path?: string } | null;
  departmentOptions?: TreeNode[];
  defaultDepartmentId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved', personnel?: Personnel): void;
}>();

const statusOptions = [
  { label: '在职', value: '在职' },
  { label: '休假', value: '休假' },
  { label: '离职', value: '离职' },
];

const genderOptions = [
  { label: '未填写', value: '' },
  { label: '男', value: '男' },
  { label: '女', value: '女' },
];

const toast = useToast();
const saving = ref(false);
const parsingResume = ref(false);
const activeTab = ref<'basic' | 'salary' | 'archive'>('basic');
const selectedResumeFilePath = ref('');
const departmentOptions = computed(() => props.departmentOptions || []);

const getFileName = (filePath?: string | null) => {
  const normalized = String(filePath || '').trim();
  if (!normalized) return '';
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || normalized;
};

const resumePreviewPath = computed(() => String(selectedResumeFilePath.value || form.resume_file_path || '').trim());
const resumePreviewDisplayName = computed(() => getFileName(resumePreviewPath.value) || 'resume');
const photoPreviewUrl = computed(() => resolvePersonnelPhotoUrl(form.photo_file_path));
const photoFallbackText = computed(() => getPersonnelPhotoFallbackText(form.name));

const createEmptyForm = (): PersonnelFormModel => ({
  code: IdGenerator.generateCode('PER'),
  name: '',
  department_ids: props.defaultDepartmentId ? [props.defaultDepartmentId] : [],
  position: '',
  phone: '',
  email: '',
  entry_date: '',
  status: '在职',
  salary_base: null,
  salary_monthly: null,
  salary_currency: 'CNY',
  salary_bank_name: '',
  salary_bank_account: '',
  archive_no: '',
  gender: '',
  birth_date: '',
  id_card_number: '',
  photo_file_path: '',
  address: '',
  education: '',
  graduate_school: '',
  major: '',
  emergency_contact: '',
  emergency_contact_phone: '',
  resume_file_path: '',
  resume_text: '',
  work_experience: '',
  remark: '',
});

const form = reactive<PersonnelFormModel>(createEmptyForm());
const errors = reactive<Record<string, string>>({
  code: '',
  name: '',
  department_ids: '',
  position: '',
  phone: '',
  email: '',
  status: '',
});

const clearErrors = () => {
  Object.keys(errors).forEach((key) => {
    errors[key] = '';
  });
};

const normalizeDepartmentId = (value?: string | null) => {
  const id = String(value || '').trim();
  return id || null;
};

const extractSelectedDepartmentIds = (selection: TreeSelectSelection | null | undefined): string[] => {
  if (!selection) return [];
  const ids = Object.entries(selection)
    .filter(([, value]) => value === true || (typeof value === 'object' && Boolean(value?.checked)))
    .map(([key]) => normalizeDepartmentId(key))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(ids));
};

const toTreeSelection = (ids: string[]): TreeSelectSelection => {
  const selection: TreeSelectSelection = {};
  ids
    .map(id => normalizeDepartmentId(id))
    .filter((item): item is string => Boolean(item))
    .forEach((id) => {
      selection[id] = { checked: true };
    });
  return selection;
};

const selectedDepartmentKeys = computed<TreeSelectSelection>({
  get: () => toTreeSelection(form.department_ids || []),
  set: (value) => {
    form.department_ids = extractSelectedDepartmentIds(value);
    if (errors.department_ids) {
      errors.department_ids = '';
    }
  },
});

const applyFormValues = (source?: Partial<PersonnelCreateDTO> & Partial<PersonnelResumeParsedData> & { resume_text?: string; resume_file_path?: string }) => {
  const next = createEmptyForm();
  Object.assign(next, source || {});
  Object.assign(form, {
    ...next,
    code: String(next.code || '').trim() || IdGenerator.generateCode('PER'),
    name: String(next.name || '').trim(),
    department_ids: Array.isArray(next.department_ids) ? Array.from(new Set(next.department_ids.map(item => String(item || '').trim()).filter(Boolean))) : [],
    position: String(next.position || '').trim(),
    phone: String(next.phone || '').trim(),
    email: String(next.email || '').trim(),
    entry_date: String(next.entry_date || '').trim(),
    status: String(next.status || '在职').trim() || '在职',
    salary_base: next.salary_base === undefined || next.salary_base === null || next.salary_base === '' ? null : Number(next.salary_base),
    salary_monthly: next.salary_monthly === undefined || next.salary_monthly === null || next.salary_monthly === '' ? null : Number(next.salary_monthly),
    salary_currency: String(next.salary_currency || 'CNY').trim() || 'CNY',
    salary_bank_name: String(next.salary_bank_name || '').trim(),
    salary_bank_account: String(next.salary_bank_account || '').trim(),
    archive_no: String(next.archive_no || '').trim(),
    gender: String(next.gender || '').trim(),
    birth_date: String(next.birth_date || '').trim(),
    id_card_number: String(next.id_card_number || '').trim(),
    photo_file_path: String(next.photo_file_path || '').trim(),
    address: String(next.address || '').trim(),
    education: String(next.education || '').trim(),
    graduate_school: String(next.graduate_school || '').trim(),
    major: String(next.major || '').trim(),
    emergency_contact: String(next.emergency_contact || '').trim(),
    emergency_contact_phone: String(next.emergency_contact_phone || '').trim(),
    resume_file_path: String(next.resume_file_path || '').trim(),
    resume_text: String(next.resume_text || '').trim(),
    work_experience: String(next.work_experience || '').trim(),
    remark: String(next.remark || '').trim(),
  });
};

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      // Ensure preview subtree is torn down before dialog transition completes,
      // avoiding stale preview component events during close.
      selectedResumeFilePath.value = '';
      return;
    }
    clearErrors();
    activeTab.value = 'basic';
    selectedResumeFilePath.value = '';
    if (props.isEdit && props.initialData) {
      applyFormValues(props.initialData);
      return;
    }
    applyFormValues({
      ...(props.initialDraft || {}),
      code: IdGenerator.generateCode('PER'),
      department_ids: Array.isArray(props.initialDraft?.department_ids) && props.initialDraft?.department_ids.length > 0
        ? props.initialDraft.department_ids
        : (props.defaultDepartmentId ? [props.defaultDepartmentId] : []),
      status: '在职',
      salary_currency: 'CNY',
    });
    await nextTick();
  },
);

const validate = () => {
  clearErrors();
  let valid = true;
  if (!String(form.name || '').trim()) {
    errors.name = '请输入姓名';
    valid = false;
  }
  if (!Array.isArray(form.department_ids) || form.department_ids.length === 0) {
    errors.department_ids = '请选择至少一个所属部门';
    valid = false;
  }
  if (!String(form.position || '').trim()) {
    errors.position = '请输入岗位/职务';
    valid = false;
  }
  if (!String(form.phone || '').trim()) {
    errors.phone = '请输入手机号';
    valid = false;
  }
  const email = String(form.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = '邮箱格式不正确';
    valid = false;
  }
  if (!String(form.status || '').trim()) {
    errors.status = '请选择状态';
    valid = false;
  }
  return valid;
};

const buildPayload = (): PersonnelCreateDTO => ({
  code: String(form.code || '').trim() || IdGenerator.generateCode('PER'),
  name: String(form.name || '').trim(),
  department_ids: Array.from(new Set((form.department_ids || []).map(item => String(item || '').trim()).filter(Boolean))),
  position: String(form.position || '').trim(),
  phone: String(form.phone || '').trim(),
  email: String(form.email || '').trim(),
  entry_date: String(form.entry_date || '').trim(),
  status: String(form.status || '').trim() || '在职',
  salary_base: form.salary_base === null || form.salary_base === undefined || form.salary_base === '' ? null : Number(form.salary_base),
  salary_monthly: form.salary_monthly === null || form.salary_monthly === undefined || form.salary_monthly === '' ? null : Number(form.salary_monthly),
  salary_currency: String(form.salary_currency || 'CNY').trim() || 'CNY',
  salary_bank_name: String(form.salary_bank_name || '').trim(),
  salary_bank_account: String(form.salary_bank_account || '').trim(),
  archive_no: String(form.archive_no || '').trim(),
  gender: String(form.gender || '').trim(),
  birth_date: String(form.birth_date || '').trim(),
  id_card_number: String(form.id_card_number || '').trim(),
  photo_file_path: String(form.photo_file_path || '').trim(),
  address: String(form.address || '').trim(),
  education: String(form.education || '').trim(),
  graduate_school: String(form.graduate_school || '').trim(),
  major: String(form.major || '').trim(),
  emergency_contact: String(form.emergency_contact || '').trim(),
  emergency_contact_phone: String(form.emergency_contact_phone || '').trim(),
  resume_file_path: String(form.resume_file_path || '').trim(),
  resume_text: String(form.resume_text || '').trim(),
  work_experience: String(form.work_experience || '').trim(),
  remark: String(form.remark || '').trim(),
});

const save = async () => {
  if (!validate()) return;
  saving.value = true;
  try {
    const payload = buildPayload();
    const result = props.isEdit && props.initialData
      ? await window.electronAPI.personnel.update({ id: props.initialData.id, ...(payload as PersonnelUpdateDTO) })
      : await window.electronAPI.personnel.create(payload);
    if (!result.success) {
      toast.add({ severity: 'error', summary: '保存失败', detail: result.error || '未知错误', life: 3000 });
      return;
    }
    toast.add({ severity: 'success', summary: '成功', detail: props.isEdit ? '员工信息已更新' : '员工已创建', life: 2500 });
    emit('saved', result.data);
    emit('update:visible', false);
  } catch (error: any) {
    const detail = String(error?.message || '').trim() || '出现异常，请稍后重试';
    toast.add({ severity: 'error', summary: '保存失败', detail, life: 3500 });
  } finally {
    saving.value = false;
  }
};

const openResumeImport = async () => {
  parsingResume.value = true;
  try {
    const selected = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [
        { name: '简历文件', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });
    if (!selected.success || !selected.data) {
      throw new Error(selected.error || '选择简历文件失败');
    }
    if ((selected.data as any).canceled) return;
    const filePath = String((selected.data as any).filePaths?.[0] || '').trim();
    if (!filePath) return;
    const parsed = await window.electronAPI.personnel.parseResume({ filePath });
    if (!parsed.success || !parsed.data) {
      throw new Error(parsed.error || '简历识别失败');
    }
    selectedResumeFilePath.value = String(parsed.data.draft.resume_file_path || '').trim();
    applyResumeDraft(parsed.data.draft);
  } catch (error: any) {
    selectedResumeFilePath.value = '';
    toast.add({
      severity: 'error',
      summary: '简历识别失败',
      detail: String(error?.message || '').trim() || '请稍后重试',
      life: 3500,
    });
  } finally {
    parsingResume.value = false;
  }
};

const openPhotoImport = async () => {
  try {
    const selected = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });
    if (!selected.success || !selected.data) {
      throw new Error(selected.error || '选择照片失败');
    }
    if ((selected.data as any).canceled) return;
    const filePath = String((selected.data as any).filePaths?.[0] || '').trim();
    if (!filePath) return;
    form.photo_file_path = filePath;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: '选择照片失败',
      detail: String(error?.message || '').trim() || '请稍后重试',
      life: 3000,
    });
  }
};

const clearPhoto = () => {
  form.photo_file_path = '';
};

const mergeTextField = (currentValue: string, incomingValue?: string) => {
  const incoming = String(incomingValue || '').trim();
  if (!incoming) return currentValue;
  return incoming;
};

const applyResumeDraft = (draft?: PersonnelResumeParseResult['draft']) => {
  if (!draft) return;
  if (draft.name) form.name = String(draft.name).trim();
  if (draft.position) form.position = String(draft.position).trim();
  if (draft.phone) form.phone = String(draft.phone).trim();
  if (draft.email) form.email = String(draft.email).trim();
  if (draft.salary_base !== undefined) form.salary_base = draft.salary_base ?? null;
  if (draft.salary_monthly !== undefined) form.salary_monthly = draft.salary_monthly ?? null;
  if (draft.salary_currency) form.salary_currency = String(draft.salary_currency).trim() || 'CNY';
  if (draft.salary_bank_name) form.salary_bank_name = String(draft.salary_bank_name).trim();
  if (draft.salary_bank_account) form.salary_bank_account = String(draft.salary_bank_account).trim();
  if (draft.archive_no) form.archive_no = String(draft.archive_no).trim();
  if (draft.gender) form.gender = String(draft.gender).trim();
  if (draft.birth_date) form.birth_date = String(draft.birth_date).trim();
  if (draft.id_card_number) form.id_card_number = String(draft.id_card_number).trim();
  if (draft.address) form.address = String(draft.address).trim();
  if (draft.education) form.education = String(draft.education).trim();
  if (draft.graduate_school) form.graduate_school = String(draft.graduate_school).trim();
  if (draft.major) form.major = String(draft.major).trim();
  if (draft.emergency_contact) form.emergency_contact = String(draft.emergency_contact).trim();
  if (draft.emergency_contact_phone) form.emergency_contact_phone = String(draft.emergency_contact_phone).trim();
  form.resume_file_path = mergeTextField(form.resume_file_path, draft.resume_file_path);
  form.resume_text = mergeTextField(form.resume_text, draft.resume_text);
  form.work_experience = mergeTextField(form.work_experience, draft.work_experience);
  form.remark = mergeTextField(form.remark, draft.remark);
  toast.add({ severity: 'success', summary: '已回填', detail: '识别结果已写入表单，请确认后保存', life: 2500 });
};

const openResumeFile = async () => {
  const filePath = resumePreviewPath.value;
  if (!filePath) return;
  const res = await window.electronAPI.fs.openFile(filePath);
  if (!res.success) {
    toast.add({ severity: 'error', summary: '打开失败', detail: res.error || '无法打开简历文件', life: 3000 });
  }
};

const copyPreviewFileName = async () => {
  const fileName = resumePreviewDisplayName.value;
  if (!fileName) return;
  const ok = await copyTextToClipboard(fileName);
  toast.add({
    severity: ok ? 'success' : 'warn',
    summary: ok ? '已复制' : '复制失败',
    detail: ok ? '文件名已复制到剪贴板' : '无法复制文件名',
    life: 2500,
  });
};

const copyPreviewFileToClipboard = async () => {
  const filePath = resumePreviewPath.value;
  if (!filePath) return;
  const res = await window.electronAPI.fs.clipboardWriteFile(filePath);
  toast.add({
    severity: res.success ? 'success' : 'warn',
    summary: res.success ? '已复制' : '复制失败',
    detail: res.success ? '简历源文件已写入剪贴板' : (res.error || '无法复制文件到剪贴板'),
    life: 3000,
  });
};

defineExpose({
  openResumeImport,
});
</script>
