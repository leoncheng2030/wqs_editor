<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { tokenizeMarkdown } from '../utils/markdown'
import { createEditorCommands } from '../utils/editorCommands'
import MarkdownToolbar from './MarkdownToolbar.vue'
import MarkdownEditorPane from './MarkdownEditorPane.vue'
import MarkdownPreviewPane from './MarkdownPreviewPane.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import { Icon } from '@vicons/utils'
import {
  MoonOutline,
  TextOutline,
  ListOutline,
  LinkOutline,
  ImageOutline,
  CodeSlashOutline,
  ChatboxOutline,
  RemoveOutline,
} from '@vicons/ionicons5'
const builtinMessages = {
  'zh-CN': {
    'theme-toggle': {
      label: '主题',
      icon: '🌓',
      tooltip: '切换主题',
    },
    h1: {
      label: '一级',
      icon: 'H1',
      tooltip: '一级标题',
    },
    h2: {
      label: '二级',
      icon: 'H2',
      tooltip: '二级标题',
    },
    bold: {
      label: '加粗',
      icon: '𝗕',
      tooltip: '加粗 (Ctrl+B)',
    },
    italic: {
      label: '斜体',
      icon: '𝘐',
      tooltip: '斜体 (Ctrl+I)',
    },
    'unordered-list': {
      label: '无序',
      icon: '•',
      tooltip: '无序列表 (Ctrl+Shift+U)',
    },
    'ordered-list': {
      label: '有序',
      icon: '1.',
      tooltip: '有序列表 (Ctrl+Shift+O)',
    },
    blockquote: {
      label: '引用',
      icon: '❝',
      tooltip: '引用 (Ctrl+Shift+Q)',
    },
    'code-block': {
      label: '代码',
      icon: '</>',
      tooltip: '代码块 (Ctrl+E)',
    },
    'horizontal-rule': {
      label: '分割',
      icon: '─',
      tooltip: '分割线 (Ctrl+Shift+H)',
    },
    link: {
      label: '链接',
      icon: '🔗',
      tooltip: '链接 [文本](url) (Ctrl+K)',
    },
    image: {
      label: '图片',
      icon: '🖼',
      tooltip: '图片 ![alt](url) (Ctrl+Shift+K)',
    },
  },
  'en-US': {
    'theme-toggle': {
      label: 'Theme',
      icon: '🌓',
      tooltip: 'Toggle theme',
    },
    h1: {
      label: 'H1',
      icon: 'H1',
      tooltip: 'Heading 1',
    },
    h2: {
      label: 'H2',
      icon: 'H2',
      tooltip: 'Heading 2',
    },
    bold: {
      label: 'Bold',
      icon: '𝗕',
      tooltip: 'Bold (Ctrl+B)',
    },
    italic: {
      label: 'Italic',
      icon: '𝘐',
      tooltip: 'Italic (Ctrl+I)',
    },
    'unordered-list': {
      label: 'Bullets',
      icon: '•',
      tooltip: 'Unordered list (Ctrl+Shift+U)',
    },
    'ordered-list': {
      label: 'Numbered',
      icon: '1.',
      tooltip: 'Ordered list (Ctrl+Shift+O)',
    },
    blockquote: {
      label: 'Quote',
      icon: '❝',
      tooltip: 'Blockquote (Ctrl+Shift+Q)',
    },
    'code-block': {
      label: 'Code',
      icon: '</>',
      tooltip: 'Code block (Ctrl+E)',
    },
    'horizontal-rule': {
      label: 'Rule',
      icon: '─',
      tooltip: 'Horizontal rule (Ctrl+Shift+H)',
    },
    link: {
      label: 'Link',
      icon: '🔗',
      tooltip: 'Link [text](url) (Ctrl+K)',
    },
    image: {
      label: 'Image',
      icon: '🖼',
      tooltip: 'Image ![alt](url) (Ctrl+Shift+K)',
    },
  },
}

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  theme: {
    type: String,
    default: 'dark',
    validator: value => ['dark', 'light'].includes(value),
  },
  locale: {
    type: String,
    default: 'zh-CN',
  },
  toolbarStyle: {
    type: String,
    default: 'text',
    validator: value => ['text', 'icon', 'both'].includes(value),
  },
  iconPreset: {
    type: String,
    default: 'xicons',
    validator: value => ['builtin', 'xicons'].includes(value),
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
  showLineNumbers: {
    type: Boolean,
    default: true,
  },
  showToolbar: {
    type: Boolean,
    default: true,
  },
  showPreview: {
    type: Boolean,
    default: true,
  },
  showFooter: {
    type: Boolean,
    default: true,
  },
  autofocus: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '',
  },
  footerText: {
    type: String,
    default: '',
  },
  toolbarItems: {
    type: Array,
    default: () => [
      'theme-toggle',
      'divider',
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
      'horizontal-rule',
      'divider',
      'link',
      'image',
    ],
  },
})

