/**
 * DOM Text Renderer
 * 使用DOM渲染文字（清晰），Canvas渲染装饰（灵活）
 */

import type { Token, ParserContext, Diagnostic } from '../types'

interface Lexer {
  parseLine(text: string, lineIndex: number, context?: ParserContext): Token[]
  clearDirtyMarks(): void
}

interface Highlighter {
  theme: string
  getStyle(tokenType: string): TextStyle
}

interface TextStyle {
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

interface ViewportManager {
  scrollTop: number
  padding: number
  getVisibleRange(): { startLine: number; endLine: number }
}

interface Document {
  getLine(lineIndex: number): string
  getLineCount(): number
}

export class DOMTextRenderer {
  public fontFamily: string
  public fontSize: number
  public lineHeight: number
  public textColor: string
  public backgroundColor: string
  public charWidth: number
  public enableSyntaxHighlight: boolean
  
  private container: HTMLElement
  private measureCache: Map<string, number>
  private maxCacheSize: number
  private lexer: Lexer | null
  private highlighter: Highlighter | null
  private diagnostics: Diagnostic[]
  private textLayer: HTMLDivElement
  private renderedLines: Map<number, HTMLDivElement>
  private lastStartLine: number
  private lastEndLine: number
  private needsFullRender: boolean

  constructor(container: HTMLElement, options: Partial<{
    fontFamily: string
    fontSize: number
    lineHeight: number
    textColor: string
    backgroundColor: string
    enableSyntaxHighlight: boolean
  }> = {}) {
    this.container = container
    this.fontFamily = options.fontFamily || '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace'
    this.fontSize = options.fontSize || 15
    this.lineHeight = options.lineHeight || 26
    this.textColor = options.textColor || '#333333'
    this.backgroundColor = options.backgroundColor || '#ffffff'
    
    this.charWidth = this.fontSize * 0.6
    
    this.measureCache = new Map()
    this.maxCacheSize = 1000
    
    this.enableSyntaxHighlight = options.enableSyntaxHighlight !== false
    this.lexer = null
    this.highlighter = null
    
    this.diagnostics = []
    
    this.textLayer = document.createElement('div')
    this.textLayer.className = 'text-layer'
    this.textLayer.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 2;
      font-family: ${this.fontFamily};
      font-size: ${this.fontSize}px;
      line-height: ${this.lineHeight}px;
      color: ${this.textColor};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      overflow: hidden;
    `
    this.container.appendChild(this.textLayer)
    
    this.renderedLines = new Map()
    
    this.lastStartLine = -1
    this.lastEndLine = -1
    this.needsFullRender = true
  }
  
  /**
   * 设置语法高亮器
   */
  setSyntaxHighlight(lexer: Lexer, highlighter: Highlighter): void {
    this.lexer = lexer
    this.highlighter = highlighter
    this.updateThemeColors()
  }
  
  /**
   * 设置语法检查诊断数据
   */
  setDiagnostics(diagnostics: Diagnostic[]): void {
    this.diagnostics = diagnostics || []
    this.markDirty()
  }
  
  /**
   * 更新主题颜色
   */
  updateThemeColors(): void {
    if (this.highlighter) {
      const theme = this.highlighter.theme
      if (theme === 'dark') {
        this.textColor = '#cccccc'
        this.backgroundColor = '#1e1e1e'
      } else {
        this.textColor = '#333333'
        this.backgroundColor = '#ffffff'
      }
      this.textLayer.style.color = this.textColor
    }
  }
  
  /**
   * 标记需要完整重新渲染
   */
  markDirty(): void {
    this.needsFullRender = true
  }
  
  /**
   * 渲染内容
   */
  renderContent(document: Document, viewport: ViewportManager): void {
    this.textLayer.style.transform = `translateY(${-viewport.scrollTop}px)`
    
    this.textLayer.style.fontSize = `${this.fontSize}px`
    this.textLayer.style.lineHeight = `${this.lineHeight}px`
    this.textLayer.style.fontFamily = this.fontFamily
    
    this.textLayer.style.left = `${viewport.padding}px`
    
    const { startLine, endLine } = viewport.getVisibleRange()
    
    if (this.lastStartLine === startLine && this.lastEndLine === endLine && !this.needsFullRender) {
      return
    }
    
    this.lastStartLine = startLine
    this.lastEndLine = endLine
    this.needsFullRender = false
    
    const context: ParserContext = { inCodeBlock: false }
    
    for (let i = 0; i < startLine && i < document.getLineCount(); i++) {
      const line = document.getLine(i)
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    // 使用DocumentFragment批量构建DOM，减少重排
    const fragment = globalThis.document.createDocumentFragment()
    const newRenderedLines = new Map<number, HTMLDivElement>()
    
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const text = document.getLine(lineIndex)
      
      const y = lineIndex * this.lineHeight
      const x = 0
      
      const lineDiv = this.createLineElement(text, x, y, lineIndex, context)
      fragment.appendChild(lineDiv)
      newRenderedLines.set(lineIndex, lineDiv)
      
      if (text.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    // 一次性清空并添加所有行
    this.textLayer.innerHTML = ''
    this.textLayer.appendChild(fragment)
    this.renderedLines = newRenderedLines
    
    if (this.lexer) {
      this.lexer.clearDirtyMarks()
    }
  }
  
  /**
   * 创建行元素（不立即添加到DOM）
   */
  private createLineElement(text: string, x: number, y: number, lineIndex: number, context: ParserContext = {}): HTMLDivElement {
    const lineDiv = globalThis.document.createElement('div')
    lineDiv.className = 'editor-line'
    lineDiv.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      height: ${this.lineHeight}px;
      line-height: ${this.lineHeight}px;
      white-space: pre;
      user-select: none;
      display: flex;
      align-items: center;
    `
      
    if (!text || text.length === 0) {
      lineDiv.innerHTML = '&nbsp;'
      return lineDiv
    }
      
    const lineDiagnostics = this.diagnostics.filter(d => d.line === lineIndex)
      
    if (!this.enableSyntaxHighlight || !this.lexer || !this.highlighter) {
      if (lineDiagnostics.length > 0) {
        this.renderLineWithDiagnostics(lineDiv, text, lineDiagnostics)
      } else {
        lineDiv.textContent = text
      }
      return lineDiv
    }
      
    const tokens = this.lexer.parseLine(text, lineIndex, context)
      
    if (tokens.length === 0) {
      lineDiv.innerHTML = '&nbsp;'
      return lineDiv
    }
      
    this.renderTokensWithDiagnostics(lineDiv, tokens, text, lineDiagnostics)
      
    return lineDiv
  }
  
