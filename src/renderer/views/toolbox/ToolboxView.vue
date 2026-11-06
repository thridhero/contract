<template>
  <div class="flex h-full flex-col bg-[var(--content-bg)]">
    <header class="toolbox-titlebar">
      <div class="flex min-w-0 items-center gap-4" style="-webkit-app-region: no-drag;">
        <Button
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          aria-label="返回"
          @click="handleBack"
        />
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold text-[var(--content-text)]">
            {{ currentPageTitle }}
          </div>
          <p class="mt-1 truncate text-sm text-[var(--content-text-secondary)]">
            {{ currentPageDescription }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
        <template v-if="currentTool === 'batch-image-ocr'">
          <Button icon="pi pi-images" text rounded severity="secondary" aria-label="添加图片" v-tooltip.bottom="'添加图片'" @click="batchImageOcrToolRef?.handleAddImages()" />
          <Button icon="pi pi-folder-open" text rounded severity="secondary" aria-label="选择目录" v-tooltip.bottom="'选择目录'" @click="batchImageOcrToolRef?.handleSelectFolder()" />
          <Button
            :icon="batchImageOcrToolRef?.isRunning ? 'pi pi-spin pi-spinner' : 'pi pi-play'"
            :label="batchImageOcrToolRef?.isRunning ? '执行中' : '开始识别'"
            rounded
            severity="secondary"
            :disabled="Boolean(batchImageOcrToolRef?.isRunning)"
            :loading="Boolean(batchImageOcrToolRef?.isRunning)"
            aria-label="开始识别"
            v-tooltip.bottom="batchImageOcrToolRef?.isRunning ? '正在执行中' : '开始识别'"
            @click="batchImageOcrToolRef?.handleStartRecognition()"
          />
          <Button icon="pi pi-file-edit" text rounded severity="secondary" aria-label="导出Markdown" v-tooltip.bottom="'导出 Markdown'" @click="batchImageOcrToolRef?.handleExportMarkdown()" />
          <Button icon="pi pi-file-word" text rounded severity="secondary" aria-label="导出Word" v-tooltip.bottom="'导出 Word'" @click="batchImageOcrToolRef?.handleExportWord()" />
          <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="清空列表" v-tooltip.bottom="'清空列表'" @click="batchImageOcrToolRef?.requestClearAll()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'支持多图导入、目录扫描、逐张识别、Markdown 实时预览，以及 Markdown/Word 导出。'"
          />
        </template>
        <template v-else-if="currentTool === 'multi-image-to-pdf'">
          <Button icon="pi pi-images" text rounded severity="secondary" aria-label="添加图片" v-tooltip.bottom="'添加图片'" @click="multiImageToPdfToolRef?.handleAddImages()" />
          <Button icon="pi pi-folder-open" text rounded severity="secondary" aria-label="选择目录" v-tooltip.bottom="'选择目录'" @click="multiImageToPdfToolRef?.handleSelectFolder()" />
          <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="清空列表" v-tooltip.bottom="'清空列表'" @click="multiImageToPdfToolRef?.requestClearAll()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'支持多图导入、目录扫描、拖拽排序和 A4 单图单页导出。'"
          />
        </template>
        <template v-else-if="currentTool === 'signature-cutout'">
          <Button icon="pi pi-image" text rounded severity="secondary" aria-label="上传签名图片" v-tooltip.bottom="'上传签名图片'" @click="signatureCutoutToolRef?.handleSelectImage()" />
          <Button icon="pi pi-refresh" text rounded severity="secondary" aria-label="重新选择图片" v-tooltip.bottom="'重新选择图片'" @click="signatureCutoutToolRef?.handleReprocess()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'自动去背景并导出透明 PNG，支持阈值调节和手动裁切。'"
          />
        </template>
        <template v-else-if="currentTool === 'seal-extraction'">
          <Button icon="pi pi-image" text rounded severity="secondary" aria-label="选择印章图片" v-tooltip.bottom="'选择印章图片'" @click="sealExtractionToolRef?.handleSelectImage()" />
          <Button icon="pi pi-refresh" text rounded severity="secondary" aria-label="重置" v-tooltip.bottom="'重置'" @click="sealExtractionToolRef?.handleReset()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'仅限抠取本单位自有实体公章透明图，支持红章提取、自动裁切、DPI 放大导出。'"
            @click="sealExtractionToolRef?.toggleHelp()"
          />
        </template>
        <template v-else-if="currentTool === 'pdf-merge'">
          <Button icon="pi pi-file-pdf" text rounded severity="secondary" aria-label="添加PDF" v-tooltip.bottom="'添加PDF'" @click="pdfMergeToolRef?.handleAddFiles()" />
          <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="清除选中" v-tooltip.bottom="'清除选中'" @click="pdfMergeToolRef?.requestClearSelected()" />
          <Button
            icon="pi pi-cog"
            text
            rounded
            severity="secondary"
            aria-label="设置"
            v-tooltip.bottom="'设置'"
            :class="{ 'text-sky-600': Boolean(pdfMergeToolRef?.settingsVisible) }"
            @click="pdfMergeToolRef?.toggleSettings()"
          />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'支持多 PDF 合并、拖拽排序和输出文件名配置。'"
          />
        </template>
        <template v-else-if="currentTool === 'pdf-split'">
          <Button icon="pi pi-file-pdf" text rounded severity="secondary" aria-label="添加PDF" v-tooltip.bottom="'添加PDF'" @click="pdfSplitToolRef?.handleAddFiles()" />
          <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="清除选中" v-tooltip.bottom="'清除选中'" @click="pdfSplitToolRef?.requestClearSelected()" />
          <Button
            icon="pi pi-cog"
            text
            rounded
            severity="secondary"
            aria-label="设置"
            v-tooltip.bottom="'设置'"
            :class="{ 'text-sky-600': Boolean(pdfSplitToolRef?.settingsVisible) }"
            @click="pdfSplitToolRef?.toggleSettings()"
          />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'支持按页范围、固定页数或单页模式批量拆分 PDF。'"
          />
        </template>
        <template v-else-if="currentTool === 'pdf-compress'">
          <Button icon="pi pi-file-pdf" text rounded severity="secondary" aria-label="选择PDF" v-tooltip.bottom="'选择PDF'" @click="pdfCompressToolRef?.handleAddFiles()" />
          <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="清除文件" v-tooltip.bottom="'清除文件'" @click="pdfCompressToolRef?.clearFile()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'仅支持纯扫描件 PDF，会重建为图片型 PDF 并按档位压缩。'"
            @click="pdfCompressToolRef?.toggleHelp()"
          />
        </template>
        <template v-else-if="currentTool === 'pdf-batch-stamp'">
          <Button icon="pi pi-file-pdf" text rounded severity="secondary" aria-label="添加PDF" v-tooltip.bottom="'添加PDF'" @click="pdfBatchStampToolRef?.handleAddFiles()" />
          <Button icon="pi pi-image" text rounded severity="secondary" aria-label="选择印章" v-tooltip.bottom="'选择印章'" @click="pdfBatchStampToolRef?.handleSelectStampImage()" />
          <Button
            icon="pi pi-question-circle"
            text
            rounded
            severity="secondary"
            aria-label="查看使用说明"
            v-tooltip.bottom="'支持骑缝章和指定位置盖章，鼠标可切换为印章样式点击定位。'"
            @click="pdfBatchStampToolRef?.toggleHelp()"
          />
        </template>
        <WindowControls :show-divider="false" />
      </div>
    </header>

    <section class="flex flex-wrap items-center gap-2 border-b border-[var(--content-border)] px-6 py-3 text-sm text-[var(--content-text-secondary)]">
      <button type="button" class="toolbox-link" @click="goHome">工具箱</button>
      <template v-if="showCollectionBreadcrumb">
        <i class="pi pi-angle-right text-xs"></i>
        <button type="button" class="toolbox-link" @click="goCollection(currentCollection as ToolboxCollectionKey)">
          {{ collectionTitleMap[currentCollection as ToolboxCollectionKey] }}
        </button>
      </template>
      <template v-if="currentTool">
        <i class="pi pi-angle-right text-xs"></i>
        <button type="button" class="toolbox-link toolbox-link--current" @click="goTool(currentCollection as ToolboxCollectionKey, currentTool as ToolboxToolKey)">
          {{ toolTitleMap[currentTool as ToolboxToolKey] }}
        </button>
      </template>
    </section>

    <div class="flex-1 min-h-0 overflow-auto">
      <div
        class="flex min-h-full flex-col gap-6 px-6 py-6"
        :class="currentTool === 'multi-image-to-pdf' ? 'h-full gap-0 py-4' : ''"
      >
        <section v-if="!currentCollection && !currentTool" class="toolbox-groups">
          <!-- 图片工具分组 -->
          <div class="toolbox-group">
            <div class="toolbox-group-header">
              <span class="toolbox-group-bar toolbox-group-bar--emerald"></span>
              <h2 class="toolbox-group-title">图片工具</h2>
              <span class="toolbox-group-count">4 个工具</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goCollection('image-ocr')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-sky-100 text-sky-700">
                  <i class="pi pi-images"></i>
                </div>
                <h3 class="toolbox-mini-card__title">图片 OCR</h3>
                <p class="toolbox-mini-card__desc">批量识别图片文字，结果可导出为 Word。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('image-to-pdf', 'multi-image-to-pdf')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-red-100 text-red-700">
                  <i class="pi pi-file-pdf"></i>
                </div>
                <h3 class="toolbox-mini-card__title">多图片转 PDF</h3>
                <p class="toolbox-mini-card__desc">多图合成 A4 PDF，支持拖拽排序与预览。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('image-processing', 'signature-cutout')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-emerald-100 text-emerald-700">
                  <i class="pi pi-pencil"></i>
                </div>
                <h3 class="toolbox-mini-card__title">签名抠图</h3>
                <p class="toolbox-mini-card__desc">自动去背景并紧裁切，导出透明 PNG。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('image-processing', 'seal-extraction')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-rose-100 text-rose-700">
                  <i class="pi pi-circle"></i>
                </div>
                <h3 class="toolbox-mini-card__title">印章提取</h3>
                <p class="toolbox-mini-card__desc">识别红章去浅色背景，导出透明 PNG。</p>
              </button>
            </div>
          </div>

          <div class="toolbox-group">
            <div class="toolbox-group-header">
              <span class="toolbox-group-bar toolbox-group-bar--amber"></span>
              <h2 class="toolbox-group-title">PDF 工具</h2>
              <span class="toolbox-group-count">4 个工具</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('pdf-tools', 'pdf-merge')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-amber-100 text-amber-700">
                  <i class="pi pi-clone"></i>
                </div>
                <h3 class="toolbox-mini-card__title">PDF 合并</h3>
                <p class="toolbox-mini-card__desc">多个 PDF 按顺序与页码范围合并输出。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('pdf-tools', 'pdf-split')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-amber-100 text-amber-700">
                  <i class="pi pi-clone"></i>
                </div>
                <h3 class="toolbox-mini-card__title">PDF 拆分</h3>
                <p class="toolbox-mini-card__desc">按页数规则或自定义页码段拆分输出。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('pdf-tools', 'pdf-compress')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-emerald-100 text-emerald-700">
                  <i class="pi pi-compress"></i>
                </div>
                <h3 class="toolbox-mini-card__title">PDF 压缩</h3>
                <p class="toolbox-mini-card__desc">扫描件重新压缩，减小归档体积。</p>
              </button>

              <button
                type="button"
                class="toolbox-mini-card text-left"
                @click="goTool('pdf-tools', 'pdf-batch-stamp')"
              >
                <div class="toolbox-card__icon toolbox-card__icon--sm bg-rose-100 text-rose-700">
                  <i class="pi pi-bookmark"></i>
                </div>
                <h3 class="toolbox-mini-card__title">批量盖章</h3>
                <p class="toolbox-mini-card__desc">批量盖骑缝章或指定位置印章。</p>
              </button>
            </div>
          </div>
        </section>

        <template v-else-if="currentTool === 'batch-image-ocr'">
          <BatchImageOcrTool ref="batchImageOcrToolRef" />
        </template>

        <template v-else-if="currentCollection === 'image-processing' && !currentTool">
          <section class="toolbox-card">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="toolbox-card__icon bg-emerald-100 text-emerald-700">
                  <i class="pi pi-pencil"></i>
                </div>
                <div>
                  <h2 class="text-2xl font-semibold text-[var(--content-text)]">图片处理工具</h2>
                  <p class="mt-1 text-sm text-[var(--content-text-secondary)]">当前已上线 2 个工具，可直接进入使用。</p>
                </div>
              </div>
              <span class="toolbox-badge toolbox-badge--live">签名抠图 / 印章提取</span>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">签名抠图</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      上传单张签名图片后自动去除浅色背景，仅保留签字内容，并裁切到签字边界，适合合同签章和资料排版。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('image-processing', 'signature-cutout')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">输出策略</div>
                <div class="mt-3 text-xl font-semibold text-[var(--content-text)]">透明 PNG / 自动裁切</div>
                <div class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">自动去背景、保留笔迹原色、可直接复制到剪贴板。</div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">印章提取</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      自动识别红色实体公章区域，去浅色背景并导出透明 PNG，支持 300/600 DPI 放大导出。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('image-processing', 'seal-extraction')" />
                </div>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="currentCollection === 'image-processing' && currentTool === 'signature-cutout'">
          <SignatureCutoutTool ref="signatureCutoutToolRef" />
        </template>

        <template v-else-if="currentCollection === 'image-processing' && currentTool === 'seal-extraction'">
          <SealExtractionTool ref="sealExtractionToolRef" />
        </template>

        <template v-else-if="currentCollection === 'image-to-pdf' && !currentTool">
          <section class="toolbox-card">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="toolbox-card__icon bg-red-100 text-red-700">
                  <i class="pi pi-file-pdf"></i>
                </div>
                <div>
                  <h2 class="text-2xl font-semibold text-[var(--content-text)]">图片转PDF工具</h2>
                  <p class="mt-1 text-sm text-[var(--content-text-secondary)]">当前已上线 1 个工具，可直接进入使用。</p>
                </div>
              </div>
              <span class="toolbox-badge toolbox-badge--live">A4 单图单页</span>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">多图片转 PDF</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      支持从目录递归扫描图片、导入多张图片、拖拽调整页序、预览缩放，并生成标准 A4 单图单页 PDF。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('image-to-pdf', 'multi-image-to-pdf')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">导出策略</div>
                <div class="mt-3 text-xl font-semibold text-[var(--content-text)]">A4 / 单图单页</div>
                <div class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">等比缩放、统一页边距、不裁切。</div>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="currentCollection === 'image-to-pdf' && currentTool === 'multi-image-to-pdf'">
          <MultiImageToPdfTool ref="multiImageToPdfToolRef" />
        </template>

        <template v-else-if="currentCollection === 'pdf-tools' && !currentTool">
          <section class="toolbox-card">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="toolbox-card__icon bg-amber-100 text-amber-700">
                  <i class="pi pi-clone"></i>
                </div>
                <div>
                  <h2 class="text-2xl font-semibold text-[var(--content-text)]">PDF工具</h2>
                  <p class="mt-1 text-sm text-[var(--content-text-secondary)]">当前已上线 4 个工具，可直接进入使用。</p>
                </div>
              </div>
              <span class="toolbox-badge toolbox-badge--live">合并 / 拆分 / 压缩 / 盖章</span>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">PDF 合并</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      支持导入多个 PDF、逐文件设置页码范围、调整合并顺序，并输出为新的 PDF 文件。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('pdf-tools', 'pdf-merge')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">PDF 拆分</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      支持按最大页数连续拆分，或按多个自定义页码段输出多个 PDF，适合资料拆册与分段归档。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('pdf-tools', 'pdf-split')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">PDF 压缩</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      仅处理纯扫描件 PDF，按轻度、标准、强力三档重建页面图片并输出更小文件。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('pdf-tools', 'pdf-compress')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h3 class="text-lg font-semibold text-[var(--content-text)]">批量盖章</h3>
                    <p class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">
                      支持骑缝章和指定位置盖章，预览页中可直接用印章光标点击定位，批量输出新 PDF 副本。
                    </p>
                  </div>
                  <Button label="打开工具" @click="goTool('pdf-tools', 'pdf-batch-stamp')" />
                </div>
              </div>
              <div class="rounded-2xl border px-5 py-5" :style="cardInsetStyle">
                <div class="text-xs uppercase tracking-[0.18em] text-[var(--content-text-secondary)]">输出策略</div>
                <div class="mt-3 text-xl font-semibold text-[var(--content-text)]">合并 / 拆分 / 扫描压缩</div>
                <div class="mt-2 text-sm leading-7 text-[var(--content-text-secondary)]">支持逐文件范围合并、按页数规则拆分、纯扫描件压缩，以及批量盖章。</div>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="currentCollection === 'pdf-tools' && currentTool === 'pdf-merge'">
          <PdfMergeTool ref="pdfMergeToolRef" />
        </template>

        <template v-else-if="currentCollection === 'pdf-tools' && currentTool === 'pdf-split'">
          <PdfSplitTool ref="pdfSplitToolRef" />
        </template>

        <template v-else-if="currentCollection === 'pdf-tools' && currentTool === 'pdf-compress'">
          <PdfCompressTool ref="pdfCompressToolRef" />
        </template>

        <template v-else-if="currentCollection === 'pdf-tools' && currentTool === 'pdf-batch-stamp'">
          <PdfBatchStampTool ref="pdfBatchStampToolRef" />
        </template>

        <template v-else>
          <section class="toolbox-card">
            <h2 class="text-xl font-semibold text-[var(--content-text)]">未找到对应工具</h2>
            <p class="mt-3 text-sm text-[var(--content-text-secondary)]">当前路由指向的工具不存在，可以回到工具箱首页重新选择。</p>
            <div class="mt-5">
              <Button label="回到首页" @click="goHome" />
            </div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import WindowControls from '../../components/WindowControls.vue'
import type { ToolboxCollectionKey, ToolboxToolKey } from '../../../shared/types/toolbox.types'
import BatchImageOcrTool from './BatchImageOcrTool.vue'
import MultiImageToPdfTool from './MultiImageToPdfTool.vue'
import PdfMergeTool from './PdfMergeTool.vue'
import PdfSplitTool from './PdfSplitTool.vue'
import PdfCompressTool from './PdfCompressTool.vue'
import PdfBatchStampTool from './PdfBatchStampTool.vue'
import SignatureCutoutTool from './SignatureCutoutTool.vue'
import SealExtractionTool from './SealExtractionTool.vue'

const router = useRouter()
const route = useRoute()
const batchImageOcrToolRef = ref<InstanceType<typeof BatchImageOcrTool> | null>(null)
const multiImageToPdfToolRef = ref<InstanceType<typeof MultiImageToPdfTool> | null>(null)
const signatureCutoutToolRef = ref<InstanceType<typeof SignatureCutoutTool> | null>(null)
const sealExtractionToolRef = ref<InstanceType<typeof SealExtractionTool> | null>(null)
const pdfMergeToolRef = ref<InstanceType<typeof PdfMergeTool> | null>(null)
const pdfSplitToolRef = ref<InstanceType<typeof PdfSplitTool> | null>(null)
const pdfCompressToolRef = ref<InstanceType<typeof PdfCompressTool> | null>(null)
const pdfBatchStampToolRef = ref<InstanceType<typeof PdfBatchStampTool> | null>(null)

const collectionTitleMap: Record<ToolboxCollectionKey, string> = {
  'image-ocr': '图片OCR工具',
  'image-processing': '图片处理工具',
  'image-to-pdf': '图片转PDF工具',
  'pdf-tools': 'PDF工具',
}

const toolTitleMap: Record<ToolboxToolKey, string> = {
  'batch-image-ocr': '批量图片OCR',
  'signature-cutout': '签名抠图',
  'seal-extraction': '印章提取',
  'multi-image-to-pdf': '多图片转PDF',
  'pdf-merge': 'PDF合并',
  'pdf-split': 'PDF拆分',
  'pdf-compress': 'PDF压缩',
  'pdf-batch-stamp': '批量盖章',
}

const collectionDescriptionMap: Record<ToolboxCollectionKey, string> = {
  'image-ocr': '图片文字识别工具集合，当前已接入批量图片 OCR、逐张结果预览与 Word 导出能力。',
  'image-processing': '图片处理工具集合，当前已接入签名抠图与印章提取，支持透明 PNG 导出与后续办公素材整理。',
  'image-to-pdf': '把多张图片整理成标准 PDF，支持扫描目录、拖拽排序、预览缩放与 A4 单图单页导出。',
  'pdf-tools': 'PDF 文件处理工具集合，当前已接入 PDF 合并、拆分、扫描件压缩与批量盖章能力。',
}

const toolDescriptionMap: Record<ToolboxToolKey, string> = {
  'batch-image-ocr': '将多张图片逐张 OCR 识别并实时预览结果，适合扫描件整理、票据摘录和资料归档。',
  'signature-cutout': '将签名图片自动去背景并紧裁切为透明 PNG，适合合同、审批单和办公文档排版。',
  'seal-extraction': '将红色实体公章扫描图提取为透明 PNG，支持自动识别圆章/椭圆章区域与 DPI 放大导出。',
  'multi-image-to-pdf': '将多张图片快速整理为 PDF，适合合同扫描件、归档资料和打印输出场景。',
  'pdf-merge': '将多个 PDF 按顺序合并输出，支持逐文件设置页码范围，适合资料拼接与归档。',
  'pdf-split': '将单个或多个 PDF 按页数规则或自定义页码段拆分输出，适合拆册、分发与归档。',
  'pdf-compress': '仅处理纯扫描件 PDF，将页面重建为图片型 PDF 并按档位压缩体积。',
  'pdf-batch-stamp': '为多个 PDF 批量盖骑缝章或指定位置印章，支持预览点击定位和生成副本。',
}

const currentCollection = computed(() => {
  const value = route.params.collection
  return typeof value === 'string' ? value : ''
})

const currentTool = computed(() => {
  const value = route.params.tool
  return typeof value === 'string' ? value : ''
})

// 面包屑：只显示 2 级（工具箱 > 工具）。进入具体工具时不显示中间的集合层，
// 仅在没有具体工具的“集合过渡页”上才显示集合名。
const showCollectionBreadcrumb = computed(() => {
  return !!currentCollection.value && !currentTool.value
})

watchEffect(() => {
  if (currentCollection.value === 'image-ocr' && !currentTool.value) {
    void router.replace({
      name: 'ToolboxTool',
      params: {
        collection: 'image-ocr',
        tool: 'batch-image-ocr',
      },
    })
  }
})

const cardInsetStyle = {
  borderColor: 'var(--content-border)',
  backgroundColor: 'var(--content-card-bg)',
}

const currentPageTitle = computed(() => {
  if (currentTool.value) {
    return toolTitleMap[currentTool.value as ToolboxToolKey] ?? '工具详情'
  }
  if (currentCollection.value) {
    return collectionTitleMap[currentCollection.value as ToolboxCollectionKey] ?? '工具集合'
  }
  return '工具箱'
})

const currentPageDescription = computed(() => {
  if (currentTool.value) {
    return toolDescriptionMap[currentTool.value as ToolboxToolKey] ?? '当前工具详情页。'
  }
  if (currentCollection.value) {
    return collectionDescriptionMap[currentCollection.value as ToolboxCollectionKey] ?? '当前工具集合页。'
  }
  return '统一承接常用桌面工具，支持快速进入、整页操作和后续持续扩展。'
})

const goHome = async () => {
  await router.push({ name: 'ToolboxHome' })
}

const goCollection = async (collection: ToolboxCollectionKey) => {
  await router.push({ name: 'ToolboxCollection', params: { collection } })
}

const goTool = async (collection: ToolboxCollectionKey, tool: ToolboxToolKey) => {
  await router.push({ name: 'ToolboxTool', params: { collection, tool } })
}

const handleBack = async () => {
  if (currentTool.value && currentCollection.value) {
    await goHome()
    return
  }
  if (currentCollection.value) {
    await goHome()
    return
  }
  await router.push({ name: 'Resource' })
}
</script>

<style scoped>
.toolbox-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 72px;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--content-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--content-card-bg) 92%, white 8%), var(--content-card-bg));
  -webkit-app-region: drag;
}

