<template>
  <div
    class="calendar-view h-full flex flex-col transition-colors duration-200"
    :style="{ backgroundColor: 'var(--content-bg)' }"
  >
    <!-- 顶部工具栏 -->
    <div
      class="toolbar flex items-center justify-between px-4 py-3 border-b transition-colors duration-200"
      style="-webkit-app-region: drag;"
      :style="{ borderColor: 'var(--content-border)' }"
    >
      <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
        <Button
          icon="pi pi-arrow-left"
          text
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          v-tooltip.bottom="'返回'"
          @click="handleBack"
        />
        <div class="h-5 w-px bg-[var(--content-border)]"></div>
        <span class="font-semibold text-[var(--content-text)]">日历</span>
        <div class="h-5 w-px bg-[var(--content-border)]"></div>
        <Button
          icon="pi pi-chevron-left"
          text
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          v-tooltip.bottom="'上一个月'"
          @click="previousMonth"
        />
        <span class="text-[var(--content-text-secondary)] min-w-[90px] text-center">{{ currentMonthLabel }}</span>
        <Button
          icon="pi pi-chevron-right"
          text
          class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
          v-tooltip.bottom="'下一个月'"
          @click="nextMonth"
        />
      </div>

      <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
        <div class="flex items-center gap-2">
          <IconField iconPosition="left">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="搜索事件..."
              class="w-48"
            />
          </IconField>
          <Button
            icon="pi pi-filter"
            class="p-button-sm p-button-secondary p-button-text !w-8 !h-8 !p-0 custom-icon-btn"
            :class="{ '!bg-[var(--sidebar-active-bg)] !text-[var(--btn-primary-bg)]': filterBarVisible }"
            v-tooltip.bottom="'过滤'"
            @click="filterBarVisible = !filterBarVisible"
          />
        </div>
        <WindowControls />
      </div>
    </div>

    <!-- 高级过滤栏 -->
    <div v-if="filterBarVisible" class="shrink-0 border-b border-[var(--content-border)] bg-[var(--content-bg)]/80 backdrop-blur-md px-4 py-2 transition-colors duration-200">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- 最近 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverRecent, $event)"
        >
          <i class="pi pi-clock"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>最近</span>
            <span v-if="proxyFilters.recent?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ recentOptions.filter(o => proxyFilters.recent.includes(o.value)).map(o => o.label).join(', ') }}
            </span>
            <span
              v-if="proxyFilters.recent?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('recent')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover ref="popoverRecent" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-56 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">最近</div>
                <button
                  v-if="proxyFilters.recent?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('recent')"
                >
                  清空
                </button>
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in recentOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('recent', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('recent', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('recent', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Popover>

        <!-- 来源 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverSourceCategory, $event)"
        >
          <i class="pi pi-tags"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>来源</span>
            <span v-if="proxyFilters.sourceCategory?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ sourceCategoryOptions.filter(o => proxyFilters.sourceCategory.includes(o.value)).map(o => o.label).join(', ') }}
            </span>
            <span
              v-if="proxyFilters.sourceCategory?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('sourceCategory')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover ref="popoverSourceCategory" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-56 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">来源</div>
                <button
                  v-if="proxyFilters.sourceCategory?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('sourceCategory')"
                >
                  清空
                </button>
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in sourceCategoryOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('sourceCategory', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('sourceCategory', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('sourceCategory', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Popover>

        <!-- 甲方单位 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverPartyA, $event)"
        >
          <i class="pi pi-building"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>甲方单位</span>
            <span v-if="proxyFilters.partyA?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ proxyFilters.partyA.join(', ') }}
            </span>
            <span
              v-if="proxyFilters.partyA?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('partyA')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover
          ref="popoverPartyA"
          appendTo="body"
          :baseZIndex="3000"
          :autoZIndex="true"
          style="background: transparent; border: none; box-shadow: none;"
        >
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">甲方单位</div>
                <button
                  v-if="proxyFilters.partyA?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('partyA')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.partyA"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in partyAOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('partyA', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('partyA', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('partyA', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="partyAOptions.length === 0" class="px-3 py-2 text-[var(--content-text-secondary)]">
                  无匹配数据
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <!-- 乙方单位 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverPartyB, $event)"
        >
          <i class="pi pi-building"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>乙方单位</span>
            <span v-if="proxyFilters.partyB?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ proxyFilters.partyB.join(', ') }}
            </span>
            <span
              v-if="proxyFilters.partyB?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('partyB')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover ref="popoverPartyB" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">乙方单位</div>
                <button
                  v-if="proxyFilters.partyB?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('partyB')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.partyB"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in partyBOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('partyB', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('partyB', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('partyB', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="partyBOptions.length === 0" class="px-3 py-2 text-[var(--content-text-secondary)]">
                  无匹配数据
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <!-- 合同类型 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverContractType, $event)"
        >
          <i class="pi pi-file"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>合同类型</span>
            <span v-if="proxyFilters.contractType?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ proxyFilters.contractType.join(', ') }}
            </span>
            <span
              v-if="proxyFilters.contractType?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('contractType')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover ref="popoverContractType" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">合同类型</div>
                <button
                  v-if="proxyFilters.contractType?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('contractType')"
                >
                  清空
                </button>
              </div>
              <div class="mb-2">
                <InputText
                  v-model="filterSearchInputs.contractType"
                  class="w-full !bg-[var(--input-bg)] !border-[var(--input-border)] !text-[var(--content-text)] placeholder:!text-[var(--content-text-secondary)] focus:!border-[var(--btn-primary-bg)]"
                  placeholder="搜索..."
                />
              </div>
              <div class="max-h-72 overflow-auto">
                <button
                  v-for="opt in contractTypeOptions"
                  :key="opt.value"
                  type="button"
                  class="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors text-[var(--content-text)] hover:bg-[var(--sidebar-hover-bg)]"
                  @click="toggleFilterOption('contractType', opt.value)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Checkbox
                      :modelValue="isFilterOptionSelected('contractType', opt.value)"
                      binary
                      @click.stop
                      @update:modelValue="toggleFilterOption('contractType', opt.value)"
                    />
                    <span class="truncate" :title="opt.label">{{ opt.label }}</span>
                  </span>
                </button>
                <div v-if="contractTypeOptions.length === 0" class="px-3 py-2 text-[var(--content-text-secondary)]">
                  无匹配数据
                </div>
              </div>
            </div>
          </div>
        </Popover>

        <!-- 日期 -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
          @click="togglePopover(popoverDate, $event)"
        >
          <i class="pi pi-calendar"></i>
          <span class="flex items-center gap-1.5 min-w-0">
            <span>日期</span>
            <span v-if="proxyFilters.date?.length" class="text-[var(--content-text-secondary)] truncate max-w-40">
              {{ dateLabel }}
            </span>
            <span
              v-if="proxyFilters.date?.length"
              class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--content-text-secondary)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--content-text)] transition-colors"
              @click.stop="clearFilter('date')"
            >
              <i class="pi pi-times"></i>
            </span>
          </span>
        </button>

        <Popover ref="popoverDate" style="background: transparent; border: none; box-shadow: none;">
          <div class="w-72 rounded-xl border border-[var(--content-border)] bg-[var(--content-bg)] p-2 shadow-xl">
            <div class="p-1">
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="font-medium text-[var(--content-text)]">日期</div>
                <button
                  v-if="proxyFilters.date?.length"
                  type="button"
                  class="text-[var(--content-text-secondary)] hover:text-[var(--content-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--sidebar-hover-bg)]"
                  @click="clearFilter('date')"
                >
                  清空
                </button>
              </div>
              <div>
                <DatePicker
                  v-model="dateValue"
                  dateFormat="yy-mm-dd"
                  inline
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </Popover>

      </div>
    </div>

    <!-- 日历主体 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧日历网格 -->
      <div class="flex-1 flex flex-col p-4">
        <!-- 星期标题 -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div
            v-for="day in weekDays"
            :key="day"
            class="text-center font-medium py-2 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            {{ day }}
          </div>
        </div>

        <!-- 日期网格 -->
        <div class="flex-1 grid grid-cols-7 gap-1">
          <div
            v-for="(date, index) in calendarDays"
            :key="index"
            class="calendar-day relative p-2 rounded-lg cursor-pointer transition-all duration-150 border"
            :class="{ 'other-month': !date.isCurrentMonth, 'today': date.isToday, 'selected': isSelected(date) }"
            :style="getDayStyle(date)"
            @click="selectDate(date)"
          >
            <!-- 日期数字 -->
            <span
              class="day-number"
              :style="{ color: date.isCurrentMonth ? 'var(--content-text)' : 'var(--content-text-muted)' }"
            >
              {{ date.day }}
            </span>

            <!-- 事件标记 -->
            <div v-if="date.events.length > 0" class="mt-1 space-y-0.5">
              <div
                v-for="event in date.events.slice(0, 3)"
                :key="event.id"
                class="event-dot px-1.5 py-0.5 rounded truncate"
                :style="getEventStyle(event)"
              >
                {{ event.title }}
              </div>
              <div
                v-if="date.events.length > 3"
                class="px-1.5"
                :style="{ color: 'var(--content-text-secondary)' }"
              >
                +{{ date.events.length - 3 }} 更多
              </div>
            </div>
          </div>
        </div>

        <!-- 图例 -->
        <div
          class="legend flex items-center gap-4 mt-4 pt-3 border-t"
          :style="{ borderColor: 'var(--content-border)' }"
        >
          <span :style="{ color: 'var(--content-text-secondary)' }">图例:</span>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <span :style="{ color: 'var(--content-text)' }">待处理</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span :style="{ color: 'var(--content-text)' }">已完成</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span :style="{ color: 'var(--content-text)' }">高优先级</span>
          </div>
        </div>
      </div>

      <Separator
        :rightWidth="eventPanelWidth"
        :minWidth="eventPanelMinWidth"
        @resize="setEventPanelWidth"
      />

      <!-- 右侧事件面板 -->
      <div
        class="event-panel flex-shrink-0 p-4 overflow-y-auto transition-colors duration-200"
        :style="{
          width: `${eventPanelWidth}px`,
          backgroundColor: 'var(--sidebar-bg)'
        }"
      >
        <!-- 选中日期标题 -->
        <h3
          class="font-semibold mb-4 transition-colors duration-200"
          :style="{ color: 'var(--content-text)' }"
        >
          {{ selectedDateLabel }}
        </h3>

        <!-- 待办事项列表 -->
        <div class="space-y-3">
          <h4
            class="font-semibold uppercase tracking-wide mb-2 transition-colors duration-200"
            :style="{ color: 'var(--content-text-secondary)' }"
          >
            待办事项
          </h4>

          <div
            v-for="event in selectedDateEvents"
            :key="event.id"
            class="event-card p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md"
            :style="{
              backgroundColor: 'var(--content-card-bg)',
              borderColor: 'var(--content-border)'
            }"
            @click="openEvent(event)"
          >
            <div class="flex items-start gap-2">
              <span class="">{{ event.icon }}</span>
              <div class="flex-1 min-w-0">
                <div
                  class="font-medium truncate transition-colors duration-200"
                  :style="{ color: 'var(--content-text)' }"
                >
                  {{ event.title }}
                </div>
                <div
                  class="mt-0.5 transition-colors duration-200"
                  :style="{ color: 'var(--content-text-secondary)' }"
                >
                  {{ event.projectName }}
                </div>
                <div class="flex items-center gap-2 mt-1.5">
                  <Tag
                    :value="event.priority"
                    :severity="getPrioritySeverity(event.priority)"
                    class=""
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-if="selectedDateEvents.length === 0"
            class="text-center py-8 opacity-50"
          >
            <i class="pi pi-calendar mb-2" :style="{ color: 'var(--content-text-secondary)' }"></i>
            <p class="" :style="{ color: 'var(--content-text-secondary)' }">
              暂无待办事项
            </p>
          </div>
        </div>

        <!-- 添加提醒按钮 -->
        <Button
          label="+ 添加提醒"
          class="w-full mt-4"
          outlined
          size="small"
          @click="addReminder"
        />
      </div>
    </div>
  </div>

  <Dialog
    v-model:visible="reminderDialogVisible"
    modal
    header="添加提醒"
    :style="{ width: '560px' }"
    :closeOnEscape="true"
    class="custom-dialog"
  >
    <div class="grid grid-cols-2 gap-x-6 gap-y-2 py-2">
      <div class="flex items-start col-span-2">
        <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 标题</label>
        <div class="flex-1 flex flex-col">
          <InputText v-model="reminderForm.title" class="w-full" placeholder="请输入提醒标题" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ reminderErrors.title }}</small>
        </div>
      </div>

      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]"><span class="text-red-500">*</span> 日期</label>
        <div class="flex-1 flex flex-col">
          <DatePicker v-model="reminderForm.dateValue" date-format="yy-mm-dd" show-icon class="w-full" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]">{{ reminderErrors.date }}</small>
        </div>
      </div>

      <div class="flex items-start">
        <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">优先级</label>
        <div class="flex-1 flex flex-col">
          <Dropdown
            v-model="reminderForm.severity"
            :options="reminderSeverityOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="选择优先级"
            class="w-full"
          />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
        </div>
      </div>

      <div class="flex items-start col-span-2">
        <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">项目/编号</label>
        <div class="flex-1 flex flex-col">
          <InputText v-model="reminderForm.projectName" class="w-full" placeholder="可选：用于右侧列表展示" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
        </div>
      </div>

      <div class="flex items-start col-span-2">
        <label class="w-24 text-right mr-3 mt-2 text-[var(--content-text)]">备注</label>
        <div class="flex-1 flex flex-col">
          <Textarea v-model="reminderForm.content" class="w-full" autoResize rows="4" />
          <small class="text-red-500 mt-1 text-xs min-h-[16px]"></small>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" class="p-button-text" :disabled="reminderSaving" @click="reminderDialogVisible = false" />
        <Button label="保存" class="p-button-primary" :loading="reminderSaving" :disabled="reminderSaving" @click="saveReminder" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Tag from 'primevue/tag'