  /**
   * 渲染单行文本（保留用于兼容性）
   */
  private renderLine(text: string, x: number, y: number, lineIndex: number, context: ParserContext = {}): void {
    const lineDiv = this.createLineElement(text, x, y, lineIndex, context)
    this.textLayer.appendChild(lineDiv)
    this.renderedLines.set(lineIndex, lineDiv)
  }
    
  /**
   * 渲染带诊断标记的纯文本
   */
  private renderLineWithDiagnostics(lineDiv: HTMLDivElement, text: string, diagnostics: Diagnostic[]): void {
    if (diagnostics.length === 0) {
      lineDiv.textContent = text
      return
    }
      
    const sortedDiagnostics = [...diagnostics].sort((a, b) => a.column - b.column)
      
    let lastPos = 0
    for (const diagnostic of sortedDiagnostics) {
      const start = diagnostic.column
      const end = start + (diagnostic.length || 1)
        
      if (start > lastPos) {
        const span = document.createElement('span')
        span.textContent = text.substring(lastPos, start)
        lineDiv.appendChild(span)
      }
        
      const diagnosticSpan = document.createElement('span')
      diagnosticSpan.textContent = text.substring(start, end)
      diagnosticSpan.className = `syntax-${diagnostic.severity}-underline`
      diagnosticSpan.title = diagnostic.message
      lineDiv.appendChild(diagnosticSpan)
        
      lastPos = end
    }
      
    if (lastPos < text.length) {
      const span = document.createElement('span')
      span.textContent = text.substring(lastPos)
      lineDiv.appendChild(span)
    }
  }
    
