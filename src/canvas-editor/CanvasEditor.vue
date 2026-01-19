<template>
  <div class="canvas-editor-container">
    <CanvasToolbar 
      v-if="showToolbar" 
      :plugin-buttons="pluginToolbarButtons"
      @command="handleToolbarCommand" 
      @plugin-command="handlePluginCommand"
    />
    <div class="canvas-editor" ref="containerRef">
      <canvas
        ref="canvasRef"
        @wheel="handleWheel"
        :width="canvasWidth"
        :height="canvasHeight"
      ></canvas>
      <SearchPanel
        :visible="showSearch"
        @close="showSearch = false"
        @search="handleSearch"
        @replace="handleReplace"
        @replaceAll="handleReplaceAll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Document } from './core/Document'
import { ViewportManager } from './managers/ViewportManager'
import { DOMTextRenderer } from './renderers/DOMTextRenderer'  // 改用DOM渲染器
import { InputManager } from './managers/InputManager'
import { Cursor } from './core/Cursor'
import { CursorRenderer } from './renderers/CursorRenderer'
import { Selection } from './core/Selection'
import { SelectionRenderer } from './renderers/SelectionRenderer'
import { History } from './core/History'
import { Clipboard } from './managers/ClipboardManager'
import { MarkdownLexer } from './syntax/MarkdownLexer'
import { SyntaxHighlighter } from './syntax/SyntaxHighlighter'
import { LineNumberRenderer } from './renderers/LineNumberRenderer'
import { RenderOptimizer } from './managers/RenderOptimizer'
import { PreloadManager } from './managers/PreloadManager'
import { PredictiveRenderer } from './managers/PredictiveRenderer'
import CanvasToolbar from './CanvasToolbar.vue'
import SearchPanel from './SearchPanel.vue'
import { 
  PluginManager,
  TablePlugin,
  TodoListPlugin,
  MathPlugin,
  MermaidPlugin,
  AutoCompletePlugin,
  SyntaxCheckerPlugin
} from './plugins'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  theme: {
    type: String as () => 'light' | 'dark',
    default: 'light',
    validator: (value: string) => ['light', 'dark'].includes(value)
  },
  enableSyntaxHighlight: {
    type: Boolean,
    default: true
  },
  fontSize: {
    type: Number,
    default: 15  // 从14增加到15，提升清晰度
  },
  lineHeight: {
    type: Number,
    default: 26  // 从24增加到26，保持比例
  },
  showLineNumbers: {
    type: Boolean,
    default: true
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  // 外部控制的滚动位置（百分比）
  scrollPercentage: {
    type: Number,
    default: 0
  },
  // 是否正在同步（避免循环）
  isSyncing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:scrollPercentage', 'scroll'])

// DOM 引用
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Canvas 尺寸
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const dpr = ref(window.devicePixelRatio || 1) // 设备像素比

// 核心对象
let document: Document | null = null
let viewport: ViewportManager | null = null
let textRenderer: DOMTextRenderer | null = null
let inputManager: InputManager | null = null
let cursor: Cursor | null = null
let cursorRenderer: CursorRenderer | null = null
let selection: Selection | null = null
let selectionRenderer: SelectionRenderer | null = null
let history: History | null = null
let clipboard: Clipboard | null = null
let ctx: CanvasRenderingContext2D | null = null
let lineNumberRenderer: LineNumberRenderer | null = null
let pluginManager: PluginManager | null = null
let renderOptimizer: RenderOptimizer | null = null // 渲染优化器
let preloadManager: PreloadManager | null = null // 预加载管理器
let predictiveRenderer: PredictiveRenderer | null = null // 智能预测渲染器

// 鼠标状态
let isMouseDown = false
let mouseDownPosition: { x: number; y: number; line: number; column: number } | null = null
let isDragging = false

// 插件工具栏按钮
const pluginToolbarButtons = ref<any[]>([])
let dragStartSelection: any = null

// 搜索状态
const showSearch = ref(false)
const searchMatches = ref<any[]>([])
const searchHighlightRenderer = ref<any>(null)

// 渲染循环
let animationFrameId: number | null = null

// 批量渲染请求标志（防止同一帧内多次立即渲染）
let pendingImmediateRender = false

/**
 * 检查核心对象是否已初始化
 */
const ensureInitialized = () => {
  if (!document || !viewport || !textRenderer || !cursor || !selection) {
    throw new Error('Editor not initialized')
  }
  return { document, viewport, textRenderer, cursor, selection, history: history!, clipboard: clipboard! }
}

/**
 * 请求立即渲染（自动合并同一帧内的多次请求）
 */
const requestImmediateRender = () => {
  if (pendingImmediateRender) return
  pendingImmediateRender = true
  
  // 使用queueMicrotask确保在所有同步代码执行后再渲染
  queueMicrotask(() => {
    pendingImmediateRender = false
    render(true)
  })
}

/**
 * 初始化编辑器
 */
const initEditor = () => {
  // 创建文档
  document = new Document(props.modelValue)
  
  // 创建视口管理器
  viewport = new ViewportManager({
    width: canvasWidth.value,
    height: canvasHeight.value,
    lineHeight: props.lineHeight,  // 使用 props 的行高保持一致
    padding: 16  // 先使用默认padding
  })
  
  // 创建行号渲染器（如果需要）
  if (props.showLineNumbers) {
    lineNumberRenderer = new LineNumberRenderer({
      fontSize: props.fontSize - 1
    })
    lineNumberRenderer.updateTheme(props.theme)
    
    // 调整 viewport padding 留出行号区域
    viewport.padding = lineNumberRenderer.width + 16
  }
  
  // 设置总行数（在padding确定后）
  viewport.setTotalLines(document.getLineCount())
  
  // 创建DOM文字渲染器（清晰）
  textRenderer = new DOMTextRenderer(containerRef.value!, {
    fontSize: props.fontSize,
    lineHeight: props.lineHeight,
    enableSyntaxHighlight: props.enableSyntaxHighlight
  })
    
  // 创建语法高亮器
  const lexer = new MarkdownLexer()
  const highlighter = new SyntaxHighlighter({ theme: props.theme })
  textRenderer.setSyntaxHighlight(lexer, highlighter)
  
  // 连接 Document 和 Lexer（用于增量解析）
  document.setLexer(lexer)
  
  // 创建光标
  cursor = new Cursor(0, 0)
  
  // 创建光标渲染器
  cursorRenderer = new CursorRenderer({
    color: '#000000',
    width: 2,
    blinkInterval: 530
  })
  
  // 创建选区
  selection = new Selection()
  
  // 创建选区渲染器
  selectionRenderer = new SelectionRenderer({
    color: 'rgba(100, 150, 255, 0.3)'
  })
  
  // 创建历史记录管理器
  history = new History({
    maxSize: 100,
    mergeDelay: 300
  })
  
  // 创建剪贴板管理器
  clipboard = new Clipboard()
  
  // 创建渲染优化器
  renderOptimizer = new RenderOptimizer({
    debounceDelay: 16 // 60fps
  })
  
  // 创建预加载管理器
  preloadManager = new PreloadManager({
    preloadLines: 10,
    preloadThreshold: 0.3,
    onPreload: async ({ startLine, endLine, direction }: any) => {
      // 预加载回调：提前解析这些行的语法
      if (!document || !textRenderer) return
      for (let i = startLine; i < endLine && i < document.getLineCount(); i++) {
        const line = document.getLine(i)
        if ((textRenderer as any).lexer) {
          (textRenderer as any).lexer.parseLine(line, i)
        }
      }
    }
  })
  
  // 创建智能预测渲染器
  predictiveRenderer = new PredictiveRenderer({
    enablePrediction: true,
    learningRate: 0.1,
    onPredict: (predictions: any) => {
      // 根据预测调整策略
      if (!preloadManager) return
      if (predictions.nextScrollSpeed === 'fast') {
        // 快速滚动时，增加预加载范围
        (preloadManager as any).preloadLines = 20
      } else {
        (preloadManager as any).preloadLines = 10
      }
    }
  })
  
  // 获取 Canvas 上下文
  const canvas = canvasRef.value!
  
  // 获取容器尺寸
  const rect = canvas.getBoundingClientRect()
  
  // 更新 canvasWidth 和 canvasHeight 为 CSS 像素
  canvasWidth.value = rect.width
  canvasHeight.value = rect.height
  
  // 注意：Canvas 的实际尺寸会在 resizeCanvas() 中统一设置
  // 这里先获取上下文即可
  ctx = canvas.getContext('2d')
  
  // 注意：不要在这里设置 scale，会在 resizeCanvas() 中统一处理
  
  // 创建输入管理器
  inputManager = new InputManager(containerRef.value!, {
    canvas: canvas
  })
  
  // 监听输入事件
  inputManager.on('input', handleInput)
  inputManager.on('keydown', handleKeyDown)
  inputManager.on('click', handleClick)
  inputManager.on('dblclick', handleDblClick)
  inputManager.on('tripleclick', handleTripleClick)
  inputManager.on('mousedown', handleMouseDown)
  inputManager.on('mousemove', handleMouseMove)
  inputManager.on('mouseup', handleMouseUp)
  
  // 监听文档变化
  document.on('change', handleDocumentChange)
  
  // 初始化插件系统
  initPluginSystem()
  
  // 初始化离屏Canvas（用于缓存静态内容）
  renderOptimizer.initOffscreenCanvas(canvasWidth.value * dpr.value, canvasHeight.value * dpr.value)
  
  // 开始渲染
  render()
  
  // 启动光标闪烁
  cursorRenderer.startBlinking(render)
}

/**
 * 初始化插件系统
 */
const initPluginSystem = async () => {
  // 创建插件管理器
  pluginManager = new PluginManager({
    document,
    viewport,
    textRenderer,
    cursor,
    selection,
    history,
    clipboard,
    render
  })
  
  // 注册内置插件
  pluginManager.register(TablePlugin)
  pluginManager.register(TodoListPlugin)
  pluginManager.register(MathPlugin)
  pluginManager.register(MermaidPlugin)
  pluginManager.register(AutoCompletePlugin)
  pluginManager.register(SyntaxCheckerPlugin)
  
  // 激活插件
  try {
    await pluginManager.activate('markdown-table')
    await pluginManager.activate('todo-list')
    await pluginManager.activate('math')
    await pluginManager.activate('mermaid')
    await pluginManager.activate('autocomplete')
    await pluginManager.activate('syntax-checker')
    
    // 更新插件工具栏按钮
    pluginToolbarButtons.value = pluginManager.getToolbarButtons()
  } catch (error) {
    console.error('Failed to activate plugins:', error)
  }
}

/**
 * 监听主题变化
 */
watch(() => props.theme, (newTheme) => {
  if (textRenderer && (textRenderer as any).highlighter) {
    (textRenderer as any).highlighter.setTheme(newTheme)
    textRenderer.updateThemeColors()
  }
  if (lineNumberRenderer) {
    lineNumberRenderer.updateTheme(newTheme)
  }
  // 主题变化需要重绘静态层
  if (renderOptimizer) {
    renderOptimizer.markStaticLayerDirty()
  }
  requestImmediateRender()
})

/**
 * 监听语法高亮开关
 */
watch(() => props.enableSyntaxHighlight, (enabled) => {
  if (textRenderer) {
    textRenderer.enableSyntaxHighlight = enabled
    // 强制重新渲染DOM文字层
    if (textRenderer.markDirty) {
      textRenderer.markDirty()
    }
    requestImmediateRender()
  }
})

/**
 * 监听字体大小变化
 */
watch(() => props.fontSize, (newSize, oldSize) => {
  if (textRenderer) {
    textRenderer.fontSize = newSize
    // 清除测量缓存（字体大小变化）
    if (textRenderer.clearMeasureCache) {
      textRenderer.clearMeasureCache()
    }
    // 强制重新渲染DOM文字层
    if (textRenderer.markDirty) {
      textRenderer.markDirty()
    }
  }
  
  // 更新行号渲染器的字体大小
  if (lineNumberRenderer) {
    (lineNumberRenderer as any).fontSize = newSize - 1
  }
  
  // 注意：不在这里渲染，等待lineHeight的watch一起处理
  // 因为App.vue会在fontSize变化时自动更新lineHeight（1.73倍比例）
  // 避免使用不一致的fontSize和lineHeight进行渲染
})

/**
 * 监听行高变化
 */
watch(() => props.lineHeight, (newHeight) => {
  if (textRenderer) {
    textRenderer.lineHeight = newHeight
    // 强制重新渲染DOM文字层
    if (textRenderer.markDirty) {
      textRenderer.markDirty()
    }
  }
  if (viewport && document) {
    viewport.lineHeight = newHeight
    viewport.setTotalLines(document.getLineCount())  // 重新计算总高度
  }
  
  // 行高变化会影响行号的位置，需要重绘静态层
  if (renderOptimizer) {
    renderOptimizer.markStaticLayerDirty()
  }
  
  // 使用批量渲染，确保fontSize和lineHeight同步更新后的效果
  requestImmediateRender()
})

/**
 * 监听行号显示开关
 */
watch(() => props.showLineNumbers, (show) => {
  if (!viewport) return
  
  if (show) {
    // 显示行号：创建或更新行号渲染器
    if (!lineNumberRenderer) {
      lineNumberRenderer = new LineNumberRenderer({
        fontSize: props.fontSize - 1
      })
      lineNumberRenderer.updateTheme(props.theme)
    }
    // 调整 viewport padding 留出行号区域
    viewport.padding = lineNumberRenderer.width + 16
  } else {
    // 隐藏行号：恢复默认 padding
    viewport.padding = 16
  }
  
  // 重新计算总高度（因为 padding 变化了）
  if (viewport && document) {
    viewport.setTotalLines(document.getLineCount())
  }
  
  // 需要重绘静态层
  if (renderOptimizer) {
    renderOptimizer.markStaticLayerDirty()
  }
  
  requestImmediateRender()
})

/**
 * 监听外部滚动位置变化
 */
watch(() => props.scrollPercentage, (newPercentage) => {
  if (props.isSyncing || !viewport) return
  
  const maxScroll = Math.max(0, viewport.totalHeight - viewport.height)
  const targetScroll = maxScroll * newPercentage
  
  viewport.setScrollTop(targetScroll)
  render()
})

/**
 * 文档变化处理
 */
const handleDocumentChange = (changeInfo?: any) => {
  if (!viewport || !document || !renderOptimizer) return
  viewport.setTotalLines(document.getLineCount())
  
  // 标记文字层需要重新渲染
  if (textRenderer && (textRenderer as any).markDirty) {
    (textRenderer as any).markDirty()
  }
  
  // 如果有变更信息，添加脏区域（增量渲染）
  if (changeInfo && changeInfo.startLine !== undefined && changeInfo.endLine !== undefined) {
    renderOptimizer.addDirtyRegion(changeInfo.startLine, changeInfo.endLine)
  } else {
    // 没有详细信息，标记完整重绘
    renderOptimizer.markFullRender()
  }
  
  // 触发插件的 afterChange 钩子
  if (pluginManager) {
    pluginManager.triggerHook('afterChange')
  }
  
  emit('update:modelValue', document.getText())
  render()
}

/**
 * 渲染（带防抖优化）
 */
const render = (immediate = false) => {
  if (!ctx || !document || !viewport || !textRenderer || !renderOptimizer) return
  
  // 通过渲染优化器请求渲染
  renderOptimizer.requestRender((renderContext) => {
    performRender(renderContext)
  }, immediate)
}

/**
 * 执行实际渲染
 */
const performRender = (renderContext: any) => {
  if (!ctx || !viewport || !textRenderer || !document) return
  
  const { fullRender, staticLayerDirty, offscreenCtx, offscreenCanvas } = renderContext
  
  // 获取可见范围（带缓冲区）
  const { startLine, endLine } = viewport.getVisibleRange(2)
  
  // 如果需要重绘静态层（行号、背景）
  if (staticLayerDirty && offscreenCtx && offscreenCanvas) {
    renderStaticLayer(offscreenCtx, startLine, endLine)
  }
  
  // 1. 清空Canvas
  ctx.clearRect(0, 0, viewport.width, viewport.height)
  
  // 2. 如果有缓存，使用缓存的静态层
  if (offscreenCanvas && !staticLayerDirty) {
    ctx.drawImage(offscreenCanvas, 0, 0)
  } else {
    // 渲染背景色
    ctx.fillStyle = textRenderer.backgroundColor
    ctx.fillRect(0, 0, viewport.width, viewport.height)
    
    // 渲染行号
    if (lineNumberRenderer && props.showLineNumbers && cursor && document) {
      lineNumberRenderer.render(
        ctx,
        viewport,
        document.getLineCount(),
        cursor.line,
        textRenderer.lineHeight
      )
    }
  }
  
  // 3. 渲染选区（Canvas）
  if (selection && selectionRenderer && cursor && document) {
    selectionRenderer.render(ctx, selection, viewport as any, document, textRenderer as any, textRenderer.lineHeight)
  }
  
  // 4. 渲染文本内容（DOM！）
  textRenderer.renderContent(document, viewport)
  
  // 5. 渲染光标（Canvas）
  if (cursor && cursorRenderer && selection && !selection.hasSelection) {
    const lineText = document.getLine(cursor.line)
    cursorRenderer.render(ctx, cursor, viewport as any, textRenderer as any, lineText, textRenderer.lineHeight)
  }
  
  // 6. 更新 textarea 位置，让 IME 候选框跟随光标
  if (cursor && inputManager) {
    const lineText = document.getLine(cursor.line)
    const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer as any, lineText)
    inputManager.updateTextareaPosition(x, y + textRenderer.lineHeight)
  }
}

