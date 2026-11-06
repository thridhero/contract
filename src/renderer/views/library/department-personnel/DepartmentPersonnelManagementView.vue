<template>
  <main class="flex h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <aside
      class="department-tree-panel relative flex flex-col border-r border-[var(--content-border)] bg-[var(--sidebar-bg)] overflow-hidden"
      :style="{ width: `${treePanelWidth}px` }"
    >
      <header class="flex items-center justify-between px-4 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--sidebar-bg)]/50 backdrop-blur-sm" style="-webkit-app-region: drag;">
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <i class="pi pi-sitemap text-[var(--btn-primary-bg)]"></i>
          <h2 class="font-bold">部门管理</h2>
        </div>
        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <Button icon="pi pi-plus" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'新增部门'" @click="openDepartmentAdd" />
          <Button icon="pi pi-pencil" class="p-button-text p-button-sm !w-8 !h-8" :disabled="!canEditSelectedDepartment" v-tooltip.bottom="'编辑部门'" @click="selectedDepartment && editDepartment(selectedDepartment)" />
          <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger !w-8 !h-8" :disabled="!canDeleteSelectedDepartment || deptDeleteBlocked" v-tooltip.bottom="'删除部门'" @click="selectedDepartment && deleteDepartment(selectedDepartment)" />
        </div>
      </header>

      <div class="p-3 flex flex-col gap-3 flex-1 overflow-hidden">
        <div class="relative w-full">
          <InputText v-model="deptSearchQuery" class="w-full !pl-10 h-9" placeholder="搜索编码/名称/负责人..." @keyup.enter="loadDepartments" />
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs"></i>
        </div>

        <div class="flex-1 overflow-auto bg-[var(--sidebar-bg)]">
          <Tree
            v-model:selectionKeys="selectedDeptKey"
            v-model:contextMenuSelectionKey="deptContextMenuSelectionKey"
            :value="departmentTree"
            selectionMode="single"
            :loading="deptLoading"
            class="custom-tree"
            @node-select="onDepartmentNodeSelect"
          >
            <template #default="slotProps">
              <div
                class="flex items-center gap-2 py-1 min-w-0"
                @click="onDepartmentNodeClick(slotProps.node)"
                @contextmenu.prevent.stop="openDepartmentContextMenu($event, slotProps.node)"
              >
                <i :class="slotProps.node.children?.length ? 'pi pi-folder' : 'pi pi-file'" class="text-[var(--btn-primary-bg)] opacity-70"></i>
                <span
                  class="min-w-0 truncate"
                  :title="String(slotProps.node.label || '')"
                  :class="{ 'font-bold': selectedDepartment?.id === slotProps.node.key }"
                >
                  {{ slotProps.node.label }}
                </span>
              </div>
            </template>
          </Tree>
        </div>

        <div class="flex items-center justify-between py-1 px-1 border-t border-[var(--content-border)]/50">
          <span class="text-[var(--content-text-secondary)]">共 {{ deptTotal }} 个部门</span>
        </div>
      </div>
      <div class="department-tree-resizer" :class="{ 'is-resizing': isResizingTreePanel }" @mousedown.prevent="startTreePanelResize" />
    </aside>

    <section class="flex-1 flex flex-col bg-[var(--content-bg)] overflow-hidden">
      <header class="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md" style="-webkit-app-region: drag;">
        <div class="flex items-center gap-4" style="-webkit-app-region: no-drag;">
          <h2 class="font-bold flex items-center gap-2">
            <i class="pi pi-id-card text-[var(--btn-primary-bg)]"></i>
            员工管理
            <span v-if="selectedDepartment" class="font-normal text-[var(--content-text-secondary)] bg-[var(--sidebar-active-bg)] px-2 py-0.5 rounded ml-1">
              {{ selectedDepartment.name }}
            </span>
          </h2>
          <div class="relative w-72">
            <InputText v-model="personSearchQuery" class="w-full !pl-10 h-9" placeholder="搜索编号/姓名/岗位/手机号/身份证..." @keyup.enter="loadPersonnel" />
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--content-text-secondary)] text-xs"></i>
          </div>
        </div>

        <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <div class="flex items-center gap-1 pr-3 mr-3 border-r border-[var(--content-border)]">
            <Button icon="pi pi-plus" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'新增员工'" @click="openPersonnelAdd" />
            <Button icon="pi pi-file-import" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'导入简历识别'" @click="openPersonnelImport" />
            <Button icon="pi pi-folder-open" class="p-button-text p-button-sm !w-8 !h-8" v-tooltip.bottom="'批量导入简历'" @click="openPersonnelBatchImport" />
            <Button icon="pi pi-eye" class="p-button-text p-button-sm !w-8 !h-8" :disabled="!selectedPersonnel" v-tooltip.bottom="'查看详情'" @click="openPersonnelDetail(selectedPersonnel!)" />
            <Button icon="pi pi-pencil" class="p-button-text p-button-sm !w-8 !h-8" :disabled="!selectedPersonnel" v-tooltip.bottom="'编辑员工'" @click="editPersonnel(selectedPersonnel!)" />
            <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger !w-8 !h-8" :disabled="!selectedPersonnel" v-tooltip.bottom="'删除员工'" @click="deletePersonnel(selectedPersonnel!)" />
            <Button
              icon="pi pi-list"
              class="p-button-text p-button-sm !w-8 !h-8"
              :class="personViewMode === 'list' ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : ''"
              v-tooltip.bottom="'列表视图'"
              @click="setPersonViewMode('list')"
            />
            <Button
              icon="pi pi-th-large"
              class="p-button-text p-button-sm !w-8 !h-8"
              :class="personViewMode === 'card' ? '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]' : ''"
              v-tooltip.bottom="'卡片视图'"
              @click="setPersonViewMode('card')"
            />
          </div>

          <div class="flex items-center gap-1">
            <Button icon="pi pi-minus" class="p-button-text p-button-secondary p-button-sm !w-8 !h-8" v-tooltip.bottom="'最小化窗口'" @click="minimizeWindow" />
            <Button :icon="isMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" class="p-button-text p-button-secondary p-button-sm !w-8 !h-8" v-tooltip.bottom="isMaximized ? '还原窗口' : '最大化窗口'" @click="toggleMaximize" />
            <Button icon="pi pi-times" class="p-button-text p-button-danger p-button-sm !w-8 !h-8" v-tooltip.bottom="'关闭'" @click="closeWindow" />
          </div>
        </div>
      </header>

      <div class="p-6 flex-1 overflow-hidden flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">员工数量</div>
            <div class="text-2xl font-semibold mt-1">{{ personTotal }}</div>
          </div>
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">在职人数</div>
            <div class="text-2xl font-semibold mt-1">{{ activePersonnelCount }}</div>
          </div>
          <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
            <div class="text-xs text-[var(--content-text-secondary)]">已展示工资信息</div>
            <div class="text-2xl font-semibold mt-1">{{ salaryVisibleCount }}</div>
          </div>
        </div>

        <DataTable
          v-if="personViewMode === 'list'"
          :value="personnel"
          dataKey="id"
          v-model:selection="selectedPersonnel"
          selectionMode="single"
          :loading="personLoading"
          stripedRows
          class="flex-1 custom-datatable p-datatable-sm"
          :scrollable="true"
          scrollHeight="flex"
          @row-contextmenu="onPersonnelContextMenu"
          @row-click="onPersonnelRowClick"
          @row-dblclick="onPersonnelRowDblClick"
        >
          <template #empty>
            <div class="flex flex-col items-center justify-center py-20 text-[var(--content-text-secondary)]">
              <i class="pi pi-inbox text-4xl mb-3 opacity-30"></i>
              <p>暂无员工数据</p>
            </div>
          </template>
          <Column field="code" header="编号" style="width: 120px" />
          <Column field="name" header="姓名" style="width: 140px">
            <template #body="slotProps">
              <button class="font-semibold hover:text-[var(--btn-primary-bg)] hover:underline" @click.stop="openPersonnelDetail(slotProps.data)">
                {{ slotProps.data.name || '-' }}
              </button>
            </template>
          </Column>
          <Column header="所属部门" style="min-width: 180px">
            <template #body="slotProps">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="name in slotProps.data.department_names"
                  :key="name"
                  class="px-1.5 py-0.5 bg-[var(--sidebar-active-bg)] rounded border border-[var(--btn-primary-bg)]/10 text-[var(--btn-primary-bg)]"
                >
                  {{ name }}
                </span>
                <span v-if="!slotProps.data.department_names?.length">-</span>
              </div>
            </template>
          </Column>
          <Column field="position" header="岗位" style="width: 160px" />
          <Column field="phone" header="手机号" style="width: 150px" />
          <Column header="月薪" style="width: 150px">
            <template #body="slotProps">
              {{ formatSalary(slotProps.data.salary_monthly, slotProps.data.salary_currency) }}
            </template>
          </Column>
          <Column field="status" header="状态" style="width: 100px">
            <template #body="slotProps">
              <Tag :value="slotProps.data.status" :severity="getStatusSeverity(slotProps.data.status)" />
            </template>
          </Column>
          <Column header="操作" style="width: 170px">
            <template #body="slotProps">
              <div class="flex gap-1">
                <Button icon="pi pi-eye" class="p-button-text p-button-sm !w-7 !h-7" @click.stop="openPersonnelDetail(slotProps.data)" />
                <Button icon="pi pi-pencil" class="p-button-text p-button-sm !w-7 !h-7" @click.stop="editPersonnel(slotProps.data)" />
                <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger !w-7 !h-7" @click.stop="deletePersonnel(slotProps.data)" />
                <Button icon="pi pi-copy" class="p-button-text p-button-sm !w-7 !h-7" v-tooltip.bottom="'复制姓名和手机号'" @click.stop="copyPersonnelBrief(slotProps.data)" />
              </div>
            </template>
          </Column>
        </DataTable>

        <div v-else class="flex-1 overflow-auto">
          <div v-if="personLoading" class="flex items-center justify-center h-full text-[var(--content-text-secondary)]">
            正在加载员工数据...
          </div>
          <div v-else-if="personnel.length === 0" class="flex flex-col items-center justify-center py-20 text-[var(--content-text-secondary)]">
            <i class="pi pi-inbox text-4xl mb-3 opacity-30"></i>
            <p>暂无员工数据</p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            <div
              v-for="item in personnel"
              :key="item.id"
              class="group rounded-2xl border bg-[var(--content-card-bg)] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
              :style="{ borderColor: selectedPersonnel?.id === item.id ? 'var(--btn-primary-bg)' : 'var(--content-border)' }"
              @click="selectPersonnel(item)"
              @dblclick="openPersonnelFiles(item)"
              @contextmenu.prevent.stop="onPersonnelCardContextMenu($event, item)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--content-border)] bg-[var(--sidebar-bg)]">
                    <img v-if="getPersonnelPhotoUrl(item)" :src="getPersonnelPhotoUrl(item)" :alt="`${item.name || '员工'}照片`" class="h-full w-full object-cover" />
                    <span v-else class="text-lg font-semibold tracking-wide text-[var(--content-text-secondary)]">{{ getPersonnelPhotoFallback(item) }}</span>
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs uppercase tracking-wider text-[var(--content-text-secondary)]">{{ item.code || '未编号' }}</div>
                    <button class="mt-1 text-xl font-bold text-[var(--content-text)] group-hover:text-[var(--btn-primary-bg)] line-clamp-1 text-left" @click.stop="openPersonnelDetail(item)">
                      {{ item.name || '-' }}
                    </button>
                    <div class="mt-1 text-sm text-[var(--content-text-secondary)] line-clamp-1">{{ item.position || '未填写岗位' }}</div>
                  </div>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button icon="pi pi-eye" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="openPersonnelDetail(item)" />
                  <Button icon="pi pi-pencil" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="editPersonnel(item)" />
                  <Button icon="pi pi-copy" class="p-button-text p-button-sm !w-8 !h-8 !p-0" @click.stop="copyPersonnelBrief(item)" />
                  <Button icon="pi pi-trash" class="p-button-text p-button-sm !w-8 !h-8 !p-0 p-button-danger" @click.stop="deletePersonnel(item)" />
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-1">
                <span
                  v-for="departmentName in item.department_names || []"
                  :key="departmentName"
                  class="px-2 py-0.5 rounded-full bg-[var(--sidebar-hover-bg)] text-xs text-[var(--content-text)]"
                >
                  {{ departmentName }}
                </span>
                <span v-if="!(item.department_names || []).length" class="text-xs text-[var(--content-text-secondary)]">未关联部门</span>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
                  <div class="text-[11px] text-[var(--content-text-secondary)]">手机号</div>
                  <div class="mt-1 font-medium text-[var(--content-text)]">{{ item.phone || '-' }}</div>
                </div>
                <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
                  <div class="text-[11px] text-[var(--content-text-secondary)]">月薪</div>
                  <div class="mt-1 font-medium text-[var(--content-text)]">{{ formatSalary(item.salary_monthly, item.salary_currency) }}</div>
                </div>
                <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
                  <div class="text-[11px] text-[var(--content-text-secondary)]">状态</div>
                  <div class="mt-1">
                    <Tag :value="item.status || '-'" :severity="getStatusSeverity(item.status)" />
                  </div>
                </div>
                <div class="rounded-lg bg-[var(--sidebar-bg)] p-3">
                  <div class="text-[11px] text-[var(--content-text-secondary)]">入职日期</div>
                  <div class="mt-1 font-medium text-[var(--content-text)]">{{ item.entry_date || '-' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between py-2 border-t border-[var(--content-border)]">
          <span class="text-[var(--content-text-secondary)]">共 {{ personTotal }} 条</span>
          <Paginator
            :rows="personPageSize"
            :totalRecords="personTotal"
            :first="(personPage - 1) * personPageSize"
            :rowsPerPageOptions="[10, 20, 50, 100]"
            class="custom-paginator !p-0"
            @page="onPersonPageChange"
          />
        </div>
      </div>
    </section>

    <DepartmentDialog
      v-model:visible="deptDialogVisible"
      :isEdit="deptIsEdit"
      :initialData="deptEditingRow"
      :defaultParentId="deptDefaultParentId"
      :departmentOptions="departmentTree"
      :companyRootKey="COMPANY_ROOT_KEY"
      @saved="onDepartmentSaved"
    />

    <PersonnelDialog
      ref="personDialogRef"
      v-model:visible="personDialogVisible"
      :isEdit="personIsEdit"
      :initialData="personEditingRow"
      :initialDraft="personCreationDraft"
      :departmentOptions="departmentOptionsForPersonnel"
      :defaultDepartmentId="selectedDepartmentForPersonnel?.id || null"
      @saved="onPersonnelSaved"
    />

    <PersonnelBatchImportDialog
      v-model:visible="personBatchImportVisible"
      @select-folder="selectPersonnelBatchFolder"
      @start-import="startPersonnelBatchImport"
      @retry-item="retryPersonnelBatchItem"
      @manual-fix="openPersonnelManualFix"
      @open-personnel="openPersonnelById"
    />

    <PersonnelDetailDrawer
      v-model="personDetailVisible"
      :personnelData="detailPersonnel"
      :has-previous="personDetailHasPrevious"
      :has-next="personDetailHasNext"
      @edit="editPersonnel"
      @updated="onPersonnelDetailUpdated"
      @navigate-previous="navigatePersonnelDetail('previous')"
      @navigate-next="navigatePersonnelDetail('next')"
    />

    <ContextMenu ref="deptContextMenu" :model="deptMenuItems" @hide="deptContextMenuSelectionKey = null" />
    <ContextMenu ref="personContextMenu" :model="personMenuItems">
      <template #item="{ item, props: itemProps }">
        <a class="flex items-center w-full gap-2 px-2 py-1" v-bind="itemProps.action">
          <span :class="item.icon" class="shrink-0"></span>
          <span :class="[item.class]">{{ item.label }}</span>
          <span v-if="item.shortcut" class="ml-auto text-xs text-[var(--content-text-secondary)]">{{ item.shortcut }}</span>
        </a>
      </template>
    </ContextMenu>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tree from 'primevue/tree';
import Button from 'primevue/button';
import Paginator from 'primevue/paginator';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import ContextMenu from 'primevue/contextmenu';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useWindowStateStore } from '../../../stores/ui/windowState';
import { useLibraryStore } from '../../../stores/library/libraryStore';
import { usePersonnelBatchImportStore } from '../../../stores/system/personnelBatchImportStore';
import { getPersonnelPhotoFallbackText, resolvePersonnelPhotoUrl } from './personnelPhoto';
import DepartmentDialog from './components/DepartmentDialog.vue';
import PersonnelDialog from './components/PersonnelDialog.vue';
import PersonnelBatchImportDialog from './components/PersonnelBatchImportDialog.vue';
import PersonnelDetailDrawer from './components/PersonnelDetailDrawer.vue';
import type { Department, DepartmentQueryDTO } from '../../../../shared/types/department.types';
import type { Personnel, PersonnelCreateDTO, PersonnelQueryDTO, PersonnelResumeParsedData } from '../../../../shared/types/personnel.types';

const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const windowStateStore = useWindowStateStore();
const libraryStore = useLibraryStore();
const personnelBatchImportStore = usePersonnelBatchImportStore();

const COMPANY_ROOT_KEY = '__company_root__';

const TREE_PANEL_WIDTH_STORAGE_KEY = 'department-personnel:tree-panel-width';
const TREE_PANEL_WIDTH_DEFAULT = 380;
const TREE_PANEL_WIDTH_MIN = 260;
const TREE_PANEL_WIDTH_MAX = 560;
const clampTreePanelWidth = (width: number) =>
  Math.min(TREE_PANEL_WIDTH_MAX, Math.max(TREE_PANEL_WIDTH_MIN, Math.round(width)));
const getInitialTreePanelWidth = () => {
  const saved = Number(localStorage.getItem(TREE_PANEL_WIDTH_STORAGE_KEY));
  if (Number.isFinite(saved) && saved > 0) return clampTreePanelWidth(saved);
  return TREE_PANEL_WIDTH_DEFAULT;
};
const treePanelWidth = ref<number>(getInitialTreePanelWidth());

const isResizingTreePanel = ref(false);
let treePanelResizeStartX = 0;
let treePanelResizeStartWidth = 0;
let bodyCursorBeforeTreePanelResize = '';
let bodyUserSelectBeforeTreePanelResize = '';

const stopTreePanelResize = () => {
  if (!isResizingTreePanel.value) return;
  isResizingTreePanel.value = false;
  window.removeEventListener('mousemove', onTreePanelResizeMove);
  window.removeEventListener('mouseup', stopTreePanelResize);
  document.body.style.cursor = bodyCursorBeforeTreePanelResize;
  document.body.style.userSelect = bodyUserSelectBeforeTreePanelResize;
  localStorage.setItem(TREE_PANEL_WIDTH_STORAGE_KEY, String(treePanelWidth.value));
};

const onTreePanelResizeMove = (event: MouseEvent) => {
  if (!isResizingTreePanel.value) return;
  const deltaX = event.clientX - treePanelResizeStartX;
  treePanelWidth.value = clampTreePanelWidth(treePanelResizeStartWidth + deltaX);
};

const startTreePanelResize = (event: MouseEvent) => {
  isResizingTreePanel.value = true;
  treePanelResizeStartX = event.clientX;
  treePanelResizeStartWidth = treePanelWidth.value;
  bodyCursorBeforeTreePanelResize = document.body.style.cursor;
  bodyUserSelectBeforeTreePanelResize = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onTreePanelResizeMove);
  window.addEventListener('mouseup', stopTreePanelResize);
};

