<template>
  <div class="canvas-toolbar">
    <!-- 内置按钮 -->
    <button
      v-for="(item, index) in builtinItems"
      :key="'builtin-' + index"
      class="toolbar-btn"
      :class="{ divider: item === 'divider' }"
      :title="getBuiltinTooltip(item)"
      @click="handleBuiltinClick(item)"
    >
      <component v-if="item !== 'divider'" :is="getBuiltinIcon(item)" class="icon" />
    </button>
    
    <!-- 插件按钮分隔符 -->
    <span v-if="pluginButtons && pluginButtons.length > 0" class="toolbar-btn divider"></span>
    
    <!-- 插件按钮 -->
    <button
      v-for="btn in pluginButtons"
      :key="'plugin-' + btn.id"
      class="toolbar-btn"
      :title="btn.title"
      @click="handlePluginClick(btn)"
    >
      <span v-if="btn.icon.startsWith('text:')" class="icon-text">{{ btn.icon.slice(5) }}</span>
      <component v-else :is="getPluginIcon(btn.icon)" class="icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { h, computed } from 'vue'
import * as Icons from '@vicons/ionicons5'

interface ToolbarButton {
  id: string
  icon: string
  title: string
  command: string
  commandArgs?: any[]
}

const props = withDefaults(defineProps<{
  toolbarItems?: string[]
  pluginButtons?: ToolbarButton[]
}>(), {
  toolbarItems: () => [
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
  ],
  pluginButtons: () => []
})

const emit = defineEmits<{
  command: [item: string]
  'plugin-command': [data: { command: string; args: any[] }]
}>()

// 内置按钮项
const builtinItems = computed(() => props.toolbarItems)

// 内置图标映射
const builtinIcons = {
  h1: () => h('span', { style: 'font-weight: bold; font-size: 16px;' }, 'H1'),
  h2: () => h('span', { style: 'font-weight: bold; font-size: 14px;' }, 'H2'),
  bold: () => h('span', { style: 'font-weight: bold; font-size: 16px;' }, 'B'),
  italic: () => h('span', { style: 'font-style: italic; font-size: 16px;' }, 'I'),
  'unordered-list': Icons.ListOutline,
  'ordered-list': Icons.ReorderThreeOutline,
  blockquote: Icons.ChatboxOutline,
  'code-block': Icons.CodeSlashOutline,
  link: Icons.LinkOutline,
  image: Icons.ImageOutline
}

// 内置提示映射
const builtinTooltips = {
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

const getBuiltinIcon = (item: string) => {
  return (builtinIcons as any)[item] || item
}

const getBuiltinTooltip = (item: string) => {
  return (builtinTooltips as any)[item] || item
}

// 获取插件图标 - 直接使用 ionicons5 组件名
const getPluginIcon = (iconName: string) => {
  // 支持直接使用 ionicons5 组件名，如 'GridOutline', 'CheckboxOutline'
  if ((Icons as any)[iconName]) {
    return (Icons as any)[iconName]
  }
  // 默认图标
  return Icons.ExtensionPuzzleOutline
}

const handleBuiltinClick = (item: string) => {
  if (item === 'divider') return
  emit('command', item)
}

const handlePluginClick = (btn: ToolbarButton) => {
  emit('plugin-command', {
    command: btn.command,
    args: btn.commandArgs || []
  })
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

.toolbar-btn .icon-text {
  font-size: 12px;
  font-weight: bold;
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