/**
 * 渲染静态层（行号、背景）到离屏Canvas
 */
const renderStaticLayer = (offCtx: CanvasRenderingContext2D, startLine: number, endLine: number) => {
  if (!offCtx || !viewport || !textRenderer || !document) return
  
  // 清空离屏Canvas
  offCtx.clearRect(0, 0, viewport.width, viewport.height)
  
  // 渲染背景色
  offCtx.fillStyle = textRenderer.backgroundColor
  offCtx.fillRect(0, 0, viewport.width, viewport.height)
  
  // 渲染行号
  if (lineNumberRenderer && props.showLineNumbers && cursor) {
    lineNumberRenderer.render(
      offCtx,
      viewport,
      document.getLineCount(),
      cursor.line,
      textRenderer.lineHeight
    )
  }
}

/**
 * 获取性能统计
 */
const getPerformanceStats = () => {
  const stats: any = {
    optimizer: null,
    preload: null,
    prediction: null
  }
  
  if (renderOptimizer) {
    stats.optimizer = {
      dirtyRegions: (renderOptimizer as any).dirtyRegions?.length || 0,
      fullRenderNeeded: (renderOptimizer as any).fullRenderNeeded || false,
      hasOffscreenCanvas: !!(renderOptimizer as any).offscreenCanvas
    }
  }
  
  if (preloadManager) {
    stats.preload = preloadManager.getStats()
  }
  
  if (predictiveRenderer) {
    stats.prediction = predictiveRenderer.getStats()
  }
  
  return stats
}

