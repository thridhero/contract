<template>
  <Drawer v-model:visible="visible" position="right" class="!w-[1000px] p-0 custom-drawer" :showCloseIcon="false" @hide="onHide">
    <template #header>
      <div class="flex items-center justify-between w-full h-16 px-6 border-b border-[var(--content-border)] bg-[var(--content-bg)]">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-[var(--sidebar-active-bg)] overflow-hidden flex items-center justify-center">
            <img v-if="headerImageSrc" :src="headerImageSrc" class="w-full h-full object-cover" alt="合同图标" />
            <i
              v-else
              :class="headerIconClass"
              class="text-xl leading-none"
              :style="{ color: headerIconColor }"
              aria-hidden="true"
            ></i>
          </div>
          <div>
            <h2 class="text-lg font-bold tracking-tight text-[var(--content-text)]">合同详情</h2>
            <p class=" font-semibold uppercase tracking-widest text-[var(--content-text-secondary)]">Contract Detail View</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            :class="hasPrevious ? 'text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]' : 'text-[var(--content-text-muted)] bg-[var(--content-bg)]/50'"
            title="上一个合同（左方向键）"
            @click="requestNavigatePrevious"
          >
            <i class="pi pi-angle-left"></i>
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            :class="hasNext ? 'text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]' : 'text-[var(--content-text-muted)] bg-[var(--content-bg)]/50'"
            title="下一个合同（右方向键）"
            @click="requestNavigateNext"
          >
            <i class="pi pi-angle-right"></i>
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
            title="编辑合同"
            @click="requestEdit"
          >
            <i class="pi pi-pencil"></i>
          </button>
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

    <div class="flex flex-col h-full bg-[var(--content-bg)]">
      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
        <div v-if="contractLoading" class="flex items-center justify-center py-16 text-[var(--content-text-secondary)]">
          <i class="pi pi-spin pi-spinner mr-2"></i>
          <span class="">正在加载合同详情...</span>
        </div>

        <div v-else-if="contractError" class="py-10">
          <div class="rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] p-6">
            <div class="flex items-center gap-2 text-[var(--content-text)] font-semibold">
              <i class="pi pi-exclamation-triangle text-yellow-500"></i>
              <span>合同详情加载失败</span>
            </div>
            <div class="mt-2  text-[var(--content-text-secondary)] break-words">{{ contractError }}</div>
            <div class="mt-4">
              <Button label="重试" size="small" @click="reloadContract" />
            </div>
          </div>
        </div>

        <template v-else>
          <section class="relative p-4 rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] overflow-hidden">
            <div class="relative z-10 flex justify-between items-start gap-3">
              <!-- 左侧信息区 (B处及常规信息) -->
              <div class="flex-1 min-w-0">
                <span
                  class="inline-block px-2 py-0.5 rounded bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]  font-bold tracking-wider mb-2"
                >
                  编号: {{ displayContractCode }}
                </span>

                <div class="flex items-center gap-2 mb-1">
                  <!-- B处：合同类型标签 -->
                  <Tag v-if="displayContractType !== '-'" :value="displayContractType" severity="info" class="! !px-2 !py-0.5 !rounded-md shrink-0" />
                  <h1 class="text-xl font-black text-[var(--content-text)] tracking-tight truncate" :title="displayContractName">
                    {{ displayContractName }}
                  </h1>
                </div>

                <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2  text-[var(--content-text-secondary)]">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-calendar"></i>
                    <span>{{ displaySigningDate }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-building"></i>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 min-w-0 truncate text-left text-[var(--btn-primary-bg)] hover:underline disabled:text-[var(--content-text-secondary)] disabled:hover:no-underline disabled:cursor-not-allowed"
                      :title="displayClientName === '-' ? '暂无甲方单位信息' : '点击查看甲方单位详情'"
                      :disabled="displayClientName === '-' || companyDetailLoading !== null"
                      @click="openPartyADetail"
                    >
                      <span class="truncate">{{ displayClientName }}</span>
                      <i v-if="companyDetailLoading === 'party-a'" class="pi pi-spin pi-spinner text-xs"></i>
                    </button>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-briefcase"></i>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 min-w-0 truncate text-left text-[var(--btn-primary-bg)] hover:underline disabled:text-[var(--content-text-secondary)] disabled:hover:no-underline disabled:cursor-not-allowed"
                      :title="displayPartyBName === '-' ? '暂无乙方单位信息' : '点击查看乙方单位详情'"
                      :disabled="displayPartyBName === '-' || companyDetailLoading !== null"
                      @click="openPartyBDetail"
                    >
                      <span class="truncate">{{ displayPartyBName }}</span>
                      <i v-if="companyDetailLoading === 'party-b'" class="pi pi-spin pi-spinner text-xs"></i>
                    </button>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-folder"></i>
                    <span>{{ displayGroupName }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-info-circle"></i>
                    <span>{{ displayContractStatus }}</span>
                  </div>
                </div>
              </div>

              <!-- 右侧重要信息区 (A处：金额) -->
              <div class="flex flex-col items-end shrink-0 pt-1 text-right gap-3">
                <div class=" font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-1">合同总额</div>
                <div class="flex items-baseline gap-1.5 text-[var(--btn-primary-bg)]">
                  <span class="text-2xl font-black tabular-nums tracking-tight">{{ displayContractAmount }}</span>
                  <span v-if="displayCurrency !== '-'" class=" font-bold opacity-80">{{ displayCurrency }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-[var(--content-text-secondary)]">
                  <i class="pi pi-file text-[var(--btn-primary-bg)]"></i>
                  <span class="shrink-0">源文件：</span>
                  <button
                    type="button"
                    class="min-w-0 truncate max-w-[220px] text-[var(--btn-primary-bg)] hover:underline disabled:text-[var(--content-text-muted)] disabled:hover:no-underline"
                    :title="hasSourcePdf ? displaySourcePdfName : (sourcePdfMetaError || '未找到源文件')"
                    :disabled="!hasSourcePdf || sourcePdfMetaLoading"
                    @click="handleOpenSourcePdfPreview"
                  >
                    {{ sourcePdfMetaLoading ? '正在加载...' : (hasSourcePdf ? displaySourcePdfName : '未找到源文件') }}
                  </button>
                  <button
                    type="button"
                    class="w-6 h-6 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--content-text-secondary)]"
                    title="复制文件名"
                    :disabled="!hasSourcePdf || sourcePdfMetaLoading"
                    @click="copySourcePdfName"
                  >
                    <i class="pi pi-copy text-xs"></i>
                  </button>
                  <button
                    type="button"
                    class="w-6 h-6 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--content-text-secondary)]"
                    title="复制文件（可粘贴发送）"
                    :disabled="!hasSourcePdf || sourcePdfMetaLoading || copyingSourcePdfFile"
                    @click="copySourcePdfFile"
                  >
                    <i :class="copyingSourcePdfFile ? 'pi pi-spin pi-spinner text-xs' : 'pi pi-clone text-xs'"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="absolute -right-5 -bottom-5 w-28 h-28 bg-[var(--btn-primary-bg)] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
          </section>

          <div class="grid grid-cols-2 gap-3">
            <!-- 时间进度 -->
            <div class="p-3 rounded-lg bg-[var(--content-card-bg)] border border-[var(--content-border)] flex flex-col justify-center gap-2">
              <div class="flex items-center justify-between ">
                <span class="font-bold text-[var(--content-text-secondary)]">时间进度</span>
                <span class="text-[var(--content-text)] font-black tabular-nums">{{ timeProgress !== null ? timeProgress + '%' : '-' }}</span>
              </div>
              <div class="h-2 w-full bg-[var(--content-border)] rounded-full overflow-hidden">
                <div v-if="timeProgress !== null" class="h-full bg-blue-500 rounded-full transition-all duration-500" :style="{ width: timeProgress + '%' }"></div>
              </div>
              <div class="flex items-center justify-between text-[10px] font-bold text-[var(--content-text-muted)] tracking-widest uppercase">
                <span>起: {{ displayStartDate }}</span>
                <span>止: {{ displayEndDate }}</span>
              </div>
            </div>

            <!-- 金额进度 -->
            <div class="p-3 rounded-lg bg-[var(--content-card-bg)] border border-[var(--content-border)] flex flex-col justify-center gap-2">
              <div class="flex items-center justify-between ">
                <span class="font-bold text-[var(--content-text-secondary)]">收付进度 (已办理: {{ formatMoney(filteredReceiptPlans.reduce((sum, p) => sum + (Number((p as any).received_amount) || 0), 0)) }})</span>
                <span class="text-[var(--content-text)] font-black tabular-nums">{{ amountProgress !== null ? amountProgress + '%' : '-' }}</span>
              </div>
              <div class="h-2 w-full bg-[var(--content-border)] rounded-full overflow-hidden">
                <div v-if="amountProgress !== null" class="h-full bg-green-500 rounded-full transition-all duration-500" :style="{ width: amountProgress + '%' }"></div>
              </div>
              <div class="flex items-center justify-between text-[10px] font-bold text-[var(--content-text-muted)] tracking-widest uppercase">
                <span>0</span>
                <span>总额: {{ displayContractAmount }}</span>
              </div>
            </div>

            <div class="col-span-2 p-3 rounded-lg bg-[var(--content-card-bg)] border border-[var(--content-border)] flex items-center justify-between">
              <div class="flex-1 flex flex-col pr-3 border-r border-[var(--content-border)]">
                <div class="flex items-center gap-2 mb-1">
                  <i class="pi pi-building text-[var(--content-text-secondary)] "></i>
                  <label class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">甲方单位</label>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 w-fit max-w-full font-semibold text-[var(--btn-primary-bg)] truncate hover:underline disabled:text-[var(--content-text)] disabled:hover:no-underline disabled:cursor-not-allowed"
                  :title="displayClientName === '-' ? '暂无甲方单位信息' : '点击查看甲方单位详情'"
                  :disabled="displayClientName === '-' || companyDetailLoading !== null"
                  @click="openPartyADetail"
                >
                  <span class="truncate">{{ displayClientName }}</span>
                  <i v-if="companyDetailLoading === 'party-a'" class="pi pi-spin pi-spinner text-xs"></i>
                </button>
                <div class="flex items-center gap-2 mt-1.5">
                  <i class="pi pi-user text-[var(--content-text-muted)] "></i>
                  <span class=" text-[var(--content-text-secondary)]">负责人: <span class="font-medium text-[var(--content-text)]">{{ displayPartyAContact }}</span></span>
                </div>
              </div>
              <div class="flex-1 flex flex-col pl-3">
                <div class="flex items-center gap-2 mb-1">
                  <i class="pi pi-briefcase text-[var(--content-text-secondary)] "></i>
                  <label class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">乙方单位</label>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 w-fit max-w-full font-semibold text-[var(--btn-primary-bg)] truncate hover:underline disabled:text-[var(--content-text)] disabled:hover:no-underline disabled:cursor-not-allowed"
                  :title="displayPartyBName === '-' ? '暂无乙方单位信息' : '点击查看乙方单位详情'"
                  :disabled="displayPartyBName === '-' || companyDetailLoading !== null"
                  @click="openPartyBDetail"
                >
                  <span class="truncate">{{ displayPartyBName }}</span>
                  <i v-if="companyDetailLoading === 'party-b'" class="pi pi-spin pi-spinner text-xs"></i>
                </button>
                <div class="flex items-center gap-2 mt-1.5">
                  <i class="pi pi-user text-[var(--content-text-muted)] "></i>
                  <span class=" text-[var(--content-text-secondary)]">负责人: <span class="font-medium text-[var(--content-text)]">{{ displayPartyBContact }}</span></span>
                </div>
              </div>
            </div>

            <div class="col-span-2 p-3 rounded-lg bg-[var(--content-card-bg)] border border-[var(--content-border)] relative">
              <div class="flex items-center justify-between gap-3 mb-2">
                <label class="block text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest">合同摘要</label>
                <button
                  v-if="summaryToggleVisible"
                  type="button"
                  class=" font-semibold text-[var(--btn-primary-bg)] hover:underline shrink-0"
                  @click="summaryExpanded = !summaryExpanded"
                >
                  {{ summaryExpanded ? '收起' : '展开' }}
                </button>
              </div>
              <div
                ref="summaryEl"
                class="summary-markdown text-[var(--content-text)] break-words transition-[max-height] duration-200"
                :class="summaryExpanded ? 'max-h-[45vh] overflow-auto' : 'max-h-20 overflow-hidden'"
                v-html="displayContractSummaryHtml"
              >
              </div>
              <div
                v-if="!summaryExpanded && summaryToggleVisible"
                class="pointer-events-none absolute left-3 right-3 bottom-3 h-8 bg-gradient-to-t from-[var(--content-card-bg)] to-transparent"
              ></div>
            </div>
          </div>

          <section class="rounded-xl bg-[var(--content-card-bg)]">
            <Tabs v-model:value="activeTab">
              <TabList>
                <Tab value="basicInfo">基本信息</Tab>
                <Tab value="executions">合同执行情况</Tab>
                <Tab value="products">合同产品情况</Tab>
                <Tab value="receiptPlans">收付计划</Tab>
              </TabList>

              <TabPanels>
                <TabPanel value="basicInfo">
                  <div class="p-3 space-y-4">
                    <div v-if="detailSections.length > 0 || hasExtendedDetail" class="space-y-4">
                      <section v-for="section in detailSections" :key="section.key" class="space-y-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2 min-w-0 mt-2 mb-2">
                            <span class="h-4 w-1 rounded-full bg-[var(--btn-primary-bg)] shrink-0"></span>
                            <h3 class=" font-black tracking-tight text-[var(--content-text)] truncate">{{ section.title }}</h3>
                          </div>
                          <span class="font-bold uppercase tracking-widest text-[var(--content-text-secondary)] shrink-0">
                            {{ section.fields.length }} 项
                          </span>
                        </div>

                        <div class="grid grid-cols-1 gap-0 md:grid-cols-2 ">
                          <div
                            v-for="field in section.fields"
                            :key="field.key"
                            class="grid grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden bg-[var(--content-bg)] border-0.5 border-[var(--content-border)]"
                            :class="field.span === 2 ? 'md:col-span-2' : ''"
                          >
                            <div
                              class="flex min-h-8 items-center bg-[color-mix(in_srgb,var(--content-border)_30%,var(--content-bg))] px-2.5 py-1.5  text-[var(--content-text-secondary)]"
                            >
                              {{ field.label }}
                            </div>
                            <div
                              class="flex min-h-8 items-center whitespace-pre-wrap break-words bg-[var(--content-bg)] px-3 py-1.5 font-medium leading-[1.4] text-[var(--content-text)]"
                            >
                              {{ formatDetailFieldValue(field.key) }}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section v-if="hasExtendedDetail" class="space-y-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2 min-w-0 mt-2 mb-2">
                            <span class="h-4 w-1 rounded-full bg-[var(--btn-primary-bg)] shrink-0"></span>
                            <h3 class=" font-black tracking-tight text-[var(--content-text)] truncate">{{ extendedDetailTitle }}</h3>
                          </div>
                          <span class="font-bold uppercase tracking-widest text-[var(--content-text-secondary)] shrink-0">
                            {{ extendedDetailFields.length }} 项
                          </span>
                        </div>

                        <div class="grid grid-cols-1 gap-0 md:grid-cols-2 ">
                          <div
                            v-for="field in extendedDetailFields"
                            :key="field.key"
                            class="grid grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden bg-[var(--content-bg)] border-0.5 border-[var(--content-border)]"
                            :class="field.span === 2 ? 'md:col-span-2' : ''"
                          >
                            <div
                              class="flex min-h-8 items-center bg-[color-mix(in_srgb,var(--content-border)_30%,var(--content-bg))] px-2.5 py-1.5  text-[var(--content-text-secondary)]"
                            >
                              {{ field.label }}
                            </div>
                            <div
                              class="flex min-h-8 items-center whitespace-pre-wrap break-words bg-[var(--content-bg)] px-3 py-1.5 font-medium leading-[1.4] text-[var(--content-text)]"
                            >
                              {{ formatDetailFieldValue(field.key) }}
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                    <div v-else class="py-10 text-center  text-[var(--content-text-secondary)]">
                      暂无基础信息
                    </div>
                  </div>
                </TabPanel>
                <TabPanel value="executions">
                  <div class="p-3">
                    <div class="flex items-center justify-between mb-3">
                      <Button icon="pi pi-plus" text rounded size="small" @click="handleAddExecution" title="新增" />
                    </div>
                    <div v-if="executionsLoading" class="flex items-center justify-center py-10 text-[var(--content-text-secondary)]">
                      <i class="pi pi-spin pi-spinner mr-2"></i>
                      <span class="">正在加载合同执行情况...</span>
                    </div>
                    <div v-else-if="executionsError" class="py-6">
                      <div class="rounded-xl bg-[var(--content-bg)] border border-[var(--content-border)] p-4">
                        <div class="flex items-center gap-2 text-[var(--content-text)] font-semibold">
                          <i class="pi pi-exclamation-triangle text-yellow-500"></i>
                          <span>合同执行情况加载失败</span>
                        </div>
                        <div class="mt-2  text-[var(--content-text-secondary)] break-words">{{ executionsError }}</div>
                        <div class="mt-3">
                          <Button label="重试" size="small" @click="loadExecutions(true)" />
                        </div>
                      </div>
                    </div>
                    <div v-else-if="executions.length === 0" class="py-10 text-center  text-[var(--content-text-secondary)]">
                      暂无合同执行记录
                    </div>
                    <Timeline v-else :value="timelineExecutions" class="w-full custom-timeline" aria-label="合同执行情况时间线">
                      <template #marker="{ item }">
                        <span
                          class="flex w-7 h-7 items-center justify-center rounded-full border border-[var(--content-border)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]  font-bold shadow-sm"
                        >
                          <i class="pi pi-circle-fill text-[10px]"></i>
                        </span>
                      </template>
                      <template #content="{ item }">
                        <div class="mb-8">
                          <!-- 日期展示在上方 -->
                          <div class="flex items-center gap-2 mb-2  font-bold text-[var(--content-text-secondary)] tabular-nums">
                            <i class="pi pi-calendar "></i>
                            <span>{{ item.execution_time || item.created_at || '-' }}</span>
                          </div>

                          <div class="rounded-xl bg-[var(--content-bg)] border border-[var(--content-border)] p-5 shadow-sm hover:border-[var(--btn-primary-bg)] transition-colors">
                            <div class="flex flex-wrap items-start justify-between gap-4">
                              <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-3">
                                  <div class=" font-black text-[var(--content-text)] tracking-tight">
                                    {{ item.execution_status || '-' }}
                                  </div>
                                  <div class="flex items-center gap-1">
                                    <Button
                                      icon="pi pi-pencil"
                                      text
                                      rounded
                                      size="small"
                                      class="!p-1 !w-7 !h-7"
                                      @click="handleEditExecution(item)"
                                      title="修改"
                                    />
                                    <Button
                                      icon="pi pi-trash"
                                      text
                                      rounded
                                      severity="danger"
                                      size="small"
                                      class="!p-1 !w-7 !h-7"
                                      @click="handleDeleteExecution(item)"
                                      title="删除"
                                    />
                                  </div>
                                </div>
                                <div class="mt-2 flex items-center gap-2  text-[var(--content-text-secondary)]">
                                  <i class="pi pi-user "></i>
                                  <span>销售/负责人：{{ item.salesperson || '-' }}</span>
                                </div>
                              </div>
                              <div class="px-3 py-1 rounded-full bg-[var(--sidebar-active-bg)]  font-bold text-[var(--btn-primary-bg)] tabular-nums whitespace-nowrap border border-[var(--btn-primary-bg)]/20">
                                进度：{{ item.progress || '-' }}
                              </div>
                            </div>

                            <div class="mt-5 space-y-4">
                              <div>
                                <div class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                  <span class="w-1 h-3 bg-[var(--btn-primary-bg)] rounded-full"></span>
                                  执行内容
                                </div>
                                <div class=" leading-relaxed text-[var(--content-text)] whitespace-pre-wrap break-words">
                                  {{ item.content || '-' }}
                                </div>
                              </div>
                              <div v-if="item.remark">
                                <div class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                  <span class="w-1 h-3 bg-slate-400 rounded-full"></span>
                                  备注
                                </div>
                                <div class=" leading-relaxed text-[var(--content-text-secondary)] whitespace-pre-wrap break-words italic">
                                  {{ item.remark || '-' }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </Timeline>
                  </div>
                </TabPanel>
                <TabPanel value="products">
                  <div class="p-3 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Button icon="pi pi-plus" text rounded size="small" @click="handleAddProduct" title="新增" />
                        <Button
                          icon="pi pi-file-excel"
                          text
                          rounded
                          size="small"
                          severity="secondary"
                          title="Excel 导入映射"
                          @click="handleOpenProductImportDialog"
                        />
                        <Button
                          :label="String(selectedProductCount)"
                          icon="pi pi-trash"
                          text
                          rounded
                          size="small"
                          class="!text-red-500"
                          @click="handleDeleteAllProducts"
                          :title="`批量删除（已勾选 ${selectedProductCount} 条）`"
                        />
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] border border-[var(--content-border)]"
                          @click="handleOpenProductPopup"
                          title="弹窗查看产品"
                        >
                          <i class="pi pi-external-link"></i>
                        </button>
                        <div class="flex items-center gap-1 bg-[var(--content-bg)] rounded-lg p-1 border border-[var(--content-border)]">
                          <button
                            type="button"
                            class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                            :class="productViewMode === 'card' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
                            @click="toggleProductView('card')"
                            title="卡片视图"
                          >
                            <i class="pi pi-th-large"></i>
                          </button>
                          <button
                            type="button"
                            class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                            :class="productViewMode === 'table' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
                            @click="toggleProductView('table')"
                            title="表格视图"
                          >
                            <i class="pi pi-table"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div v-if="productsLoading" class="flex items-center justify-center py-10 text-[var(--content-text-secondary)]">
                      <i class="pi pi-spin pi-spinner mr-2"></i>
                      <span class="">正在加载合同产品情况...</span>
                    </div>
                    <div v-else-if="productsError" class="py-6">
                      <div class="rounded-xl bg-[var(--content-bg)] border border-[var(--content-border)] p-4">
                        <div class="flex items-center gap-2 text-[var(--content-text)] font-semibold">
                          <i class="pi pi-exclamation-triangle text-yellow-500"></i>
                          <span>合同产品情况加载失败</span>
                        </div>
                        <div class="mt-2  text-[var(--content-text-secondary)] break-words">{{ productsError }}</div>
                        <div class="mt-3">
                          <Button label="重试" size="small" @click="loadProducts(true)" />
                        </div>
                      </div>
                    </div>
                    <div v-else-if="products.length === 0" class="py-10 text-center  text-[var(--content-text-secondary)]">
                      暂无合同产品
                    </div>
                    <template v-else>
                      <!-- 概览统计 -->
                      <div class="flex items-center justify-between p-4 rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)]">
                        <div class="flex flex-col">
                          <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">产品种类</span>
                          <span class="text-lg font-black text-[var(--content-text)]">{{ products.length }}</span>
                        </div>
                        <div class="h-8 w-px bg-[var(--content-border)] mx-4"></div>
                        <div class="flex flex-col">
                          <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">总数量</span>
                          <span class="text-lg font-black text-[var(--content-text)] tabular-nums">{{ formatNumber(productsTotalQuantity) }}</span>
                        </div>
                        <div class="h-8 w-px bg-[var(--content-border)] mx-4"></div>
                        <div class="flex flex-col text-right">
                          <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">合同产品总额</span>
                          <span class="text-lg font-black text-[var(--btn-primary-bg)] tabular-nums">{{ formatMoney(productsTotalAmount) }}</span>
                        </div>
                      </div>

                      <ContractProductListPanel
                        :products="products"
                        :filteredProducts="filteredProducts"
                        :productViewMode="productViewMode"
                        :productTableQuery="productTableQuery"
                        :hasProductTableQuery="hasProductTableQuery"
                        :clearProductTableQuery="clearProductTableQuery"
                        :formatMoney="formatMoney"
                        :formatNumber="formatNumber"
                        :showSelection="true"
                        :showActions="true"
                        :selectedProductIds="selectedProductIds"
                        :isAllSelected="isAllProductsSelected"
                        tableClass="custom-datatable p-datatable-sm"
                        tableScrollHeight="360px"
                        @toggle-select="handleProductPanelToggleSelect"
                        @toggle-select-all="toggleSelectAllProducts"
                        @edit="handleEditProduct"
                        @delete="handleDeleteProduct"
                      />
                    </template>
                  </div>
                </TabPanel>
                <TabPanel value="receiptPlans">
                  <div class="p-3 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Button icon="pi pi-plus" text rounded size="small" @click="handleAddReceiptPlan" title="新增" />
                        <Button
                          :label="String(selectedReceiptPlanCount)"
                          icon="pi pi-trash"
                          text
                          rounded
                          size="small"
                          class="!text-red-500"
                          @click="handleDeleteAllReceiptPlans"
                          :title="`批量删除（已勾选 ${selectedReceiptPlanCount} 条）`"
                        />
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] border border-[var(--content-border)]"
                          @click="handleOpenReceiptPlanPopup"
                          title="弹窗查看计划"
                        >
                          <i class="pi pi-external-link"></i>
                        </button>
                        <div class="flex items-center gap-1 bg-[var(--content-bg)] rounded-lg p-1 border border-[var(--content-border)]">
                          <button
                            type="button"
                            class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                            :class="receiptPlanViewMode === 'card' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
                            @click="toggleReceiptPlanView('card')"
                            title="卡片视图"
                          >
                            <i class="pi pi-th-large"></i>
                          </button>
                          <button
                            type="button"
                            class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
                            :class="receiptPlanViewMode === 'table' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
                            @click="toggleReceiptPlanView('table')"
                            title="表格视图"
                          >
                            <i class="pi pi-table"></i>
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- 概览统计 -->
                    <div class="flex items-center justify-between p-4 rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] shadow-sm">
                      <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">收付计划数</span>
                        <span class="text-lg font-black text-[var(--content-text)]">{{ filteredReceiptPlans.length }}</span>
                      </div>
                      <div class="h-8 w-px bg-[var(--content-border)] mx-4"></div>
                      <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">应收总额</span>
                        <span class="text-lg font-black text-[var(--content-text)] tabular-nums">{{ formatMoney(filteredReceiptPlans.reduce((s, p) => s + (Number(p.expected_amount) || 0), 0)) }}</span>
                      </div>
                      <div class="h-8 w-px bg-[var(--content-border)] mx-4"></div>
                      <div class="flex flex-col text-right">
                        <span class="text-[10px] font-bold text-[var(--content-text-secondary)] uppercase tracking-wider mb-0.5">未收总额</span>
                        <span class="text-lg font-black text-red-500 tabular-nums">{{ formatMoney(totalOutstandingAmount) }}</span>
                      </div>
                    </div>

                    <ReceiptPlanListPanel
                      :receiptPlans="planRows"
                      :filteredReceiptPlans="filteredReceiptPlans"
                      :receiptPlanViewMode="receiptPlanViewMode"
                      :receiptPlanTableQuery="receiptPlanTableQuery"
                      :hasReceiptPlanTableQuery="hasReceiptPlanTableQuery"
                      :clearReceiptPlanTableQuery="clearReceiptPlanTableQuery"
                      :formatMoney="formatMoney"
                      :getOutstanding="getOutstanding"
                      :getDirectionSeverity="getDirectionSeverity"
                      :showSelection="true"
                      :showActions="true"
                      :selectedReceiptPlanIds="selectedReceiptPlanIds"
                      :isAllSelected="isAllReceiptPlansSelected"
                      tableClass="custom-datatable p-datatable-sm"
                      tableScrollHeight="360px"
                      @toggle-select="(p) => toggleReceiptPlanSelection(p.id, p.checked)"
                      @toggle-select-all="toggleSelectAllReceiptPlans"
                      @view="handleViewReceiptPlan"
                      @edit="handleEditReceiptPlan"
                      @delete="handleDeleteReceiptPlan"
                    />
                  </div>
                </TabPanel>

              </TabPanels>
            </Tabs>
          </section>
        </template>
      </div>

      <footer class="px-6 py-3 bg-[var(--content-bg)] border-t border-[var(--content-border)] flex items-center justify-end gap-3 shrink-0">
        <Button label="关闭" severity="secondary" @click="visible = false" />
      </footer>
    </div>

    <ContractExecutionDialog
      v-model:visible="executionVisible"
      :initialData="selectedExecution"
      @saved="onExecutionSaved"
    />

    <ContractProductDialog
      v-model:visible="productVisible"
      :initialData="selectedProduct"
      @saved="onProductSaved"
    />

    <ReceiptPlanDialog
      v-model:visible="receiptPlanVisible"
      :initialData="selectedReceiptPlan"
      :readonly="receiptPlanReadonly"
      @saved="onReceiptPlanSaved"
    />

    <Dialog
      v-model:visible="receiptPlanPopupVisible"
      modal
      maximizable
      :draggable="true"
      :closeOnEscape="false"
      header="收付计划信息"
      :style="{ width: '92vw' }"
      :contentStyle="{ height: '72vh' }"
      class="custom-dialog"
    >
      <div class="h-full flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="text-[var(--content-text-secondary)]">
            收付计划数 {{ filteredReceiptPlans.length }}，应收总额 {{ formatMoney(filteredReceiptPlans.reduce((s, p) => s + (Number(p.expected_amount) || 0), 0)) }}，未收总额 {{ formatMoney(totalOutstandingAmount) }}
          </div>
          <div class="flex items-center gap-1 bg-[var(--content-bg)] rounded-lg p-1 border border-[var(--content-border)]">
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
              :class="receiptPlanViewMode === 'card' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
              @click="toggleReceiptPlanView('card')"
              title="卡片视图"
            >
              <i class="pi pi-th-large"></i>
            </button>
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
              :class="receiptPlanViewMode === 'table' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
              @click="toggleReceiptPlanView('table')"
              title="表格视图"
            >
              <i class="pi pi-table"></i>
            </button>
          </div>
        </div>

        <ReceiptPlanListPanel
          :receiptPlans="planRows"
          :filteredReceiptPlans="filteredReceiptPlans"
          :receiptPlanViewMode="receiptPlanViewMode"
          :receiptPlanTableQuery="receiptPlanTableQuery"
          :hasReceiptPlanTableQuery="hasReceiptPlanTableQuery"
          :clearReceiptPlanTableQuery="clearReceiptPlanTableQuery"
          :formatMoney="formatMoney"
          :getOutstanding="getOutstanding"
          :getDirectionSeverity="getDirectionSeverity"
          :showActions="true"
          tableClass="custom-datatable p-datatable-sm flex-1"
          tableScrollHeight="flex"
          :cardScrollable="true"
          @view="handleViewReceiptPlan"
          @edit="handleEditReceiptPlan"
          @delete="handleDeleteReceiptPlan"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="productPopupVisible"
      modal
      maximizable
      :draggable="true"
      header="产品信息"
      :style="{ width: '92vw' }"
      :contentStyle="{ height: '72vh' }"
      class="custom-dialog"
    >
      <div class="h-full flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="text-[var(--content-text-secondary)]">
            产品数 {{ products.length }}，总数量 {{ formatNumber(productsTotalQuantity) }}，总额 {{ formatMoney(productsTotalAmount) }}
          </div>
          <div class="flex items-center gap-1 bg-[var(--content-bg)] rounded-lg p-1 border border-[var(--content-border)]">
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
              :class="productViewMode === 'card' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
              @click="toggleProductView('card')"
              title="卡片视图"
            >
              <i class="pi pi-th-large"></i>
            </button>
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
              :class="productViewMode === 'table' ? 'bg-[var(--sidebar-active-bg)] text-[var(--btn-primary-bg)] shadow-sm' : 'text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)]'"
              @click="toggleProductView('table')"
              title="表格视图"
            >
              <i class="pi pi-table"></i>
            </button>
          </div>
        </div>

        <ContractProductListPanel
          :products="products"
          :filteredProducts="filteredProducts"
          :productViewMode="productViewMode"
          :productTableQuery="productTableQuery"
          :hasProductTableQuery="hasProductTableQuery"
          :clearProductTableQuery="clearProductTableQuery"
          :formatMoney="formatMoney"
          :formatNumber="formatNumber"
          :showActions="true"
          tableClass="custom-datatable p-datatable-sm flex-1"
          tableScrollHeight="flex"
          :cardScrollable="true"
          @edit="handleEditProduct"
          @delete="handleDeleteProduct"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="productImportVisible"
      modal
      header="Excel 导入合同产品"
      :style="{ width: '860px' }"
      :closable="!productImporting"
      class="custom-dialog"
    >
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div
            class="rounded-md border px-3 py-2 text-center"
            :class="productImportStep === 1 ? 'border-[var(--btn-primary-bg)] text-[var(--btn-primary-bg)] bg-[var(--sidebar-active-bg)]' : 'border-[var(--content-border)] text-[var(--content-text-secondary)]'"
          >
            1. 字段映射
          </div>
          <div
            class="rounded-md border px-3 py-2 text-center"
            :class="productImportStep === 2 ? 'border-[var(--btn-primary-bg)] text-[var(--btn-primary-bg)] bg-[var(--sidebar-active-bg)]' : 'border-[var(--content-border)] text-[var(--content-text-secondary)]'"
          >
            2. 预导入校验
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button
            label="选择 Excel"
            icon="pi pi-upload"
            size="small"
            :disabled="productImporting"
            @click="handleSelectProductImportFile"
          />
          <span class="text-[var(--content-text-secondary)] truncate" :title="selectedProductImportFilePath || ''">
            {{ selectedProductImportFilePath || '未选择文件' }}
          </span>
        </div>
        <div v-if="productImportSheetNames.length > 0" class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <span class="text-[var(--content-text-secondary)]">工作表</span>
          <Dropdown
            :modelValue="selectedProductImportSheetName"
            :options="productImportSheetNames"
            placeholder="选择工作表"
            @update:modelValue="handleChangeProductImportSheet"
          />
        </div>
        <div v-if="productImportHeaderRowOptions.length > 0" class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <span class="text-[var(--content-text-secondary)]">表头行</span>
          <Dropdown
            :modelValue="selectedProductImportHeaderRow"
            :options="productImportHeaderRowOptions"
            placeholder="选择表头所在行"
            @update:modelValue="handleChangeProductImportHeaderRow"
          />
        </div>

        <div v-if="productImportHeaders.length === 0" class="py-8 text-center text-[var(--content-text-secondary)]">
          请选择 Excel 文件后配置字段映射
        </div>

        <div v-else-if="productImportStep === 1" class="space-y-2">
          <div class="text-[var(--content-text-secondary)]">
            当前工作表：{{ selectedProductImportSheetName || '-' }}，表头行：第 {{ selectedProductImportHeaderRow }} 行，检测到 {{ productImportHeaders.length }} 列、{{ productImportRows.length }} 条数据，请设置“Excel列 → 合同产品字段”映射关系
          </div>
          <div class="max-h-[360px] overflow-auto border border-[var(--content-border)] rounded-lg p-2">
            <div
              v-for="field in productImportFieldOptions"
              :key="field.key"
              class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 py-1"
            >
              <label class="text-[var(--content-text)] text-right">
                <span v-if="field.required" class="text-red-500">*</span>{{ field.label }}
              </label>
              <Dropdown
                v-model="productImportMappings[field.key]"
                :options="productImportHeaders"
                showClear
                placeholder="选择 Excel 列"
              />
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
          <div class="text-[var(--content-text-secondary)]">
            预导入共 {{ productImportPreviewRows.length }} 条，可导入 {{ productImportPreviewValidCount }} 条，错误 {{ productImportPreviewErrorCount }} 条
          </div>
          <DataTable
            :value="productImportPreviewRows"
            dataKey="rowNumber"
            class="custom-datatable p-datatable-sm"
            stripedRows
            :scrollable="true"
            scrollHeight="360px"
          >
            <Column field="rowNumber" header="Excel行" style="min-width: 6rem" />
            <Column header="名称" style="min-width: 10rem">
              <template #body="{ data }">{{ data.dto.name || '-' }}</template>
            </Column>
            <Column header="编码" style="min-width: 8rem">
              <template #body="{ data }">{{ data.dto.code || '-' }}</template>
            </Column>
            <Column header="型号规格" style="min-width: 10rem">
              <template #body="{ data }">{{ data.dto.specification || '-' }}</template>
            </Column>
            <Column header="数量" style="min-width: 7rem">
              <template #body="{ data }">{{ data.dto.quantity ?? '-' }}</template>
            </Column>
            <Column header="单价" style="min-width: 8rem">
              <template #body="{ data }">{{ data.dto.unit_price ?? '-' }}</template>
            </Column>
            <Column header="总价" style="min-width: 8rem">
              <template #body="{ data }">{{ data.dto.total_price ?? '-' }}</template>
            </Column>
            <Column header="错误原因" style="min-width: 18rem">
              <template #body="{ data }">
                <span :class="data.error ? 'text-red-500' : 'text-emerald-600'">{{ data.error || '通过' }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <Button
            v-if="productImportStep === 2"
            label="上一步"
            text
            :disabled="productImporting"
            @click="handleBackToProductImportMapping"
          />
          <Button label="取消" text :disabled="productImporting" @click="productImportVisible = false" />
          <Button
            :label="productImportStep === 1 ? '下一步（预导入）' : '确认导入'"
            :icon="productImportStep === 1 ? 'pi pi-arrow-right' : 'pi pi-check'"
            :loading="productImporting"
            :disabled="productImporting || (productImportStep === 1 ? productImportRows.length === 0 : productImportPreviewValidCount === 0)"
            @click="productImportStep === 1 ? handleGoToProductImportPreview() : handleSubmitProductImport()"
          />
        </div>
      </template>
    </Dialog>

    <CustomerDetailDrawer
      v-model="customerDetailVisible"
      :customerData="customerDetailData"
      @edit="handleCustomerDetailEdit"
      @open-library="handleCustomerDetailOpenLibrary"
    />

    <SupplierDetailDrawer
      v-model="supplierDetailVisible"
      :supplierData="supplierDetailData"
      @edit="handleSupplierDetailEdit"
      @open-library="handleSupplierDetailOpenLibrary"
    />

    <CustomerDialog
      v-model:visible="customerEditVisible"
      :isEdit="true"
      :initialData="customerEditData"
      :groupOptions="customerDialogGroupOptions"
      @save="handleCustomerDialogSave"
    />

    <SupplierDialog
      v-model:visible="supplierEditVisible"
      :isEdit="true"
      :initialData="supplierEditData"
      :groupOptions="supplierDialogGroupOptions"
      @save="handleSupplierDialogSave"
    />
  </Drawer>

  <Teleport to="body">
    <div v-if="sourcePdfPreviewVisible" class="fixed inset-0 pointer-events-none" :style="{ zIndex: sourcePdfPreviewZIndex }">
      <div
        class="pointer-events-auto fixed flex flex-col overflow-hidden rounded-xl border border-[var(--content-border)] bg-[var(--content-card-bg)] shadow-2xl"
        :style="sourcePdfPanelStyle"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-[var(--content-border)] px-4 py-3 cursor-move select-none bg-[var(--content-bg)]"
          @mousedown="startSourcePdfPanelDrag"
        >
          <div class="min-w-0">
            <div class="font-semibold text-[var(--content-text)] truncate">合同源文件预览</div>
            <div class="text-xs text-[var(--content-text-secondary)] truncate">
              {{ sourcePdfPreviewName || '文件' }}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              title="放到左侧"
              @mousedown.stop
              @click="resetSourcePdfPanelLayout"
            >
              <i class="pi pi-arrow-left"></i>
            </button>
            <button
              type="button"
              class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              title="关闭预览"
              @mousedown.stop
              @click="closeSourcePdfPreview"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 bg-[var(--content-bg)]">
          <div v-if="sourcePdfPreviewLoading" class="h-full flex items-center justify-center text-[var(--content-text-secondary)]">
            <i class="pi pi-spin pi-spinner mr-2"></i>
            <span>正在加载合同源文件...</span>
          </div>
          <div v-else-if="sourcePdfPreviewError" class="h-full flex items-center justify-center px-6">
            <div class="rounded-xl bg-[var(--content-card-bg)] border border-[var(--content-border)] p-6 text-center max-w-xl">
              <div class="flex items-center justify-center gap-2 text-[var(--content-text)] font-semibold">
                <i class="pi pi-exclamation-triangle text-yellow-500"></i>
                <span>无法预览合同源文件</span>
              </div>
              <div class="mt-3 text-[var(--content-text-secondary)] break-words">{{ sourcePdfPreviewError }}</div>
            </div>
          </div>
          <ContractFilesPreviewPane
            v-else
            :filePath="sourcePdfPreviewPath"
            :displayName="sourcePdfPreviewName"
            class="h-full"
          />
        </div>

        <span class="preview-resize-handle preview-resize-handle-n" @mousedown="startSourcePdfPanelResize('n', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-s" @mousedown="startSourcePdfPanelResize('s', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-e" @mousedown="startSourcePdfPanelResize('e', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-w" @mousedown="startSourcePdfPanelResize('w', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-ne" @mousedown="startSourcePdfPanelResize('ne', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-nw" @mousedown="startSourcePdfPanelResize('nw', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-se" @mousedown="startSourcePdfPanelResize('se', $event)"></span>
        <span class="preview-resize-handle preview-resize-handle-sw" @mousedown="startSourcePdfPanelResize('sw', $event)"></span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from 'primevue/drawer'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Timeline from 'primevue/timeline'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import ContractExecutionDialog from '../../contract-execution/components/ContractExecutionDialog.vue'
import ContractProductDialog from '../../contract-product/components/ContractProductDialog.vue'
import ContractFilesPreviewPane from '../../contract-files/components/ContractFilesPreviewPane.vue'
import ContractProductListPanel from './ContractProductListPanel.vue'
import ReceiptPlanListPanel from './ReceiptPlanListPanel.vue'
import ReceiptPlanDialog from '../../receipt-plan/components/ReceiptPlanDialog.vue'
import CustomerDetailDrawer from '../../customer/components/CustomerDetailDrawer.vue'
import SupplierDetailDrawer from '../../supplier/components/SupplierDetailDrawer.vue'
import CustomerDialog from '../../customer/components/CustomerDialog.vue'
import SupplierDialog from '../../supplier/components/SupplierDialog.vue'
import type { ContractResource } from '../types/contractResource'
import type { Customer } from '../../../../../shared/types/customer.types'
import type { Supplier } from '../../../../../shared/types/supplier.types'
import { buildUnitLibraryRouteLocation } from '../../unit-library/unitLibrary'
import { useContractDetailDrawer } from './useContractDetailDrawer'
import { copyTextToClipboard } from '../../contract-files/contractFilesHelpers'

const props = defineProps<{
  visible: boolean
  libraryPath: string
  contractId: string | null
  resource?: ContractResource | null
  defaultTab?: 'basicInfo' | 'executions' | 'products' | 'receiptPlans' 
  refreshToken?: number
  hasPrevious?: boolean
  hasNext?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'navigate-previous'): void
  (e: 'navigate-next'): void
  (e: 'edit'): void
}>()

const toast = useToast()
const router = useRouter()

const visible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

const hasPrevious = computed(() => Boolean(props.hasPrevious))
const hasNext = computed(() => Boolean(props.hasNext))

const requestNavigatePrevious = () => {
  if (!visible.value) return
  if (!hasPrevious.value) {
    toast.add({ severity: 'info', summary: '提示', detail: '已经是上一个合同了', life: 2000 })
    return
  }
  emit('navigate-previous')
}

const requestNavigateNext = () => {
  if (!visible.value) return
  if (!hasNext.value) {
    toast.add({ severity: 'info', summary: '提示', detail: '已经是下一个合同了', life: 2000 })
    return
  }
  emit('navigate-next')
}

const companyDetailLoading = ref<'party-a' | 'party-b' | null>(null)
const customerDetailVisible = ref(false)
const customerDetailData = ref<Customer | null>(null)
const supplierDetailVisible = ref(false)
const supplierDetailData = ref<Supplier | null>(null)

const customerEditVisible = ref(false)
const customerEditData = ref<Customer | null>(null)
const customerDialogGroupOptions = ref<{ name: string }[]>([])

const supplierEditVisible = ref(false)
const supplierEditData = ref<Supplier | null>(null)
const supplierDialogGroupOptions = ref<{ name: string }[]>([])

const normalizeNameKey = (value: unknown) => String(value || '').trim().toLowerCase()

const loadCustomerDialogGroupOptions = async () => {
  const set = new Set<string>()
  try {
    const res = await window.electronAPI.customer.getList({ page: 1, pageSize: 10000, useGroupFilter: false })
    if (res.success && res.data?.data) {
      for (const customer of res.data.data) {
        const name = String(customer.group_name || '').trim()
        if (name) set.add(name)
      }
    }
  } catch {
  }
  customerDialogGroupOptions.value = Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => ({ name }))
}

const loadSupplierDialogGroupOptions = async () => {
  const set = new Set<string>()
  try {
    const res = await window.electronAPI.supplier.getList({ page: 1, pageSize: 10000 })
    if (res.success && res.data?.data) {
      for (const supplier of res.data.data) {
        const name = String(supplier.group_name || '').trim()
        if (name) set.add(name)
      }
    }
  } catch {
  }
  supplierDialogGroupOptions.value = Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name) => ({ name }))
}

