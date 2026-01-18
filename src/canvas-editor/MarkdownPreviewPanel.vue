<template>
  <div class="preview-panel" ref="previewRef" @scroll="handleScroll" :data-theme="theme">
    <div class="preview-content" v-html="htmlContent"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  // 外部控制的滚动位置（百分比）
  scrollPercentage: {
    type: Number,
    default: 0
  },
  // 是否正在同步（避免循环）
  isSyncing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:scrollPercentage', 'scroll'])

const previewRef = ref(null)

// 配置 marked
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('Highlight error:', err)
      }
    }
    return code
  },
  breaks: true,
  gfm: true
})

// 解析 Markdown 为 HTML
const htmlContent = computed(() => {
  try {
    return marked.parse(props.modelValue)
  } catch (error) {
    console.error('Markdown parse error:', error)
    return '<p>解析错误</p>'
  }
})

// 监听外部滚动位置变化
watch(() => props.scrollPercentage, (newPercentage) => {
  if (props.isSyncing || !previewRef.value) return
  
  const element = previewRef.value
  const maxScroll = element.scrollHeight - element.clientHeight
  const targetScroll = maxScroll * newPercentage
  
  element.scrollTop = targetScroll
})

// 处理内部滚动
const handleScroll = () => {
  if (props.isSyncing || !previewRef.value) return
  
  const element = previewRef.value
  const maxScroll = element.scrollHeight - element.clientHeight
  
  if (maxScroll <= 0) {
    emit('update:scrollPercentage', 0)
    emit('scroll', 0)
    return
  }
  
  const percentage = element.scrollTop / maxScroll
  emit('update:scrollPercentage', percentage)
  emit('scroll', percentage)
}

// 监听主题变化
watch(() => props.theme, (newTheme) => {
  // 动态加载主题样式
  if (newTheme === 'dark') {
    import('highlight.js/styles/github-dark.css')
  } else {
    import('highlight.js/styles/github.css')
  }
})
</script>

<style scoped>
.preview-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: #ffffff;
  transition: background-color 0.3s;
}

.preview-panel::-webkit-scrollbar {
  width: 8px;
}

.preview-panel::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.preview-panel::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.preview-panel::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.preview-content {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #333;
}

/* 暗色主题 */
.preview-panel[data-theme="dark"] {
  background: #1e1e1e;
}

.preview-panel[data-theme="dark"] .preview-content {
  color: #cccccc;
}

/* Markdown 样式 */
.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3),
.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.preview-content :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.preview-content :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.preview-content :deep(h3) {
  font-size: 1.25em;
}

.preview-content :deep(h4) {
  font-size: 1em;
}

.preview-content :deep(h5) {
  font-size: 0.875em;
}

.preview-content :deep(h6) {
  font-size: 0.85em;
  color: #6a737d;
}

.preview-content :deep(p) {
  margin-top: 0;
  margin-bottom: 16px;
}

.preview-content :deep(a) {
  color: #0366d6;
  text-decoration: none;
}

.preview-content :deep(a:hover) {
  text-decoration: underline;
}

.preview-content :deep(strong) {
  font-weight: 600;
}

.preview-content :deep(em) {
  font-style: italic;
}

.preview-content :deep(code) {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.preview-content :deep(pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.preview-content :deep(pre code) {
  display: inline;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
}

.preview-content :deep(blockquote) {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

.preview-content :deep(li) {
  margin-bottom: 0.25em;
}

.preview-content :deep(li > p) {
  margin-bottom: 0;
}

.preview-content :deep(img) {
  max-width: 100%;
  box-sizing: content-box;
  background-color: #fff;
}

.preview-content :deep(hr) {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

.preview-content :deep(table) {
  border-spacing: 0;
  border-collapse: collapse;
  display: block;
  width: 100%;
  overflow: auto;
  margin-bottom: 16px;
}

.preview-content :deep(table th) {
  font-weight: 600;
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
  background-color: #f6f8fa;
}

.preview-content :deep(table td) {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.preview-content :deep(table tr) {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.preview-content :deep(table tr:nth-child(2n)) {
  background-color: #f6f8fa;
}

/* 任务列表 */
.preview-content :deep(input[type="checkbox"]) {
  margin-right: 0.5em;
}

/* 暗色主题下的代码块 */
.preview-panel[data-theme="dark"] .preview-content :deep(code) {
  background-color: rgba(110, 118, 129, 0.4);
}

.preview-panel[data-theme="dark"] .preview-content :deep(pre) {
  background-color: #2d2d2d;
}

.preview-panel[data-theme="dark"] .preview-content :deep(table th) {
  background-color: #2d2d2d;
  border-color: #444;
}

.preview-panel[data-theme="dark"] .preview-content :deep(table td) {
  border-color: #444;
}

.preview-panel[data-theme="dark"] .preview-content :deep(table tr) {
  background-color: #1e1e1e;
  border-color: #444;
}

.preview-panel[data-theme="dark"] .preview-content :deep(table tr:nth-child(2n)) {
  background-color: #252525;
}

.preview-panel[data-theme="dark"] .preview-content :deep(blockquote) {
  color: #8b949e;
  border-left-color: #3b3b3b;
}

.preview-panel[data-theme="dark"] .preview-content :deep(hr) {
  background-color: #3b3b3b;
}

.preview-panel[data-theme="dark"] .preview-content :deep(h1),
.preview-panel[data-theme="dark"] .preview-content :deep(h2) {
  border-bottom-color: #3b3b3b;
}
</style>
