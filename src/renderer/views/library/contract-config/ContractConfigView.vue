<template>
  <main class="flex h-full flex-col overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--content-border)] px-6" style="-webkit-app-region: drag;">
      <div class="flex min-w-0 items-center gap-4">
        <div class="flex items-center gap-2 pr-4 border-r border-[var(--content-border)]" style="-webkit-app-region: no-drag;">
          <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.back()" />
        </div>
        <div>
          <h2 class="text-lg font-bold tracking-tight">合同配置</h2>
        </div>
      </div>
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <div class="w-60">
            <IconField iconPosition="left">
              <InputIcon class="pi pi-search text-xs text-[var(--content-text-secondary)]" />
              <InputText
                v-model="fieldLabelSearchQuery"
                class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                placeholder="搜索字段标签..."
              />
            </IconField>
          </div>
          <Button
            type="button"
            icon="pi pi-filter"
            text
            rounded
            severity="secondary"
            class="mr-2 transition-colors"
            :class="{ '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]': filterBarVisible }"
            v-tooltip.bottom="'合同类型筛选'"
            @click="filterBarVisible = !filterBarVisible"
          />

          <Button
            icon="pi pi-plus"
            text
            rounded
            severity="secondary"
            class="mr-2 transition-colors"
            :class="{ '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]': customFieldDialogVisible }"
            v-tooltip.bottom="'新增自定义字段'"
            @click="openCreateCustomField"
          />

          <Button
            icon="pi pi-download"
            text
            rounded
            severity="secondary"
            class="mr-2 transition-colors"
            v-tooltip.bottom="'导出配置'"
            :loading="schemaFileProcessing"
            @click="exportSchema"
          />

          <Button
            icon="pi pi-upload"
            text
            rounded
            severity="secondary"
            class="mr-2 transition-colors"
            v-tooltip.bottom="'导入配置'"
            :loading="schemaFileProcessing"
            @click="confirmImportSchema"
          />

          <Button
            icon="pi pi-replay"
            text
            rounded
            severity="secondary"
            class="mr-2 transition-colors"
            v-tooltip.bottom="'重置全部配置'"
            @click="confirmResetAllSchemas"
          />
         
          <Button
            icon="pi pi-eye"
            text
            rounded
            severity="secondary"
            class="transition-colors"
            :class="{ '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]': previewDialogVisible }"
            v-tooltip.bottom="'表单预览'"
            @click="previewDialogVisible = true"
          />
          <Button icon="pi pi-refresh" text rounded severity="secondary" v-tooltip.bottom="'刷新'" @click="initializeView" />
          <WindowControls class="ml-1" />
        </div>
    </header>

    <div class="flex min-h-0 flex-1 p-6">
      <section class="flex min-h-0 flex-1 flex-col bg-[var(--content-bg)]">
        <div v-if="filterBarVisible" class="mb-3 flex items-center gap-1.5 flex-wrap px-1">
          <button
            type="button"
            class="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] bg-[var(--content-card-bg)] border border-[var(--content-border)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            @click.stop="toggleContractTypePopover"
          >
            <i class="pi pi-tags"></i>
            <span class="flex items-center gap-1.5 min-w-0">
              <span>合同类型</span>
              <span v-if="selectedContractTypeLabel" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
                {{ selectedContractTypeLabel }}
              </span>
            </span>
            <span
              v-if="selectedContractTypeKey !== DEFAULT_CONTRACT_TYPE_SCHEMA_KEY"
              class="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors shadow-sm z-10"
              @click.stop="clearContractTypeSelection"
            >
              <i class="pi pi-times" style="font-size: 8px;"></i>
            </span>
          </button>

          <Popover ref="contractTypePopover" style="background: transparent; border: none; box-shadow: none;">
            <div class="w-64 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
              <div class="p-1">
                <div class="mb-2">
                  <InputText
                    v-model="contractTypeSearchQuery"
                    class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                    placeholder="搜索..."
                  />
                </div>
                <div class="max-h-64 overflow-auto">
                  <button
                    v-for="opt in filteredContractTypeOptions"
                    :key="opt.value"
                    type="button"
                    class="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                    @click="selectContractType(opt.value)"
                  >
                    <span class="flex items-center gap-2 min-w-0 flex-1">
                      <Checkbox
                        :modelValue="selectedContractTypeKey === opt.value"
                        binary
                        @click.stop
                        @update:modelValue="selectContractType(opt.value)"
                      />
                      <span class="truncate">{{ opt.label }}</span>
                    </span>
                  </button>
                  <div v-if="filteredContractTypeOptions.length === 0" class="px-3 py-2 text-[var(--content-text-secondary)]">
                    无匹配类型
                  </div>
                </div>
              </div>
            </div>
          </Popover>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] flex flex-col">
          <Tabs :value="String(activeTab)" @update:value="activeTab = String($event)" class="flex-1 flex flex-col min-h-0">
            <TabList>
              <Tab value="default">默认字段</Tab>
              <Tab value="extended">拓展字段</Tab>
            </TabList>
            <TabPanels class="flex-1 p-0 overflow-hidden">
              <TabPanel value="default" class="h-full">
                <DataTable
                  v-model:editingRows="editingRows"
                  :value="filteredBuiltinFields"
                  dataKey="key"
                  editMode="row"
                  @row-edit-save="onRowEditSave"
                  @row-dblclick="onRowDblClick"
                  class="h-full contract-config-table p-datatable-sm contract-config-table-hover"
                  scrollable
                  scrollHeight="flex"
                  stripedRows
                  :reorderableColumns="false"
                  @row-reorder="handleRowReorder"
                >
                  <Column :rowReorder="!hasFieldLabelSearch" headerStyle="width: 3rem" :reorderableColumn="false" />
                  <Column header="字段标签" style="min-width: 160px">
                    <template #editor="{ data, field }">
                      <InputText v-model="data.label" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <div class="flex items-center gap-2">
                        <span>{{ data.label }}</span>
                        <Tag v-if="data.builtin" value="内置" severity="info" />
                      </div>
                    </template>
                  </Column>
                  <Column header="字段 Key" style="min-width: 140px">
                    <template #editor="{ data }">
                      <InputText v-model="data.key" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <span class="text-[var(--content-text-secondary)]">{{ data.key }}</span>
                    </template>
                  </Column>
                  <Column header="字段类型" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select
                        v-model="data.type"
                        :options="fieldTypeOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                      />
                    </template>
                    <template #body="{ data }">
                      <Tag :value="typeLabelMap[data.type]" severity="secondary" />
                    </template>
                  </Column>
                  <Column header="关联数据" style="min-width: 220px">
                    <template #editor="{ data }">
                      <div v-if="supportsOptionSource(data.type)" class="flex flex-col gap-2">
                        <Select
                          :modelValue="getFieldOptionSourceType(data)"
                          :options="getAvailableOptionSourceTypeOptions(data.type)"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                          @update:modelValue="updateFieldOptionSourceType(data, $event)"
                        />
                        <Select
                          v-if="requiresOptionSourceGroupSelection(getFieldOptionSourceType(data))"
                          :modelValue="getFieldOptionSourceGroupName(data)"
                          :options="getFieldOptionSourceGroupOptions(data)"
                          option-label="label"
                          option-value="value"
                          filter
                          class="w-full"
                          placeholder="请选择分组"
                          @update:modelValue="updateFieldOptionSourceGroupName(data, $event)"
                        />
                      </div>
                      <span v-else class="text-[var(--content-text-secondary)]">不适用</span>
                    </template>
                    <template #body="{ data }">
                      <span class="text-[var(--content-text-secondary)]">{{ getFieldOptionSourceSummary(data) }}</span>
                    </template>
                  </Column>
                  <Column header="所在分区" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select v-model="data.section" :options="sectionOptions" option-label="label" option-value="value" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <Tag :value="sectionLabelMap[data.section]" severity="secondary" />
                    </template>
                  </Column>
                  <Column header="AI提示词" style="min-width: 240px">
                    <template #editor="{ data }">
                      <Textarea v-model="data.aiPrompt" rows="2" autoResize class="w-full" placeholder="可选：针对该字段的提取提示" />
                    </template>
                    <template #body="{ data }">
                      <span
                        v-if="data.aiPrompt"
                        class="block max-w-64 truncate text-[var(--content-text-secondary)]"
                        v-tooltip.top="data.aiPrompt"
                      >
                        {{ data.aiPrompt }}
                      </span>
                      <span v-else class="text-[var(--content-text-secondary)]">-</span>
                    </template>
                  </Column>
                  <Column header="布局宽度" style="min-width: 120px">
                    <template #editor="{ data }">
                      <Select v-model="data.span" :options="spanOptions" option-label="label" option-value="value" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <span>{{ data.span === 2 ? '整行' : '半宽' }}</span>
                    </template>
                  </Column>
                  <Column header="是否必填" style="min-width: 110px">
                    <template #body="{ data }">
                      <Tag
                        :value="getFieldRequiredTagLabel(data)"
                        :severity="getFieldRequiredTagSeverity(data)"
                      />
                    </template>
                  </Column>
                  <Column header="属性" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select
                        :modelValue="data.visible ? (data.required ? 'required' : 'optional') : 'hidden'"
                        :options="[{ label: '必填（显示）', value: 'required' }, { label: '选填（显示）', value: 'optional' }, { label: '隐藏', value: 'hidden' }]"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :disabled="!!data.lockedVisible || !!data.lockedRequired"
                        @update:modelValue="(val) => {
                          if (val === 'required') { data.visible = true; data.required = true; }
                          else if (val === 'optional') { data.visible = true; data.required = false; }
                          else if (val === 'hidden') { data.visible = false; data.required = false; }
                        }"
                      />
                    </template>
                    <template #body="{ data }">
                      <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2" @click.stop>
                          <Checkbox
                            :modelValue="!!data.visible"
                            binary
                            :disabled="!!data.lockedVisible"
                            @click.stop
                            @update:modelValue="(val) => updateFieldVisible(data, !!val)"
                          />
                          <span class="text-sm">显示</span>
                        </label>
                        <label class="flex items-center gap-2" @click.stop>
                          <Checkbox
                            :modelValue="!!data.required"
                            binary
                            :disabled="!!data.lockedRequired"
                            @click.stop
                            @update:modelValue="(val) => updateFieldRequired(data, !!val)"
                          />
                          <span class="text-sm">必填</span>
                        </label>
                      </div>
                    </template>
                  </Column>
                  <Column
                    :rowEditor="true"
                    headerClass="contract-config-actions"
                    bodyClass="contract-config-actions"
                    style="width: 5.5rem; min-width: 5.5rem"
                    bodyStyle="text-align:center"
                  />
                  <Column
                    header="操作"
                    alignFrozen="right"
                    frozen
                    headerClass="contract-config-actions"
                    bodyClass="contract-config-actions"
                    style="width: 6rem; min-width: 6rem"
                  >
                    <template #body="{ data }">
                      <div class="flex items-center justify-center gap-1">
                        <Button
                          icon="pi pi-pencil"
                          text
                          rounded
                          size="small"
                          severity="secondary"
                          class="!h-8 !w-8"
                          @click="openEditFieldDialogByKey(data.key)"
                        />
                        <Button
                          icon="pi pi-trash"
                          text
                          rounded
                          size="small"
                          severity="danger"
                          class="!h-8 !w-8"
                          :disabled="!!data.lockedVisible"
                          v-tooltip.top="data.lockedVisible ? '核心字段，无法删除' : '隐藏字段'"
                          @click="confirmDeleteField(data)"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </TabPanel>

              <TabPanel value="extended" class="h-full">
                <DataTable
                  v-model:editingRows="editingRows"
                  :value="filteredExtendedFields"
                  dataKey="key"
                  editMode="row"
                  @row-edit-save="onRowEditSave"
                  @row-dblclick="onRowDblClick"
                  class="h-full contract-config-table p-datatable-sm contract-config-table-hover"
                  scrollable
                  scrollHeight="flex"
                  stripedRows
                  :reorderableColumns="false"
                  @row-reorder="handleRowReorder"
                >
                  <Column :rowReorder="!hasFieldLabelSearch" headerStyle="width: 3rem" :reorderableColumn="false" />
                  <Column header="字段标签" style="min-width: 160px">
                    <template #editor="{ data, field }">
                      <InputText v-model="data.label" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <div class="flex items-center gap-2">
                        <span>{{ data.label }}</span>
                      </div>
                    </template>
                  </Column>
                  <Column header="字段 Key" style="min-width: 140px">
                    <template #editor="{ data }">
                      <InputText v-model="data.key" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <span class="text-[var(--content-text-secondary)]">{{ data.key }}</span>
                    </template>
                  </Column>
                  <Column header="字段类型" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select
                        v-model="data.type"
                        :options="fieldTypeOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                      />
                    </template>
                    <template #body="{ data }">
                      <Tag :value="typeLabelMap[data.type]" severity="secondary" />
                    </template>
                  </Column>
                  <Column header="关联数据" style="min-width: 220px">
                    <template #editor="{ data }">
                      <div v-if="supportsOptionSource(data.type)" class="flex flex-col gap-2">
                        <Select
                          :modelValue="getFieldOptionSourceType(data)"
                          :options="getAvailableOptionSourceTypeOptions(data.type)"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                          @update:modelValue="updateFieldOptionSourceType(data, $event)"
                        />
                        <Select
                          v-if="requiresOptionSourceGroupSelection(getFieldOptionSourceType(data))"
                          :modelValue="getFieldOptionSourceGroupName(data)"
                          :options="getFieldOptionSourceGroupOptions(data)"
                          option-label="label"
                          option-value="value"
                          filter
                          class="w-full"
                          placeholder="请选择分组"
                          @update:modelValue="updateFieldOptionSourceGroupName(data, $event)"
                        />
                      </div>
                      <span v-else class="text-[var(--content-text-secondary)]">不适用</span>
                    </template>
                    <template #body="{ data }">
                      <span class="text-[var(--content-text-secondary)]">{{ getFieldOptionSourceSummary(data) }}</span>
                    </template>
                  </Column>
                  <Column header="所在分区" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select v-model="data.section" :options="sectionOptions" option-label="label" option-value="value" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <Tag :value="sectionLabelMap[data.section]" severity="secondary" />
                    </template>
                  </Column>
                  <Column header="AI提示词" style="min-width: 240px">
                    <template #editor="{ data }">
                      <Textarea v-model="data.aiPrompt" rows="2" autoResize class="w-full" placeholder="可选：针对该字段的提取提示" />
                    </template>
                    <template #body="{ data }">
                      <span
                        v-if="data.aiPrompt"
                        class="block max-w-64 truncate text-[var(--content-text-secondary)]"
                        v-tooltip.top="data.aiPrompt"
                      >
                        {{ data.aiPrompt }}
                      </span>
                      <span v-else class="text-[var(--content-text-secondary)]">-</span>
                    </template>
                  </Column>
                  <Column header="布局宽度" style="min-width: 120px">
                    <template #editor="{ data }">
                      <Select v-model="data.span" :options="spanOptions" option-label="label" option-value="value" class="w-full" />
                    </template>
                    <template #body="{ data }">
                      <span>{{ data.span === 2 ? '整行' : '半宽' }}</span>
                    </template>
                  </Column>
                  <Column header="是否必填" style="min-width: 110px">
                    <template #body="{ data }">
                      <Tag
                        :value="getFieldRequiredTagLabel(data)"
                        :severity="getFieldRequiredTagSeverity(data)"
                      />
                    </template>
                  </Column>
                  <Column header="属性" style="min-width: 140px">
                    <template #editor="{ data }">
                      <Select
                        :modelValue="data.visible ? (data.required ? 'required' : 'optional') : 'hidden'"
                        :options="[{ label: '必填（显示）', value: 'required' }, { label: '选填（显示）', value: 'optional' }, { label: '隐藏', value: 'hidden' }]"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :disabled="!!data.lockedVisible || !!data.lockedRequired"
                        @update:modelValue="(val) => {
                          if (val === 'required') { data.visible = true; data.required = true; }
                          else if (val === 'optional') { data.visible = true; data.required = false; }
                          else if (val === 'hidden') { data.visible = false; data.required = false; }
                        }"
                      />
                    </template>
                    <template #body="{ data }">
                      <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2" @click.stop>
                          <Checkbox
                            :modelValue="!!data.visible"
                            binary
                            :disabled="!!data.lockedVisible"
                            @click.stop
                            @update:modelValue="(val) => updateFieldVisible(data, !!val)"
                          />
                          <span class="text-sm">显示</span>
                        </label>
                        <label class="flex items-center gap-2" @click.stop>
                          <Checkbox
                            :modelValue="!!data.required"
                            binary
                            :disabled="!!data.lockedRequired"
                            @click.stop
                            @update:modelValue="(val) => updateFieldRequired(data, !!val)"
                          />
                          <span class="text-sm">必填</span>
                        </label>
                      </div>
                    </template>
                  </Column>
                  <Column
                    :rowEditor="true"
                    headerClass="contract-config-actions"
                    bodyClass="contract-config-actions"
                    style="width: 5.5rem; min-width: 5.5rem"
                    bodyStyle="text-align:center"
                  />
                  <Column
                    header="操作"
                    alignFrozen="right"
                    frozen
                    headerClass="contract-config-actions"
                    bodyClass="contract-config-actions"
                    style="width: 6rem; min-width: 6rem"
                  >
                    <template #body="{ data }">
                      <div class="flex items-center justify-center gap-1">
                        <Button
                          icon="pi pi-pencil"
                          text
                          rounded
                          size="small"
                          severity="secondary"
                          class="!h-8 !w-8"
                          @click="openEditFieldDialogByKey(data.key)"
                        />
                        <Button
                          icon="pi pi-trash"
                          text
                          rounded
                          size="small"
                          severity="danger"
                          class="!h-8 !w-8"
                          v-tooltip.top="'删除字段'"
                          @click="confirmDeleteField(data)"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </section>
    </div>

    <Dialog v-model:visible="customFieldDialogVisible" modal :header="isEditMode ? '编辑字段' : '新增自定义字段'" :style="{ width: '640px' }">
      <div class="grid grid-cols-2 gap-4 py-2">
        <div class="col-span-2 flex flex-col gap-1">
          <label class="flex items-center gap-2">
            <span>字段标签</span>
            <i
              v-if="shouldShowCustomFieldLabelAiIcon"
              class="pi pi-sparkles text-[var(--btn-primary-bg)] transition-transform duration-300"
              :class="{ 'pi-spin': customFieldLabelAiGenerating }"
              v-tooltip.top="customFieldLabelAiGenerating ? 'AI 正在生成字段 Key' : 'AI 可辅助生成字段 Key'"
            />
          </label>
          <InputText v-model="customFieldDraft.label" class="w-full" @blur="handleCustomFieldLabelBlur" />
        </div>
        <div class="flex flex-col gap-1">
          <label>字段 Key</label>
          <InputText v-model="customFieldDraft.key" class="w-full" placeholder="例如 invoice_no" />
        </div>
        <div class="flex flex-col gap-1">
          <label>字段类型</label>
          <Select v-model="customFieldDraft.type" :options="fieldTypeOptions" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label>所在分区</label>
          <Select v-model="customFieldDraft.section" :options="sectionOptions" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label>布局宽度</label>
          <Select v-model="customFieldDraft.span" :options="spanOptions" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="col-span-2 flex flex-col gap-1">
          <label>占位提示</label>
          <InputText v-model="customFieldDraft.placeholder" class="w-full" />
        </div>
        <div class="col-span-2 flex flex-col gap-1">
          <label>AI提示词</label>
          <Textarea
            v-model="customFieldDraft.aiPrompt"
            rows="3"
            autoResize
            class="w-full"
            placeholder="可选：该字段在合同提取时的补充提示，例如“优先从附件报价表/结算清单提取”"
          />
        </div>
        <div v-if="supportsOptionSource(customFieldDraft.type)" class="col-span-2 grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label>选项来源</label>
            <Select
              v-model="customFieldOptionSourceType"
              :options="optionSourceTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>
          <div v-if="requiresOptionSourceGroupSelection(customFieldOptionSourceType)" class="flex flex-col gap-1">
            <label>来源字典</label>
            <Select
              v-model="customFieldOptionSourceGroupName"
              :options="getOptionSourceGroupOptionsByType(customFieldOptionSourceType)"
              option-label="label"
              option-value="value"
              filter
              class="w-full"
              placeholder="请选择字典分组"
            />
          </div>
          <div v-else-if="customFieldOptionSourceType === 'manual'" class="col-span-2 flex flex-col gap-1">
            <label>选项列表</label>
            <Textarea v-model="customFieldOptionsText" rows="4" autoResize class="w-full" placeholder="每行一个选项" />
          </div>
          <div v-if="customFieldOptionSourceType !== 'manual'" class="col-span-2 text-sm text-[var(--content-text-secondary)]">
            {{ getOptionSourcePreviewHint(customFieldOptionSourceType) }}
          </div>
        </div>
        <div class="col-span-2 flex items-center gap-4">
          <label class="flex items-center gap-2">
            <Checkbox v-model="customFieldDraft.visible" binary :disabled="isEditMode && !!customFieldDraft.lockedVisible" />
            <span>显示字段</span>
          </label>
          <label class="flex items-center gap-2">
            <Checkbox v-model="customFieldDraft.required" binary :disabled="isEditMode && !!customFieldDraft.lockedRequired" />
            <span>必填字段</span>
          </label>
        </div>
        <div v-if="customFieldError" class="col-span-2 text-red-500">{{ customFieldError }}</div>
      </div>
      <template #footer>
        <Button label="取消" severity="secondary" @click="customFieldDialogVisible = false" />
        <Button :label="isEditMode ? '保存修改' : '添加字段'" @click="confirmCreateCustomField" />
      </template>
    </Dialog>

    <ContractPreviewModal
      v-model:visible="previewDialogVisible"
      :fields="previewFields"
      :title="selectedContractTypeLabel"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import Tag from 'primevue/tag'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import WindowControls from '../../../components/WindowControls.vue'