/**
 * 处理输入
 */
const handleInput = (data: any) => {
  if (!data.data || !cursor || !document || !selection || !history || !cursorRenderer) return
  
  // 过滤换行符，因为Enter键已经在handleKeyDown中处理了
  if (data.data === '\n') {
    return
  }
  
  // 记录编辑行为（智能预测）
  if (predictiveRenderer) {
    predictiveRenderer.recordBehavior('edit', {
      type: 'insert',
      length: data.data.length
    })
  }
  
  const cursorBefore = { line: cursor.line, column: cursor.column }
  
  // 如果有选区，先删除选中的文本
  if (selection.hasSelection) {
    const selectedText = selection.getSelectedText(document)
    const { startLine, startColumn } = selection.getOrderedRange()
    
    // 记录删除操作
    history.record({
      type: 'delete',
      line: startLine,
      column: startColumn,
      text: selectedText,
      cursorBefore: cursorBefore,
      cursorAfter: { line: startLine, column: startColumn }
    })
    
    const pos = selection.deleteSelectedText(document)
    cursor.setPosition(pos.line, pos.column)
  }
  
  // 记录插入操作
  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: data.data,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line, column: cursor.column + data.data.length }
  })
  
  // 在光标位置插入文本
  document.insertText(cursor.line, cursor.column, data.data)
  
  // 移动光标
  cursor.column += data.data.length
  
  // 重置光标闪烁（立即渲染，响应更快）
  cursorRenderer.resetBlink(() => render(true))
}

/**
 * 处理按键
 */