import Checkbox from 'primevue/checkbox'
import Dropdown from 'primevue/dropdown'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import WindowControls from '../../components/WindowControls.vue'
import Separator from '../../components/Separator.vue'
import { createRendererLogger } from '@/utils/logger'
import { useLibraryStore } from '@/stores/library/libraryStore'
import { eventBus } from '../../utils/eventBus'
import type { LibraryCalendarEventEntity } from '../../../shared/types/libraryCalendarEvent.types'
import type { CalendarDay, CalendarEvent } from './calendar/calendarTypes'
import { weekDays } from './calendar/calendarConstants'
import { useCalendarFilters } from './calendar/useCalendarFilters'

const logger = createRendererLogger('CalendarView')
const libraryStore = useLibraryStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// 响应式状态
const currentDate = ref(new Date())
const selectedDate = ref(new Date())
const searchQuery = ref('')

const eventPanelMinWidth = 240
const eventPanelMaxWidth = 640
const eventPanelWidth = ref(288)

const setEventPanelWidth = (width: number) => {
  const next = Math.max(eventPanelMinWidth, Math.min(eventPanelMaxWidth, Math.round(width)))
  eventPanelWidth.value = next
  localStorage.setItem('calendar:eventPanelWidth', String(next))
}

watch(
  () => route.query.q,
  (q) => {
    const queryStr = Array.isArray(q) ? String(q[0] || '') : String(q || '')
    if (queryStr !== searchQuery.value) {
      searchQuery.value = queryStr
    }
  },
  { immediate: true }
)