import ContractPreviewModal from './ContractPreviewModal.vue'
import { DEFAULT_CONTRACT_TYPE_SCHEMA_KEY } from '../../../../shared/types/contractFormSchema.types'
import { useContractConfigView } from './useContractConfigView'
const router = useRouter()
const {
  activeTab,
  saving,
  schemaFileProcessing,
  previewDialogVisible,
  filterBarVisible,
  editingRows,
  currentSchema,
  selectedContractTypeKey,
  contractTypePopover,
  contractTypeSearchQuery,
  filteredContractTypeOptions,
  selectedContractTypeLabel,
  schemaModeLabel,
  builtinFields,
  extendedFields,
  previewFields,
  fieldTypeOptions,
  typeLabelMap,
  sectionOptions,
  sectionLabelMap,
  spanOptions,
  optionSourceTypeOptions,
  getOptionSourceGroupOptionsByType,
  clearContractTypeSelection,
  supportsOptionSource,
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
  toggleContractTypePopover,
  selectContractType,
  openCreateCustomField,
  openEditFieldDialog,
  openEditFieldDialogByKey,
  confirmCreateCustomField,
  exportSchema,
  confirmImportSchema,
  getOptionSourcePreviewHint,
  saveSchema,
  confirmResetDefaultSchema,
  confirmResetAllSchemas,
  updateCustomFieldOptionSourceType,
  validateCustomFieldKey,
  onCustomFieldTypeChange,
  shouldShowCustomFieldOptions,
  shouldShowCustomFieldOptionSource,
  shouldShowCustomFieldOptionSourceGroup,
  availableCustomFieldOptionSourceGroupOptions,
  customFieldOptionSourceHint,
  confirmResetSortOrder,
  handleSchemaModeChanged,
  initializeView,
} = useContractConfigView()