const handleKeyDown = (data: any) => {
  const { key, ctrlKey, shiftKey, metaKey } = data
  
  if (!cursor || !document || !selection || !history || !cursorRenderer || !clipboard) return
  
  // 阻止Tab键的默认行为（切换焦点）
  if (key === 'Tab') {
    data.preventDefault()
  }
  
  // 尝试用插件系统处理快捷键
  if (pluginManager && pluginManager.handleKeybinding(data)) {
    render(true) // 快捷键立即渲染
    return
  }
  
  // Ctrl+A 全选
  if ((ctrlKey || metaKey) && key === 'a') {
    selection.selectAll(document)
    render(true) // 全选立即渲染
    return
  }
  
  // Ctrl+F 搜索
  if ((ctrlKey || metaKey) && key === 'f') {
    showSearch.value = true
    return
  }
  
  // Ctrl+H 替换
  if ((ctrlKey || metaKey) && key === 'h') {
    showSearch.value = true
    // SearchPanel会自动展开替换区域
    return
  }
  
  // Ctrl+C 复制
  if ((ctrlKey || metaKey) && key === 'c') {
    if (selection.hasSelection) {
      const text = selection.getSelectedText(document)
      clipboard.copy(text)
    }
    return
  }
  
  // Ctrl+X 剪切
  if ((ctrlKey || metaKey) && key === 'x') {
    if (selection.hasSelection) {
      const text = selection.getSelectedText(document)
      clipboard.cut(text)
      
      const { startLine, startColumn } = selection.getOrderedRange()
      
      // 记录删除操作
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: text,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })
      
      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
      cursorRenderer.resetBlink(() => render(true))
    }
    return
  }
  
  // Ctrl+V 粘贴
  if ((ctrlKey || metaKey) && key === 'v') {
    // 阻止默认的粘贴行为，避免重复粘贴
    if (data.preventDefault) {
      data.preventDefault()
    }
    
    clipboard.paste().then(text => {
      if (!text || !cursor || !document || !history || !selection || !cursorRenderer) return
      
      const cursorBefore = { line: cursor.line, column: cursor.column }
      
      // 如果有选区，先删除
      if (selection.hasSelection) {
        const selectedText = selection.getSelectedText(document)
        const { startLine, startColumn } = selection.getOrderedRange()
        
        history.record({
          type: 'delete',
          line: startLine,
          column: startColumn,
          text: selectedText,
          cursorBefore: cursorBefore,
          cursorAfter: { line: startLine, column: startColumn }
        })
        
        const pos = selection.deleteSelectedText(document)
        cursor.setPosition(pos.line, pos.column)
      }
      
      // 记录插入操作
      history.record({
        type: 'insert',
        line: cursor.line,
        column: cursor.column,
        text: text,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: cursor.line, column: cursor.column + text.length }
      })
      
      // 插入文本
      document.insertText(cursor.line, cursor.column, text)
      
      // 移动光标
      const lines = text.split('\n')
      if (lines.length === 1) {
        cursor.column += text.length
      } else {
        cursor.line += lines.length - 1
        cursor.column = lines[lines.length - 1].length
      }
      
      cursorRenderer.resetBlink(() => render(true))
    })
    return
  }
  
  // Ctrl+Z 撤销
  if ((ctrlKey || metaKey) && key === 'z' && !shiftKey) {
    const operation = history.undo()
    if (operation) {
      applyHistoryOperation(operation, true)
    }
    return
  }
  
  // Ctrl+Y 或 Ctrl+Shift+Z 重做
  if ((ctrlKey || metaKey) && (key === 'y' || (key === 'z' && shiftKey))) {
    const operation = history.redo()
    if (operation) {
      applyHistoryOperation(operation, false)
    }
    return
  }
  
  // Ctrl+D 删除当前行
  if ((ctrlKey || metaKey) && key === 'd') {
    const lineText = document.getLine(cursor.line)
    const cursorBefore = { line: cursor.line, column: cursor.column }
    
    // 记录删除操作
    if (cursor.line < document.getLineCount() - 1) {
      // 不是最后一行，删除包括换行符
      history.record({
        type: 'delete',
        line: cursor.line,
        column: 0,
        text: lineText + '\n',
        cursorBefore: cursorBefore,
        cursorAfter: { line: cursor.line, column: 0 }
      })
      
      document.deleteText(cursor.line, 0, cursor.line + 1, 0)
    } else if (cursor.line > 0) {
      // 最后一行，删除前面的换行符和行内容
      history.record({
        type: 'delete',
        line: cursor.line - 1,
        column: document.getLine(cursor.line - 1).length,
        text: '\n' + lineText,
        cursorBefore: cursorBefore,
        cursorAfter: { line: cursor.line - 1, column: document.getLine(cursor.line - 1).length }
      })
      
      const prevLineLength = document.getLine(cursor.line - 1).length
      document.deleteText(cursor.line - 1, prevLineLength, cursor.line, lineText.length)
      cursor.line--
      cursor.column = Math.min(cursor.column, prevLineLength)
    } else {
      // 只有一行，清空内容
      history.record({
        type: 'delete',
        line: 0,
        column: 0,
        text: lineText,
        cursorBefore: cursorBefore,
        cursorAfter: { line: 0, column: 0 }
      })
      
      document.deleteText(0, 0, 0, lineText.length)
      cursor.column = 0
    }
    
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // Tab 缩进 / Shift+Tab 取消缩进
  if (key === 'Tab') {
    const cursorBefore = { line: cursor.line, column: cursor.column }
    
    if (shiftKey) {
      // Shift+Tab: 取消缩进（删除行首的空格/Tab）
      const lineText = document.getLine(cursor.line)
      
      // 检查行首是否有空格或Tab
      if (lineText.startsWith('  ')) {
        // 删除2个空格
        history.record({
          type: 'delete',
          line: cursor.line,
          column: 0,
          text: '  ',
          cursorBefore: cursorBefore,
          cursorAfter: { line: cursor.line, column: Math.max(0, cursor.column - 2) }
        })
        
        document.deleteText(cursor.line, 0, cursor.line, 2)
        cursor.column = Math.max(0, cursor.column - 2)
      } else if (lineText.startsWith('\t')) {
        // 删除1个Tab
        history.record({
          type: 'delete',
          line: cursor.line,
          column: 0,
          text: '\t',
          cursorBefore: cursorBefore,
          cursorAfter: { line: cursor.line, column: Math.max(0, cursor.column - 1) }
        })
        
        document.deleteText(cursor.line, 0, cursor.line, 1)
        cursor.column = Math.max(0, cursor.column - 1)
      }
    } else {
      // Tab: 增加缩进（插入2个空格）
      const indent = '  '  // 使用2个空格作为缩进
      
      history.record({
        type: 'insert',
        line: cursor.line,
        column: cursor.column,
        text: indent,
        cursorBefore: cursorBefore,
        cursorAfter: { line: cursor.line, column: cursor.column + indent.length }
      })
      
      document.insertText(cursor.line, cursor.column, indent)
      cursor.column += indent.length
    }
    
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // 方向键移动
  if (key === 'ArrowLeft') {
    if (shiftKey) {
      // Shift + 左：扩展选区
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveLeft(document)
      selection.extend(cursor.line, cursor.column)
    } else {
      // 只按左键：清除选区并移动
      if (selection.hasSelection) {
        const { startLine, startColumn } = selection.getOrderedRange()
        cursor.setPosition(startLine, startColumn)
        selection.clear()
      } else {
        cursor.moveLeft(document)
      }
    }
    cursorRenderer.resetBlink(() => render(true)) // 立即渲染
    return
  }
  
  if (key === 'ArrowRight') {
    if (shiftKey) {
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveRight(document)
      selection.extend(cursor.line, cursor.column)
    } else {
      if (selection.hasSelection) {
        const { endLine, endColumn } = selection.getOrderedRange()
        cursor.setPosition(endLine, endColumn)
        selection.clear()
      } else {
        cursor.moveRight(document)
      }
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  if (key === 'ArrowUp') {
    if (shiftKey) {
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveUp(document)
      selection.extend(cursor.line, cursor.column)
    } else {
      selection.clear()
      cursor.moveUp(document)
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  if (key === 'ArrowDown') {
    if (shiftKey) {
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveDown(document)
      selection.extend(cursor.line, cursor.column)
    } else {
      selection.clear()
      cursor.moveDown(document)
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // Home/End 键
  if (key === 'Home') {
    if (shiftKey) {
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveToLineStart()
      selection.extend(cursor.line, cursor.column)
    } else {
      selection.clear()
      cursor.moveToLineStart()
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  if (key === 'End') {
    if (shiftKey) {
      if (!selection.hasSelection) {
        selection.setRange(cursor.line, cursor.column, cursor.line, cursor.column)
      }
      cursor.moveToLineEnd(document)
      selection.extend(cursor.line, cursor.column)
    } else {
      selection.clear()
      cursor.moveToLineEnd(document)
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // Backspace 删除
  if (key === 'Backspace') {
    if (selection.hasSelection) {
      const selectedText = selection.getSelectedText(document)
      const { startLine, startColumn } = selection.getOrderedRange()
      
      // 记录删除操作
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: selectedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })
      
      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
    } else if (cursor.column > 0) {
      const deletedText = document.getLine(cursor.line).charAt(cursor.column - 1)
      
      history.record({
        type: 'delete',
        line: cursor.line,
        column: cursor.column - 1,
        text: deletedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: cursor.line, column: cursor.column - 1 }
      })
      
      document.deleteText(cursor.line, cursor.column - 1, cursor.line, cursor.column)
      cursor.column--
    } else if (cursor.line > 0) {
      const prevLineLength = document.getLine(cursor.line - 1).length
      
      history.record({
        type: 'delete',
        line: cursor.line - 1,
        column: prevLineLength,
        text: '\n',
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: cursor.line - 1, column: prevLineLength }
      })
      
      document.deleteText(cursor.line - 1, prevLineLength, cursor.line, 0)
      cursor.line--
      cursor.column = prevLineLength
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // Delete 删除
  if (key === 'Delete') {
    if (selection.hasSelection) {
      const selectedText = selection.getSelectedText(document)
      const { startLine, startColumn } = selection.getOrderedRange()
      
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: selectedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })
      
      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
    } else {
      const lineText = document.getLine(cursor.line)
      if (cursor.column < lineText.length) {
        const deletedText = lineText.charAt(cursor.column)
        
        history.record({
          type: 'delete',
          line: cursor.line,
          column: cursor.column,
          text: deletedText,
          cursorBefore: { line: cursor.line, column: cursor.column },
          cursorAfter: { line: cursor.line, column: cursor.column }
        })
        
        document.deleteText(cursor.line, cursor.column, cursor.line, cursor.column + 1)
      } else if (cursor.line < document.getLineCount() - 1) {
        history.record({
          type: 'delete',
          line: cursor.line,
          column: cursor.column,
          text: '\n',
          cursorBefore: { line: cursor.line, column: cursor.column },
          cursorAfter: { line: cursor.line, column: cursor.column }
        })
        
        document.deleteText(cursor.line, cursor.column, cursor.line + 1, 0)
      }
    }
    cursorRenderer.resetBlink(() => render(true))
    return
  }
  
  // Enter 换行
  if (key === 'Enter') {
    if (selection.hasSelection) {
      const selectedText = selection.getSelectedText(document)
      const { startLine, startColumn } = selection.getOrderedRange()
      
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: selectedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })
      
      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
    }
    
    // 获取当前行文字
    const currentLineText = document.getLine(cursor.line)
    let newLinePrefix = ''
    
    // 检查是否为无序列表
    const unorderedListMatch = currentLineText.match(/^(\s*)([-*+])\s+(.*)$/)
    if (unorderedListMatch) {
      const indent = unorderedListMatch[1]
      const marker = unorderedListMatch[2]
      const content = unorderedListMatch[3]
      
      // 如果列表项为空，取消列表格式
      if (content.trim() === '') {
        // 删除当前行的列表标记
        history.record({
          type: 'delete',
          line: cursor.line,
          column: 0,
          text: currentLineText,
          cursorBefore: { line: cursor.line, column: cursor.column },
          cursorAfter: { line: cursor.line, column: 0 }
        })
        document.deleteText(cursor.line, 0, cursor.line, currentLineText.length)
        cursor.column = 0
        cursorRenderer.resetBlink(() => render(true))
        return
      }
      
      // 继续列表
      newLinePrefix = `${indent}${marker} `
    }
    
    // 检查是否为有序列表
    const orderedListMatch = currentLineText.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (orderedListMatch) {
      const indent = orderedListMatch[1]
      const number = parseInt(orderedListMatch[2])
      const content = orderedListMatch[3]
      
      // 如果列表项为空，取消列表格式
      if (content.trim() === '') {
        // 删除当前行的列表标记
        history.record({
          type: 'delete',
          line: cursor.line,
          column: 0,
          text: currentLineText,
          cursorBefore: { line: cursor.line, column: cursor.column },
          cursorAfter: { line: cursor.line, column: 0 }
        })
        document.deleteText(cursor.line, 0, cursor.line, currentLineText.length)
        cursor.column = 0
        cursorRenderer.resetBlink(() => render(true))
        return
      }
      
      // 继续列表，编号自动+1
      newLinePrefix = `${indent}${number + 1}. `
    }
    
    // 检查是否为任务列表
    const taskListMatch = currentLineText.match(/^(\s*)([-*+])\s+\[([xX ])\]\s+(.*)$/)
    if (taskListMatch) {
      const indent = taskListMatch[1]
      const marker = taskListMatch[2]
      const content = taskListMatch[4]
      
      // 如果任务项为空，取消列表格式
      if (content.trim() === '') {
        // 删除当前行的任务列表标记
        history.record({
          type: 'delete',
          line: cursor.line,
          column: 0,
          text: currentLineText,
          cursorBefore: { line: cursor.line, column: cursor.column },
          cursorAfter: { line: cursor.line, column: 0 }
        })
        document.deleteText(cursor.line, 0, cursor.line, currentLineText.length)
        cursor.column = 0
        cursorRenderer.resetBlink(() => render(true))
        return
      }
      
      // 继续任务列表，默认未选中
      newLinePrefix = `${indent}${marker} [ ] `
    }
    
    // 插入换行和前缀
    const textToInsert = '\n' + newLinePrefix
    
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: textToInsert,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line + 1, column: newLinePrefix.length }
    })
    
    document.insertText(cursor.line, cursor.column, textToInsert)
    cursor.line++
    cursor.column = newLinePrefix.length
    cursorRenderer.resetBlink(() => render(true))
    return
  }
}

/**
 * 查找单词边界
 * @param {string} text - 文本
 * @param {number} offset - 光标位置
 * @returns {{start: number, end: number}} 单词边界
 */
const findWordBoundary = (text: string, offset: number) => {
  // 单词字符正则（字母、数字、下划线、中文）
  const wordChar = /[\w\u4e00-\u9fa5]/
  
  let start = offset
  let end = offset
  
  // 向左查找单词起点
  while (start > 0 && wordChar.test(text[start - 1])) {
    start--
  }
  
  // 向右查找单词终点
  while (end < text.length && wordChar.test(text[end])) {
    end++
  }
  
  return { start, end }
}

/**
 * 处理双击（选词）
 */
const handleDblClick = (data: any) => {
  if (!cursor || !viewport || !textRenderer || !document || !selection) return
  
  // 直接使用原始 x 坐标
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  const lineText = document.getLine(targetLine)
  
  // 再用精确版获取列号
  const { column } = viewport.canvasToDoc(data.x, data.y, textRenderer, lineText)
  const targetColumn = Math.max(0, Math.min(column, lineText.length))
  
  // 查找单词边界
  const { start, end } = findWordBoundary(lineText, targetColumn)
  
  // 设置选区
  if (start < end) {
    selection.setRange(targetLine, start, targetLine, end)
    cursor.setPosition(targetLine, end)
    render(true) // 选词立即渲染
  }
}

/**
 * 处理三击（选行）
 */
const handleTripleClick = (data: any) => {
  if (!cursor || !viewport || !textRenderer || !document || !selection) return
  
  // 直接使用原始 x 坐标
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  
  // 选择整行
  selection.selectLine(targetLine, document)
  cursor.setPosition(targetLine, document.getLine(targetLine).length)
  render(true) // 选行立即渲染
}

/**
 * 处理工具栏命令
 */
const handleToolbarCommand = (command: string) => {
  if (!cursor || !document || !selection || !history) return
  
  let textToInsert = ''
  let cursorOffset = 0
  
  switch (command) {
    case 'h1':
      textToInsert = '# '
      cursorOffset = textToInsert.length
      break
    case 'h2':
      textToInsert = '## '
      cursorOffset = textToInsert.length
      break
    case 'bold':
      if (selection.hasSelection) {
        const selectedText = selection.getSelectedText(document)
        textToInsert = `**${selectedText}**`
        cursorOffset = textToInsert.length
      } else {
        textToInsert = '****'
        cursorOffset = 2
      }
      break
    case 'italic':
      if (selection.hasSelection) {
        const selectedText = selection.getSelectedText(document)
        textToInsert = `*${selectedText}*`
        cursorOffset = textToInsert.length
      } else {
        textToInsert = '**'
        cursorOffset = 1
      }
      break
    case 'unordered-list':
      textToInsert = '- '
      cursorOffset = textToInsert.length
      break
    case 'ordered-list':
      textToInsert = '1. '
      cursorOffset = textToInsert.length
      break
    case 'blockquote':
      textToInsert = '> '
      cursorOffset = textToInsert.length
      break
    case 'code-block':
      textToInsert = '```\n\n```'
      cursorOffset = 4
      break
    case 'link':
      textToInsert = '[链接文字](url)'
      cursorOffset = 1
      break
    case 'image':
      textToInsert = '![图片描述](url)'
      cursorOffset = 2
      break
    default:
      return
  }
  
  const cursorBefore = { line: cursor.line, column: cursor.column }
  
  // 如果有选区，先删除
  if (selection.hasSelection && (command === 'bold' || command === 'italic')) {
    const selectedText = selection.getSelectedText(document)
    const { startLine, startColumn } = selection.getOrderedRange()
    
    history.record({
      type: 'delete',
      line: startLine,
      column: startColumn,
      text: selectedText,
      cursorBefore: cursorBefore,
      cursorAfter: { line: startLine, column: startColumn }
    })
    
    const pos = selection.deleteSelectedText(document)
    cursor.setPosition(pos.line, pos.column)
  }
  
  // 记录插入操作
  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: textToInsert,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line, column: cursor.column + cursorOffset }
  })
  
  // 插入文本
  document.insertText(cursor.line, cursor.column, textToInsert)
  
  // 移动光标
  cursor.column += cursorOffset
  
  // 重置光标闪烁
  if (cursorRenderer) {
    cursorRenderer.resetBlink(() => render(true))
  }
}