// --- 部门数据 ---
const departments = ref<Department[]>([]);
const departmentTree = ref<any[]>([]);
const selectedDepartment = ref<Department | null>(null);
const selectedDeptKey = ref<any>({});
const deptLoading = ref(false);
const deptSearchQuery = ref('');
const deptTotal = ref(0);

const deptDialogVisible = ref(false);
const deptIsEdit = ref(false);
const deptEditingRow = ref<Department | null>(null);
const deptDefaultParentId = ref<string | null>(null);
const deptDeleteBlocked = ref(false);
const deptContextMenuSelectionKey = ref<string | null>(null);

const companyLabel = computed(() => {
  const current = libraryStore.currentLibrary?.name;
  const cached = localStorage.getItem('currentLibraryName');
  const label = String(current || cached || '').trim();
  return label || '公司信息';
});

const isCompanyRoot = (dept: Department | null | undefined) => Boolean(dept?.id && dept.id === COMPANY_ROOT_KEY);
const isCompanyRootSelected = computed(() => isCompanyRoot(selectedDepartment.value));
const canEditSelectedDepartment = computed(() => Boolean(selectedDepartment.value && !isCompanyRootSelected.value));
const canDeleteSelectedDepartment = computed(() => Boolean(selectedDepartment.value && !isCompanyRootSelected.value));
const selectedDepartmentForPersonnel = computed(() => (isCompanyRootSelected.value ? null : selectedDepartment.value));
const departmentOptionsForPersonnel = computed(() => {
  const root = departmentTree.value?.[0];
  const children = root?.children;
  return Array.isArray(children) ? children : [];
});

