import { computed, nextTick } from 'vue'
import type { Ref } from 'vue'
import type { TreeFilterEvent, TreeNodeDropEvent } from 'primevue/tree'
import type { ProjectManagementGroupNode } from '../../../../shared/types/projectManagement.types'

type ConfirmLike = { require: (options: any) => void }
type ToastLike = { add: (message: any) => void }

type TreeNodeDropEventWithAccept = TreeNodeDropEvent & { accept?: () => void }

export function useProjectManagementGroupEditor(options: {
  treeData: Ref<ProjectManagementGroupNode[]>
  groupSource: Ref<'local' | 'tree_dictionary'>
  selectedKey: Ref<Record<string, boolean>>
  activeTreeNode: Ref<ProjectManagementGroupNode | null>
  treeCm: Ref<any>
  groupFilterValue: Ref<string>
  groupDialogRef: Ref<{ open: (mode: 'add' | 'edit', oldName: string, existingNames: string[]) => Promise<string | null> } | null>
  toast: ToastLike
  confirm: ConfirmLike
  saveTreeData: () => Promise<void>
  reloadData: () => Promise<void>
  generateKey: () => string
}) {
  const isProjectManagementGroupNode = (node: unknown): node is ProjectManagementGroupNode => {
    if (!node || typeof node !== 'object') return false
    const candidate = node as { key?: unknown; label?: unknown }
    return typeof candidate.key === 'string' && typeof candidate.label === 'string'
  }

  const ensureRootFirst = (nodes: ProjectManagementGroupNode[]) => {
    const index = nodes.findIndex((n) => String(n?.key) === '0')
    if (index <= 0) return nodes
    const reordered = [...nodes]
    const [root] = reordered.splice(index, 1)
    reordered.unshift(root)
    return reordered
  }

  const getExistingGroupNames = (nodes: ProjectManagementGroupNode[] = options.treeData.value, names: string[] = []): string[] => {
    for (const node of nodes) {
      if (node.key !== '0') names.push(node.label)
      if (node.children?.length) getExistingGroupNames(node.children, names)
    }
    return names
  }

  const treeMenuModel = computed(() => {
    const node = options.activeTreeNode.value
    const isRoot = String(node?.key ?? '') === '0'
    return [
      { label: '新增下级', icon: 'pi pi-plus', command: () => handleAddChild(node) },
      { label: '新增同级', icon: 'pi pi-file-plus', disabled: isRoot, command: () => handleAddSibling(node) },
      { label: '编辑分组', icon: 'pi pi-file-edit', disabled: isRoot, command: () => handleEditGroup(node) },
      { separator: true },
      { label: '删除分组', icon: 'pi pi-trash', danger: true, disabled: isRoot, command: () => handleDeleteGroup(node) },
    ]
  })

  const openTreeActionMenu = async (event: MouseEvent, node: unknown) => {
    if (!isProjectManagementGroupNode(node)) return
    options.activeTreeNode.value = node
    options.selectedKey.value = { [node.key]: true }
    if (options.groupSource.value !== 'local') return
    options.treeCm.value?.hide?.()
    await nextTick()
    options.treeCm.value?.show?.(event)
  }

  const onGroupFilter = (event: TreeFilterEvent) => {
    options.treeCm.value?.hide?.()
    options.groupFilterValue.value = event.value || ''
  }

  const onGroupNodeDrop = async (event: TreeNodeDropEventWithAccept) => {
    options.treeCm.value?.hide?.()
    if (options.groupSource.value !== 'local') return
    const dragKey = String((event.dragNode as any)?.key ?? '')
    if (!dragKey || dragKey === '0') return
    if (typeof event.accept === 'function') {
      event.accept()
      await nextTick()
    } else {
      options.treeData.value = event.value as any
      await nextTick()
    }
    options.treeData.value = ensureRootFirst(options.treeData.value)
    await options.saveTreeData()
  }

  const handleAddRootGroup = async () => {
    if (options.groupSource.value !== 'local') return
    const name = await options.groupDialogRef.value?.open('add', '', getExistingGroupNames())
    if (!name) return
    options.treeData.value.push({ key: options.generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] })
    await options.saveTreeData()
  }

  const handleAddSibling = async (node: ProjectManagementGroupNode | null) => {
    if (options.groupSource.value !== 'local') return
    if (!node) return
    const name = await options.groupDialogRef.value?.open('add', '', getExistingGroupNames())
    if (!name) return

    const walk = (nodes: ProjectManagementGroupNode[]): boolean => {
      for (let index = 0; index < nodes.length; index += 1) {
        if (nodes[index].key === node.key) {
          nodes.splice(index + 1, 0, { key: options.generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] })
          return true
        }
        if (nodes[index].children?.length && walk(nodes[index].children!)) return true
      }
      return false
    }

    if (walk(options.treeData.value)) {
      options.treeCm.value?.hide?.()
      await options.saveTreeData()
    }
  }

  const handleAddChild = async (node: ProjectManagementGroupNode | null) => {
    if (options.groupSource.value !== 'local') return
    if (!node) return
    const name = await options.groupDialogRef.value?.open('add', '', getExistingGroupNames())
    if (!name) return

    const walk = (nodes: ProjectManagementGroupNode[]): boolean => {
      for (const current of nodes) {
        if (current.key === node.key) {
          if (!current.children) current.children = []
          current.children.push({ key: options.generateKey(), label: name, data: name, icon: 'pi pi-folder', children: [] })
          return true
        }
        if (current.children?.length && walk(current.children)) return true
      }
      return false
    }

    if (walk(options.treeData.value)) {
      options.treeCm.value?.hide?.()
      await options.saveTreeData()
    }
  }

  const handleEditGroup = async (node: ProjectManagementGroupNode | null) => {
    if (options.groupSource.value !== 'local') return
    if (!node) return
    const oldName = node.label
    const name = await options.groupDialogRef.value?.open('edit', oldName, getExistingGroupNames())
    if (!name || name === oldName) return

    const walk = (nodes: ProjectManagementGroupNode[]): boolean => {
      for (const current of nodes) {
        if (current.key === node.key) {
          current.label = name
          current.data = name
          return true
        }
        if (current.children?.length && walk(current.children)) return true
      }
      return false
    }

    if (walk(options.treeData.value)) {
      await options.saveTreeData()
      await window.electronAPI.projectManagement.renameGroup(node.key, oldName, name)
      options.treeCm.value?.hide?.()
      await options.reloadData()
    }
  }

  const collectGroupScope = (node: ProjectManagementGroupNode | null) => {
    const keys: string[] = []
    const names: string[] = []
    if (!node) return { keys, names }
    const walk = (current: ProjectManagementGroupNode) => {
      if (current.key !== '0') {
        keys.push(current.key)
        names.push(current.label)
      }
      current.children?.forEach(walk)
    }
    walk(node)
    return { keys, names }
  }

  const handleDeleteGroup = async (node: ProjectManagementGroupNode | null) => {
    if (options.groupSource.value !== 'local') return
    if (!node || node.key === '0') return
    const scope = collectGroupScope(node)
    const countResult = await window.electronAPI.projectManagement.countInGroups(scope.keys, scope.names)
    if (countResult.success && (countResult.data?.count || 0) > 0) {
      options.toast.add({ severity: 'warn', summary: '无法删除', detail: '该分组下存在项目数据，请先迁移或删除项目后再删除分组', life: 3000 })
      return
    }

    options.confirm.require({
      message: `确定要删除分组 "${node.label}" 吗？`,
      header: '删除确认',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      acceptLabel: '确定',
      rejectLabel: '取消',
      accept: async () => {
        const walk = (nodes: ProjectManagementGroupNode[]): boolean => {
          for (let index = 0; index < nodes.length; index += 1) {
            if (nodes[index].key === node.key) {
              nodes.splice(index, 1)
              return true
            }
            if (nodes[index].children?.length && walk(nodes[index].children!)) return true
          }
          return false
        }

        if (walk(options.treeData.value)) {
          options.selectedKey.value = { '0': true }
          await options.saveTreeData()
          await options.reloadData()
        }
      }
    })
  }

  return {
    treeMenuModel,
    openTreeActionMenu,
    onGroupFilter,
    onGroupNodeDrop,
    handleAddRootGroup,
    handleAddSibling,
    handleAddChild,
    handleEditGroup,
    handleDeleteGroup,
  }
}
