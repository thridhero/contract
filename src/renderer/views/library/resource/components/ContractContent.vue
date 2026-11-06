<template>
  <main class="resource-content-page flex flex-col h-full overflow-hidden bg-[var(--content-bg)] text-[var(--content-text)]">
    <ContractToolbar
      :title="title"
      :zoom-level="zoomLevel"
      :has-cloud-notification="hasCloudNotification"
      v-model:search-query="proxySearchQuery"
      v-model:search-fields="proxySearchFields"
      v-model:filters="proxyFilters"
      v-model:visible-columns="selectedColumns"
      :column-options="columnOptions"
      :view-mode="viewMode"
      :filter-active="hasActiveFilters"
      :batch-import-active="batchImportActive"
      :has-batch-import-result="hasBatchImportResult"
      :show-all-amounts="showAllContractAmounts"
      @update:view-mode="emit('update:viewMode', $event)"
      @create-contract="emit('createContract')"
      @batch-import-contracts="emit('batchImportContracts')"
      @export-excel="emit('exportExcel')"
      @view-batch-import-progress="emit('viewBatchImportProgress')"
      @toggle-all-amounts="toggleAllContractAmounts"
      @navigate-back="emit('navigateBack')"
      @navigate-forward="emit('navigateForward')"
      @zoom-out="emit('zoomOut')"
      @zoom-in="emit('zoomIn')"
      @cloud-sync="emit('cloudSync')"
      @quick-action="emit('quickAction')"
      @filter="filterBarVisible = !filterBarVisible"
    />

    <div class="shrink-0 px-6 pt-3 pb-1">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">合同总数</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ summaryStats.totalContracts }}</div>
        </div>
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">甲方单位数量</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ summaryStats.totalPartyAUnits }}</div>
        </div>
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">乙方单位数量</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ summaryStats.totalPartyBUnits }}</div>
        </div>
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">待收款总额</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ formatStatsMoney(summaryStats.totalPendingReceipts) }}</div>
        </div>
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">已收款总额</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ formatStatsMoney(summaryStats.totalReceivedReceipts) }}</div>
        </div>
        <div class="rounded-lg border border-[var(--content-border)] bg-[var(--content-card-bg)] px-3 py-2">
          <div class="text-[var(--content-text-secondary)]">合同完结数量</div>
          <div class="text-2xl font-bold text-[var(--content-text)] tabular-nums">{{ summaryStats.totalFinishedContracts }}</div>
        </div>
      </div>
    </div>

    <div v-if="filterBarVisible" class="shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md px-6 py-2" style="-webkit-app-region: no-drag;">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="toggleClientPopover"
        >
          <i class="pi pi-building text-sm"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>甲方</span>
            <span v-if="proxyFilters.client_name?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
              {{ proxyFilters.client_name.join(', ') }}
            </span>
            <span
              v-if="proxyFilters.client_name?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('client_name')"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
          </span>
        </button>

        <Popover ref="clientPopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-sm font-medium text-[var(--content-text)]">甲方单位</div>
                <button
                  v-if="proxyFilters.client_name?.length"
                  type="button"
                  class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('client_name')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.client_name"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索甲方..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in filteredClientOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('client_name', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('client_name', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('client_name', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="filteredClientOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                  无匹配甲方
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePartyBPopover"
        >
          <i class="pi pi-users text-sm"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>乙方</span>
            <span v-if="proxyFilters.party_b_name?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
              {{ proxyFilters.party_b_name.join(', ') }}
            </span>
            <span
              v-if="proxyFilters.party_b_name?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('party_b_name')"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
          </span>
        </button>

        <Popover ref="partyBPopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-sm font-medium text-[var(--content-text)]">乙方单位</div>
                <button
                  v-if="proxyFilters.party_b_name?.length"
                  type="button"
                  class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('party_b_name')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.party_b_name"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索乙方..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in filteredPartyBOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('party_b_name', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('party_b_name', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('party_b_name', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="filteredPartyBOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                  无匹配乙方
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="toggleTypePopover"
        >
          <i class="pi pi-file text-sm"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>合同类型</span>
            <span v-if="proxyFilters.contract_type?.length" class="text-xs text-[var(--content-text-secondary)] truncate max-w-40">
              {{ selectedContractTypeLabels }}
            </span>
            <span
              v-if="proxyFilters.contract_type?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('contract_type')"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
          </span>
        </button>

        <Popover ref="typePopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-sm font-medium text-[var(--content-text)]">合同类型</div>
                <button
                  v-if="proxyFilters.contract_type?.length"
                  type="button"
                  class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('contract_type')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.contract_type"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索合同类型..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in filteredContractTypeOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('contract_type', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('contract_type', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('contract_type', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="filteredContractTypeOptions.length === 0" class="px-3 py-2 text-sm text-[var(--content-text-secondary)]">
                  无匹配类型
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="toggleDeadlinePopover"
        >
          <i class="pi pi-calendar text-sm"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>截止日期</span>
            <span v-if="formattedEndDateRangeLabel" class="text-xs text-[var(--content-text-secondary)] truncate max-w-48">
              {{ formattedEndDateRangeLabel }}
            </span>
            <span
              v-if="formattedEndDateRangeLabel"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearDeadlineFilters"
            >
              <i class="pi pi-times text-xs"></i>
            </span>
          </span>
        </button>

        <Popover ref="deadlinePopover" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-[24rem] rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-3 shadow-xl">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium text-[var(--content-text)]">截止日期区间</div>
              <button
                v-if="formattedEndDateRangeLabel"
                type="button"
                class="text-xs text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                @click="clearDeadlineFilters"
              >
                清空
              </button>
            </div>
            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-[var(--content-text-secondary)]">开始时间</label>
                <DatePicker
                  :modelValue="getFilterDateValue('end_date_start')"
                  date-format="yy-mm-dd"
                  show-icon
                  class="w-full"
                  placeholder="选择开始时间"
                  @update:modelValue="updateFilterDate('end_date_start', $event)"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-[var(--content-text-secondary)]">结束时间</label>
                <DatePicker
                  :modelValue="getFilterDateValue('end_date_end')"
                  date-format="yy-mm-dd"
                  show-icon
                  class="w-full"
                  placeholder="选择结束时间"
                  @update:modelValue="updateFilterDate('end_date_end', $event)"
                />
              </div>
            </div>
          </div>
        </Popover>
      </div>
    </div>

    <ContextMenu ref="cm" :model="menuModel" class="contract-context-menu" @hide="contextMenuSelection = null">
      <template #item="{ item, props: itemProps }">
        <a class="flex items-center w-full gap-2 px-2 py-1 text-[13px] leading-4 rounded-md" v-bind="itemProps.action">
          <span :class="[item.icon, item.danger ? 'text-red-600' : '']" class="text-[13px] leading-none shrink-0" />
          <span :class="[item.danger ? 'text-red-600' : '']" class="truncate">{{ item.label }}</span>
          <span v-if="item.shortcut" class="ml-auto shrink-0 text-[11px] text-[var(--content-text-secondary)]">
            {{ item.shortcut }}
          </span>
        </a>
      </template>
    </ContextMenu>

    <Dialog
      v-model:visible="sourcePreviewVisible"
      modal
      maximizable
      header="合同源文件"
      :style="{ width: sourcePreviewWidth, height: sourcePreviewHeight }"
      :contentStyle="{ padding: '0' }"
      class="custom-dialog"
      @hide="resetSourcePreviewState"
      @resize="handleSourcePreviewResize"
    >
      <div class="h-full min-h-0 bg-[var(--content-bg)]">
        <div v-if="sourcePreviewLoading" class="h-full flex items-center justify-center text-[var(--content-text-secondary)]">
          <i class="pi pi-spin pi-spinner mr-2"></i>
          <span>正在加载合同源文件...</span>
        </div>
        <div v-else-if="sourcePreviewError" class="h-full flex items-center justify-center px-6">
          <div class="rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] p-6 text-center max-w-xl">
            <div class="flex items-center justify-center gap-2 text-[var(--content-text)] font-semibold">
              <i class="pi pi-exclamation-triangle text-yellow-500"></i>
              <span>无法预览合同源文件</span>
            </div>
            <div class="mt-3 text-[var(--content-text-secondary)] break-words">{{ sourcePreviewError }}</div>
          </div>
        </div>
        <ContractFilesPreviewPane
          v-else
          :filePath="sourcePreviewPath"
          :displayName="sourcePreviewName"
          class="h-full"
        />
      </div>
    </Dialog>

    <div class="flex-1 overflow-hidden p-4">
      <div class="h-full flex flex-col overflow-hidden bg-transparent">
        <div class="flex-1 min-h-0 overflow-hidden p-3" :class="{ 'drag-active-content': isDragActive }">
          <div v-if="loading" class="state-panel flex flex-col items-center justify-center h-full">
            <i class="pi pi-spin pi-spinner text-3xl mb-3" style="color: var(--btn-primary-bg)"></i>
            <p class="text-base opacity-80 transition-colors duration-200" style="color: var(--content-text)">正在加载合同信息...</p>
          </div>

          <div v-else-if="loadError" class="state-panel flex flex-col items-center justify-center h-full">
            <div class="text-6xl mb-3">⚠️</div>
            <p class="text-base opacity-80 transition-colors duration-200" style="color: var(--content-text)">合同信息加载失败</p>
            <p class=" opacity-60 mt-1 mb-3 transition-colors duration-200" style="color: var(--content-text-secondary)">
              {{ loadError }}
            </p>
            <Button label="重试" size="small" @click="retryLoad" />
          </div>

          <div v-else-if="resources.length === 0" class="state-panel flex flex-col items-center justify-center h-full">
            <div class="text-6xl mb-4">📭</div>
            <p class="text-lg opacity-60 transition-colors duration-200" style="color: var(--content-text)">暂无合同信息</p>
            <p class="opacity-40 transition-colors duration-200" style="color: var(--content-text-muted)">
              点击上方“新增合同信息”开始创建
            </p>
            <div class="mt-5 flex items-center gap-3">
              <Button
                label="新增合同信息"
                icon="pi pi-plus"
                size="small"
                @click="emit('createContract')"
              />
              <Button
                label="批量扫描合同"
                icon="pi pi-search"
                size="small"
                severity="secondary"
                @click="emit('batchImportContracts')"
              />
            </div>
          </div>

          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <Card
              v-for="resource in resources"
              :key="resource.id"
              class="resource-card cursor-pointer transition-all duration-200"
              :style="{
                backgroundColor: 'var(--content-card-bg)',
                border: selectedResourceId === resource.id ? '2px solid var(--btn-primary-bg)' : '1px solid var(--content-border)'
              }"
              @click="selectResource(resource)"
              @dblclick="openResourceWithSelection(resource)"
              @contextmenu.prevent="onCardContextMenu($event, resource)"
            >
              <template #content>
                <div class="resource-info pt-2">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-[var(--content-bg)] border border-[var(--content-border)] overflow-hidden flex items-center justify-center shrink-0">
                      <img v-if="resource.thumbnail" :src="resource.thumbnail" class="w-full h-full object-cover" :alt="resource.name" />
                      <i
                        v-else-if="resource.projectIcon"
                        :class="resource.projectIcon"
                        class="text-base"
                        :style="{ color: resource.projectColor || 'var(--btn-primary-bg)' }"
                      ></i>
                      <span v-else class="text-base">{{ getResourceIcon(resource.type) }}</span>
                    </div>
                    <button
                      type="button"
                      class="min-w-0 flex-1 text-left font-semibold truncate m-0 transition-colors duration-200 hover:underline"
                      style="color: var(--content-text)"
                      :title="resource.name"
                      @click.stop="viewDetailsWithSelection(resource)"
                    >
                      {{ resource.name }}
                    </button>
                    <div class="ml-auto flex items-center gap-1 card-actions">
                      <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click.stop="emit('editResource', resource)" />
                      <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" @click.stop="emit('deleteResource', resource)" />
                    </div>
                  </div>
                  <div class="mt-2 space-y-1 ">
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">编号</span>
                      <span class="min-w-0 truncate font-semibold text-[var(--content-text)]">{{ getContractCode(resource) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">甲方</span>
                      <span class="min-w-0 truncate font-semibold text-[var(--content-text)]">{{ getClientName(resource) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">乙方</span>
                      <span class="min-w-0 truncate font-semibold text-[var(--content-text)]">{{ getPartyBName(resource) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">合同金额</span>
                      <div class="min-w-0 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          class="min-w-0 truncate font-semibold text-[var(--content-text)] tabular-nums"
                          @click.stop="toggleContractAmount(resource)"
                        >
                          {{ isContractAmountRevealed(resource) ? formatContractAmount(resource) : '***' }}
                        </button>
                        <button
                          type="button"
                          class="shrink-0 text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors"
                          :title="isContractAmountRevealed(resource) ? '隐藏金额' : '显示金额'"
                          @click.stop="toggleContractAmount(resource)"
                        >
                          <i :class="isContractAmountRevealed(resource) ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                        </button>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">类型</span>
                      <span class="min-w-0 truncate text-[var(--content-text)]">{{ getTypeText(resource) }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">状态</span>
                      <Tag :value="getContractStatus(resource)" :severity="getContractStatusSeverity(resource)" class="!!px-2 !py-0.5 !rounded-full shrink-0" />
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="shrink-0 text-[var(--content-text-secondary)]">签约</span>
                      <span class="min-w-0 truncate text-[var(--content-text)]">{{ getDateText(resource) }}</span>
                    </div>
                    <!-- 全文本搜索结果片段 -->
                    <div v-if="resource.type === 'file'" class="mt-2 pt-2 border-t border-[var(--content-border)]">
                      <p class="text-xs text-[var(--content-text-secondary)] line-clamp-3 italic" v-html="getContractSummaryHtml(resource)"></p>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <div v-else class="list-view h-full flex flex-col min-h-0 overflow-hidden">
            <DataTable
              :value="resources"
              v-model:selection="selectedRows"
              v-model:contextMenuSelection="contextMenuSelection"
              dataKey="id"
              :loading="loading"
              class="flex-1 custom-datatable p-datatable-sm"
              stripedRows
              rowHover
              :scrollable="true"
              scrollHeight="flex"
              @row-contextmenu="onRowContextMenu"
              @row-click="(e) => selectResource(e.data)"
              @row-dblclick="(e) => openResourceWithSelection(e.data)"
            >
              <template #empty>
                <div class="flex flex-col items-center justify-center py-10 text-[var(--content-text-secondary)]">
                  <i class="pi pi-inbox text-3xl mb-3 opacity-50"></i>
                  <p>没有找到符合条件的合同</p>
                </div>
              </template>

              <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
              <Column headerStyle="width: 3.5rem" bodyStyle="width: 3.5rem">
                <template #body="{ data }">
                  <div class="flex items-center justify-center">
                    <i
                      v-if="data.projectIcon"
                      :class="data.projectIcon"
                      class="text-xl"
                      :style="{ color: data.projectColor || 'var(--btn-primary-bg)' }"
                    ></i>
                    <span v-else class="text-xl">{{ getResourceIcon(data.type) }}</span>
                  </div>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('contract_code')" field="contract_code" header="合同编号" sortable style="min-width: 10rem">
                <template #body="{ data }">
                  <span class="font-semibold text-[var(--content-text)]">{{ getContractCode(data) }}</span>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('contract_name')" field="contract_name" header="合同名称" sortable style="min-width: 14rem">
                <template #body="{ data }">
                  <div class="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      class="min-w-0 truncate font-medium text-left text-[var(--content-text)] hover:underline"
                      :title="getContractName(data)"
                      @click.stop="viewDetailsWithSelection(data)"
                    >
                      {{ getContractName(data) }}
                    </button>
                  </div>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('contract_type')" field="contract_type" header="合同类型" sortable style="min-width: 10rem">
                <template #body="{ data }">
                  <Tag :value="getTypeText(data)" severity="info" class="!!px-2.5 !py-1 !rounded-full" />
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('client_name')" field="client_name" header="甲方" sortable style="min-width: 12rem">
                <template #body="{ data }">
                  <span class="truncate text-[var(--content-text)]" :title="getClientName(data)">{{ getClientName(data) }}</span>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('party_b_name')" field="party_b_name" header="乙方" sortable style="min-width: 12rem">
                <template #body="{ data }">
                  <span class="truncate text-[var(--content-text)]" :title="getPartyBName(data)">{{ getPartyBName(data) }}</span>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('contract_amount')" field="contract_amount" header="合同总额" sortable style="min-width: 10rem">
                <template #body="{ data }">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="min-w-0 truncate font-semibold text-[var(--content-text)] tabular-nums text-right"
                      @click.stop="toggleContractAmount(data)"
                    >
                      {{ isContractAmountRevealed(data) ? formatContractAmount(data) : '***' }}
                    </button>
                    <button
                      type="button"
                      class="shrink-0 text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors"
                      :title="isContractAmountRevealed(data) ? '隐藏金额' : '显示金额'"
                      @click.stop="toggleContractAmount(data)"
                    >
                      <i :class="isContractAmountRevealed(data) ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                    </button>
                  </div>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('signing_date')" field="signing_date" header="签约日期" sortable style="min-width: 10rem">
                <template #body="{ data }">
                  <span class="text-[var(--content-text-secondary)]">{{ formatDate(getSigningDate(data)) }}</span>
                </template>
              </Column>

              <Column v-if="viewMode !== 'list' && selectedColumns.includes('folder_name')" field="folder_name" header="文件夹" sortable style="min-width: 10rem">
                <template #body="{ data }">
                  <span class="text-[var(--content-text-secondary)]">{{ data.folderName || '-' }}</span>
                </template>
              </Column>

              <Column v-if="selectedColumns.includes('updated_at')" field="updated_at" header="更新时间" sortable style="min-width: 12rem">
                <template #body="{ data }">
                  <span class="text-[var(--content-text-secondary)]">{{ formatDateTime(getUpdatedAt(data)) }}</span>
                </template>
              </Column>

              <Column
                v-if="selectedColumns.includes('contract_summary')"
                field="contract_summary"
                header="合同摘要"
                style="min-width: 20rem; width: 24rem"
                bodyStyle="max-width: 24rem"
              >
                <template #body="{ data }">
                  <span
                    v-tooltip.top="getContractSummary(data)"
                    class="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[var(--content-text-secondary)]"
                    v-html="getContractSummaryHtml(data)"
                  >
                  </span>
                </template>
              </Column>

              <Column header="操作" :exportable="false" style="min-width: 8rem">
                <template #body="{ data }">
                  <div class="flex gap-2">
                    <Button icon="pi pi-eye" class="p-button-text p-button-sm p-button-rounded" @click.stop="viewDetailsWithSelection(data)" />
                    <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-rounded" @click.stop="emit('editResource', data)" />
                    <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-rounded p-button-danger" @click.stop="emit('deleteResource', data)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>

        <div class="shrink-0 border-t border-[var(--content-border)] bg-transparent">
          <div class="flex items-center justify-between px-4 py-2">
            <span class="text-xs font-semibold text-[var(--content-text-secondary)] uppercase tracking-widest">
              显示
              {{ totalRecords ? Math.min((page - 1) * pageSize + 1, totalRecords) : 0 }}
              到
              {{ totalRecords ? Math.min(page * pageSize, totalRecords) : 0 }}
              共 {{ totalRecords }} 条
            </span>
            <Paginator
              :first="(page - 1) * pageSize"
              :rows="pageSize"
              :totalRecords="totalRecords"
              :rowsPerPageOptions="rowsPerPageOptions"
              class="bg-transparent border-none custom-paginator !p-0"
              @page="onPageChange"
            />
          </div>
        </div>
      </div>

      <div
        v-if="isUploading"
        class="upload-progress-bar fixed bottom-4 left-4 right-4 z-40 rounded-lg shadow-lg transition-colors duration-200"
        style="background-color: var(--content-card-bg); border: 1px solid var(--content-border)"
      >
        <div class="progress-header flex items-center justify-between px-4 py-2.5 border-b transition-colors duration-200" style="border-color: var(--content-border)">
          <div class="progress-info flex items-center gap-3">
            <i class="pi pi-upload" style="color: var(--btn-primary-bg)"></i>
            <span class=" font-medium transition-colors duration-200" style="color: var(--content-text)">
              正在拷贝：{{ uploadProgress.current }}/{{ uploadProgress.total }} 文件
            </span>
            <span class="text-xs opacity-60 transition-colors duration-200" style="color: var(--content-text-secondary)">
              {{ formatBytes(uploadProgress.transferred) }} / {{ formatBytes(uploadProgress.totalSize) }}
            </span>
          </div>
          <Button icon="pi pi-times" text rounded size="small" @click="cancelUpload" class="transition-colors duration-200" />
        </div>
        <div class="progress-bar-container px-4 py-2.5">
          <div class="progress-bar h-2 rounded-full overflow-hidden transition-colors duration-200" style="background-color: var(--content-bg)">
            <div
              class="progress-fill h-full transition-all duration-300"
              :style="{
                width: `${uploadProgress.percentage}%`,
                backgroundColor: 'var(--btn-primary-bg)'
              }"
            ></div>
          </div>
          <div class="progress-details flex items-center justify-between mt-1.5">
            <span class="text-xs opacity-60 transition-colors duration-200" style="color: var(--content-text-secondary)">
              {{ uploadProgress.percentage }}% - 速度：{{ uploadProgress.speed }}/s
            </span>
            <span class="text-xs opacity-60 transition-colors duration-200" style="color: var(--content-text-secondary)">
              剩余时间：{{ uploadProgress.eta }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Paginator from 'primevue/paginator'
import Tag from 'primevue/tag'
import ContextMenu from 'primevue/contextmenu'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import DatePicker from 'primevue/datepicker'
import { useToast } from 'primevue/usetoast'
import ContractToolbar from './ContractToolbar.vue'
import ContractFilesPreviewPane from '../../contract-files/components/ContractFilesPreviewPane.vue'
import type { ContractResource } from '../types/contractResource'
import type { ContractInfoQueryFilters, ContractInfoSummaryStatsResult } from '../../../../../shared/types/contractInfo.types'
import type { ContractFileRecord } from '../../../../../shared/types/contractFile.types'
import {
  formatBytes,
  formatContractAmount,
  formatDate,
  formatDateTime,
  getClientName,
  getContractCode,
  getContractName,
  getContractStatus,
  getContractStatusSeverity,
  getContractSummary,
  getContractSummaryHtml,
  getDateText,
  getPartyBName,
  getResourceIcon,
  getSigningDate,
  getTypeText,
  getUpdatedAt,
} from './contractContentUtils'

export interface UploadProgress {
  current: number
  total: number
  transferred: number
  totalSize: number
  percentage: number
  speed: string
  eta: string
}

interface Props {
  title: string
  libraryPath?: string
  zoomLevel: number
  hasCloudNotification: boolean
  searchQuery: string
  searchFields?: string[]
  filters?: ContractInfoQueryFilters
  resources: ContractResource[]
  summaryStats?: ContractInfoSummaryStatsResult
  viewMode: 'grid' | 'list'
  selectedResourceId: number | string | null
  totalRecords?: number
  page?: number
  pageSize?: number
  rowsPerPageOptions?: number[]
  loading?: boolean
  loadError?: string | null
  isDragActive?: boolean
  isUploading?: boolean
  uploadProgress?: UploadProgress
  batchImportActive?: boolean
  hasBatchImportResult?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '全部',
  libraryPath: '',
  zoomLevel: 60,
  hasCloudNotification: false,
  searchQuery: '',
  searchFields: () => ['all'],
  filters: () => ({}),
  totalRecords: 0,
  page: 1,
  pageSize: 20,
  rowsPerPageOptions: () => [20, 50, 100, 200],
  loading: false,
  loadError: null,
  isDragActive: false,
  isUploading: false,
  batchImportActive: false,
  hasBatchImportResult: false,
  uploadProgress: () => ({
    current: 0,
    total: 0,
    transferred: 0,
    totalSize: 0,
    percentage: 0,
    speed: '0 KB',
    eta: '0 秒'
  }),
  summaryStats: () => ({
    totalContracts: 0,
    totalPartyAUnits: 0,
    totalPartyBUnits: 0,
    totalPendingReceipts: 0,
    totalReceivedReceipts: 0,
    totalFinishedContracts: 0,
  }),
})

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:searchFields': [value: string[]]
  'update:filters': [value: ContractInfoQueryFilters]
  'update:viewMode': [value: 'grid' | 'list']
  pageChange: [value: { page: number; pageSize: number }]
  select: [resource: ContractResource]
  open: [resource: ContractResource]
  viewDetails: [resource: ContractResource]
  moveResource: [value: { resource: ContractResource; direction: 'top' | 'up' | 'down' | 'bottom' }]
  editResource: [resource: ContractResource]
  deleteResource: [resource: ContractResource]
  batchDelete: [resources: ContractResource[]]
  retry: []
  cancelUpload: []
  createContract: []
  batchImportContracts: []
  exportExcel: []
  viewBatchImportProgress: []
  navigateBack: []
  navigateForward: []
  zoomOut: []
  zoomIn: []
  cloudSync: []
  quickAction: []
  filter: []
}>()

const proxySearchQuery = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value),
})

const formatStatsMoney = (value: number) => {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}

const proxySearchFields = computed({
  get: () => props.searchFields,
  set: (value: string[]) => emit('update:searchFields', Array.isArray(value) ? value : ['all']),
})

const proxyFilters = computed({
  get: () => props.filters || {},
  set: (value: ContractInfoQueryFilters) => emit('update:filters', value),
})

const filterBarVisible = ref(false)
const toast = useToast()

const clientPopover = ref<InstanceType<typeof Popover> | null>(null)
const partyBPopover = ref<InstanceType<typeof Popover> | null>(null)
const typePopover = ref<InstanceType<typeof Popover> | null>(null)
const deadlinePopover = ref<InstanceType<typeof Popover> | null>(null)

const filterSearchInputs = ref({
  client_name: '',
  party_b_name: '',
  contract_type: ''
})

type FilterOption = { label: string; value: string }

const clientOptions = ref<FilterOption[]>([])
const partyBOptions = ref<FilterOption[]>([])
const contractTypeOptions = ref<FilterOption[]>([])

type MultiSelectFilterKey = 'client_name' | 'party_b_name' | 'contract_type'
type DateFilterKey = 'end_date_start' | 'end_date_end'

const parseFilterDate = (value: unknown) => {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatFilterDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getFilterDateValue = (key: DateFilterKey) => parseFilterDate(proxyFilters.value[key])

const updateFilterDate = (key: DateFilterKey, value: Date | Date[] | null | undefined) => {
  const picked = Array.isArray(value) ? value[0] : value
  const newFilters: ContractInfoQueryFilters = { ...proxyFilters.value }
  if (picked instanceof Date && !Number.isNaN(picked.getTime())) {
    newFilters[key] = formatFilterDate(picked)
  } else {
    delete newFilters[key]
  }
  proxyFilters.value = newFilters
}

const formattedEndDateRangeLabel = computed(() => {
  const start = String(proxyFilters.value.end_date_start || '').trim()
  const end = String(proxyFilters.value.end_date_end || '').trim()
  if (start && end) return `${start} ~ ${end}`
  return start || end || ''
})

const hasActiveFilters = computed(() => {
  const filters = proxyFilters.value
  return Boolean(
    filters.client_name?.length
    || filters.party_b_name?.length
    || filters.contract_type?.length
    || String(filters.end_date_start || '').trim()
    || String(filters.end_date_end || '').trim()
  )
})

const selectedContractTypeLabels = computed(() => {
  const selected = Array.isArray(proxyFilters.value.contract_type) ? proxyFilters.value.contract_type : []
  if (!selected.length) return ''
  const optionMap = new Map(contractTypeOptions.value.map((item) => [item.value, item.label]))
  return selected.map((value) => optionMap.get(value) || value).join(', ')
})

const normalizeFilterOption = (item: any): FilterOption | null => {
  const rawValue = String(item?.value || item?.code || item?.name || item?.label || '').trim()
  const label = String(item?.name || item?.label || rawValue).trim()
  if (!rawValue || !label) return null
  return { label, value: rawValue }
}

const dedupeFilterOptions = (items: FilterOption[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = String(item.value || '').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const loadFilterOptions = async () => {
  try {
    const [clientRes, supplierRes, dictRes] = await Promise.all([
      window.electronAPI.customer.getList({ page: 1, pageSize: 1000 }),
      window.electronAPI.supplier.getList({ page: 1, pageSize: 1000 }),
      window.electronAPI.dictionary.getList({ group_name: '合同类型', page: 1, pageSize: 1000 })
    ])
    
    if (clientRes.success && clientRes.data) {
      clientOptions.value = (clientRes.data.data || clientRes.data.items || []).map((item: any) => ({ label: item.name || item.client_name || '未知', value: item.name || item.client_name || '' })).filter((item: any) => item.value)
    }
    if (supplierRes.success && supplierRes.data) {
      partyBOptions.value = (supplierRes.data.data || supplierRes.data.items || []).map((item: any) => ({ label: item.name || '未知', value: item.name || '' })).filter((item: any) => item.value)
    }
    if (dictRes.success && dictRes.data) {
      contractTypeOptions.value = dedupeFilterOptions(
        (dictRes.data.data || dictRes.data.items || [])
          .map((item: any) => normalizeFilterOption(item))
          .filter(Boolean) as FilterOption[]
      )
    }
  } catch (error) {
    console.error('Failed to load filter options:', error)
  }
}

onMounted(() => {
  loadFilterOptions()
})

const filteredClientOptions = computed(() => {
  const query = filterSearchInputs.value.client_name.toLowerCase()
  return clientOptions.value.filter(opt => opt.label.toLowerCase().includes(query))
})

const filteredPartyBOptions = computed(() => {
  const query = filterSearchInputs.value.party_b_name.toLowerCase()
  return partyBOptions.value.filter(opt => opt.label.toLowerCase().includes(query))
})

const filteredContractTypeOptions = computed(() => {
  const query = filterSearchInputs.value.contract_type.toLowerCase()
  return contractTypeOptions.value.filter((opt) => {
    const label = String(opt.label || '').toLowerCase()
    const value = String(opt.value || '').toLowerCase()
    return label.includes(query) || value.includes(query)
  })
})

const isFilterOptionSelected = (key: MultiSelectFilterKey, value: string) => {
  const current = proxyFilters.value[key] || []
  return current.includes(value)
}

const toggleFilterOption = (key: MultiSelectFilterKey, value: string) => {
  const newFilters: ContractInfoQueryFilters = { ...proxyFilters.value }
  const current = newFilters[key] || []
  
  if (current.includes(value)) {
    newFilters[key] = current.filter((v: string) => v !== value)
  } else {
    newFilters[key] = [...current, value]
  }
  
  if (newFilters[key].length === 0) {
    delete newFilters[key]
  }
  
  proxyFilters.value = newFilters
}

const toggleClientPopover = (event: Event) => clientPopover.value?.toggle(event)
const togglePartyBPopover = (event: Event) => partyBPopover.value?.toggle(event)
const toggleTypePopover = (event: Event) => typePopover.value?.toggle(event)
const toggleDeadlinePopover = (event: Event) => deadlinePopover.value?.toggle(event)

const clearFilter = (key: MultiSelectFilterKey) => {
  const newFilters: ContractInfoQueryFilters = { ...proxyFilters.value }
  delete newFilters[key]
  proxyFilters.value = newFilters
}

const clearDeadlineFilters = () => {
  const newFilters: ContractInfoQueryFilters = { ...proxyFilters.value }
  delete newFilters.end_date_start
  delete newFilters.end_date_end
  proxyFilters.value = newFilters
}

const CONTRACT_COLUMNS_SETTING_KEY = 'contract_table_columns'
let contractColumnsSettingExists = false
let contractColumnsHydrating = true

const availableColumns = [
  { field: 'contract_code', header: '合同编号' },
  { field: 'contract_name', header: '合同名称' },
  { field: 'contract_type', header: '合同类型' },
  { field: 'client_name', header: '甲方' },
  { field: 'party_b_name', header: '乙方' },
  { field: 'contract_amount', header: '合同总额' },
  { field: 'signing_date', header: '签约日期' },
  { field: 'folder_name', header: '文件夹' },
  { field: 'updated_at', header: '更新时间' },
  { field: 'contract_summary', header: '合同摘要' }
]

const columnOptions = computed(() => {
  if (props.viewMode === 'list') {
    return availableColumns.filter((c) => c.field !== 'folder_name')
  }
  return availableColumns
})

const defaultColumns = availableColumns.map((col) => col.field)
const selectedColumns = ref<string[]>([...defaultColumns])

const loadContractTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) {
    contractColumnsHydrating = false
    return
  }
  try {
    const result = await db.getSetting(CONTRACT_COLUMNS_SETTING_KEY)
    if (result.success && result.data?.value) {
      contractColumnsSettingExists = true
      const parsed = JSON.parse(result.data.value) as unknown
      if (Array.isArray(parsed)) {
        selectedColumns.value = parsed.map(String)
      }
      contractColumnsHydrating = false
      return
    }
  } catch {
  }

  const legacy = localStorage.getItem(CONTRACT_COLUMNS_SETTING_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        selectedColumns.value = parsed.map(String)
      }
      await saveContractTableColumns()
      localStorage.removeItem(CONTRACT_COLUMNS_SETTING_KEY)
    } catch {
    }
  }
  contractColumnsHydrating = false
}

const saveContractTableColumns = async () => {
  const db = window.electronAPI?.db
  if (!db) return
  const json = JSON.stringify(selectedColumns.value)
  if (contractColumnsSettingExists) {
    await db.updateSetting(CONTRACT_COLUMNS_SETTING_KEY, json, '合同表格显示列')
    return
  }
  await db.insertSetting(CONTRACT_COLUMNS_SETTING_KEY, json, '合同表格显示列')
  contractColumnsSettingExists = true
}

onMounted(async () => {
  await loadContractTableColumns()
  window.addEventListener('keydown', handleDocumentKeydown, true)
})

watch(selectedColumns, (newVal) => {
  if (contractColumnsHydrating) return
  void saveContractTableColumns()
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDocumentKeydown, true)
})

