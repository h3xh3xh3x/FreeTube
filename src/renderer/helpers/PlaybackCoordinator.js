/**
 * PlaybackCoordinator - Manages playback across tabs
 *
 * Ensures only one tab plays audio at a time (unless PiP).
 * Provides methods to register/unregister players and coordinate playback.
 *
 * This is a standalone singleton - NOT stored in Vuex (non-serializable).
 */

import store from '../store'

class PlaybackCoordinator {
  constructor() {
    /** @type {Map<string, PlayerController>} */
    this.players = new Map()

    /** @type {string|null} */
    this.playingTabId = null
  }

  /**
   * Register a player controller for a tab
   * @param {string} tabId
   * @param {PlayerController} controller - Must implement: pause(), play(), isPlaying(), isPiP(), isMuted(), mute(), unmute(), getVolume()
   */
  registerPlayer(tabId, controller) {
    this.players.set(tabId, controller)
  }

  /**
   * Unregister a player (on tab close or player destroy)
   * @param {string} tabId
   */
  unregisterPlayer(tabId) {
    this.players.delete(tabId)

    if (this.playingTabId === tabId) {
      this.playingTabId = null
      this.updatePlayingTabInStore(null)
    }
  }

  /**
   * Called when a player starts playing
   * Pauses all other players (unless in PiP mode)
   * @param {string} tabId
   */
  onPlayStarted(tabId) {
    // Pause all other players (except PiP)
    this.players.forEach((player, id) => {
      if (id !== tabId) {
        try {
          if (player.isPlaying() && !player.isPiP()) {
            player.pause()
          }
        } catch {
          // Ignore errors from player control
        }
      }
    })

    this.playingTabId = tabId
    this.updatePlayingTabInStore(tabId)
  }

  /**
   * Called when a player pauses or stops
   * @param {string} tabId
   */
  onPlayStopped(tabId) {
    if (this.playingTabId === tabId) {
      this.playingTabId = null
      this.updatePlayingTabInStore(null)
    }
  }

  /**
   * Pause all players
   */
  pauseAll() {
    this.players.forEach((player) => {
      try {
        if (player.isPlaying()) {
          player.pause()
        }
      } catch {
        // Ignore errors from player control
      }
    })
    this.playingTabId = null
    this.updatePlayingTabInStore(null)
  }

  /**
   * Pause all players except the specified tab
   * @param {string} exceptTabId
   */
  pauseAllExcept(exceptTabId) {
    this.players.forEach((player, id) => {
      if (id !== exceptTabId) {
        try {
          if (player.isPlaying()) {
            player.pause()
          }
        } catch {
          // Ignore errors from player control
        }
      }
    })
  }

  /**
   * Mute a specific tab
   * @param {string} tabId
   */
  muteTab(tabId) {
    const player = this.players.get(tabId)
    if (player) {
      try {
        player.mute()
        this.updateTabMutedState(tabId, true)
      } catch {
        // Ignore errors from player control
      }
    }
  }

  /**
   * Unmute a specific tab
   * @param {string} tabId
   */
  unmuteTab(tabId) {
    const player = this.players.get(tabId)
    if (player) {
      try {
        player.unmute()
        this.updateTabMutedState(tabId, false)
      } catch {
        // Ignore errors from player control
      }
    }
  }

  /**
   * Toggle mute for a tab
   * @param {string} tabId
   */
  toggleMuteTab(tabId) {
    const player = this.players.get(tabId)
    if (player) {
      try {
        if (player.isMuted()) {
          player.unmute()
          this.updateTabMutedState(tabId, false)
        } else {
          player.mute()
          this.updateTabMutedState(tabId, true)
        }
      } catch {
        // Ignore errors from player control
      }
    }
  }

  /**
   * Check if a tab is currently playing
   * @param {string} tabId
   * @returns {boolean}
   */
  isTabPlaying(tabId) {
    const player = this.players.get(tabId)
    if (player) {
      try {
        return player.isPlaying()
      } catch {
        return false
      }
    }
    return false
  }

  /**
   * Check if a tab is muted
   * @param {string} tabId
   * @returns {boolean}
   */
  isTabMuted(tabId) {
    const player = this.players.get(tabId)
    if (player) {
      try {
        return player.isMuted()
      } catch {
        return false
      }
    }
    return false
  }

  /**
   * Get the currently playing tab ID
   * @returns {string|null}
   */
  getPlayingTabId() {
    return this.playingTabId
  }

  /**
   * Update Vuex store with playing tab
   * @param {string|null} tabId
   */
  updatePlayingTabInStore(tabId) {
    store.commit('tabs/SET_PLAYING_TAB', tabId)
  }

  /**
   * Update Vuex store with tab muted state
   * @param {string} tabId
   * @param {boolean} isMuted
   */
  updateTabMutedState(tabId, isMuted) {
    store.commit('tabs/UPDATE_TAB', {
      tabId,
      updates: { isMuted }
    })
  }
}

// Singleton instance
export const playbackCoordinator = new PlaybackCoordinator()

/**
 * @typedef {object} PlayerController
 * @property {() => void} pause
 * @property {() => void} play
 * @property {() => boolean} isPlaying
 * @property {() => boolean} isPiP
 * @property {() => boolean} isMuted
 * @property {() => void} mute
 * @property {() => void} unmute
 * @property {() => number} getVolume
 */
