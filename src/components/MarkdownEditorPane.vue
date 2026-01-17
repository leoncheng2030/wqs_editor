<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  lines: {
    type: Array,
    default: () => [],
  },
  showLineNumbers: {
    type: Boolean,
    default: true,
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'keydown', 'focus', 'blur', 'scroll'])

const textareaRef = ref(null)
const gutterRef = ref(null)

const handleInput = event => {
  emit('update:modelValue', event.target.value)
}

const handleScroll = event => {
  emit('scroll', event)
  if (gutterRef.value) {
    gutterRef.value.scrollTop = event.target.scrollTop
  }
}

const handleKeydown = event => {
  emit('keydown', event)
}

const handleFocus = event => {
  emit('focus', event)
}

const handleBlur = event => {
  emit('blur', event)
}

defineExpose({
  textareaRef,
})
</script>

<template>
  <div class="markdown-editor__editor-pane">
    <div class="markdown-editor__editor-shell">
      <div v-if="showLineNumbers" ref="gutterRef" class="markdown-editor__gutter">
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="markdown-editor__line-number"
        >
          {{ index + 1 }}
        </div>
      </div>
      <textarea
        ref="textareaRef"
        class="markdown-editor__textarea"
        spellcheck="false"
        :value="modelValue"
        :readonly="readOnly"
        :placeholder="placeholder"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
        @scroll="handleScroll"
      />
    </div>
  </div>
</template>

