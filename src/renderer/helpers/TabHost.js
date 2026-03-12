import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import store from '../store/index'
import i18n from '../i18n/index'
import TabAppRoot from '../components/TabAppRoot.vue'
import { routes } from '../router/index.js'
import { FontAwesomeIcon, FontAwesomeLayers } from '@fortawesome/vue-fontawesome'
import { ObserveVisibility } from 'vue-observe-visibility'

/**
 * TabHost manages child Vue app instances (tabs)
 * Each tab is an independent Vue root with its own router instance
 * This provides true router isolation without the complexity of multiple windows
 */
class TabHost {
  constructor() {
    /** @type {Map<string, {vueRoot: any, router: any, mountPoint: HTMLElement, suspensionTimer: number|null, snapshot: any}>} */
    this.tabs = new Map()
    /** @type {Map<string, {top: number, left: number}>} */
    this.scrollPositions = new Map()
  }

  /**
   * Create a new tab with its own Vue root and router
   * @param {string} tabId - Unique tab identifier
   * @param {string} initialRoute - Initial route path (e.g., '/watch/abc123')
   * @param {object} initialQuery - Initial route query params
   * @returns {{router: any, vueRoot: any}}
   */
  createTab(tabId, initialRoute = '/', initialQuery = {}) {
    // Create mount point div
    const mountPoint = document.createElement('div')
    mountPoint.id = `tab-${tabId}`
    mountPoint.className = 'tab-root'
    mountPoint.style.display = 'none' // hidden by default

    const container = document.getElementById('tab-host-container')
    if (!container) {
      console.error('Tab host container not found! Cannot create tab.')
      return { router: null, vueRoot: null }
    }
    container.appendChild(mountPoint)

    // Create independent router instance for this tab
    const router = createRouter({
      history: createWebHashHistory(),
      routes: routes, // reuse same route definitions
      scrollBehavior(to, from, savedPosition) {
        return new Promise((resolve) => {
          setTimeout(() => {
            // Only scroll if this tab is visible (not a background tab)
            if (mountPoint.style.display === 'none') {
              resolve(false) // Don't scroll for hidden tabs
              return
            }

            if (savedPosition !== null) {
              resolve(savedPosition)
            } else {
              resolve({ left: 0, top: 0 })
            }
          }, 500)
        })
      }
    })

    // Create child Vue app instance
    const tabApp = createApp(TabAppRoot, { tabId })

    // Share global services (store, i18n) but use tab-specific router
    tabApp.use(router)
    tabApp.use(store) // SAME Vuex store (shared state)
    tabApp.use(i18n)  // SAME i18n instance

    // Register FontAwesome components globally (same as main app)
    tabApp
      .component('FontAwesomeIcon', FontAwesomeIcon)
      .component('FontAwesomeLayers', FontAwesomeLayers)
      .directive('observe-visibility', ObserveVisibility)

    // Mount into dedicated container
    const vueRoot = tabApp.mount(`#tab-${tabId}`)

    // Navigate to initial route
    router.push({ path: initialRoute, query: initialQuery })

    // Register runtime
    this.tabs.set(tabId, {
      vueRoot,
      router,
      mountPoint,
      suspensionTimer: null,
      snapshot: null,
    })

    return { router, vueRoot }
  }

  /**
   * Show a tab (make it visible and active)
   * @param {string} tabId
   */
  showTab(tabId) {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      console.warn(`[TabHost] Cannot show tab ${tabId}: not found`)
      return
    }

    // Save scroll position of currently visible tab before hiding
    this.tabs.forEach((t, id) => {
      if (id !== tabId && t.mountPoint?.style.display !== 'none') {
        this.scrollPositions.set(id, {
          top: window.scrollY,
          left: window.scrollX
        })
      }
    })

    // Prepare other tabs for background (pause video, etc.)
    this.tabs.forEach((t, id) => {
      if (id !== tabId && t.vueRoot && t.mountPoint?.style.display !== 'none') {
        // Call prepareForBackground on the tab being hidden
        try {
          t.vueRoot.prepareForBackground?.()
        } catch {
          // Ignore errors from tab background preparation
        }
      }
    })

