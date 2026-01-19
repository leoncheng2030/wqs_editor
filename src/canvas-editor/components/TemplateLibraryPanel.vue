<template>
  <div v-if="visible" class="template-library-panel" @click.self="handleClose">
    <div class="panel-content">
      <!-- 头部 -->
      <div class="panel-header">
        <h2>📚 Prompt模板库</h2>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>
      
      <!-- 工具栏 -->
      <div class="panel-toolbar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索模板..."
          class="search-input"
          @input="handleSearch"
        />
        
        <select 
          v-model="selectedCategory" 
          class="category-select"
          @change="handleFilter"
        >
          <option value="">全部分类</option>
          <option 
            v-for="category in categories" 
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>
        
        <select 
          v-model="sortBy" 
          class="sort-select"
          @change="handleSort"
        >
          <option value="updatedAt">最近更新</option>
          <option value="usage">使用频率</option>
          <option value="rating">评分</option>
          <option value="name">名称</option>
        </select>
      </div>
      
      <!-- 模板列表 -->
      <div class="template-list">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-item"
          @click="handleSelect(template)"
        >
          <div class="template-header">
            <h3>{{ template.name }}</h3>
            <div class="template-meta">
              <span class="category-tag">{{ template.category }}</span>
              <span class="usage-info">使用 {{ template.usage?.count || 0 }} 次</span>
              <span class="date-info">{{ formatDate(template.updatedAt || '') }}</span>
            </div>
          </div>
          
          <p class="template-description">{{ template.description }}</p>
          
          <div class="template-actions">
            <button @click.stop="handleUse(template)">▶️ 使用</button>
            <button @click.stop="handleExport(template)">📤 导出</button>
            <button @click.stop="handleDelete(template)">🗑️ 删除</button>
          </div>
        </div>
      </div>
      
      <!-- 底部操作 -->
      <div class="panel-footer">
        <button class="footer-btn" @click="handleCreate">
          ➕ 创建新模板
        </button>
        <button class="footer-btn" @click="handleImport">
          📥 导入模板
        </button>
        <div class="template-count">
          共 {{ templates?.length || 0 }} 个模板
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Template {
  id: string
  name: string
  description?: string
  category: string
  tags?: string[]
  usage?: {
    count?: number
    rating?: number
  }
  updatedAt?: string | Date
  [key: string]: any
}

const props = defineProps<{
  visible?: boolean
  templates?: Template[]
  categories?: string[]
}>()

const emit = defineEmits(['close', 'select', 'use', 'create', 'delete', 'export', 'import'])

// 搜索和过滤
const searchQuery = ref('')
const selectedCategory = ref('')
const sortBy = ref('updatedAt')

// 过滤后的模板
const filteredTemplates = computed(() => {
  let result = [...(props.templates || [])]

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((t: Template) =>
      t.name.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(query)))
    )
  }

  // 分类过滤
  if (selectedCategory.value) {
    result = result.filter((t: Template) => t.category === selectedCategory.value)
  }

  // 排序
  result.sort((a: Template, b: Template) => {
    if (sortBy.value === 'usage') {
      return (b.usage?.count || 0) - (a.usage?.count || 0)
    } else if (sortBy.value === 'rating') {
      return (b.usage?.rating || 0) - (a.usage?.rating || 0)
    } else {
      const aDate = new Date(a[sortBy.value] || 0)
      const bDate = new Date(b[sortBy.value] || 0)
      return bDate.getTime() - aDate.getTime()
    }
  })

  return result
})

// 事件处理
const handleClose = () => {
  emit('close')
}

const handleSelect = (template: Template) => {
  emit('select', template)
}

const handleUse = (template: Template) => {
  emit('use', template.id)
  emit('close')
}

const handleCreate = () => {
  emit('create')
  emit('close')
}

const handleDelete = async (template: Template) => {
  if (window.confirm(`确定要删除模板 "${template.name}" 吗？`)) {
    emit('delete', template.id)
  }
}

const handleExport = (template: Template) => {
  emit('export', template.id)
}

const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const data = JSON.parse((event.target?.result as string) || '{}')
          emit('import', data)
        } catch (error) {
          window.alert('导入失败：文件格式错误')
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

const handleSearch = () => {
  // 搜索已通过computed自动处理
}

const handleFilter = () => {
  // 过滤已通过computed自动处理
}

const handleSort = () => {
  // 排序已通过computed自动处理
}

// 格式化日期
const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '未知'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.template-library-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.panel-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
}

.panel-toolbar {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
}

.category-select,
.sort-select {
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.template-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.template-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.2);
  transform: translateY(-1px);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.template-header h3 {
  margin: 0;
  color: #333;
  flex: 1;
}

.template-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.category-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.usage-info,
.date-info {
  color: #666;
}

.template-description {
  margin: 8px 0;
  color: #666;
  line-height: 1.4;
}

.template-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.template-actions button {
  padding: 4px 8px;
  border: 1px solid #d0d0d0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.template-actions button:hover {
  background: #f0f0f0;
  border-color: #007acc;
}

.panel-footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-btn {
  padding: 8px 16px;
  border: 1px solid #007acc;
  background: #007acc;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.footer-btn:hover {
  background: #005a9e;
  border-color: #005a9e;
}

.template-count {
  margin-left: auto;
  color: #666;
  font-size: 14px;
}
</style>