/**
 * 处理插件工具栏命令
 */
const handlePluginCommand = ({ command, args }: { command: string; args: any[] }) => {
  if (!pluginManager) return
  
  try {
    pluginManager.executeCommand(command, ...args)
  } catch (error) {
    console.error('Failed to execute plugin command:', command, error)
  }
}

/**
 * 处理搜索
 */
const handleSearch = (options: any) => {
  if (!document) return
  
  const { text, matchCase, matchWholeWord, useRegex, jumpTo, callback } = options
  
  if (!text) {
    searchMatches.value = []
    if (callback) callback([])
    return
  }
  
  const matches = []
  let pattern
  
  try {
    if (useRegex) {
      pattern = new RegExp(text, matchCase ? 'g' : 'gi')
    } else {
      // 转义特殊字符
      const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const boundaryPattern = matchWholeWord ? `\\b${escapedText}\\b` : escapedText
      pattern = new RegExp(boundaryPattern, matchCase ? 'g' : 'gi')
    }
  } catch (e) {
    // 正则表达式错误
    if (callback) callback([])
    return
  }
  
  // 搜索所有行
  for (let line = 0; line < document.getLineCount(); line++) {
    const lineText = document.getLine(line)
    let match
    
    // 重置 lastIndex
    pattern.lastIndex = 0
    
    while ((match = pattern.exec(lineText)) !== null) {
      matches.push({
        line,
        startColumn: match.index,
        endColumn: match.index + match[0].length,
        text: match[0]
      })
      
      // 防止无限循环
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++
      }
    }
  }
  
  searchMatches.value = matches
  
  if (callback) {
    callback(matches)
  }
  
  // 跳转到指定匹配
  if (typeof jumpTo === 'number' && matches[jumpTo]) {
    // 记录跳转行为（智能预测）
    if (predictiveRenderer && cursor) {
      predictiveRenderer.recordBehavior('jump', {
        from: cursor.line,
        to: matches[jumpTo].line
      })
    }
    
    const match = matches[jumpTo]
    if (cursor && viewport) {
      cursor.setPosition(match.line, match.startColumn)
      
      // 滚动到可见区域
      const targetY = match.line * viewport.lineHeight
      if (targetY < viewport.scrollTop || targetY > viewport.scrollTop + viewport.height) {
        viewport.setScrollTop(targetY - viewport.height / 3)
      }
      
      render(true) // 搜索跳转立即渲染
    }
  }
}