const emit = defineEmits(['update:modelValue', 'update:theme', 'change', 'save', 'focus', 'blur'])

const initialValue =
  props.modelValue ||
  `# 欢迎使用 Markdown 编辑器

## 快速上手

- 左侧是自研编辑器（带行号、代码风格）
- 右侧实时预览渲染效果
- Tab 支持缩进，Ctrl+B 支持加粗
`

const internalValue = ref(initialValue)

const editorPaneRef = ref(null)
const textareaRef = computed(() => editorPaneRef.value?.textareaRef || null)
const panesRef = ref(null)

const tokens = computed(() => tokenizeMarkdown(internalValue.value))

const lines = computed(() => (internalValue.value ? internalValue.value.split('\n') : ['']))

const charCount = computed(() => {
  const value = internalValue.value || ''
  return value.replace(/\s/g, '').length
})

const defaultFooterText = computed(() => {
  const year = new Date().getFullYear()
  return `© ${year} Markdown Editor`
})

const resolvedFooterText = computed(() => props.footerText || defaultFooterText.value)

const xiconComponents = {
  'theme-toggle': MoonOutline,
  'unordered-list': ListOutline,
  'ordered-list': ListOutline,
  blockquote: ChatboxOutline,
  'code-block': CodeSlashOutline,
  'horizontal-rule': RemoveOutline,
  link: LinkOutline,
  image: ImageOutline,
}

const messages = computed(() => {
  const base = builtinMessages['en-US']
  const localeMessages = builtinMessages[props.locale] || builtinMessages['zh-CN']
  return {
    ...base,
    ...localeMessages,
  }
})

const getToolbarLabel = key => {
  const config = messages.value[key] || {
    label: key,
    icon: key,
    tooltip: key,
  }
  const text =
    props.toolbarStyle === 'icon'
      ? config.icon
      : props.toolbarStyle === 'both'
        ? `${config.icon} ${config.label}`
        : config.label
  return {
    text,
    tooltip: config.tooltip,
  }
}

watch(
  () => props.modelValue,
  value => {
    if (value !== internalValue.value) {
      internalValue.value = value || ''
    }
  },
)

const updateValue = value => {
  if (props.readOnly) return
  internalValue.value = value
  emit('update:modelValue', value)
  emit('change', value)
}

const syncToParent = () => {
  updateValue(internalValue.value)
}

const {
  applyLineTransform,
  wrapSelection,
  toggleHeading,
  insertUnorderedList,
  insertOrderedList,
  insertBlockquote,
  insertCodeBlock,
  insertHorizontalRule,
  insertLink,
  insertImage,
  handleKeydown,
} = createEditorCommands({
  internalValue,
  textareaRef,
  props,
  emit,
  syncToParent,
})

const handleFocus = event => {
  emit('focus', event)
}

const handleBlur = event => {
  emit('blur', event)
}

