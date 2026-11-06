<template>
  <Dialog
    v-model:visible="visible"
    v-model:maximized="maximized"
    modal
    :header="mode === 'edit' ? '编辑合同信息' : '新增合同信息'"
    :style="{ width: '92vw', maxWidth: '92vw' }"
    :draggable="true"
    :closable="true"
    maximizable
  >
    <Splitter class="min-h-0" :style="{ height: maximized ? 'calc(100vh - 11rem)' : '72vh' }">
      <SplitterPanel :size="50" :minSize="25">
        <aside class="flex h-full min-h-0 flex-col gap-4 pr-3">
          <div
            class="rounded-xl border p-4"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="mb-3 flex items-start justify-between gap-3">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-[var(--content-text)]">合同文件</span>
                <span class="text-xs text-[var(--content-text-secondary)]">上传文件会先放入资源库 .tmp 目录中，确认保存后再写入合同目录</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button v-if="isAIEnabled" label="选择文件并解析" icon="pi pi-sparkles" :loading="isParsingContract" @click="handleParseContractByAI" />
            </div>
            <div v-if="isParsingContract && aiParsingStageText" class="mt-2 inline-flex items-center gap-1 text-xs text-[var(--p-primary-color)]">
              <i class="pi pi-spin pi-spinner text-xs"></i>
              <span>{{ aiParsingStageText }}</span>
            </div>
            <div v-if="isParsingContract && aiParsingElapsedText" class="mt-1 text-xs text-[var(--content-text-secondary)]">{{ aiParsingElapsedText }}</div>
            <div
              v-if="aiParsingError"
              class="mt-3 rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap"
              :style="{ borderColor: 'var(--p-red-400)', backgroundColor: 'var(--content-bg)', color: 'var(--p-red-500)' }"
            >
              {{ aiParsingError }}
            </div>
            <div
              v-if="false"
              class="mt-3 rounded-lg border p-3"
              :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="text-xs font-medium text-[var(--content-text)]">AI 解析日志</div>
                <span class="text-[11px] text-[var(--content-text-secondary)]">最近 {{ aiParsingLogs.length }} 条</span>
              </div>
              <div class="max-h-28 space-y-1 overflow-y-auto rounded-md border px-2 py-2 text-[11px]" :style="{ borderColor: 'var(--content-border)' }">
                <div
                  v-for="(log, index) in aiParsingLogs"
                  :key="`${index}-${log}`"
                  class="whitespace-pre-wrap break-words text-[var(--content-text-secondary)]"
                >
                  {{ log }}
                </div>
              </div>
            </div>
            <div
              v-if="false"
              class="mt-3 rounded-lg border p-3"
              :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs font-medium text-[var(--content-text)]">AI 提取证据</div>
                  <div class="mt-1 text-[11px] text-[var(--content-text-secondary)]">
                    已提取 {{ groupedAiEvidence.length }} 个字段，命中 {{ aiExtractionEvidence.evidence.length }} 条证据，分块 {{ aiExtractionEvidence.chunks.length }} 个
                  </div>
                </div>
                <Button
                  v-if="selectedContractFilePath"
                  size="small"
                  text
                  icon="pi pi-search"
                  label="打开文档查找"
                  @click="previewPaneRef?.openFind?.()"
                />
              </div>

              <div
                v-if="groupedAiEvidence.length === 0"
                class="mt-3 rounded-md border px-3 py-4 text-xs text-[var(--content-text-secondary)]"
                :style="{ borderColor: 'var(--content-border)' }"
              >
                当前未生成可展示的字段证据，请结合上方解析日志确认 AI 回填结果。
              </div>

              <div v-else class="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                <div
                  v-for="group in groupedAiEvidence"
                  :key="group.fieldKey"
                  class="rounded-lg border p-3"
                  :style="{ borderColor: 'var(--content-border)' }"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-medium text-[var(--content-text)]">{{ group.fieldLabel }}</span>
                        <span class="rounded-full px-2 py-0.5 text-[11px]" :style="{ backgroundColor: 'var(--hover-bg)', color: 'var(--content-text-secondary)' }">
                          {{ group.evidence.length }} 条
                        </span>
                      </div>
                      <div class="mt-1 text-[11px] text-[var(--content-text-secondary)] break-all">
                        当前值：{{ group.evidence[0]?.fieldValue || '未提取到值' }}
                      </div>
                    </div>
                    <Button
                      size="small"
                      text
                      icon="pi pi-crosshairs"
                      label="定位字段"
                      @click="handleLocateField(group.fieldKey)"
                    />
                  </div>

                  <div class="mt-3 space-y-2">
                    <div
                      v-for="item in group.evidence"
                      :key="item.id"
                      class="rounded-md border px-3 py-2"
                      :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
                    >
                      <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div class="text-[11px] text-[var(--content-text-secondary)]">
                          <span>块 #{{ item.chunkIndex + 1 }}</span>
                          <span v-if="formatEvidenceConfidence(item.confidence)" class="ml-2">置信度 {{ formatEvidenceConfidence(item.confidence) }}</span>
                        </div>
                        <Button
                          v-if="selectedContractFilePath"
                          size="small"
                          text
                          icon="pi pi-search"
                          label="原文定位"
                          @click="handleFindEvidenceText(item.fieldValue || item.evidenceText)"
                        />
                      </div>
                      <div
                        class="text-xs whitespace-pre-wrap break-words text-[var(--content-text)]"
                        v-html="highlightEvidenceText(item.evidenceText || '未返回证据原文', item.fieldValue || '')"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="selectedContractFilePath"
            class="flex min-h-0 flex-1 flex-col rounded-xl border p-2"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-medium text-[var(--content-text)]">文件预览</div>
                <div class="truncate text-[11px] text-[var(--content-text-secondary)]">
                  {{ selectedContractFileName || selectedContractFilePath }}
                </div>
              </div>
              <Button size="small" text icon="pi pi-search" label="查找" @click="previewPaneRef?.openFind?.()" />
            </div>
            <div
              class="min-h-0 flex-1 overflow-hidden rounded-md border"
              :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
            >
              <ContractFilesPreviewPane
                ref="previewPaneRef"
                :filePath="selectedContractFilePath"
                :displayName="selectedContractFileName || '合同文件'"
              />
            </div>
          </div>
          <div
            v-else
            class="flex items-center justify-center rounded-xl border py-10 text-sm"
            :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)', color: 'var(--content-text-secondary)' }"
          >
            暂未选择文件
          </div>
        </aside>
      </SplitterPanel>

      <SplitterPanel :size="50" :minSize="25">
        <section class="flex h-full min-h-0 flex-col gap-4 pl-3">
        <div v-if="mode === 'create'" class="grid grid-cols-2 gap-4">
          <div class="col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-[var(--content-text)]">
            合同类型
            <span class="text-red-500">*</span>
          </label>
          <Select
            :modelValue="String(form.contractType || '')"
            :options="contractTypeMergedOptions"
            option-label="label"
            option-value="value"
            placeholder="请选择系统合同类型"
            class="w-full"
            :invalid="!!errors.contractType"
            filter
            showClear
            :disabled="!hasSystemContractTypeOptions"
            @update:modelValue="form.contractType = String($event || '')"
          />
            <small v-if="hasSystemContractTypeOptions" class="min-h-[16px] text-red-500">{{ errors.contractType || '' }}</small>
            <small v-else class="min-h-[16px] text-[var(--content-text-secondary)]">请先在系统字典中维护“合同类型”后再新增合同</small>
          </div>
        </div>

        <Tabs v-if="detailsEnabled" v-model:value="activeTab">
        <TabList>
          <Tab value="base">
            <span class="flex items-center gap-2">
              <span>基础信息</span>
              <span v-if="tabHasError.base" class="text-red-500">•</span>
            </span>
          </Tab>
          <Tab value="ext">
            <span class="flex items-center gap-2">
              <span>{{ extTabTitle }}</span>
              <span v-if="tabHasError.ext" class="text-red-500">•</span>
            </span>
          </Tab>
          <Tab value="content">
            <span class="flex items-center gap-2">
              <span>合同内容</span>
              <span v-if="tabHasError.content" class="text-red-500">•</span>
            </span>
          </Tab>
          <Tab v-if="showPartyAUnitTab" value="partyAUnit">
            <span class="flex items-center gap-2">
              <span>甲方单位</span>
              <span v-if="tabHasError.partyAUnit" class="text-red-500">•</span>
            </span>
          </Tab>
          <Tab v-if="showPartyBUnitTab" value="partyBUnit">
            <span class="flex items-center gap-2">
              <span>乙方单位</span>
              <span v-if="tabHasError.partyBUnit" class="text-red-500">•</span>
            </span>
          </Tab>
          <Tab v-if="showReceiptPlanTab" value="receiptPlan">
            <span class="flex items-center gap-2">
              <span>收付计划</span>
              <span v-if="tabHasError.receiptPlan" class="text-red-500">•</span>
            </span>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="base">
            <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
              <div class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-[var(--content-text)]">合同图标</label>
                    <button
                      type="button"
                      class="flex min-h-[42px] w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors hover:border-[var(--p-primary-color)]"
                      :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
                      @click="toggleIconPopover"
                    >
                      <span class="flex items-center gap-3">
                        <i :class="String(form.projectIcon || 'pi pi-file-edit')" :style="{ color: String(form.projectColor || '#1d4ed8'), fontSize: '1.5rem' }"></i>
                        <span class="text-sm text-[var(--content-text)]">点击选择合同图标</span>
                      </span>
                      <i class="pi pi-chevron-down text-sm text-[var(--content-text-secondary)]"></i>
                    </button>
                    <Popover ref="iconPopover">
                      <div class="w-[min(32rem,calc(100vw-4rem))]">
                        <div class="mb-2 text-sm font-medium text-[var(--content-text)]">选择合同图标</div>
                        <div class="grid max-h-[240px] grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2 overflow-y-auto">
                          <button
                            v-for="icon in primeIcons"
                            :key="icon"
                            type="button"
                            class="aspect-square flex items-center justify-center rounded-md border transition-all duration-150 hover:bg-[var(--hover-bg)]"
                            :class="{ 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)] shadow-sm': form.projectIcon === icon }"
                            :style="{ borderColor: form.projectIcon === icon ? 'var(--p-primary-color)' : 'var(--content-border)' }"
                            @click="selectProjectIcon(icon)"
                          >
                            <i :class="icon" :style="{ color: String(form.projectColor || '#1d4ed8'), fontSize: '1.75rem' }"></i>
                          </button>
                        </div>
                      </div>
                    </Popover>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-[var(--content-text)]">合同颜色</label>
                    <div class="flex h-[42px] items-center gap-1.5 overflow-x-auto rounded-md border p-2" :style="{ borderColor: 'var(--content-border)' }" role="radiogroup">
                      <button
                        v-for="color in tailwind700Colors"
                        :key="color.name"
                        type="button"
                        class="h-6 w-6 flex-shrink-0 rounded-md border transition-all duration-150 focus-visible:outline-none"
                        :style="{
                          backgroundColor: color.value,
                          borderColor: form.projectColor === color.value ? '#111827' : 'transparent',
                          boxShadow: form.projectColor === color.value ? '0 0 0 1px #ffffff, 0 0 0 2px #111827' : 'none',
                          transform: form.projectColor === color.value ? 'scale(1.1)' : 'scale(1)',
                        }"
                        @click="form.projectColor = color.value"
                      ></button>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <template v-for="field in baseFields" :key="field.key">
                    <div v-if="field.key === 'clientName'" :data-field-key="field.key" class="flex flex-col gap-1" :class="field.span === 2 ? 'col-span-2' : ''">
                      <label class="text-sm font-medium text-[var(--content-text)]">
                        {{ field.label }}
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <Select
                        ref="partyASelectRef"
                        :modelValue="String(form.clientName || '')"
                        :options="partyANameOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="field.placeholder || '请选择供应商标签或输入甲方单位'"
                        class="w-full"
                        :invalid="!!errors.clientName"
                        editable
                        filter
                        showClear
                        @update:modelValue="form.clientName = String($event || '')"
                        @change="onPartyAChange"
                        @focus="partyASelectRef?.show?.()"
                      />
                      <small class="min-h-[16px] text-red-500">{{ errors.clientName || '' }}</small>
                    </div>

                    <div v-else-if="field.key === 'partyAContact'" :data-field-key="field.key" class="flex flex-col gap-1" :class="field.span === 2 ? 'col-span-2' : ''">
                      <label class="text-sm font-medium text-[var(--content-text)]">
                        {{ field.label }}
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <Select
                        :modelValue="String(form.partyAContact || '')"
                        :options="partyAContactOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="field.placeholder || `请输入或选择${field.label}`"
                        class="w-full"
                        :invalid="!!errors.partyAContact"
                        editable
                        showClear
                        @update:modelValue="form.partyAContact = String($event || '')"
                      />
                      <small class="min-h-[16px] text-red-500">{{ errors.partyAContact || '' }}</small>
                    </div>

                    <div v-else-if="field.key === 'partyBName'" :data-field-key="field.key" class="flex flex-col gap-1" :class="field.span === 2 ? 'col-span-2' : ''">
                      <label class="text-sm font-medium text-[var(--content-text)]">
                        {{ field.label }}
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <Select
                        ref="partyBSelectRef"
                        :modelValue="String(form.partyBName || '')"
                        :options="partyBNameOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="field.placeholder || `请选择${field.label}`"
                        class="w-full"
                        :invalid="!!errors.partyBName"
                        editable
                        filter
                        showClear
                        @update:modelValue="form.partyBName = String($event || '')"
                        @change="onPartyBChange"
                        @focus="partyBSelectRef?.show?.()"
                      />
                      <small class="min-h-[16px] text-red-500">{{ errors.partyBName || '' }}</small>
                    </div>

                    <div v-else-if="field.key === 'partyBContact'" :data-field-key="field.key" class="flex flex-col gap-1" :class="field.span === 2 ? 'col-span-2' : ''">
                      <label class="text-sm font-medium text-[var(--content-text)]">
                        {{ field.label }}
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <Select
                        :modelValue="String(form.partyBContact || '')"
                        :options="partyBContactOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="field.placeholder || `请输入或选择${field.label}`"
                        class="w-full"
                        :invalid="!!errors.partyBContact"
                        editable
                        showClear
                        @update:modelValue="form.partyBContact = String($event || '')"
                      />
                      <small class="min-h-[16px] text-red-500">{{ errors.partyBContact || '' }}</small>
                    </div>

                    <ContractFormFieldRenderer
                      v-else
                      :field="field"
                      :modelValue="form[field.key]"
                      :error="errors[field.key]"
                      :invalid="!!errors[field.key]"
                      :options="getFieldOptions(field)"
                      :treeOptions="getFieldTreeOptions(field)"
                      :selectFilter="field.key === 'responsiblePerson' || field.key === 'contractType'"
                      @update:modelValue="updateFieldValue(field.key, $event)"
                    />
                  </template>
                </div>
              </div>
            </div>
          </TabPanel>

        <TabPanel value="ext">
          <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
            <div class="grid grid-cols-2 gap-4">
              <ContractFormFieldRenderer
                v-for="field in extFields"
                :key="field.key"
                :field="field"
                :modelValue="form[field.key]"
                :error="errors[field.key]"
                :invalid="!!errors[field.key]"
                :options="getFieldOptions(field)"
                :treeOptions="getFieldTreeOptions(field)"
                :selectFilter="field.key === 'responsiblePerson'"
                @update:modelValue="updateFieldValue(field.key, $event)"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="content">
          <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
            <div class="grid grid-cols-2 gap-4">
              <ContractFormFieldRenderer
                v-for="field in contentFields"
                :key="field.key"
                :field="field"
                :modelValue="form[field.key]"
                :error="errors[field.key]"
                :invalid="!!errors[field.key]"
                :options="getFieldOptions(field)"
                :treeOptions="getFieldTreeOptions(field)"
                :selectFilter="field.key === 'responsiblePerson'"
                @update:modelValue="updateFieldValue(field.key, $event)"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel v-if="showPartyAUnitTab" value="partyAUnit">
          <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
            <div class="flex flex-col gap-3">
              <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-medium text-[var(--content-text)]">甲方单位档案</div>
                    <div class="text-xs text-[var(--content-text-secondary)]">AI 已识别可落库的甲方主体信息，提交合同时会同步补充到客户档案。</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Checkbox v-model="partyAUnitImportEnabled" binary inputId="aiPartyAUnitImportEnabled" />
                    <label for="aiPartyAUnitImportEnabled" class="text-sm text-[var(--content-text)]">写入客户档案</label>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">单位名称</label>
                    <InputText :modelValue="String(form.clientName || '')" class="w-full" @update:modelValue="form.clientName = String($event || '').trim()" />
                  </div>
                  <div class="col-span-2 text-xs font-medium text-[var(--content-text)]">法人信息</div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人姓名</label>
                    <InputText :modelValue="aiPartyAUnitForm.legalRepName" class="w-full" @update:modelValue="aiPartyAUnitForm.legalRepName = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人联系手机号</label>
                    <InputText :modelValue="aiPartyAUnitForm.legalRepMobile" class="w-full" @update:modelValue="aiPartyAUnitForm.legalRepMobile = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人邮箱</label>
                    <InputText :modelValue="aiPartyAUnitForm.legalRepEmail" class="w-full" @update:modelValue="aiPartyAUnitForm.legalRepEmail = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人身份证号</label>
                    <InputText :modelValue="aiPartyAUnitForm.legalRepIdNumber" class="w-full" @update:modelValue="aiPartyAUnitForm.legalRepIdNumber = String($event || '').trim()" />
                  </div>

                  <div class="col-span-2 text-xs font-medium text-[var(--content-text)]">项目联系人信息</div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人姓名</label>
                    <InputText :modelValue="String(form.partyAContact || '')" class="w-full" @update:modelValue="form.partyAContact = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人手机号</label>
                    <InputText :modelValue="String(form.partyAContactMobile || '')" class="w-full" @update:modelValue="form.partyAContactMobile = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人电话</label>
                    <InputText :modelValue="String(form.partyAContactPhone || '')" class="w-full" @update:modelValue="form.partyAContactPhone = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人邮箱</label>
                    <InputText :modelValue="String(form.partyAContactEmail || '')" class="w-full" @update:modelValue="form.partyAContactEmail = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人身份证号</label>
                    <InputText :modelValue="String(form.partyAContactIdNumber || '')" class="w-full" @update:modelValue="form.partyAContactIdNumber = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系电话</label>
                    <InputText :modelValue="aiPartyAUnitForm.phone" class="w-full" @update:modelValue="aiPartyAUnitForm.phone = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">发票类型</label>
                    <Select
                      :modelValue="aiPartyAUnitForm.invoiceType || null"
                      :options="aiInvoiceTypeOptions"
                      option-label="label"
                      option-value="value"
                      showClear
                      class="w-full"
                      @update:modelValue="aiPartyAUnitForm.invoiceType = String($event || '').trim()"
                    />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">单位地址</label>
                    <InputText :modelValue="aiPartyAUnitForm.address" class="w-full" @update:modelValue="aiPartyAUnitForm.address = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">税号</label>
                    <InputText :modelValue="aiPartyAUnitForm.taxNumber" class="w-full" @update:modelValue="aiPartyAUnitForm.taxNumber = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">开户行</label>
                    <InputText :modelValue="aiPartyAUnitForm.bankName" class="w-full" @update:modelValue="aiPartyAUnitForm.bankName = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">银行账号</label>
                    <InputText :modelValue="aiPartyAUnitForm.bankAccount" class="w-full" @update:modelValue="aiPartyAUnitForm.bankAccount = String($event || '').trim()" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel v-if="showPartyBUnitTab" value="partyBUnit">
          <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
            <div class="flex flex-col gap-3">
              <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-medium text-[var(--content-text)]">乙方单位档案</div>
                    <div class="text-xs text-[var(--content-text-secondary)]">AI 已识别可落库的乙方主体信息，提交合同时会同步补充到乙方单位档案。</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Checkbox v-model="partyBUnitImportEnabled" binary inputId="aiPartyBUnitImportEnabled" />
                    <label for="aiPartyBUnitImportEnabled" class="text-sm text-[var(--content-text)]">写入乙方单位档案</label>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">单位名称</label>
                    <InputText :modelValue="String(form.partyBName || '')" class="w-full" @update:modelValue="form.partyBName = String($event || '').trim()" />
                  </div>
                  <div class="col-span-2 text-xs font-medium text-[var(--content-text)]">法人信息</div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人姓名</label>
                    <InputText :modelValue="aiPartyBUnitForm.legalRepName" class="w-full" @update:modelValue="aiPartyBUnitForm.legalRepName = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人联系手机号</label>
                    <InputText :modelValue="aiPartyBUnitForm.legalRepMobile" class="w-full" @update:modelValue="aiPartyBUnitForm.legalRepMobile = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人邮箱</label>
                    <InputText :modelValue="aiPartyBUnitForm.legalRepEmail" class="w-full" @update:modelValue="aiPartyBUnitForm.legalRepEmail = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">法人身份证号</label>
                    <InputText :modelValue="aiPartyBUnitForm.legalRepIdNumber" class="w-full" @update:modelValue="aiPartyBUnitForm.legalRepIdNumber = String($event || '').trim()" />
                  </div>

                  <div class="col-span-2 text-xs font-medium text-[var(--content-text)]">项目联系人信息</div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人姓名</label>
                    <InputText :modelValue="String(form.partyBContact || '')" class="w-full" @update:modelValue="form.partyBContact = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人手机号</label>
                    <InputText :modelValue="String(form.partyBContactMobile || '')" class="w-full" @update:modelValue="form.partyBContactMobile = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人电话</label>
                    <InputText :modelValue="String(form.partyBContactPhone || '')" class="w-full" @update:modelValue="form.partyBContactPhone = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人邮箱</label>
                    <InputText :modelValue="String(form.partyBContactEmail || '')" class="w-full" @update:modelValue="form.partyBContactEmail = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系人身份证号</label>
                    <InputText :modelValue="String(form.partyBContactIdNumber || '')" class="w-full" @update:modelValue="form.partyBContactIdNumber = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">联系电话</label>
                    <InputText :modelValue="aiPartyBUnitForm.phone" class="w-full" @update:modelValue="aiPartyBUnitForm.phone = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">发票类型</label>
                    <Select
                      :modelValue="aiPartyBUnitForm.invoiceType || null"
                      :options="aiInvoiceTypeOptions"
                      option-label="label"
                      option-value="value"
                      showClear
                      class="w-full"
                      @update:modelValue="aiPartyBUnitForm.invoiceType = String($event || '').trim()"
                    />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">单位地址</label>
                    <InputText :modelValue="aiPartyBUnitForm.address" class="w-full" @update:modelValue="aiPartyBUnitForm.address = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">税号</label>
                    <InputText :modelValue="aiPartyBUnitForm.taxNumber" class="w-full" @update:modelValue="aiPartyBUnitForm.taxNumber = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">开户行</label>
                    <InputText :modelValue="aiPartyBUnitForm.bankName" class="w-full" @update:modelValue="aiPartyBUnitForm.bankName = String($event || '').trim()" />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2">
                    <label class="text-xs font-medium text-[var(--content-text-secondary)]">银行账号</label>
                    <InputText :modelValue="aiPartyBUnitForm.bankAccount" class="w-full" @update:modelValue="aiPartyBUnitForm.bankAccount = String($event || '').trim()" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel v-if="showReceiptPlanTab" value="receiptPlan">
          <div class="max-h-[62vh] overflow-y-auto py-4 pr-2">
            <template v-if="mode === 'edit'">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-sm font-medium text-[var(--content-text)]">收付计划</div>
                <Button label="新增" icon="pi pi-plus" size="small" text @click="handleAddReceiptPlan" />
              </div>

              <ReceiptPlanListPanel
                :receiptPlans="contractReceiptPlans"
                :filteredReceiptPlans="filteredContractReceiptPlans"
                :receiptPlanViewMode="receiptPlanViewMode"
                :receiptPlanTableQuery="receiptPlanTableQuery"
                :hasReceiptPlanTableQuery="hasReceiptPlanTableQuery"
                :clearReceiptPlanTableQuery="clearReceiptPlanTableQuery"
                :formatMoney="formatMoney"
                :getOutstanding="getOutstanding"
                :getDirectionSeverity="getDirectionSeverity"
                showActions
                tableScrollHeight="420px"
                @view="handleViewReceiptPlan"
                @edit="handleEditReceiptPlan"
                @delete="handleDeleteReceiptPlan"
              />

              <ReceiptPlanDialog
                v-model:visible="receiptPlanDialogVisible"
                :initialData="selectedReceiptPlan"
                :readonly="receiptPlanDialogReadonly"
                @saved="onReceiptPlanSaved"
              />
            </template>

            <template v-else>
              <div v-if="pendingAiReceiptPlans.length === 0" class="flex items-center justify-center rounded-xl border py-10 text-sm text-[var(--content-text-secondary)]" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
                暂无 AI 识别的收款计划
              </div>
              <div v-else class="flex flex-col gap-3">
                <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
                  <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div class="flex flex-col gap-1">
                      <div class="text-sm font-medium text-[var(--content-text)]">AI 识别到收款计划 {{ pendingAiReceiptPlans.length }} 条</div>
                      <div class="text-xs text-[var(--content-text-secondary)]">
                        预计总金额 {{ formatMoney(aiReceiptPlanTotalAmount) }}，确认后可随合同一起保存入库，并可选同步到日历（按应收(付)日期）
                      </div>
                    </div>
                    <div class="flex items-center gap-5">
                      <div class="flex items-center gap-2">
                        <Checkbox v-model="receiptPlanImportEnabled" binary inputId="aiReceiptPlanImportEnabled" />
                        <label for="aiReceiptPlanImportEnabled" class="text-sm text-[var(--content-text)]">写入数据库</label>
                      </div>
                      <div class="flex items-center gap-2">
                        <Checkbox v-model="receiptPlanSyncToCalendar" binary :disabled="!receiptPlanImportEnabled" inputId="aiReceiptPlanSyncToCalendar" />
                        <label for="aiReceiptPlanSyncToCalendar" class="text-sm text-[var(--content-text)]" :class="!receiptPlanImportEnabled ? 'opacity-60' : ''">同步日历</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border p-4" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <div class="text-sm font-medium text-[var(--content-text)]">计划明细</div>
                    <Button
                      label="新增一行"
                      icon="pi pi-plus"
                      size="small"
                      text
                      @click="pendingAiReceiptPlans.push({ plan_name: `第${pendingAiReceiptPlans.length + 1}期`, direction: '收款', receipt_frequency: undefined, ratio: undefined })"
                    />
                  </div>

                  <div class="flex flex-col gap-3">
                    <div
                      v-for="(plan, idx) in pendingAiReceiptPlans"
                      :key="idx"
                      class="rounded-lg border p-3"
                      :style="{ borderColor: receiptPlanRowErrors[String(idx)] ? 'var(--p-red-400)' : 'var(--content-border)', backgroundColor: 'var(--content-bg)' }"
                    >
                      <div class="grid grid-cols-2 gap-3">
                        <div class="flex flex-col gap-1 col-span-2">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">收付款名称</label>
                          <InputText
                            :modelValue="plan.plan_name"
                            class="w-full"
                            placeholder="例如：首付款/验收款/尾款"
                            @update:modelValue="plan.plan_name = String($event || '').trim()"
                          />
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">方向</label>
                          <Select
                            :modelValue="plan.direction"
                            :options="aiPlanDirectionOptions"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                            @update:modelValue="plan.direction = ($event as any) || '收款'"
                          />
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">收付频率</label>
                          <Select
                            :modelValue="plan.receipt_frequency || null"
                            :options="receiptFrequencyOptions"
                            option-label="label"
                            option-value="value"
                            showClear
                            class="w-full"
                            @update:modelValue="plan.receipt_frequency = String($event || '').trim() || undefined"
                          />
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">应收(付)日期</label>
                          <InputText
                            :modelValue="plan.expected_date || ''"
                            type="date"
                            class="w-full"
                            @update:modelValue="plan.expected_date = String($event || '').trim() || undefined"
                          />
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">应收(付)金额</label>
                          <InputNumber
                            :modelValue="plan.expected_amount ?? null"
                            class="w-full"
                            inputClass="w-full"
                            mode="decimal"
                            :min="0"
                            :minFractionDigits="0"
                            :maxFractionDigits="2"
                            @update:modelValue="plan.expected_amount = typeof $event === 'number' ? $event : undefined"
                          />
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">比例(%)</label>
                          <InputNumber
                            :modelValue="plan.ratio ?? null"
                            class="w-full"
                            inputClass="w-full"
                            mode="decimal"
                            :min="0"
                            :minFractionDigits="0"
                            :maxFractionDigits="2"
                            @update:modelValue="plan.ratio = typeof $event === 'number' ? $event : undefined"
                          />
                        </div>

                        <div class="flex flex-col gap-1 col-span-2">
                          <label class="text-xs font-medium text-[var(--content-text-secondary)]">备注/触发条件</label>
                          <InputText
                            :modelValue="plan.remark || ''"
                            class="w-full"
                            placeholder="填写触发条件、补充说明等"
                            @update:modelValue="plan.remark = String($event || '').trim() || undefined"
                          />
                        </div>
                      </div>

                      <div class="mt-2 flex items-center justify-between gap-2">
                        <small class="min-h-[16px] text-red-500">{{ receiptPlanRowErrors[String(idx)] || '' }}</small>
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          size="small"
                          @click="pendingAiReceiptPlans.splice(idx, 1)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </TabPanel>
      </TabPanels>
        </Tabs>

        <div v-else class="flex items-center justify-center rounded-xl border py-8 text-sm text-[var(--content-text-secondary)]" :style="{ borderColor: 'var(--content-border)', backgroundColor: 'var(--content-bg)' }">
          {{ hasSystemContractTypeOptions ? '请选择合同类型后继续填写合同信息' : '系统合同类型未加载，暂时无法继续填写合同信息' }}
        </div>
      </section>
      </SplitterPanel>
    </Splitter>

    <div class="flex justify-end gap-2 border-t pt-4" :style="{ borderColor: 'var(--content-border)' }">
      <Button label="取消" severity="secondary" @click="visible = false" />
      <Button :label="primaryButtonLabel" :disabled="!detailsEnabled" @click="handlePrimaryAction" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Popover from 'primevue/popover'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useConfirm } from 'primevue/useconfirm'
