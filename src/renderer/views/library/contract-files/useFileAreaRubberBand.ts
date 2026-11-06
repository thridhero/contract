import { computed, ref, onMounted, onBeforeUnmount, type ComputedRef, type Ref } from 'vue'
import type { ContractFileRecord } from '../../../types/resources'
import type { ContractFilesViewMode } from './contractFilesViewTypes'
import { normalizePathForCompare } from './contractFilesHelpers'

interface RubberBandRect {
  left: number
  top: number
  width: number
  height: number
}

export function useFileAreaRubberBand(args: {
  fileAreaEl: Ref<HTMLElement | null>
  viewMode: Ref<ContractFilesViewMode>
  items: Ref<ContractFileRecord[]>
  listItems: ComputedRef<ContractFileRecord[]>
  sortedListItems: ComputedRef<ContractFileRecord[]>
  treeTableNodes: ComputedRef<any[]>
  treeRootKey: ComputedRef<string>
  treeExpandedKeys: Ref<Record<string, boolean>>
  rootDir: Ref<string>
  currentListDir: Ref<string>
  listAllSelected: Ref<boolean>
  listIncludedIds: Ref<Set<string>>
  listExcludedIds: Ref<Set<string>>
  listSelectionAnchorId: Ref<string | null>
  treeAllSelected: Ref<boolean>
  treeIncludedKeys: Ref<Set<string>>
  treeExcludedKeys: Ref<Set<string>>
  treeSelectionAnchorKey: Ref<string | null>
  waterfallAllSelected: Ref<boolean>
  waterfallIncludedIds: Ref<Set<string>>
  waterfallExcludedIds: Ref<Set<string>>
  isListSelected: (fileId: string) => boolean
  isTreeKeySelected: (key: string) => boolean
  isWaterfallSelected: (record: ContractFileRecord) => boolean
  recordById: ComputedRef<Map<string, ContractFileRecord>>
  recordByPath: ComputedRef<Map<string, ContractFileRecord>>
  onFileAreaPointerDownCapture: (e: MouseEvent) => void
}) {
  const rubberBandActive = ref(false)
  const rubberBandStart = ref<{ x: number; y: number } | null>(null)
  const rubberBandEnd = ref<{ x: number; y: number } | null>(null)
  const fileAreaRect = ref<DOMRect | null>(null)

  const rubberBandStyle = computed(() => {
    if (!rubberBandActive.value || !rubberBandStart.value || !rubberBandEnd.value) {
      return { display: 'none' }
    }

    const start = rubberBandStart.value
    const end = rubberBandEnd.value

    const left = Math.min(start.x, end.x)
    const top = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)

    return {
      display: 'block',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  })

  const isNearFolderOrFile = (element: HTMLElement | null): boolean => {
    if (!element) return false
    // 检查是否点击在文件夹或文件元素上
    const isDataElement = element.hasAttribute('data-contract-file-id') || 
                          element.closest('[data-contract-file-id]') ||
                          element.closest('.p-datatable-tbody > tr') ||
                          element.closest('.p-treetable-tbody > tr')
    return !!isDataElement
  }

  const getSelectableElements = (): Array<{ element: HTMLElement; record: ContractFileRecord | null; key: string }> => {
    const fileArea = args.fileAreaEl.value
    if (!fileArea) return []

    const results: Array<{ element: HTMLElement; record: ContractFileRecord | null; key: string }> = []

    if (args.viewMode.value === 'list' || args.viewMode.value === 'waterfall') {
      // 获取所有表格行或瀑布流卡片
      const rows = fileArea.querySelectorAll('.p-datatable-tbody > tr, [data-contract-file-id]')
      rows.forEach((row) => {
        const el = row as HTMLElement
        const fileId = el.getAttribute('data-contract-file-id')
        if (fileId) {
          const record = args.recordById.value.get(fileId) || null
          results.push({ element: el, record, key: fileId })
        }
      })
    } else if (args.viewMode.value === 'tree') {
      // 获取所有树节点
      const nodes = fileArea.querySelectorAll('.p-treetable-tbody > tr')
      nodes.forEach((node) => {
        const el = node as HTMLElement
        // 从 DOM 中获取节点 key
        const key = el.getAttribute('data-pc-key') || ''
        if (key) {
          const record = args.recordByPath.value.get(key) || null
          results.push({ element: el, record, key })
        }
      })
    }

    return results
  }

  const selectByRubberBand = () => {
    if (!rubberBandStart.value || !rubberBandEnd.value || !fileAreaRect.value) return

    const start = rubberBandStart.value
    const end = rubberBandEnd.value

    const rect1 = {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
    }

    // 如果框选区域太小（可能是点击），不执行框选
    if (rect1.right - rect1.left < 5 && rect1.bottom - rect1.top < 5) {
      return
    }

    const selectableElements = getSelectableElements()
    const selectedInRect: string[] = []

    selectableElements.forEach(({ element, record, key }) => {
      const elRect = element.getBoundingClientRect()
      
      // 计算元素相对于 fileArea 的位置
      const elLeft = elRect.left - fileAreaRect.value!.left
      const elTop = elRect.top - fileAreaRect.value!.top
      const elRight = elLeft + elRect.width
      const elBottom = elTop + elRect.height

      // 检查是否相交
      const intersects = !(
        elRight < rect1.left ||
        elLeft > rect1.right ||
        elBottom < rect1.top ||
        elTop > rect1.bottom
      )

      if (intersects) {
        selectedInRect.push(key)
      }
    })

    // 更新选中状态
    if (args.viewMode.value === 'list') {
      args.listAllSelected.value = false
      args.listExcludedIds.value = new Set()
      args.listIncludedIds.value = new Set(selectedInRect)
      args.listSelectionAnchorId.value = selectedInRect[0] || null
    } else if (args.viewMode.value === 'tree') {
      args.treeAllSelected.value = false
      args.treeExcludedKeys.value = new Set()
      args.treeIncludedKeys.value = new Set(selectedInRect)
      args.treeSelectionAnchorKey.value = selectedInRect[0] || null
    } else if (args.viewMode.value === 'waterfall') {
      args.waterfallAllSelected.value = false
      args.waterfallExcludedIds.value = new Set()
      args.waterfallIncludedIds.value = new Set(selectedInRect)
    }
  }

  const handleMouseDown = (e: MouseEvent) => {
    // 只在以下情况启用框选：
    // 1. 左键点击
    // 2. 没有按下 Ctrl/Cmd/Shift 键
    // 3. 点击在空白区域（不是文件夹或文件元素上）
    // 4. 不是树模式的展开/折叠按钮
    if (e.button !== 0) return
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    
    const target = e.target as HTMLElement | null
    if (isNearFolderOrFile(target)) return
    
    // 检查是否点击在树节点的展开按钮上
    if (target?.closest('.p-treetable-toggler')) return

    // 更新 fileArea 的 rect
    fileAreaRect.value = args.fileAreaEl.value?.getBoundingClientRect() || null
    if (!fileAreaRect.value) return

    // 记录起始位置（相对于 fileArea）
    const startX = e.clientX - fileAreaRect.value.left
    const startY = e.clientY - fileAreaRect.value.top

    rubberBandStart.value = { x: startX, y: startY }
    rubberBandEnd.value = { x: startX, y: startY }
    rubberBandActive.value = true

    // 阻止默认的框选行为
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!rubberBandActive.value || !fileAreaRect.value) return

    const endX = e.clientX - fileAreaRect.value.left
    const endY = e.clientY - fileAreaRect.value.top

    rubberBandEnd.value = { x: endX, y: endY }
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!rubberBandActive.value) return

    // 执行框选
    selectByRubberBand()

    // 重置状态
    rubberBandActive.value = false
    rubberBandStart.value = null
    rubberBandEnd.value = null
  }

  const wrappedPointerDownCapture = (e: MouseEvent) => {
    // 先调用原有的 pointerDownCapture
    args.onFileAreaPointerDownCapture(e)
    
    // 然后处理框选
    handleMouseDown(e)
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })

  return {
    rubberBandActive,
    rubberBandStyle,
    onFileAreaPointerDownCapture: wrappedPointerDownCapture,
  }
}
