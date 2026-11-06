<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    class="!w-[560px] p-0 custom-drawer"
    :showCloseIcon="false"
  >
    <template #header>
      <div class="flex items-center justify-between w-full h-20 px-8 border-b border-[var(--content-border)] bg-[var(--content-bg)]">
        <div class="flex items-center gap-4 min-w-0">
          <div class="w-10 h-10 rounded-lg bg-[var(--sidebar-active-bg)] flex items-center justify-center text-[var(--btn-primary-bg)] shrink-0">
            <i class="pi pi-id-card text-2xl"></i>
          </div>
          <div class="min-w-0">
            <h2 class="text-xl font-bold tracking-tight text-[var(--content-text)] truncate">员工详情</h2>
            <p class="text-xs font-semibold uppercase tracking-widest text-[var(--content-text-secondary)]">Personnel Detail View</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="visible = false"
            class="p-2 hover:bg-[var(--sidebar-hover-bg)] rounded-full transition-colors text-[var(--content-text-secondary)]"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
    </template>

    <div v-if="personnel" class="flex flex-col h-full bg-[var(--content-bg)]">
      <div class="flex-1 overflow-y-auto px-8 py-8 space-y-6 custom-scrollbar">
        <section class="relative overflow-hidden rounded-2xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-6 shadow-sm">
          <div class="relative z-10 space-y-5">
            <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div class="min-w-0">
                <div class="flex items-start gap-4">
                <div
                  class="flex h-24 w-24 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-3xl border border-[var(--content-border)] bg-[var(--sidebar-bg)] shadow-sm"
                  @click="openPhotoViewer()"
                >
                  <img v-if="photoPreviewUrl" :src="photoPreviewUrl" :alt="`${personnel.name || '员工'}照片`" class="h-full w-full object-cover" />
                  <span v-else class="text-2xl font-semibold tracking-wide text-[var(--content-text-secondary)]">{{ photoFallbackText }}</span>
                </div>

                  <div class="min-w-0 flex-1">
                    <div class="mt-3 flex items-center gap-2">
                      <h1 class="min-w-0 truncate text-3xl font-black tracking-tight text-[var(--content-text)]">{{ personnel.name || '-' }}</h1>
                      <Button
                        icon="pi pi-copy"
                        size="small"
                        text
                        severity="secondary"
                        @click="copyPersonnelCoreInfo"
                        v-tooltip.top="'复制姓名、手机号、邮箱'"
                      />
                    </div>

                    <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <Tag :value="personnel.status || '未知'" :severity="statusSeverity" />
                      <span class="font-semibold text-[var(--content-text)]">{{ personnel.position || '未填写岗位' }}</span>
                      <span v-if="companySummary" class="text-[var(--content-text-secondary)]">{{ companySummary }}</span>
                    </div>

                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 pt-1 text-sm">
                <div class="flex items-center gap-2">
                  <div class="break-all font-bold text-[var(--content-text)]">{{ personnel.phone || '-' }}</div>
                  <Button
                    icon="pi pi-copy"
                    size="small"
                    text
                    severity="secondary"
                    @click="copyPersonnelPhone"
                    v-tooltip.top="'复制手机号'"
                  />
                </div>

                <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div class="break-all font-bold text-[var(--content-text)]">{{ personnel.email || '-' }}</div>
                  <div class="font-bold text-[var(--content-text)]">{{ formatMoney(personnel.salary_monthly, personnel.salary_currency) }}</div>
                </div>
              </div>
            </div>

            <div class="flex w-full flex-wrap items-center gap-2 pl-28">
              <button
                v-if="resumePreviewPath"
                type="button"
                class="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--btn-primary-bg)] hover:text-[var(--btn-primary-hover)]"
                @click="openResumePreview"
              >
                <i class="pi pi-file text-[var(--content-text-secondary)]"></i>
                <span class="truncate">{{ resumeFileName }}</span>
              </button>
              <Button
                v-if="resumePreviewPath"
                icon="pi pi-clipboard"
                size="small"
                text
                severity="secondary"
                @click="copyResumeFileToClipboard"
                v-tooltip.top="'复制文件到剪贴板'"
              />
              <Button
                v-if="resumePreviewPath"
                icon="pi pi-copy"
                size="small"
                text
                severity="secondary"
                @click="copyResumeFileName"
                v-tooltip.top="'复制文件名'"
              />
              <span v-if="!resumePreviewPath" class="text-sm text-[var(--content-text-secondary)]">未上传简历源文件</span>
            </div>

          </div>
          <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-[var(--btn-primary-bg)] opacity-10 rounded-full blur-3xl"></div>
        </section>

        <section class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
          <div class="flex items-center gap-2">
            <i class="pi pi-user text-[var(--btn-primary-bg)] text-lg"></i>
            <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">基本信息</h3>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoField label="手机号" :value="personnel.phone" copyable />
            <InfoField label="邮箱" :value="personnel.email" copyable />
            <InfoField label="入职日期" :value="personnel.entry_date" />
            <InfoField label="档案编号" :value="personnel.archive_no" />
            <InfoField label="性别" :value="personnel.gender" copyable />
            <InfoField label="出生日期" :value="personnel.birth_date" copyable />
            <InfoField label="身份证号" :value="personnel.id_card_number" />
            <InfoField label="紧急联系人" :value="personnel.emergency_contact" />
            <InfoField label="紧急联系电话" :value="personnel.emergency_contact_phone" />
            <InfoField label="学历" :value="personnel.education" />
            <InfoField label="毕业院校" :value="personnel.graduate_school" />
            <InfoField label="专业" :value="personnel.major" />
            <div class="col-span-2">
              <InfoField label="联系地址" :value="personnel.address" copyable multiline />
            </div>
          </div>
        </section>

        <section class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
          <div class="flex items-center gap-2">
            <i class="pi pi-wallet text-[var(--btn-primary-bg)] text-lg"></i>
            <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">工资信息</h3>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoField label="基本工资" :value="formatMoney(personnel.salary_base, personnel.salary_currency)" />
            <InfoField label="月薪总额" :value="formatMoney(personnel.salary_monthly, personnel.salary_currency)" />
            <InfoField label="工资币种" :value="personnel.salary_currency || 'CNY'" />
            <InfoField label="开户行" :value="personnel.salary_bank_name" />
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">工资卡账号</label>
              <p class="mt-1 font-medium text-[var(--content-text)] break-all">{{ personnel.salary_bank_account || '-' }}</p>
            </div>
          </div>
        </section>

        <section class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="pi pi-images text-[var(--btn-primary-bg)] text-lg"></i>
              <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">证件</h3>
            </div>
            <div class="flex items-center gap-2">
              <Button size="small" label="身份证" icon="pi pi-plus" text @click="pickAndUploadDocument('id_card')" />
              <Button size="small" label="毕业证" icon="pi pi-plus" text @click="pickAndUploadDocument('diploma')" />
              <Button size="small" label="其他证件" icon="pi pi-plus" text @click="pickAndUploadDocument('other')" />
            </div>
          </div>
          <div v-if="documents.length" class="overflow-x-auto whitespace-nowrap custom-scrollbar py-1">
            <div class="inline-flex gap-3">
              <div
                v-for="(doc, docIndex) in documents"
                :key="doc.id"
                class="w-56 shrink-0 rounded-lg border border-[var(--content-border)] bg-[var(--content-bg)] p-3"
              >
                <div class="text-sm font-semibold truncate">{{ doc.doc_name || '-' }}</div>
                <div class="mt-1 text-xs text-[var(--content-text-secondary)] truncate">
                  {{ formatDocumentType(doc.doc_type) }} · {{ doc.doc_number || '无证件号' }}
                </div>
                <div class="mt-2 h-28 rounded-md bg-[var(--sidebar-bg)] border border-[var(--content-border)] flex items-center justify-center overflow-hidden cursor-pointer p-1"
                  @click="openDocumentViewer(docIndex, 0)">
                  <img
                    v-if="getDocumentPreviewUrl(doc)"
                    :src="getDocumentPreviewUrl(doc)"
                    class="w-full h-full object-contain"
                  />
                  <span v-else class="text-xs text-[var(--content-text-secondary)]">无预览</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-1">
                  <Tag v-if="doc.is_primary" severity="info" value="主证件" />
                </div>
                <div class="mt-2 flex items-center gap-1">
                  <Button size="small" text icon="pi pi-folder-open" @click="openDocumentFile(doc.file_paths?.[0])" />
                  <Button size="small" text icon="pi pi-clipboard" @click="copyDocumentFileToClipboard(doc)" v-tooltip.top="'复制到微信'" />
                  <Button size="small" text icon="pi pi-trash" severity="danger" @click="removeDocument(doc)" />
                </div>
                <div v-if="doc.ai_fill_status === 'pending'" class="mt-2 flex items-center gap-1">
                  <Button size="small" text label="确认回填" @click="applyDocumentDraft(doc)" />
                  <Button size="small" text label="忽略" severity="secondary" @click="rejectDocumentDraft(doc.id)" />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-[var(--content-text-secondary)]">暂无证件</div>
        </section>

        <section class="space-y-4 p-6 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="pi pi-file-text text-[var(--btn-primary-bg)] text-lg"></i>
              <h3 class="font-bold text-[var(--content-text)] tracking-wide uppercase">简历与备注</h3>
            </div>
            <Button size="small" text icon="pi pi-external-link" label="打开详情" @click="resumeDetailVisible = true" />
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">工作经历摘要</label>
              <div class="mt-1 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-3 text-sm text-[var(--content-text)] whitespace-pre-wrap leading-relaxed">
                {{ personnel.work_experience || '-' }}
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">备注</label>
              <div class="mt-1 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-3 text-sm text-[var(--content-text)] whitespace-pre-wrap leading-relaxed">
                {{ personnel.remark || '-' }}
              </div>
            </div>
            <div v-if="personnel.resume_text">
              <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">简历详情</label>
              <div
                class="resume-markdown mt-1 max-h-64 overflow-auto rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-3 text-xs text-[var(--content-text)] leading-relaxed"
                v-html="renderedResumeTextHtml"
              ></div>
            </div>
            <div v-else>
              <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">简历详情</label>
              <div class="mt-1 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-3 text-xs text-[var(--content-text-secondary)] leading-relaxed">
                -
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer class="p-8 bg-[var(--content-bg)] border-t border-[var(--content-border)] flex items-center gap-3 shrink-0">
        <button
          @click="emit('edit', personnel)"
          class="flex-1 h-12 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] active:bg-[var(--btn-primary-active)] text-[var(--btn-primary-text)] font-bold rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <i class="pi pi-file-edit text-lg"></i>
          <span>编辑</span>
        </button>
        <button
          @click="visible = false"
          class="px-6 h-12 border border-[var(--content-border)] text-[var(--content-text)] font-bold rounded-lg hover:bg-[var(--sidebar-hover-bg)] transition-colors flex items-center justify-center gap-2"
        >
          <span>关闭</span>
        </button>
      </footer>
    </div>
  </Drawer>

  <Teleport to="body">
    <div
      v-if="previewVisible && resumePreviewPath"
      class="fixed rounded-2xl border border-[var(--content-border)] bg-[var(--content-bg)] shadow-2xl overflow-hidden"
      :style="{ ...previewPanelStyle, zIndex: String(previewZIndex) }"
      @mousedown="bringPreviewToFront"
    >
      <div
        class="flex items-center justify-between gap-3 border-b border-[var(--content-border)] px-4 py-3 cursor-move select-none bg-[var(--content-bg)]"
        @mousedown="startPreviewDrag"
      >
        <div class="min-w-0">
          <div class="font-semibold text-[var(--content-text)] truncate">简历源文件预览</div>
          <div class="text-xs text-[var(--content-text-secondary)] truncate">{{ resumeFileName }}</div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            :title="previewDockTitle"
            @mousedown.stop
            @click="resetPreviewPanelLayout"
          >
            <i :class="previewDockIconClass"></i>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            :title="previewFullscreen ? '退出全屏' : '全屏预览'"
            @mousedown.stop
            @click="togglePreviewFullscreen"
          >
            <i :class="previewFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"></i>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
            title="关闭预览"
            @mousedown.stop
            @click="closeResumePreview"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>

      <div class="h-[calc(100%-57px)] min-h-0 bg-[var(--content-bg)]">
        <ContractFilesPreviewPane
          :filePath="resumePreviewPath"
          :displayName="resumeFileName"
          class="h-full"
        />
      </div>

      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-n" @mousedown="startPreviewResize('n', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-s" @mousedown="startPreviewResize('s', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-e" @mousedown="startPreviewResize('e', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-w" @mousedown="startPreviewResize('w', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-ne" @mousedown="startPreviewResize('ne', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-nw" @mousedown="startPreviewResize('nw', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-se" @mousedown="startPreviewResize('se', $event)"></span>
      <span v-if="!previewFullscreen" class="preview-resize-handle preview-resize-handle-sw" @mousedown="startPreviewResize('sw', $event)"></span>
    </div>
  </Teleport>

  <Dialog v-model:visible="documentViewerVisible" modal header="证件预览" :style="{ width: '72vw' }">
    <div class="flex items-center justify-between gap-2 mb-3">
      <Button size="small" text icon="pi pi-angle-left" @click="prevDocumentImage" />
      <div class="text-sm text-[var(--content-text-secondary)]">
        {{ activeDocumentTitle }}
      </div>
      <Button size="small" text icon="pi pi-angle-right" @click="nextDocumentImage" />
    </div>
    <div class="h-[62vh] rounded-lg border border-[var(--content-border)] bg-[var(--sidebar-bg)] overflow-hidden">
      <ContractFilesPreviewPane
        v-if="activeDocumentFilePath"
        :filePath="activeDocumentFilePath"
        :displayName="activeDocumentDisplayName"
        class="h-full"
      />
      <div v-else class="h-full flex items-center justify-center text-sm text-[var(--content-text-secondary)]">
        当前文件暂不支持预览
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="photoViewerVisible" modal header="照片预览" :style="{ width: '56vw', maxWidth: '920px' }">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-4">
        <Button size="small" text icon="pi pi-image" label="选择照片" @click="pickPhotoFile" />
        <Button size="small" icon="pi pi-save" label="保存照片" :disabled="!photoDirty" :loading="photoSaving" @click="savePhotoFile" />
        <Button v-if="photoPreviewPath" size="small" text severity="secondary" icon="pi pi-times" label="移除照片" @click="clearPhotoFile" />
        <span v-if="photoDirty" class="text-xs text-[var(--content-text-secondary)]">照片已变更，保存后会自动复制到资源库</span>
        <span v-else class="text-xs text-[var(--content-text-secondary)]">支持 JPG、PNG、WEBP、BMP</span>
      </div>

      <div class="flex items-center justify-center rounded-xl border border-[var(--content-border)] bg-[var(--sidebar-bg)] p-4">
        <img
          v-if="photoPreviewUrl"
          :src="photoPreviewUrl"
          :alt="`${personnel?.name || '员工'}照片预览`"
          class="max-h-[72vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
        />
        <div v-else class="flex min-h-[360px] w-full items-center justify-center">
          <div class="flex h-40 w-40 items-center justify-center rounded-[2rem] border border-dashed border-[var(--content-border)] bg-[var(--content-card-bg)] text-4xl font-semibold tracking-wide text-[var(--content-text-secondary)]">
            {{ photoFallbackText }}
          </div>
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="draftReviewVisible" modal header="确认回填内容" :style="{ width: '680px', maxWidth: '92vw' }">
    <div class="space-y-4">
      <div class="text-sm text-[var(--content-text-secondary)]">
        请先确认本次将写入员工档案的内容，确认后才会执行回填。
      </div>
      <div class="rounded-lg border border-[var(--content-border)] overflow-hidden">
        <div class="grid grid-cols-[140px_1fr_1fr] bg-[var(--sidebar-bg)] text-xs font-bold uppercase tracking-wider text-[var(--content-text-secondary)]">
          <div class="px-4 py-3 border-r border-[var(--content-border)]">字段</div>
          <div class="px-4 py-3 border-r border-[var(--content-border)]">当前值</div>
          <div class="px-4 py-3">即将回填</div>
        </div>
        <div v-if="draftReviewItems.length">
          <div
            v-for="item in draftReviewItems"
            :key="item.key"
            class="grid grid-cols-[140px_1fr_1fr] border-t border-[var(--content-border)] text-sm"
          >
            <div class="px-4 py-3 border-r border-[var(--content-border)] font-medium text-[var(--content-text)]">{{ item.label }}</div>
            <div class="px-4 py-3 border-r border-[var(--content-border)] text-[var(--content-text-secondary)] break-all">{{ item.currentValue || '-' }}</div>
            <div class="px-4 py-3 text-[var(--content-text)] break-all">{{ item.nextValue || '-' }}</div>
          </div>
        </div>
        <div v-else class="px-4 py-6 text-sm text-[var(--content-text-secondary)]">
          当前证件没有可回填的有效字段。
        </div>
      </div>
      <div v-if="selectedDraftDocument" class="text-xs text-[var(--content-text-secondary)]">
        来源证件：{{ selectedDraftDocument.doc_name || formatDocumentType(selectedDraftDocument.doc_type) }}
      </div>
      <div class="flex items-center justify-end gap-2 pt-2">
        <Button size="small" text label="取消" @click="draftReviewVisible = false" />
        <Button size="small" severity="secondary" text label="忽略本次回填" @click="handleRejectDraftFromReview" />
        <Button size="small" label="确认回填" :disabled="!draftReviewItems.length" @click="confirmApplyDocumentDraft" />
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="resumeDetailVisible" modal header="简历详情" :style="{ width: '78vw', maxWidth: '1100px' }">
    <div class="h-[72vh] overflow-auto custom-scrollbar pr-1">
      <div class="space-y-5">
        <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-5">
          <div class="text-[10px] font-bold uppercase tracking-widest text-[var(--content-text-secondary)]">工作经历摘要</div>
          <div class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--content-text)]">{{ personnel?.work_experience || '-' }}</div>
        </section>

        <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-5">
          <div class="text-[10px] font-bold uppercase tracking-widest text-[var(--content-text-secondary)]">备注</div>
          <div class="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--content-text)]">{{ personnel?.remark || '-' }}</div>
        </section>

        <section class="rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] p-5">
          <div class="text-[10px] font-bold uppercase tracking-widest text-[var(--content-text-secondary)]">简历详情</div>
          <div
            v-if="personnel?.resume_text"
            class="resume-markdown mt-3 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-4 text-sm leading-7 text-[var(--content-text)]"
            v-html="renderedResumeTextHtml"
          ></div>
          <div
            v-else
            class="mt-3 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--content-border)] p-4 text-sm leading-7 text-[var(--content-text-secondary)]"
          >
            -
          </div>
        </section>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="documentProcessingVisible"
    modal
    header="正在处理证件"
    :closable="false"
    :closeOnEscape="false"
    :draggable="false"
    :style="{ width: '420px', maxWidth: '92vw' }"
  >
    <div class="flex flex-col items-center justify-center py-6 text-center">
      <ProgressSpinner style="width: 56px; height: 56px" strokeWidth="4" />
      <div class="mt-4 text-base font-semibold text-[var(--content-text)]">
        {{ documentProcessingTitle }}
      </div>
      <div class="mt-2 text-sm text-[var(--content-text-secondary)] leading-6">
        {{ documentProcessingMessage }}
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import ProgressSpinner from 'primevue/progressspinner';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { renderContractSummaryToHtml } from '../../../../utils/contractSummaryMarkdown';
import { copyTextToClipboard } from '../../contract-files/contractFilesHelpers';
import ContractFilesPreviewPane from '../../contract-files/components/ContractFilesPreviewPane.vue';
import { getPersonnelPhotoFallbackText, resolvePersonnelPhotoUrl } from '../personnelPhoto';
import type { Personnel, PersonnelDocument, PersonnelDocumentType } from '../../../../../shared/types/personnel.types';

type DraftReviewItem = {
  key: string;
  label: string;
  currentValue: string;
  nextValue: string;
};

const InfoField = defineComponent({
  name: 'InfoField',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '' },
    copyable: { type: Boolean, default: false },
    multiline: { type: Boolean, default: false },
  },
  setup(props) {
    const toast = useToast();
    const handleCopy = async () => {
      const text = String(props.value || '').trim();
      if (!text) {
        toast.add({ severity: 'info', summary: '提示', detail: `${props.label}为空，无法复制`, life: 2000 });
        return;
      }
      const ok = await copyTextToClipboard(text);
      toast.add({
        severity: ok ? 'success' : 'warn',
        summary: ok ? '已复制' : '复制失败',
        detail: ok ? `${props.label}已复制到剪贴板` : `无法复制${props.label}`,
        life: 2200,
      });
    };
    return () =>
      h('div', { class: 'space-y-1 min-w-0' }, [
        h('label', { class: 'block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest' }, props.label),
        h('div', { class: 'flex items-start gap-1' }, [
          h(
            'p',
            {
              class: [
                'font-semibold text-[var(--content-text)] break-all flex-1',
                props.multiline ? 'whitespace-pre-wrap leading-relaxed' : '',
              ].join(' ').trim(),
            },
            props.value || '-',
          ),
          props.copyable
            ? h(Button, {
              icon: 'pi pi-copy',
              size: 'small',
              text: true,
              severity: 'secondary',
              onClick: handleCopy,
            })
            : null,
        ]),
      ]);
  },
});

const props = defineProps<{
  modelValue: boolean;
  personnelData: Personnel | null;
  hasPrevious?: boolean;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', personnel: Personnel): void;
  (e: 'navigate-previous'): void;
  (e: 'navigate-next'): void;
  (e: 'updated', personnel: Personnel): void;
}>();

const toast = useToast();
const confirm = useConfirm();
const visible = ref(props.modelValue);
const personnel = ref<Personnel | null>(props.personnelData);
const photoDraftPath = ref('');
const photoSaving = ref(false);
const documents = ref<PersonnelDocument[]>([]);
const libraryPath = ref('');

const photoViewerVisible = ref(false);
const documentViewerVisible = ref(false);
const activeDocIndex = ref(0);
const activeDocFileIndex = ref(0);
const draftReviewVisible = ref(false);
const selectedDraftDocument = ref<PersonnelDocument | null>(null);
const resumeDetailVisible = ref(false);
const documentProcessingVisible = ref(false);
const documentProcessingTitle = ref('正在处理证件');
const documentProcessingMessage = ref('正在准备上传文件，请稍候。');

const formatDocumentType = (docType: PersonnelDocumentType) => {
  if (docType === 'id_card') return '身份证';
  if (docType === 'diploma') return '毕业证';
  return '其他证件';
};

const normalizePath = (value: string) => value.replace(/\\/g, '/');
const resolveDocumentFilePath = (relativePath?: string) => {
  const rel = String(relativePath || '').trim();
  if (!rel) return '';
  if (/^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith('/')) return rel;
  const base = String(libraryPath.value || '').trim();
  if (!base) return '';
  return `${normalizePath(base)}/${normalizePath(rel)}`;
};

const toFileUrl = (filePath?: string) => {
  const resolved = String(filePath || '').trim();
  if (!resolved) return '';
  const normalized = resolved.replace(/\\/g, '/');
  return normalized.startsWith('file://') ? normalized : `file:///${normalized.replace(/^\/+/, '')}`;
};

const isImageFile = (filePath?: string) => /\.(png|jpe?g|webp|bmp|gif)$/i.test(String(filePath || ''));
const getFileStem = (filePath: string) => {
  const normalized = String(filePath || '').trim();
  if (!normalized) return '';
  const fileName = normalized.split(/[\\/]/).pop() || normalized;
  return fileName.replace(/\.[^.]+$/, '').trim();
};

const activeDocument = computed(() => documents.value[activeDocIndex.value] || null);
const activeDocumentTitle = computed(() => activeDocument.value?.doc_name || '证件预览');
const activeDocumentFilePath = computed(() => {
  const doc = activeDocument.value;
  return doc ? resolveDocumentFilePath(doc.file_paths?.[activeDocFileIndex.value]) : '';
});
const activeDocumentDisplayName = computed(() => {
  const doc = activeDocument.value;
  if (!doc) return '证件预览';
  const rawPath = String(doc.file_paths?.[activeDocFileIndex.value] || '').trim();
  return rawPath.split(/[\\/]/).pop() || doc.doc_name || '证件预览';
});
const getDocumentPreviewUrl = (doc: PersonnelDocument) => {
  const previewPath = resolveDocumentFilePath(doc.preview_image_path || doc.file_paths?.[0]);
  if (!previewPath || !isImageFile(previewPath)) return '';
  return toFileUrl(previewPath);
};

const parseDocumentDraft = (doc: PersonnelDocument | null | undefined) => {
  let patch: Record<string, unknown> = {};
  try {
    patch = JSON.parse(String(doc?.ai_extract_json || '{}'));
  } catch {
    patch = {};
  }
  return {
    id_card_number: String(patch.id_card_number || '').trim() || '',
    address: String(patch.address || '').trim() || '',
    birth_date: String(patch.birth_date || '').trim() || '',
    graduate_school: String(patch.graduate_school || '').trim() || '',
    education: String(patch.education || '').trim() || '',
  };
};

const draftReviewItems = computed<DraftReviewItem[]>(() => {
  const draft = parseDocumentDraft(selectedDraftDocument.value);
  const currentPersonnel = personnel.value;
  if (!currentPersonnel) return [];
  const candidates: DraftReviewItem[] = [
    {
      key: 'id_card_number',
      label: '身份证号',
      currentValue: String(currentPersonnel.id_card_number || '').trim(),
      nextValue: draft.id_card_number,
    },
    {
      key: 'address',
      label: '地址',
      currentValue: String(currentPersonnel.address || '').trim(),
      nextValue: draft.address,
    },
    {
      key: 'birth_date',
      label: '出生日期',
      currentValue: String(currentPersonnel.birth_date || '').trim(),
      nextValue: draft.birth_date,
    },
    {
      key: 'graduate_school',
      label: '毕业院校',
      currentValue: String(currentPersonnel.graduate_school || '').trim(),
      nextValue: draft.graduate_school,
    },
    {
      key: 'education',
      label: '学历',
      currentValue: String(currentPersonnel.education || '').trim(),
      nextValue: draft.education,
    },
  ];
  return candidates.filter(item => item.nextValue);
});

const hasDocumentDraftContent = (doc: PersonnelDocument | null | undefined) => {
  const draft = parseDocumentDraft(doc);
  return Boolean(
    draft.id_card_number
    || draft.address
    || draft.birth_date
    || draft.graduate_school
    || draft.education
  );
};

const loadLibraryPath = async () => {
  const res = await window.electronAPI.bootstrap.getInitStatus();
  const pathValue = String((res as any)?.data?.projectPath || (res as any)?.data?.libraryPath || '').trim();
  libraryPath.value = pathValue;
};

const loadDocuments = async () => {
  const personnelId = String(personnel.value?.id || '').trim();
  if (!personnelId) {
    documents.value = [];
    return;
  }
  const res = await window.electronAPI.personnel.listDocuments(personnelId);
  documents.value = res.success && Array.isArray(res.data) ? res.data : [];
};

const pickAndUploadDocument = async (docType: PersonnelDocumentType) => {
  if (!personnel.value) return;
  const selected = await window.electronAPI.fs.selectFile({
    title: `选择${formatDocumentType(docType)}文件`,
    properties: ['openFile', 'multiSelections'],
  });
  const filePaths = Array.isArray((selected as any)?.data?.filePaths) ? (selected as any).data.filePaths as string[] : [];
  if (!filePaths.length) return;
  const manualDocName = docType === 'other'
    ? (getFileStem(filePaths[0]) || '其他证件')
    : '';
  documentProcessingTitle.value = `正在处理${formatDocumentType(docType)}`;
  documentProcessingMessage.value = filePaths.length > 1
    ? '正在复制文件、生成预览并解析证件内容，请稍候。'
    : '正在复制文件、生成预览并解析证件内容，请稍候。';
  documentProcessingVisible.value = true;
  try {
    const res = await window.electronAPI.personnel.addDocuments({
      personnelId: personnel.value.id,
      docType,
      localFilePaths: filePaths,
      manualDocName,
    });
    if (!res.success) {
      toast.add({ severity: 'error', summary: '上传失败', detail: res.error || '证件上传失败', life: 3000 });
      return;
    }
    documentProcessingMessage.value = '证件处理完成，正在刷新列表。';
    await loadDocuments();
    toast.add({ severity: 'success', summary: '上传成功', detail: '证件已入库并完成AI解析', life: 2500 });
    const createdDocumentId = String(res.data?.document?.id || '').trim();
    if (createdDocumentId) {
      const createdDoc = documents.value.find(item => item.id === createdDocumentId) || null;
      if (createdDoc && createdDoc.ai_fill_status === 'pending' && hasDocumentDraftContent(createdDoc)) {
        selectedDraftDocument.value = createdDoc;
        draftReviewVisible.value = true;
      }
    }
  } finally {
    documentProcessingVisible.value = false;
  }
};

const removeDocument = async (doc: PersonnelDocument) => {
  confirm.require({
    header: '确认删除',
    message: `确定删除证件“${doc.doc_name || formatDocumentType(doc.doc_type)}”吗？`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: '取消',
    acceptLabel: '删除',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const res = await window.electronAPI.personnel.deleteDocument(doc.id);
      if (!res.success) {
        toast.add({ severity: 'error', summary: '删除失败', detail: res.error || '删除证件失败', life: 2500 });
        return;
      }
      await loadDocuments();
      toast.add({ severity: 'success', summary: '删除成功', detail: '证件已删除', life: 2000 });
    },
  });
};

const setPrimaryDocument = async (doc: PersonnelDocument) => {
  const res = await window.electronAPI.personnel.updateDocument({ id: doc.id, is_primary: 1 });
  if (!res.success) return;
  await loadDocuments();
};

const openDocumentFile = async (relativePath?: string) => {
  const filePath = resolveDocumentFilePath(relativePath);
  if (!filePath) return;
  await window.electronAPI.fs.openFile(filePath);
};

const copyDocumentFileToClipboard = async (doc: PersonnelDocument) => {
  const relativePath = doc.preview_image_path || doc.file_paths?.[0];
  const filePath = resolveDocumentFilePath(relativePath);
  if (!filePath) return;
  const res = await window.electronAPI.fs.clipboardWriteFile(filePath);
  toast.add({
    severity: res.success ? 'success' : 'warn',
    summary: res.success ? '已复制' : '复制失败',
    detail: res.success ? '文件已放入剪贴板，可到微信中粘贴发送' : (res.error || '无法复制到剪贴板'),
    life: 3000,
  });
};

const applyDocumentDraft = async (doc: PersonnelDocument) => {
  selectedDraftDocument.value = doc;
  draftReviewVisible.value = true;
};

const confirmApplyDocumentDraft = async () => {
  const doc = selectedDraftDocument.value;
  if (!doc) return;
  const patch = parseDocumentDraft(doc);
  const res = await window.electronAPI.personnel.applyDocumentDraft({
    documentId: doc.id,
    approvedPatch: {
      id_card_number: patch.id_card_number || undefined,
      address: patch.address || undefined,
      birth_date: patch.birth_date || undefined,
      graduate_school: patch.graduate_school || undefined,
      education: patch.education || undefined,
    },
  });
  if (res.success && res.data) {
    personnel.value = res.data;
    draftReviewVisible.value = false;
    selectedDraftDocument.value = null;
    await loadDocuments();
    toast.add({ severity: 'success', summary: '回填成功', detail: '证件字段已回填员工档案', life: 2500 });
    return;
  }
  toast.add({ severity: 'error', summary: '回填失败', detail: res.error || '证件字段回填失败', life: 2500 });
};

const rejectDocumentDraft = async (documentId: string) => {
  const res = await window.electronAPI.personnel.rejectDocumentDraft(documentId);
  if (!res.success) return;
  await loadDocuments();
};

const handleRejectDraftFromReview = async () => {
  const doc = selectedDraftDocument.value;
  if (!doc) return;
  const res = await window.electronAPI.personnel.rejectDocumentDraft(doc.id);
  if (!res.success) {
    toast.add({ severity: 'error', summary: '操作失败', detail: res.error || '忽略回填失败', life: 2500 });
    return;
  }
  draftReviewVisible.value = false;
  selectedDraftDocument.value = null;
  await loadDocuments();
  toast.add({ severity: 'success', summary: '已忽略', detail: '本次回填已忽略', life: 2000 });
};

const openDocumentViewer = (docIndex: number, fileIndex: number) => {
  activeDocIndex.value = docIndex;
  activeDocFileIndex.value = fileIndex;
  documentViewerVisible.value = true;
};

const prevDocumentImage = () => {
  if (!documents.value.length) return;
  activeDocIndex.value = (activeDocIndex.value - 1 + documents.value.length) % documents.value.length;
  activeDocFileIndex.value = 0;
};

const nextDocumentImage = () => {
  if (!documents.value.length) return;
  activeDocIndex.value = (activeDocIndex.value + 1) % documents.value.length;
  activeDocFileIndex.value = 0;
};

watch(
  () => props.modelValue,
  (value) => {
    visible.value = value;
  },
);

watch(visible, (value) => {
  emit('update:modelValue', value);
});

watch(draftReviewVisible, (value) => {
  if (!value) {
    selectedDraftDocument.value = null;
  }
});

watch(
  () => props.personnelData,
  (value) => {
    personnel.value = value;
    resetPhotoDraft(value);
    void loadDocuments();
  },
  { deep: true },
);

const statusSeverity = computed(() => {
  switch (personnel.value?.status) {
    case '在职':
      return 'success';
    case '离职':
      return 'danger';
    case '休假':
      return 'warn';
    default:
      return 'info';
  }
});

const formatMoney = (value?: number | null, currency?: string) => {
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

const salarySummary = computed(() => {
  if (!personnel.value) return '-';
  const monthly = formatMoney(personnel.value.salary_monthly, personnel.value.salary_currency);
  const base = formatMoney(personnel.value.salary_base, personnel.value.salary_currency);
  if (monthly !== '-') return `月薪 ${monthly}`;
  if (base !== '-') return `底薪 ${base}`;
  return '-';
});

const companySummary = computed(() => {
  const names = Array.isArray(personnel.value?.department_names) ? personnel.value!.department_names.filter(Boolean) : [];
  return names.join(' / ');
});

const getFileName = (filePath?: string | null) => {
  const normalized = String(filePath || '').trim();
  if (!normalized) return '源文件';
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || normalized;
};

const resumeFileName = computed(() => getFileName(personnel.value?.resume_file_path));
const resumePreviewPath = computed(() => String(personnel.value?.resume_file_path || '').trim());
const photoPreviewPath = computed(() => String(photoDraftPath.value || personnel.value?.photo_file_path || '').trim());
const photoPreviewUrl = computed(() => resolvePersonnelPhotoUrl(photoPreviewPath.value));
const photoFallbackText = computed(() => getPersonnelPhotoFallbackText(personnel.value?.name));
const photoDirty = computed(() => {
  const current = String(personnel.value?.photo_file_path || '').trim();
  const draft = String(photoDraftPath.value || '').trim();
  return draft !== current;
});
const previewDockTitle = computed(() => '放到详情左侧');
const previewDockIconClass = computed(() => 'pi pi-arrow-left');

const resetPhotoDraft = (value?: Personnel | null) => {
  photoDraftPath.value = String(value?.photo_file_path || '').trim();
};

const openPhotoViewer = () => {
  photoViewerVisible.value = true;
};

const renderedResumeTextHtml = computed(() => {
  const markdown = String(personnel.value?.resume_text || '').trim();
  if (!markdown) return '<p>-</p>';
  return renderContractSummaryToHtml(markdown) || '<p>-</p>';
});

type PreviewPanelResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const DETAIL_DRAWER_WIDTH = 560;
const PREVIEW_PANEL_MARGIN = 16;
const PREVIEW_PANEL_MIN_WIDTH = 360;
const PREVIEW_PANEL_MIN_HEIGHT = 280;

const previewVisible = ref(false);
const previewFullscreen = ref(false);
const previewZIndex = ref(1200);
const previewPanelRect = reactive({
  x: PREVIEW_PANEL_MARGIN,
  y: PREVIEW_PANEL_MARGIN,
  width: 680,
  height: 720,
});

let previousPreviewRect: null | { x: number; y: number; width: number; height: number } = null;

const getViewportSize = () => ({
  width: window.innerWidth || document.documentElement.clientWidth || 1280,
  height: window.innerHeight || document.documentElement.clientHeight || 800,
});

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

const applyPreviewPanelRect = (next: { x: number; y: number; width: number; height: number }) => {
  const viewport = getViewportSize();
  const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, viewport.width - PREVIEW_PANEL_MARGIN * 2);
  const maxHeight = Math.max(PREVIEW_PANEL_MIN_HEIGHT, viewport.height - PREVIEW_PANEL_MARGIN * 2);
  const width = clampNumber(next.width, PREVIEW_PANEL_MIN_WIDTH, maxWidth);
  const height = clampNumber(next.height, PREVIEW_PANEL_MIN_HEIGHT, maxHeight);
  previewPanelRect.x = clampNumber(next.x, PREVIEW_PANEL_MARGIN, viewport.width - PREVIEW_PANEL_MARGIN - width);
  previewPanelRect.y = clampNumber(next.y, PREVIEW_PANEL_MARGIN, viewport.height - PREVIEW_PANEL_MARGIN - height);
  previewPanelRect.width = width;
  previewPanelRect.height = height;
};

const computePreviewZIndex = () => {
  const masks = Array.from(document.querySelectorAll<HTMLElement>('.p-dialog-mask, .p-drawer-mask, .p-overlay-mask, .p-component-overlay'));
  const overlayMax = masks.reduce((max, element) => {
    const zIndex = Number(window.getComputedStyle(element).zIndex || 0);
    return Number.isFinite(zIndex) ? Math.max(max, zIndex) : max;
  }, 1100);
  return overlayMax + 20;
};

const resetPreviewPanelLayout = () => {
  const viewport = getViewportSize();
  const width = Math.min(820, Math.max(PREVIEW_PANEL_MIN_WIDTH, Math.round(viewport.width * 0.36)));
  const height = Math.min(
    Math.max(PREVIEW_PANEL_MIN_HEIGHT, viewport.height - 120),
    Math.max(PREVIEW_PANEL_MIN_HEIGHT, Math.round(viewport.height * 0.78)),
  );
  applyPreviewPanelRect({
    x: Math.max(PREVIEW_PANEL_MARGIN, viewport.width - DETAIL_DRAWER_WIDTH - width - 24),
    y: Math.max(PREVIEW_PANEL_MARGIN, Math.round((viewport.height - height) / 2)),
    width,
    height,
  });
};

const previewPanelStyle = computed(() => ({
  left: `${previewPanelRect.x}px`,
  top: `${previewPanelRect.y}px`,
  width: `${previewPanelRect.width}px`,
  height: `${previewPanelRect.height}px`,
}));

const bringPreviewToFront = () => {
  previewZIndex.value = computePreviewZIndex();
};

const openResumePreview = () => {
  if (!resumePreviewPath.value) return;
  previewVisible.value = true;
  bringPreviewToFront();
  if (previewFullscreen.value) return;
  resetPreviewPanelLayout();
};

const closeResumePreview = () => {
  previewVisible.value = false;
  previewFullscreen.value = false;
  previousPreviewRect = null;
};

const togglePreviewFullscreen = () => {
  if (!previewVisible.value) return;
  bringPreviewToFront();
  if (previewFullscreen.value) {
    previewFullscreen.value = false;
    if (previousPreviewRect) {
      applyPreviewPanelRect(previousPreviewRect);
    } else {
      resetPreviewPanelLayout();
    }
    return;
  }
  previousPreviewRect = {
    x: previewPanelRect.x,
    y: previewPanelRect.y,
    width: previewPanelRect.width,
    height: previewPanelRect.height,
  };
  previewFullscreen.value = true;
  const viewport = getViewportSize();
  applyPreviewPanelRect({
    x: PREVIEW_PANEL_MARGIN,
    y: PREVIEW_PANEL_MARGIN,
    width: viewport.width - PREVIEW_PANEL_MARGIN * 2,
    height: viewport.height - PREVIEW_PANEL_MARGIN * 2,
  });
};

const bindPointerMove = (onMove: (event: MouseEvent) => void, onEnd?: () => void) => {
  const handleMove = (event: MouseEvent) => {
    event.preventDefault();
    onMove(event);
  };
  const handleUp = () => {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
    onEnd?.();
  };
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
};

const startPreviewDrag = (event: MouseEvent) => {
  if (!previewVisible.value || previewFullscreen.value) return;
  event.preventDefault();
  bringPreviewToFront();
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = {
    x: previewPanelRect.x,
    y: previewPanelRect.y,
    width: previewPanelRect.width,
    height: previewPanelRect.height,
  };
  bindPointerMove((moveEvent) => {
    applyPreviewPanelRect({
      ...origin,
      x: origin.x + (moveEvent.clientX - startX),
      y: origin.y + (moveEvent.clientY - startY),
    });
  });
};

const startPreviewResize = (direction: PreviewPanelResizeDirection, event: MouseEvent) => {
  if (!previewVisible.value || previewFullscreen.value) return;
  event.preventDefault();
  event.stopPropagation();
  bringPreviewToFront();
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = {
    x: previewPanelRect.x,
    y: previewPanelRect.y,
    width: previewPanelRect.width,
    height: previewPanelRect.height,
  };
  bindPointerMove((moveEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    const next = { ...origin };
    if (direction.includes('e')) next.width = origin.width + dx;
    if (direction.includes('s')) next.height = origin.height + dy;
    if (direction.includes('w')) {
      next.x = origin.x + dx;
      next.width = origin.width - dx;
    }
    if (direction.includes('n')) {
      next.y = origin.y + dy;
      next.height = origin.height - dy;
    }
    applyPreviewPanelRect(next);
  });
};

const handleWindowResize = () => {
  if (!previewVisible.value) return;
  bringPreviewToFront();
  if (previewFullscreen.value) {
    const viewport = getViewportSize();
    applyPreviewPanelRect({
      x: PREVIEW_PANEL_MARGIN,
      y: PREVIEW_PANEL_MARGIN,
      width: viewport.width - PREVIEW_PANEL_MARGIN * 2,
      height: viewport.height - PREVIEW_PANEL_MARGIN * 2,
    });
    return;
  }
  applyPreviewPanelRect({
    x: previewPanelRect.x,
    y: previewPanelRect.y,
    width: previewPanelRect.width,
    height: previewPanelRect.height,
  });
};

const copyResumeFileName = async () => {
  const fileName = resumeFileName.value;
  if (!fileName || fileName === '源文件') return;
  const ok = await copyTextToClipboard(fileName);
  toast.add({
    severity: ok ? 'success' : 'warn',
    summary: ok ? '已复制' : '复制失败',
    detail: ok ? '文件名已复制到剪贴板' : '无法复制文件名',
    life: 2500,
  });
};

const copyResumeFileToClipboard = async () => {
  const filePath = String(personnel.value?.resume_file_path || '').trim();
  if (!filePath) return;
  const res = await window.electronAPI.fs.clipboardWriteFile(filePath);
  toast.add({
    severity: res.success ? 'success' : 'warn',
    summary: res.success ? '已复制' : '复制失败',
    detail: res.success ? '简历源文件已写入剪贴板' : (res.error || '无法复制文件到剪贴板'),
    life: 3000,
  });
};

const pickPhotoFile = async () => {
  try {
    const selected = await window.electronAPI.fs.selectFile({
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });
    if (!selected.success || !selected.data) {
      throw new Error(selected.error || '选择照片失败');
    }
    if ((selected.data as any).canceled) return;
    const filePath = String((selected.data as any).filePaths?.[0] || '').trim();
    if (!filePath) return;
    photoDraftPath.value = filePath;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: '选择照片失败',
      detail: String(error?.message || '').trim() || '请稍后重试',
      life: 3000,
    });
  }
};

