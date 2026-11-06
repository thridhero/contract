import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import BillingView from '../views/billing/BillingView.vue'
import FirstRunView from '../views/onboarding/FirstRunView.vue'
import ProjectsView from '../views/project/ProjectsView.vue'
import TagManagementView from '../views/library/tag/TagManagementView.vue'
import SupplierManagementView from '../views/library/supplier/SupplierManagementView.vue'
import CustomerManagementView from '../views/library/customer/CustomerManagementView.vue'
import DepartmentPersonnelManagementView from '../views/library/department-personnel/DepartmentPersonnelManagementView.vue'
import ContractProductManagementView from '../views/library/contract-product/ContractProductManagementView.vue'
import ContractExecutionManagementView from '../views/library/contract-execution/ContractExecutionManagementView.vue'
import ReceiptPlanManagementView from '../views/library/receipt-plan/ReceiptPlanManagementView.vue'
import ContractFilesView from '../views/library/contract-files/ContractFilesView.vue'
import AllContractFilesView from '../views/library/contract-files/AllContractFilesView.vue'
import ContractFilesPreviewView from '../views/library/contract-files/ContractFilesPreviewView.vue'
import ContractFilesFullTextSearchView from '../views/library/contract-files/ContractFilesFullTextSearchView.vue'
import OtherFilesView from '../views/library/other-files/OtherFilesView.vue'
import OtherFilesPreviewView from '../views/library/other-files/OtherFilesPreviewView.vue'
import OtherFilesFullTextSearchView from '../views/library/other-files/OtherFilesFullTextSearchView.vue'
import FeedbackView from '../views/feedback/FeedbackView.vue'
import AIWorkbenchView from '../views/ai/AIWorkbenchView.vue'
import AIStatisticsReportView from '../views/ai/AIStatisticsReportView.vue'
import ToolboxView from '../views/toolbox/ToolboxView.vue'
import MainLayout from '../views/shell/MainLayout.vue'
import ResourceRouteView from '../views/shell/ResourceRouteView.vue'
import { pinia } from '../plugins/primevue'
import { useAuthStore } from '../stores/system'
import { useSubscriptionStore } from '../stores/system/subscriptionStore'