import { storeToRefs } from 'pinia'
import type { ContractInfoCreateDTO, ContractInfoEntity, ContractInfoUpdateDTO } from '../../../../../shared/types/contractInfo.types'
import ContractFilesPreviewPane from '../../contract-files/components/ContractFilesPreviewPane.vue'
import ContractFormFieldRenderer from './ContractFormFieldRenderer.vue'
import ReceiptPlanListPanel from './ReceiptPlanListPanel.vue'
import ReceiptPlanDialog from '../../receipt-plan/components/ReceiptPlanDialog.vue'
import { useReceiptPlanStore, type ReceiptPlan } from '../../../../stores/contract/receiptPlanStore'
import { useCreateContractInfoModal } from './useCreateContractInfoModal'

type CreatePayload = Omit<ContractInfoCreateDTO, 'libraryPath'>
type UpdatePayload = Omit<ContractInfoUpdateDTO, 'libraryPath'>
type AIAppliedReceiptPlan = {
  plan_name: string
  direction: '收款' | '付款'
  receipt_frequency?: string
  ratio?: number
  expected_amount?: number
  expected_date?: string
  remark?: string
}

const visible = defineModel<boolean>('visible', { default: false })

const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit'
  initial?: ContractInfoEntity | null
}>(), {
  mode: 'create',
  initial: null,
})

