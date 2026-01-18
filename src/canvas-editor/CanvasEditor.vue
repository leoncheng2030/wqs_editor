<template>
  <div class="canvas-editor-container">
    <CanvasToolbar v-if="showToolbar" @command="handleToolbarCommand" />
    <div class="canvas-editor" ref="containerRef">
      <canvas
        ref="canvasRef"
        @wheel="handleWheel"
        :width="canvasWidth"
        :height="canvasHeight"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Document } from './core/Document.js'
import { ViewportManager } from './managers/ViewportManager.js'
import { DOMTextRenderer } from './renderers/DOMTextRenderer.js'  // 改用DOM渲染器
import { InputManager } from './managers/InputManager.js'
import { Cursor } from './core/Cursor.js'
import { CursorRenderer } from './renderers/CursorRenderer.js'
import { Selection } from './core/Selection.js'
import { SelectionRenderer } from './renderers/SelectionRenderer.js'
import { History } from './core/History.js'
import { Clipboard } from './managers/ClipboardManager.js'
import { MarkdownLexer } from './syntax/MarkdownLexer.js'
import { SyntaxHighlighter } from './syntax/SyntaxHighlighter.js'
import { LineNumberRenderer } from './renderers/LineNumberRenderer.js'
import CanvasToolbar from './CanvasToolbar.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
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
const containerRef = ref(null)
const canvasRef = ref(null)

// Canvas 尺寸
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const dpr = ref(window.devicePixelRatio || 1) // 设备像素比

// 核心对象
let document = null
let viewport = null
let textRenderer = null
let inputManager = null
let cursor = null
let cursorRenderer = null
let selection = null
let selectionRenderer = null
let history = null
let clipboard = null
let ctx = null
let lineNumberRenderer = null

// 鼠标状态
let isMouseDown = false
let mouseDownPosition = null
let isDragging = false
let dragStartSelection = null

// 渲染循环
let animationFrameId = null

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
  textRenderer = new DOMTextRenderer(containerRef.value, {
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
  
  // 获取 Canvas 上下文
  const canvas = canvasRef.value
  
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
  inputManager = new InputManager(containerRef.value, {
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
  
  // 开始渲染
  render()
  
  // 启动光标闪烁
  cursorRenderer.startBlinking(render)
}

/**
 * 监听主题变化
 */
watch(() => props.theme, (newTheme) => {
  if (textRenderer && textRenderer.highlighter) {
    textRenderer.highlighter.setTheme(newTheme)
    textRenderer.updateThemeColors()
  }
  if (lineNumberRenderer) {
    lineNumberRenderer.updateTheme(newTheme)
  }
  render()
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
    render()
  }
})

/**
 * 监听字体大小变化
 */
watch(() => props.fontSize, (newSize) => {
  if (textRenderer) {
    textRenderer.fontSize = newSize
    // 强制重新渲染DOM文字层
    if (textRenderer.markDirty) {
      textRenderer.markDirty()
    }
    render()
  }
  // 更新行号渲染器的字体大小
  if (lineNumberRenderer) {
    lineNumberRenderer.fontSize = newSize - 1
    render()
  }
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
  if (viewport) {
    viewport.lineHeight = newHeight
    viewport.setTotalLines(document.getLineCount())  // 重新计算总高度
  }
  render()
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
  viewport.setTotalLines(document.getLineCount())
  render()
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
const handleDocumentChange = () => {
  viewport.setTotalLines(document.getLineCount())
  
  // 标记文字层需要重新渲染
  if (textRenderer && textRenderer.markDirty) {
    textRenderer.markDirty()
  }
  
  emit('update:modelValue', document.getText())
  render()
}

/**
 * 渲染
 */
const render = () => {
  if (!ctx || !document || !viewport || !textRenderer) return
  
  // 1. 清空整个Canvas
  ctx.clearRect(0, 0, viewport.width, viewport.height)
  
  // 2. 渲染背景色（Canvas）
  ctx.fillStyle = textRenderer.backgroundColor
  ctx.fillRect(0, 0, viewport.width, viewport.height)
  
  // 3. 渲染行号（Canvas）
  if (lineNumberRenderer && props.showLineNumbers) {
    lineNumberRenderer.render(
      ctx,
      viewport,
      document.getLineCount(),
      cursor.line,
      textRenderer.lineHeight
    )
  }
  
  // 4. 渲染选区（Canvas）
  if (selection && selectionRenderer) {
    selectionRenderer.render(ctx, selection, viewport, document, textRenderer, textRenderer.lineHeight)
  }
  
  // 5. 渲染文本内容（DOM！）
  textRenderer.renderContent(document, viewport)
  
  // 6. 渲染光标（Canvas）
  if (cursor && cursorRenderer && !selection.hasSelection) {
    const lineText = document.getLine(cursor.line)
    cursorRenderer.render(ctx, cursor, viewport, textRenderer, lineText, textRenderer.lineHeight)
  }
  
  // 7. 更新 textarea 位置，让 IME 候选框跟随光标
  if (cursor && inputManager) {
    const lineText = document.getLine(cursor.line)
    const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer, lineText)
    inputManager.updateTextareaPosition(x, y + textRenderer.lineHeight)
  }
}

/**
 * 处理输入
 */
const handleInput = (data) => {
  if (!data.data || !cursor || !document) return
  
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
  
  // 重置光标闪烁
  cursorRenderer.resetBlink(render)
}

/**
 * 处理按键
 */
const handleKeyDown = (data) => {
  const { key, ctrlKey, shiftKey, metaKey } = data
  
  if (!cursor || !document) return
  
  // Ctrl+A 全选
  if ((ctrlKey || metaKey) && key === 'a') {
    selection.selectAll(document)
    render()
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
      cursorRenderer.resetBlink(render)
    }
    return
  }
  
  // Ctrl+V 粘贴
  if ((ctrlKey || metaKey) && key === 'v') {
    clipboard.paste().then(text => {
      if (!text) return
      
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
      
      cursorRenderer.resetBlink(render)
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
    
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    cursorRenderer.resetBlink(render)
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
    
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: '\n',
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line + 1, column: 0 }
    })
    
    document.insertText(cursor.line, cursor.column, '\n')
    cursor.line++
    cursor.column = 0
    cursorRenderer.resetBlink(render)
    return
  }
}

/**
 * 查找单词边界
 * @param {string} text - 文本
 * @param {number} offset - 光标位置
 * @returns {{start: number, end: number}} 单词边界
 */
const findWordBoundary = (text, offset) => {
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
const handleDblClick = (data) => {
  if (!cursor || !viewport || !textRenderer || !document) return
  
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
    render()
  }
}

/**
 * 处理三击（选行）
 */
const handleTripleClick = (data) => {
  if (!cursor || !viewport || !textRenderer || !document) return
  
  // 直接使用原始 x 坐标
  const { line } = viewport.canvasToDoc(data.x, data.y, textRenderer, '')
  
  // 限制范围
  const maxLine = document.getLineCount() - 1
  const targetLine = Math.max(0, Math.min(line, maxLine))
  
  // 选择整行
  selection.selectLine(targetLine, document)
  cursor.setPosition(targetLine, document.getLine(targetLine).length)
  render()
}

/**
 * 处理工具栏命令
 */
const handleToolbarCommand = (command) => {
  if (!cursor || !document) return
  
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
  cursorRenderer.resetBlink(render)
}

/**
 * 应用历史操作
 * @param {Object} operation - 操作对象
 * @param {boolean} isUndo - 是否是撤销操作
 */
const applyHistoryOperation = (operation, isUndo) => {
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
    cursorRenderer.resetBlink(render)
  } finally {
    history.endApplying()
  }
}