/**
 * 处理替换
 */
const handleReplace = (options: any) => {
  if (!document || !cursor || !history) return
  
  const { searchText, replaceText, matchCase, matchWholeWord, useRegex, callback } = options
  
  // 先搜索
  handleSearch({
    text: searchText,
    matchCase,
    matchWholeWord,
    useRegex,
    callback: (matches: any[]) => {
      if (matches.length === 0 || !cursor || !history || !document) return
      
      const cursorLine = cursor.line
      const cursorColumn = cursor.column
      
      // 找到当前光标位置的匹配
      const currentMatch = matches.find((m: any) => 
        m.line === cursorLine && 
        cursorColumn >= m.startColumn && 
        cursorColumn <= m.endColumn
      )
      
      if (currentMatch) {
        // 替换当前匹配
        const cursorBefore = { line: cursor.line, column: cursor.column }
        
        history.record({
          type: 'delete',
          line: currentMatch.line,
          column: currentMatch.startColumn,
          text: currentMatch.text,
          cursorBefore,
          cursorAfter: { line: currentMatch.line, column: currentMatch.startColumn }
        })
        
        document.deleteText(currentMatch.line, currentMatch.startColumn, currentMatch.line, currentMatch.endColumn)
        
        history.record({
          type: 'insert',
          line: currentMatch.line,
          column: currentMatch.startColumn,
          text: replaceText,
          cursorBefore: { line: currentMatch.line, column: currentMatch.startColumn },
          cursorAfter: { line: currentMatch.line, column: currentMatch.startColumn + replaceText.length }
        })
        
        document.insertText(currentMatch.line, currentMatch.startColumn, replaceText)
        cursor.setPosition(currentMatch.line, currentMatch.startColumn + replaceText.length)
        
        render(true) // 替换立即渲染
      }
      
      if (callback) callback()
    }
  })
}

/**
 * 处理全部替换
 */
const handleReplaceAll = (options: any) => {
  if (!document || !history) return
  
  const { searchText, replaceText, matchCase, matchWholeWord, useRegex, callback } = options
  
  // 先搜索
  handleSearch({
    text: searchText,
    matchCase,
    matchWholeWord,
    useRegex,
    callback: (matches: any[]) => {
      if (matches.length === 0 || !history || !document || !cursor) {
        if (callback) callback()
        return
      }
      
      // 从后往前替换，避免位置偏移
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i]
        
        history.record({
          type: 'delete',
          line: match.line,
          column: match.startColumn,
          text: match.text,
          cursorBefore: { line: match.line, column: match.startColumn },
          cursorAfter: { line: match.line, column: match.startColumn }
        })
        
        document.deleteText(match.line, match.startColumn, match.line, match.endColumn)
        
        history.record({
          type: 'insert',
          line: match.line,
          column: match.startColumn,
          text: replaceText,
          cursorBefore: { line: match.line, column: match.startColumn },
          cursorAfter: { line: match.line, column: match.startColumn + replaceText.length }
        })
        
        document.insertText(match.line, match.startColumn, replaceText)
      }
      
      render(true) // 全部替换立即渲染
      
      if (callback) callback()
    }
  })
}