const contextMenuSelection = ref<ContractResource | null>(null)
const cm = ref()
const selectedRows = ref<ContractResource[]>([])
const sourcePreviewVisible = ref(false)
const sourcePreviewLoading = ref(false)
const sourcePreviewError = ref<string | null>(null)
const sourcePreviewPath = ref('')
const sourcePreviewName = ref('')
const SOURCE_PREVIEW_SHORTCUT = 'Ctrl+Shift+O'

// 合同源文件预览弹窗尺寸管理
const SOURCE_PREVIEW_SIZE_KEY = 'contract-source-preview-size'
const DEFAULT_PREVIEW_WIDTH = '92vw'
const DEFAULT_PREVIEW_HEIGHT = '78vh'
const sourcePreviewWidth = ref(DEFAULT_PREVIEW_WIDTH)
const sourcePreviewHeight = ref(DEFAULT_PREVIEW_HEIGHT)

// 加载保存的弹窗尺寸
const loadSourcePreviewSize = () => {
  try {
    const saved = localStorage.getItem(SOURCE_PREVIEW_SIZE_KEY)
    if (saved) {
      const size = JSON.parse(saved)
      if (size.width) sourcePreviewWidth.value = size.width
      if (size.height) sourcePreviewHeight.value = size.height
    }
  } catch (error) {
    console.warn('[ContractContent] 加载预览弹窗尺寸失败:', error)
  }
}

