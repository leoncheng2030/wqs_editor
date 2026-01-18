<template>
  <div class="editor-config">
    <div class="config-header">
      <h3>编辑器配置</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="config-body">
      <!-- 基础配置 -->
      <div class="config-section">
        <h4>基础设置</h4>
        
        <div class="config-item">
          <label>主题</label>
          <select :value="theme" @input="$emit('update:theme', $event.target.value)">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        
        <div class="config-item">
          <label>
            <input 
              type="checkbox" 
              :checked="enableSyntaxHighlight" 
              @change="$emit('update:enableSyntaxHighlight', $event.target.checked)"
            />
            语法高亮
          </label>
        </div>
        
        <div class="config-item">
          <label>字体大小</label>
          <input 
            type="number" 
            :value="fontSize" 
            @input="$emit('update:fontSize', Number($event.target.value))"
            min="10" 
            max="24"
          />
          <span class="unit">px</span>
        </div>
        
        <div class="config-item">
          <label>行高</label>
          <input 
            type="number" 
            :value="lineHeight" 
            @input="$emit('update:lineHeight', Number($event.target.value))"
            min="16" 
            max="40"
          />
          <span class="unit">px</span>
        </div>
      </div>
      
      <!-- 颜色自定义 -->
      <div class="config-section">
        <h4>颜色方案</h4>
        <p class="hint">点击颜色块可自定义颜色</p>
        
        <div class="color-grid">
          <div class="color-item" v-for="item in colorItems" :key="item.key">
            <label>{{ item.label }}</label>
            <input 
              type="color" 
              :value="item.value"
              @input="handleColorChange(item.key, $event.target.value)"
            />
            <span class="color-value">{{ item.value }}</span>
          </div>
        </div>
      </div>
      
      <div class="config-footer">
        <button @click="handleReset" class="btn btn-secondary">重置</button>
        <button @click="handleSave" class="btn btn-primary">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  theme: String,
  enableSyntaxHighlight: Boolean,
  fontSize: Number,
  lineHeight: Number,
  customColors: Object
})

const emit = defineEmits([
  'close',
  'update:theme',
  'update:enableSyntaxHighlight',
  'update:fontSize',
  'update:lineHeight',
  'update:customColors',
  'reset',
  'save'
])

// 颜色配置项
const colorItems = computed(() => {
  const colors = props.customColors || {}
  return [
    { key: 'heading1', label: '标题1', value: colors.heading1 || '#0066cc' },
    { key: 'heading2', label: '标题2', value: colors.heading2 || '#0077dd' },
    { key: 'bold_text', label: '粗体', value: colors.bold_text || '#000000' },
    { key: 'italic_text', label: '斜体', value: colors.italic_text || '#555555' },
    { key: 'code_text', label: '代码', value: colors.code_text || '#d14' },
    { key: 'link_text', label: '链接', value: colors.link_text || '#0066cc' },
    { key: 'list_marker', label: '列表标记', value: colors.list_marker || '#cc6600' },
    { key: 'quote_marker', label: '引用标记', value: colors.quote_marker || '#999999' }
  ]
})

const handleColorChange = (key, value) => {
  const newColors = { ...(props.customColors || {}), [key]: value }
  emit('update:customColors', newColors)
}

const handleReset = () => {
  emit('reset')
}

const handleSave = () => {
  emit('save')
  emit('close')
}
</script>

<style scoped>
.editor-config {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  max-height: 80vh;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1000;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: #f9f9f9;
}

.config-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e5e5;
  color: #333;
}

.config-body {
  padding: 20px;
  max-height: calc(80vh - 140px);
  overflow-y: auto;
}

.config-section {
  margin-bottom: 24px;
}

.config-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.hint {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #999;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.config-item label {
  min-width: 80px;
  font-size: 14px;
  color: #666;
}

.config-item select,
.config-item input[type="number"] {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  flex: 1;
}

.config-item input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.unit {
  font-size: 12px;
  color: #999;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  background: #fafafa;
}

.color-item label {
  flex: 1;
  font-size: 13px;
  color: #666;
}

.color-item input[type="color"] {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.color-value {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
  background: #f9f9f9;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #666;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-primary {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.btn-primary:hover {
  background: #357abd;
}
</style>