/**
 * 处理鼠标点击
 */
const handleClick = (data) => {
  if (!cursor || !viewport || !textRenderer || !document) return
  
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
  cursorRenderer.resetBlink(render)
}

/**
 * 处理鼠标按下
 */
const handleMouseDown = (data) => {
  if (!viewport || !textRenderer || !document) return
  
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
  
  mouseDownPosition = { line: targetLine, column: targetColumn }
  
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
  cursorRenderer.resetBlink(render)
}

/**
 * 处理鼠标移动
 */
const handleMouseMove = (data) => {
  if (!isMouseDown || !viewport || !textRenderer || !document) return
  
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
    render()
  } else if (mouseDownPosition) {
    // 选择模式：更新选区
    selection.setRange(
      mouseDownPosition.line,
      mouseDownPosition.column,
      targetLine,
      targetColumn
    )
    
    cursor.setPosition(targetLine, targetColumn)
    render()
  }
}

/**
 * 处理鼠标释放
 */
const handleMouseUp = () => {
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
      cursorRenderer.resetBlink(render)
    } else {
      // 拖到原位置，清除选区
      selection.clear()
      
      // 重置光标闪烁
      cursorRenderer.resetBlink(render)
    }
    
    // 恢复鼠标样式
    canvasRef.value.style.cursor = 'text'
  } else if (dragStartSelection && !isDragging) {
    // 点击了选区内但没有拖拽，清除选区
    selection.clear()
    
    // 设置光标到点击位置
    if (mouseDownPosition) {
      cursor.setPosition(mouseDownPosition.line, mouseDownPosition.column)
    }
    
    // 重置光标闪烁
    cursorRenderer.resetBlink(render)
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
      render()
    }
  }
}

/**
 * 处理鼠标滚轮
 */
const handleWheel = (event) => {
  event.preventDefault()
  
  const delta = event.deltaY
  viewport.setScrollTop(viewport.scrollTop + delta)
  
  // 发送滚动事件
  emitScrollPercentage()
  
  render()
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
    render()
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
  
  window.removeEventListener('resize', resizeCanvas)
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