// 模拟事件数据
const events = ref<CalendarEvent[]>([])
const hasAttemptedRebuild = ref(false)
let offCalendarEventsChanged: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const getLibraryPath = () => String(libraryStore.currentLibrary?.path || localStorage.getItem('currentLibraryPath') || '').trim()
const {
  filterBarVisible,
  proxyFilters,
  filterSearchInputs,
  popoverRecent,
  popoverSourceCategory,
  popoverPartyA,
  popoverPartyB,
  popoverContractType,
  popoverDate,
  togglePopover,
  clearFilter,
  toggleFilterOption,
  isFilterOptionSelected,
  loadFilterOptions,
  partyAOptions,
  partyBOptions,
  contractTypeOptions,
  sourceCategoryOptions,
  recentOptions,
  dateValue,
  dateLabel,
  filteredEvents: filteredEventsByFilters
} = useCalendarFilters({ events, getLibraryPath, logger })

const filteredEvents = computed(() => {
  let result = filteredEventsByFilters.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((e) =>
      String(e.title || '').toLowerCase().includes(q) ||
      String(e.projectName || '').toLowerCase().includes(q)
    )
  }
  return result
})

const currentMonthLabel = computed(() => {
  const y = currentDate.value.getFullYear()
  const m = String(currentDate.value.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
})

function formatYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCalendarGridRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 41)
  return { start, end }
}

