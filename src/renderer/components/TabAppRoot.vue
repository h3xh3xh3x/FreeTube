<template>
  <div class="tab-app-root">
    <!--
      This is the root component for each tab's Vue app.
      It's a minimal wrapper around RouterView - the global chrome
      (TopNav, SideNav) stays in the main App.vue.
    -->
    <RouterView v-slot="{ Component }">
      <Transition
        mode="out-in"
        name="fade"
      >
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>

<script setup>
import { getCurrentInstance, onMounted, onBeforeUnmount, ref, provide } from 'vue'
import { useRoute } from 'vue-router'
import { playbackCoordinator } from '../helpers/PlaybackCoordinator'

const props = defineProps({
  tabId: {
    type: String,
    required: true
  }
})

// Provide tabId to all child components so they can update their tab's title
provide('tabId', props.tabId)

const route = useRoute()
const instance = getCurrentInstance()
const rootElement = ref(null)

onMounted(() => {
  rootElement.value = instance?.proxy?.$el

  // Register player controller with PlaybackCoordinator
  playbackCoordinator.registerPlayer(props.tabId, {
    pause: () => pauseVideo(),
    play: () => playVideo(),
    isPlaying: () => isVideoPlaying(),
    isPiP: () => isVideoPiP(),
    isMuted: () => isVideoMuted(),
    mute: () => muteVideo(),
    unmute: () => unmuteVideo(),
    getVolume: () => getVideoVolume(),
  })

  // Listen for play events on video elements in this tab
  setupVideoEventListeners()
})

onBeforeUnmount(() => {
  playbackCoordinator.unregisterPlayer(props.tabId)
})

/**
 * Get the video element in this tab (if any)
 */
function getVideoElement() {
  if (!rootElement.value) return null
  return rootElement.value.querySelector('video')
}

/**
 * Setup event listeners on video elements to track playback state
 */
function setupVideoEventListeners() {
  // Use MutationObserver to detect when video elements are added
  const observer = new MutationObserver(() => {
    const video = getVideoElement()
    if (video && !video._tabPlaybackListenersAdded) {
      video._tabPlaybackListenersAdded = true

      video.addEventListener('play', () => {
        playbackCoordinator.onPlayStarted(props.tabId)
      })

      video.addEventListener('pause', () => {
        playbackCoordinator.onPlayStopped(props.tabId)
      })

      video.addEventListener('ended', () => {
        playbackCoordinator.onPlayStopped(props.tabId)
      })
    }
  })

  if (rootElement.value) {
    observer.observe(rootElement.value, { childList: true, subtree: true })
  }
}

function pauseVideo() {
  const video = getVideoElement()
  if (video && !video.paused) {
    video.pause()
  }
}

function playVideo() {
  const video = getVideoElement()
  if (video && video.paused) {
    video.play()
  }
}

function isVideoPlaying() {
  const video = getVideoElement()
  return video ? !video.paused : false
}

function isVideoPiP() {
  const video = getVideoElement()
  return video ? document.pictureInPictureElement === video : false
}

function isVideoMuted() {
  const video = getVideoElement()
  return video ? video.muted : false
}

function muteVideo() {
  const video = getVideoElement()
  if (video) {
    video.muted = true
  }
}

function unmuteVideo() {
  const video = getVideoElement()
  if (video) {
    video.muted = false
  }
}

function getVideoVolume() {
  const video = getVideoElement()
  return video ? video.volume : 1
}

/**
 * Snapshot contract: Save tab state for suspension
 */
function getSnapshot() {
  const video = getVideoElement()
  return {
    route: route.fullPath,
    query: route.query,
    title: document.title,
    timestamp: Date.now(),
    videoTime: video?.currentTime || 0,
    wasPlaying: video ? !video.paused : false,
  }
}

/**
 * Restore tab state after suspension
 * @param {object} snapshot - The snapshot to restore
 */
function restoreSnapshot(snapshot) {
  // Future: restore scroll position, video time, etc.
  if (snapshot.videoTime) {
    const video = getVideoElement()
    if (video) {
      video.currentTime = snapshot.videoTime
    }
  }
}

/**
 * Prepare tab for background (pause players, etc.)
 */
function prepareForBackground() {
  pauseVideo()
}

/**
 * Prepare tab for foreground (don't auto-resume)
 */
function prepareForForeground() {
  // Don't auto-resume playback - let user decide
}

// Expose methods to parent (TabHost)
if (instance) {
  instance.proxy.getSnapshot = getSnapshot
  instance.proxy.restoreSnapshot = restoreSnapshot
  instance.proxy.prepareForBackground = prepareForBackground
  instance.proxy.prepareForForeground = prepareForForeground
}
</script>

<style scoped>
.tab-app-root {
  /* Take full height of container */
  height: 100%;
  width: 100%;
}

/* Reuse the same fade transition from main App.vue */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
