import { computed, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { DataTableRowReorderEvent } from 'primevue/datatable'
import { useAIStore } from '../../../stores/system/aiStore'
import { createRendererLogger } from '@/utils/logger'
import type {
  ContractFormSchema,
  ContractFormSchemaConfig,
  ContractFormSchemaField,
  ContractFormSection,
  ContractFieldType,
  ContractFieldOptionSourceType,
} from '../../../../shared/types/contractFormSchema.types'
import { DEFAULT_CONTRACT_TYPE_SCHEMA_KEY } from '../../../../shared/types/contractFormSchema.types'
import {
  getContractTypeSchemaKeys,
  getContractTypeSchemaStorageKey,
  getDefaultContractFormSchema,
  getDefaultContractFormSchemaConfig,
  isContractFieldInDefaultTab,
  isContractFieldInExtendedTab,
  isContractBuiltinFieldKey,
  normalizeContractFieldKey,
  normalizeContractFormSchema,
  normalizeContractFormSchemaConfig,
} from '../../../../shared/utils/contractFormSchema'

type SelectOption = {
  label: string
  value: string
}

type GroupTreeNode = {
  key?: string | number
  label?: string
  data?: string
  children?: GroupTreeNode[]
}

export function useContractConfigView() {
  const toast = useToast()
  const confirm = useConfirm()
  const aiStore = useAIStore()
  const logger = createRendererLogger('ContractConfigView')

  const activeTab = ref('default')
  const saving = ref(false)
  const schemaFileProcessing = ref(false)
  const previewDialogVisible = ref(false)
  const filterBarVisible = ref(true)
  const editingRows = ref([])
  const schemaConfig = reactive<ContractFormSchemaConfig>(getDefaultContractFormSchemaConfig())
  const currentSchema = reactive<ContractFormSchema>(getDefaultContractFormSchema())
  const selectedContractTypeKey = ref(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
  const contractTypeOptions = ref<SelectOption[]>([])
  const dictionaryGroupOptions = ref<SelectOption[]>([])
  const treeDictionaryGroupOptions = ref<SelectOption[]>([])

  const libraryPath = computed(() => String(localStorage.getItem('currentLibraryPath') || '').trim())
  const libraryNameText = computed(() => localStorage.getItem('currentLibraryName') || '当前资源库')

  const sectionLabelMap: Record<ContractFormSection, string> = {
    base: '基础信息',
    content: '合同内容',
  }

  const typeLabelMap: Record<ContractFieldType, string> = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期',
    select: '单选',
    multiselect: '多选',
    tree: '树形选择',
    richtext: '富文本',
  }

  const contractTypePopover = ref<any>(null)
  const contractTypeSearchQuery = ref('')

  const sectionOptions = [
    { label: '基础信息', value: 'base' },
    { label: '合同内容', value: 'content' },
  ]

  const fieldTypeOptions = [
    { label: '单行文本', value: 'text' },
    { label: '多行文本', value: 'textarea' },
    { label: '数字', value: 'number' },
    { label: '日期', value: 'date' },
    { label: '单选', value: 'select' },
    { label: '多选', value: 'multiselect' },
    { label: '树形选择', value: 'tree' },
    { label: '富文本', value: 'richtext' },
  ]

  const optionSourceTypeOptions: Array<{ label: string; value: ContractFieldOptionSourceType }> = [
    { label: '手动输入', value: 'manual' },
    { label: '普通字典', value: 'dictionary' },
    { label: '树形字典', value: 'treeDictionary' },
    { label: '甲方单位', value: 'partyAUnit' },
    { label: '乙方单位', value: 'partyBUnit' },
  ]

  const spanOptions = [
    { label: '半宽', value: 1 },
    { label: '整行', value: 2 },
  ]

  const builtinFields = computed(() => currentSchema.fields.filter((f) => isContractFieldInDefaultTab(f)))

  const extendedFields = computed(() => {
    return currentSchema.fields
      .filter((f) => isContractFieldInExtendedTab(f))
      .slice()
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1
        if (a.order !== b.order) return a.order - b.order
        return a.key.localeCompare(b.key, 'zh-CN')
      })
  })

  const previewFields = computed(() => normalizeContractFormSchema(currentSchema).fields)

  const contractTypeSelectOptions = computed<SelectOption[]>(() => {
    const configuredOptions = getContractTypeSchemaKeys(schemaConfig).map((contractType) => ({
      label: contractType,
      value: contractType,
    }))
    const merged = new Map<string, SelectOption>()
    merged.set(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY, { label: '默认', value: DEFAULT_CONTRACT_TYPE_SCHEMA_KEY })
    for (const option of [...contractTypeOptions.value, ...configuredOptions]) {
      const value = String(option.value || '').trim()
      const label = String(option.label || option.value || '').trim()
      if (!value || merged.has(value)) continue
      merged.set(value, { label, value })
    }
    return Array.from(merged.values())
  })

  const filteredContractTypeOptions = computed(() => {
    const query = contractTypeSearchQuery.value.trim().toLowerCase()
    if (!query) return contractTypeSelectOptions.value
    return contractTypeSelectOptions.value.filter(
      (opt) => opt.label.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query)
    )
  })

  const selectedContractTypeLabel = computed(() => {
    return contractTypeSelectOptions.value.find((option) => option.value === selectedContractTypeKey.value)?.label || '默认'
  })

  const schemaModeLabel = computed(() => {
    return selectedContractTypeKey.value === DEFAULT_CONTRACT_TYPE_SCHEMA_KEY ? '默认' : '合同类型'
  })

  const toggleContractTypePopover = (event: Event) => {
    contractTypeSearchQuery.value = ''
    contractTypePopover.value?.toggle?.(event)
  }

  const handleContractTypeChange = (value: string) => {
    persistCurrentSchema()
    applySelectedSchema(String(value || ''))
  }

  const selectContractType = (value: string) => {
    handleContractTypeChange(value)
    contractTypePopover.value?.hide?.()
  }

  const clearContractTypeSelection = () => {
    handleContractTypeChange(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
  }

  const customFieldDialogVisible = ref(false)
  const isEditMode = ref(false)
  const editingFieldIndex = ref(-1)
  const customFieldError = ref('')
  const customFieldOptionsText = ref('')
  const customFieldOptionSourceType = ref<ContractFieldOptionSourceType>('manual')
  const customFieldOptionSourceGroupName = ref('')
  const customFieldDraft = reactive<ContractFormSchemaField>({
    key: '',
    label: '',
    type: 'text',
    section: 'content',
    displayTab: 'extended',
    required: false,
    visible: true,
    order: 0,
    span: 1,
    placeholder: '',
    aiPrompt: '',
    options: [],
    optionSource: undefined,
    builtin: false,
    lockedVisible: false,
    lockedRequired: false,
    lockedKey: false,
    lockedType: false,
  })

  const ensureAISettingsInitialized = async () => {
    if (aiStore.isInitialized) return
    try {
      await aiStore.initAISettings()
    } catch (error) {
      logger.error('初始化 AI 配置失败', error)
    }
  }

  const isAIConfigReadyForRequest = computed(() => {
    if (!aiStore.enabled) return false
    if (aiStore.mode === 'cloud') return Boolean(String(aiStore.apiKey || '').trim())

    const selectedModel =
      aiStore.localModels.find((item) => item.id === aiStore.selectedModelId) || aiStore.localModels[0]
    return Boolean(String(selectedModel?.modelPath || '').trim() && String(selectedModel?.executablePath || '').trim())
  })

  const customFieldLabelAiGenerating = ref(false)
  const shouldShowCustomFieldLabelAiIcon = computed(() => aiStore.enabled && !isEditMode.value)
  const suppressCustomFieldKeyTracking = ref(false)
  const customFieldKeyManuallyEdited = ref(false)

  const setCustomFieldKey = (value: string) => {
    suppressCustomFieldKeyTracking.value = true
    customFieldDraft.key = value
    suppressCustomFieldKeyTracking.value = false
  }

  const cloneSchema = (nextSchema: ContractFormSchema) => {
    const normalized = normalizeContractFormSchema(nextSchema)
    return {
      version: normalized.version,
      fields: normalized.fields.map((field) => ({
        ...field,
        options: field.options ? [...field.options] : undefined,
        optionSource: field.optionSource ? { ...field.optionSource } : undefined,
      })),
    }
  }

  const assignSchema = (target: ContractFormSchema, nextSchema: ContractFormSchema) => {
    const normalized = cloneSchema(nextSchema)
    target.version = normalized.version
    target.fields = normalized.fields
  }

  const assignSchemaConfig = (nextConfig: ContractFormSchemaConfig) => {
    const normalized = normalizeContractFormSchemaConfig(nextConfig)
    schemaConfig.version = normalized.version
    schemaConfig.defaultSchema = cloneSchema(normalized.defaultSchema)
    schemaConfig.schemasByContractType = Object.fromEntries(
      Object.entries(normalized.schemasByContractType).map(([contractType, schema]) => [contractType, cloneSchema(schema)])
    )
  }

  const persistCurrentSchema = () => {
    const normalizedSchema = cloneSchema(currentSchema)
    if (selectedContractTypeKey.value === DEFAULT_CONTRACT_TYPE_SCHEMA_KEY) {
      schemaConfig.defaultSchema = normalizedSchema
      return
    }
    schemaConfig.schemasByContractType = {
      ...schemaConfig.schemasByContractType,
      [selectedContractTypeKey.value]: normalizedSchema,
    }
  }

  const ensureSchemaForContractType = (contractTypeKey: string) => {
    const normalizedKey = getContractTypeSchemaStorageKey(contractTypeKey)
    if (normalizedKey === DEFAULT_CONTRACT_TYPE_SCHEMA_KEY) return schemaConfig.defaultSchema
    const existingSchema = schemaConfig.schemasByContractType[normalizedKey]
    if (existingSchema) return existingSchema
    const createdSchema = cloneSchema(schemaConfig.defaultSchema)
    schemaConfig.schemasByContractType = {
      ...schemaConfig.schemasByContractType,
      [normalizedKey]: createdSchema,
    }
    return createdSchema
  }

  const applySelectedSchema = (contractTypeKey: string) => {
    selectedContractTypeKey.value = getContractTypeSchemaStorageKey(contractTypeKey)
    assignSchema(currentSchema, ensureSchemaForContractType(selectedContractTypeKey.value))
  }

  const supportsOptionSource = (type: ContractFieldType) => type === 'select' || type === 'multiselect' || type === 'tree'

  const getOptionSourceTypeLabel = (type: ContractFieldOptionSourceType) => {
    if (type === 'dictionary') return '普通字典'
    if (type === 'treeDictionary') return '树形字典'
    if (type === 'partyAUnit') return '甲方单位'
    if (type === 'partyBUnit') return '乙方单位'
    return '手动输入'
  }

  const requiresOptionSourceGroupSelection = (type: ContractFieldOptionSourceType) => type === 'dictionary' || type === 'treeDictionary'

  const getFixedOptionSourceGroupName = (type: ContractFieldOptionSourceType) => {
    if (type === 'partyAUnit') return '甲方单位'
    if (type === 'partyBUnit') return '乙方单位'
    return ''
  }

  const getOptionSourceGroupOptionsByType = (type: ContractFieldOptionSourceType): SelectOption[] => {
    if (type === 'dictionary') return dictionaryGroupOptions.value
    if (type === 'treeDictionary') return treeDictionaryGroupOptions.value
    return []
  }

  const getOptionSourcePreviewHint = (type: ContractFieldOptionSourceType) => {
    if (type === 'dictionary' || type === 'treeDictionary') return `预览和新增合同表单会动态读取所选${getOptionSourceTypeLabel(type)}分组数据`
    if (type === 'partyAUnit' || type === 'partyBUnit') return `预览和新增合同表单会动态读取${getOptionSourceTypeLabel(type)}数据`
    return ''
  }

  const getAvailableOptionSourceTypeOptions = (type: ContractFieldType) => (supportsOptionSource(type) ? optionSourceTypeOptions : [])

  const getFieldOptionSourceType = (field: ContractFormSchemaField): ContractFieldOptionSourceType => {
    if (!supportsOptionSource(field.type)) return 'manual'
    return field.optionSource?.type || 'manual'
  }

  const getFieldOptionSourceGroupName = (field: ContractFormSchemaField) => {
    if (field.optionSource?.type) {
      const fixedGroupName = getFixedOptionSourceGroupName(field.optionSource.type)
      if (fixedGroupName) return fixedGroupName
    }
    return String(field.optionSource?.groupName || '').trim()
  }

  const getFieldOptionSourceGroupOptions = (field: ContractFormSchemaField): SelectOption[] => {
    return getOptionSourceGroupOptionsByType(getFieldOptionSourceType(field))
  }

  const updateFieldOptionSourceType = (field: ContractFormSchemaField, value: unknown) => {
    if (!supportsOptionSource(field.type)) {
      field.optionSource = undefined
      field.options = undefined
      return
    }
    const sourceType =
      value === 'dictionary' || value === 'treeDictionary' || value === 'partyAUnit' || value === 'partyBUnit' ? value : 'manual'
    if (sourceType === 'manual') {
      field.optionSource = undefined
      return
    }
    const fixedGroupName = getFixedOptionSourceGroupName(sourceType)
    const groupOptions = getOptionSourceGroupOptionsByType(sourceType)
    const currentGroupName = field.optionSource?.type === sourceType ? String(field.optionSource.groupName || '').trim() : ''
    field.optionSource = { type: sourceType, groupName: fixedGroupName || currentGroupName || groupOptions[0]?.value || '' }
  }

  const updateFieldOptionSourceGroupName = (field: ContractFormSchemaField, value: unknown) => {
    const sourceType = getFieldOptionSourceType(field)
    if (sourceType === 'manual') {
      field.optionSource = undefined
      return
    }
    const fixedGroupName = getFixedOptionSourceGroupName(sourceType)
    field.optionSource = { type: sourceType, groupName: fixedGroupName || String(value || '').trim() }
  }

  const getFieldOptionSourceSummary = (field: ContractFormSchemaField) => {
    if (!supportsOptionSource(field.type)) return '不适用'
    const sourceType = getFieldOptionSourceType(field)
    if (sourceType === 'manual') {
      const count = Array.isArray(field.options) ? field.options.length : 0
      return count > 0 ? `手动选项（${count} 项）` : '手动选项'
    }
    if (sourceType === 'partyAUnit' || sourceType === 'partyBUnit') return getOptionSourceTypeLabel(sourceType)
    const sourceLabel = getOptionSourceTypeLabel(sourceType)
    const groupName = getFieldOptionSourceGroupName(field)
    return groupName ? `${sourceLabel} / ${groupName}` : `${sourceLabel} / 未选择分组`
  }

  const sanitizeFieldForSave = (field: ContractFormSchemaField): ContractFormSchemaField => {
    const normalizedAiPrompt = String(field.aiPrompt || '').trim() || undefined
    const normalizedOptions = Array.isArray(field.options)
      ? Array.from(new Set(field.options.map((item) => String(item || '').trim()).filter(Boolean)))
      : undefined
    const baseField: ContractFormSchemaField = { ...field, aiPrompt: normalizedAiPrompt }
    if (!supportsOptionSource(field.type)) {
      return { ...baseField, options: undefined, optionSource: undefined }
    }

    const sourceType = baseField.optionSource?.type
    const groupName = String(baseField.optionSource?.groupName || '').trim()
    const fixedGroupName = sourceType ? getFixedOptionSourceGroupName(sourceType) : ''
    if (sourceType && sourceType !== 'manual' && (fixedGroupName || groupName)) {
      return { ...baseField, options: undefined, optionSource: { type: sourceType, groupName: fixedGroupName || groupName } }
    }
    return { ...baseField, options: normalizedOptions, optionSource: undefined }
  }

  const collectGroupNames = (nodes: GroupTreeNode[], names = new Set<string>()) => {
    for (const node of nodes) {
      const name = String(node.data || node.label || '').trim()
      if (name && name !== '所有分组') names.add(name)
      if (Array.isArray(node.children) && node.children.length > 0) collectGroupNames(node.children, names)
    }
    return names
  }

  const toSortedSelectOptions = (names: Iterable<string>): SelectOption[] => {
    return Array.from(new Set(Array.from(names).map((item) => String(item || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((item) => ({ label: item, value: item }))
  }

  const parseGroupSettingOptions = (rawValue: unknown): SelectOption[] => {
    if (typeof rawValue !== 'string' || !rawValue.trim()) return []
    try {
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) return []
      return toSortedSelectOptions(collectGroupNames(parsed as GroupTreeNode[]))
    } catch {
      return []
    }
  }

  const loadOptionSourceGroups = async () => {
    const [dictionaryTreeSetting, treeDictionaryTreeSetting, dictionaryListResult, treeDictionaryListResult] = await Promise.allSettled([
      window.electronAPI.db.getSetting('dictionary_groups_tree'),
      window.electronAPI.db.getSetting('tree_dictionary_groups_tree'),
      window.electronAPI.dictionary.getList({ page: 1, pageSize: 1000 }),
      window.electronAPI.treeDictionary.getList({ page: 1, pageSize: 1000 }),
    ])

    const dictionaryNames = new Set<string>()
    const treeDictionaryNames = new Set<string>()

    if (dictionaryTreeSetting.status === 'fulfilled' && dictionaryTreeSetting.value.success && dictionaryTreeSetting.value.data?.value) {
      for (const option of parseGroupSettingOptions(dictionaryTreeSetting.value.data.value)) dictionaryNames.add(option.value)
    }
    if (
      treeDictionaryTreeSetting.status === 'fulfilled' &&
      treeDictionaryTreeSetting.value.success &&
      treeDictionaryTreeSetting.value.data?.value
    ) {
      for (const option of parseGroupSettingOptions(treeDictionaryTreeSetting.value.data.value)) treeDictionaryNames.add(option.value)
    }
    if (dictionaryListResult.status === 'fulfilled' && dictionaryListResult.value.success && dictionaryListResult.value.data) {
      for (const item of dictionaryListResult.value.data.data) {
        const groupName = String(item.group_name || '').trim()
        if (groupName) dictionaryNames.add(groupName)
      }
    }
    if (treeDictionaryListResult.status === 'fulfilled' && treeDictionaryListResult.value.success && treeDictionaryListResult.value.data) {
      for (const item of treeDictionaryListResult.value.data.data) {
        const groupName = String(item.group_name || '').trim()
        if (groupName) treeDictionaryNames.add(groupName)
      }
    }

    dictionaryGroupOptions.value = toSortedSelectOptions(dictionaryNames)
    treeDictionaryGroupOptions.value = toSortedSelectOptions(treeDictionaryNames)
  }

  const loadContractTypeOptions = async () => {
    try {
      const result = await window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 })
      if (!result.success || !result.data) {
        contractTypeOptions.value = []
        return
      }
      contractTypeOptions.value = result.data.data
        .map((item: { name?: string; value?: string | null }) => {
          const value = String(item.value || item.name || '').trim()
          const label = String(item.name || item.value || '').trim()
          return value && label ? { label, value } : null
        })
        .filter((item): item is SelectOption => Boolean(item))
    } catch {
      contractTypeOptions.value = []
    }
  }

  const loadSchema = async () => {
    const currentLibraryPath = libraryPath.value
    if (!currentLibraryPath) {
      assignSchemaConfig(getDefaultContractFormSchemaConfig())
      applySelectedSchema(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
      return
    }
    const result = await window.electronAPI.library.getContractFormSchema({ libraryPath: currentLibraryPath })
    if (result.success && result.data) {
      assignSchemaConfig(result.data)
      applySelectedSchema(selectedContractTypeKey.value)
      return
    }
    toast.add({ severity: 'warn', summary: '读取配置失败', detail: result.error || '已回退到默认', life: 3000 })
    assignSchemaConfig(getDefaultContractFormSchemaConfig())
    applySelectedSchema(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
  }

  const initializeView = async () => {
    await Promise.all([loadContractTypeOptions(), loadOptionSourceGroups(), loadSchema(), ensureAISettingsInitialized()])
  }

  const getSchemaExportDefaultFileName = () => {
    const libraryName = String(libraryNameText.value || 'contract_form_schema').trim() || 'contract_form_schema'
    const sanitized = libraryName
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[. ]+$/g, '')
    return `${sanitized || 'contract_form_schema'}_contract_form_schema.json`
  }

  const exportSchema = async () => {
    const currentLibraryPath = libraryPath.value
    if (!currentLibraryPath) {
      toast.add({ severity: 'warn', summary: '导出失败', detail: '请先选择资源库', life: 3000 })
      return
    }

    schemaFileProcessing.value = true
    try {
      persistCurrentSchema()
      const saveResult = await window.electronAPI.fs.saveFile({
        title: '导出合同配置',
        defaultPath: getSchemaExportDefaultFileName(),
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      })
      if (!saveResult.success) throw new Error(saveResult.error || '打开保存对话框失败')
      if (saveResult.data?.canceled || !saveResult.data?.filePath) return

      const result = await window.electronAPI.library.exportContractFormSchema({
        libraryPath: currentLibraryPath,
        filePath: saveResult.data.filePath,
      })
      if (!result.success || !result.data) throw new Error(result.error || '导出合同配置失败')

      toast.add({
        severity: 'success',
        summary: '导出成功',
        detail: `合同配置已导出到 ${result.data.filePath}`,
        life: 3000,
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: '导出失败',
        detail: error instanceof Error ? error.message : '导出合同配置失败',
        life: 4000,
      })
    } finally {
      schemaFileProcessing.value = false
    }
  }

  const importSchema = async () => {
    const currentLibraryPath = libraryPath.value
    if (!currentLibraryPath) {
      toast.add({ severity: 'warn', summary: '导入失败', detail: '请先选择资源库', life: 3000 })
      return
    }

    schemaFileProcessing.value = true
    try {
      const selected = await window.electronAPI.fs.selectFile({
        title: '导入合同配置',
        properties: ['openFile'],
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      })
      if (!selected.success) throw new Error(selected.error || '打开文件选择对话框失败')
      if (selected.data?.canceled) return

      const filePath = Array.isArray(selected.data?.filePaths)
        ? String(selected.data.filePaths[0] || '').trim()
        : ''
      if (!filePath) return

      const result = await window.electronAPI.library.importContractFormSchema({
        libraryPath: currentLibraryPath,
        filePath,
      })
      if (!result.success || !result.data) throw new Error(result.error || '导入合同配置失败')

      assignSchemaConfig(result.data)
      const selectedKey = getContractTypeSchemaStorageKey(selectedContractTypeKey.value)
      if (selectedKey !== DEFAULT_CONTRACT_TYPE_SCHEMA_KEY && result.data.schemasByContractType[selectedKey]) {
        applySelectedSchema(selectedKey)
      } else {
        applySelectedSchema(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
      }
      await Promise.all([loadContractTypeOptions(), loadOptionSourceGroups()])

      toast.add({
        severity: 'success',
        summary: '导入成功',
        detail: '合同配置已从 JSON 导入并覆盖当前资源库配置',
        life: 3000,
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: '导入失败',
        detail: error instanceof Error ? error.message : '导入合同配置失败',
        life: 4000,
      })
    } finally {
      schemaFileProcessing.value = false
    }
  }

  const confirmImportSchema = () => {
    confirm.require({
      message: '导入配置将会清除并覆盖当前资源库已有的合同配置。确定后将继续选择要导入的 JSON 文件，是否继续？',
      header: '导入确认',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: '取消',
      acceptLabel: '继续导入',
      rejectProps: { severity: 'secondary', outlined: true },
      acceptProps: { severity: 'warn' },
      accept: async () => {
        await importSchema()
      },
    })
  }

  const moveField = async (index: number, offset: number) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= currentSchema.fields.length) return
    const nextFields = [...currentSchema.fields]
    const [field] = nextFields.splice(index, 1)
    nextFields.splice(nextIndex, 0, field)
    assignSchema(currentSchema, {
      version: currentSchema.version,
      fields: nextFields.map((item, orderIndex) => ({ ...item, order: (orderIndex + 1) * 10 })),
    })
    await saveSchema(false)
  }

  const removeField = async (index: number) => {
    const field = currentSchema.fields[index]
    if (!field) return
    if (field.builtin) {
      const nextFields = [...currentSchema.fields]
      nextFields[index] = { ...nextFields[index], visible: false, required: false }
      assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    } else {
      const nextFields = currentSchema.fields.filter((_, fieldIndex) => fieldIndex !== index)
      assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    }
    await saveSchema(false)
  }

  const confirmDeleteField = (field: ContractFormSchemaField) => {
    if (field.builtin && field.lockedVisible) {
      toast.add({ severity: 'warn', summary: '无法操作', detail: '该内置字段是系统核心字段，无法隐藏或删除', life: 3000 })
      return
    }
    confirm.require({
      message: field.builtin
        ? `确定要隐藏内置字段 "${field.label}" 吗？隐藏后该字段将不再在表单中显示。`
        : `确定要删除自定义字段 "${field.label}" 吗？该操作不可撤销。`,
      header: '删除确认',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: '取消',
      acceptLabel: '确定',
      rejectProps: { label: '取消', severity: 'secondary', outlined: true },
      acceptProps: { label: '确定', severity: 'danger' },
      accept: async () => {
        const index = currentSchema.fields.findIndex((f) => f.key === field.key)
        if (index !== -1) await removeField(index)
      },
    })
  }

  const updateFieldOptions = (field: ContractFormSchemaField, value: string) => {
    field.options = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  }

  const updateFieldVisible = async (field: ContractFormSchemaField, nextVisible: boolean) => {
    if (field.lockedVisible) {
      toast.add({ severity: 'warn', summary: '无法操作', detail: '该字段显示状态已锁定', life: 2500 })
      return
    }
    const index = currentSchema.fields.findIndex((f) => f.key === field.key)
    if (index === -1) return
    const nextFields = [...currentSchema.fields]
    const current = nextFields[index]
    const updated: ContractFormSchemaField = {
      ...current,
      visible: nextVisible,
      required: nextVisible ? Boolean(current.required) : false,
    }
    nextFields[index] = sanitizeFieldForSave(updated)
    assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    await saveSchema(true)
  }

  const updateFieldRequired = async (field: ContractFormSchemaField, nextRequired: boolean) => {
    if (field.lockedRequired) {
      toast.add({ severity: 'warn', summary: '无法操作', detail: '该字段必填状态已锁定', life: 2500 })
      return
    }
    const index = currentSchema.fields.findIndex((f) => f.key === field.key)
    if (index === -1) return
    const nextFields = [...currentSchema.fields]
    const current = nextFields[index]
    const updated: ContractFormSchemaField = {
      ...current,
      visible: nextRequired ? true : Boolean(current.visible),
      required: nextRequired,
    }
    nextFields[index] = sanitizeFieldForSave(updated)
    assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    await saveSchema(true)
  }

  const resetCustomFieldDraft = () => {
    setCustomFieldKey('')
    customFieldDraft.label = ''
    customFieldDraft.type = 'text'
    customFieldDraft.section = 'content'
    customFieldDraft.displayTab = activeTab.value === 'default' ? 'default' : 'extended'
    customFieldDraft.required = false
    customFieldDraft.visible = true
    customFieldDraft.order = 0
    customFieldDraft.span = 1
    customFieldDraft.placeholder = ''
    customFieldDraft.aiPrompt = ''
    customFieldDraft.options = []
    customFieldDraft.optionSource = undefined
    customFieldOptionsText.value = ''
    customFieldOptionSourceType.value = 'manual'
    customFieldOptionSourceGroupName.value = ''
    customFieldError.value = ''
    customFieldKeyManuallyEdited.value = false
  }

  const openCreateCustomField = () => {
    resetCustomFieldDraft()
    isEditMode.value = false
    editingFieldIndex.value = -1
    customFieldDialogVisible.value = true
  }

  const openEditFieldDialog = (event: { data: ContractFormSchemaField; index: number }) => {
    const { data, index } = event
    suppressCustomFieldKeyTracking.value = true
    Object.assign(customFieldDraft, {
      ...data,
      options: data.options ? [...data.options] : [],
      optionSource: data.optionSource ? { ...data.optionSource } : undefined,
    })
    suppressCustomFieldKeyTracking.value = false
    customFieldOptionsText.value = data.options ? data.options.join('\n') : ''
    customFieldOptionSourceType.value = data.optionSource?.type || 'manual'
    customFieldOptionSourceGroupName.value = data.optionSource?.groupName || ''
    customFieldError.value = ''
    isEditMode.value = true
    editingFieldIndex.value = index
    customFieldDialogVisible.value = true
    customFieldKeyManuallyEdited.value = true
  }

  const openEditFieldDialogByKey = (key: string) => {
    const index = currentSchema.fields.findIndex((field) => field.key === key)
    if (index === -1) return
    openEditFieldDialog({ data: currentSchema.fields[index], index })
  }

  const onRowDblClick = (event: any) => {
    const { data } = event
    const exists = editingRows.value.find((row: any) => row.key === data.key)
    if (!exists) editingRows.value = [...editingRows.value, data]
  }

  const onRowEditSave = async (event: any) => {
    const { data, newData } = event
    const index = currentSchema.fields.findIndex((f) => f.key === data.key)
    if (index === -1) return
    const nextFields = [...currentSchema.fields]
    nextFields[index] = sanitizeFieldForSave({ ...newData })
    assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    await saveSchema(false)
  }

  const onRowReorder = async (event: DataTableRowReorderEvent) => {
    const reorderedFields = event.value as ContractFormSchemaField[]
    const isBuiltin = reorderedFields.length > 0 ? isContractFieldInDefaultTab(reorderedFields[0]) : false
    let nextFields: ContractFormSchemaField[] = []
    if (isBuiltin) nextFields = [...reorderedFields, ...extendedFields.value]
    else nextFields = [...builtinFields.value, ...reorderedFields]
    nextFields = nextFields.map((field, index) => ({ ...field, order: (index + 1) * 10 }))
    assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
    await saveSchema(false)
  }

  const confirmCreateCustomField = async () => {
    const key = normalizeContractFieldKey(customFieldDraft.key || customFieldDraft.label)
    const label = String(customFieldDraft.label || '').trim()
    if (!label) {
      customFieldError.value = '字段标签不能为空'
      return
    }
    if (!key) {
      customFieldError.value = '字段 Key 不合法'
      return
    }
    const duplicateIndex = currentSchema.fields.findIndex((field) => field.key === key)
    if (duplicateIndex !== -1 && (!isEditMode.value || duplicateIndex !== editingFieldIndex.value)) {
      customFieldError.value = '字段 Key 已存在'
      return
    }
    if (!isEditMode.value && isContractBuiltinFieldKey(key)) {
      customFieldError.value = '字段 Key 已存在'
      return
    }

    const usesOptionSource = supportsOptionSource(customFieldDraft.type)
    if (usesOptionSource && requiresOptionSourceGroupSelection(customFieldOptionSourceType.value) && !String(customFieldOptionSourceGroupName.value || '').trim()) {
      customFieldError.value = '请选择字典分组'
      return
    }

    const normalizedOptions =
      usesOptionSource && customFieldOptionSourceType.value === 'manual'
        ? customFieldOptionsText.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
        : undefined

    const optionSource =
      usesOptionSource && customFieldOptionSourceType.value !== 'manual'
        ? {
            type: customFieldOptionSourceType.value,
            groupName: getFixedOptionSourceGroupName(customFieldOptionSourceType.value) || String(customFieldOptionSourceGroupName.value || '').trim(),
          }
        : undefined

    const field: ContractFormSchemaField = {
      ...customFieldDraft,
      key,
      label,
      displayTab: customFieldDraft.displayTab || (activeTab.value === 'default' ? 'default' : 'extended'),
      placeholder: String(customFieldDraft.placeholder || '').trim() || undefined,
      aiPrompt: String(customFieldDraft.aiPrompt || '').trim() || undefined,
      options: normalizedOptions,
      optionSource,
    }
    const sanitizedField = sanitizeFieldForSave(field)

    if (isEditMode.value && editingFieldIndex.value >= 0) {
      const nextFields = [...currentSchema.fields]
      nextFields[editingFieldIndex.value] = sanitizedField
      assignSchema(currentSchema, { version: currentSchema.version, fields: nextFields })
      await saveSchema(false)
    } else {
      sanitizedField.order = currentSchema.fields.length > 0 ? currentSchema.fields[currentSchema.fields.length - 1].order + 10 : 10
      assignSchema(currentSchema, { version: currentSchema.version, fields: [...currentSchema.fields, sanitizedField] })
      await saveSchema(false)
    }

    customFieldDialogVisible.value = false
  }

  const saveSchema = async (silent = false) => {
    const currentLibraryPath = libraryPath.value
    if (!currentLibraryPath) {
      if (!silent) toast.add({ severity: 'warn', summary: '保存失败', detail: '请先选择资源库', life: 3000 })
      return
    }

    saving.value = true
    try {
      persistCurrentSchema()
      const result = await window.electronAPI.library.saveContractFormSchema({
        libraryPath: currentLibraryPath,
        schema: JSON.parse(JSON.stringify(schemaConfig)),
      })
      if (!result.success || !result.data) throw new Error(result.error || '保存配置失败')
      assignSchemaConfig(result.data)
      applySelectedSchema(selectedContractTypeKey.value)
      if (!silent) {
        toast.add({ severity: 'success', summary: '保存成功', detail: '合同 schema 配置已按合同类型更新', life: 3000 })
      }
    } catch (error) {
      if (!silent) {
        toast.add({
          severity: 'error',
          summary: '保存失败',
          detail: error instanceof Error ? error.message : '保存配置失败',
          life: 4000,
        })
      }
    } finally {
      saving.value = false
    }
  }

  const confirmResetDefaultSchema = async () => {
    confirm.require({
      message: `确定要重置${schemaModeLabel.value} schema 为默认模板吗？该操作会覆盖当前配置。`,
      header: '重置确认',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: '取消',
      acceptLabel: '确定',
      rejectProps: { severity: 'secondary', outlined: true },
      acceptProps: { severity: 'danger' },
      accept: async () => {
        const nextSchema = cloneSchema(getDefaultContractFormSchema())
        assignSchema(currentSchema, nextSchema)
        await saveSchema(false)
      },
    })
  }

  const confirmResetAllSchemas = async () => {
    confirm.require({
      message: '确定要将合同配置重置为系统默认值吗？该操作会覆盖所有合同类型配置。',
      header: '重置确认',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: '取消',
      acceptLabel: '确定',
      rejectProps: { severity: 'secondary', outlined: true },
      acceptProps: { severity: 'danger' },
      accept: async () => {
        assignSchemaConfig(getDefaultContractFormSchemaConfig())
        applySelectedSchema(DEFAULT_CONTRACT_TYPE_SCHEMA_KEY)
        await saveSchema(false)
      },
    })
  }

  const updateCustomFieldOptionSourceType = (value: unknown) => {
    const sourceType =
      value === 'dictionary' || value === 'treeDictionary' || value === 'partyAUnit' || value === 'partyBUnit' ? value : 'manual'
    customFieldOptionSourceType.value = sourceType
    if (sourceType === 'manual') {
      customFieldOptionSourceGroupName.value = ''
      return
    }
    const fixed = getFixedOptionSourceGroupName(sourceType)
    if (fixed) {
      customFieldOptionSourceGroupName.value = fixed
      return
    }
    const groupOptions = getOptionSourceGroupOptionsByType(sourceType)
    if (groupOptions.length > 0) customFieldOptionSourceGroupName.value = groupOptions[0].value
  }

  const validateCustomFieldKey = () => {
    if (customFieldDraft.builtin && customFieldDraft.lockedKey) return
    const normalized = normalizeContractFieldKey(customFieldDraft.key || customFieldDraft.label)
    setCustomFieldKey(normalized)
  }

  const onCustomFieldTypeChange = (type: ContractFieldType) => {
    if (!supportsOptionSource(type)) {
      customFieldOptionsText.value = ''
      customFieldOptionSourceType.value = 'manual'
      customFieldOptionSourceGroupName.value = ''
      return
    }
    if (customFieldOptionSourceType.value === 'manual') return
    const fixed = getFixedOptionSourceGroupName(customFieldOptionSourceType.value)
    if (fixed) customFieldOptionSourceGroupName.value = fixed
  }

  const supportsOptionSourceInCustomDraft = computed(() => supportsOptionSource(customFieldDraft.type))

  const shouldShowCustomFieldOptions = computed(() => supportsOptionSourceInCustomDraft.value && customFieldOptionSourceType.value === 'manual')

  const shouldShowCustomFieldOptionSource = computed(() => supportsOptionSourceInCustomDraft.value)

  const shouldShowCustomFieldOptionSourceGroup = computed(() => {
    return supportsOptionSourceInCustomDraft.value && requiresOptionSourceGroupSelection(customFieldOptionSourceType.value)
  })

  const availableCustomFieldOptionSourceGroupOptions = computed(() => getOptionSourceGroupOptionsByType(customFieldOptionSourceType.value))

  const customFieldOptionSourceHint = computed(() => getOptionSourcePreviewHint(customFieldOptionSourceType.value))

  const confirmResetSortOrder = async () => {
    confirm.require({
      message: '确定要按“内置字段在前、自定义字段在后”重新排序吗？',
      header: '排序确认',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: '取消',
      acceptLabel: '确定',
      rejectProps: { severity: 'secondary', outlined: true },
      acceptProps: { severity: 'danger' },
      accept: async () => {
        const ordered = [...builtinFields.value, ...extendedFields.value].map((field, index) => ({
          ...field,
          order: (index + 1) * 10,
        }))
        assignSchema(currentSchema, { version: currentSchema.version, fields: ordered })
        await saveSchema(false)
      },
    })
  }

  const handleSchemaModeChanged = (key: string) => {
    handleContractTypeChange(key)
  }

  let labelTranslateRequestId = 0

  watch(
    () => customFieldDialogVisible.value,
    (visible) => {
      if (!visible) {
        labelTranslateRequestId += 1
        customFieldLabelAiGenerating.value = false
        suppressCustomFieldKeyTracking.value = false
        customFieldKeyManuallyEdited.value = false
        return
      }

      void ensureAISettingsInitialized()
      customFieldKeyManuallyEdited.value = Boolean(isEditMode.value)
    },
  )

  watch(
    () => customFieldDraft.key,
    () => {
      if (!customFieldDialogVisible.value) return
      if (isEditMode.value) return
      if (suppressCustomFieldKeyTracking.value) return
      customFieldKeyManuallyEdited.value = true
    },
  )

  const handleCustomFieldLabelBlur = async () => {
    if (!customFieldDialogVisible.value) return
    if (isEditMode.value) return
    if (customFieldKeyManuallyEdited.value) return

    const label = String(customFieldDraft.label || '').trim()
    if (!label) {
      setCustomFieldKey('')
      return
    }

    const normalizedFromLabel = normalizeContractFieldKey(label)
    if (normalizedFromLabel) {
      setCustomFieldKey(normalizedFromLabel)
      return
    }

    await ensureAISettingsInitialized()
    if (!isAIConfigReadyForRequest.value) return

    const requestId = (labelTranslateRequestId += 1)
    customFieldLabelAiGenerating.value = true

    try {
      const response = await window.electronAPI.ai.generateStructured<{ key?: string }>({
        scene: 'contract-config:custom-field-key',
        prompt: [
          '你是字段 Key 生成助手。',
          '请根据用户给出的“字段标签”，生成适合作为字段 key 的英文标识。',
          '要求：',
          '- 仅使用小写英文字母 a-z、数字 0-9、下划线 _',
          '- 不能以数字开头',
          '- 使用 snake_case',
          '- 尽量简短且语义明确',
          '- 不要包含空格、连字符、中文或其他符号',
          '只返回符合 schema 的 JSON。',
        ].join('\n'),
        sourceText: label,
        schema: [
          {
            key: 'key',
            type: 'string',
            description: '字段 key（snake_case，仅 a-z0-9_，不能数字开头）',
            required: true,
          },
        ],
      })

      const generatedKey = response.success && response.data?.ok ? String(response.data.data?.key || '').trim() : ''
      if (requestId !== labelTranslateRequestId) return
      if (!generatedKey) return

      let normalized = normalizeContractFieldKey(generatedKey)
      if (/^\d/.test(normalized)) normalized = `field_${normalized}`
      normalized = normalizeContractFieldKey(normalized)
      if (!normalized) return

      if (!customFieldDialogVisible.value) return
      if (isEditMode.value) return
      if (customFieldKeyManuallyEdited.value) return
      if (String(customFieldDraft.label || '').trim() !== label) return

      setCustomFieldKey(normalized)
    } catch (error) {
      logger.error('AI 生成字段 Key 失败', error)
    } finally {
      if (requestId === labelTranslateRequestId) {
        customFieldLabelAiGenerating.value = false
      }
    }
  }

  void initializeView()

  return {
    activeTab,
    saving,
    schemaFileProcessing,
    previewDialogVisible,
    filterBarVisible,
    editingRows,
    schemaConfig,
    currentSchema,
    selectedContractTypeKey,
    contractTypeOptions,
    dictionaryGroupOptions,
    treeDictionaryGroupOptions,
    libraryPath,
    libraryNameText,
    sectionLabelMap,
    typeLabelMap,
    contractTypePopover,
    contractTypeSearchQuery,
    sectionOptions,
    fieldTypeOptions,
    optionSourceTypeOptions,
    spanOptions,
    builtinFields,
    extendedFields,
    previewFields,
    contractTypeSelectOptions,
    filteredContractTypeOptions,
    toggleContractTypePopover,
    selectContractType,
    clearContractTypeSelection,
    selectedContractTypeLabel,
    schemaModeLabel,
    supportsOptionSource,
    getOptionSourceGroupOptionsByType,
    getAvailableOptionSourceTypeOptions,
    getFieldOptionSourceType,
    requiresOptionSourceGroupSelection,
    getFieldOptionSourceGroupName,
    getFieldOptionSourceGroupOptions,
    updateFieldOptionSourceType,
    updateFieldOptionSourceGroupName,
    getFieldOptionSourceSummary,
    updateFieldOptions,
    updateFieldVisible,
    updateFieldRequired,
    sanitizeFieldForSave,
    onRowEditSave,
    onRowDblClick,
    onRowReorder,
    moveField,
    confirmDeleteField,
    customFieldDialogVisible,
    isEditMode,
    editingFieldIndex,
    customFieldError,
    customFieldOptionsText,
    customFieldOptionSourceType,
    customFieldOptionSourceGroupName,
    customFieldDraft,
    customFieldLabelAiGenerating,
    shouldShowCustomFieldLabelAiIcon,
    handleCustomFieldLabelBlur,
    openCreateCustomField,
    openEditFieldDialog,
    openEditFieldDialogByKey,
    confirmCreateCustomField,
    exportSchema,
    confirmImportSchema,
    saveSchema,
    confirmResetDefaultSchema,
    confirmResetAllSchemas,
    updateCustomFieldOptionSourceType,
    validateCustomFieldKey,
    onCustomFieldTypeChange,
    getOptionSourcePreviewHint,
    shouldShowCustomFieldOptions,
    shouldShowCustomFieldOptionSource,
    shouldShowCustomFieldOptionSourceGroup,
    availableCustomFieldOptionSourceGroupOptions,
    customFieldOptionSourceHint,
    confirmResetSortOrder,
    handleSchemaModeChanged,
    initializeView,
  }
}