const handleToolbarClick = key => {
  if (key === 'theme-toggle') {
    toggleTheme()
    return
  }
  if (props.readOnly) return
  if (key === 'h1') {
    toggleHeading(1)
    return
  }
  if (key === 'h2') {
    toggleHeading(2)
    return
  }
  if (key === 'bold') {
    wrapSelection('**', '**')
    return
  }
  if (key === 'italic') {
    wrapSelection('*', '*')
    return
  }
  if (key === 'unordered-list') {
    insertUnorderedList()
    return
  }
  if (key === 'ordered-list') {
    insertOrderedList()
    return
  }
  if (key === 'blockquote') {
    insertBlockquote()
    return
  }
  if (key === 'code-block') {
    insertCodeBlock()
    return
  }
  if (key === 'horizontal-rule') {
    insertHorizontalRule()
    return
  }
  if (key === 'link') {
    insertLink()
    return
  }
  if (key === 'image') {
    insertImage()
  }
}

const editorWidth = ref(50)
const isDragging = ref(false)

const handleDragging = event => {
  if (!isDragging.value) return
  const container = panesRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  if (!rect.width) return
  const offsetX = event.clientX - rect.left
  const percent = Math.max(10, Math.min(90, (offsetX / rect.width) * 100))
  editorWidth.value = percent
}

const stopDragging = () => {
  if (!isDragging.value) return
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragging)
  document.removeEventListener('mouseup', stopDragging)
}

const startDragging = () => {
  if (!props.showPreview) return
  if (isDragging.value) return
  isDragging.value = true
  document.addEventListener('mousemove', handleDragging)
  document.addEventListener('mouseup', stopDragging)
}
const currentTheme = ref(props.theme || 'dark')

watch(
  () => props.theme,
  value => {
    if (value && value !== currentTheme.value) {
      currentTheme.value = value
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDragging)
  document.removeEventListener('mouseup', stopDragging)
})

const toggleTheme = () => {
  const next = currentTheme.value === 'dark' ? 'light' : 'dark'
  currentTheme.value = next
  emit('update:theme', next)
}

const editorClasses = computed(() => [
  'markdown-editor',
  `markdown-editor--${currentTheme.value}`,
  `markdown-editor--toolbar-${props.toolbarStyle}`,
])
</script>

<template>
  <div :class="editorClasses">
    <div v-if="showToolbar" class="markdown-editor__toolbar">
      <slot
        name="toolbar"
        :wrap-selection="wrapSelection"
        :toggle-heading="toggleHeading"
        :insert-unordered-list="insertUnorderedList"
        :insert-ordered-list="insertOrderedList"
        :insert-blockquote="insertBlockquote"
        :insert-code-block="insertCodeBlock"
        :insert-horizontal-rule="insertHorizontalRule"
        :insert-link="insertLink"
        :insert-image="insertImage"
        :toggle-theme="toggleTheme"
        :handle-toolbar-click="handleToolbarClick"
        :xicon-components="xiconComponents"
      >
        <MarkdownToolbar
          :toolbar-items="toolbarItems"
          :toolbar-style="toolbarStyle"
          :icon-preset="iconPreset"
          :xicon-components="xiconComponents"
          :messages="messages"
          :get-toolbar-label="getToolbarLabel"
          :handle-toolbar-click="handleToolbarClick"
        />
      </slot>
    </div>
    <div ref="panesRef" class="markdown-editor__panes">
      <MarkdownEditorPane
        ref="editorPaneRef"
        :style="showPreview ? { flexBasis: editorWidth + '%' } : {}"
        :model-value="internalValue"
        :lines="lines"
        :show-line-numbers="showLineNumbers"
        :read-only="readOnly"
        :placeholder="placeholder"
        @update:model-value="updateValue"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <div
        v-if="showPreview"
        :class="['markdown-editor__divider', { 'markdown-editor__divider--dragging': isDragging }]"
        @mousedown="startDragging"
      ></div>
      <MarkdownPreviewPane
        v-if="showPreview"
        :style="{ flexBasis: (100 - editorWidth) + '%' }"
      >
        <slot name="preview" :tokens="tokens">
          <MarkdownPreview :tokens="tokens" />
        </slot>
      </MarkdownPreviewPane>
    </div>
    <div v-if="showFooter" class="markdown-editor__footer">
      <div class="markdown-editor__footer-left">
        {{ resolvedFooterText }}
      </div>
      <div class="markdown-editor__footer-right">
        字数：{{ charCount }}
      </div>
    </div>
  </div>
</template>