const clearPhotoFile = () => {
  photoDraftPath.value = '';
};

const savePhotoFile = async () => {
  if (!personnel.value || !photoDirty.value) return;
  photoSaving.value = true;
  try {
    const res = await window.electronAPI.personnel.update({
      id: personnel.value.id,
      photo_file_path: photoPreviewPath.value,
    });
    if (!res.success || !res.data) {
      toast.add({ severity: 'error', summary: '保存失败', detail: res.error || '照片保存失败', life: 3000 });
      return;
    }
    personnel.value = res.data;
    resetPhotoDraft(res.data);
    emit('updated', res.data);
    toast.add({ severity: 'success', summary: '保存成功', detail: '员工照片已更新', life: 2500 });
  } finally {
    photoSaving.value = false;
  }
};

const copyPersonnelCoreInfo = async () => {
  if (!personnel.value) return;
  const name = String(personnel.value.name || '').trim();
  const phone = String(personnel.value.phone || '').trim();
  const email = String(personnel.value.email || '').trim();
  const text = `姓名：${name || '-'}\n手机号：${phone || '-'}\n邮箱：${email || '-'}`;
  const ok = await copyTextToClipboard(text);
  toast.add({
    severity: ok ? 'success' : 'warn',
    summary: ok ? '已复制' : '复制失败',
    detail: ok ? '姓名、手机号、邮箱已复制到剪贴板' : '无法复制员工信息',
    life: 2500,
  });
};

