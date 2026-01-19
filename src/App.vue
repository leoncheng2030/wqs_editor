<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import CanvasEditor from './canvas-editor/CanvasEditor.vue'
import MarkdownPreviewPanel from './canvas-editor/MarkdownPreviewPanel.vue'
import EditorConfig from './canvas-editor/EditorConfig.vue'

const showPreview = ref(false)
const theme = ref<'light' | 'dark'>('light')
const enableSyntaxHighlight = ref(true)
const showLineNumbers = ref(true)
const fontSize = ref(14)
const lineHeight = ref(24)
const customColors = ref({})
const showConfig = ref(false)
const showStats = ref(false)
const editorRef = ref<InstanceType<typeof CanvasEditor> | null>(null)
const perfStats = ref<any>(null)

// 滚动同步状态
const editorScrollPercentage = ref(0)
const previewScrollPercentage = ref(0)
const isSyncingEditor = ref(false)
const isSyncingPreview = ref(false)

// 配置键名
const CONFIG_KEY = 'canvas-editor-config'

// 编辑器滚动事件处理
const handleEditorScroll = (percentage: number) => {
  if (isSyncingPreview.value) return
  
  isSyncingEditor.value = true
  previewScrollPercentage.value = percentage
  
  setTimeout(() => {
    isSyncingEditor.value = false
  }, 100)
}

// 预览面板滚动事件处理
const handlePreviewScroll = (percentage: number) => {
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
  
  // 定期更新性能统计
  setInterval(() => {
    if (showStats.value && editorRef.value) {
      perfStats.value = editorRef.value.getPerformanceStats()
    }
  }, 1000)
})

// 切换统计面板
const toggleStats = () => {
  showStats.value = !showStats.value
  if (showStats.value && editorRef.value) {
    perfStats.value = editorRef.value.getPerformanceStats()
  }
}

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
        
        <button @click="toggleStats" class="stats-btn" :class="{ active: showStats }">
          性能统计
        </button>
      </div>
    </div>
    
    <div class="editor-container">
      <div class="canvas-container" :class="{ 'split-view': showPreview }">
        <div class="canvas-editor-wrapper">
          <CanvasEditor 
            ref="editorRef"
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
          
          <!-- 性能统计面板 -->
          <div v-if="showStats" class="stats-panel">
            <h4>性能统计</h4>
            <div v-if="perfStats" class="stats-content">
              <div class="stats-section">
                <h5>预加载统计</h5>
                <div class="stat-item">
                  <span>预加载次数：</span>
                  <strong>{{ perfStats.preload?.preloadCount || 0 }}</strong>
                </div>
                <div class="stat-item">
                  <span>命中率：</span>
                  <strong>{{ perfStats.preload?.hitRate || '0%' }}</strong>
                </div>
              </div>
              
              <div class="stats-section">
                <h5>智能预测</h5>
                <div class="stat-item">
                  <span>预测次数：</span>
                  <strong>{{ perfStats.prediction?.predictions || 0 }}</strong>
                </div>
                <div class="stat-item">
                  <span>准确率：</span>
                  <strong>{{ perfStats.prediction?.accuracy || '0%' }}</strong>
                </div>
                <div class="stat-item">
                  <span>下一动作：</span>
                  <strong>{{ perfStats.prediction?.currentPrediction?.likelyAction || '-' }}</strong>
                </div>
              </div>
              
              <div class="stats-section">
                <h5>渲染优化</h5>
                <div class="stat-item">
                  <span>脏区域：</span>
                  <strong>{{ perfStats.optimizer?.dirtyRegions || 0 }}</strong>
                </div>
                <div class="stat-item">
                  <span>离屏Canvas：</span>
                  <strong>{{ perfStats.optimizer?.hasOffscreenCanvas ? '✅' : '❌' }}</strong>
                </div>
              </div>
            </div>
          </div>
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
  line-height: 1.5;
}

.config-item span {
  color: #666;
  white-space: nowrap;
  line-height: 1.5;
}

.config-item select,
.config-item input[type="number"] {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  background: white;
  cursor: pointer;
  color: #333;
  min-height: 32px;
}

.config-item input[type="number"] {
  width: 65px;
  text-align: center;
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

.stats-btn {
  padding: 6px 12px;
  border: 1px solid #10b981;
  background: white;
  color: #10b981;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.stats-btn:hover,
.stats-btn.active {
  background: #10b981;
  color: white;
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
  position: relative;
}

.stats-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 250px;
  backdrop-filter: blur(10px);
}

.stats-panel h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
  border-bottom: 2px solid #10b981;
  padding-bottom: 8px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-section h5 {
  margin: 0;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #666;
}

.stat-item strong {
  color: #10b981;
  font-weight: 600;
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