.toolbox-card {
  border: 1px solid var(--content-border);
  border-radius: 1.5rem;
  background: var(--content-card-bg);
  padding: 1.5rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
}

.toolbox-card__icon {
  display: inline-flex;
  height: 3rem;
  width: 3rem;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  font-size: 1.125rem;
}

/* 工具箱首页卡片左上角的分类标签条，同类工具颜色一致，便于快速查找 */
.toolbox-category-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  border-radius: 0.5rem;
  padding: 0.25rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.toolbox-category-bar::before {
  content: '';
  display: inline-block;
  width: 0.3rem;
  height: 0.7rem;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.85;
}

.toolbox-category-bar--sky {
  background: rgba(14, 165, 233, 0.12);
  color: rgb(3, 105, 161);
}

.toolbox-category-bar--red {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.toolbox-category-bar--emerald {
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.toolbox-category-bar--amber {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(146, 64, 14);
}

.toolbox-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.45rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.toolbox-badge--live {
  background: rgba(22, 163, 74, 0.12);
  color: rgb(21, 128, 61);
}

.toolbox-badge--pending {
  background: rgba(14, 165, 233, 0.12);
  color: rgb(3, 105, 161);
}

.toolbox-collection-card {
  border: 1px solid var(--content-border);
  border-radius: 1.25rem;
  background: var(--content-card-bg);
  padding: 1.25rem;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.toolbox-collection-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
}

.toolbox-collection-card--active {
  border-color: color-mix(in srgb, var(--btn-primary-bg) 45%, var(--content-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--btn-primary-bg) 18%, transparent);
}

/* 分组聚合布局：每组一个标题行，下方横向排列同类工具卡片 */
.toolbox-groups {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.toolbox-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbox-group-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.toolbox-group-bar {
  width: 0.25rem;
  height: 1.4rem;
  border-radius: 9999px;
}

.toolbox-group-bar--emerald {
  background: rgb(16, 185, 129);
}

.toolbox-group-bar--sky {
  background: rgb(14, 165, 233);
}

.toolbox-group-bar--amber {
  background: rgb(245, 158, 11);
}

.toolbox-group-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--content-text);
}

.toolbox-group-count {
  font-size: 0.75rem;
  color: var(--content-text-secondary);
  background: color-mix(in srgb, var(--content-card-bg) 80%, var(--content-border));
  border: 1px solid var(--content-border);
  border-radius: 9999px;
  padding: 0.15rem 0.6rem;
}

/* 紧凑横向卡片：图标 + 标题 + 简短描述 */
.toolbox-mini-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid var(--content-border);
  border-radius: 1rem;
  background: var(--content-card-bg);
  padding: 1rem;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.toolbox-mini-card:hover {
  transform: translateY(-1px);
  border-color: var(--btn-primary-bg);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
}

.toolbox-card__icon--sm {
  height: 2.5rem;
  width: 2.5rem;
  border-radius: 0.75rem;
  font-size: 1rem;
}

.toolbox-mini-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--content-text);
}

.toolbox-mini-card__desc {
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--content-text-secondary);
}

.toolbox-link {
  color: inherit;
}

.toolbox-link:hover:not(:disabled) {
  color: var(--content-text);
}

.toolbox-link--current {
  color: var(--content-text);
}

.toolbox-link:disabled {
  cursor: default;
  opacity: 0.85;
}
</style>
