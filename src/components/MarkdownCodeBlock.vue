<script setup>
import { computed } from 'vue'
import { highlightCode } from '../utils/markdown'

const props = defineProps({
  code: {
    type: String,
    default: '',
  },
  lang: {
    type: String,
    default: '',
  },
})

const result = computed(() => highlightCode(props.code, props.lang))

const lines = computed(() => result.value.lines)
const langLabel = computed(() => result.value.langLabel)
const langClass = computed(() => result.value.langClass)
const html = computed(() => result.value.html)

const handleCopy = async () => {
  const text = props.code || ''
  if (!text) return
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch (_) {}
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } catch (_) {}
  document.body.removeChild(textarea)
}
</script>

<template>
  <div class="markdown-editor__code-block">
    <div class="markdown-editor__code-header">
      <span class="markdown-editor__code-lang">
        {{ langLabel }}
      </span>
      <button
        type="button"
        class="markdown-editor__code-copy"
        @click="handleCopy"
      >
        复制
      </button>
    </div>
    <div class="markdown-editor__code-body">
      <div class="markdown-editor__code-gutter">
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="markdown-editor__code-line-number"
        >
          {{ index + 1 }}
        </div>
      </div>
      <pre class="markdown-editor__code-pre">
        <code
          class="hljs"
          :class="langClass"
          v-html="html"
        ></code>
      </pre>
    </div>
  </div>
</template>