// 保存弹窗尺寸
const saveSourcePreviewSize = (width: string, height: string) => {
  try {
    localStorage.setItem(SOURCE_PREVIEW_SIZE_KEY, JSON.stringify({ width, height }))
  } catch (error) {
    console.warn('[ContractContent] 保存预览弹窗尺寸失败:', error)
  }
}

// 初始化时加载尺寸
loadSourcePreviewSize()

const getFileExtension = (name: unknown) => {
  const text = String(name ?? '').trim()
  const index = text.lastIndexOf('.')
  return index >= 0 ? text.slice(index + 1).toLowerCase() : ''
}

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

const canPreviewSourceFile = (resource: ContractResource | null | undefined) => {
  if (!resource) return false
  return String(resource.type || '').trim() === 'contract-info'
}

const getActiveResource = () => {
  if (contextMenuSelection.value && canPreviewSourceFile(contextMenuSelection.value)) return contextMenuSelection.value
  const selectedById = props.resources.find((item) => String(item.id) === String(props.selectedResourceId ?? ''))
  if (selectedById && canPreviewSourceFile(selectedById)) return selectedById
  if (selectedRows.value.length === 1 && canPreviewSourceFile(selectedRows.value[0])) return selectedRows.value[0]
  return null
}

const resetSourcePreviewState = () => {
  sourcePreviewLoading.value = false
  sourcePreviewError.value = null
  sourcePreviewPath.value = ''
  sourcePreviewName.value = ''
}

