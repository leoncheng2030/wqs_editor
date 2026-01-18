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
      <span v-if="item !== 'divider'" class="icon">{{ getIcon(item) }}</span>
    </button>
  </div>
</template>

<script setup>
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
      'blockquote',
      'code-block',
      'divider',
      'link',
      'image'
    ]
  }
})

const emit = defineEmits(['command'])

const icons = {
  h1: 'H1',
  h2: 'H2',
  bold: '𝗕',
  italic: '𝘐',
  'unordered-list': '•',
  'ordered-list': '1.',
  blockquote: '❝',
  'code-block': '</>',
  link: '🔗',
  image: '🖼'
}

const tooltips = {
  h1: '一级标题',
  h2: '二级标题',
  bold: '加粗 (Ctrl+B)',
  italic: '斜体 (Ctrl+I)',
  'unordered-list': '无序列表',
  'ordered-list': '有序列表',
  blockquote: '引用',
  'code-block': '代码块',
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
  font-weight: bold;
  user-select: none;
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