function mapEvent(entity: LibraryCalendarEventEntity): CalendarEvent | null {
  const ymd = String(entity.event_date || '').trim()
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))

  let contractCode = ''
  let partyA = ''
  let partyB = ''
  let contractType = ''
  let sourceCategory: 'contract' | 'product' = 'contract'
  try {
    const meta = entity.meta ? JSON.parse(entity.meta) : null
    contractCode = String(meta?.contract_code || meta?.contractCode || '').trim()
    partyA = String(meta?.party_a || meta?.partyA || '').trim()
    partyB = String(meta?.party_b || meta?.partyB || '').trim()
    contractType = String(meta?.contract_type || meta?.contractType || '').trim()
    const category = String(meta?.source_category || '').trim()
    if (category === 'product') sourceCategory = 'product'
  } catch {
  }

  const severity = String(entity.severity || 'info').trim()
  const ui = severity === 'danger'
    ? { type: 'urgent' as const, priority: '高优先级' as const, icon: '⚠️' }
    : severity === 'warning'
      ? { type: 'pending' as const, priority: '普通' as const, icon: '📅' }
      : { type: 'pending' as const, priority: '低优先级' as const, icon: '📄' }
  if (sourceCategory === 'product') {
    ui.icon = '📦'
  }

  return {
    id: entity.id,
    title: entity.title,
    projectName: contractCode || entity.source_id,
    date,
    type: ui.type,
    priority: ui.priority,
    icon: ui.icon,
    partyA,
    partyB,
    contractType,
    sourceCategory
  }
}