// 处理弹窗尺寸变化
const handleSourcePreviewResize = (event: any) => {
  // PrimeVue Dialog 在 resize 后会触发此事件
  const dialog = event.target as HTMLElement
  if (!dialog) return
  
  const computedStyle = window.getComputedStyle(dialog)
  const width = computedStyle.width
  const height = computedStyle.height
  
  if (width && height) {
    sourcePreviewWidth.value = width
    sourcePreviewHeight.value = height
    saveSourcePreviewSize(width, height)
  }
}

const openSourceFilePreview = async (resource?: ContractResource | null) => {
  const target = resource && canPreviewSourceFile(resource) ? resource : getActiveResource()
  if (!target) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请先选择一条合同记录', life: 2200 })
    return
  }
  const libraryPath = String(props.libraryPath || '').trim()
  const contractId = String(target.id || '').trim()
  if (!libraryPath || !contractId) {
    toast.add({ severity: 'warn', summary: '提示', detail: '当前合同信息不完整，无法预览源文件', life: 2500 })
    return
  }

  sourcePreviewVisible.value = true
  sourcePreviewLoading.value = true
  sourcePreviewError.value = null
  sourcePreviewPath.value = ''
  sourcePreviewName.value = ''

  try {
    const res = await window.electronAPI.contractFiles.getList({ libraryPath, contractId })
    if (!res.success || !res.data) {
      sourcePreviewError.value = res.error || '读取合同文件失败'
      return
    }
    const sourceFile = pickBestSourceFile(res.data.items || [])
    if (!sourceFile) {
      sourcePreviewError.value = '当前合同下未找到源文件'
      return
    }
    sourcePreviewPath.value = String(sourceFile.path || '')
    sourcePreviewName.value = String(sourceFile.name || '合同源文件')
  } catch (error) {
    sourcePreviewError.value = error instanceof Error ? error.message : '读取合同文件失败'
  } finally {
    sourcePreviewLoading.value = false
  }
}

