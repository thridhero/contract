<template>
  <ResourceView
    :search-query="searchQuery"
    :selected-category="selectedCategory"
    :selected-folder-id="selectedFolderId"
    :refresh-token="refreshToken"
    @search="emit('search', $event)"
    @select-category="emit('select-category', $event)"
    @select-resource="emit('select-resource', $event)"
    @open-resource="emit('open-resource', $event)"
    @move-resource="emit('move-resource', $event)"
    @edit-resource="emit('edit-resource', $event)"
    @delete-resource="emit('delete-resource', $event)"
    @batch-delete-resources="emit('batch-delete-resources', $event)"
    @create-contract="emit('create-contract')"
  />
</template>

<script setup lang="ts">
import ResourceView from '../library/resource/ResourceView.vue'
import type { ContractResource } from '../library/resource/types/contractResource'

interface Props {
  searchQuery?: string
  selectedCategory?: string
  selectedFolderId?: number | null
  refreshToken?: number
}

withDefaults(defineProps<Props>(), {
  searchQuery: '',
  selectedCategory: 'all',
  selectedFolderId: null,
  refreshToken: 0,
})

const emit = defineEmits<{
  (e: 'search', value: string): void
  (e: 'select-category', key: string): void
  (e: 'select-resource', resource: any): void
  (e: 'create-contract'): void
  (e: 'open-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'move-resource', payload: { libraryPath: string; resource: ContractResource; direction: 'top' | 'up' | 'down' | 'bottom' }): void
  (e: 'edit-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'delete-resource', payload: { libraryPath: string; resource: ContractResource }): void
  (e: 'batch-delete-resources', payload: { libraryPath: string; resources: ContractResource[] }): void
}>()
</script>