const deptContextMenu = ref();
const deptMenuItems = computed(() => ([
  {
    label: '新增同级',
    icon: 'pi pi-plus-circle',
    disabled: !selectedDepartment.value || isCompanyRootSelected.value,
    command: () => selectedDepartment.value && openDepartmentAddAsSibling(selectedDepartment.value),
  },
  {
    label: '新增子级',
    icon: 'pi pi-plus',
    disabled: !selectedDepartment.value,
    command: () => selectedDepartment.value && openDepartmentAddAsChild(selectedDepartment.value),
  },
  { label: '修改', icon: 'pi pi-pencil', disabled: !canEditSelectedDepartment.value, command: () => selectedDepartment.value && editDepartment(selectedDepartment.value) },
  {
    label: '删除',
    icon: 'pi pi-trash',
    class: 'text-red-500',
    disabled: !canDeleteSelectedDepartment.value || deptDeleteBlocked.value,
    command: () => selectedDepartment.value && deleteDepartment(selectedDepartment.value),
  },
]));

// --- 人员数据 ---
const personnel = ref<Personnel[]>([]);
const selectedPersonnel = ref<Personnel | null>(null);
const personLoading = ref(false);
const personSearchQuery = ref('');
const personPage = ref(1);
const personPageSize = ref(20);
const personTotal = ref(0);
const personViewMode = ref<'list' | 'card'>('list');