const layoutChildren: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: AIWorkbenchView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'ai-workbench',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/resource',
    name: 'Resource',
    component: ResourceRouteView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      layoutContent: 'resource',
      sidebarCategory: 'all'
    }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: ProjectsView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      hidePropertiesPanel: true
    }
  },
  {
    path: '/tags',
    name: 'Tags',
    component: TagManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'tags',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    component: SupplierManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'suppliers',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/customers',
    name: 'Customers',
    component: CustomerManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'customers',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/department-personnel',
    name: 'DepartmentPersonnel',
    component: DepartmentPersonnelManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'department-personnel',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/departments',
    redirect: '/department-personnel'
  },
  {
    path: '/personnel',
    redirect: '/department-personnel'
  },
  {
    path: '/contract-products',
    name: 'ContractProducts',
    component: ContractProductManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'contract-products',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/contract-executions',
    name: 'ContractExecutions',
    component: ContractExecutionManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'contract-executions',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/receipt-plans',
    name: 'ReceiptPlans',
    component: ReceiptPlanManagementView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'receipt-plans',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/contract-files/all',
    name: 'AllContractFiles',
    component: AllContractFilesView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      sidebarCategory: 'untagged',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/contract-files/:contractId',
    name: 'ContractFiles',
    component: ContractFilesView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      hidePropertiesPanel: true,
      preserveSidebarSelection: true
    }
  },
  {
    path: '/contract-files/:contractId/preview',
    name: 'ContractFilesPreview',
    component: ContractFilesPreviewView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      hidePropertiesPanel: true,
      preserveSidebarSelection: true
    }
  },
  {
    path: '/contract-files/:contractId/full-text-search',
    name: 'ContractFilesFullTextSearch',
    component: ContractFilesFullTextSearchView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      hidePropertiesPanel: true,
      preserveSidebarSelection: true
    }
  },
  {
    path: '/unit-libraries/:partyType(party-a|party-b)/:unitId',
    name: 'UnitLibrary',
    component: OtherFilesView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      sidebarCategory: 'other-files',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/other-files',
    name: 'OtherFiles',
    component: OtherFilesView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      sidebarCategory: 'other-files',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/other-files/preview',
    name: 'OtherFilesPreview',
    component: OtherFilesPreviewView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      sidebarCategory: 'other-files',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/other-files/full-text-search',
    name: 'OtherFilesFullTextSearch',
    component: OtherFilesFullTextSearchView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      sidebarCategory: 'other-files',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/ai-workbench',
    name: 'AIWorkbench',
    component: AIWorkbenchView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'ai-workbench',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/ai-workbench/report/:sessionId/:toolCallId',
    name: 'AIStatisticsReport',
    component: AIStatisticsReportView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'ai-workbench',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/toolbox',
    name: 'ToolboxHome',
    component: ToolboxView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'toolbox',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/toolbox/:collection',
    name: 'ToolboxCollection',
    component: ToolboxView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'toolbox',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/toolbox/:collection/:tool',
    name: 'ToolboxTool',
    component: ToolboxView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'toolbox',
      hidePropertiesPanel: true
    }
  },
  {
    path: '/feedback',
    name: 'Feedback',
    component: FeedbackView,
    meta: {
      requiresAuth: true,
      requiresInitialization: true,
      requiresSubscription: true,
      sidebarCategory: 'feedback',
      hidePropertiesPanel: true
    }
  }
]

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    redirect: '/'
  },
  {
    path: '/billing',
    name: 'Billing',
    component: BillingView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/first-run',
    name: 'FirstRun',
    component: FirstRunView
  },
  {
    path: '/',
    component: MainLayout,
    children: layoutChildren
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const BILLING_PROMPT_PENDING_KEY = 'billingPromptPending'

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia)
  const subscriptionStore = useSubscriptionStore(pinia)

  await authStore.init()
  await subscriptionStore.init()

  if (authStore.accessToken && !authStore.isLoggedIn) {
    await authStore.clearAuth()
    await subscriptionStore.clear()
  }

  const subscriptionGuardEnabled = true

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresInitialization = to.matched.some((record) => record.meta.requiresInitialization)
  const redirectIfInitialized = to.matched.some((record) => record.meta.redirectIfInitialized)
  const requiresSubscription = subscriptionGuardEnabled && to.matched.some((record) => record.meta.requiresSubscription)
  const isFirstRunRoute = to.name === 'FirstRun'

  const getInitStatus = async (): Promise<InitStatus | null> => {
    if (!window.electronAPI?.bootstrap?.getInitStatus) {
      return null
    }
    const status = await window.electronAPI.bootstrap.getInitStatus()
    return status.success ? status.data || null : null
  }

  if (requiresInitialization || redirectIfInitialized) {
    const initStatus = await getInitStatus()
    if (requiresInitialization && initStatus && !initStatus.initialized) {
      return { name: 'FirstRun', query: { redirect: to.fullPath } }
    }
    if (redirectIfInitialized && initStatus?.initialized) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect.trim() : ''
      if (redirect) {
        return redirect
      }
      return { name: 'Home' }
    }
  }

  if (!isFirstRunRoute) {
    const initStatus = await getInitStatus()
    if (initStatus && !initStatus.initialized) {
      return { name: 'FirstRun', query: { redirect: to.fullPath } }
    }
  }

  if (authStore.isLoggedIn && requiresSubscription) {
    try {
      await subscriptionStore.refreshIfStale(30_000)
    } catch {
    }
    if (!subscriptionStore.isActive) {
      try {
        window.sessionStorage.setItem(BILLING_PROMPT_PENDING_KEY, '1')
      } catch {
      }
    }
  }
})

export default router