const menuModel = computed(() => {
  const target = contextMenuSelection.value
  const previewEnabled = canPreviewSourceFile(target)
  const base = [
    { label: '置顶', icon: 'pi pi-angle-double-up', command: () => target && emit('moveResource', { resource: target, direction: 'top' }) },
    { label: '置底', icon: 'pi pi-angle-double-down', command: () => target && emit('moveResource', { resource: target, direction: 'bottom' }) },
    { label: '向上', icon: 'pi pi-angle-up', command: () => target && emit('moveResource', { resource: target, direction: 'up' }) },
    { label: '向下', icon: 'pi pi-angle-down', command: () => target && emit('moveResource', { resource: target, direction: 'down' }) },
    { label: '查看文件', icon: 'pi pi-folder-open', command: () => target && openResourceWithSelection(target) },
    { separator: true },
    { label: '查看详情', icon: 'pi pi-eye', command: () => target && viewDetailsWithSelection(target) },
    { label: '查看合同源文件', icon: 'pi pi-file', shortcut: SOURCE_PREVIEW_SHORTCUT, disabled: !previewEnabled, command: () => previewEnabled && void openSourceFilePreview(target) },
    { label: '修改', icon: 'pi pi-pencil', command: () => target && emit('editResource', target) },
    { separator: true },
  ] as any[]

  return [
    ...base,
    { label: '删除', icon: 'pi pi-trash', danger: true, command: () => target && emit('deleteResource', target) },
  ]
})