  /**
   * 渲染带诊断标记的 tokens
   */
  private renderTokensWithDiagnostics(lineDiv: HTMLDivElement, tokens: Token[], text: string, diagnostics: Diagnostic[]): void {
    for (const token of tokens) {
      const style = this.highlighter!.getStyle(token.type)
        
      const span = document.createElement('span')
      span.textContent = token.text
      span.style.color = style.color || ''
      span.dataset.tokenStart = token.start.toString()
      span.dataset.tokenEnd = token.end.toString()
        
      if (style.bold) {
        span.style.fontWeight = 'bold'
      }
      if (style.italic) {
        span.style.fontStyle = 'italic'
      }
      if (style.underline) {
        span.style.textDecoration = 'underline'
      }
      if (style.strikethrough) {
        span.style.textDecoration = 'line-through'
      }
        
      const overlappingDiagnostic = diagnostics.find(d => {
        const dStart = d.column
        const dEnd = d.column + (d.length || 1)
        return (dStart < token.end && dEnd > token.start)
      })
        
      if (overlappingDiagnostic) {
        span.classList.add(`syntax-${overlappingDiagnostic.severity}-underline`)
        span.title = overlappingDiagnostic.message
      }
        
      lineDiv.appendChild(span)
    }
  }
  
  /**
   * 清除测量缓存（字体变化时调用）
   */
  clearMeasureCache(): void {
    this.measureCache.clear()
  }
  
  /**
   * 测量文本宽度（带缓存）
   */
  measureText(ctx: CanvasRenderingContext2D | null, text: string): number {
    if (!text || text.length === 0) return 0
    
    const cacheKey = `${this.fontSize}_${text}`
    if (this.measureCache.has(cacheKey)) {
      return this.measureCache.get(cacheKey)!
    }
    
    const span = document.createElement('span')
    span.style.cssText = `
      font-family: ${this.fontFamily};
      font-size: ${this.fontSize}px;
      position: absolute;
      visibility: hidden;
      white-space: pre;
    `
    span.textContent = text
    document.body.appendChild(span)
    const width = span.offsetWidth
    document.body.removeChild(span)
    
    if (this.measureCache.size >= this.maxCacheSize) {
      const firstKey = this.measureCache.keys().next().value
      if (firstKey) {
        this.measureCache.delete(firstKey)
      }
    }
    this.measureCache.set(cacheKey, width)
    
    return width
  }
  
  /**
   * 计算文本在某列的 x 坐标
   */
  getColumnX(text: string, column: number): number {
    if (column === 0) {
      return 0
    }
    
    if (column >= text.length) {
      return this.measureText(null, text)
    }
    
    const textBeforeColumn = text.substring(0, column)
    return this.measureText(null, textBeforeColumn)
  }
  
  /**
   * 根据 x 坐标查找对应的列号
   */
  getColumnFromX(text: string, x: number): number {
    if (x <= 0) {
      return 0
    }
    
    if (!text || text.length === 0) {
      return 0
    }
    
    let left = 0
    let right = text.length
    
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      const textWidth = this.measureText(null, text.substring(0, mid))
      
      if (textWidth <= x) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    
    if (left < text.length) {
      const currentWidth = this.measureText(null, text.substring(0, left))
      const nextWidth = this.measureText(null, text.substring(0, left + 1))
      const currentDist = Math.abs(x - currentWidth)
      const nextDist = Math.abs(x - nextWidth)
      
      if (nextDist < currentDist) {
        return left + 1
      }
    }
    
    return left
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    if (this.textLayer && this.textLayer.parentNode) {
      this.textLayer.parentNode.removeChild(this.textLayer)
    }
    this.renderedLines.clear()
  }
}
