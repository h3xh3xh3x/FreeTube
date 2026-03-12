/**
 * Tab utility functions for use by components
 * These functions interface with the tab system from anywhere in the app
 */

import store from '../store/index'
import { tabHost } from './TabHost'

/**
 * Open a route in a new background tab
 * @param {string} route - The route path (e.g., '/watch/abc123')
 * @param {object} query - Query parameters
 * @param {string} title - Tab title
 * @returns {string} The new tab ID
 */
export function openInBackgroundTab(route, query = {}, title = 'New Tab') {
  // Generate ID synchronously
  const newTabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

  // Create in Vuex (background = true)
  store.dispatch('tabs/createTab', {
    id: newTabId,
    route,
    query,
    title,
    background: true,
  })

  // Create in TabHost (but don't show)
  tabHost.createTab(newTabId, route, query)

  // Listen to route changes in this tab to update Vuex
  const tabRouter = tabHost.getTabRouter(newTabId)
  if (tabRouter) {
    tabRouter.afterEach((to) => {
      store.dispatch('tabs/updateTabRoute', {
        tabId: newTabId,
        route: to.path,
        query: to.query,
        title: to.meta?.title || to.path,
      })
    })
  }

  return newTabId
}

/**
 * Open a route in a new foreground tab
 * @param {string} route - The route path
 * @param {object} query - Query parameters
 * @param {string} title - Tab title
 * @returns {string} The new tab ID
 */
export function openInNewTab(route, query = {}, title = 'New Tab') {
  const newTabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

  // Create in Vuex
  store.dispatch('tabs/createTab', {
    id: newTabId,
    route,
    query,
    title,
    background: false,
  })

  // Create and show in TabHost
  tabHost.createTab(newTabId, route, query)
  tabHost.showTab(newTabId)

  // Listen to route changes
  const tabRouter = tabHost.getTabRouter(newTabId)
  if (tabRouter) {
    tabRouter.afterEach((to) => {
      store.dispatch('tabs/updateTabRoute', {
        tabId: newTabId,
        route: to.path,
        query: to.query,
        title: to.meta?.title || to.path,
      })
    })
  }

  return newTabId
}