const findCustomerByName = async (name: string) => {
  const target = normalizeNameKey(name)
  if (!target) return null
  const res = await window.electronAPI.customer.getList({
    page: 1,
    pageSize: 100,
    useGroupFilter: false,
    search: name,
    searchFields: ['name'],
  })
  if (!res.success || !res.data?.data) return null
  return res.data.data.find((item) => normalizeNameKey(item.name) === target) || null
}

const findSupplierByName = async (name: string) => {
  const target = normalizeNameKey(name)
  if (!target) return null
  const res = await window.electronAPI.supplier.getList({
    page: 1,
    pageSize: 100,
    search: name,
    searchFields: ['name'],
  })
  if (!res.success || !res.data?.data) return null
  return res.data.data.find((item) => normalizeNameKey(item.name) === target) || null
}

const openPartyADetail = async () => {
  const name = String(displayClientName.value || '').trim()
  if (!name || name === '-' || companyDetailLoading.value) return

  companyDetailLoading.value = 'party-a'
  try {
    const matched = await findCustomerByName(name)
    if (!matched?.id) {
      toast.add({ severity: 'info', summary: '提示', detail: '未在甲方单位库中找到对应公司', life: 2500 })
      return
    }

    const detailRes = await window.electronAPI.customer.get(matched.id)
    if (!detailRes.success || !detailRes.data) {
      throw new Error(detailRes.error || '加载甲方单位详情失败')
    }

    customerDetailData.value = detailRes.data
    customerDetailVisible.value = true
  } catch (error) {
    const detail = error instanceof Error ? error.message : '加载甲方单位详情失败'
    toast.add({ severity: 'error', summary: '错误', detail, life: 3000 })
  } finally {
    companyDetailLoading.value = null
  }
}