const selectedDepartmentFilterId = computed(() => {
  const dept = selectedDepartment.value;
  if (!dept?.id) return undefined;
  if (dept.id === COMPANY_ROOT_KEY) return undefined;
  return dept.id;
});

const personDialogVisible = ref(false);
const personIsEdit = ref(false);
const personEditingRow = ref<Personnel | null>(null);
const personCreationDraft = ref<(Partial<PersonnelCreateDTO> & Partial<PersonnelResumeParsedData> & { resume_text?: string; resume_file_path?: string }) | null>(null);
const personBatchImportVisible = ref(false);
const personManualImportSourceFilePath = ref('');
const personDialogRef = ref<InstanceType<typeof PersonnelDialog> | null>(null);
const personDetailVisible = ref(false);
const detailPersonnel = ref<Personnel | null>(null);

const personContextMenu = ref();
const selectedPersonnelIndexInPage = computed(() => {
  const id = selectedPersonnel.value?.id;
  if (!id) return -1;
  return personnel.value.findIndex(item => item.id === id);
});
const detailPersonnelIndexInPage = computed(() => {
  const id = detailPersonnel.value?.id || selectedPersonnel.value?.id;
  if (!id) return -1;
  return personnel.value.findIndex(item => item.id === id);
});
const personDetailHasPrevious = computed(() => personDetailVisible.value && detailPersonnelIndexInPage.value > 0);
const personDetailHasNext = computed(() =>
  personDetailVisible.value
  && detailPersonnelIndexInPage.value >= 0
  && detailPersonnelIndexInPage.value < personnel.value.length - 1
);
const activePersonnelCount = computed(() => personnel.value.filter(item => item.status === '在职').length);
const salaryVisibleCount = computed(() => personnel.value.filter(item => item.salary_monthly || item.salary_base).length);