async function fetchMonthEvents(): Promise<void> {
  const libraryPath = String(libraryStore.currentLibrary?.path || localStorage.getItem('currentLibraryPath') || '').trim()
  if (!libraryPath) return

  const { start, end } = getCalendarGridRange(currentDate.value)
  const startDate = formatYmd(start)
  const endDate = formatYmd(end)

  const res = await window.electronAPI.library.getCalendarEvents({ libraryPath, startDate, endDate })
  if (!res.success) {
    logger.error('读取日历事件失败:', res.error)
    return
  }

  const data = Array.isArray(res.data) ? res.data : []
  if (!data.length && !hasAttemptedRebuild.value) {
    hasAttemptedRebuild.value = true
    const rebuild = await window.electronAPI.library.rebuildCalendarEvents({ libraryPath })
    if (!rebuild.success) {
      logger.error('重建日历事件失败:', rebuild.error)
      return
    }
    const res2 = await window.electronAPI.library.getCalendarEvents({ libraryPath, startDate, endDate })
    if (!res2.success) {
      logger.error('读取日历事件失败:', res2.error)
      return
    }
    const data2 = Array.isArray(res2.data) ? res2.data : []
    events.value = data2.map(mapEvent).filter(Boolean) as CalendarEvent[]
    return
  }

  events.value = data.map(mapEvent).filter(Boolean) as CalendarEvent[]
}