const openPartyBDetail = async () => {
  const name = String(displayPartyBName.value || '').trim()
  if (!name || name === '-' || companyDetailLoading.value) return

  companyDetailLoading.value = 'party-b'
  try {
    const matched = await findSupplierByName(name)
    if (!matched?.id) {
      toast.add({ severity: 'info', summary: '提示', detail: '未在乙方单位库中找到对应公司', life: 2500 })
      return
    }

    const detailRes = await window.electronAPI.supplier.get(matched.id)
    if (!detailRes.success || !detailRes.data) {
      throw new Error(detailRes.error || '加载乙方单位详情失败')
    }

    supplierDetailData.value = detailRes.data
    supplierDetailVisible.value = true
  } catch (error) {
    const detail = error instanceof Error ? error.message : '加载乙方单位详情失败'
    toast.add({ severity: 'error', summary: '错误', detail, life: 3000 })
  } finally {
    companyDetailLoading.value = null
  }
}

const handleCustomerDetailEdit = async (customer: Customer) => {
  customerDetailVisible.value = false
  customerEditData.value = customerDetailData.value || customer
  if (customerDialogGroupOptions.value.length === 0) {
    await loadCustomerDialogGroupOptions()
  }
  customerEditVisible.value = true
}

const handleSupplierDetailEdit = async (supplier: Supplier) => {
  supplierDetailVisible.value = false
  supplierEditData.value = supplierDetailData.value || supplier
  if (supplierDialogGroupOptions.value.length === 0) {
    await loadSupplierDialogGroupOptions()
  }
  supplierEditVisible.value = true
}