// --- 窗口状态 ---
const isMaximized = ref(false);
let unlistenMaximize: (() => void) | null = null;

// --- 工具函数 ---
const getStatusSeverity = (status?: string) => {
  switch (status) {
    case '在职': return 'success';
    case '离职': return 'danger';
    case '休假': return 'warn';
    default: return 'info';
  }
};

const normalizeParentId = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  return raw ? raw : null;
};

const buildTree = (data: Department[], parentId: string | null = null): any[] => {
  return data
    .filter(item => normalizeParentId(item.parent_id) === parentId)
    .map(item => ({
      key: item.id,
      label: item.name,
      data: item,
      children: buildTree(data, item.id)
    }));
};

const refreshDepartmentDeleteState = async (department: Department | null) => {
  if (!department?.id || department.id === COMPANY_ROOT_KEY) {
    deptDeleteBlocked.value = false;
    return;
  }
  try {
    const res = await window.electronAPI.personnel.getList({
      department_id: department.id,
      page: 1,
      pageSize: 1,
    });
    deptDeleteBlocked.value = Boolean(res.success && res.data && Number(res.data.total || 0) > 0);
  } catch {
    deptDeleteBlocked.value = false;
  }
};

// --- 部门逻辑 ---
const loadDepartments = async () => {
  deptLoading.value = true;
  try {
    const query: DepartmentQueryDTO = {
      search: deptSearchQuery.value.trim() || undefined,
      searchFields: ['code', 'name', 'leader'],
    };
    const res = await window.electronAPI.department.getList(query);
    if (res.success && res.data) {
      departments.value = res.data.data;
      deptTotal.value = res.data.total;
      departmentTree.value = [{
        key: COMPANY_ROOT_KEY,
        label: companyLabel.value,
        data: {
          id: COMPANY_ROOT_KEY,
          parent_id: null,
          code: '',
          name: companyLabel.value,
          leader: '',
          phone: '',
          email: '',
          sort_order: -1,
          remark: '',
        } as Department,
        children: buildTree(res.data.data, null),
      }];
    }
  } finally {
    deptLoading.value = false;
  }
};

const onDepartmentNodeSelect = (event: any) => {
  const node = event?.node || event;
  selectedDepartment.value = node?.data || null;
  void refreshDepartmentDeleteState(selectedDepartment.value);
  personPage.value = 1;
  void loadPersonnel();
};

const onDepartmentNodeClick = (node: any) => {
  if (!node?.data?.id) return;
  selectedDeptKey.value = { [node.key]: true };
  deptContextMenuSelectionKey.value = node.key;
  selectedDepartment.value = node.data;
  void refreshDepartmentDeleteState(selectedDepartment.value);
  if (selectedDepartment.value?.id !== node.data.id) return;
  personPage.value = 1;
  void loadPersonnel();
};

const openDepartmentContextMenu = (event: MouseEvent, node: any) => {
  if (!node?.data?.id) return;
  selectedDeptKey.value = { [node.key]: true };
  deptContextMenuSelectionKey.value = node.key;
  selectedDepartment.value = node.data;
  void refreshDepartmentDeleteState(selectedDepartment.value);
  personPage.value = 1;
  void loadPersonnel();
  deptContextMenu.value?.show(event);
};

const openDepartmentAdd = () => {
  deptIsEdit.value = false;
  deptEditingRow.value = null;
  deptDefaultParentId.value = COMPANY_ROOT_KEY;
  deptDialogVisible.value = true;
};

const openDepartmentAddAsChild = (row: Department) => {
  deptIsEdit.value = false;
  deptEditingRow.value = null;
  deptDefaultParentId.value = row.id === COMPANY_ROOT_KEY ? COMPANY_ROOT_KEY : row.id;
  deptDialogVisible.value = true;
};

const openDepartmentAddAsSibling = (row: Department) => {
  deptIsEdit.value = false;
  deptEditingRow.value = null;
  deptDefaultParentId.value = normalizeParentId(row.parent_id) || COMPANY_ROOT_KEY;
  deptDialogVisible.value = true;
};

const editDepartment = (row: Department) => {
  if (row.id === COMPANY_ROOT_KEY) return;
  deptIsEdit.value = true;
  deptEditingRow.value = row;
  deptDefaultParentId.value = null;
  deptDialogVisible.value = true;
};

const deleteDepartment = (row: Department) => {
  if (row.id === COMPANY_ROOT_KEY) return;
  confirm.require({
    header: '删除确认',
    message: `确定删除部门“${row.name}”吗？如有子部门或人员隶属于该部门将无法删除。`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const res = await window.electronAPI.department.delete(row.id);
      if (!res.success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '未知错误', life: 3500 });
        return;
      }
      toast.add({ severity: 'success', summary: '删除成功', detail: row.name, life: 2500 });
      if (selectedDepartment.value?.id === row.id) {
        selectedDepartment.value = null;
        selectedDeptKey.value = {};
      }
      await loadDepartments();
      await loadPersonnel();
    },
  });
};

const onDepartmentSaved = async () => {
  deptDefaultParentId.value = null;
  await loadDepartments();
};

// --- 人员逻辑 ---
const buildPersonnelQueryBase = (): PersonnelQueryDTO => ({
  search: personSearchQuery.value.trim() || undefined,
  searchFields: ['code', 'name', 'position', 'phone', 'id_card_number'],
  department_id: selectedDepartmentFilterId.value,
});