// 计算属性：日历天数
const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())

  const days: CalendarDay[] = []
  const today = new Date()

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    const dayEvents = filteredEvents.value.filter(e =>
      e.date.getDate() === date.getDate() &&
      e.date.getMonth() === date.getMonth() &&
      e.date.getFullYear() === date.getFullYear()
    )

    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: date.toDateString() === today.toDateString(),
      events: dayEvents
    })
  }

  return days
})

// 计算属性：选中日期的事件
const selectedDateEvents = computed(() => {
  return filteredEvents.value.filter(e =>
    e.date.getDate() === selectedDate.value.getDate() &&
    e.date.getMonth() === selectedDate.value.getMonth() &&
    e.date.getFullYear() === selectedDate.value.getFullYear()
  )
})

// 计算属性：选中日期标签
const selectedDateLabel = computed(() => {
  const month = selectedDate.value.getMonth() + 1
  const day = selectedDate.value.getDate()
  return `${month}月${day}日`
})

// 方法：获取日期单元格样式
const getDayStyle = (date: CalendarDay) => {
  const isSelected = isSelectedDate(date)
  return {
    backgroundColor: isSelected ? 'var(--sidebar-active-bg)' : 'var(--content-card-bg)',
    borderColor: date.isToday ? 'var(--sidebar-active-border)' : 'var(--content-border)'
  }
}

// 方法：获取事件样式
const getEventStyle = (event: CalendarEvent) => {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'rgba(59, 130, 246, 0.24)', text: '#1d4ed8' },
    completed: { bg: 'rgba(34, 197, 94, 0.24)', text: '#15803d' },
    urgent: { bg: 'rgba(239, 68, 68, 0.24)', text: '#dc2626' }
  }
  const color = colors[event.type] || colors.pending
  return {
    backgroundColor: color.bg,
    color: color.text
  }
}

// 方法：获取优先级样式
const getPrioritySeverity = (priority: string) => {
  const map: Record<string, string> = {
    '高优先级': 'danger',
    '普通': 'info',
    '低优先级': 'success'
  }
  return map[priority] || 'info'
}

// 方法：是否选中
const isSelected = (date: CalendarDay) => {
  return isSelectedDate(date)
}

// 方法：是否选中日期
const isSelectedDate = (date: CalendarDay) => {
  return date.date.toDateString() === selectedDate.value.toDateString()
}

// 方法：选择日期
const selectDate = (date: CalendarDay) => {
  selectedDate.value = date.date
}

// 方法：上一个月
const previousMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

// 方法：下一个月
const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

const handleBack = () => {
  router.back()
}

// 方法：回到今天
const goToToday = () => {
  const today = new Date()
  currentDate.value = today
  selectedDate.value = today
}

// 方法：打开事件
const openEvent = (event: CalendarEvent) => {
  logger.info('打开事件:', event)
}

// 方法：添加提醒
const addReminder = () => {
  reminderErrors.value = { title: '', date: '' }
  reminderForm.value = {
    title: '',
    dateValue: new Date(selectedDate.value),
    severity: 'warning',
    projectName: '',
    content: '',
  }
  reminderDialogVisible.value = true
}