const emit = defineEmits<{
  confirm: [
    payload:
      | { mode: 'create'; payload: CreatePayload; aiReceiptPlans?: AIAppliedReceiptPlan[]; aiReceiptPlanSyncToCalendar?: boolean; uploadedFile?: { tempPath: string; originalName: string } }
      | { mode: 'edit'; payload: UpdatePayload; aiReceiptPlans?: AIAppliedReceiptPlan[]; aiReceiptPlanSyncToCalendar?: boolean; uploadedFile?: { tempPath: string; originalName: string } }
  ]
}>()

const mode = computed(() => props.mode || 'create')

const maximized = ref(false)

const {
  isParsingContract,
  aiParsingStageText,
  aiParsingElapsedText,
  aiParsingLogs,
  aiParsingError,
  aiExtractionEvidence,
  selectedContractFilePath,
  selectedContractFileName,
  groupedAiEvidence,
  isAIEnabled,
  schema,
  errors,
  activeTab,
  iconPopover,
  partyASelectRef,
  partyBSelectRef,
  form,
  contractGroupOptions,
  contractTypeOptionsFromDictionary,
  currencyOptions,
  contractStatusOptions,
  settlementMethodOptions,
  signingFormOptions,
  procurementSourceOptions,
  executionMethodOptions,
  receiptFrequencyOptions,
  departmentOptions,
  departmentTreeOptions,
  partyANameOptions,
  partyBNameOptions,
  partyAContactOptions,
  partyBContactOptions,
  contractTypeMergedOptions,
  hasSystemContractTypeOptions,
  extTabTitle,
  detailsEnabled,
  baseFields,
  extFields,
  contentFields,
  tabHasError,
  getFieldOptions,
  getFieldTreeOptions,
  updateFieldValue,
  onPartyAChange,
  onPartyBChange,
  toggleIconPopover,
  selectProjectIcon,
  handleParseContractByAI,
  pendingAiReceiptPlans,
  aiPartyAUnitForm,
  aiPartyBUnitForm,
  partyAUnitImportEnabled,
  partyBUnitImportEnabled,
  receiptPlanImportEnabled,
  receiptPlanSyncToCalendar,
  receiptPlanRowErrors,
  showPartyAUnitTab,
  showPartyBUnitTab,
  showReceiptPlanTab,
  aiInvoiceTypeOptions,
  isLastTab,
  primaryButtonLabel,
  handlePrimaryAction,
  validateCurrentTab,
  focusFieldByKey,
  highlightEvidenceText,
  formatEvidenceConfidence,
  submit,
  primeIcons,
  tailwind700Colors,
} = useCreateContractInfoModal({
  visible,
  mode,
  initial: computed(() => props.initial),
  onConfirm: (payload) => emit('confirm', payload as any),
})

