<template>
  <div
    v-if="showTabBar"
    class="tabBar"
    :class="[`tabBar-${position}`]"
  >
    <div
      ref="tabListRef"
      class="tabList"
      @wheel.prevent="handleWheel"
    >
      <div
        v-for="tab in orderedTabs"
        :key="tab.id"
        class="tab"
        :class="{
          active: tab.id === activeTabId,
          loading: tab.isLoading,
          playing: tab.id === playingTabId
        }"
        :title="tab.title"
        tabindex="0"
        role="tab"
        :aria-selected="tab.id === activeTabId"
        @click="switchToTab(tab.id)"
        @keydown.enter="switchToTab(tab.id)"
        @keydown.space.prevent="switchToTab(tab.id)"
        @mousedown.middle.prevent="closeTab(tab.id)"
      >
        <!-- Playing indicator / Mute button -->
        <button
          v-if="tab.id === playingTabId || tab.isMuted"
          class="tabAudioButton"
          :title="tab.isMuted ? t('Unmute Tab') : t('Mute Tab')"
          @click.stop="toggleMute(tab.id)"
        >
          <FontAwesomeIcon
            :icon="tab.isMuted ? ['fas', 'volume-mute'] : ['fas', 'volume-high']"
            :class="{ muted: tab.isMuted }"
          />
        </button>
        <FontAwesomeIcon
          v-else
          :icon="getTabIcon(tab)"
          class="tabIcon"
        />
        <span class="tabTitle">{{ tab.title }}</span>
        <button
          class="tabCloseButton"
          :title="t('Close Tab')"
          @click.stop="closeTab(tab.id)"
        >
          <FontAwesomeIcon :icon="['fas', 'xmark']" />
        </button>
      </div>
    </div>
    <button
      class="newTabButton"
      :title="t('New Tab')"
      @click="createNewTab"
    >
      <FontAwesomeIcon :icon="['fas', 'plus']" />
    </button>
  </div>
</template>

<script setup>
import { computed, useTemplateRef, watch, nextTick } from 'vue'
import { useI18n } from '../../composables/use-i18n-polyfill'
import store from '../../store/index'
import { playbackCoordinator } from '../../helpers/PlaybackCoordinator'

const { t } = useI18n()

defineProps({
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value)
  }
})

const emit = defineEmits(['create-tab', 'switch-tab', 'close-tab'])

const tabListRef = useTemplateRef('tabListRef')

/**
 * Handle mouse wheel to scroll tab bar horizontally
 * @param {WheelEvent} event
 */
function handleWheel(event) {
  if (tabListRef.value) {
    tabListRef.value.scrollLeft += event.deltaY
  }
}

/**
 * Scroll the active tab into view if it's not visible
 */
function scrollActiveTabIntoView() {
  nextTick(() => {
    if (!tabListRef.value) return

    const activeTab = tabListRef.value.querySelector('.tab.active')
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  })
}

// Show tab bar when there's more than 1 tab (or always show for testing)
const showTabBar = computed(() => {
  return store.getters['tabs/getTabCount'] > 0
})

const orderedTabs = computed(() => {
  return store.getters['tabs/getOrderedTabs']
})

const activeTabId = computed(() => {
  return store.getters['tabs/getActiveTabId']
})

// Scroll active tab into view when it changes (e.g., keyboard navigation)
watch(activeTabId, () => {
  scrollActiveTabIntoView()
})

const playingTabId = computed(() => {
  return store.getters['tabs/getPlayingTabId']
})

function getTabIcon(tab) {
  const iconMap = {
    play: ['fas', 'play'],
    user: ['fas', 'circle-user'],
    list: ['fas', 'list'],
    search: ['fas', 'search'],
    cog: ['fas', 'sliders-h'],
    history: ['fas', 'history'],
    fire: ['fas', 'fire'],
    rss: ['fas', 'rss'],
    home: ['fas', 'grip'],
  }
  return iconMap[tab.icon] || ['fas', 'grip']
}

function switchToTab(tabId) {
  if (tabId !== activeTabId.value) {
    emit('switch-tab', tabId)
  }
}