const reminderDialogVisible = ref(false)
const reminderSaving = ref(false)
const reminderErrors = ref({ title: '', date: '' })
const reminderSeverityOptions = [
  { label: '低优先级', value: 'info' },
  { label: '普通', value: 'warning' },
  { label: '高优先级', value: 'danger' },
] as const

const reminderForm = ref<{
  title: string
  dateValue: Date | null
  severity: 'info' | 'warning' | 'danger'
  projectName: string
  content: string
}>({
  title: '',
  dateValue: null,
  severity: 'warning',
  projectName: '',
  content: '',
})

const saveReminder = async () => {
  reminderErrors.value = { title: '', date: '' }
  const title = String(reminderForm.value.title || '').trim()
  if (!title) reminderErrors.value.title = '请输入标题'

  const dateValue = reminderForm.value.dateValue
  if (!dateValue) reminderErrors.value.date = '请选择日期'

  if (reminderErrors.value.title || reminderErrors.value.date) return

  const libraryPath = getLibraryPath()
  if (!libraryPath) {
    toast.add({ severity: 'warn', summary: '提示', detail: '未选择资源库', life: 2500 })
    return
  }

  reminderSaving.value = true
  try {
    const projectName = String(reminderForm.value.projectName || '').trim()
    const res = await window.electronAPI.library.createManualCalendarReminder({
      libraryPath,
      eventDate: formatYmd(dateValue!),
      title,
      content: String(reminderForm.value.content || '').trim() || null,
      severity: reminderForm.value.severity,
      meta: {
        contract_code: projectName || title,
      },
    })

    if (!res.success) {
      toast.add({ severity: 'error', summary: '保存失败', detail: String(res.error || '未知错误'), life: 3500 })
      return
    }

    reminderDialogVisible.value = false
    toast.add({ severity: 'success', summary: '已保存', detail: '提醒已添加', life: 1800 })
    await fetchMonthEvents()
    eventBus.emit('calendar-events:changed', { libraryPath, sourceType: 'manual' })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: '保存失败', detail: String(err?.message || err || '未知错误'), life: 3500 })
  } finally {
    reminderSaving.value = false
  }
}

onMounted(() => {
  const cachedWidth = Number(localStorage.getItem('calendar:eventPanelWidth'))
  if (Number.isFinite(cachedWidth) && cachedWidth > 0) {
    setEventPanelWidth(cachedWidth)
  } else {
    setEventPanelWidth(eventPanelWidth.value)
  }

  const handler = (payload: any) => {
    const currentLibraryPath = getLibraryPath()
    const payloadLibraryPath = String(payload?.libraryPath || '').trim()
    if (!currentLibraryPath || !payloadLibraryPath || payloadLibraryPath !== currentLibraryPath) return
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      fetchMonthEvents().catch(err => logger.error('加载日历事件失败:', err))
    }, 250)
  }
  eventBus.on('calendar-events:changed', handler)
  offCalendarEventsChanged = () => eventBus.off('calendar-events:changed', handler)
  fetchMonthEvents().catch(err => logger.error('加载日历事件失败:', err))
  loadFilterOptions()
})

onBeforeUnmount(() => {
  if (offCalendarEventsChanged) {
    offCalendarEventsChanged()
    offCalendarEventsChanged = null
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
})

watch(() => [currentDate.value.getFullYear(), currentDate.value.getMonth()], () => {
  fetchMonthEvents().catch(err => logger.error('加载日历事件失败:', err))
})
</script>

<style scoped>
.calendar-view {
  font-size: 1rem;
}

.calendar-day {
  min-height: 96px;
}

.day-number {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.2;
}

.event-dot {
  font-size: 0.875rem;
  line-height: 1.35;
  font-weight: 600;
}

.event-panel :deep(.p-tag) {
  font-size: 0.875rem;
}
</style>