const formatSalary = (value?: number | null, currency?: string) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const code = String(currency || 'CNY').trim() || 'CNY';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${code} ${num.toFixed(2)}`;
  }
};

const getPersonnelPhotoUrl = (row?: Personnel | null) => resolvePersonnelPhotoUrl(row?.photo_file_path);
const getPersonnelPhotoFallback = (row?: Personnel | null) => getPersonnelPhotoFallbackText(row?.name);

const setPersonViewMode = (mode: 'list' | 'card') => {
  personViewMode.value = mode;
  localStorage.setItem('department-personnel:view-mode', mode);
};

const movePersonnel = async (action: 'up' | 'down' | 'top' | 'bottom') => {
  const current = selectedPersonnel.value;
  if (!current?.id) return;
  try {
    personLoading.value = true;
    const res = await window.electronAPI.personnel.getList(buildPersonnelQueryBase());
    if (!res.success || !res.data) {
      toast.add({ severity: 'error', summary: '排序失败', detail: res.error || '查询失败', life: 3000 });
      return;
    }
    const list = res.data.data || [];
    const idx = list.findIndex(item => item.id === current.id);
    if (idx < 0) return;

    const currentItem = list[idx]!;
    const minSortOrder = Math.min(...list.map(item => Number(item.sort_order || 0)));
    const maxSortOrder = Math.max(...list.map(item => Number(item.sort_order || 0)));

    let updates: Array<{ id: string; sort_order: number }> = [];

    if (action === 'up') {
      if (idx <= 0) return;
      const prev = list[idx - 1]!;
      let newCurrentOrder = Number(prev.sort_order || 0);
      let newPrevOrder = Number(currentItem.sort_order || 0);
      if (newCurrentOrder === newPrevOrder) {
        newCurrentOrder = Number(prev.sort_order || 0) - 1;
        newPrevOrder = Number(prev.sort_order || 0) + 1;
      }
      updates = [
        { id: currentItem.id, sort_order: newCurrentOrder },
        { id: prev.id, sort_order: newPrevOrder },
      ];
    } else if (action === 'down') {
      if (idx >= list.length - 1) return;
      const next = list[idx + 1]!;
      let newCurrentOrder = Number(next.sort_order || 0);
      let newNextOrder = Number(currentItem.sort_order || 0);
      if (newCurrentOrder === newNextOrder) {
        newCurrentOrder = Number(next.sort_order || 0) + 1;
        newNextOrder = Number(next.sort_order || 0) - 1;
      }
      updates = [
        { id: currentItem.id, sort_order: newCurrentOrder },
        { id: next.id, sort_order: newNextOrder },
      ];
    } else if (action === 'top') {
      updates = [{ id: currentItem.id, sort_order: minSortOrder - 10 }];
    } else if (action === 'bottom') {
      updates = [{ id: currentItem.id, sort_order: maxSortOrder + 10 }];
    }

    if (!updates.length) return;
    const updateRes = await window.electronAPI.personnel.updateSort(updates);
    if (!updateRes.success) {
      toast.add({ severity: 'error', summary: '排序失败', detail: updateRes.error || '更新失败', life: 3000 });
      return;
    }
    await loadPersonnel();
  } finally {
    personLoading.value = false;
  }
};

const personMenuItems = computed(() => ([
  { label: '查看详情', icon: 'pi pi-eye', shortcut: 'Enter', disabled: !selectedPersonnel.value, command: () => selectedPersonnel.value && openPersonnelDetail(selectedPersonnel.value) },
  { label: '复制姓名和手机号', icon: 'pi pi-copy', shortcut: 'Ctrl+Shift+C', disabled: !selectedPersonnel.value, command: () => selectedPersonnel.value && copyPersonnelBrief(selectedPersonnel.value) },
  { label: '修改', icon: 'pi pi-pencil', shortcut: 'F2', disabled: !selectedPersonnel.value, command: () => selectedPersonnel.value && editPersonnel(selectedPersonnel.value) },
  { label: '删除', icon: 'pi pi-trash', class: 'text-red-500', shortcut: 'Delete', disabled: !selectedPersonnel.value, command: () => selectedPersonnel.value && deletePersonnel(selectedPersonnel.value) },
  { separator: true },
  { label: '向上', icon: 'pi pi-angle-up', shortcut: 'Ctrl+↑', disabled: !selectedPersonnel.value || selectedPersonnelIndexInPage.value <= 0, command: () => void movePersonnel('up') },
  { label: '向下', icon: 'pi pi-angle-down', shortcut: 'Ctrl+↓', disabled: !selectedPersonnel.value || selectedPersonnelIndexInPage.value < 0 || selectedPersonnelIndexInPage.value >= personnel.value.length - 1, command: () => void movePersonnel('down') },
  { label: '置顶', icon: 'pi pi-angle-double-up', shortcut: 'Ctrl+Shift+↑', disabled: !selectedPersonnel.value, command: () => void movePersonnel('top') },
  { label: '置底', icon: 'pi pi-angle-double-down', shortcut: 'Ctrl+Shift+↓', disabled: !selectedPersonnel.value, command: () => void movePersonnel('bottom') },
]));

const onGlobalKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  const editing = Boolean(
    target?.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
  if (editing) return;

  if (event.key === 'Insert') {
    event.preventDefault();
    openPersonnelAdd();
    return;
  }
  if (event.key === 'Enter' && selectedPersonnel.value) {
    event.preventDefault();
    openPersonnelDetail(selectedPersonnel.value);
    return;
  }
  if (event.key === 'F2' && selectedPersonnel.value) {
    event.preventDefault();
    editPersonnel(selectedPersonnel.value);
    return;
  }
  if (event.key === 'Delete' && selectedPersonnel.value) {
    event.preventDefault();
    deletePersonnel(selectedPersonnel.value);
    return;
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c' && selectedPersonnel.value) {
    event.preventDefault();
    void copyPersonnelBrief(selectedPersonnel.value);
    return;
  }
  if (event.ctrlKey && event.shiftKey && event.key === 'ArrowUp' && selectedPersonnel.value) {
    event.preventDefault();
    void movePersonnel('top');
    return;
  }
  if (event.ctrlKey && event.shiftKey && event.key === 'ArrowDown' && selectedPersonnel.value) {
    event.preventDefault();
    void movePersonnel('bottom');
    return;
  }
  if (event.ctrlKey && event.key === 'ArrowUp' && selectedPersonnel.value) {
    event.preventDefault();
    void movePersonnel('up');
    return;
  }
  if (event.ctrlKey && event.key === 'ArrowDown' && selectedPersonnel.value) {
    event.preventDefault();
    void movePersonnel('down');
  }
};

const loadPersonnel = async () => {
  personLoading.value = true;
  try {
    const query: PersonnelQueryDTO = { ...buildPersonnelQueryBase(), page: personPage.value, pageSize: personPageSize.value };
    const res = await window.electronAPI.personnel.getList(query);
    if (res.success && res.data) {
      personnel.value = res.data.data;
      personTotal.value = res.data.total;
      const selectedId = selectedPersonnel.value?.id;
      if (selectedId) {
        selectedPersonnel.value = personnel.value.find(item => item.id === selectedId) || null;
      }
      if (personDetailVisible.value && selectedId) {
        detailPersonnel.value = personnel.value.find(item => item.id === selectedId) || detailPersonnel.value;
      }
    }
  } finally {
    personLoading.value = false;
  }
};

const onPersonnelContextMenu = (event: any) => {
  selectedPersonnel.value = event.data;
  personContextMenu.value.show(event.originalEvent);
};

const onPersonnelCardContextMenu = (event: MouseEvent, row: Personnel) => {
  selectedPersonnel.value = row;
  personContextMenu.value.show(event);
};

const onPersonnelRowClick = (event: { data: Personnel }) => {
  selectPersonnel(event.data);
};

const onPersonnelRowDblClick = (event: { data: Personnel }) => {
  void openPersonnelFiles(event.data);
};

const normalizePath = (value: string) => String(value || '').replace(/\\/g, '/').trim();
const sanitizePersonnelFolderName = (value: unknown) => {
  const text = String(value || '').trim() || '未命名员工';
  return text.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').trim() || '未命名员工';
};

const resolvePersonnelRootDir = (row: Personnel) => {
  const libraryPath = String(localStorage.getItem('currentLibraryPath') || '').trim();
  if (!libraryPath) return '';
  const libraryRoot = normalizePath(libraryPath);
  const personnelBaseDir = `${libraryRoot}/department-personnel`;
  const resumeFilePath = normalizePath(String(row.resume_file_path || '').trim());
  if (resumeFilePath && (resumeFilePath === personnelBaseDir || resumeFilePath.startsWith(`${personnelBaseDir}/`))) {
    const relative = resumeFilePath.slice(personnelBaseDir.length).replace(/^\/+/, '');
    const firstSegment = relative.split('/').filter(Boolean)[0] || '';
    if (firstSegment) {
      return `${personnelBaseDir}/${firstSegment}`;
    }
  }
  return `${personnelBaseDir}/${sanitizePersonnelFolderName(row.name)}`;
};

const openPersonnelFiles = async (row: Personnel) => {
  const rootDir = resolvePersonnelRootDir(row);
  if (!rootDir) {
    toast.add({ severity: 'warn', summary: '打开失败', detail: '当前资源库路径不可用，无法打开员工文件。', life: 3000 });
    return;
  }
  await router.push({
    name: 'OtherFiles',
    query: {
      rootDir,
      currentDir: rootDir,
      title: `${row.name || '员工'}文件`,
      subtitle: `员工资料 / ${row.name || '-'}`,
    },
  });
};

const selectPersonnel = (row: Personnel) => {
  selectedPersonnel.value = row;
};

const onPersonPageChange = (event: { page: number; rows: number }) => {
  personPage.value = event.page + 1;
  personPageSize.value = event.rows;
  void loadPersonnel();
};

const openPersonnelAdd = () => {
  personIsEdit.value = false;
  personEditingRow.value = null;
  personCreationDraft.value = null;
  personManualImportSourceFilePath.value = '';
  personDialogVisible.value = true;
};

const openPersonnelImport = async () => {
  personIsEdit.value = false;
  personEditingRow.value = null;
  personCreationDraft.value = null;
  personManualImportSourceFilePath.value = '';
  personDialogVisible.value = true;
  await nextTick();
  await personDialogRef.value?.openResumeImport?.();
};

const openPersonnelBatchImport = () => {
  personBatchImportVisible.value = true;
};

const selectPersonnelBatchFolder = async () => {
  try {
    const selected = await window.electronAPI.fs.selectFile({ properties: ['openDirectory'] });
    if (!selected.success || !selected.data) {
      throw new Error(selected.error || '选择文件夹失败');
    }
    if ((selected.data as any).canceled) return;
    const folderPath = String((selected.data as any).filePaths?.[0] || '').trim();
    if (!folderPath) return;
    await personnelBatchImportStore.scanFolder(folderPath);
    if (personnelBatchImportStore.session.total <= 0) {
      toast.add({ severity: 'warn', summary: '未发现简历', detail: '所选文件夹中没有受支持的简历文件。', life: 3000 });
      return;
    }
    toast.add({ severity: 'success', summary: '扫描完成', detail: `共发现 ${personnelBatchImportStore.session.total} 份简历。`, life: 2500 });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: '扫描失败', detail: String(error?.message || '').trim() || '无法扫描文件夹', life: 3500 });
  }
};

const openPersonnelById = async (personnelId: string) => {
  const matched = personnel.value.find(item => item.id === personnelId);
  if (matched) {
    openPersonnelDetail(matched);
    return;
  }
  const res = await window.electronAPI.personnel.get(personnelId);
  if (!res.success || !res.data) {
    toast.add({ severity: 'warn', summary: '打开失败', detail: res.error || '未找到员工详情', life: 3000 });
    return;
  }
  openPersonnelDetail(res.data);
};

const startPersonnelBatchImport = async () => {
  try {
    await personnelBatchImportStore.runImport(undefined, {
      onSaved: async () => {
        await loadPersonnel();
      },
    });
    await loadPersonnel();
    toast.add({
      severity: personnelBatchImportStore.session.failedCount > 0 ? 'warn' : 'success',
      summary: '批量导入完成',
      detail: `成功 ${personnelBatchImportStore.session.successCount} 条，失败 ${personnelBatchImportStore.session.failedCount} 条`,
      life: 3500,
    });
  } catch (error: any) {
    toast.add({ severity: 'error', summary: '批量导入失败', detail: String(error?.message || '').trim() || '请稍后重试', life: 3500 });
  }
};

const retryPersonnelBatchItem = async (filePath: string) => {
  try {
    await personnelBatchImportStore.retryItem(filePath, {
      onSaved: async () => {
        await loadPersonnel();
      },
    });
    await loadPersonnel();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: '重试失败', detail: String(error?.message || '').trim() || '请稍后重试', life: 3500 });
  }
};

const openPersonnelManualFix = (filePath: string) => {
  const draft = personnelBatchImportStore.buildManualDraft(filePath);
  if (!draft) {
    toast.add({ severity: 'warn', summary: '无法补录', detail: '当前失败项没有可用的识别草稿。', life: 3000 });
    return;
  }
  personIsEdit.value = false;
  personEditingRow.value = null;
  personCreationDraft.value = draft;
  personManualImportSourceFilePath.value = filePath;
  personDialogVisible.value = true;
};

const editPersonnel = (row: Personnel) => {
  personIsEdit.value = true;
  personEditingRow.value = row;
  personCreationDraft.value = null;
  personManualImportSourceFilePath.value = '';
  personDialogVisible.value = true;
};

const openPersonnelDetail = (row: Personnel) => {
  selectedPersonnel.value = row;
  detailPersonnel.value = row;
  personDetailVisible.value = true;
};

const focusPersonnelDetailByIndex = (index: number) => {
  const target = personnel.value[index];
  if (!target) return;
  selectedPersonnel.value = target;
  detailPersonnel.value = target;
  personDetailVisible.value = true;
};

const navigatePersonnelDetail = (direction: 'previous' | 'next') => {
  if (!personDetailVisible.value) return;
  const currentIndex = detailPersonnelIndexInPage.value;
  if (currentIndex < 0) return;
  const nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
  focusPersonnelDetailByIndex(nextIndex);
};

const deletePersonnel = (row: Personnel) => {
  confirm.require({
    header: '删除确认',
    message: `确定删除员工“${row.name}”吗？`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: '删除',
    rejectLabel: '取消',
    accept: async () => {
      const res = await window.electronAPI.personnel.delete(row.id);
      if (!res.success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '未知错误', life: 3500 });
        return;
      }
      toast.add({ severity: 'success', summary: '删除成功', detail: row.name, life: 2500 });
      if (selectedPersonnel.value?.id === row.id) selectedPersonnel.value = null;
      if (detailPersonnel.value?.id === row.id) {
        detailPersonnel.value = null;
        personDetailVisible.value = false;
      }
      await loadPersonnel();
    },
  });
};

const onPersonnelSaved = async (savedPersonnel?: Personnel) => {
  await loadPersonnel();
  if (personManualImportSourceFilePath.value) {
    personnelBatchImportStore.markItemSavedFromManual(personManualImportSourceFilePath.value, savedPersonnel || null);
    personManualImportSourceFilePath.value = '';
    personCreationDraft.value = null;
  }
  if (personEditingRow.value?.id) {
    const matched = personnel.value.find(item => item.id === personEditingRow.value?.id) || null;
    if (matched) {
      selectedPersonnel.value = matched;
      detailPersonnel.value = matched;
    }
  }
};

const onPersonnelDetailUpdated = async (updatedPersonnel: Personnel) => {
  const targetId = String(updatedPersonnel?.id || '').trim();
  if (!targetId) return;
  await loadPersonnel();
  const matched = personnel.value.find(item => item.id === targetId) || updatedPersonnel;
  selectedPersonnel.value = matched;
  detailPersonnel.value = matched;
};

const copyPersonnelBrief = async (row: Personnel) => {
  const name = String(row.name || '').trim();
  const phone = String(row.phone || '').trim();
  const text = [`姓名：${name || '-'}`, `手机号：${phone || '-'}`].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ severity: 'success', summary: '复制成功', detail: '姓名和手机号已复制到剪贴板', life: 2000 });
  } catch {
    toast.add({ severity: 'error', summary: '复制失败', detail: '请检查剪贴板权限后重试', life: 3000 });
  }
};

// --- 搜索防抖 ---
let deptDebounce: number | undefined;
watch(deptSearchQuery, () => {
  if (deptDebounce) clearTimeout(deptDebounce);
  deptDebounce = window.setTimeout(() => {
    void loadDepartments();
  }, 300);
});

let personDebounce: number | undefined;
watch(personSearchQuery, () => {
  if (personDebounce) clearTimeout(personDebounce);
  personDebounce = window.setTimeout(() => {
    personPage.value = 1;
    void loadPersonnel();
  }, 300);
});

// --- 窗口控制 ---
const minimizeWindow = () => window.electronAPI.window.minimize();
const toggleMaximize = () => window.electronAPI.window.toggleMaximize();
const closeWindow = () => window.electronAPI.window.close();

onMounted(async () => {
  const savedViewMode = localStorage.getItem('department-personnel:view-mode');
  if (savedViewMode === 'list' || savedViewMode === 'card') {
    personViewMode.value = savedViewMode;
  }
  void loadDepartments();
  void loadPersonnel();
  window.addEventListener('keydown', onGlobalKeydown);

  // 监听窗口状态
  unlistenMaximize = window.electronAPI.window.onMaximizeChanged((status) => {
    isMaximized.value = status;
    windowStateStore.setMaximized(status);
  });

  const maxRes = await window.electronAPI.window.isMaximized();
  if (maxRes.success) isMaximized.value = maxRes.data;
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  unlistenMaximize?.();
  stopTreePanelResize();
});
</script>

<style scoped>
.custom-tree {
  border: none;
  background: transparent;
  padding: 0;
}
:deep(.p-tree-container) {
  padding: 0.25rem;
}
:deep(.p-tree-node-content) {
  padding: 0.25rem 0.5rem !important;
  border-radius: 4px;
  transition: background 0.2s;
}
:deep(.p-tree-node-content:hover) {
  background: var(--sidebar-hover-bg) !important;
}
:deep(.p-tree-node-content.p-highlight) {
  background: var(--sidebar-active-bg) !important;
  color: var(--btn-primary-bg) !important;
}

:deep(.p-datatable-sm .p-datatable-thead > tr > th) {
  padding: 0.5rem 0.75rem;
}
:deep(.p-datatable-sm .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.75rem;
}

.department-tree-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  -webkit-app-region: no-drag;
}

.department-tree-resizer:hover,
.department-tree-resizer.is-resizing {
  background: color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}
</style>
