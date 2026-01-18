<script setup>
import { ref, watch, onMounted } from 'vue'
import CanvasEditor from './canvas-editor/CanvasEditor.vue'
import MarkdownPreviewPanel from './canvas-editor/MarkdownPreviewPanel.vue'
import EditorConfig from './canvas-editor/EditorConfig.vue'

const showPreview = ref(false)
const theme = ref('light')
const enableSyntaxHighlight = ref(true)
const showLineNumbers = ref(true)
const fontSize = ref(14)
const lineHeight = ref(24)
const customColors = ref({})
const showConfig = ref(false)

// 滚动同步状态
const editorScrollPercentage = ref(0)
const previewScrollPercentage = ref(0)
const isSyncingEditor = ref(false)
const isSyncingPreview = ref(false)

// 配置键名
const CONFIG_KEY = 'canvas-editor-config'

// 编辑器滚动事件处理
const handleEditorScroll = (percentage) => {
  if (isSyncingPreview.value) return
  
  isSyncingEditor.value = true
  previewScrollPercentage.value = percentage
  
  setTimeout(() => {
    isSyncingEditor.value = false
  }, 100)
}

// 预览面板滚动事件处理
const handlePreviewScroll = (percentage) => {
  if (isSyncingEditor.value) return
  
  isSyncingPreview.value = true
  editorScrollPercentage.value = percentage
  
  setTimeout(() => {
    isSyncingPreview.value = false
  }, 100)
}

// 加载配置
const loadConfig = () => {
  try {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) {
      const config = JSON.parse(saved)
      theme.value = config.theme || 'light'
      enableSyntaxHighlight.value = config.enableSyntaxHighlight !== false
      showLineNumbers.value = config.showLineNumbers !== false
      showPreview.value = config.showPreview !== false
      fontSize.value = config.fontSize || 14
      lineHeight.value = config.lineHeight || 24
      customColors.value = config.customColors || {}
    }
  } catch (error) {
    console.warn('加载配置失败:', error)
  }
}

// 保存配置
const saveConfig = () => {
  try {
    const config = {
      theme: theme.value,
      enableSyntaxHighlight: enableSyntaxHighlight.value,
      showLineNumbers: showLineNumbers.value,
      showPreview: showPreview.value,
      fontSize: fontSize.value,
      lineHeight: lineHeight.value,
      customColors: customColors.value
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch (error) {
    console.warn('保存配置失败:', error)
  }
}

// 监听配置变化
watch([theme, enableSyntaxHighlight, showLineNumbers, showPreview, fontSize, lineHeight, customColors], () => {
  saveConfig()
}, { deep: true })

// 监听字体大小变化，自动调整行高（保持1.73倍的比例）
watch(fontSize, (newSize) => {
  lineHeight.value = Math.round(newSize * 1.73)
})

// 组件挂载时加载配置
onMounted(() => {
  loadConfig()
})

// 重置配置
const resetConfig = () => {
  theme.value = 'light'
  enableSyntaxHighlight.value = true
  showLineNumbers.value = true
  showPreview.value = false
  fontSize.value = 14
  lineHeight.value = 24
  customColors.value = {}
  localStorage.removeItem(CONFIG_KEY)
}
const canvasText = ref(`# Canvas 编辑器测试
这是第一段文字。
## 小标题
这是**粗体**和*斜体*。
行内代码：\`const x = 1\`
最后一行。`)
</script>

<template>
  <div class="app-root">
    <div class="editor-header">
      <div class="config-section">
        <label class="config-item">
          <span>主题：</span>
          <select v-model="theme">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="enableSyntaxHighlight" />
          <span>语法高亮</span>
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="showLineNumbers" />
          <span>显示行号</span>
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="showPreview" />
          <span>实时预览</span>
        </label>
        
        <label class="config-item">
          <span>字体大小：</span>
          <input type="number" v-model.number="fontSize" min="10" max="24" />
        </label>
        
        <label class="config-item">
          <span>行高：</span>
          <input type="number" v-model.number="lineHeight" min="16" max="40" />
        </label>
        
        <button @click="resetConfig" class="reset-btn">
          重置
        </button>
        
        <button @click="showConfig = true" class="config-btn">
          高级配置
        </button>
      </div>
    </div>
    
    <div class="editor-container">
      <div class="canvas-container" :class="{ 'split-view': showPreview }">
        <div class="canvas-editor-wrapper">
          <CanvasEditor 
            v-model="canvasText"
            :theme="theme"
            :enableSyntaxHighlight="enableSyntaxHighlight"
            :showLineNumbers="showLineNumbers"
            :fontSize="fontSize"
            :lineHeight="lineHeight"
            :scrollPercentage="editorScrollPercentage"
            :isSyncing="isSyncingEditor"
            @scroll="handleEditorScroll"
          />
        </div>
        
        <div v-if="showPreview" class="preview-wrapper">
          <MarkdownPreviewPanel
            :modelValue="canvasText"
            :theme="theme"
            :scrollPercentage="previewScrollPercentage"
            :isSyncing="isSyncingPreview"
            @scroll="handlePreviewScroll"
          />
        </div>
      </div>
    </div>
    
    <!-- 配置弹窗 -->
    <div v-if="showConfig" class="config-overlay" @click="showConfig = false">
      <EditorConfig
        v-model:theme="theme"
        v-model:enableSyntaxHighlight="enableSyntaxHighlight"
        v-model:fontSize="fontSize"
        v-model:lineHeight="lineHeight"
        v-model:customColors="customColors"
        @close="showConfig = false"
        @reset="resetConfig"
        @save="saveConfig"
        @click.stop
      />
    </div>
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
}

.config-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.config-item span {
  color: #666;
}

.config-item select,
.config-item input[type="number"] {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.config-item input[type="number"] {
  width: 60px;
}

.config-item input[type="checkbox"] {
  cursor: pointer;
}

.reset-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.config-btn {
  padding: 6px 12px;
  border: 1px solid #4a90e2;
  background: #4a90e2;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.config-btn:hover {
  background: #357abd;
  border-color: #357abd;
}

.config-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}

.canvas-editor-wrapper {
  height: 100%;
  overflow: hidden;
}

.canvas-container.split-view .canvas-editor-wrapper {
  flex: 1;
  min-width: 0;
  border-right: 1px solid #ddd;
}

.canvas-container:not(.split-view) .canvas-editor-wrapper {
  width: 100%;
  flex: none;
}

.preview-wrapper {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
</style>
