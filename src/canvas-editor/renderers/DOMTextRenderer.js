/**
 * DOM Text Renderer
 * 使用DOM渲染文字（清晰），Canvas渲染装饰（灵活）
 */
export class DOMTextRenderer {
  constructor(container, options = {}) {
    this.container = container
    this.fontFamily = options.fontFamily || '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace'
    this.fontSize = options.fontSize || 15
    this.lineHeight = options.lineHeight || 26
    this.textColor = options.textColor || '#333333'
    this.backgroundColor = options.backgroundColor || '#ffffff'
    
    // 计算平均字符宽度（用于退化方案）
    this.charWidth = this.fontSize * 0.6  // 等宽字体的近似值
    
    // 语法高亮相关
    this.enableSyntaxHighlight = options.enableSyntaxHighlight !== false
    this.lexer = null
    this.highlighter = null
    
    // 创建文字渲染容器
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
    
    // 缓存渲染的行
    this.renderedLines = new Map()
    
    // 缓存可见范围，用于优化
    this.lastStartLine = -1
    this.lastEndLine = -1
    this.needsFullRender = true
  }
  
  /**
   * 设置语法高亮器
   */
  setSyntaxHighlight(lexer, highlighter) {
    this.lexer = lexer
    this.highlighter = highlighter
    this.updateThemeColors()
  }
  
  /**
   * 更新主题颜色
   */
  updateThemeColors() {
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
  markDirty() {
    this.needsFullRender = true
  }
  
  /**
   * 渲染内容
   * @param {Document} document - 文档对象
   * @param {ViewportManager} viewport - 视口管理器
   */
  renderContent(document, viewport) {
    // 关键：先更新滚动偏移（高性能）
    this.textLayer.style.transform = `translateY(${-viewport.scrollTop}px)`
    
    // 更新textLayer的字体样式（保证实时响应fontSize/lineHeight变化）
    this.textLayer.style.fontSize = `${this.fontSize}px`
    this.textLayer.style.lineHeight = `${this.lineHeight}px`
    this.textLayer.style.fontFamily = this.fontFamily
    
    // 获取可见行范围
    const { startLine, endLine } = viewport.getVisibleRange()
    
    // 检查是否需要重新渲染（范围变化或文档变化）
    if (this.lastStartLine === startLine && this.lastEndLine === endLine && !this.needsFullRender) {
      // 只是滚动，不需要重新渲染DOM
      return
    }
    
    this.lastStartLine = startLine
    this.lastEndLine = endLine
    this.needsFullRender = false
    
    // 代码块上下文
    const context = { inCodeBlock: false }
    
    // 检查从文档开始到可见范围的代码块状态
    for (let i = 0; i < startLine && i < document.getLineCount(); i++) {
      const line = document.getLine(i)
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    // 清空现有内容
    this.textLayer.innerHTML = ''
    this.renderedLines.clear()
    
    // 渲染每一行
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const text = document.getLine(lineIndex)
      
      // 计算行的绝对位置（不考虑滚动）
      const y = lineIndex * this.lineHeight
      const x = viewport.padding
      
      this.renderLine(text, x, y, lineIndex, context)
      
      // 更新代码块状态
      if (text.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    // 渲染完成后清除脏行标记
    if (this.lexer) {
      this.lexer.clearDirtyMarks()
    }
  }
  
  /**
   * 渲染单行文本
   * @param {string} text - 文本内容
   * @param {number} x - x 坐标
   * @param {number} y - y 坐标（行顶部）
   * @param {number} lineIndex - 行号
   * @param {Object} context - 上下文（代码块状态等）
   */
  renderLine(text, x, y, lineIndex, context = {}) {
    // 创建行容器
    const lineDiv = document.createElement('div')
    lineDiv.className = 'editor-line'
    lineDiv.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      height: ${this.lineHeight}px;
      white-space: pre;
      user-select: none;
    `
    
    if (!text || text.length === 0) {
      // 空行也要渲染，占位
      lineDiv.innerHTML = '&nbsp;'
      this.textLayer.appendChild(lineDiv)
      this.renderedLines.set(lineIndex, lineDiv)
      return
    }
    
    if (!this.enableSyntaxHighlight || !this.lexer || !this.highlighter) {
      // 无语法高亮，直接渲染
      lineDiv.textContent = text
      this.textLayer.appendChild(lineDiv)
      this.renderedLines.set(lineIndex, lineDiv)
      return
    }
    
    // 解析语法
    const tokens = this.lexer.parseLine(text, lineIndex, context)
    
    if (tokens.length === 0) {
      // 空行
      lineDiv.innerHTML = '&nbsp;'
      this.textLayer.appendChild(lineDiv)
      this.renderedLines.set(lineIndex, lineDiv)
      return
    }
    
    // 按 token 渲染
    for (const token of tokens) {
      const style = this.highlighter.getStyle(token.type)
      
      const span = document.createElement('span')
      span.textContent = token.text
      span.style.color = style.color
      
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
      
      lineDiv.appendChild(span)
    }
    
    this.textLayer.appendChild(lineDiv)
    this.renderedLines.set(lineIndex, lineDiv)
  }
  
  /**
   * 测量文本宽度
   * @param {string} text - 要测量的文本
   * @returns {number} 文本宽度（像素）
   */
  measureText(ctx, text) {
    if (!text || text.length === 0) return 0
    
    // 创建临时span测量
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
    
    return width
  }
  
  /**
   * 计算文本在某列的 x 坐标
   * @param {string} text - 完整行文本
   * @param {number} column - 列号（0-based）
   * @returns {number} x 坐标
   */
  getColumnX(text, column) {
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
   * @param {string} text - 完整行文本
   * @param {number} x - x 坐标
   * @returns {number} 列号
   */
  getColumnFromX(text, x) {
    if (x <= 0) {
      return 0
    }
    
    if (!text || text.length === 0) {
      return 0
    }
    
    // 二分查找最接近的列
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
    
    // 检查是否更接近下一个字符
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
  destroy() {
    if (this.textLayer && this.textLayer.parentNode) {
      this.textLayer.parentNode.removeChild(this.textLayer)
    }
    this.renderedLines.clear()
  }
}
