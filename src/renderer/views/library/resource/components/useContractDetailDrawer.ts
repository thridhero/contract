import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'
import type { ContractInfoEntity } from '../../../../../shared/types/contractInfo.types'
import type { ContractFormSchema, ContractFormSchemaConfig } from '../../../../../shared/types/contractFormSchema.types'
import type { ContractExecution, ContractExecutionQueryDTO } from '../../../../../shared/types/contractExecution.types'
import type { ContractProduct, ContractProductCreateDTO, ContractProductQueryDTO } from '../../../../../shared/types/contractProduct.types'
import type { ContractResource } from '../types/contractResource'
import { useReceiptPlanStore, type ReceiptPlan } from '../../../../stores/contract/receiptPlanStore'
import {
  getContractFieldDisplayValue,
  getDefaultContractFormSchemaConfig,
  isContractFieldInDefaultTab,
  isContractFieldInExtendedTab,
  normalizeContractFormSchema,
  normalizeContractFormSchemaConfig,
  parseContractExtData,
  resolveContractFormSchema,
} from '../../../../../shared/utils/contractFormSchema'
import { renderContractSummaryToHtml } from '../../../../utils/contractSummaryMarkdown'

type DrawerProps = {
  visible: boolean
  libraryPath: string
  contractId: string | null
  resource?: ContractResource | null
  defaultTab?: 'basicInfo' | 'executions' | 'products' | 'receiptPlans' 
  refreshToken?: number
}

type GroupTreeNode = {
  key?: string
  label?: string
  data?: string
  children?: GroupTreeNode[]
}

type ProductImportFieldOption = {
  key: keyof ContractProductCreateDTO
  label: string
  required?: boolean
}

type ProductImportPreviewRow = {
  rowNumber: number
  dto: ContractProductCreateDTO
  error: string
}

type PreviewPanelResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const SOURCE_PDF_PREVIEW_STORAGE_KEY = 'contract-source-pdf-preview-layout'