/**
 * 应用历史操作
 * @param {Object} operation - 操作对象
 * @param {boolean} isUndo - 是否是撤销操作
 */
const applyHistoryOperation = (operation: any, isUndo: boolean) => {
  if (!history || !document || !cursor || !selection || !cursorRenderer) return
  
  history.startApplying()
  
  try {
    if (isUndo) {
      // 撤销：反向操作
      if (operation.type === 'insert') {
        // 撤销插入 = 删除
        const lines = operation.text.split('\n')
        const endLine = lines.length === 1 ? operation.line : operation.line + lines.length - 1
        const endColumn = lines.length === 1 ? operation.column + operation.text.length : lines[lines.length - 1].length
        
        document.deleteText(operation.line, operation.column, endLine, endColumn)
        cursor.setPosition(operation.cursorBefore.line, operation.cursorBefore.column)
      } else {
        // 撤销删除 = 插入
        document.insertText(operation.line, operation.column, operation.text)
        cursor.setPosition(operation.cursorBefore.line, operation.cursorBefore.column)
      }
    } else {
      // 重做：正向操作
      if (operation.type === 'insert') {
        document.insertText(operation.line, operation.column, operation.text)
        cursor.setPosition(operation.cursorAfter.line, operation.cursorAfter.column)
      } else {
        const lines = operation.text.split('\n')
        const endLine = lines.length === 1 ? operation.line : operation.line + lines.length - 1
        const endColumn = lines.length === 1 ? operation.column + operation.text.length : lines[lines.length - 1].length
        
        document.deleteText(operation.line, operation.column, endLine, endColumn)
        cursor.setPosition(operation.cursorAfter.line, operation.cursorAfter.column)
      }
    }
    
    // 清除选区
    selection.clear()
    
    // 重置光标闪烁
    cursorRenderer.resetBlink(() => render(true))
  } finally {
    history.endApplying()
  }
}

/**
 * 处理鼠标点击
 */
const handleClick = (data: any) => {
  if (!cursor || !viewport || !textRenderer || !document || !selection || !cursorRenderer) return
  
  // 如果有选区，说明用户刚才拖拽选择了文本，不要清除选区
  if (selection.hasSelection) {
    return
  }
  
  // 直接使用原始 x 坐标，viewport 会通过 padding 处理偏移
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  const lineText = document.getLine(targetLine)
  
  // 再用精确版获取列号
  const { column } = viewport.canvasToDoc(data.x, data.y, textRenderer, lineText)
  const targetColumn = Math.max(0, Math.min(column, lineText.length))
  
  // 清除选区
  selection.clear()
  
  // 设置光标位置
  cursor.setPosition(targetLine, targetColumn)
  
  // 重置光标闪烁
  cursorRenderer.resetBlink(() => render(true))
}

/**
 * 处理鼠标按下
 */
const handleMouseDown = (data: any) => {
  if (!viewport || !textRenderer || !document || !selection || !cursor || !cursorRenderer) return
  
  isMouseDown = true
  isDragging = false
  
  // 直接使用原始 x 坐标
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  const lineText = document.getLine(targetLine)
  
  // 再用精确版获取列号
  const { column } = viewport.canvasToDoc(data.x, data.y, textRenderer, lineText)
  const targetColumn = Math.max(0, Math.min(column, lineText.length))
  
  mouseDownPosition = { x: data.x, y: data.y, line: targetLine, column: targetColumn }
  
  // 检查是否点击在选区内（可能开始拖拽）
  if (selection.hasSelection) {
    const { startLine, startColumn, endLine, endColumn } = selection.getOrderedRange()
    const isInSelection = 
      (targetLine > startLine || (targetLine === startLine && targetColumn >= startColumn)) &&
      (targetLine < endLine || (targetLine === endLine && targetColumn <= endColumn))
    
    if (isInSelection) {
      // 点击在选区内，可能开始拖拽
      dragStartSelection = {
        startLine,
        startColumn,
        endLine,
        endColumn,
        text: selection.getSelectedText(document)
      }
      return
    }
  }
  
  // 点击在选区外，开始新选区
  dragStartSelection = null
  selection.setRange(targetLine, targetColumn, targetLine, targetColumn)
  cursor.setPosition(targetLine, targetColumn)
  
  // 重置光标闪烁
  cursorRenderer.resetBlink(() => render(true))
}

/**
 * 处理鼠标移动
 */
const handleMouseMove = (data: any) => {
  if (!isMouseDown || !viewport || !textRenderer || !document || !cursor || !selection || !mouseDownPosition || !canvasRef.value) return
  
  // 直接使用原始 x 坐标
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  const lineText = document.getLine(targetLine)
  
  // 再用精确版获取列号
  const { column } = viewport.canvasToDoc(data.x, data.y, textRenderer, lineText)
  const targetColumn = Math.max(0, Math.min(column, lineText.length))
  
  // 判断是否开始拖拽（只有在点击选区内时才判断）
  if (dragStartSelection && !isDragging) {
    const moved = 
      Math.abs(targetLine - mouseDownPosition.line) > 0 ||
      Math.abs(targetColumn - mouseDownPosition.column) > 2
    
    if (moved) {
      isDragging = true
      // 设置鼠标样式
      canvasRef.value.style.cursor = 'move'
    }
  }
  
  if (isDragging) {
    // 拖拽模式：更新光标位置
    cursor.setPosition(targetLine, targetColumn)
    render() // 拖拽使用防抖
  } else if (mouseDownPosition) {
    // 选择模式：更新选区
    selection.setRange(
      mouseDownPosition.line,
      mouseDownPosition.column,
      targetLine,
      targetColumn
    )
    
    cursor.setPosition(targetLine, targetColumn)
    render() // 选择使用防抖
  }
}

/**
 * 处理鼠标释放
 */
