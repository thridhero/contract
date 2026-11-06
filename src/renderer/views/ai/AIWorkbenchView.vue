<template>
  <div class="h-full flex bg-content-bg text-content-text">
    <aside class="w-[280px] border-r border-content-border flex flex-col bg-content-card">
      <div class="p-4 border-b border-content-border flex items-center justify-between gap-3" style="-webkit-app-region: drag;">
        <div class="flex items-center gap-3 min-w-0">
          <div class="min-w-0">
            <div class="text-base font-semibold">AI 工作台</div>
            <button
              type="button"
              class="mt-1 inline-flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 text-xs text-content-text-muted transition-colors hover:bg-content-hover hover:text-content-text disabled:cursor-not-allowed disabled:opacity-60"
              style="-webkit-app-region: no-drag;"
              :disabled="!currentLibraryPath"
              :title="currentLibraryPath || '未选择资源库'"
              @click="openCurrentLibraryFolder"
            >
              <i class="pi pi-folder text-[11px]" />
              <span class="truncate">{{ currentLibraryPath || '未选择资源库' }}</span>
            </button>
          </div>
        </div>
        <div style="-webkit-app-region: no-drag;">
          <Button
            icon="pi pi-plus"
            size="small"
            text
            rounded
            aria-label="新建会话"
            v-tooltip.bottom="'新建会话'"
            :disabled="!currentLibraryPath"
            @click="handleCreateSession"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2" @contextmenu.prevent.stop="onSessionListBlankContextMenu">
        <button
          v-for="item in sessions"
          :key="item.id"
          type="button"
          class="rounded-xl border px-3 py-3 text-left transition-colors"
          :class="item.id === currentSession?.id ? 'border-btn-primary-bg bg-btn-primary-bg/10' : 'border-content-border hover:bg-content-hover'"
          @click="openSession(item.id)"
          @contextmenu.prevent.stop="onSessionContextMenu($event, item.id)"
        >
          <div class="text-sm font-medium truncate">{{ item.title }}</div>
          <div class="text-xs text-content-text-muted mt-1 line-clamp-2">{{ item.lastMessagePreview || '暂无消息' }}</div>
          <div class="text-[11px] text-content-text-muted mt-2">{{ formatTime(item.updatedAt) }}</div>
        </button>
      </div>
      <ContextMenu ref="sessionContextMenuRef" :model="sessionContextMenuItems" @hide="sessionContextTargetId = null" />
    </aside>

    <section class="flex-1 min-w-0 flex flex-col">
      <div class="px-6 py-4 border-b border-content-border flex items-center justify-between" style="-webkit-app-region: drag;">
        <div>
          <div class="text-base font-semibold">{{ currentSession?.title || '未选择会话' }}</div>
          <div class="text-xs text-content-text-muted mt-1">
            支持合同、甲乙方单位、发票、员工信息查询与上下文压缩
          </div>
        </div>
        <div style="-webkit-app-region: no-drag;">
          <div class="flex items-center gap-2">
            <Button
              v-if="currentSession"
              icon="pi pi-pencil"
              size="small"
              text
              rounded
              aria-label="重命名"
              v-tooltip.bottom="'重命名'"
              @click="openRenameDialog"
            />
            <Button
              v-if="currentSession"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              text
              rounded
              aria-label="删除会话"
              v-tooltip.bottom="'删除会话'"
              @click="handleDeleteSession"
            />
            <WindowControls />
          </div>
        </div>
      </div>

      <div v-if="!currentLibraryPath" class="m-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700">
        未检测到当前资源库，请先进入资源库后再使用 AI 合同查询。
      </div>

      <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        <template v-if="currentSession?.messages?.length">
          <div
            v-for="message in currentSession.messages"
            :key="message.id"
            class="flex"
            :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div class="flex flex-col" :class="message.role === 'user' ? 'items-end' : 'items-start'">
              <div
                class="max-w-[880px] rounded-2xl px-4 py-3 shadow-sm"
                :class="message.role === 'user' ? 'bg-btn-primary-bg text-white' : 'bg-content-card border border-content-border'"
              >
                <div v-if="roleLabelMap[message.role]" class="text-xs opacity-70 mb-2">{{ roleLabelMap[message.role] }}</div>
                <AIAgentMessageContent :role="message.role" :content="message.content" />
                <div v-if="message.toolCalls?.length" class="mt-4 flex flex-col gap-3">
                  <div
                    v-for="tool in message.toolCalls"
                    :key="tool.id"
                    class="rounded-xl border border-content-border bg-content-bg px-3 py-3 text-content-text"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="text-sm font-medium">{{ tool.title }}</div>
                      <Tag :severity="tool.status === 'success' ? 'success' : 'danger'" :value="tool.status === 'success' ? '成功' : '失败'" />
                    </div>
                    <div class="text-xs text-content-text-muted mt-2">参数：{{ formatArgs(tool.args) }}</div>
                    <div class="mt-2 flex items-start justify-between gap-2">
                      <div
                        class="min-w-0 text-sm break-words leading-6"
                        :class="isToolSummaryExpanded(tool.id) ? 'whitespace-pre-wrap' : 'truncate'"
                      >
                        {{ tool.summary }}
                      </div>
                      <Button
                        v-if="shouldShowSummaryToggle(tool.summary)"
                        size="small"
                        text
                        :label="isToolSummaryExpanded(tool.id) ? '收起' : '展开'"
                        class="shrink-0 !py-0"
                        @click="toggleToolSummary(tool.id)"
                      />
                    </div>
                    <div v-if="getFileSearchResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag severity="info" :value="`检索词：${getFileSearchResult(tool)!.keyword || '-'}`" />
                        <Tag severity="contrast" :value="`命中文件：${getFileSearchResult(tool)!.total}`" />
                        <Tag
                          v-if="getFileSearchResult(tool)!.indexing"
                          severity="warn"
                          value="索引更新中"
                        />
                      </div>
                      <div
                        v-if="getFileSearchResult(tool)!.lastError"
                        class="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700"
                      >
                        索引提示：{{ getFileSearchResult(tool)!.lastError }}
                      </div>
                      <div v-if="getFileSearchResult(tool)!.items.length" class="mt-3 flex flex-col gap-2">
                        <button
                          v-for="item in getFileSearchResult(tool)!.items"
                          :key="`${tool.id}-${item.fileId || item.filePath}`"
                          type="button"
                          class="rounded-lg border border-content-border bg-content-bg px-3 py-3 text-left transition-colors hover:border-primary-400 hover:bg-[var(--sidebar-hover-bg)]"
                          @click="openFilePreview(item)"
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <div class="truncate text-sm font-medium">{{ item.fileName || '未命名文件' }}</div>
                              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-content-text-muted">
                                <span class="truncate">{{ formatFileSearchCardTitle(item) }}</span>
                                <Tag
                                  :severity="item.sourceType === 'contract' ? 'info' : 'contrast'"
                                  :value="item.sourceType === 'contract' ? '合同文件' : '其他文件'"
                                />
                              </div>
                            </div>
                            <Tag :severity="item.canPreview ? 'success' : 'secondary'" :value="item.canPreview ? '可预览' : '不可预览'" />
                          </div>
                          <div class="mt-2 text-xs leading-5 text-content-text-muted break-words">
                            <div class="truncate">位置：{{ formatFileSearchLocation(item) }}</div>
                            <div class="mt-1" v-html="toSafeSnippetHtml(item.snippet)"></div>
                          </div>
                        </button>
                      </div>
                    </div>
                    <div v-if="getProductSearchResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag
                          v-if="getProductSearchResult(tool)!.keyword"
                          severity="info"
                          :value="`产品编码：${getProductSearchResult(tool)!.keyword}`"
                        />
                        <Tag severity="contrast" :value="`匹配产品：${getProductSearchResult(tool)!.total}`" />
                        <Tag
                          v-if="getProductSearchResult(tool)!.warrantyStatus"
                          :severity="getProductSearchResult(tool)!.warrantyStatus === 'expired' ? 'danger' : 'success'"
                          :value="getProductSearchResult(tool)!.warrantyStatus === 'expired' ? '已过保' : '未过保'"
                        />
                      </div>
                      <div v-if="getProductSearchResult(tool)!.items.length" class="mt-3 flex flex-col gap-2">
                        <div
                          v-for="item in getProductSearchResult(tool)!.items"
                          :key="item.id"
                          class="rounded-lg border border-content-border bg-content-bg px-3 py-3"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-medium">{{ item.name || '-' }}</div>
                            <div class="text-xs text-content-text-muted">{{ item.code || '未填写编码' }}</div>
                          </div>
                          <div class="mt-2 text-xs text-content-text-muted leading-5">
                            <div>规格：{{ item.specification || '-' }}</div>
                            <div>分类：{{ item.category || '-' }}</div>
                            <div>维保日期：{{ item.warrantyDate || '-' }}</div>
                            <div>状态：{{ formatProductWarrantyStatus(item.warrantyStatus) }}</div>
                            <div>合同：{{ formatProductContract(item) }}</div>
                            <div>甲方：{{ item.customerName || '-' }}</div>
                            <div>乙方：{{ item.supplierName || '-' }}</div>
                            <div v-if="item.origin">来源：{{ item.origin }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="getPersonnelSearchResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag severity="info" :value="`查询维度：${formatPersonnelQueryType(getPersonnelSearchResult(tool)!.queryType)}`" />
                        <Tag severity="contrast" :value="`匹配员工：${getPersonnelSearchResult(tool)!.total}`" />
                        <Tag
                          v-if="getPersonnelSearchResult(tool)!.matchedDepartments?.length"
                          severity="warn"
                          :value="`匹配部门：${getPersonnelSearchResult(tool)!.matchedDepartments?.length}`"
                        />
                      </div>
                      <div
                        v-if="getPersonnelSearchResult(tool)!.matchedDepartments?.length"
                        class="mt-3 text-xs text-content-text-muted whitespace-pre-wrap break-words"
                      >
                        匹配部门：{{ formatMatchedDepartments(getPersonnelSearchResult(tool)!.matchedDepartments || []) }}
                      </div>
                      <div v-if="getPersonnelSearchResult(tool)!.items.length" class="mt-3 flex flex-col gap-2">
                        <div
                          v-for="item in getPersonnelSearchResult(tool)!.items"
                          :key="item.id"
                          class="rounded-lg border border-content-border bg-content-bg px-3 py-3"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-medium">{{ item.name || '-' }}</div>
                            <div class="text-xs text-content-text-muted">{{ item.position || '未填写岗位' }}</div>
                          </div>
                          <div class="mt-2 text-xs text-content-text-muted leading-5">
                            <div>部门：{{ (item.matchedDepartmentNames?.length ? item.matchedDepartmentNames : item.departmentNames).join('、') || '-' }}</div>
                            <div>手机号：{{ maskPhone(item.phone) }}</div>
                            <div>身份证：{{ maskIdCard(item.idCardNumber) }}</div>
                            <div v-if="item.documentNames?.length">证件：{{ item.documentNames.join('、') }}</div>
                            <div v-if="item.email">邮箱：{{ item.email }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="getPartyUnitSearchResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag severity="info" :value="`单位类型：${formatPartyUnitLabel(getPartyUnitSearchResult(tool)!.partyType)}`" />
                        <Tag severity="contrast" :value="`匹配单位：${getPartyUnitSearchResult(tool)!.total}`" />
                      </div>
                      <div v-if="getPartyUnitSearchResult(tool)!.items.length" class="mt-3 flex flex-col gap-2">
                        <div
                          v-for="item in getPartyUnitSearchResult(tool)!.items"
                          :key="item.id"
                          class="rounded-lg border border-content-border bg-content-bg px-3 py-3"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-medium">{{ item.name || '-' }}</div>
                            <div class="text-xs text-content-text-muted">{{ item.code || '未填写编码' }}</div>
                          </div>
                          <div class="mt-2 text-xs text-content-text-muted leading-5">
                            <div>联系人：{{ item.contact || '-' }}</div>
                            <div>电话：{{ item.mobile || item.phone || '-' }}</div>
                            <div>税号：{{ item.taxNumber || '-' }}</div>
                            <div>开户行：{{ item.bankName || '-' }}</div>
                            <div v-if="item.bankAccount">账号：{{ item.bankAccount }}</div>
                            <div v-if="item.address">地址：{{ item.address }}</div>
                            <div v-if="item.groupName">分组：{{ item.groupName }}</div>
                            <div v-if="item.department">部门：{{ item.department }}</div>
                            <div v-if="item.legalRepName || item.legalRepMobile">法人：{{ [item.legalRepName, item.legalRepMobile].filter(Boolean).join(' / ') }}</div>
                            <div v-if="item.email || item.legalRepEmail">邮箱：{{ item.legalRepEmail || item.email }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="getInvoiceSearchResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag severity="info" :value="`检索词：${getInvoiceSearchResult(tool)!.keyword || '-'}`" />
                        <Tag severity="contrast" :value="`匹配发票：${getInvoiceSearchResult(tool)!.total}`" />
                      </div>
                      <div v-if="getInvoiceSearchResult(tool)!.items.length" class="mt-3 flex flex-col gap-2">
                        <div
                          v-for="item in getInvoiceSearchResult(tool)!.items"
                          :key="item.id"
                          class="rounded-lg border border-content-border bg-content-bg px-3 py-3"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-medium">{{ item.invoiceNo || '未识别发票号码' }}</div>
                            <Tag :severity="item.parseStatus === 'success' ? 'success' : 'secondary'" :value="formatInvoiceParseStatus(item.parseStatus)" />
                          </div>
                          <div class="mt-2 text-xs text-content-text-muted leading-5">
                            <div>发票代码：{{ item.invoiceCode || '-' }}</div>
                            <div>合同：{{ formatInvoiceContract(item) }}</div>
                            <div>销方：{{ item.sellerName || '-' }}</div>
                            <div>购方：{{ item.buyerName || '-' }}</div>
                            <div>类型：{{ item.invoiceType || '-' }}</div>
                            <div>价税合计：{{ formatInvoiceAmount(item.totalAmount, item.currency) }}</div>
                            <div>开票日期：{{ item.issueDate || item.invoiceDate || '-' }}</div>
                            <div v-if="item.sourcePath">来源文件：{{ item.sourcePath }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="getStatisticsResult(tool)" class="mt-3 rounded-lg border border-content-border bg-content-card px-3 py-3">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <Tag severity="info" value="合同统计" />
                        <Tag
                          :severity="getStatisticsResult(tool)!.status === 'executed' ? 'success' : getStatisticsResult(tool)!.status === 'pending_confirmation' ? 'warn' : 'contrast'"
                          :value="formatStatisticsStatus(getStatisticsResult(tool)!.status)"
                        />
                      </div>
                      <div v-if="getStatisticsResult(tool)!.plan" class="mt-3 rounded-lg border border-content-border bg-content-bg px-3 py-3 text-xs leading-6 text-content-text-muted">
                        <div>主题：{{ getStatisticsResult(tool)!.plan!.question || '-' }}</div>
                        <div>字段：{{ formatStatisticsFields(getStatisticsResult(tool)!.plan!) }}</div>
                        <div>指标：{{ formatStatisticsMetrics(getStatisticsResult(tool)!.plan!) }}</div>
                        <div>筛选：{{ formatStatisticsFilters(getStatisticsResult(tool)!.plan!) }}</div>
                        <div>展示：{{ formatStatisticsVisualizations(getStatisticsResult(tool)!.plan!) }}</div>
                      </div>
                      <div
                        v-if="getStatisticsResult(tool)!.clarification?.missing?.length || getStatisticsResult(tool)!.clarification?.invalidFields?.length"
                        class="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 text-xs leading-6 text-yellow-700"
                      >
                        <div v-if="getStatisticsResult(tool)!.clarification?.missing?.length">仍缺失：{{ getStatisticsResult(tool)!.clarification?.missing.join('、') }}</div>
                        <div v-if="getStatisticsResult(tool)!.clarification?.invalidFields?.length">不可用字段：{{ getStatisticsResult(tool)!.clarification?.invalidFields.join('、') }}</div>
                        <div v-if="getStatisticsResult(tool)!.clarification?.suggestions?.length">建议：{{ getStatisticsResult(tool)!.clarification?.suggestions.join(' ') }}</div>
                      </div>
                      <div
                        v-if="getStatisticsResult(tool)!.status === 'pending_confirmation'"
                        class="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-xs leading-6 text-emerald-700"
                      >
                        请先确认方案；如需修改，可直接发送补充条件。确认无误后回复“确认执行”。
                      </div>
                      <div v-if="getStatisticsResult(tool)!.status === 'executed' && getStatisticsResult(tool)!.execution?.outcome?.ok" class="mt-3 flex flex-col gap-3">
                        <div class="flex flex-wrap gap-2 text-xs">
                          <Tag
                            v-for="item in getStatisticsResult(tool)!.execution!.outcome!.data!.summary"
                            :key="`${tool.id}-${item.label}`"
                            severity="contrast"
                            :value="`${item.label}：${item.value}`"
                          />
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <Button
                            size="small"
                            label="打开报表"
                            icon="pi pi-external-link"
                            @click="openStatisticsReport(tool.id)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="message.role === 'assistant'" class="mt-2 flex items-center gap-1 text-sm text-content-text-muted select-none">
                <Button
                  icon="pi pi-copy"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  aria-label="复制回复"
                  v-tooltip.bottom="'复制'"
                  @click="copyAssistantMessage(message.content)"
                />
              </div>
            </div>
          </div>
        </template>

        <div v-else-if="!sending" class="h-full flex items-center justify-center text-content-text-muted">
          <div class="w-full max-w-[920px] px-4 text-center">
            <div class="text-4xl font-semibold tracking-tight text-content-text">有什么我能帮你的吗？</div>
            <div class="mt-4 text-sm text-content-text-muted">选择一个示例，或在下方输入你的问题</div>
            <div class="mt-8 flex flex-wrap justify-center gap-3">
              <button
                v-for="item in quickPrompts"
                :key="item.label"
                type="button"
                class="rounded-full border border-content-border bg-content-card px-5 py-3 text-sm text-content-text shadow-sm transition-colors hover:bg-content-hover"
                @click="applyQuickPrompt(item.prompt)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="sending" class="flex justify-start">
          <div class="max-w-[880px] rounded-2xl px-4 py-3 shadow-sm bg-content-card border border-content-border">
            <div class="text-xs opacity-70 mb-2">宏起合同AI</div>
            <div class="typing-dots text-sm leading-6">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-content-border px-6 py-4">
        <div v-if="errorMessage" class="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {{ errorMessage }}
        </div>
        <div class="relative">
          <Textarea
            ref="textareaRef"
            v-model="draft"
            rows="3"
            autoResize
            class="w-full pr-14 pb-10"
            placeholder="请输入你的问题，例如：我想查询 xx 合同 / 查询甲方单位 xx / 查询市场部有哪些人"
            @keydown.enter.exact.prevent="handleSendMessage"
          />
          <Button
            :class="['!absolute right-3 bottom-3', sending ? 'aiw-stop-breath' : '']"
            rounded
            :severity="sending ? 'danger' : 'primary'"
            :icon="sending ? 'pi pi-stop' : 'pi pi-arrow-up'"
            :disabled="sending ? false : !canSend"
            @click="sending ? handleStop() : handleSendMessage()"
          />
        </div>
      </div>
    </section>
  </div>

  <Dialog
    v-model:visible="renameDialogVisible"
    modal
    header="重命名会话"
    :style="{ width: '28rem' }"
  >
    <div class="flex flex-col gap-3">
      <div class="text-sm text-content-text-muted">仅修改会话标题，不影响历史消息与工具调用记录。</div>
      <InputText
        v-model="renameDraft"
        class="w-full"
        maxlength="60"
        placeholder="请输入会话标题"
        @keydown.enter.prevent="handleRenameSession"
      />
      <div v-if="renameErrorMessage" class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
        {{ renameErrorMessage }}
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="取消" text @click="closeRenameDialog" />
        <Button label="保存" :loading="renaming" :disabled="!canRename" @click="handleRenameSession" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import AIAgentMessageContent from './components/AIAgentMessageContent.vue'
import WindowControls from '../../components/WindowControls.vue'
import type {
  AIAgentContractStatisticsToolData,
  AIAgentContractFileSearchItem,
  AIAgentContractFileSearchResult,
  AIAgentInvoiceSearchItem,
  AIAgentInvoiceSearchResult,
  AIAgentMessageRole,
  AIAgentProductSearchItem,
  AIAgentProductSearchResult,
  AIAgentProductSearchWarrantyStatus,
  AIAgentPartyUnitSearchPartyType,
  AIAgentPartyUnitSearchResult,
  AIAgentPersonnelSearchDepartmentMatch,
  AIAgentPersonnelSearchQueryType,
  AIAgentPersonnelSearchResult,
  AIAgentSession,
  AIAgentSessionSummary,
  AIAgentToolCallRecord,
} from '../../../shared/types/aiAgent.types'
import type { ContractStatisticsAIPlan, ContractStatisticsReportStatus } from '../../../shared/types/contractStatistics.types'

const router = useRouter()
const sessions = ref<AIAgentSessionSummary[]>([])
const currentSession = ref<AIAgentSession | null>(null)
const draft = ref('')
const sending = ref(false)
const errorMessage = ref('')
const currentLibraryPath = ref(localStorage.getItem('currentLibraryPath') || '')
const renameDialogVisible = ref(false)
const renameDraft = ref('')
const renameErrorMessage = ref('')
const renaming = ref(false)
const messagesContainerRef = ref<HTMLElement | null>(null)
const activeRequestId = ref(0)
const sessionContextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const sessionContextTargetId = ref<string | null>(null)
const expandedToolSummaries = ref<Record<string, boolean>>({})
const textareaRef = ref<any>(null)
let removeFocusListener: (() => void) | null = null
let removeStorageListener: (() => void) | null = null

const quickPrompts = [
  { label: '我想查询 xx 合同', prompt: '我想查询 xx 合同' },
  { label: '查询产品编码 ABC-001', prompt: '查询产品编码 ABC-001' },
  { label: '帮我找已过保产品', prompt: '帮我找已过保产品' },
  { label: '查询甲方单位 xx', prompt: '查询甲方单位 xx' },
  { label: '查询乙方单位 xx', prompt: '查询乙方单位 xx' },
  { label: '查询发票号码 12345678', prompt: '查询发票号码 12345678' },
]

const statisticsFieldLabelMap: Record<string, string> = {
  contract_name: '合同名称',
  contract_code: '合同编号',
  signing_date: '签约日期',
  signing_year: '签约年份',
  signing_month: '签约月份',
  contract_type: '合同类型',
  client_name: '甲方单位',
  party_b_name: '乙方单位',
  contract_amount: '合同金额',
  contract_status: '合同状态',
  department: '归属部门',
  responsible_person: '负责人',
  currency: '币种',
}

const statisticsVisualizationLabelMap: Record<string, string> = {
  table: '表格',
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  html_report: '独立报表',
}

const scrollStorageKey = computed(() => {
  const sid = String(currentSession.value?.id || '').trim()
  const lib = String(currentLibraryPath.value || '').trim()
  if (!sid || !lib) return ''
  return `aiw:scroll:${lib}:${sid}`
})

let scrollSaveTimer: number | undefined
const saveScrollPosition = () => {
  const key = scrollStorageKey.value
  const el = messagesContainerRef.value
  if (!key || !el) return
  if (scrollSaveTimer) window.clearTimeout(scrollSaveTimer)
  scrollSaveTimer = window.setTimeout(() => {
    sessionStorage.setItem(key, String(el.scrollTop))
  }, 80)
}

const restoreScrollPosition = async () => {
  const key = scrollStorageKey.value
  const el = messagesContainerRef.value
  if (!key || !el) return
  const raw = sessionStorage.getItem(key)
  await nextTick()
  requestAnimationFrame(() => {
    if (!messagesContainerRef.value) return
    if (raw === null) {
      scrollToBottom()
      return
    }
    const top = Number(raw)
    messagesContainerRef.value.scrollTop = Number.isFinite(top) ? top : 0
  })
}

const roleLabelMap: Record<AIAgentMessageRole, string> = {
  user: '',
  assistant: '宏起合同AI',
  system: '系统',
  tool: '工具',
}

const canSend = computed(() => {
  return Boolean(currentSession.value?.id && currentLibraryPath.value && draft.value.trim() && !sending.value)
})

const canRename = computed(() => {
  return Boolean(currentSession.value?.id && renameDraft.value.trim() && !renaming.value)
})

const sessionContextMenuItems = computed(() => {
  const hasTarget = Boolean(sessionContextTargetId.value)
  return [
    {
      label: '新建会话',
      icon: 'pi pi-plus',
      disabled: !currentLibraryPath.value,
      command: () => void handleCreateSession(),
    },
    { separator: true },
    {
      label: '重命名',
      icon: 'pi pi-pencil',
      disabled: !hasTarget,
      command: () => sessionContextTargetId.value && void openRenameDialogForSession(sessionContextTargetId.value),
    },
    {
      label: '删除会话',
      icon: 'pi pi-trash',
      disabled: !hasTarget,
      command: () => sessionContextTargetId.value && void deleteSessionById(sessionContextTargetId.value),
    },
  ] as any[]
})

function isToolSummaryExpanded(toolId: string) {
  return Boolean(expandedToolSummaries.value[String(toolId || '').trim()])
}

function toggleToolSummary(toolId: string) {
  const key = String(toolId || '').trim()
  if (!key) return
  expandedToolSummaries.value[key] = !expandedToolSummaries.value[key]
}

function shouldShowSummaryToggle(summary: string) {
  const text = String(summary || '')
  return text.includes('\n') || text.length > 80
}

async function applyQuickPrompt(prompt: string) {
  draft.value = String(prompt || '').trim()
  await nextTick()
  const el = textareaRef.value?.$el?.querySelector?.('textarea') as HTMLTextAreaElement | undefined
  el?.focus?.()
  el?.setSelectionRange?.(draft.value.length, draft.value.length)
}

async function refreshSessions(preferredSessionId?: string) {
  const response = await window.electronAPI.aiAgent.listSessions()
  if (!response.success || !response.data) {
    currentSession.value = null
    return
  }
  sessions.value = response.data
  const targetId = preferredSessionId || currentSession.value?.id || response.data[0]?.id
  if (targetId) {
    await openSession(targetId)
    return
  }
  currentSession.value = null
}

async function syncCurrentLibraryPath() {
  const localValue = String(localStorage.getItem('currentLibraryPath') || '').trim()
  if (localValue) {
    currentLibraryPath.value = localValue
    return
  }
  const response = await window.electronAPI.bootstrap.getInitStatus()
  currentLibraryPath.value = String(response?.data?.projectPath || response?.data?.libraryPath || '').trim()
}

async function openCurrentLibraryFolder() {
  const folderPath = String(currentLibraryPath.value || '').trim()
  if (!folderPath) {
    errorMessage.value = '当前还没有可打开的资源库路径。'
    return
  }
  errorMessage.value = ''
  const response = await window.electronAPI.fs.openFolder(folderPath)
  if (!response.success) {
    errorMessage.value = response.error || '打开资源库文件夹失败'
  }
}

async function openSession(sessionId: string) {
  const response = await window.electronAPI.aiAgent.getSession({ sessionId })
  if (response.success) {
    currentSession.value = response.data || null
  }
}

function onSessionContextMenu(event: MouseEvent, sessionId: string) {
  sessionContextTargetId.value = sessionId
  sessionContextMenuRef.value?.show(event)
}

function onSessionListBlankContextMenu(event: MouseEvent) {
  sessionContextTargetId.value = null
  sessionContextMenuRef.value?.show(event)
}

async function handleCreateSession() {
  errorMessage.value = ''
  if (!currentLibraryPath.value) {
    errorMessage.value = '请先进入资源库后再创建会话'
    return
  }
  const response = await window.electronAPI.aiAgent.createSession({
    libraryPath: currentLibraryPath.value,
    title: '新建会话',
  })
  if (!response.success || !response.data?.session) {
    errorMessage.value = response.error || '创建会话失败'
    return
  }
  currentSession.value = response.data.session
  await refreshSessions(response.data.session.id)
}

async function handleSendMessage() {
  if (!canSend.value || !currentSession.value) {
    return
  }
  errorMessage.value = ''
  const messageContent = draft.value.trim()
  const requestId = ++activeRequestId.value
  const now = new Date().toISOString()

  const optimisticSession: AIAgentSession = {
    ...currentSession.value,
    updatedAt: now,
    messages: [
      ...currentSession.value.messages,
      {
        id: `optimistic-${requestId}`,
        role: 'user',
        content: messageContent,
        createdAt: now,
      },
    ],
  }

  currentSession.value = optimisticSession
  draft.value = ''
  sending.value = true
  await nextTick()
  scrollToBottom()
  try {
    const response = await window.electronAPI.aiAgent.sendMessage({
      sessionId: currentSession.value.id,
      libraryPath: currentLibraryPath.value,
      content: messageContent,
    })
    if (requestId !== activeRequestId.value) {
      return
    }
    if (!response.success || !response.data?.session) {
      errorMessage.value = response.error || '发送消息失败'
      return
    }
    currentSession.value = response.data.session
    await refreshSessions(currentSession.value.id)
    await nextTick()
    scrollToBottom()
  } finally {
    if (requestId === activeRequestId.value) {
      sending.value = false
    }
  }
}

function handleStop() {
  activeRequestId.value += 1
  sending.value = false
}

function scrollToBottom() {
  const el = messagesContainerRef.value
  if (!el) {
    return
  }
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight
  })
}

function openRenameDialog() {
  renameErrorMessage.value = ''
  renameDraft.value = currentSession.value?.title || ''
  renameDialogVisible.value = true
}

async function openRenameDialogForSession(sessionId: string) {
  errorMessage.value = ''
  if (currentSession.value?.id !== sessionId) {
    await openSession(sessionId)
  }
  openRenameDialog()
}

function closeRenameDialog() {
  renameDialogVisible.value = false
  renameErrorMessage.value = ''
  renameDraft.value = ''
}

async function handleRenameSession() {
  if (!currentSession.value) {
    return
  }
  const title = renameDraft.value.trim()
  if (!title) {
    renameErrorMessage.value = '会话标题不能为空'
    return
  }

  renameErrorMessage.value = ''
  renaming.value = true
  try {
    const response = await window.electronAPI.aiAgent.renameSession({
      sessionId: currentSession.value.id,
      title,
    })
    if (!response.success || !response.data?.session) {
      renameErrorMessage.value = response.error || '重命名会话失败'
      return
    }
    currentSession.value = response.data.session
    await refreshSessions(response.data.session.id)
    closeRenameDialog()
  } finally {
    renaming.value = false
  }
}

async function handleDeleteSession() {
  if (!currentSession.value) {
    return
  }
  const response = await window.electronAPI.aiAgent.deleteSession({ sessionId: currentSession.value.id })
  if (!response.success) {
    errorMessage.value = response.error || '删除会话失败'
    return
  }
  currentSession.value = null
  await refreshSessions()
  if (!sessions.value.length && currentLibraryPath.value) {
    await handleCreateSession()
  }
}

async function deleteSessionById(sessionId: string) {
  errorMessage.value = ''
  const isCurrent = currentSession.value?.id === sessionId
  const response = await window.electronAPI.aiAgent.deleteSession({ sessionId })
  if (!response.success) {
    errorMessage.value = response.error || '删除会话失败'
    return
  }

  if (isCurrent) {
    currentSession.value = null
    await refreshSessions()
  } else {
    const preferredId = currentSession.value?.id
    await refreshSessions(preferredId)
  }

  if (!sessions.value.length && currentLibraryPath.value) {
    await handleCreateSession()
  }
}

async function copyAssistantMessage(content: string) {
  const text = String(content ?? '').trim()
  if (!text) {
    return
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatArgs(args: Record<string, unknown>) {
  return Object.entries(args || {})
    .map(([key, value]) => `${key}=${String(value ?? '')}`)
    .join(', ')
}

function escapeHtml(input: string) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toSafeSnippetHtml(snippet: string) {
  const escaped = escapeHtml(snippet)
  return escaped.replaceAll('&lt;b&gt;', '<mark>').replaceAll('&lt;/b&gt;', '</mark>')
}

function getFileSearchResult(tool: AIAgentToolCallRecord): AIAgentContractFileSearchResult | null {
  if (tool.toolName !== 'contract_full_text_search' || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentContractFileSearchResult>
  if (!Array.isArray(raw.items) || typeof raw.total !== 'number') {
    return null
  }
  return {
    keyword: String(raw.keyword || ''),
    total: raw.total,
    items: raw.items as AIAgentContractFileSearchItem[],
    indexing: Boolean(raw.indexing),
    lastIndexedAt: typeof raw.lastIndexedAt === 'number' ? raw.lastIndexedAt : undefined,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
  }
}

function getProductSearchResult(tool: AIAgentToolCallRecord): AIAgentProductSearchResult | null {
  if (tool.toolName !== 'product_search' || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentProductSearchResult>
  if (!Array.isArray(raw.items) || typeof raw.total !== 'number') {
    return null
  }
  return {
    keyword: String(raw.keyword || ''),
    total: raw.total,
    items: raw.items as AIAgentProductSearchItem[],
    warrantyStatus: raw.warrantyStatus === 'expired' || raw.warrantyStatus === 'notExpired' ? raw.warrantyStatus : undefined,
    searchFields: Array.isArray(raw.searchFields) ? raw.searchFields.map(item => String(item || '')) : [],
    emptyReason: typeof raw.emptyReason === 'string' ? raw.emptyReason : undefined,
  }
}

function formatFileSearchCardTitle(item: AIAgentContractFileSearchItem) {
  if (item.sourceType === 'other') {
    return item.directoryLabel || item.relativePath || '其他文件'
  }
  const parts = [item.contractNo, item.contractName].map(value => String(value || '').trim()).filter(Boolean)
  return parts.length ? parts.join(' / ') : '未识别所属合同'
}

function formatFileSearchLocation(item: AIAgentContractFileSearchItem) {
  return item.relativePath || item.filePath || '-'
}

function formatProductWarrantyStatus(status?: AIAgentProductSearchWarrantyStatus | '') {
  if (status === 'expired') return '已过保'
  if (status === 'notExpired') return '未过保'
  return '未知'
}

function formatProductContract(item: AIAgentProductSearchItem) {
  const parts = [item.contractCode, item.contractName].map(value => String(value || '').trim()).filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

async function openFilePreview(item: AIAgentContractFileSearchItem) {
  if (!item.canPreview || !item.filePath) {
    errorMessage.value = '当前结果缺少可用的预览定位信息，暂时无法打开。'
    return
  }
  saveScrollPosition()
  errorMessage.value = ''
  if (item.sourceType === 'other') {
    await router.push({
      name: 'OtherFilesPreview',
      query: {
        path: item.filePath,
        name: item.fileName,
        fileId: item.fileId,
      },
    })
    return
  }
  if (!item.contractId) {
    errorMessage.value = '当前合同文件结果缺少合同定位信息，暂时无法打开。'
    return
  }
  await router.push({
    name: 'ContractFilesPreview',
    params: { contractId: item.contractId },
    query: {
      path: item.filePath,
      name: item.fileName,
      fileId: item.fileId,
    },
  })
}

function getPersonnelSearchResult(tool: AIAgentToolCallRecord): AIAgentPersonnelSearchResult | null {
  if (tool.toolName !== 'personnel_search' || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentPersonnelSearchResult>
  if (!Array.isArray(raw.items) || typeof raw.total !== 'number' || typeof raw.queryType !== 'string') {
    return null
  }
  return raw as AIAgentPersonnelSearchResult
}

function getInvoiceSearchResult(tool: AIAgentToolCallRecord): AIAgentInvoiceSearchResult | null {
  if (tool.toolName !== 'invoice_search' || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentInvoiceSearchResult>
  if (!Array.isArray(raw.items) || typeof raw.total !== 'number') {
    return null
  }
  return {
    keyword: String(raw.keyword || ''),
    total: raw.total,
    items: raw.items as AIAgentInvoiceSearchItem[],
    searchFields: Array.isArray(raw.searchFields) ? raw.searchFields.map(item => String(item || '')) : [],
    emptyReason: typeof raw.emptyReason === 'string' ? raw.emptyReason : undefined,
  }
}

function getPartyUnitSearchResult(tool: AIAgentToolCallRecord): AIAgentPartyUnitSearchResult | null {
  if (!['customer_search', 'supplier_search'].includes(tool.toolName) || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentPartyUnitSearchResult>
  if (!Array.isArray(raw.items) || typeof raw.total !== 'number' || typeof raw.partyType !== 'string') {
    return null
  }
  return raw as AIAgentPartyUnitSearchResult
}

function getStatisticsResult(tool: AIAgentToolCallRecord): AIAgentContractStatisticsToolData | null {
  if (tool.toolName !== 'contract_statistics' || !tool.rawData || typeof tool.rawData !== 'object') {
    return null
  }
  const raw = tool.rawData as Partial<AIAgentContractStatisticsToolData>
  if (raw.kind !== 'contract_statistics' || typeof raw.status !== 'string') {
    return null
  }
  return raw as AIAgentContractStatisticsToolData
}

function formatStatisticsStatus(status: ContractStatisticsReportStatus) {
  if (status === 'pending_clarification') return '待补充'
  if (status === 'pending_confirmation') return '待确认'
  if (status === 'executed') return '已执行'
  return '已失效'
}

function getStatisticsFieldLabel(field: string, fallback?: string) {
  return String(fallback || statisticsFieldLabelMap[field] || field || '-')
}

function formatStatisticsFields(plan: ContractStatisticsAIPlan) {
  const fields = plan.request.columns
    .filter(column => column.kind === 'field')
    .map(column => getStatisticsFieldLabel(column.field, column.label))
  return fields.length ? fields.join('、') : '无'
}

function formatStatisticsMetrics(plan: ContractStatisticsAIPlan) {
  const metrics = plan.request.columns
    .filter(column => column.kind === 'metric')
    .map(column => String(column.metric.label || column.metric.metricId || '').trim())
    .filter(Boolean)
  return metrics.length ? metrics.join('、') : (plan.intent === 'aggregation' ? '合同数量' : '无')
}

function formatStatisticsFilters(plan: ContractStatisticsAIPlan) {
  const filters = Array.isArray(plan.request.filters) ? plan.request.filters : []
  const texts = filters.map((item) => {
    const fieldText = getStatisticsFieldLabel(item.field, item.label)
    if (item.operator === 'between') {
      const values = Array.isArray(item.values) ? item.values.slice(0, 2).map(value => String(value ?? '').trim()).filter(Boolean) : []
      return values.length === 2 ? `${fieldText} 区间 ${values[0]} ~ ${values[1]}` : fieldText
    }
    if (item.operator === 'in') {
      const values = Array.isArray(item.values) ? item.values.map(value => String(value ?? '').trim()).filter(Boolean) : []
      return values.length ? `${fieldText} 属于 ${values.join('、')}` : fieldText
    }
    const valueText = String(item.value ?? '').trim()
    if (item.operator === 'contains') return valueText ? `${fieldText} 包含 ${valueText}` : fieldText
    if (item.operator === 'gte') return valueText ? `${fieldText} >= ${valueText}` : fieldText
    if (item.operator === 'lte') return valueText ? `${fieldText} <= ${valueText}` : fieldText
    return valueText ? `${fieldText} = ${valueText}` : fieldText
  })
  return texts.length ? texts.join('；') : '默认仅统计未删除合同'
}

function formatStatisticsVisualizations(plan: ContractStatisticsAIPlan) {
  const visualizations = Array.isArray(plan.request.preferredVisualizations)
    ? plan.request.preferredVisualizations
    : []
  const texts = visualizations
    .map(item => statisticsVisualizationLabelMap[item] || item)
    .filter(Boolean)
  return texts.length ? texts.join(' + ') : '表格'
}

async function openStatisticsReport(toolCallId: string) {
  const sessionId = String(currentSession.value?.id || '').trim()
  const recordId = String(toolCallId || '').trim()
  if (!sessionId || !recordId) {
    errorMessage.value = '当前统计结果缺少报表定位信息，暂时无法打开。'
    return
  }
  saveScrollPosition()
  errorMessage.value = ''
  await router.push({
    name: 'AIStatisticsReport',
    params: {
      sessionId,
      toolCallId: recordId,
    },
  })
}

function formatPersonnelQueryType(queryType: AIAgentPersonnelSearchQueryType) {
  if (queryType === 'department') return '部门'
  if (queryType === 'document') return '证件'
  if (queryType === 'phone') return '手机号'
  if (queryType === 'id_card_number') return '身份证'
  return '姓名'
}

function formatMatchedDepartments(items: AIAgentPersonnelSearchDepartmentMatch[]) {
  return items.map(item => `${item.name}（${item.personnelCount} 人）`).join('、')
}

function formatPartyUnitLabel(partyType: AIAgentPartyUnitSearchPartyType) {
  return partyType === 'party_a' ? '甲方单位' : '乙方单位'
}

function formatInvoiceContract(item: AIAgentInvoiceSearchItem) {
  const parts = [item.contractCode, item.contractName].map(value => String(value || '').trim()).filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

function formatInvoiceAmount(amount?: number, currency?: string) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '-'
  }
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  return currency ? `${formatted} ${currency}` : formatted
}

function formatInvoiceParseStatus(status?: string) {
  const normalized = String(status || '').trim()
  if (!normalized) return '状态未知'
  if (normalized === 'success') return '解析成功'
  if (normalized === 'failed') return '解析失败'
  if (normalized === 'processing') return '解析中'
  return normalized
}

function maskPhone(phone?: string) {
  const value = String(phone || '').trim()
  if (value.length < 7) {
    return value || '-'
  }
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function maskIdCard(idCard?: string) {
  const value = String(idCard || '').trim()
  if (!value) {
    return '-'
  }
  if (value.length <= 8) {
    return value
  }
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

onMounted(async () => {
  await syncCurrentLibraryPath()
  await refreshSessions()
  if (!sessions.value.length && currentLibraryPath.value) {
    await handleCreateSession()
  }
  await restoreScrollPosition()
})

watch(
  () => currentSession.value?.id,
  async () => {
    await restoreScrollPosition()
  },
)

watch(
  () => currentSession.value?.messages?.length || 0,
  () => {
    saveScrollPosition()
  },
)

onMounted(() => {
  const el = messagesContainerRef.value
  if (el) {
    el.addEventListener('scroll', saveScrollPosition, { passive: true })
  }
  const handleFocus = () => {
    void syncCurrentLibraryPath()
  }
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === 'currentLibraryPath') {
      void syncCurrentLibraryPath()
    }
  }
  window.addEventListener('focus', handleFocus)
  window.addEventListener('storage', handleStorage)
  removeFocusListener = () => window.removeEventListener('focus', handleFocus)
  removeStorageListener = () => window.removeEventListener('storage', handleStorage)
})

onBeforeUnmount(() => {
  const el = messagesContainerRef.value
  if (el) {
    el.removeEventListener('scroll', saveScrollPosition)
  }
  removeFocusListener?.()
  removeStorageListener?.()
  if (scrollSaveTimer) window.clearTimeout(scrollSaveTimer)
})
</script>

<style scoped>
.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}

.typing-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
  animation: typingDot 1.1s infinite ease-in-out;
}

.typing-dots .dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots .dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingDot {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  50% {
    transform: translateY(-2px);
    opacity: 0.9;
  }
}

.aiw-stop-breath {
  animation: aiwBreath 1.15s ease-in-out infinite;
  will-change: transform, box-shadow;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.0);
}

@keyframes aiwBreath {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.0);
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.18);
  }
}
</style>