function closeTab(tabId) {
  emit('close-tab', tabId)
}

function createNewTab() {
  emit('create-tab')
}

function toggleMute(tabId) {
  playbackCoordinator.toggleMuteTab(tabId)
}
</script>

<style scoped>
.tabBar {
  display: flex;
  align-items: center;
  background-color: var(--side-nav-color);
  border-block-end: 1px solid var(--primary-shadow-color);
  block-size: 36px;
  padding-inline: 4px;
  gap: 4px;
  overflow: hidden;
  position: sticky;
  inset-block-start: 60px; /* Below TopNav */
  z-index: 5; /* Above toasts (z-index 4) */
  inline-size: 100%;
}

.tabList {
  display: flex;
  flex: 1;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabList::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-inline: 10px;
  block-size: 28px;
  background-color: var(--card-bg-color);
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  min-inline-size: 100px;
  max-inline-size: 200px;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
}

.tab:hover {
  background-color: var(--side-nav-hover-color);
}

.tab.active {
  background-color: var(--bg-color);
  border-block-end: 2px solid var(--primary-color);
}

.tab.playing {
  /* Subtle glow for playing tab */
}

.tab.loading .tabIcon {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tabIcon {
  font-size: 12px;
  color: var(--secondary-text-color);
  flex-shrink: 0;
}

.tab.active .tabIcon {
  color: var(--primary-color);
}

.tabAudioButton {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--primary-color);
  padding: 2px;
  font-size: 12px;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.tabAudioButton:hover {
  color: var(--primary-color-hover);
}

.tabAudioButton .muted {
  color: var(--secondary-text-color);
}

.tabTitle {
  flex: 1;
  font-size: 12px;
  color: var(--primary-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabCloseButton {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--secondary-text-color);
  padding: 2px;
  inline-size: 18px;
  block-size: 18px;
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.tab:hover .tabCloseButton {
  opacity: 1;
}

.tabCloseButton:hover {
  background-color: var(--primary-shadow-color);
  color: var(--primary-text-color);
}

.newTabButton {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--secondary-text-color);
  padding: 4px 8px;
  block-size: 28px;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
}

.newTabButton:hover {
  background-color: var(--side-nav-hover-color);
  color: var(--primary-text-color);
}

/* Bottom position - same as top but border on top */
.tabBar-bottom {
  border-block-start: 1px solid var(--primary-shadow-color);
  border-block-end: none;
  inset-block-start: auto;
}

.tabBar-bottom .tab {
  border-radius: 0 0 6px 6px;
}

.tabBar-bottom .tab.active {
  border-block-end: none;
  border-block-start: 2px solid var(--primary-color);
}

/* Left position - vertical tab bar */
.tabBar-left {
  flex-direction: column;
  inline-size: 180px;
  block-size: auto;
  min-block-size: 100%;
  border-block-end: none;
  border-inline-end: 1px solid var(--primary-shadow-color);
  inset-block-start: 0;
  padding-block: 4px;
  padding-inline: 4px;
}

.tabBar-left .tabList {
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
}

.tabBar-left .tab {
  min-inline-size: 100%;
  max-inline-size: 100%;
  border-radius: 6px 0 0 6px;
}

.tabBar-left .tab.active {
  border-block-end: none;
  border-inline-end: 2px solid var(--primary-color);
}

.tabBar-left .newTabButton {
  inline-size: 100%;
}

/* Right position - vertical tab bar on right side */
.tabBar-right {
  flex-direction: column;
  inline-size: 180px;
  block-size: auto;
  min-block-size: 100%;
  border-block-end: none;
  border-inline-start: 1px solid var(--primary-shadow-color);
  inset-block-start: 0;
  padding-block: 4px;
  padding-inline: 4px;
}

.tabBar-right .tabList {
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
}

.tabBar-right .tab {
  min-inline-size: 100%;
  max-inline-size: 100%;
  border-radius: 0 6px 6px 0;
}

.tabBar-right .tab.active {
  border-block-end: none;
  border-inline-start: 2px solid var(--primary-color);
}

.tabBar-right .newTabButton {
  inline-size: 100%;
}
</style>
