# @nywqs/vue-markdown-editor

<div align="center">

[![npm version](https://img.shields.io/npm/v/@nywqs/vue-markdown-editor.svg)](https://www.npmjs.com/package/@nywqs/vue-markdown-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-green.svg)](https://vuejs.org/)

**English** | [简体中文](./README.zh-CN.md)

</div>

A high-performance Markdown editor component based on Vue 3 and Canvas, featuring hybrid rendering architecture (Canvas + DOM), supporting large file editing, real-time syntax highlighting, and intelligent predictive rendering.

## ✨ Features

- 🚀 **High Performance**: Canvas + DOM hybrid rendering for smooth large file editing
- 🎨 **Syntax Highlighting**: Real-time Markdown syntax highlighting with theme switching
- 📝 **Rich Editing**: Toolbar shortcuts, keyboard shortcuts, search & replace
- 🔌 **Plugin System**: Extensible with tables, todo lists, math formulas, flowcharts
- 💡 **Smart Optimization**: Viewport clipping, virtual scrolling, incremental rendering, offscreen caching
- 🎯 **Live Preview**: Markdown preview panel with bidirectional scroll synchronization
- 🔒 **TypeScript**: Full TypeScript support with complete type definitions

## 🎯 Version 2.0

**New in v2.0.0:**
- ✅ Complete TypeScript migration (48 files, 15,000+ lines)
- ✅ Zero type errors with full type safety
- ✅ Enhanced IntelliSense and auto-completion
- ✅ Better code maintainability and refactoring safety
- 🐛 Fixed paste duplication bug

## 📦 Installation

```bash
npm install @nywqs/vue-markdown-editor
# or
yarn add @nywqs/vue-markdown-editor
# or
pnpm add @nywqs/vue-markdown-editor
```

## 🚀 Quick Start

### Global Registration

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/vue-markdown-editor.css'

const app = createApp(App)
app.component('CanvasEditor', CanvasEditor)
app.mount('#app')
```

### Basic Usage

```vue
<template>
  <div style="height: 600px;">
    <CanvasEditor 
      v-model="content"
      :theme="theme"
      :show-line-numbers="true"
      :show-toolbar="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/vue-markdown-editor.css'

const content = ref('# Hello Canvas Editor\n\nA high-performance Markdown editor')
const theme = ref<'light' | 'dark'>('light')
</script>
```

## 📖 Component Props

`CanvasEditor` supports the following props:

| Prop                    | Type                | Default   | Description |
|-------------------------|---------------------|-----------|-------------|
| `modelValue`            | `string`            | `''`      | Markdown content, supports `v-model` |
| `theme`                 | `'light' \| 'dark'` | `'light'` | Editor theme |
| `enableSyntaxHighlight` | `boolean`           | `true`    | Enable syntax highlighting |
| `fontSize`              | `number`            | `15`      | Font size in pixels |
| `lineHeight`            | `number`            | `26`      | Line height in pixels |
| `showLineNumbers`       | `boolean`           | `true`    | Show line numbers |
| `showToolbar`           | `boolean`           | `true`    | Show toolbar |
| `scrollPercentage`      | `number`            | `0`       | External scroll position (0-1) |
| `isSyncing`             | `boolean`           | `false`   | Is syncing scroll (avoid loops) |

### Default Toolbar Items

```ts
[
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
]
```

## ⚡ Events

The component emits the following events:

| Event                     | Parameters         | Description |
|---------------------------|--------------------|-------------|
| `update:modelValue`       | `(value: string)`  | `v-model` binding event |
| `update:scrollPercentage` | `(value: number)`  | Triggered on scroll position change |
| `scroll`                  | `(value: number)`  | Scroll event |

## 🎨 Themes and Styling

The editor supports `light` and `dark` themes:

```vue
<CanvasEditor v-model="content" theme="dark" />
```

You can customize styles using CSS variables (see `style.css` in source).

## 🔧 Using with Preview Panel

For live preview, use with `MarkdownPreviewPanel` component:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor, MarkdownPreviewPanel } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/vue-markdown-editor.css'

const content = ref('# Hello\n\nPreview content here')
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

<template>
  <div style="display: flex; height: 600px;">
    <div style="flex: 1;">
      <CanvasEditor 
        v-model="content"
        :theme="theme"
        :scroll-percentage="editorScrollPercentage"
        :is-syncing="isSyncingEditor"
        @scroll="handleEditorScroll"
      />
    </div>
    <div style="flex: 1;">
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
```

## 🔌 Plugin System

Built-in plugins:

- **TablePlugin**: Table insertion and editing (Ctrl+Shift+T)
- **TodoListPlugin**: Todo list support
- **MathPlugin**: Math formula support (Ctrl+M)
- **MermaidPlugin**: Flowchart support (Ctrl+Shift+D)
- **AutoCompletePlugin**: Auto-completion
- **SyntaxCheckerPlugin**: Syntax checking

Plugins are automatically activated, no additional configuration needed.

## ⚙️ Performance Optimizations

The editor employs multiple performance optimization techniques:

1. **Viewport Clipping**: Only renders visible area, 10-40x performance boost for large files
2. **Virtual Scrolling**: Buffer mechanism to avoid scroll flickering
3. **Incremental Rendering**: Only redraws changed lines, 3-5x faster during editing
4. **Offscreen Caching**: Static content (line numbers, background) cached to offscreen canvas
5. **Smart Scheduling**: Debounce optimization + immediate render hybrid strategy

These optimizations enable smooth handling of large documents (10,000+ lines).

## 🛠️ Development

This repository uses Vite + Vue 3 for development and building.

Local development:

```bash
npm install
npm run dev
```

Build library:

```bash
npm run build:lib
```

Type checking:

```bash
npm run typecheck
```

## 🔄 Migration to v2.0

If you're upgrading from v1.x to v2.0:

**Import Changes:**

```ts
// v1.x (default export)
import VueMarkdownEditor from '@nywqs/vue-markdown-editor'

// v2.0 (named export - recommended)
import { CanvasEditor } from '@nywqs/vue-markdown-editor'

// v2.0 (alternative named export)
import { VueMarkdownEditor } from '@nywqs/vue-markdown-editor'
```

**No Breaking Changes**: All public APIs remain compatible.

## 📚 Documentation

- [API Reference](./API.md) - Complete API documentation
- [Performance Benchmark](./BENCHMARK.md) - Detailed performance comparison
- [Examples & Tutorials](./EXAMPLES.md) - Usage examples and tutorials
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Changelog](./CHANGELOG.md) - Version history

## 📝 License

MIT © [nywqs](https://github.com/leoncheng2030)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/leoncheng2030/wqs_editor/issues).

## ⭐ Show your support

Give a ⭐️ if this project helped you!
