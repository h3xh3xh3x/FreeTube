<template>
  <FtSettingsSection
    :title="$t('Settings.Tab Settings.Tab Settings')"
  >
    <FtFlexBox>
      <FtSelect
        :placeholder="$t('Settings.Tab Settings.Tab Bar Position')"
        :value="tabBarPosition"
        :select-names="tabBarPositionNames"
        :select-values="TAB_BAR_POSITION_VALUES"
        :icon="tabBarPositionIcon"
        @change="updateTabBarPosition"
      />
      <FtSelect
        :placeholder="$t('Settings.General Settings.Middle Click Action.Middle Click Action')"
        :value="middleClickAction"
        :select-names="middleClickActionNames"
        :select-values="MIDDLE_CLICK_ACTION_VALUES"
        :icon="['fas', 'mouse']"
        @change="updateMiddleClickAction"
      />
    </FtFlexBox>
  </FtSettingsSection>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/use-i18n-polyfill'

import FtFlexBox from './ft-flex-box/ft-flex-box.vue'
import FtSelect from './FtSelect/FtSelect.vue'
import FtSettingsSection from './FtSettingsSection/FtSettingsSection.vue'

import store from '../store/index'

const { t } = useI18n()

// Tab bar position
const TAB_BAR_POSITION_VALUES = ['top', 'bottom', 'left', 'right']

const tabBarPositionNames = computed(() => [
  t('Settings.Tab Settings.Position.Top'),
  t('Settings.Tab Settings.Position.Bottom'),
  t('Settings.Tab Settings.Position.Left'),
  t('Settings.Tab Settings.Position.Right')
])

/** @type {import('vue').ComputedRef<'top' | 'bottom' | 'left' | 'right'>} */
const tabBarPosition = computed(() => store.getters.getTabBarPosition)

const tabBarPositionIcon = computed(() => {
  const iconMap = {
    top: ['fas', 'arrow-up'],
    bottom: ['fas', 'arrow-down'],
    left: ['fas', 'arrow-left'],
    right: ['fas', 'arrow-right']
  }
  return iconMap[tabBarPosition.value] || ['fas', 'grip']
})

/**
 * @param {'top' | 'bottom' | 'left' | 'right'} value
 */
function updateTabBarPosition(value) {
  store.dispatch('updateTabBarPosition', value)
}

// Middle click action (moved from General Settings)
const MIDDLE_CLICK_ACTION_VALUES = ['openInTab', 'openInWindow']

const middleClickActionNames = computed(() => [
  t('Settings.General Settings.Middle Click Action.Open in Tab'),
  t('Settings.General Settings.Middle Click Action.Open in Window')
])

/** @type {import('vue').ComputedRef<'openInTab' | 'openInWindow'>} */
const middleClickAction = computed(() => store.getters.getMiddleClickAction)

/**
 * @param {'openInTab' | 'openInWindow'} value
 */
function updateMiddleClickAction(value) {
  store.dispatch('updateMiddleClickAction', value)
}
</script>
