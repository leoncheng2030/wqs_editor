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
    
    // 文本测量缓存 - 性能优化
    this.measureCache = new Map()
    this.maxCacheSize = 1000  // 限制缓存大小
    
    // 语法高亮相关
    this.enableSyntaxHighlight = options.enableSyntaxHighlight !== false
    this.lexer = null
    this.highlighter = null
    
    // 语法检查诊断数据
    this.diagnostics = []
    
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
   * 设置语法检查诊断数据
   */
  setDiagnostics(diagnostics) {
    this.diagnostics = diagnostics || []
    this.markDirty()
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
    
    // 更新textLayer的左侧padding（保证实时响应行号显示开关）
    this.textLayer.style.left = `${viewport.padding}px`
    
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
      // x坐标现在由textLayer的left控制，这里设为0
      const x = 0
      
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
      line-height: ${this.lineHeight}px;
      white-space: pre;
      user-select: none;
      display: flex;
      align-items: center;
    `
      
    if (!text || text.length === 0) {
      // 空行也要渲染，占位
      lineDiv.innerHTML = '&nbsp;'
      this.textLayer.appendChild(lineDiv)
      this.renderedLines.set(lineIndex, lineDiv)
      return
    }
      
    // 获取当前行的诊断信息
    const lineDiagnostics = this.diagnostics.filter(d => d.line === lineIndex)
      
    if (!this.enableSyntaxHighlight || !this.lexer || !this.highlighter) {
      // 无语法高亮，直接渲染（但仍然需要添加诊断标记）
      if (lineDiagnostics.length > 0) {
        this.renderLineWithDiagnostics(lineDiv, text, lineDiagnostics)
      } else {
        lineDiv.textContent = text
      }
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
      
    // 按 token 渲染（带诊断标记）
    this.renderTokensWithDiagnostics(lineDiv, tokens, text, lineDiagnostics)
      
    this.textLayer.appendChild(lineDiv)
    this.renderedLines.set(lineIndex, lineDiv)
  }
    
  /**
   * 渲染带诊断标记的纯文本
   */
  renderLineWithDiagnostics(lineDiv, text, diagnostics) {
    if (diagnostics.length === 0) {
      lineDiv.textContent = text
      return
    }
      
    // 按列号排序诊断
    const sortedDiagnostics = [...diagnostics].sort((a, b) => a.column - b.column)
      
    let lastPos = 0
    for (const diagnostic of sortedDiagnostics) {
      const start = diagnostic.column
      const end = start + (diagnostic.length || 1)
        
      // 添加诊断之前的文本
      if (start > lastPos) {
        const span = document.createElement('span')
        span.textContent = text.substring(lastPos, start)
        lineDiv.appendChild(span)
      }
        
      // 添加带波浪线的诊断文本
      const diagnosticSpan = document.createElement('span')
      diagnosticSpan.textContent = text.substring(start, end)
      diagnosticSpan.className = `syntax-${diagnostic.severity}-underline`
      diagnosticSpan.title = diagnostic.message  // 添加悬停提示
      lineDiv.appendChild(diagnosticSpan)
        
      lastPos = end
    }
      
    // 添加剩余文本
    if (lastPos < text.length) {
      const span = document.createElement('span')
      span.textContent = text.substring(lastPos)
      lineDiv.appendChild(span)
    }
  }
    
  /**
   * 渲染带诊断标记的 tokens
   */
  renderTokensWithDiagnostics(lineDiv, tokens, text, diagnostics) {
    // 先按正常方式渲染 tokens
    for (const token of tokens) {
      const style = this.highlighter.getStyle(token.type)
        
      const span = document.createElement('span')
      span.textContent = token.text
      span.style.color = style.color
      span.dataset.tokenStart = token.start
      span.dataset.tokenEnd = token.end
        
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
        
      // 检查是否有诊断覆盖这个 token
      const overlappingDiagnostic = diagnostics.find(d => {
        const dStart = d.column
        const dEnd = d.column + (d.length || 1)
        return (dStart < token.end && dEnd > token.start)
      })
        
      if (overlappingDiagnostic) {
        // 添加波浪线样式
        span.classList.add(`syntax-${overlappingDiagnostic.severity}-underline`)
        span.title = overlappingDiagnostic.message  // 添加悬停提示
      }
        
      lineDiv.appendChild(span)
    }
  }
  
  /**
   * 清除测量缓存（字体变化时调用）
   */
  clearMeasureCache() {
    this.measureCache.clear()
  }
  
  /**
   * 测量文本宽度（带缓存）
   * @param {string} text - 要测量的文本
   * @returns {number} 文本宽度（像素）
   */
  measureText(ctx, text) {
    if (!text || text.length === 0) return 0
    
    // 检查缓存
    const cacheKey = `${this.fontSize}_${text}`
    if (this.measureCache.has(cacheKey)) {
      return this.measureCache.get(cacheKey)
    }
    
    // 实际测量
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
    
    // 存入缓存
    if (this.measureCache.size >= this.maxCacheSize) {
      // LRU: 删除最早的缓存
      const firstKey = this.measureCache.keys().next().value
      this.measureCache.delete(firstKey)
    }
    this.measureCache.set(cacheKey, width)
    
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
