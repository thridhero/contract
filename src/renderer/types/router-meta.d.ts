import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    guestOnly?: boolean
    requiresAuth?: boolean
    requiresInitialization?: boolean
    redirectIfInitialized?: boolean
    requiresSubscription?: boolean
    layoutContent?: 'resource'
    sidebarCategory?: string
    hidePropertiesPanel?: boolean
    preserveSidebarSelection?: boolean
  }
}

export {}
