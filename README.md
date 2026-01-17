# @nywqs/vue-markdown-editor

一个基于 Vue 3 的 Markdown 编辑器组件，内置实时预览、工具栏快捷操作、主题切换、行号显示等特性，开箱即用，适合快速集成到后台管理、文档平台等场景。

> 本组件通过 `marked` 渲染 Markdown，并内置常用工具栏按钮和键盘快捷键。

---

## 安装

```bash
npm install @nywqs/vue-markdown-editor
# 或
yarn add @nywqs/vue-markdown-editor
# 或
pnpm add @nywqs/vue-markdown-editor
```

---

## 快速上手

### 全局注册组件

```ts
import { createApp } from 'vue'
import App from './App.vue'
import MarkdownEditor from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const app = createApp(App)

// 作为全局组件使用
app.component('MarkdownEditor', MarkdownEditor)

app.mount('#app')
```

### 基本用法

```vue
<template>
  <div style="height: 600px;">
    <MarkdownEditor v-model="content" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MarkdownEditor from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const content = ref('# Hello Markdown Editor')
</script>
```

---

## 组件属性（Props）

`MarkdownEditor` 主要支持以下 props：

| Prop              | 类型                         | 默认值       | 说明 |
|-------------------|------------------------------|--------------|------|
| `modelValue`      | `string`                     | `''`         | 当前 Markdown 文本内容，支持 `v-model` |
| `theme`           | `'dark' \| 'light'`          | `'dark'`     | 初始主题，支持深色 / 浅色 |
| `locale`          | `string`                     | `'zh-CN'`    | 语言，用于工具栏文案，目前内置 `zh-CN` / `en-US` |
| `toolbarStyle`    | `'text' \| 'icon' \| 'both'` | `'text'`     | 工具栏按钮展示样式：文字 / 图标 / 图标+文字 |
| `iconPreset`      | `'builtin' \| 'xicons'`      | `'xicons'`   | 图标来源：内置字符图标或 `@vicons/ionicons5` 图标 |
| `readOnly`        | `boolean`                    | `false`      | 只读模式，禁用编辑 |
| `showLineNumbers` | `boolean`                    | `true`       | 是否显示行号 |
| `showToolbar`     | `boolean`                    | `true`       | 是否显示顶部工具栏 |
| `showPreview`     | `boolean`                    | `true`       | 是否显示右侧预览区域（可拖拽分隔条调节宽度） |
| `showFooter`      | `boolean`                    | `true`       | 是否显示底部状态栏 |
| `autofocus`       | `boolean`                    | `false`      | 是否自动聚焦到编辑区 |
| `placeholder`     | `string`                     | `''`         | 编辑区占位文本 |
| `footerText`      | `string`                     | `''`         | 底部左侧自定义文本，不设置时显示默认版权文案 |
| `toolbarItems`    | `string[]`                   | 见下方默认值 | 工具栏按钮配置，可自定义顺序和显示项 |

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

## 事件（Emits）

组件会触发以下事件：

| 事件名              | 参数                         | 说明 |
|---------------------|------------------------------|------|
| `update:modelValue` | `(value: string)`            | `v-model` 双向绑定事件 |
| `update:theme`      | `(theme: 'dark' \| 'light')` | 通过工具栏切换主题时触发 |
| `change`            | `(value: string)`            | 内容变更时触发 |
| `save`              | `()`                         | 预留保存事件（如需要可在内部扩展） |
| `focus`             | `(event: FocusEvent)`        | 编辑区获得焦点 |
| `blur`              | `(event: FocusEvent)`        | 编辑区失去焦点 |

---

## 插槽（Slots）

### `toolbar` 自定义工具栏

你可以完全接管工具栏渲染，组件会提供一组操作方法和工具函数：

```vue
<MarkdownEditor v-model="content">
  <template #toolbar="scope">
    <!-- scope 中包含以下属性/方法：
         wrapSelection, toggleHeading, insertUnorderedList, insertOrderedList,
         insertBlockquote, insertCodeBlock, insertHorizontalRule,
         insertLink, insertImage, toggleTheme, handleToolbarClick,
         xiconComponents
    -->
    <button @click="scope.toggleHeading(1)">H1</button>
    <button @click="scope.toggleHeading(2)">H2</button>
    <button @click="scope.wrapSelection('**', '**')">Bold</button>
  </template>
</MarkdownEditor>
```

### `preview` 自定义预览区域

如果你想用自己的预览组件，可以使用 `preview` 插槽。组件会把解析后的 `tokens` 传入：

```vue
<MarkdownEditor v-model="content">
  <template #preview="{ tokens }">
    <!-- 自定义预览渲染 -->
    <pre>{{ tokens }}</pre>
  </template>
</MarkdownEditor>
```

---

## 在表单场景中使用

例如配合表单一起提交：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MarkdownEditor from '@nywqs/vue-markdown-editor'
import '@nywqs/vue-markdown-editor/dist-lib/wqs_editor.css'

const form = ref({
  title: '',
  content: '',
})

const handleSubmit = () => {
  console.log('提交内容：', form.value)
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.title" placeholder="标题" />

    <div style="height: 500px; margin-top: 16px;">
      <MarkdownEditor v-model="form.content" />
    </div>

    <button type="submit" style="margin-top: 16px;">提交</button>
  </form>
</template>
```

---

## 开发与构建

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
