<script setup>
import { ref } from 'vue'

const previewRef = ref(null)

defineExpose({
  previewRef
})

const emit = defineEmits(['scroll'])
</script>

<template>
  <div ref="previewRef" class="markdown-editor__preview-pane" @scroll="emit('scroll', $event)">
    <slot />
  </div>
</template>

