<script setup>
import { Icon } from '@vicons/utils'

const props = defineProps({
  toolbarItems: {
    type: Array,
    default: () => [],
  },
  toolbarStyle: {
    type: String,
    default: 'text',
  },
  iconPreset: {
    type: String,
    default: 'builtin',
  },
  xiconComponents: {
    type: Object,
    default: () => ({}),
  },
  messages: {
    type: Object,
    required: true,
  },
  getToolbarLabel: {
    type: Function,
    required: true,
  },
  handleToolbarClick: {
    type: Function,
    required: true,
  },
})
</script>

<template>
  <template v-for="(item, index) in toolbarItems" :key="index">
    <div
      v-if="item === 'divider'"
      class="markdown-editor__toolbar-separator"
    ></div>
    <button
      v-else
      type="button"
      class="markdown-editor__toolbar-button"
      @click="handleToolbarClick(item)"
      :title="getToolbarLabel(item).tooltip"
    >
      <template v-if="iconPreset === 'xicons' && xiconComponents[item]">
        <Icon v-if="toolbarStyle !== 'text'" size="16">
          <component :is="xiconComponents[item]" />
        </Icon>
        <span v-if="toolbarStyle !== 'icon'">
          {{ (messages[item] && messages[item].label) || item }}
        </span>
      </template>
      <template v-else>
        {{ getToolbarLabel(item).text }}
      </template>
    </button>
  </template>
</template>

