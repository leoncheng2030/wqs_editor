<template>
  <div class="canvas-toolbar">
    <button
      v-for="(item, index) in toolbarItems"
      :key="index"
      class="toolbar-btn"
      :class="{ divider: item === 'divider' }"
      :title="getTooltip(item)"
      @click="handleClick(item)"
    >
      <component v-if="item !== 'divider'" :is="getIcon(item)" class="icon" />
    </button>
  </div>
</template>

<script setup>
import { h } from 'vue'
import {
  TextOutline,
  CodeSlashOutline,
  ListOutline,
  ReorderThreeOutline,
  ChatboxOutline,
  CodeOutline,
  LinkOutline,
  ImageOutline,
  GridOutline,
  CheckboxOutline,
  CalculatorOutline,
  GitNetworkOutline
} from '@vicons/ionicons5'

const props = defineProps({
  toolbarItems: {
    type: Array,
    default: () => [
      'h1',
      'h2',
      'divider',
      'bold',
      'italic',
      'divider',
      'unordered-list',
      'ordered-list',
      'todo',
      'blockquote',
      'code-block',
      'divider',
      'table',
      'math',
      'diagram',
      'divider',
      'link',
      'image'
    ]
  }
})

const emit = defineEmits(['command'])

const icons = {
  h1: () => h('span', { style: 'font-weight: bold; font-size: 16px;' }, 'H1'),
  h2: () => h('span', { style: 'font-weight: bold; font-size: 14px;' }, 'H2'),
  bold: () => h('span', { style: 'font-weight: bold; font-size: 16px;' }, 'B'),
  italic: () => h('span', { style: 'font-style: italic; font-size: 16px;' }, 'I'),
  'unordered-list': ListOutline,
  'ordered-list': ReorderThreeOutline,
  todo: CheckboxOutline,
  blockquote: ChatboxOutline,
  'code-block': CodeSlashOutline,
  table: GridOutline,
  math: CalculatorOutline,
  diagram: GitNetworkOutline,
  link: LinkOutline,
  image: ImageOutline
}

const tooltips = {
  h1: '一级标题',
  h2: '二级标题',
  bold: '加粗 (Ctrl+B)',
  italic: '斜体 (Ctrl+I)',
  'unordered-list': '无序列表',
  'ordered-list': '有序列表',
  todo: '任务列表',
  blockquote: '引用',
  'code-block': '代码块',
  table: '插入表格 (Ctrl+Shift+T)',
  math: '数学公式 (Ctrl+M)',
  diagram: '流程图 (Ctrl+Shift+D)',
  link: '插入链接',
  image: '插入图片'
}

const getIcon = (item) => {
  return icons[item] || item
}

const getTooltip = (item) => {
  return tooltips[item] || item
}

const handleClick = (item) => {
  if (item === 'divider') return
  emit('command', item)
}
</script>

<style scoped>
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-btn .icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn:hover {
  background: #e9e9e9;
  border-color: #999;
  color: #333;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.toolbar-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

.toolbar-btn.divider {
  width: 1px;
  min-width: 1px;
  height: 20px;
  padding: 0;
  margin: 0 4px;
  background: #ddd;
  border: none;
  cursor: default;
}

.toolbar-btn.divider:hover {
  background: #ddd;
  transform: none;
  box-shadow: none;
}
</style>