    // Hide all other tabs
    this.tabs.forEach((t, id) => {
      if (t.mountPoint) {
        t.mountPoint.style.display = id === tabId ? 'block' : 'none'
      }
    })

    // Cancel suspension timer if armed
    if (tab.suspensionTimer) {
      clearTimeout(tab.suspensionTimer)
      tab.suspensionTimer = null
    }

    // If tab was suspended, restore it
    if (tab.snapshot) {
      this.restoreTab(tabId)
    }

    // Prepare the shown tab for foreground
    if (tab.vueRoot) {
      try {
        tab.vueRoot.prepareForForeground?.()
      } catch {
        // Ignore errors from tab foreground preparation
      }
    }

    // Restore scroll position for the newly shown tab
    const savedScroll = this.scrollPositions.get(tabId)
    if (savedScroll) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({
          top: savedScroll.top,
          left: savedScroll.left,
          behavior: 'instant'
        })
      })
    } else {
      // New tab or first time shown - scroll to top
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      })
    }
  }

  /**
   * Arm suspension timer for a background tab
   * @param {string} tabId
   * @param {number} timeoutMs - Default 5 minutes
   */
  armSuspension(tabId, timeoutMs = 300000) {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    tab.suspensionTimer = setTimeout(() => {
      this.suspendTab(tabId)
    }, timeoutMs)
  }

  /**
   * Suspend a tab (destroy Vue root to free memory)
   * @param {string} tabId
   */
  suspendTab(tabId) {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.vueRoot) return

    // Get snapshot from tab app (if it implements getSnapshot)
    const snapshot = tab.vueRoot.getSnapshot?.() || {
      route: tab.router.currentRoute.value.fullPath,
      query: tab.router.currentRoute.value.query,
    }

    // Destroy Vue root (this destroys player, KeepAlive cache, everything)
    tab.vueRoot.appContext?.app?.unmount?.() // Vue 3 unmount
    tab.mountPoint?.remove()

    // Store snapshot and mark as suspended
    tab.snapshot = snapshot
    tab.vueRoot = null
    tab.router = null
    tab.mountPoint = null
  }

  /**
   * Restore a suspended tab from its snapshot
   * @param {string} tabId
   */
  restoreTab(tabId) {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.snapshot) return

    // Recreate tab from snapshot
    const { route, query } = tab.snapshot
    const { vueRoot } = this.createTab(tabId, route, query || {})

    // Restore saved state (scroll, watch position, etc.)
    if (vueRoot && tab.snapshot) {
      vueRoot.restoreSnapshot?.(tab.snapshot)
    }

    // Clear snapshot
    tab.snapshot = null
  }

  /**
   * Completely destroy a tab (for closing)
   * @param {string} tabId
   */
  destroyTab(tabId) {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    // Clear suspension timer
    if (tab.suspensionTimer) {
      clearTimeout(tab.suspensionTimer)
    }

    // Destroy Vue root
    if (tab.vueRoot) {
      tab.vueRoot.appContext?.app?.unmount?.()
    }

    // Remove DOM
    tab.mountPoint?.remove()

    // Clean up scroll position
    this.scrollPositions.delete(tabId)

    // Unregister
    this.tabs.delete(tabId)
  }

  /**
   * Navigate a specific tab to a new route
   * @param {string} tabId
   * @param {string | object} route
   */
  navigateTab(tabId, route) {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.router) {
      console.warn(`[TabHost] Cannot navigate tab ${tabId}: tab not found or suspended`)
      return
    }

    tab.router.push(route)
  }

  /**
   * Get current route of a tab
   * @param {string} tabId
   * @returns {string|null}
   */
  getTabRoute(tabId) {
    const tab = this.tabs.get(tabId)
    if (!tab) return null

    if (tab.router) {
      return tab.router.currentRoute.value.fullPath
    } else if (tab.snapshot) {
      return tab.snapshot.route
    }

    return null
  }

  /**
   * Get the router instance for a tab
   * @param {string} tabId
   * @returns {import('vue-router').Router|null}
   */
  getTabRouter(tabId) {
    const tab = this.tabs.get(tabId)
    return tab?.router || null
  }
}

// Singleton instance
export const tabHost = new TabHost()