const handleCustomerDialogSave = (data: Customer) => {
  customerDetailData.value = data
  customerDetailVisible.value = true
}

const handleSupplierDialogSave = (data: Supplier) => {
  supplierDetailData.value = data
  supplierDetailVisible.value = true
}

const handleCustomerDetailOpenLibrary = async (customer: Customer) => {
  customerDetailVisible.value = false
  await router.push(buildUnitLibraryRouteLocation('party-a', customer.id))
}

const handleSupplierDetailOpenLibrary = async (supplier: Supplier) => {
  supplierDetailVisible.value = false
  await router.push(buildUnitLibraryRouteLocation('party-b', supplier.id))
}

const isEditableTarget = (target: EventTarget | null) => {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!visible.value) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (isEditableTarget(event.target)) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    requestNavigatePrevious()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    requestNavigateNext()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

const {
  activeTab,
  summaryExpanded,
  summaryOverflowing,
  summaryToggleVisible,
  summaryEl,
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
  handleDeleteAllReceiptPlans,
  onReceiptPlanSaved,
  getOutstanding,
  totalOutstandingAmount,
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
  displayContractSummaryHtml,
  displayGroupName,
  displayCurrency,
  displayContractStatus,
  displayPartyAContact,
  displayPartyBContact,
  displayContractAmount,
  displayStartDate,
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
  hasSourcePdf,
  sourcePdfFilePath,
  displaySourcePdfName,
  sourcePdfMetaLoading,
  sourcePdfMetaError,
  reloadContract,
  onHide,
} = useContractDetailDrawer({ props, visible })