const previewPaneRef = ref<InstanceType<typeof ContractFilesPreviewPane> | null>(null)

const handleLocateField = async (fieldKey: string) => {
  await focusFieldByKey(fieldKey)
}

const handleFindEvidenceText = async (text: string) => {
  const query = String(text || '').trim()
  if (!query) return
  await previewPaneRef.value?.setFindQuery?.(query, true)
}

const aiReceiptPlanTotalAmount = computed(() =>
  pendingAiReceiptPlans.value.reduce((sum, item) => sum + (Number(item.expected_amount) || 0), 0)
)

const formatMoney = (value: unknown) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const aiPlanDirectionOptions = [
  { label: '收款', value: '收款' },
  { label: '付款', value: '付款' },
]

const confirm = useConfirm()
const receiptPlanStore = useReceiptPlanStore()
const { plans: allReceiptPlans } = storeToRefs(receiptPlanStore)

watch(
  () => visible.value,
  (v) => {
    if (v && mode.value === 'edit') {
      receiptPlanStore.ensureSeeded()
    }
  }
)

const receiptPlanViewMode = ref<'table' | 'card'>('table')
const receiptPlanTableQuery = reactive({
  plan_name: '',
  direction: '',
  expected_date: '',
})
const hasReceiptPlanTableQuery = computed(() => Boolean(receiptPlanTableQuery.plan_name || receiptPlanTableQuery.direction || receiptPlanTableQuery.expected_date))
const clearReceiptPlanTableQuery = () => {
  receiptPlanTableQuery.plan_name = ''
  receiptPlanTableQuery.direction = ''
  receiptPlanTableQuery.expected_date = ''
}

