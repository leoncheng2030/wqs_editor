<script setup>
import { Icon } from '@vicons/utils'
import { ChatboxOutline } from '@vicons/ionicons5'
</script>

<template>
  <blockquote>
    <div class="markdown-editor__quote-header">
      <Icon size="16" class="markdown-editor__quote-icon">
        <ChatboxOutline />
      </Icon>
      <span class="markdown-editor__quote-title">
        提示
      </span>
    </div>
    <div class="markdown-editor__quote-body">
      <slot />
    </div>
  </blockquote>
</template>
