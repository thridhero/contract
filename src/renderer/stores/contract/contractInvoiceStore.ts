import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createRendererLogger } from '@/utils/logger';
import type {
  ContractInvoice,
  ContractInvoiceCreateDTO,
  ContractInvoiceQueryDTO,
  ContractInvoiceQueryResult,
  ContractInvoiceUpdateDTO,
} from '../../shared/types/contractInvoice.types';

const logger = createRendererLogger('ContractInvoiceStore');

export const useContractInvoiceStore = defineStore('contractInvoice', () => {
  const rows = ref<ContractInvoice[]>([]);
  const total = ref(0);
  const loading = ref(false);

  const loadData = async (query: ContractInvoiceQueryDTO): Promise<ContractInvoiceQueryResult> => {
    loading.value = true;
    try {
      const response = await window.electronAPI.contractInvoice.getList(query);
      if (!response.success || !response.data) {
        rows.value = [];
        total.value = 0;
        return { data: [], total: 0 };
      }
      rows.value = Array.isArray(response.data.data) ? response.data.data : [];
      total.value = Number(response.data.total || 0);
      return response.data;
    } catch (error) {
      logger.error('Failed to load contract invoices:', error);
      rows.value = [];
      total.value = 0;
      return { data: [], total: 0 };
    } finally {
      loading.value = false;
    }
  };

  const createItem = async (payload: ContractInvoiceCreateDTO): Promise<ContractInvoice | null> => {
    const response = await window.electronAPI.contractInvoice.create(payload);
    if (!response.success || !response.data) return null;
    return response.data;
  };

  const updateItem = async (payload: ContractInvoiceUpdateDTO): Promise<ContractInvoice | null> => {
    const response = await window.electronAPI.contractInvoice.update(payload);
    if (!response.success || !response.data) return null;
    return response.data;
  };

  const remove = async (id: string): Promise<boolean> => {
    const response = await window.electronAPI.contractInvoice.delete(id);
    return Boolean(response.success);
  };

  const restore = async (id: string): Promise<boolean> => {
    const response = await window.electronAPI.contractInvoice.restore(id);
    return Boolean(response.success);
  };

  const purge = async (id: string): Promise<boolean> => {
    const response = await window.electronAPI.contractInvoice.purge(id);
    return Boolean(response.success);
  };

  const batchDelete = async (ids: string[]): Promise<number> => {
    const response = await window.electronAPI.contractInvoice.batchDelete(ids);
    if (!response.success) return 0;
    return response.data?.deletedCount ?? 0;
  };

  const batchRestore = async (ids: string[]): Promise<number> => {
    const response = await window.electronAPI.contractInvoice.batchRestore(ids);
    if (!response.success) return 0;
    return response.data?.restoredCount ?? 0;
  };

  const batchPurge = async (ids: string[]): Promise<number> => {
    const response = await window.electronAPI.contractInvoice.batchPurge(ids);
    if (!response.success) return 0;
    return response.data?.purgedCount ?? 0;
  };

  return {
    rows,
    total,
    loading,
    loadData,
    createItem,
    updateItem,
    remove,
    restore,
    purge,
    batchDelete,
    batchRestore,
    batchPurge,
  };
});