const requestEdit = () => {
  if (!visible.value) return
  if (!hasRealContractId.value) {
    toast.add({ severity: 'warn', summary: '提示', detail: '当前合同信息不完整，无法编辑', life: 2500 })
    return
  }
  closeSourcePdfPreview()
  emit('edit')
}

const copyingSourcePdfFile = ref(false)

const copySourcePdfName = async () => {
  if (!hasSourcePdf.value) return
  const ok = await copyTextToClipboard(displaySourcePdfName.value)
  toast.add({
    severity: ok ? 'success' : 'error',
    summary: ok ? '已复制' : '复制失败',
    detail: ok ? '文件名已复制到剪贴板' : '复制文件名失败',
    life: ok ? 1500 : 2500,
  })
}

const copySourcePdfFile = async () => {
  const p = String(sourcePdfFilePath.value || '').trim()
  if (!p || copyingSourcePdfFile.value) return
  copyingSourcePdfFile.value = true
  try {
    const res = await window.electronAPI.fs.clipboardWriteFile(p)
    if (res.success) {
      toast.add({ severity: 'success', summary: '已复制', detail: '文件已复制到剪贴板，可直接粘贴到微信或资源管理器', life: 2000 })
    } else {
      toast.add({ severity: 'error', summary: '复制失败', detail: res.error || '复制文件失败', life: 3000 })
    }
  } finally {
    copyingSourcePdfFile.value = false
  }
}