const handleMouseUp = () => {
  if (!selection || !cursor || !history || !document || !cursorRenderer) return
  
  // 如果只是点击（没有真正选择文字），清除选区
  if (!isDragging && !dragStartSelection && selection.hasSelection) {
    const { startLine, startColumn, endLine, endColumn } = selection.getOrderedRange()
    
    // 检查是否真的选择了文字（不只是鼠标抖动）
    // 注意：如果column是NaN，也认为是空选区
    const isEmptySelection = (
      (startLine === endLine && startColumn === endColumn) ||
      isNaN(startColumn) || isNaN(endColumn)
    )
    
    if (isEmptySelection) {
      selection.clear()
    }
  }
  
  if (isDragging && dragStartSelection) {
    // 完成拖拽操作
    const targetLine = cursor.line
    const targetColumn = cursor.column
    
    // 检查是否拖到选区内（无效拖拽）
    const { startLine, startColumn, endLine, endColumn } = dragStartSelection
    const isInOriginalSelection = 
      (targetLine > startLine || (targetLine === startLine && targetColumn >= startColumn)) &&
      (targetLine < endLine || (targetLine === endLine && targetColumn <= endColumn))
    
    if (!isInOriginalSelection) {
      // 记录删除原位置
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: dragStartSelection.text,
        cursorBefore: { line: startLine, column: startColumn },
        cursorAfter: { line: startLine, column: startColumn }
      })
      
      // 删除原选区
      document.deleteText(startLine, startColumn, endLine, endColumn)
      
      // 调整目标位置（如果在原选区之后）
      let adjustedLine = targetLine
      let adjustedColumn = targetColumn
      
      if (targetLine > endLine || (targetLine === endLine && targetColumn > endColumn)) {
        // 目标在选区后面，需要调整
        const lines = dragStartSelection.text.split('\n')
        if (lines.length === 1) {
          if (targetLine === endLine) {
            adjustedColumn = targetColumn - dragStartSelection.text.length
          }
        } else {
          adjustedLine = targetLine - (lines.length - 1)
          if (targetLine === endLine) {
            adjustedColumn = targetColumn - lines[lines.length - 1].length
          }
        }
      }
      
      // 记录插入新位置
      history.record({
        type: 'insert',
        line: adjustedLine,
        column: adjustedColumn,
        text: dragStartSelection.text,
        cursorBefore: { line: adjustedLine, column: adjustedColumn },
        cursorAfter: { line: adjustedLine, column: adjustedColumn + dragStartSelection.text.length }
      })
      
      // 插入到新位置
      document.insertText(adjustedLine, adjustedColumn, dragStartSelection.text)
      
      // 更新光标位置
      const insertedLines = dragStartSelection.text.split('\n')
      if (insertedLines.length === 1) {
        cursor.setPosition(adjustedLine, adjustedColumn + dragStartSelection.text.length)
      } else {
        cursor.setPosition(
          adjustedLine + insertedLines.length - 1,
          insertedLines[insertedLines.length - 1].length
        )
      }
      
      // 清除选区
      selection.clear()
      
      // 重置光标闪烁
      cursorRenderer.resetBlink(() => render(true))
    } else {
      // 拖到原位置，清除选区
      selection.clear()
      
      // 重置光标闪烁
      cursorRenderer.resetBlink(() => render(true))
    }
    
    // 恢复鼠标样式
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'text'
    }
  } else if (dragStartSelection && !isDragging) {
    // 点击了选区内但没有拖拽，清除选区
    selection.clear()
    
    // 设置光标到点击位置
    if (mouseDownPosition) {
      cursor.setPosition(mouseDownPosition.line, mouseDownPosition.column)
    }
    
    // 重置光标闪烁
    cursorRenderer.resetBlink(() => render(true))
  }
  
  isMouseDown = false
  mouseDownPosition = null
  isDragging = false
  dragStartSelection = null
  
  // 最后检查：如果选区的start==end，清除它（避免鼠标抖动导致的假选区）
  if (selection.hasSelection) {
    const { startLine, startColumn, endLine, endColumn } = selection.getOrderedRange()
    
    // 检查是否为空选区（包括NaN的情况）
    const isEmptySelection = (
      (startLine === endLine && startColumn === endColumn) ||
      isNaN(startColumn) || isNaN(endColumn)
    )
    
    if (isEmptySelection) {
      selection.clear()
      render(true) // 清除选区立即渲染
    }
  }
}

/**
 * 处理鼠标滚轮
 */
const handleWheel = (event: WheelEvent) => {
  if (!viewport || !predictiveRenderer) return
  
  event.preventDefault()
  
  const delta = event.deltaY
  const oldScrollTop = viewport.scrollTop
  viewport.setScrollTop(viewport.scrollTop + delta)
  
  // 记录滚动行为（智能预测）
  if (predictiveRenderer) {
    const scrollSpeed = Math.abs(delta) / 100 // 归一化速度
    predictiveRenderer.recordBehavior('scroll', {
      direction: delta > 0 ? 'down' : 'up',
      speed: scrollSpeed,
      delta: Math.abs(delta)
    })
  }
  
  // 更新预加载状态
  if (preloadManager && viewport) {
    preloadManager.updateScroll(
      viewport.scrollTop,
      viewport.height,
      viewport.totalHeight
    )
  }
  
  // 发送滚动事件
  emitScrollPercentage()
  
  render() // 滚动使用防抖，提升性能
}

/**
 * 发送滚动百分比
 */
const emitScrollPercentage = () => {
  if (!viewport || props.isSyncing) return
  
  const maxScroll = Math.max(0, viewport.totalHeight - viewport.height)
  if (maxScroll <= 0) {
    emit('update:scrollPercentage', 0)
    emit('scroll', 0)
    return
  }
  
  const percentage = viewport.scrollTop / maxScroll
  emit('update:scrollPercentage', percentage)
  emit('scroll', percentage)
}

/**
 * 调整画布尺寸
 */
const resizeCanvas = () => {
  if (!containerRef.value || !canvasRef.value) return
  
  const container = containerRef.value
  const canvas = canvasRef.value
  const rect = container.getBoundingClientRect()
  
  // 获取设备像素比
  const pixelRatio = window.devicePixelRatio || 1
  
  // CSS 尺寸（逻辑像素）
  const width = Math.floor(rect.width)
  const height = Math.floor(rect.height)
  
  canvasWidth.value = width
  canvasHeight.value = height
  
  // Canvas 物理尺寸 = CSS 尺寸 × 设备像素比（提升清晰度）
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  
  // Canvas CSS 尺寸保持不变
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  
  // 注意：修改 canvas.width/height 会自动重置 Canvas 状态！
  // 所以需要重新设置所有状态
  if (ctx) {
    // 缩放绘图上下文，使坐标系统与 CSS 像素对齐
    ctx.scale(pixelRatio, pixelRatio)
    
    // 开启文字渲染优化
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    // 设置文字渲染质量（仅部分浏览器支持）
    if ('textRendering' in ctx) {
      ctx.textRendering = 'optimizeLegibility'
    }
    
    // 关键：设置字体平滑
    if ('fontSmoothing' in ctx) {
      ctx.fontSmoothing = 'antialiased'
    }
    
    // Webkit/Blink 特有的文字渲染优化
    if ('webkitFontSmoothing' in ctx) {
      ctx.webkitFontSmoothing = 'antialiased'
    }
    
    // Firefox 的文字渲染优化
    if ('mozFontSmoothing' in ctx) {
      ctx.mozFontSmoothing = 'antialiased'
    }
  }
  
  if (viewport) {
    viewport.setSize(canvasWidth.value, canvasHeight.value)
    
    // 重新初始化离屏Canvas
    if (renderOptimizer) {
      renderOptimizer.resizeOffscreenCanvas(width * pixelRatio, height * pixelRatio)
      renderOptimizer.markFullRender()
    }
    
    render(true) // 立即渲染
  }
}

// 监听 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  if (document && document.getText() !== newValue) {
    document.setText(newValue)
  }
})

onMounted(() => {
  // 初始化编辑器
  initEditor()
  
  // 初始渲染
  resizeCanvas()
  
  // 监听窗口大小变化
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  
  // 清理资源
  if (cursorRenderer) {
    cursorRenderer.destroy()
  }
  
  if (inputManager) {
    inputManager.destroy()
  }
  
  if (textRenderer && textRenderer.destroy) {
    textRenderer.destroy()
  }
  
  // 清理插件系统
  if (pluginManager) {
    pluginManager.destroy()
  }
  
  // 清理渲染优化器
  if (renderOptimizer) {
    renderOptimizer.destroy()
  }
  
  // 清理预加载管理器
  if (preloadManager) {
    preloadManager.destroy()
  }
  
  // 清理智能预测渲染器
  if (predictiveRenderer) {
    predictiveRenderer.destroy()
  }
  
  window.removeEventListener('resize', resizeCanvas)
})

// 暴露给父组件的方法
defineExpose({
  getPerformanceStats,
  document,
  cursor,
  selection
})
</script>

<style scoped>
.canvas-editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.canvas-editor {
  flex: 1;
  width: 100%;
  overflow: hidden;
  position: relative;
}

canvas {
  display: block;
  cursor: text;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;  /* Canvas在下层，渲染背景、选区、光标 */
  
  /* 文字渲染优化 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-smooth: always;
  text-rendering: optimizeLegibility;
}

/* DOM文字层由DOMTextRenderer创建，z-index: 2，在Canvas上方 */
</style>
