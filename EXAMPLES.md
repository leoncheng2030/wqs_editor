# Examples & Tutorials

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>

## English

### 📚 Table of Contents

- [Basic Examples](#basic-examples)
- [Advanced Examples](#advanced-examples)
- [Plugin Development](#plugin-development)
- [Real-world Use Cases](#real-world-use-cases)

---

## Basic Examples

### 1. Minimal Setup

The simplest way to use the editor:

```vue
<template>
  <CanvasEditor v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/vue-markdown-editor.css'

const content = ref('# Hello World')
</script>
```

### 2. With Theme Switching

Add light/dark theme support:

```vue
<template>
  <div>
    <button @click="toggleTheme">Toggle Theme</button>
    <CanvasEditor v-model="content" :theme="theme" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# Hello World')
const theme = ref<'light' | 'dark'>('light')

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>
```

### 3. Custom Font Settings

Customize font size and line height:

```vue
<template>
  <CanvasEditor
    v-model="content"
    :font-size="fontSize"
    :line-height="lineHeight"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# Custom Font')
const fontSize = ref(18)
const lineHeight = ref(30)
</script>
```

---

## Advanced Examples

### 4. Split View with Live Preview

Editor and preview side by side with scroll sync:

```vue
<template>
  <div class="editor-container">
    <div class="editor-pane">
      <CanvasEditor
        v-model="content"
        :theme="theme"
        :scroll-percentage="editorScrollPercentage"
        :is-syncing="isSyncingEditor"
        @scroll="handleEditorScroll"
      />
    </div>
    <div class="preview-pane">
      <MarkdownPreviewPanel
        :model-value="content"
        :theme="theme"
        :scroll-percentage="previewScrollPercentage"
        :is-syncing="isSyncingPreview"
        @scroll="handlePreviewScroll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor, MarkdownPreviewPanel } from '@nywqs/vue-markdown-editor'

const content = ref('# Split View Example\n\nEdit on the left, preview on the right!')
const theme = ref<'light' | 'dark'>('light')
const editorScrollPercentage = ref(0)
const previewScrollPercentage = ref(0)
const isSyncingEditor = ref(false)
const isSyncingPreview = ref(false)

const handleEditorScroll = (percentage: number) => {
  if (isSyncingPreview.value) return
  isSyncingEditor.value = true
  previewScrollPercentage.value = percentage
  setTimeout(() => { isSyncingEditor.value = false }, 100)
}

const handlePreviewScroll = (percentage: number) => {
  if (isSyncingEditor.value) return
  isSyncingPreview.value = true
  editorScrollPercentage.value = percentage
  setTimeout(() => { isSyncingPreview.value = false }, 100)
}
</script>

<style scoped>
.editor-container {
  display: flex;
  height: 100vh;
}
.editor-pane,
.preview-pane {
  flex: 1;
  overflow: hidden;
}
</style>
```

### 5. Auto-Save to LocalStorage

Automatically save content to browser storage:

```vue
<template>
  <div>
    <div class="save-indicator">
      {{ saveStatus }}
    </div>
    <CanvasEditor v-model="content" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const STORAGE_KEY = 'markdown-content'
const content = ref(localStorage.getItem(STORAGE_KEY) || '# Welcome')
const saveStatus = ref('Saved')

// Auto-save with debounce
let saveTimer: number
watch(content, (newContent) => {
  saveStatus.value = 'Saving...'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, newContent)
    saveStatus.value = 'Saved'
  }, 1000)
})
</script>

<style scoped>
.save-indicator {
  padding: 8px;
  text-align: right;
  color: #888;
  font-size: 12px;
}
</style>
```

### 6. File Import/Export

Load and save Markdown files:

```vue
<template>
  <div>
    <div class="toolbar">
      <button @click="importFile">Import File</button>
      <button @click="exportFile">Export File</button>
    </div>
    <CanvasEditor v-model="content" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# Document')

const importFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        content.value = event.target?.result as string
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

const exportFile = () => {
  const blob = new Blob([content.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.md'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
```

### 7. Custom Toolbar

Create a custom toolbar with specific items:

```vue
<template>
  <CanvasEditor
    v-model="content"
    :toolbar-items="customToolbar"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# Custom Toolbar')

const customToolbar = [
  'h1',
  'h2',
  'h3',
  'divider',
  'bold',
  'italic',
  'divider',
  'link',
  'image',
  'code-block'
]
</script>
```

### 8. With Configuration Panel

Add editor configuration UI:

```vue
<template>
  <div class="app">
    <div class="config-panel">
      <EditorConfig
        v-model:theme="theme"
        v-model:font-size="fontSize"
        v-model:line-height="lineHeight"
        v-model:enable-syntax-highlight="syntaxHighlight"
      />
    </div>
    <div class="editor-panel">
      <CanvasEditor
        v-model="content"
        :theme="theme"
        :font-size="fontSize"
        :line-height="lineHeight"
        :enable-syntax-highlight="syntaxHighlight"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor, EditorConfig } from '@nywqs/vue-markdown-editor'

const content = ref('# Configurable Editor')
const theme = ref<'light' | 'dark'>('light')
const fontSize = ref(15)
const lineHeight = ref(26)
const syntaxHighlight = ref(true)
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
}
.config-panel {
  width: 300px;
  border-right: 1px solid #ddd;
}
.editor-panel {
  flex: 1;
}
</style>
```

---

## Plugin Development

### 9. Custom Plugin Example

Create a word counter plugin:

```typescript
import { Plugin, PluginContext } from '@nywqs/vue-markdown-editor'

export class WordCounterPlugin implements Plugin {
  name = 'word-counter'
  version = '1.0.0'
  private context: PluginContext | null = null
  private wordCount = 0

  activate(context: PluginContext) {
    this.context = context
    
    // Listen to document changes
    context.document.on('change', () => {
      this.updateWordCount()
    })
    
    // Initial count
    this.updateWordCount()
  }

  deactivate() {
    this.context = null
  }

  private updateWordCount() {
    if (!this.context) return
    const text = this.context.document.getText()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    this.wordCount = words.length
    console.log(`Word count: ${this.wordCount}`)
  }

  getToolbarButtons() {
    return [{
      id: 'word-counter',
      icon: '📊',
      title: `Words: ${this.wordCount}`,
      command: 'showWordCount',
      commandArgs: []
    }]
  }
}

// Register plugin
pluginManager.register(WordCounterPlugin)
await pluginManager.activate('word-counter')
```

---

## Real-world Use Cases

### 10. Note-Taking App

```vue
<template>
  <div class="notes-app">
    <aside class="sidebar">
      <h3>My Notes</h3>
      <div
        v-for="note in notes"
        :key="note.id"
        :class="{ active: note.id === currentNoteId }"
        @click="selectNote(note.id)"
      >
        {{ note.title }}
      </div>
      <button @click="createNewNote">+ New Note</button>
    </aside>
    <main class="editor-area">
      <CanvasEditor v-model="currentNote.content" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

interface Note {
  id: string
  title: string
  content: string
}

const notes = ref<Note[]>([
  { id: '1', title: 'Welcome', content: '# Welcome to Notes' }
])

const currentNoteId = ref('1')
const currentNote = computed(() => 
  notes.value.find(n => n.id === currentNoteId.value) || notes.value[0]
)

const selectNote = (id: string) => {
  currentNoteId.value = id
}

const createNewNote = () => {
  const newNote: Note = {
    id: Date.now().toString(),
    title: 'New Note',
    content: '# New Note'
  }
  notes.value.push(newNote)
  currentNoteId.value = newNote.id
}
</script>
```

### 11. Documentation Site

```vue
<template>
  <div class="docs-site">
    <nav class="toc">
      <h3>Table of Contents</h3>
      <ul>
        <li v-for="heading in headings" :key="heading.id">
          <a :href="`#${heading.id}`">{{ heading.text }}</a>
        </li>
      </ul>
    </nav>
    <main class="content">
      <MarkdownPreviewPanel :model-value="content" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MarkdownPreviewPanel } from '@nywqs/vue-markdown-editor'

const content = ref(`
# Documentation

## Getting Started

...

## API Reference

...
`)

const headings = computed(() => {
  const matches = content.value.matchAll(/^#{1,6}\s+(.+)$/gm)
  return Array.from(matches).map((match, i) => ({
    id: `heading-${i}`,
    text: match[1]
  }))
})
</script>
```

### 12. Collaborative Editing (Concept)

```vue
<template>
  <div>
    <div class="users">
      <span v-for="user in onlineUsers" :key="user.id">
        {{ user.name }}
      </span>
    </div>
    <CanvasEditor
      v-model="content"
      @update:model-value="handleContentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# Collaborative Document')
const onlineUsers = ref([])

// WebSocket connection
let ws: WebSocket

onMounted(() => {
  ws = new WebSocket('ws://localhost:8080')
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'content-update') {
      content.value = data.content
    } else if (data.type === 'users') {
      onlineUsers.value = data.users
    }
  }
})

const handleContentChange = (newContent: string) => {
  ws.send(JSON.stringify({
    type: 'content-update',
    content: newContent
  }))
}
</script>
```

---

<a name="简体中文"></a>

## 简体中文

### 📚 目录

- [基础示例](#基础示例)
- [高级示例](#高级示例)
- [插件开发](#插件开发-1)
- [实际应用案例](#实际应用案例)

---

## 基础示例

### 1. 最简单的使用

最简单的编辑器使用方式：

```vue
<template>
  <CanvasEditor v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/vue-markdown-editor.css'

const content = ref('# 你好世界')
</script>
```

### 2. 主题切换

添加明暗主题切换功能：

```vue
<template>
  <div>
    <button @click="toggleTheme">切换主题</button>
    <CanvasEditor v-model="content" :theme="theme" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# 你好世界')
const theme = ref<'light' | 'dark'>('light')

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>
```

### 3. 自定义字体设置

自定义字体大小和行高：

```vue
<template>
  <CanvasEditor
    v-model="content"
    :font-size="fontSize"
    :line-height="lineHeight"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# 自定义字体')
const fontSize = ref(18)
const lineHeight = ref(30)
</script>
```

---

## 高级示例

### 4. 分屏预览

编辑器和预览并排显示，支持滚动同步：

```vue
<template>
  <div class="editor-container">
    <div class="editor-pane">
      <CanvasEditor
        v-model="content"
        :theme="theme"
        :scroll-percentage="editorScrollPercentage"
        :is-syncing="isSyncingEditor"
        @scroll="handleEditorScroll"
      />
    </div>
    <div class="preview-pane">
      <MarkdownPreviewPanel
        :model-value="content"
        :theme="theme"
        :scroll-percentage="previewScrollPercentage"
        :is-syncing="isSyncingPreview"
        @scroll="handlePreviewScroll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor, MarkdownPreviewPanel } from '@nywqs/vue-markdown-editor'

const content = ref('# 分屏示例\n\n左边编辑，右边预览！')
const theme = ref<'light' | 'dark'>('light')
const editorScrollPercentage = ref(0)
const previewScrollPercentage = ref(0)
const isSyncingEditor = ref(false)
const isSyncingPreview = ref(false)

const handleEditorScroll = (percentage: number) => {
  if (isSyncingPreview.value) return
  isSyncingEditor.value = true
  previewScrollPercentage.value = percentage
  setTimeout(() => { isSyncingEditor.value = false }, 100)
}

const handlePreviewScroll = (percentage: number) => {
  if (isSyncingEditor.value) return
  isSyncingPreview.value = true
  editorScrollPercentage.value = percentage
  setTimeout(() => { isSyncingPreview.value = false }, 100)
}
</script>

<style scoped>
.editor-container {
  display: flex;
  height: 100vh;
}
.editor-pane,
.preview-pane {
  flex: 1;
  overflow: hidden;
}
</style>
```

### 5. 自动保存到本地存储

自动将内容保存到浏览器存储：

```vue
<template>
  <div>
    <div class="save-indicator">
      {{ saveStatus }}
    </div>
    <CanvasEditor v-model="content" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const STORAGE_KEY = 'markdown-content'
const content = ref(localStorage.getItem(STORAGE_KEY) || '# 欢迎')
const saveStatus = ref('已保存')

// 带防抖的自动保存
let saveTimer: number
watch(content, (newContent) => {
  saveStatus.value = '保存中...'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, newContent)
    saveStatus.value = '已保存'
  }, 1000)
})
</script>