const sanitizeMoney = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}
const getOutstanding = (plan: ReceiptPlan) => sanitizeMoney((plan as any).expected_amount) - sanitizeMoney((plan as any).received_amount)
const getDirectionSeverity = (direction?: string) => {
  const text = String(direction || '').trim()
  if (text.includes('收')) return 'success'
  if (text.includes('付')) return 'warn'
  return 'info'
}

const contractReceiptPlans = computed(() => {
  const contractId = String(props.initial?.id || '').trim()
  if (!contractId) return []
  return (allReceiptPlans.value || []).filter((row) => String((row as any).contract_id || '').trim() === contractId)
})

const filteredContractReceiptPlans = computed(() => {
  const nameQ = String(receiptPlanTableQuery.plan_name || '').trim().toLowerCase()
  const directionQ = String(receiptPlanTableQuery.direction || '').trim().toLowerCase()
  const dateQ = String(receiptPlanTableQuery.expected_date || '').trim()
  return contractReceiptPlans.value.filter((row) => {
    if (nameQ && !String((row as any).plan_name || '').toLowerCase().includes(nameQ)) return false
    if (directionQ && !String((row as any).direction || '').toLowerCase().includes(directionQ)) return false
    if (dateQ && String((row as any).expected_date || '').trim() !== dateQ) return false
    return true
  })
})