const copyPersonnelPhone = async () => {
  const phone = String(personnel.value?.phone || '').trim();
  if (!phone) {
    toast.add({ severity: 'info', summary: '提示', detail: '手机号为空，无法复制', life: 2000 });
    return;
  }
  const ok = await copyTextToClipboard(phone);
  toast.add({
    severity: ok ? 'success' : 'warn',
    summary: ok ? '已复制' : '复制失败',
    detail: ok ? '手机号已复制到剪贴板' : '无法复制手机号',
    life: 2500,
  });
};

watch(
  () => visible.value,
  (value) => {
    if (!value) {
      closeResumePreview();
    }
  },
);

watch(
  () => resumePreviewPath.value,
  (value) => {
    if (!visible.value) return;
    if (!value) {
      closeResumePreview();
    }
  },
);

onMounted(() => {
  void loadLibraryPath();
  void loadDocuments();
  resetPhotoDraft(personnel.value);
  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<style scoped>
.custom-drawer :deep(.p-drawer-content) {
  display: flex;
  flex-direction: column;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--content-border);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--content-text-secondary);
}

.resume-markdown :deep(p) {
  margin: 0 0 0.5rem;
  white-space: pre-wrap;
}

.resume-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.resume-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.resume-markdown :deep(th),
.resume-markdown :deep(td) {
  border: 1px solid var(--content-border);
  padding: 0.375rem 0.5rem;
  text-align: left;
  vertical-align: top;
}

