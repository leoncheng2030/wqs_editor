<script setup>
import MarkdownEditor from './components/MarkdownEditor.vue'
</script>

<template>
  <div class="app-root">
    <MarkdownEditor toolbarStyle="icon" iconPreset="xicons" />
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100%;
}
</style>