const onRowContextMenu = (event: any) => {
  contextMenuSelection.value = event.data
  selectResource(event.data)
  cm.value?.show?.(event.originalEvent)
}

watch(() => props.resources, (list) => {
  const map = new Map((list || []).map((item) => [String(item.id), item]))
  selectedRows.value = (selectedRows.value || []).map((row) => map.get(String(row.id))).filter(Boolean) as ContractResource[]
})

watch(sourcePreviewVisible, (visible) => {
  if (visible) return
  resetSourcePreviewState()
})

const selectResource = (resource: ContractResource) => {
  emit('select', resource)
}

const openResource = (resource: ContractResource) => {
  emit('open', resource)
}

const openResourceWithSelection = (resource: ContractResource) => {
  selectResource(resource)
  openResource(resource)
}

const viewDetailsWithSelection = (resource: ContractResource) => {
  selectResource(resource)
  emit('viewDetails', resource)
}

const onCardContextMenu = (event: MouseEvent, resource: ContractResource) => {
  contextMenuSelection.value = resource
  selectResource(resource)
  cm.value?.show?.(event)
}

const cancelUpload = () => {
  emit('cancelUpload')
}

const retryLoad = () => {
  emit('retry')
}

const isEditableTarget = (target: EventTarget | null) => {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  const key = String(event.key || '').toLowerCase()
  if (event.altKey || !event.shiftKey || isEditableTarget(event.target)) return
  if (!(event.ctrlKey || event.metaKey) || key !== 'o') return
  event.preventDefault()
  void openSourceFilePreview()
}

const onPageChange = (event: { page: number; rows: number }) => {
  emit('pageChange', { page: event.page + 1, pageSize: event.rows })
}

const contractAmountRevealed = ref<Record<string, boolean>>({})
const showAllContractAmounts = ref(false)

const getContractAmountKey = (resource: ContractResource) => String(resource.id)

const isContractAmountRevealed = (resource: ContractResource) => {
  const key = getContractAmountKey(resource)
  return !!contractAmountRevealed.value[key]
}

const toggleContractAmount = (resource: ContractResource) => {
  const key = getContractAmountKey(resource)
  contractAmountRevealed.value = {
    ...contractAmountRevealed.value,
    [key]: !contractAmountRevealed.value[key],
  }
}

const toggleAllContractAmounts = () => {
  showAllContractAmounts.value = !showAllContractAmounts.value
  if (showAllContractAmounts.value) {
    const revealed: Record<string, boolean> = {}
    for (const r of props.resources) {
      revealed[String(r.id)] = true
    }
    contractAmountRevealed.value = revealed
  } else {
    contractAmountRevealed.value = {}
  }
}
</script>

<style scoped src="./ContractContent.css"></style>