.resume-markdown :deep(th) {
  background: color-mix(in srgb, var(--content-border) 30%, var(--content-bg));
  font-weight: 600;
}

.resume-markdown :deep(ul),
.resume-markdown :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.resume-markdown :deep(li + li) {
  margin-top: 0.25rem;
}

.resume-markdown :deep(code) {
  background: color-mix(in srgb, var(--content-border) 28%, var(--content-bg));
  border-radius: 0.25rem;
  padding: 0.1rem 0.25rem;
}

.preview-resize-handle {
  position: absolute;
  z-index: 5;
}

.preview-resize-handle-n,
.preview-resize-handle-s {
  left: 0.75rem;
  right: 0.75rem;
  height: 0.5rem;
}

.preview-resize-handle-n {
  top: -0.25rem;
  cursor: ns-resize;
}

.preview-resize-handle-s {
  bottom: -0.25rem;
  cursor: ns-resize;
}

.preview-resize-handle-e,
.preview-resize-handle-w {
  top: 0.75rem;
  bottom: 0.75rem;
  width: 0.5rem;
}

.preview-resize-handle-e {
  right: -0.25rem;
  cursor: ew-resize;
}

.preview-resize-handle-w {
  left: -0.25rem;
  cursor: ew-resize;
}

.preview-resize-handle-ne,
.preview-resize-handle-nw,
.preview-resize-handle-se,
.preview-resize-handle-sw {
  width: 0.875rem;
  height: 0.875rem;
}

.preview-resize-handle-ne {
  top: -0.25rem;
  right: -0.25rem;
  cursor: nesw-resize;
}

.preview-resize-handle-nw {
  top: -0.25rem;
  left: -0.25rem;
  cursor: nwse-resize;
}

.preview-resize-handle-se {
  right: -0.25rem;
  bottom: -0.25rem;
  cursor: nwse-resize;
}

.preview-resize-handle-sw {
  left: -0.25rem;
  bottom: -0.25rem;
  cursor: nesw-resize;
}
</style>