const fieldLabelSearchQuery = ref('')
const normalizedFieldLabelSearchQuery = computed(() => fieldLabelSearchQuery.value.trim().toLowerCase())
const hasFieldLabelSearch = computed(() => !!normalizedFieldLabelSearchQuery.value)

const filteredBuiltinFields = computed(() => {
  const query = normalizedFieldLabelSearchQuery.value
  const items = (unref(builtinFields) || []) as Array<{ label?: string }>
  if (!query) return items
  return items.filter((field) => String(field.label || '').toLowerCase().includes(query))
})

const filteredExtendedFields = computed(() => {
  const query = normalizedFieldLabelSearchQuery.value
  const items = (unref(extendedFields) || []) as Array<{ label?: string }>
  if (!query) return items
  return items.filter((field) => String(field.label || '').toLowerCase().includes(query))
})

const getFieldRequiredTagLabel = (field: { visible?: boolean; required?: boolean }) => {
  if (!field.visible) return '已隐藏'
  return field.required ? '必填' : '选填'
}

const getFieldRequiredTagSeverity = (field: { visible?: boolean; required?: boolean }) => {
  if (!field.visible) return 'secondary'
  return field.required ? 'danger' : 'success'
}

const handleRowReorder = async (event: unknown) => {
  if (hasFieldLabelSearch.value) return
  await onRowReorder(event as any)
}
</script>

<style scoped>
:deep(.contract-config-table) {
  font-size: 0.875rem;
}

:deep(.contract-config-table .p-datatable-thead > tr > th),
:deep(.contract-config-table .p-datatable-tbody > tr > td) {
  font-size: inherit;
}

:deep(.contract-config-table .p-tag) {
  font-size: inherit;
}

:deep(.contract-config-table .p-inputtext),
:deep(.contract-config-table .p-select),
:deep(.contract-config-table .p-select-label),
:deep(.contract-config-table .p-button) {
  font-size: inherit;
}

:deep(.contract-config-table .p-datatable-thead > tr > th.contract-config-actions),
:deep(.contract-config-table .p-datatable-tbody > tr > td.contract-config-actions) {
  padding-left: 0.25rem !important;
  padding-right: 0.25rem !important;
}

:deep(.contract-config-table .p-datatable-row-editor-init) {
  display: none !important;
}

:deep(.contract-config-table-hover .p-datatable-tbody > tr:not(.p-datatable-row-editing):hover) {
  background-color: var(--sidebar-hover-bg) !important;
  transition: background-color 0.2s ease;
}
</style>