const receiptPlanSummaryRows = computed(() => {
  const list = filteredReceiptPlans.value || []
  return list
    .filter((p) => String((p as any).direction || '').trim() === '收款')
    .sort((a, b) => String((a as any).expected_date || '').localeCompare(String((b as any).expected_date || '')))
})

const receiptPlanSummaryPreview = computed(() => receiptPlanSummaryRows.value.slice(0, 4))

const receiptPlanSummaryTotalExpected = computed(() => {
  return receiptPlanSummaryRows.value.reduce((sum, p) => sum + Number((p as any).expected_amount || 0), 0)
})

const receiptPlanSummaryTotalOutstanding = computed(() => {
  return receiptPlanSummaryRows.value.reduce((sum, p) => sum + Number(getOutstanding(p) || 0), 0)
})

const handleProductPanelToggleSelect = (payload: { id: string; checked: boolean }) => {
  toggleProductSelection(payload.id, payload.checked)
}
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

/* Timeline 左对齐样式优化 */
.custom-timeline :deep(.p-timeline-event-opposite) {
  display: none;
}

.custom-timeline :deep(.p-timeline-event-content) {
  padding-left: 0.75rem;
}

.custom-timeline :deep(.p-timeline-event-separator) {
  flex: 0 0 auto;
}

.custom-drawer :deep(.p-tablist-tab-list) {
  padding: 0.3rem 0.4rem;
  gap: 0.2rem;
}

.custom-drawer :deep(.p-tab) {
  padding: 0.45rem 0.7rem;
}

.custom-drawer :deep(.p-tabpanels) {
  padding: 0;
}

.custom-drawer :deep(.p-datatable .p-datatable-thead > tr > th) {
  padding: 0.5rem 0.625rem;
}

.custom-drawer :deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.625rem;
}

.custom-drawer :deep(.p-datatable .p-datatable-tbody > tr:hover > td) {
  background: color-mix(in srgb, var(--sidebar-hover-bg) 65%, transparent);
}

.summary-markdown :deep(p) {
  margin: 0 0 0.5rem;
  white-space: pre-wrap;
}

.summary-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.summary-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.summary-markdown :deep(th),
.summary-markdown :deep(td) {
  border: 1px solid var(--content-border);
  padding: 0.375rem 0.5rem;
  text-align: left;
  vertical-align: top;
}

.summary-markdown :deep(th) {
  background: color-mix(in srgb, var(--content-border) 30%, var(--content-bg));
  font-weight: 600;
}

.summary-markdown :deep(ul),
.summary-markdown :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.summary-markdown :deep(li + li) {
  margin-top: 0.25rem;
}

.summary-markdown :deep(code) {
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

