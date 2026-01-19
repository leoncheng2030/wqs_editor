<template>
  <div v-if="visible" class="search-panel">
    <div class="search-row">
      <input
        ref="searchInputRef"
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="查找"
        @keydown.enter="findNext"
        @keydown.esc="close"
      />
      <span class="search-count" v-if="searchText">{{ currentIndex + 1 }}/{{ totalMatches }}</span>
      <button class="search-btn" @click="findPrevious" title="上一个 (Shift+Enter)">↑</button>
      <button class="search-btn" @click="findNext" title="下一个 (Enter)">↓</button>
      <button class="search-btn" @click="toggleReplace" title="切换替换">{{ showReplace ? '▼' : '▶' }}</button>
      <button class="search-btn close-btn" @click="close" title="关闭 (Esc)">✕</button>
    </div>
    
    <div v-if="showReplace" class="replace-row">
      <input
        v-model="replaceText"
        type="text"
        class="search-input"
        placeholder="替换"
        @keydown.enter="replaceNext"
        @keydown.esc="close"
      />
      <button class="action-btn" @click="replaceNext">替换</button>
      <button class="action-btn" @click="replaceAll">全部替换</button>
    </div>
    
    <div class="search-options">
      <label>
        <input type="checkbox" v-model="matchCase" @change="onOptionsChange" />
        <span>区分大小写</span>
      </label>
      <label>
        <input type="checkbox" v-model="matchWholeWord" @change="onOptionsChange" />
        <span>全字匹配</span>
      </label>
      <label>
        <input type="checkbox" v-model="useRegex" @change="onOptionsChange" />
        <span>正则表达式</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'close',
  'search',
  'replace',
  'replaceAll'
])

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchText = ref('')
const replaceText = ref('')
const showReplace = ref(false)
const matchCase = ref(false)
const matchWholeWord = ref(false)
const useRegex = ref(false)
const currentIndex = ref(0)
const totalMatches = ref(0)

// 监听显示状态，自动聚焦
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

// 监听搜索文本变化
watch(searchText, (newText) => {
  if (newText) {
    performSearch()
  } else {
    currentIndex.value = 0
    totalMatches.value = 0
    emit('search', { text: '', matches: [] })
  }
})

const performSearch = () => {
  emit('search', {
    text: searchText.value,
    matchCase: matchCase.value,
    matchWholeWord: matchWholeWord.value,
    useRegex: useRegex.value,
    callback: (matches: any[]) => {
      totalMatches.value = matches.length
      if (matches.length > 0) {
        currentIndex.value = 0
      }
    }
  })
}

const findNext = () => {
  if (totalMatches.value === 0) return
  currentIndex.value = (currentIndex.value + 1) % totalMatches.value
  emit('search', {
    text: searchText.value,
    matchCase: matchCase.value,
    matchWholeWord: matchWholeWord.value,
    useRegex: useRegex.value,
    jumpTo: currentIndex.value
  })
}

const findPrevious = () => {
  if (totalMatches.value === 0) return
  currentIndex.value = (currentIndex.value - 1 + totalMatches.value) % totalMatches.value
  emit('search', {
    text: searchText.value,
    matchCase: matchCase.value,
    matchWholeWord: matchWholeWord.value,
    useRegex: useRegex.value,
    jumpTo: currentIndex.value
  })
}

const replaceNext = () => {
  emit('replace', {
    searchText: searchText.value,
    replaceText: replaceText.value,
    matchCase: matchCase.value,
    matchWholeWord: matchWholeWord.value,
    useRegex: useRegex.value,
    callback: () => {
      performSearch()
    }
  })
}

const replaceAll = () => {
  emit('replaceAll', {
    searchText: searchText.value,
    replaceText: replaceText.value,
    matchCase: matchCase.value,
    matchWholeWord: matchWholeWord.value,
    useRegex: useRegex.value,
    callback: () => {
      performSearch()
    }
  })
}

const toggleReplace = () => {
  showReplace.value = !showReplace.value
}

const onOptionsChange = () => {
  if (searchText.value) {
    performSearch()
  }
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.search-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 16px;
  z-index: 1000;
  min-width: 420px;
}

.search-row,
.replace-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.search-count {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 45px;
  text-align: center;
  font-weight: 500;
}

.search-btn,
.action-btn {
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  color: #555;
}

.search-btn:hover,
.action-btn:hover {
  background: #f8f8f8;
  border-color: #4a90e2;
  color: #4a90e2;
}

.search-btn:active,
.action-btn:active {
  background: #e8e8e8;
}

.close-btn {
  font-weight: bold;
  color: #999;
}

.close-btn:hover {
  color: #ff4444;
  border-color: #ff4444;
  background: #fff5f5;
}

.action-btn {
  padding: 8px 16px;
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
  font-weight: 500;
}

.action-btn:hover {
  background: #357abd;
  border-color: #357abd;
  color: white;
}

.search-options {
  display: flex;
  gap: 20px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.search-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.search-options label:hover {
  color: #4a90e2;
}

.search-options input[type="checkbox"] {
  cursor: pointer;
  width: 14px;
  height: 14px;
}
</style>
