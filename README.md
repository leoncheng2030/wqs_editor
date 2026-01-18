# @nywqs/vue-markdown-editor

一个基于 Vue 3 和 Canvas 的高性能 Markdown 编辑器组件，采用混合渲染架构（Canvas + DOM），支持大文件编辑、实时语法高亮、智能预测渲染等特性。

## ✨ 核心特性

- 🚀 **高性能渲染**：Canvas + DOM 混合渲染，支持大文件流畅编辑
- 🎨 **实时语法高亮**：支持 Markdown 语法高亮和主题切换
- 📝 **丰富的编辑功能**：工具栏快捷操作、键盘快捷键、搜索替换
- 🔌 **插件系统**：支持表格、待办列表、数学公式、流程图等扩展
- 💡 **智能优化**：视口裁剪、虚拟滚动、增量渲染、离屏缓存
- 🎯 **实时预览**：支持 Markdown 预览面板，双向滚动同步

---

## 📦 安装

```bash
npm install @nywqs/vue-markdown-editor
# 或
yarn add @nywqs/vue-markdown-editor
# 或
pnpm add @nywqs/vue-markdown-editor
```

---

## 🚀 快速上手

### 全局注册组件

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { CanvasEditor } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const app = createApp(App)

// 作为全局组件使用
app.component('CanvasEditor', CanvasEditor)

app.mount('#app')
```

### 基本用法

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
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const content = ref('# Hello Canvas Editor\n\n这是一个高性能的 Markdown 编辑器')
const theme = ref('light')
</script>
```

---

## 📖 组件属性（Props）

`CanvasEditor` 主要支持以下 props：

| Prop                    | 类型                | 默认值    | 说明 |
|-------------------------|---------------------|-----------|------|
| `modelValue`            | `string`            | `''`      | 当前 Markdown 文本内容，支持 `v-model` |
| `theme`                 | `'light' \| 'dark'` | `'light'` | 编辑器主题 |
| `enableSyntaxHighlight` | `boolean`           | `true`    | 是否启用语法高亮 |
| `fontSize`              | `number`            | `15`      | 字体大小（像素） |
| `lineHeight`            | `number`            | `26`      | 行高（像素） |
| `showLineNumbers`       | `boolean`           | `true`    | 是否显示行号 |
| `showToolbar`           | `boolean`           | `true`    | 是否显示工具栏 |
| `scrollPercentage`      | `number`            | `0`       | 外部控制的滚动位置（百分比，0-1） |
| `isSyncing`             | `boolean`           | `false`   | 是否正在同步滚动（避免循环） |

### `toolbarItems` 默认值

默认工具栏包含主题切换、标题、加粗、斜体、列表、引用、代码块、分割线、链接、图片：

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

---

## ⚡ 事件（Emits）

组件会触发以下事件：

| 事件名                    | 参数               | 说明 |
|---------------------------|--------------------|------|
| `update:modelValue`       | `(value: string)`  | `v-model` 双向绑定事件 |
| `update:scrollPercentage` | `(value: number)`  | 滚动位置变化时触发 |
| `scroll`                  | `(value: number)`  | 滚动事件 |

---

## 🎨 主题和样式

编辑器支持 `light` 和 `dark` 两种内置主题，可以通过 `theme` 属性切换：

```vue
<CanvasEditor v-model="content" theme="dark" />
```

你也可以通过 CSS 变量自定义样式（见源码 `style.css`）。

---

## 🔧 配合预览面板使用

如果需要实时预览，可以配合 `MarkdownPreviewPanel` 组件使用：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { CanvasEditor, MarkdownPreviewPanel } from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const content = ref('# Hello\n\n这是预览内容')
const theme = ref('light')
const editorScrollPercentage = ref(0)
const previewScrollPercentage = ref(0)
const isSyncingEditor = ref(false)
const isSyncingPreview = ref(false)

const handleEditorScroll = (percentage) => {
  if (isSyncingPreview.value) return
  isSyncingEditor.value = true
  previewScrollPercentage.value = percentage
  setTimeout(() => { isSyncingEditor.value = false }, 100)
}

const handlePreviewScroll = (percentage) => {
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
        :content="content"
        :theme="theme"
        :scroll-percentage="previewScrollPercentage"
        :is-syncing="isSyncingPreview"
        @scroll="handlePreviewScroll"
      />
    </div>
  </div>
</template>
```

---

## 🔌 插件系统

编辑器内置了丰富的插件：

- **TablePlugin**：表格插入和编辑（Ctrl+Shift+T）
- **TodoListPlugin**：待办列表支持
- **MathPlugin**：数学公式支持（Ctrl+M）
- **MermaidPlugin**：流程图支持（Ctrl+Shift+D）
- **AutoCompletePlugin**：自动补全
- **SyntaxCheckerPlugin**：语法检查

插件会自动激活，无需额外配置。

---

## ⚙️ 性能优化

编辑器采用了多项性能优化技术：

1. **视口裁剪**：只渲染可见区域，大文件性能提升 10-40 倍
2. **虚拟滚动**：缓冲区机制，避免滚动闪烁
3. **增量渲染**：只重绘变更的行，编辑时性能提升 3-5 倍
4. **离屏缓存**：静态内容（行号、背景）缓存到离屏 Canvas
5. **智能调度**：防抖优化 + 立即渲染混合策略

这些优化让编辑器可以流畅处理大型文档（10000+ 行）。

---

## 🛠️ 开发与构建

本仓库使用 Vite + Vue 3 进行开发和构建。

本地开发：

```bash
npm install
npm run dev
```

构建库：

```bash
npm run build:lib
```

类型检查：

```bash
npm run typecheck
```

---

## License

MIT