const receiptPlanDialogVisible = ref(false)
const receiptPlanDialogReadonly = ref(false)
const selectedReceiptPlan = ref<ReceiptPlan | null>(null)

const handleAddReceiptPlan = () => {
  const contractId = String(props.initial?.id || '').trim()
  selectedReceiptPlan.value = {
    id: '',
    contract_id: contractId,
    contract_code: String(form.contractCode || '').trim(),
    contract_name: String(form.contractName || '').trim(),
    direction: '收款',
    plan_name: '',
    receipt_frequency: '',
    expected_amount: 0,
    expected_date: new Date().toISOString().split('T')[0],
    received_amount: 0,
    remark: '',
    custom1: '',
  } as ReceiptPlan
  receiptPlanDialogReadonly.value = false
  receiptPlanDialogVisible.value = true
}

const handleViewReceiptPlan = (row: ReceiptPlan) => {
  selectedReceiptPlan.value = { ...(row as any) }
  receiptPlanDialogReadonly.value = true
  receiptPlanDialogVisible.value = true
}

const handleEditReceiptPlan = (row: ReceiptPlan) => {
  selectedReceiptPlan.value = { ...(row as any) }
  receiptPlanDialogReadonly.value = false
  receiptPlanDialogVisible.value = true
}

const handleDeleteReceiptPlan = (row: ReceiptPlan) => {
  confirm.require({
    message: `确定要删除收付计划 "${String((row as any).plan_name || '')}" 吗？`,
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => {
      receiptPlanStore.plans = receiptPlanStore.plans.filter((p: any) => p.id !== (row as any).id)
    },
  })
}

const onReceiptPlanSaved = (payload: { mode: 'create' | 'update'; row: ReceiptPlan }) => {
  if (payload.mode === 'create') receiptPlanStore.plans = [payload.row, ...receiptPlanStore.plans]
  else receiptPlanStore.plans = receiptPlanStore.plans.map((r) => ((r as any).id === (payload.row as any).id ? payload.row : r))
  receiptPlanDialogReadonly.value = false
  receiptPlanDialogVisible.value = false
}
</script>