export function useContractDetailDrawer(options: {
  props: DrawerProps
  visible: { value: boolean }
}) {
  const props = options.props
  const visible = options.visible
  const toast = useToast()
  const confirm = useConfirm()

  const activeTab = ref(props.defaultTab || 'basicInfo')

  const summaryExpanded = ref(false)
  const summaryOverflowing = ref(false)
  const summaryEl = ref<HTMLElement | null>(null)
  const sourcePdfRecord = ref<ContractFileRecord | null>(null)
  const sourcePdfMetaLoading = ref(false)
  const sourcePdfMetaError = ref<string | null>(null)
  const sourcePdfPreviewVisible = ref(false)
  const sourcePdfPreviewLoading = ref(false)
  const sourcePdfPreviewError = ref<string | null>(null)
  const sourcePdfPreviewPath = ref('')
  const sourcePdfPreviewName = ref('')
  const sourcePdfPreviewZIndex = ref(1200)
  const sourcePdfPanelRect = reactive({
    x: 16,
    y: 72,
    width: 720,
    height: 720,
  })

  const contract = ref<ContractInfoEntity | null>(null)
  const contractLoading = ref(false)
  const contractError = ref<string | null>(null)
  const contractSchemaConfig = ref<ContractFormSchemaConfig>(getDefaultContractFormSchemaConfig())
  const contractSchema = ref<ContractFormSchema>(resolveContractFormSchema(contractSchemaConfig.value, null))

  const effectiveContractId = computed(() => {
    const id = String(props.contractId || props.resource?.id || '').trim()
    return id || null
  })

  const hasRealContractId = computed(() => !!effectiveContractId.value)

  function resolveHeaderFieldLabel(fieldKey: string, rawValue: unknown, fallback = '-'): string {
    const value = String(rawValue ?? '').trim()
    if (!value) return fallback
    const field = contractSchema.value.fields.find((item) => item.key === fieldKey)
    if (!field) return value
    if ((field as any).type === 'select') return resolveSelectLabel(field, value) || value
    if ((field as any).type === 'tree') return resolveTreeLabel(field, value) || value
    return value
  }

  const headerImageSrc = computed(() => {
    const s = String(props.resource?.thumbnail || '').trim()
    return s ? s : null
  })

  const headerIconClass = computed(() => {
    const icon = contract.value?.project_icon || (props.resource as any)?.projectIcon || (props.resource as any)?.project_icon
    const s = String(icon || '').trim()
    return s || 'pi pi-file'
  })

  const headerIconColor = computed(() => {
    const color = contract.value?.project_color || (props.resource as any)?.projectColor || (props.resource as any)?.project_color
    const s = String(color || '').trim()
    return s || 'var(--btn-primary-bg)'
  })

  const displayContractCode = computed(() => {
    return contract.value?.contract_code || props.resource?.contractCode || props.resource?.version || props.resource?.size || '-'
  })

  const displayContractName = computed(() => {
    return contract.value?.contract_name || props.resource?.contractName || props.resource?.name || '-'
  })

  const displayContractType = computed(() => {
    return resolveHeaderFieldLabel(
      'contractType',
      contract.value?.contract_type || props.resource?.contractType || props.resource?.softwareCategory,
      '-'
    )
  })

  const displaySigningDate = computed(() => {
    return contract.value?.signing_date || props.resource?.signingDate || props.resource?.completionDate || props.resource?.date || '-'
  })

  const displayClientName = computed(() => {
    return contract.value?.client_name || props.resource?.clientName || props.resource?.copyrightOwner || '-'
  })

  const displayPartyBName = computed(() => {
    return contract.value?.party_b_name || props.resource?.partyBName || '-'
  })

  const displayContractSummary = computed(() => (
    contract.value?.contract_summary ||
    props.resource?.contractSummary ||
    props.resource?.technicalFeatures ||
    props.resource?.description ||
    ''
  ))

  const displayContractSummaryHtml = computed(() => {
    const rendered = renderContractSummaryToHtml(displayContractSummary.value)
    return rendered || '<p>-</p>'
  })

  const summaryToggleVisible = computed(() => {
    const raw = String(displayContractSummary.value ?? '').trim()
    if (!raw) return false
    if (summaryExpanded.value) return true
    if (summaryOverflowing.value) return true
    return raw.length > 140
  })

  async function updateSummaryOverflowing() {
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const el = summaryEl.value
    if (!el) {
      summaryOverflowing.value = false
      return
    }
    summaryOverflowing.value = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
  }

  watch(
    () => [props.visible, effectiveContractId.value, displayContractSummary.value, summaryExpanded.value],
    ([visibleNow]) => {
      if (!visibleNow) return
      if (summaryExpanded.value) return
      updateSummaryOverflowing()
    },
    { immediate: true }
  )

  const displayGroupName = computed(() => contract.value?.group_name || '-')
  const displayCurrency = computed(() => contract.value?.currency || '-')
  const displayContractStatus = computed(() => contract.value?.contract_status || '-')
  const displayPartyAContact = computed(() => contract.value?.party_a_contact || '-')
  const displayPartyBContact = computed(() => contract.value?.party_b_contact || '-')

  const displayContractAmount = computed(() => {
    const n = contract.value?.contract_amount
    if (n === null || n === undefined) return '-'
    const num = Number(n)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  })

  const displayEndDate = computed(() => contract.value?.end_date || props.resource?.endDate || '-')

  const detailSectionTitleMap = {
    base: '基础信息',
    content: '合同内容',
  } as const

  const detailExcludedKeys = new Set([
    // Contract summary is already rendered as a dedicated block above the tabs.
    'contractSummary',
  ])

  const detailFieldValues = computed<Record<string, unknown>>(() => {
    const row = contract.value
    return {
      contractName: row?.contract_name || '',
      contractCode: row?.contract_code || '',
      signingDate: row?.signing_date || '',
      contractType: row?.contract_type || '',
      groupName: row?.group_name || '',
      currency: row?.currency || '',
      clientName: row?.client_name || '',
      partyAContact: row?.party_a_contact || '',
      partyBName: row?.party_b_name || '',
      partyBContact: row?.party_b_contact || '',
      contractSummary: row?.contract_summary || '',
      contractAmount: row?.contract_amount ?? null,
      contractStatus: row?.contract_status || '',
      department: row?.department || '',
      responsiblePerson: row?.responsible_person || '',
      endDate: row?.end_date || '',
      settlementMethod: row?.settlement_method || '',
      signingForm: row?.signing_form || '',
      procurementSource: row?.procurement_source || '',
      executionMethod: row?.execution_method || '',
      remark: row?.remark || '',
      contractTags: (() => {
        try {
          const value = row?.contract_tags ? JSON.parse(row.contract_tags) : []
          return Array.isArray(value) ? value : []
        } catch {
          return []
        }
      })(),
      ...parseContractExtData(row?.ext_data),
    }
  })

  const detailSections = computed(() => {
    return (['base', 'content'] as const)
      .map((section) => {
        const fields = contractSchema.value.fields.filter((field) => {
          if (!isContractFieldInDefaultTab(field)) return false
          if (field.section !== section || !field.visible || detailExcludedKeys.has(field.key)) return false
          return true
        })
        return {
          key: section,
          title: detailSectionTitleMap[section],
          fields,
        }
      })
      .filter((section) => section.fields.length > 0)
  })

  const extendedDetailFields = computed(() => {
    return contractSchema.value.fields.filter((field) => field.visible && isContractFieldInExtendedTab(field))
  })

  const extendedDetailTitle = computed(() => {
    const t = String(displayContractType.value || '').trim()
    return t && t !== '-' ? t : '扩展信息'
  })

  const hasExtendedDetail = computed(() => extendedDetailFields.value.length > 0)

  const normalizeGroupTreeNodeText = (value: unknown) => String(value ?? '').trim()

  const findGroupTreeNode = (nodes: GroupTreeNode[], predicate: (node: GroupTreeNode) => boolean): GroupTreeNode | null => {
    for (const node of nodes) {
      if (predicate(node)) return node
      const children = Array.isArray(node.children) ? node.children : []
      const found = findGroupTreeNode(children, predicate)
      if (found) return found
    }
    return null
  }

  const dictionaryLabelMaps = ref<Record<string, Record<string, string>>>({})
  const treeLabelMaps = ref<Record<string, Record<string, string>>>({})
  const departmentKeyLabelMap = ref<Record<string, string>>({})
  const fieldLookupLoadedKey = ref<string | null>(null)

  const buildValueLabelMap = (items: Array<{ name: string; value?: string | null; code?: string }>) => {
    const map: Record<string, string> = {}
    for (const item of items || []) {
      const label = String((item as any)?.name || '').trim()
      const rawValue = String((item as any)?.value ?? '').trim()
      const value = rawValue || label
      if (!label || !value) continue
      map[value] = label
      map[label] = label
      const code = String((item as any)?.code ?? '').trim()
      if (code) map[code] = label
    }
    return map
  }

  const buildDepartmentKeyLabelMapFromGroupTreeSetting = (rawValue: unknown) => {
    const map: Record<string, string> = {}
    try {
      const rawTree = JSON.parse(String(rawValue || ''))
      const nodes = Array.isArray(rawTree) ? (rawTree as GroupTreeNode[]) : []
      const departmentGroup = findGroupTreeNode(nodes, (node) => normalizeGroupTreeNodeText(node.label ?? node.data) === '部门')
      const departmentChildren = Array.isArray(departmentGroup?.children) ? departmentGroup!.children! : []
      const walk = (n: GroupTreeNode) => {
        const key = normalizeGroupTreeNodeText(n.key ?? n.data ?? n.label ?? '')
        const label = normalizeGroupTreeNodeText(n.label ?? n.data ?? '')
        if (key && label) {
          map[key] = label
          map[label] = label
        }
        for (const child of Array.isArray(n.children) ? n.children : []) walk(child)
      }
      for (const child of departmentChildren) walk(child)
    } catch {
    }
    return map
  }

  const loadFieldLookups = async () => {
    const fields = contractSchema.value.fields.filter((f) => f.visible && (f as any).optionSource?.groupName)
    const dictGroups = Array.from(
      new Set(
        fields
          .filter((f) => (f as any).optionSource?.type === 'dictionary')
          .map((f) => String((f as any).optionSource?.groupName || '').trim())
          .filter(Boolean)
      )
    )
    const treeGroups = Array.from(
      new Set(
        fields
          .filter((f) => (f as any).optionSource?.type === 'treeDictionary')
          .map((f) => String((f as any).optionSource?.groupName || '').trim())
          .filter(Boolean)
      )
    )
    const lookupKey = JSON.stringify({ dictGroups: dictGroups.sort(), treeGroups: treeGroups.sort() })
    if (fieldLookupLoadedKey.value === lookupKey) return
    fieldLookupLoadedKey.value = lookupKey

    const dictTasks = dictGroups.map(async (groupName) => {
      try {
        const res = await window.electronAPI.dictionary.getList({ group_name: groupName, page: 1, pageSize: 5000 })
        if (res.success && (res.data as any)?.data) {
          return { groupName, map: buildValueLabelMap((res.data as any).data as any[]) }
        }
      } catch {
      }
      return { groupName, map: {} as Record<string, string> }
    })

    const treeTasks = treeGroups.map(async (groupName) => {
      try {
        const res = await window.electronAPI.treeDictionary.getList({ group_name: groupName, page: 1, pageSize: 5000 })
        if (res.success && (res.data as any)?.data) {
          return { groupName, map: buildValueLabelMap((res.data as any).data as any[]) }
        }
      } catch {
      }
      return { groupName, map: {} as Record<string, string> }
    })

    const [dictResults, treeResults] = await Promise.all([Promise.all(dictTasks), Promise.all(treeTasks)])

    dictionaryLabelMaps.value = Object.fromEntries(dictResults.map((r) => [r.groupName, r.map]))
    treeLabelMaps.value = Object.fromEntries(treeResults.map((r) => [r.groupName, r.map]))

    try {
      const res = await window.electronAPI.db.getSetting('tree_dictionary_groups_tree')
      if (res.success && res.data?.value) {
        departmentKeyLabelMap.value = buildDepartmentKeyLabelMapFromGroupTreeSetting(res.data.value)
      } else {
        departmentKeyLabelMap.value = {}
      }
    } catch {
      departmentKeyLabelMap.value = {}
    }
  }

  const resolveSelectLabel = (field: any, rawValue: unknown) => {
    const groupName = String(field?.optionSource?.groupName || '').trim()
    if (!groupName) return null
    const value = String(rawValue ?? '').trim()
    if (!value) return null
    const dictMap = dictionaryLabelMaps.value[groupName]
    if (dictMap && dictMap[value]) return dictMap[value]
    const treeMap = treeLabelMaps.value[groupName]
    if (treeMap && treeMap[value]) return treeMap[value]
    return null
  }

  const resolveTreeLabel = (field: any, rawValue: unknown) => {
    const groupName = String(field?.optionSource?.groupName || '').trim()
    const value = String(rawValue ?? '').trim()
    if (!groupName || !value) return null
    if (groupName === '部门') {
      const map = departmentKeyLabelMap.value
      if (map && map[value]) return map[value]
    }
    const map = treeLabelMaps.value[groupName]
    if (map && map[value]) return map[value]
    return null
  }

  const formatDetailFieldValue = (key: string) => {
    const field = contractSchema.value.fields.find((item) => item.key === key)
    const emptyPlaceholder = '--'
    if (!field) return emptyPlaceholder
    const raw = detailFieldValues.value[key]

    if ((field as any).type === 'multiselect') {
      const list = Array.isArray(raw) ? raw : []
      const groupName = String((field as any)?.optionSource?.groupName || '').trim()
      const dictMap = groupName ? dictionaryLabelMaps.value[groupName] : undefined
      const treeMap = groupName ? treeLabelMaps.value[groupName] : undefined
      const mapped = list
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .map((v) => dictMap?.[v] || treeMap?.[v] || v)
      return mapped.length > 0 ? mapped.join('、') : emptyPlaceholder
    }

    const base = getContractFieldDisplayValue(field as any, raw)
    if (base === '-') return emptyPlaceholder

    if ((field as any).type === 'select') return resolveSelectLabel(field, raw) || base
    if ((field as any).type === 'tree') {
      if (typeof raw === 'object' && raw && !Array.isArray(raw)) {
        const first = Object.keys(raw as Record<string, unknown>).find((k) => Boolean((raw as any)[k]))
        if (first) return resolveTreeLabel(field, first) || String(first).trim() || base
      }
      return resolveTreeLabel(field, raw) || base
    }
    return base
  }

  const parseTime = (value: unknown) => {
    const s = String(value ?? '').trim()
    if (!s) return null
    const t1 = Date.parse(s)
    if (Number.isFinite(t1)) return t1
    const t2 = Date.parse(s.replace(' ', 'T'))
    if (Number.isFinite(t2)) return t2
    return null
  }

  const timeProgress = computed(() => {
    const startStr = contract.value?.signing_date || props.resource?.signingDate
    const endStr = contract.value?.end_date || props.resource?.endDate
    if (!startStr || !endStr) return null
    const tStart = parseTime(startStr)
    const tEnd = parseTime(endStr)
    if (!tStart || !tEnd || tStart >= tEnd) return null
    const tNow = Date.now()
    if (tNow <= tStart) return 0
    if (tNow >= tEnd) return 100
    return Math.round(((tNow - tStart) / (tEnd - tStart)) * 100)
  })

  const sanitizeMoney = (value: unknown) => {
    const n = Number(String(value ?? '').trim() || 0)
    return Number.isFinite(n) ? n : 0
  }

  const formatMoney = (value: unknown) => {
    const n = sanitizeMoney(value)
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatNumber = (value: unknown) => {
    const n = Number(String(value ?? '').trim() || 0)
    return Number.isFinite(n) ? n.toLocaleString() : '-'
  }

  const getFileExtension = (name: unknown) => {
    const text = String(name ?? '').trim()
    const index = text.lastIndexOf('.')
    return index >= 0 ? text.slice(index + 1).toLowerCase() : ''
  }

  const PREVIEW_PANEL_MARGIN = 16
  const PREVIEW_PANEL_MIN_WIDTH = 520
  const PREVIEW_PANEL_MIN_HEIGHT = 360
  const DETAIL_DRAWER_WIDTH = 1000

  const getViewportSize = () => ({
    width: Math.max(1280, Number(window.innerWidth || 0)),
    height: Math.max(720, Number(window.innerHeight || 0)),
  })

  const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const applySourcePdfPanelRect = (next: { x: number; y: number; width: number; height: number }) => {
    const viewport = getViewportSize()
    const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, viewport.width - PREVIEW_PANEL_MARGIN * 2)
    const maxHeight = Math.max(PREVIEW_PANEL_MIN_HEIGHT, viewport.height - PREVIEW_PANEL_MARGIN * 2)
    const width = clampNumber(next.width, PREVIEW_PANEL_MIN_WIDTH, maxWidth)
    const height = clampNumber(next.height, PREVIEW_PANEL_MIN_HEIGHT, maxHeight)
    sourcePdfPanelRect.x = clampNumber(next.x, PREVIEW_PANEL_MARGIN, viewport.width - PREVIEW_PANEL_MARGIN - width)
    sourcePdfPanelRect.y = clampNumber(next.y, PREVIEW_PANEL_MARGIN, viewport.height - PREVIEW_PANEL_MARGIN - height)
    sourcePdfPanelRect.width = width
    sourcePdfPanelRect.height = height
  }

  const resetSourcePdfPanelLayout = () => {
    const viewport = getViewportSize()
    const width = Math.min(820, Math.max(PREVIEW_PANEL_MIN_WIDTH, Math.round(viewport.width * 0.36)))
    const height = Math.min(
      Math.max(PREVIEW_PANEL_MIN_HEIGHT, viewport.height - 120),
      Math.max(PREVIEW_PANEL_MIN_HEIGHT, Math.round(viewport.height * 0.78)),
    )
    const leftOfDrawerX = viewport.width - DETAIL_DRAWER_WIDTH - width - 24
    applySourcePdfPanelRect({
      x: leftOfDrawerX >= PREVIEW_PANEL_MARGIN ? leftOfDrawerX : PREVIEW_PANEL_MARGIN,
      y: Math.max(PREVIEW_PANEL_MARGIN, Math.round((viewport.height - height) / 2)),
      width,
      height,
    })
  }

  const loadSourcePdfPanelLayout = () => {
    try {
      const saved = localStorage.getItem(SOURCE_PDF_PREVIEW_STORAGE_KEY)
      if (!saved) return false
      const layout = JSON.parse(saved)
      if (layout && typeof layout === 'object') {
        const { x, y, width, height } = layout
        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          typeof width === 'number' &&
          typeof height === 'number'
        ) {
          applySourcePdfPanelRect({ x, y, width, height })
          return true
        }
      }
    } catch (e) {
      console.warn('Failed to load source PDF preview layout:', e)
    }
    return false
  }

  const saveSourcePdfPanelLayout = () => {
    try {
      const layout = {
        x: sourcePdfPanelRect.x,
        y: sourcePdfPanelRect.y,
        width: sourcePdfPanelRect.width,
        height: sourcePdfPanelRect.height,
      }
      localStorage.setItem(SOURCE_PDF_PREVIEW_STORAGE_KEY, JSON.stringify(layout))
    } catch (e) {
      console.warn('Failed to save source PDF preview layout:', e)
    }
  }

  const sourcePdfPanelStyle = computed(() => ({
    left: `${sourcePdfPanelRect.x}px`,
    top: `${sourcePdfPanelRect.y}px`,
    width: `${sourcePdfPanelRect.width}px`,
    height: `${sourcePdfPanelRect.height}px`,
  }))

  const countPathDepth = (value: unknown) => {
    const text = String(value ?? '').trim()
    if (!text) return Number.MAX_SAFE_INTEGER
    return text.split(/[\\/]+/).filter(Boolean).length
  }

  const compareFileRecords = (a: ContractFileRecord, b: ContractFileRecord) => {
    const depthDiff = countPathDepth(a.path) - countPathDepth(b.path)
    if (depthDiff !== 0) return depthDiff
    const mtimeA = Number(a.mtime || 0)
    const mtimeB = Number(b.mtime || 0)
    if (mtimeA !== mtimeB) return mtimeB - mtimeA
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })
  }

  const pickBestSourceFile = (items: ContractFileRecord[]) => {
    const files = items
      .filter((item) => item?.type === 'file')
      .sort(compareFileRecords)
    if (files.length === 0) return null
    const pdf = files.find((item) => getFileExtension(item.name) === 'pdf')
    return pdf || files[0] || null
  }

  const hasSourcePdf = computed(() => {
    return Boolean(sourcePdfRecord.value && String(sourcePdfRecord.value.path || '').trim())
  })

  const sourcePdfFilePath = computed(() => String(sourcePdfRecord.value?.path || '').trim())

  const displaySourcePdfName = computed(() => {
    const name = String(sourcePdfRecord.value?.name || '').trim()
    return name || '合同源文件'
  })

  const loadSourcePdfMeta = async () => {
    const libraryPath = String(props.libraryPath || '').trim()
    const contractId = String(effectiveContractId.value || '').trim()
    if (!libraryPath || !contractId) {
      sourcePdfRecord.value = null
      sourcePdfMetaLoading.value = false
      sourcePdfMetaError.value = null
      return
    }

    sourcePdfMetaLoading.value = true
    sourcePdfMetaError.value = null
    sourcePdfRecord.value = null
    try {
      const res = await window.electronAPI.contractFiles.getList({ libraryPath, contractId })
      if (!res.success || !res.data) {
        sourcePdfMetaError.value = res.error || '读取合同文件失败'
        return
      }
      const sourceFile = pickBestSourceFile(res.data.items || [])
      if (!sourceFile) {
        sourcePdfMetaError.value = '当前合同下未找到源文件'
        return
      }
      sourcePdfRecord.value = sourceFile
    } catch (e) {
      sourcePdfMetaError.value = e instanceof Error ? e.message : '读取合同文件失败'
    } finally {
      sourcePdfMetaLoading.value = false
    }
  }

  const getDirectionSeverity = (direction: unknown) => {
    const d = String(direction ?? '').trim()
    if (d === '收款') return 'success'
    if (d === '付款') return 'danger'
    return 'secondary'
  }

  const receiptPlanStore = useReceiptPlanStore()

  const planRows = computed<ReceiptPlan[]>(() => {
    const list = receiptPlanStore.plans
    if (!Array.isArray(list) || list.length === 0) return []
    return list.filter((row): row is ReceiptPlan => Boolean(row && typeof row === 'object' && (row as any).id))
  })
  const existingSerialNos = computed(() => {
    return planRows.value
      .map((r) => String(r.serial_no || '').trim())
      .filter(Boolean)
  })

  watch(
    () => props.visible,
    (v) => {
      if (!v) return
    },
    { immediate: true }
  )

  const queryContractId = computed(() => effectiveContractId.value || '')

  const queryContractCode = computed(() => {
    const code = String(displayContractCode.value || '').trim()
    if (!code || code === '-') return ''
    return code
  })

  const queryKey = computed(() => `${queryContractId.value}|${queryContractCode.value}`)

  const executions = ref<ContractExecution[]>([])
  const executionsLoading = ref(false)
  const executionsError = ref<string | null>(null)
  const executionsLoadedKey = ref<string | null>(null)

  const timelineExecutions = computed<ContractExecution[]>(() => {
    const list = executions.value || []
    return list
      .map((item, index) => ({ item, index, ts: parseTime(item.execution_time) ?? parseTime((item as any).created_at) }))
      .sort((a, b) => {
        if (a.ts === null && b.ts === null) return a.index - b.index
        if (a.ts === null) return 1
        if (b.ts === null) return -1
        if (a.ts === b.ts) return a.index - b.index
        return a.ts - b.ts
      })
      .map((x) => x.item)
  })

  const receiptPlanViewMode = ref<'table' | 'card'>('table')
  const toggleReceiptPlanView = (mode: 'table' | 'card') => {
    receiptPlanViewMode.value = mode
  }
  const selectedReceiptPlanIds = ref<string[]>([])
  const receiptPlanTableQuery = reactive({
    plan_name: '',
    direction: '',
    expected_date: '',
  })

  const hasReceiptPlanTableQuery = computed(() => {
    return Boolean(
      String(receiptPlanTableQuery.plan_name || '').trim() ||
      String(receiptPlanTableQuery.direction || '').trim() ||
      String(receiptPlanTableQuery.expected_date || '').trim()
    )
  })

  const clearReceiptPlanTableQuery = () => {
    receiptPlanTableQuery.plan_name = ''
    receiptPlanTableQuery.direction = ''
    receiptPlanTableQuery.expected_date = ''
  }

  const selectedReceiptPlanCount = computed(() => selectedReceiptPlanIds.value.length)

  const toggleReceiptPlanSelection = (id: string, checked: boolean) => {
    const key = String(id || '').trim()
    if (!key) return
    if (checked) {
      if (!selectedReceiptPlanIds.value.includes(key)) selectedReceiptPlanIds.value.push(key)
    } else {
      selectedReceiptPlanIds.value = selectedReceiptPlanIds.value.filter((x) => x !== key)
    }
  }

  const receiptPlanPopupVisible = ref(false)
  const handleOpenReceiptPlanPopup = async () => {
    receiptPlanPopupVisible.value = true
  }

  const products = ref<ContractProduct[]>([])
  const productsLoading = ref(false)
  const productsError = ref<string | null>(null)
  const productsLoadedKey = ref<string | null>(null)
  const selectedProductIds = ref<string[]>([])
  type WarrantyFilter = 'all' | 'expired' | 'notExpired'
  const productTableQuery = reactive({
    code: '',
    name: '',
    purchaseDate: '',
    warrantyDate: '',
    warrantyStatus: 'all' as WarrantyFilter,
  })

  const normalizeSearchKeyword = (value: unknown) => String(value ?? '').trim().toLowerCase()
  const includesKeyword = (source: unknown, keyword: string) => {
    if (!keyword) return true
    return normalizeSearchKeyword(source).includes(keyword)
  }

  const parseDateOnly = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return null
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  const isWarrantyExpired = (warrantyDate: unknown) => {
    const dateText = typeof warrantyDate === 'string' ? warrantyDate : String(warrantyDate ?? '')
    const warranty = parseDateOnly(dateText)
    if (!warranty) return false
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return warranty < today
  }

  const filteredProducts = computed<ContractProduct[]>(() => {
    const codeKeyword = normalizeSearchKeyword(productTableQuery.code)
    const nameKeyword = normalizeSearchKeyword(productTableQuery.name)
    const purchaseDateKeyword = normalizeSearchKeyword(productTableQuery.purchaseDate)
    const warrantyDateKeyword = normalizeSearchKeyword(productTableQuery.warrantyDate)
    return (products.value || []).filter((item) => {
      if (!includesKeyword(item.code, codeKeyword)) return false
      if (!includesKeyword(item.name, nameKeyword)) return false
      if (!includesKeyword(item.purchase_date, purchaseDateKeyword)) return false
      if (!includesKeyword(item.warranty_date, warrantyDateKeyword)) return false
      if (productTableQuery.warrantyStatus !== 'all') {
        const warrantyText = typeof item.warranty_date === 'string' ? item.warranty_date : String(item.warranty_date ?? '')
        const warrantyKnown = Boolean(parseDateOnly(warrantyText))
        const expired = isWarrantyExpired(warrantyText)
        if (productTableQuery.warrantyStatus === 'expired' && !expired) return false
        if (productTableQuery.warrantyStatus === 'notExpired' && (!warrantyKnown || expired)) return false
      }
      return true
    })
  })

  const hasProductTableQuery = computed(() => {
    return Boolean(
      String(productTableQuery.code || '').trim() ||
      String(productTableQuery.name || '').trim() ||
      String(productTableQuery.purchaseDate || '').trim() ||
      String(productTableQuery.warrantyDate || '').trim() ||
      productTableQuery.warrantyStatus !== 'all'
    )
  })

  const clearProductTableQuery = () => {
    productTableQuery.code = ''
    productTableQuery.name = ''
    productTableQuery.purchaseDate = ''
    productTableQuery.warrantyDate = ''
    productTableQuery.warrantyStatus = 'all'
  }

  const productsTotalQuantity = computed(() => {
    return products.value.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
  })

  const productsTotalAmount = computed(() => {
    return products.value.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0)
  })

  const selectedProductCount = computed(() => selectedProductIds.value.length)
  const isAllProductsSelected = computed(() => {
    if (!products.value.length) return false
    return products.value.every((item) => selectedProductIds.value.includes(item.id))
  })

  const toggleProductSelection = (id: string, checked: boolean) => {
    const key = String(id || '').trim()
    if (!key) return
    if (checked) {
      if (!selectedProductIds.value.includes(key)) selectedProductIds.value.push(key)
    } else {
      selectedProductIds.value = selectedProductIds.value.filter((x) => x !== key)
    }
  }

  const toggleSelectAllProducts = (checked: boolean) => {
    if (!checked) {
      selectedProductIds.value = []
      return
    }
    selectedProductIds.value = products.value.map((item) => item.id).filter(Boolean)
  }

  const productViewMode = ref<'card' | 'table'>('table')
  const toggleProductView = (mode: 'card' | 'table') => {
    productViewMode.value = mode
  }
  const productPopupVisible = ref(false)
  const handleOpenProductPopup = async () => {
    if (!products.value.length) await loadProducts(true)
    productPopupVisible.value = true
  }

  const productImportVisible = ref(false)
  const productImporting = ref(false)
  const productImportStep = ref<1 | 2>(1)
  const selectedProductImportFilePath = ref('')
  const productImportSheetNames = ref<string[]>([])
  const selectedProductImportSheetName = ref('')
  const productImportHeaderRowOptions = ref<number[]>([])
  const selectedProductImportHeaderRow = ref(1)
  const productImportHeaders = ref<string[]>([])
  const productImportRows = ref<Record<string, string>[]>([])
  const productImportMappings = ref<Record<string, string>>({})
  const productImportWorkbook = ref<any | null>(null)
  const productImportXlsx = ref<any | null>(null)
  const productImportPreviewRows = ref<ProductImportPreviewRow[]>([])

  const productImportFieldOptions: ProductImportFieldOption[] = [
    { key: 'code', label: '编码' },
    { key: 'name', label: '名称', required: true },
    { key: 'category', label: '产品种类' },
    { key: 'specification', label: '型号规格' },
    { key: 'quantity', label: '数量' },
    { key: 'unit', label: '单位' },
    { key: 'unit_price', label: '单价' },
    { key: 'cost_price', label: '成本价' },
    { key: 'total_price', label: '总价' },
    { key: 'purchase_date', label: '采购日期' },
    { key: 'warranty_date', label: '维保日期' },
    { key: 'origin', label: '产地' },
    { key: 'customer_name', label: '客户' },
    { key: 'supplier_name', label: '供应商' },
    { key: 'remark', label: '备注' },
  ]

  const fieldAliasMap: Record<string, string[]> = {
    code: ['编码', '编号', '产品编码', '产品编号', 'code'],
    name: ['名称', '产品名称', 'name'],
    category: ['产品种类', '种类', '分类', 'category'],
    specification: ['型号规格', '规格', '型号', 'specification'],
    quantity: ['数量', 'qty', 'quantity'],
    unit: ['单位', 'unit'],
    unit_price: ['单价', '销售单价', 'price', 'unitprice', 'unit_price'],
    cost_price: ['成本价', '成本单价', 'cost', 'costprice', 'cost_price'],
    total_price: ['总价', '金额', '合计', 'total', 'totalprice', 'total_price'],
    purchase_date: ['采购日期', '采购时间', 'purchase', 'purchase_date'],
    warranty_date: ['维保日期', '保修日期', 'warranty', 'warranty_date'],
    origin: ['产地', 'origin'],
    customer_name: ['客户', '客户名称', 'customer', 'customer_name'],
    supplier_name: ['供应商', '供应商名称', 'supplier', 'supplier_name'],
    remark: ['备注', '说明', 'remark'],
  }

  const normalizeHeader = (value: unknown) => {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  }

  const autoBuildImportMappings = (headers: string[]) => {
    const normalizedHeaderMap = new Map<string, string>()
    for (const header of headers) {
      const normalized = normalizeHeader(header)
      if (normalized && !normalizedHeaderMap.has(normalized)) normalizedHeaderMap.set(normalized, header)
    }

    const next: Record<string, string> = {}
    for (const field of productImportFieldOptions) {
      const aliases = [field.label, ...(fieldAliasMap[field.key as string] || [])]
      const matched = aliases
        .map((alias) => normalizedHeaderMap.get(normalizeHeader(alias)))
        .find((v) => Boolean(v))
      next[field.key as string] = matched || ''
    }
    productImportMappings.value = next
  }

  const resetProductImportState = () => {
    productImportStep.value = 1
    selectedProductImportFilePath.value = ''
    productImportSheetNames.value = []
    selectedProductImportSheetName.value = ''
    productImportHeaderRowOptions.value = []
    selectedProductImportHeaderRow.value = 1
    productImportHeaders.value = []
    productImportRows.value = []
    productImportMappings.value = {}
    productImportWorkbook.value = null
    productImportXlsx.value = null
    productImportPreviewRows.value = []
  }

  const parseCellString = (value: unknown) => {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  const parseNumber = (value: string) => {
    const n = Number(String(value || '').replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : null
  }

  const parseDate = (value: string) => {
    const raw = String(value || '').trim()
    if (!raw) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    const parsed = Date.parse(raw)
    if (!Number.isFinite(parsed)) return raw
    const date = new Date(parsed)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const parseDateStrict = (value: string): { ok: boolean; value: string; error?: string } => {
    const raw = String(value || '').trim()
    if (!raw) return { ok: true, value: '' }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: true, value: raw }
    const parsed = Date.parse(raw)
    if (!Number.isFinite(parsed)) return { ok: false, value: '', error: `日期格式不合法：${raw}` }
    return { ok: true, value: parseDate(raw) }
  }

  const handleOpenProductImportDialog = () => {
    resetProductImportState()
    productImportVisible.value = true
  }

  const handleBackToProductImportMapping = () => {
    productImportStep.value = 1
  }

  const detectBestHeaderRowNumber = (sheet: any, range: any, XLSX: any) => {
    const maxScanRows = Math.min(range.e.r, range.s.r + 49)
    let bestRow = range.s.r
    let bestScore = -1
    for (let r = range.s.r; r <= maxScanRows; r += 1) {
      let score = 0
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const address = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[address]
        const raw = cell?.w ?? cell?.v
        if (parseCellString(raw)) score += 1
      }
      if (score > bestScore) {
        bestScore = score
        bestRow = r
      }
    }
    return bestRow + 1
  }

  const parseProductImportSheet = (sheetName: string, preferredHeaderRow?: number) => {
    const workbook = productImportWorkbook.value
    if (!workbook || !sheetName) {
      productImportHeaderRowOptions.value = []
      selectedProductImportHeaderRow.value = 1
      productImportHeaders.value = []
      productImportRows.value = []
      productImportMappings.value = {}
      return false
    }
    const firstSheet = workbook.Sheets?.[sheetName]
    if (!firstSheet) {
      toast.add({ severity: 'warn', summary: '提示', detail: `未找到工作表：${sheetName}`, life: 3000 })
      return false
    }
    const XLSX = productImportXlsx.value
    if (!XLSX?.utils) return false

    const ref = String(firstSheet['!ref'] || '').trim()
    if (!ref) {
      toast.add({ severity: 'warn', summary: '提示', detail: 'Excel 工作表范围为空', life: 3000 })
      return false
    }
    const range = XLSX.utils.decode_range(ref)
    const totalCols = range.e.c - range.s.c + 1
    const totalRows = range.e.r - range.s.r + 1
    if (totalRows < 2 || totalCols <= 0) {
      productImportHeaderRowOptions.value = []
      selectedProductImportHeaderRow.value = 1
      toast.add({ severity: 'warn', summary: '提示', detail: 'Excel 内容为空或缺少数据行', life: 3000 })
      return false
    }

    const readCellText = (rowIndex: number, colIndex: number) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = firstSheet[address]
      if (!cell) return ''
      if (cell.w !== undefined && cell.w !== null) return parseCellString(cell.w)
      if (cell.v !== undefined && cell.v !== null) return parseCellString(cell.v)
      return ''
    }

    const startRowNum = range.s.r + 1
    const endRowNum = range.e.r + 1
    const options: number[] = []
    for (let n = startRowNum; n <= endRowNum; n += 1) options.push(n)
    productImportHeaderRowOptions.value = options

    const autoHeaderRow = detectBestHeaderRowNumber(firstSheet, range, XLSX)
    const targetHeaderRow = Number(preferredHeaderRow || autoHeaderRow)
    const clampedHeaderRow = Math.min(Math.max(targetHeaderRow, startRowNum), endRowNum)
    selectedProductImportHeaderRow.value = clampedHeaderRow
    const headerRowIndex = clampedHeaderRow - 1
    const headers: string[] = []
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const headerText = readCellText(headerRowIndex, c)
      headers.push(headerText || `列${c - range.s.c + 1}`)
    }

    const normalizedRows: Record<string, string>[] = []
    for (let r = headerRowIndex + 1; r <= range.e.r; r += 1) {
      const next: Record<string, string> = {}
      for (let i = 0; i < headers.length; i += 1) {
        const c = range.s.c + i
        next[headers[i]] = readCellText(r, c)
      }
      if (Object.values(next).some((v) => Boolean(String(v || '').trim()))) {
        normalizedRows.push(next)
      }
    }

    productImportHeaders.value = headers
    productImportRows.value = normalizedRows
    autoBuildImportMappings(headers)
    productImportStep.value = 1
    productImportPreviewRows.value = []
    return true
  }

  const handleChangeProductImportSheet = (sheetName: string) => {
    const next = String(sheetName || '').trim()
    if (!next) return
    selectedProductImportSheetName.value = next
    parseProductImportSheet(next)
  }

  const handleChangeProductImportHeaderRow = (headerRow: number) => {
    const rowNum = Number(headerRow)
    if (!Number.isFinite(rowNum)) return
    const sheetName = String(selectedProductImportSheetName.value || '').trim()
    if (!sheetName) return
    parseProductImportSheet(sheetName, rowNum)
  }

  const handleSelectProductImportFile = async () => {
    try {
      const pickedFile: File | null = await new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
        input.onchange = () => resolve(input.files?.[0] || null)
        input.oncancel = () => resolve(null)
        input.click()
      })
      if (!pickedFile) return

      const fileBuffer = await pickedFile.arrayBuffer()
      const bytes = new Uint8Array(fileBuffer)
      const mod: any = await import('xlsx')
      const XLSX = mod?.default || mod
      const workbook = XLSX.read(bytes, { type: 'array', cellDates: true })
      const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames.filter((n: unknown) => Boolean(String(n || '').trim())) : []
      if (!sheetNames.length) {
        toast.add({ severity: 'warn', summary: '提示', detail: 'Excel 中没有可读取的工作表', life: 3000 })
        return
      }

      const displayPath = String((pickedFile as any)?.path || pickedFile.name || '').trim()
      selectedProductImportFilePath.value = displayPath
      productImportWorkbook.value = workbook
      productImportXlsx.value = XLSX
      productImportSheetNames.value = sheetNames

      let bestSheet = sheetNames[0]
      let bestCols = -1
      for (const name of sheetNames) {
        const s = workbook.Sheets?.[name]
        const ref = String(s?.['!ref'] || '').trim()
        if (!ref) continue
        const r = XLSX.utils.decode_range(ref)
        const colCount = r.e.c - r.s.c + 1
        if (colCount > bestCols) {
          bestCols = colCount
          bestSheet = name
        }
      }
      selectedProductImportSheetName.value = bestSheet
      parseProductImportSheet(bestSheet)
    } catch (e) {
      toast.add({ severity: 'error', summary: '错误', detail: e instanceof Error ? e.message : '解析 Excel 失败', life: 3000 })
    }
  }

  const buildPreviewRow = (row: Record<string, string>, rowIndex: number): ProductImportPreviewRow => {
    const excelRowNumber = selectedProductImportHeaderRow.value + 1 + rowIndex
    const dto: ContractProductCreateDTO = {}
    const errors: string[] = []

    for (const field of productImportFieldOptions) {
      const header = String(productImportMappings.value[field.key as string] || '').trim()
      if (!header) continue
      const raw = parseCellString(row[header])
      if (!raw) continue

      if (field.key === 'quantity' || field.key === 'unit_price' || field.key === 'cost_price' || field.key === 'total_price') {
        const parsed = parseNumber(raw)
        if (parsed === null) {
          errors.push(`${field.label}不是有效数字`)
        } else {
          ;(dto as any)[field.key] = parsed
        }
        continue
      }

      if (field.key === 'purchase_date' || field.key === 'warranty_date') {
        const parsed = parseDateStrict(raw)
        if (!parsed.ok) errors.push(parsed.error || `${field.label}格式错误`)
        else (dto as any)[field.key] = parsed.value
        continue
      }

      ;(dto as any)[field.key] = raw
    }

    dto.name = String(dto.name || '').trim()
    if (!dto.name) errors.push('名称为空')

    if ((dto.total_price === null || dto.total_price === undefined) && dto.unit_price != null && dto.quantity != null) {
      dto.total_price = Number((Number(dto.unit_price) * Number(dto.quantity)).toFixed(2))
    }

    return {
      rowNumber: excelRowNumber,
      dto,
      error: errors.join('；'),
    }
  }

  const productImportPreviewErrorCount = computed(() => productImportPreviewRows.value.filter((row) => Boolean(row.error)).length)
  const productImportPreviewValidCount = computed(() => Math.max(0, productImportPreviewRows.value.length - productImportPreviewErrorCount.value))

  const handleGoToProductImportPreview = () => {
    if (!productImportRows.value.length) {
      toast.add({ severity: 'warn', summary: '提示', detail: '请先选择并解析 Excel 文件', life: 2500 })
      return
    }
    const nameHeader = String(productImportMappings.value.name || '').trim()
    if (!nameHeader) {
      toast.add({ severity: 'warn', summary: '提示', detail: '请将“名称”字段映射到 Excel 列', life: 2500 })
      return
    }
    productImportPreviewRows.value = productImportRows.value.map((row, index) => buildPreviewRow(row, index))
    productImportStep.value = 2
  }

  const handleSubmitProductImport = async () => {
    if (productImporting.value) return
    if (productImportStep.value !== 2) {
      handleGoToProductImportPreview()
      return
    }
    if (productImportPreviewRows.value.length === 0) {
      toast.add({ severity: 'warn', summary: '提示', detail: '没有可导入的数据', life: 2500 })
      return
    }

    const contractId = String(contract.value?.id || effectiveContractId.value || '').trim()
    const contractCode = displayContractCode.value !== '-' ? String(displayContractCode.value || '').trim() : ''
    const contractName = displayContractName.value !== '-' ? String(displayContractName.value || '').trim() : ''
    if (!contractId && !contractCode) {
      toast.add({ severity: 'error', summary: '导入失败', detail: '当前合同标识缺失，无法导入产品', life: 3000 })
      return
    }

    productImporting.value = true
    let successCount = 0
    let skipCount = 0
    let failCount = 0
    const failReasons: string[] = []

    try {
      for (const preview of productImportPreviewRows.value) {
        const excelRowNumber = preview.rowNumber
        const dto: ContractProductCreateDTO = {
          contract_id: contractId || undefined,
          contract_code: contractCode || undefined,
          contract_name: contractName || undefined,
          ...preview.dto,
        }
        if (preview.error) {
          skipCount += 1
          failReasons.push(`第 ${excelRowNumber} 行：${preview.error}（已跳过）`)
          continue
        }

        try {
          const res = await window.electronAPI.contractProduct.create(dto)
          if (res.success) {
            successCount += 1
          } else {
            failCount += 1
            failReasons.push(`第 ${excelRowNumber} 行：${res.error || '导入失败'}`)
          }
        } catch (e) {
          failCount += 1
          failReasons.push(`第 ${excelRowNumber} 行：${e instanceof Error ? e.message : '导入异常'}`)
        }
      }

      if (successCount > 0) void loadProducts(true)
      toast.add({
        severity: successCount > 0 ? 'success' : 'warn',
        summary: '导入完成',
        detail: `成功 ${successCount} 条，跳过 ${skipCount} 条，失败 ${failCount} 条`,
        life: 4000,
      })
      if (failReasons.length > 0) {
        const preview = failReasons.slice(0, 6).join('；')
        const more = failReasons.length > 6 ? `；其余 ${failReasons.length - 6} 条请检查数据后重试` : ''
        toast.add({
          severity: 'warn',
          summary: '失败明细',
          detail: `${preview}${more}`,
          life: 9000,
        })
      }
      if (successCount > 0) productImportVisible.value = false
    } catch (e) {
      toast.add({ severity: 'error', summary: '导入失败', detail: e instanceof Error ? e.message : '批量导入失败', life: 3000 })
    } finally {
      productImporting.value = false
    }
  }

  const loadExecutions = async (force = false) => {
    if (!props.visible) return
    const key = queryKey.value
    if (!force && executionsLoadedKey.value === key) return

    executionsError.value = null
    const contractId = queryContractId.value
    const contractCode = queryContractCode.value
    if (!contractId && !contractCode) {
      executions.value = []
      executionsLoadedKey.value = key
      return
    }

    executionsLoading.value = true
    try {
      const query: ContractExecutionQueryDTO = {
        contractId: contractId || undefined,
        contractCode: contractId ? undefined : contractCode || undefined,
        page: 1,
        pageSize: 200,
      }
      const res = await window.electronAPI.contractExecution.getList(query)
      if (!res.success || !res.data) {
        executions.value = []
        executionsError.value = res.error || '读取合同执行列表失败'
        return
      }
      executions.value = res.data.data || []
      executionsLoadedKey.value = key
    } catch (e) {
      executions.value = []
      executionsError.value = e instanceof Error ? e.message : '读取合同执行列表失败'
    } finally {
      executionsLoading.value = false
    }
  }

  const loadProducts = async (force = false) => {
    if (!props.visible) return
    const key = queryKey.value
    if (!force && productsLoadedKey.value === key) return

    productsError.value = null
    const contractId = queryContractId.value
    const contractCode = queryContractCode.value
    if (!contractId && !contractCode) {
      products.value = []
      productsLoadedKey.value = key
      return
    }

    productsLoading.value = true
    try {
      const query: ContractProductQueryDTO = {
        contractId: contractId || undefined,
        contractCode: contractId ? undefined : contractCode || undefined,
        page: 1,
        pageSize: 200,
      }
      const res = await window.electronAPI.contractProduct.getList(query)
      if (!res.success || !res.data) {
        products.value = []
        productsError.value = res.error || '读取合同产品列表失败'
        return
      }
      products.value = res.data.data || []
      productsLoadedKey.value = key
    } catch (e) {
      products.value = []
      productsError.value = e instanceof Error ? e.message : '读取合同产品列表失败'
    } finally {
      productsLoading.value = false
    }
  }

  const filteredReceiptPlans = computed<ReceiptPlan[]>(() => {
    const id = String(queryContractId.value || '').trim()
    const code = String(queryContractCode.value || '').trim()
    const list = planRows.value
    if (!id && !code) return []
    if (!Array.isArray(list) || list.length === 0) return []

    const nameKeyword = normalizeSearchKeyword(receiptPlanTableQuery.plan_name)
    const directionKeyword = normalizeSearchKeyword(receiptPlanTableQuery.direction)
    const dateKeyword = normalizeSearchKeyword(receiptPlanTableQuery.expected_date)

    return list
      .filter((p) => (id && String((p as any).contract_id || '').trim() === id) || (code && String((p as any).contract_code || '').trim() === code))
      .filter((item) => {
        if (!includesKeyword(item.plan_name, nameKeyword)) return false
        if (!includesKeyword(item.direction, directionKeyword)) return false
        if (!includesKeyword(item.expected_date, dateKeyword)) return false
        return true
      })
      .map((p) => ({ ...p }))
  })

  const isAllReceiptPlansSelected = computed(() => {
    if (!filteredReceiptPlans.value.length) return false
    return filteredReceiptPlans.value.every((item) => selectedReceiptPlanIds.value.includes(item.id))
  })

  const toggleSelectAllReceiptPlans = (checked: boolean) => {
    if (!checked) {
      selectedReceiptPlanIds.value = []
      return
    }
    selectedReceiptPlanIds.value = filteredReceiptPlans.value.map((item) => item.id).filter(Boolean)
  }

  const handleDeleteAllReceiptPlans = () => {
    if (!selectedReceiptPlanIds.value.length) {
      toast.add({ severity: 'info', summary: '提示', detail: '请先勾选需要删除的收付计划', life: 2500 })
      return
    }
    const selectedSet = new Set(selectedReceiptPlanIds.value)
    const selectedRows = filteredReceiptPlans.value.filter((row) => selectedSet.has(row.id))
    if (!selectedRows.length) {
      toast.add({ severity: 'info', summary: '提示', detail: '未找到勾选的收付计划记录', life: 2500 })
      return
    }
    confirm.require({
      message: `确定要删除已勾选的 ${selectedRows.length} 条收付计划吗？`,
      header: '批量删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        let successCount = 0
        let failCount = 0
        for (const row of selectedRows) {
          try {
            // Receipt plans are stored in receiptPlanStore
            receiptPlanStore.plans = receiptPlanStore.plans.filter((p: any) => p.id !== row.id)
            successCount += 1
          } catch {
            failCount += 1
          }
        }
        if (successCount > 0) {
          const removedSet = new Set(selectedRows.map((row) => row.id))
          selectedReceiptPlanIds.value = selectedReceiptPlanIds.value.filter((id) => !removedSet.has(id))
        }
        toast.add({
          severity: failCount > 0 ? 'warn' : 'success',
          summary: '批量删除完成',
          detail: `成功 ${successCount} 条，失败 ${failCount} 条`,
          life: 3500,
        })
      },
    })
  }

  const totalProcessedAmount = computed(() => {
    return filteredReceiptPlans.value.reduce((sum, plan) => sum + sanitizeMoney((plan as any).received_amount), 0)
  })

  const amountProgress = computed(() => {
    const total = Number((contract.value as any)?.contract_amount) || 0
    if (total <= 0) return null
    const received = totalProcessedAmount.value
    return Math.min(100, Math.round((received / total) * 100))
  })

  const applyResolvedContractSchema = (contractType: unknown) => {
    contractSchema.value = resolveContractFormSchema(contractSchemaConfig.value, String(contractType || '').trim())
  }

  const loadContractSchema = async (libraryPath: string) => {
    const result = await window.electronAPI.library.getContractFormSchema({ libraryPath })
    contractSchemaConfig.value = result.success && result.data
      ? normalizeContractFormSchemaConfig(result.data)
      : getDefaultContractFormSchemaConfig()
    applyResolvedContractSchema(contract.value?.contract_type || props.resource?.contractType)
  }

  const closeSourcePdfPreview = () => {
    sourcePdfPreviewVisible.value = false
    sourcePdfPreviewLoading.value = false
    sourcePdfPreviewError.value = null
    sourcePdfPreviewPath.value = ''
    sourcePdfPreviewName.value = ''
  }

  const computeSourcePdfPreviewZIndex = () => {
    const fallback = 1200
    if (typeof window === 'undefined') return fallback
    const selector = ['.p-dialog-mask', '.p-overlay-mask', '.p-drawer-mask'].join(', ')
    const nodes = Array.from(document.querySelectorAll(selector))
    let maxMaskZ = 0
    for (const node of nodes) {
      const raw = getComputedStyle(node as Element).zIndex
      const z = Number.parseInt(String(raw || ''), 10)
      if (Number.isFinite(z)) maxMaskZ = Math.max(maxMaskZ, z)
    }
    const desired = maxMaskZ > 0 ? maxMaskZ + 1 : fallback
    return Math.min(Math.max(desired, fallback), 9000)
  }

  const startPointerSession = (
    event: MouseEvent,
    onMove: (dx: number, dy: number) => void,
    onEnd?: () => void,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      onMove(moveEvent.clientX - startX, moveEvent.clientY - startY)
    }

    const handleUp = () => {
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (onEnd) onEnd()
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const startSourcePdfPanelDrag = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) return
    const startRect = {
      x: sourcePdfPanelRect.x,
      y: sourcePdfPanelRect.y,
      width: sourcePdfPanelRect.width,
      height: sourcePdfPanelRect.height,
    }
    startPointerSession(event, (dx, dy) => {
      applySourcePdfPanelRect({
        ...startRect,
        x: startRect.x + dx,
        y: startRect.y + dy,
      })
    }, () => {
      // 拖拽结束后保存布局
      saveSourcePdfPanelLayout()
    })
  }

  const startSourcePdfPanelResize = (direction: PreviewPanelResizeDirection, event: MouseEvent) => {
    const startRect = {
      left: sourcePdfPanelRect.x,
      top: sourcePdfPanelRect.y,
      right: sourcePdfPanelRect.x + sourcePdfPanelRect.width,
      bottom: sourcePdfPanelRect.y + sourcePdfPanelRect.height,
    }
    startPointerSession(event, (dx, dy) => {
      const viewport = getViewportSize()
      let left = startRect.left
      let top = startRect.top
      let right = startRect.right
      let bottom = startRect.bottom

      if (direction.includes('e')) {
        right = clampNumber(startRect.right + dx, startRect.left + PREVIEW_PANEL_MIN_WIDTH, viewport.width - PREVIEW_PANEL_MARGIN)
      }
      if (direction.includes('s')) {
        bottom = clampNumber(startRect.bottom + dy, startRect.top + PREVIEW_PANEL_MIN_HEIGHT, viewport.height - PREVIEW_PANEL_MARGIN)
      }
      if (direction.includes('w')) {
        left = clampNumber(startRect.left + dx, PREVIEW_PANEL_MARGIN, startRect.right - PREVIEW_PANEL_MIN_WIDTH)
      }
      if (direction.includes('n')) {
        top = clampNumber(startRect.top + dy, PREVIEW_PANEL_MARGIN, startRect.bottom - PREVIEW_PANEL_MIN_HEIGHT)
      }

      applySourcePdfPanelRect({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      })
    }, () => {
      // 缩放结束后保存布局
      saveSourcePdfPanelLayout()
    })
  }

  const handleOpenSourcePdfPreview = async () => {
    const libraryPath = String(props.libraryPath || '').trim()
    const contractId = String(effectiveContractId.value || '').trim()
    if (!libraryPath || !contractId) {
      toast.add({ severity: 'warn', summary: '提示', detail: '当前合同信息不完整，无法预览源文件', life: 2500 })
      return
    }

    if (!sourcePdfRecord.value) {
      await loadSourcePdfMeta()
    }

    const rec = sourcePdfRecord.value
    if (!rec) {
      toast.add({ severity: 'warn', summary: '提示', detail: sourcePdfMetaError.value || '当前合同下未找到源文件', life: 2500 })
      return
    }

    sourcePdfPreviewZIndex.value = computeSourcePdfPreviewZIndex()
    // 尝试加载保存的布局，如果没有则使用默认布局
    const hasSavedLayout = loadSourcePdfPanelLayout()
    if (!hasSavedLayout) {
      resetSourcePdfPanelLayout()
    }
    sourcePdfPreviewVisible.value = true
    sourcePdfPreviewLoading.value = false
    sourcePdfPreviewError.value = null
    sourcePdfPreviewPath.value = String(rec.path || '')
    sourcePdfPreviewName.value = String(rec.name || '合同源文件.pdf')
  }

  const handleSourcePdfPanelWindowResize = () => {
    if (!sourcePdfPreviewVisible.value) return
    applySourcePdfPanelRect(sourcePdfPanelRect)
  }

  const reloadContract = async () => {
    contractError.value = null
    if (!props.visible) return
    if (!hasRealContractId.value) {
      contract.value = null
      return
    }
    const libraryPath = String(props.libraryPath || '').trim()
    if (!libraryPath) {
      contract.value = null
      return
    }
    const id = effectiveContractId.value
    if (!id) {
      contract.value = null
      return
    }

    contractLoading.value = true
    try {
      await loadContractSchema(libraryPath)
      const res = await window.electronAPI.library.getContractInfo({ libraryPath, id })
      if (!res.success || !res.data) {
        contract.value = null
        contractError.value = res.error || '读取合同详情失败'
        return
      }
      contract.value = res.data
      applyResolvedContractSchema(contract.value?.contract_type)
      await loadFieldLookups()
    } catch (e) {
      contract.value = null
      contractError.value = e instanceof Error ? e.message : '读取合同详情失败'
    } finally {
      contractLoading.value = false
    }
  }

  watch(
    () => [props.visible, props.libraryPath, effectiveContractId.value],
    ([v]) => {
      if (!v) {
        sourcePdfRecord.value = null
        sourcePdfMetaLoading.value = false
        sourcePdfMetaError.value = null
        return
      }
      void loadSourcePdfMeta()
    },
    { immediate: true },
  )

  watch(
    () => props.defaultTab,
    (v) => {
      if (!v) return
      activeTab.value = v
    }
  )

  watch(
    () => props.visible,
    (v) => {
      if (v) {
        activeTab.value = props.defaultTab || 'basicInfo'
        summaryExpanded.value = false
        updateSummaryOverflowing()
      }
    }
  )

  watch(
    () => queryKey.value,
    async () => {
      const keyAtStart = queryKey.value
      const shouldKeepSourcePreviewOpen = Boolean(props.visible && sourcePdfPreviewVisible.value)
      contract.value = null
      contractError.value = null
      summaryExpanded.value = false
      if (!props.visible) {
        closeSourcePdfPreview()
      } else if (shouldKeepSourcePreviewOpen) {
        sourcePdfPreviewLoading.value = true
        sourcePdfPreviewError.value = null
        sourcePdfPreviewPath.value = ''
        sourcePdfPreviewName.value = ''
      }
      executions.value = []
      executionsError.value = null
      executionsLoadedKey.value = null
      products.value = []
      productsError.value = null
      productsLoadedKey.value = null
      selectedProductIds.value = []
      clearProductTableQuery()
      if (!props.visible) return
      if (shouldKeepSourcePreviewOpen) {
        await loadSourcePdfMeta()
        if (!props.visible || queryKey.value !== keyAtStart) return
        const rec = sourcePdfRecord.value
        sourcePdfPreviewVisible.value = true
        sourcePdfPreviewLoading.value = false
        if (rec) {
          sourcePdfPreviewError.value = null
          sourcePdfPreviewPath.value = String(rec.path || '')
          sourcePdfPreviewName.value = String(rec.name || '合同源文件.pdf')
        } else {
          sourcePdfPreviewError.value = sourcePdfMetaError.value || '当前合同下未找到源文件'
          sourcePdfPreviewPath.value = ''
          sourcePdfPreviewName.value = ''
        }
      }
      if (activeTab.value === 'executions') void loadExecutions()
      if (activeTab.value === 'products') void loadProducts()
    }
  )

  watch(
    () => [props.visible, activeTab.value] as const,
    ([v, tab]) => {
      if (!v) return
      if (tab === 'executions') void loadExecutions()
      if (tab === 'products') void loadProducts()
    },
    { immediate: true }
  )

  onMounted(() => {
    window.addEventListener('resize', handleSourcePdfPanelWindowResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleSourcePdfPanelWindowResize)
  })

  watch(
    () => [props.visible, effectiveContractId.value, props.libraryPath] as const,
    ([v]) => {
      if (!v) return
      void reloadContract()
      receiptPlanStore.ensureSeeded()
    },
    { immediate: true }
  )

  watch(
    () => props.refreshToken,
    () => {
      if (!props.visible) return
      if (!hasRealContractId.value) return
      void reloadContract()
      void loadSourcePdfMeta()
    },
  )

  const executionVisible = ref(false)
  const selectedExecution = ref<ContractExecution | null>(null)

  const handleAddExecution = () => {
    selectedExecution.value = {
      id: '',
      contract_id: contract.value?.id || effectiveContractId.value || '',
      contract_code: displayContractCode.value !== '-' ? displayContractCode.value : '',
      contract_name: displayContractName.value !== '-' ? displayContractName.value : '',
      execution_time: new Date().toISOString().split('T')[0],
      execution_status: '',
      salesperson: 'Admin',
      content: '',
      progress: '0%',
    } as ContractExecution
    executionVisible.value = true
  }

  const handleEditExecution = (row: ContractExecution) => {
    selectedExecution.value = { ...row }
    executionVisible.value = true
  }

  const handleDeleteExecution = (row: ContractExecution) => {
    confirm.require({
      message: '确定要删除这条合同执行记录吗？',
      header: '删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        try {
          const res = await window.electronAPI.contractExecution.delete(row.id)
          if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '已删除执行记录', life: 2000 })
            void loadExecutions(true)
          } else {
            toast.add({ severity: 'error', summary: '失败', detail: res.error || '删除失败', life: 3000 })
          }
        } catch (e) {
          toast.add({ severity: 'error', summary: '错误', detail: e instanceof Error ? e.message : '删除失败', life: 3000 })
        }
      },
    })
  }

  const onExecutionSaved = () => {
    executionVisible.value = false
    void loadExecutions(true)
  }

  const productVisible = ref(false)
  const selectedProduct = ref<ContractProduct | null>(null)

  const handleAddProduct = () => {
    selectedProduct.value = {
      id: '',
      contract_id: contract.value?.id || effectiveContractId.value || '',
      contract_code: displayContractCode.value !== '-' ? displayContractCode.value : '',
      contract_name: displayContractName.value !== '-' ? displayContractName.value : '',
      name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      purchase_date: '',
      warranty_date: '',
    } as ContractProduct
    productVisible.value = true
  }

  const handleEditProduct = (row: ContractProduct) => {
    selectedProduct.value = { ...row }
    productVisible.value = true
  }

  const handleDeleteProduct = (row: ContractProduct) => {
    confirm.require({
      message: `确定要删除产品 "${row.name}" 吗？`,
      header: '删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        try {
          const res = await window.electronAPI.contractProduct.delete(row.id)
          if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '已删除产品', life: 2000 })
            void loadProducts(true)
          } else {
            toast.add({ severity: 'error', summary: '失败', detail: res.error || '删除失败', life: 3000 })
          }
        } catch (e) {
          toast.add({ severity: 'error', summary: '错误', detail: e instanceof Error ? e.message : '删除失败', life: 3000 })
        }
      },
    })
  }

  const handleDeleteAllProducts = () => {
    if (!selectedProductIds.value.length) {
      toast.add({ severity: 'info', summary: '提示', detail: '请先勾选需要删除的产品', life: 2500 })
      return
    }
    const selectedSet = new Set(selectedProductIds.value)
    const selectedRows = products.value.filter((row) => selectedSet.has(row.id))
    if (!selectedRows.length) {
      toast.add({ severity: 'info', summary: '提示', detail: '未找到勾选的产品记录', life: 2500 })
      return
    }
    confirm.require({
      message: `确定要删除已勾选的 ${selectedRows.length} 条产品记录吗？`,
      header: '批量删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        let successCount = 0
        let failCount = 0
        for (const row of selectedRows) {
          try {
            const res = await window.electronAPI.contractProduct.delete(row.id)
            if (res.success) successCount += 1
            else failCount += 1
          } catch {
            failCount += 1
          }
        }
        if (successCount > 0) {
          const removedSet = new Set(selectedRows.map((row) => row.id))
          selectedProductIds.value = selectedProductIds.value.filter((id) => !removedSet.has(id))
        }
        if (successCount > 0) void loadProducts(true)
        toast.add({
          severity: failCount > 0 ? 'warn' : 'success',
          summary: '批量删除完成',
          detail: `成功 ${successCount} 条，失败 ${failCount} 条`,
          life: 3500,
        })
      },
    })
  }

  const onProductSaved = () => {
    productVisible.value = false
    void loadProducts(true)
  }

  const receiptPlanVisible = ref(false)
  const receiptPlanReadonly = ref(false)
  const selectedReceiptPlan = ref<ReceiptPlan | null>(null)

  const handleAddReceiptPlan = () => {
    selectedReceiptPlan.value = {
      id: '',
      contract_id: contract.value?.id || effectiveContractId.value || '',
      contract_code: displayContractCode.value !== '-' ? displayContractCode.value : '',
      contract_name: displayContractName.value !== '-' ? displayContractName.value : '',
      direction: '收款',
      plan_name: '',
      receipt_frequency: '',
      expected_amount: 0,
      expected_date: new Date().toISOString().split('T')[0],
      received_amount: 0,
      remark: '',
      custom1: '',
    } as ReceiptPlan
    receiptPlanReadonly.value = false
    receiptPlanVisible.value = true
  }

  const handleViewReceiptPlan = (row: ReceiptPlan) => {
    selectedReceiptPlan.value = { ...row }
    receiptPlanReadonly.value = true
    receiptPlanVisible.value = true
  }

  const handleEditReceiptPlan = (row: ReceiptPlan) => {
    selectedReceiptPlan.value = { ...row }
    receiptPlanReadonly.value = false
    receiptPlanVisible.value = true
  }

  const handleDeleteReceiptPlan = (row: ReceiptPlan) => {
    confirm.require({
      message: `确定要删除收付计划 "${(row as any).plan_name}" 吗？`,
      header: '删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: async () => {
        try {
          receiptPlanStore.plans = receiptPlanStore.plans.filter((p: any) => p.id !== (row as any).id)
          toast.add({ severity: 'success', summary: '成功', detail: '已删除收付计划', life: 2000 })
        } catch (e) {
          toast.add({ severity: 'error', summary: '错误', detail: e instanceof Error ? e.message : '删除失败', life: 3000 })
        }
      },
    })
  }

  const onReceiptPlanSaved = (payload: { mode: 'create' | 'update'; row: ReceiptPlan }) => {
    if (payload.mode === 'create') receiptPlanStore.plans = [payload.row, ...receiptPlanStore.plans]
    else receiptPlanStore.plans = receiptPlanStore.plans.map((r) => ((r as any).id === (payload.row as any).id ? payload.row : r))
    receiptPlanReadonly.value = false
    receiptPlanVisible.value = false
  }

  const getOutstanding = (plan: ReceiptPlan) => sanitizeMoney((plan as any).expected_amount) - sanitizeMoney((plan as any).received_amount)

  const totalOutstandingAmount = computed(() => {
    return filteredReceiptPlans.value.reduce((sum, plan) => sum + getOutstanding(plan), 0)
  })

  const onHide = () => {
    contractError.value = null
    closeSourcePdfPreview()
    sourcePdfRecord.value = null
    sourcePdfMetaLoading.value = false
    sourcePdfMetaError.value = null
  }

  return {
    activeTab,
    summaryExpanded,
    summaryOverflowing,
    summaryToggleVisible,
    summaryEl,
    hasSourcePdf,
    sourcePdfFilePath,
    displaySourcePdfName,
    sourcePdfMetaLoading,
    sourcePdfMetaError,
    sourcePdfPreviewVisible,
    sourcePdfPreviewLoading,
    sourcePdfPreviewError,
    sourcePdfPreviewPath,
    sourcePdfPreviewName,
    sourcePdfPreviewZIndex,
    sourcePdfPanelStyle,
    handleOpenSourcePdfPreview,
    closeSourcePdfPreview,
    resetSourcePdfPanelLayout,
    startSourcePdfPanelDrag,
    startSourcePdfPanelResize,
    executionVisible,
    selectedExecution,
    handleAddExecution,
    handleEditExecution,
    handleDeleteExecution,
    onExecutionSaved,
    productVisible,
    selectedProduct,
    handleAddProduct,
    handleOpenProductImportDialog,
    handleSelectProductImportFile,
    handleChangeProductImportSheet,
    handleChangeProductImportHeaderRow,
    handleGoToProductImportPreview,
    handleBackToProductImportMapping,
    handleSubmitProductImport,
    handleEditProduct,
    handleDeleteProduct,
    handleDeleteAllProducts,
    onProductSaved,
    receiptPlanVisible,
    receiptPlanReadonly,
    selectedReceiptPlan,
    handleAddReceiptPlan,
    handleViewReceiptPlan,
    handleEditReceiptPlan,
    handleDeleteReceiptPlan,
    onReceiptPlanSaved,
    contract,
    contractLoading,
    contractError,
    contractSchema,
    effectiveContractId,
    hasRealContractId,
    headerImageSrc,
    headerIconClass,
    headerIconColor,
    displayContractCode,
    displayContractName,
    displayContractType,
    displaySigningDate,
    displayClientName,
    displayPartyBName,
    displayContractSummary,
    displayContractSummaryHtml,
    displayGroupName,
    displayCurrency,
    displayContractStatus,
    displayPartyAContact,
    displayPartyBContact,
    displayContractAmount,
    displayEndDate,
    detailSections,
    extendedDetailFields,
    extendedDetailTitle,
    hasExtendedDetail,
    formatDetailFieldValue,
    timeProgress,
    formatMoney,
    formatNumber,
    getDirectionSeverity,
    receiptPlanStore,
    planRows,
    existingSerialNos,
    executions,
    executionsLoading,
    executionsError,
    timelineExecutions,
    products,
    filteredProducts,
    productsLoading,
    productsError,
    productsTotalQuantity,
    productsTotalAmount,
    productTableQuery,
    hasProductTableQuery,
    clearProductTableQuery,
    selectedProductIds,
    selectedProductCount,
    isAllProductsSelected,
    toggleProductSelection,
    toggleSelectAllProducts,
    productViewMode,
    toggleProductView,
    productPopupVisible,
    handleOpenProductPopup,
    productImportVisible,
    productImporting,
    productImportStep,
    selectedProductImportFilePath,
    productImportSheetNames,
    selectedProductImportSheetName,
    productImportHeaderRowOptions,
    selectedProductImportHeaderRow,
    productImportHeaders,
    productImportRows,
    productImportMappings,
    productImportFieldOptions,
    productImportPreviewRows,
    productImportPreviewErrorCount,
    productImportPreviewValidCount,
    loadExecutions,
    loadProducts,
    filteredReceiptPlans,
    amountProgress,
    getOutstanding,
    totalOutstandingAmount,
    reloadContract,
    handleDeleteAllReceiptPlans,
    receiptPlanViewMode,
    toggleReceiptPlanView,
    selectedReceiptPlanIds,
    receiptPlanTableQuery,
    hasReceiptPlanTableQuery,
    clearReceiptPlanTableQuery,
    selectedReceiptPlanCount,
    toggleReceiptPlanSelection,
    isAllReceiptPlansSelected,
    toggleSelectAllReceiptPlans,
    receiptPlanPopupVisible,
    handleOpenReceiptPlanPopup,
    onHide,
  }
}

