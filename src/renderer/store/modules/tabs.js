/**
 * Vuex module for tab state management
 * IMPORTANT: Only stores SERIALIZABLE data - no router instances, Vue instances, or timers
 * Runtime objects are managed by TabHost/TabRuntimeRegistry
 */

function generateTabId() {
  return 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
}

const state = {
  tabs: [],
  activeTabId: null,
  tabOrder: [],
  closedTabs: [], // for "reopen closed tab" feature
  playingTabId: null, // Tab currently playing audio/video
}

const getters = {
  getTabs: (state) => state.tabs,
  getActiveTabId: (state) => state.activeTabId,
  getTabOrder: (state) => state.tabOrder,
  getClosedTabs: (state) => state.closedTabs,
  getPlayingTabId: (state) => state.playingTabId,

  getActiveTab: (state) => {
    return state.tabs.find(t => t.id === state.activeTabId) || null
  },

  getTabById: (state) => (tabId) => {
    return state.tabs.find(t => t.id === tabId) || null
  },

  getOrderedTabs: (state) => {
    return state.tabOrder
      .map(id => state.tabs.find(t => t.id === id))
      .filter(Boolean)
  },

  getTabCount: (state) => state.tabs.length,

  isTabPlaying: (state) => (tabId) => {
    return state.playingTabId === tabId
  },
}

const mutations = {
  ADD_TAB(state, tab) {
    state.tabs.push(tab)
    state.tabOrder.push(tab.id)
  },

  REMOVE_TAB(state, tabId) {
    state.tabs = state.tabs.filter(t => t.id !== tabId)
    state.tabOrder = state.tabOrder.filter(id => id !== tabId)
  },

  SET_ACTIVE_TAB(state, tabId) {
    state.activeTabId = tabId

    // Update lastActiveAt for the new active tab
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.lastActiveAt = Date.now()
    }
  },

  UPDATE_TAB(state, { tabId, updates }) {
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) {
      Object.assign(tab, updates)
    }
  },

  UPDATE_TAB_ROUTE(state, { tabId, route, query }) {
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.route = route
      tab.query = query || {}
    }
  },

  UPDATE_TAB_TITLE(state, { tabId, title }) {
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.title = title
    }
  },

  ADD_TO_CLOSED_TABS(state, tab) {
    state.closedTabs.push({
      route: tab.route,
      query: tab.query,
      title: tab.title,
      closedAt: Date.now(),
    })

    // Keep only last 10
    if (state.closedTabs.length > 10) {
      state.closedTabs.shift()
    }
  },

  POP_CLOSED_TAB(state) {
    state.closedTabs.pop()
  },

  REORDER_TABS(state, newOrder) {
    state.tabOrder = newOrder
  },

  CLEAR_ALL_TABS(state) {
    state.tabs = []
    state.tabOrder = []
    state.activeTabId = null
    state.playingTabId = null
  },

  SET_PLAYING_TAB(state, tabId) {
    state.playingTabId = tabId
  },
}

const actions = {
  /**
   * Create a new tab (metadata only - TabHost creates the actual Vue app)
   */
  createTab({ commit, state }, { id = null, route = '/', query = {}, title = 'New Tab', background = false }) {
    const tabId = id || generateTabId()

    // Determine icon based on route
    let icon = 'home'
    if (route.startsWith('/watch')) icon = 'play'
    else if (route.startsWith('/channel')) icon = 'user'
    else if (route.startsWith('/playlist')) icon = 'list'
    else if (route.startsWith('/search')) icon = 'search'
    else if (route.startsWith('/settings')) icon = 'cog'
    else if (route.startsWith('/history')) icon = 'history'
    else if (route.startsWith('/trending')) icon = 'fire'
    else if (route.startsWith('/subscriptions')) icon = 'rss'

    const tab = {
      id: tabId,
      title,
      route,
      query: query || {},
      icon,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isPinned: false,
      isLoading: true,
    }

    commit('ADD_TAB', tab)

    if (!background || state.tabs.length === 1) {
      commit('SET_ACTIVE_TAB', tabId)
    }

    return tabId
  },

  /**
   * Switch to a different tab
   */
  switchTab({ commit, state }, tabId) {
    if (state.activeTabId === tabId) return

    commit('SET_ACTIVE_TAB', tabId)
  },

  /**
   * Close a tab
   */
  closeTab({ commit, state, dispatch }, tabId) {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return

    // Save to closed tabs for undo
    commit('ADD_TO_CLOSED_TABS', tab)

    // If closing active tab, switch to adjacent
    if (state.activeTabId === tabId) {
      const currentIndex = state.tabOrder.indexOf(tabId)
      let nextTabId = null

      if (state.tabOrder.length > 1) {
        // Prefer tab to the right, then left
        if (currentIndex < state.tabOrder.length - 1) {
          nextTabId = state.tabOrder[currentIndex + 1]
        } else {
          nextTabId = state.tabOrder[currentIndex - 1]
        }
      }

      if (nextTabId) {
        commit('SET_ACTIVE_TAB', nextTabId)
      }
    }

    commit('REMOVE_TAB', tabId)

    return state.activeTabId
  },

  /**
   * Reopen the last closed tab
   */
  reopenClosedTab({ commit, state, dispatch }) {
    const lastClosed = state.closedTabs[state.closedTabs.length - 1]
    if (!lastClosed) return null

    commit('POP_CLOSED_TAB')

    return dispatch('createTab', {
      route: lastClosed.route,
      query: lastClosed.query,
      title: lastClosed.title,
      background: false,
    })
  },

  /**
   * Update tab route (called when tab navigates)
   */
  updateTabRoute({ commit }, { tabId, route, query, title }) {
    commit('UPDATE_TAB_ROUTE', { tabId, route, query })
    if (title) {
      commit('UPDATE_TAB_TITLE', { tabId, title })
    }
    commit('UPDATE_TAB', { tabId, updates: { isLoading: false } })
  },

  /**
   * Reorder tabs (for drag and drop)
   */
  reorderTabs({ commit }, newOrder) {
    commit('REORDER_TABS', newOrder)
  },
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
}