<style scoped>
.save-indicator {
  padding: 8px;
  text-align: right;
  color: #888;
  font-size: 12px;
}
</style>
```

### 6. 文件导入导出

加载和保存 Markdown 文件：

```vue
<template>
  <div>
    <div class="toolbar">
      <button @click="importFile">导入文件</button>
      <button @click="exportFile">导出文件</button>
    </div>
    <CanvasEditor v-model="content" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

const content = ref('# 文档')

const importFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        content.value = event.target?.result as string
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

const exportFile = () => {
  const blob = new Blob([content.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.md'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
```

---

## 插件开发

### 9. 自定义插件示例

创建一个字数统计插件：

```typescript
import { Plugin, PluginContext } from '@nywqs/vue-markdown-editor'

export class WordCounterPlugin implements Plugin {
  name = 'word-counter'
  version = '1.0.0'
  private context: PluginContext | null = null
  private wordCount = 0

  activate(context: PluginContext) {
    this.context = context
    
    // 监听文档变化
    context.document.on('change', () => {
      this.updateWordCount()
    })
    
    // 初始统计
    this.updateWordCount()
  }

  deactivate() {
    this.context = null
  }

  private updateWordCount() {
    if (!this.context) return
    const text = this.context.document.getText()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    this.wordCount = words.length
    console.log(`字数：${this.wordCount}`)
  }

  getToolbarButtons() {
    return [{
      id: 'word-counter',
      icon: '📊',
      title: `字数：${this.wordCount}`,
      command: 'showWordCount',
      commandArgs: []
    }]
  }
}

// 注册插件
pluginManager.register(WordCounterPlugin)
await pluginManager.activate('word-counter')
```

---

## 实际应用案例

### 10. 笔记应用

```vue
<template>
  <div class="notes-app">
    <aside class="sidebar">
      <h3>我的笔记</h3>
      <div
        v-for="note in notes"
        :key="note.id"
        :class="{ active: note.id === currentNoteId }"
        @click="selectNote(note.id)"
      >
        {{ note.title }}
      </div>
      <button @click="createNewNote">+ 新建笔记</button>
    </aside>
    <main class="editor-area">
      <CanvasEditor v-model="currentNote.content" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

interface Note {
  id: string
  title: string
  content: string
}

const notes = ref<Note[]>([
  { id: '1', title: '欢迎', content: '# 欢迎使用笔记' }
])

const currentNoteId = ref('1')
const currentNote = computed(() => 
  notes.value.find(n => n.id === currentNoteId.value) || notes.value[0]
)

const selectNote = (id: string) => {
  currentNoteId.value = id
}

const createNewNote = () => {
  const newNote: Note = {
    id: Date.now().toString(),
    title: '新笔记',
    content: '# 新笔记'
  }
  notes.value.push(newNote)
  currentNoteId.value = newNote.id
}
</script>
```

---

## 🔗 相关资源

- [API 文档](./API.md)
- [贡献指南](./CONTRIBUTING.md)
- [性能基准](./BENCHMARK.md)
- [更新日志](./CHANGELOG.md)

---

## 📝 开源协议

MIT © [nywqs](https://github.com/leoncheng2030)
