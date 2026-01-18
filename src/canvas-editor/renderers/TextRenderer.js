/**
 * Text Renderer
 * 负责文本渲染，支持语法高亮
 */
export class TextRenderer {
  constructor(options = {}) {
    // 使用更好的等宽字体，优先选择 SF Mono（macOS）和 JetBrains Mono
    this.fontFamily = options.fontFamily || '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace'
    this.fontSize = options.fontSize || 14
    this.lineHeight = options.lineHeight || 24
    this.textColor = options.textColor || '#333333'
    this.backgroundColor = options.backgroundColor || '#ffffff'
    
    // 字符宽度（等宽字体，仅用于初始估计）
    this.charWidth = 8.4
    
    // 缓存 Canvas 上下文用于文本测量
    this.measureCanvas = null
    this.measureCtx = null
    
    // 语法高亮相关
    this.enableSyntaxHighlight = options.enableSyntaxHighlight !== false
    this.lexer = null
    this.highlighter = null
  }
  
  /**
   * 获取测量上下文
   */
  getMeasureContext() {
    if (!this.measureCtx) {
      this.measureCanvas = document.createElement('canvas')
      this.measureCtx = this.measureCanvas.getContext('2d')
    }
    this.measureCtx.font = `${this.fontSize}px ${this.fontFamily}`
    return this.measureCtx
  }
  
  /**
   * 测量文本宽度
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文（可选）
   * @param {string} text - 要测量的文本
   * @returns {number} 文本宽度（像素）
   */
  measureText(ctx, text) {
    if (!text || text.length === 0) return 0
    
    if (!ctx) {
      ctx = this.getMeasureContext()
    }
    ctx.font = `${this.fontSize}px ${this.fontFamily}`
    
    // 使用 Canvas 原生测量，这对 emoji 有较好的支持
    return ctx.measureText(text).width
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
    }
  }
  
  /**
   * 初始化 Canvas 上下文
   */
  setupContext(ctx, style = {}) {
    // 设置字体，添加 font-feature-settings 优化
    const fontWeight = style.bold ? 'bold' : 'normal'
    const fontStyle = style.italic ? 'italic' : 'normal'
    
    // 使用更精确的字体尺寸（浮点数）
    ctx.font = `${fontStyle} ${fontWeight} ${this.fontSize}px ${this.fontFamily}`
    ctx.fillStyle = style.color || this.textColor
    ctx.textBaseline = 'middle'  // 使用 middle 基线让文本垂直居中
    ctx.textAlign = 'left'  // 强制设置为左对齐，避免被行号渲染器影响
    
    // 字体渲染优化（部分浏览器支持）
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '0px'
    }
    if ('fontKerning' in ctx) {
      ctx.fontKerning = 'normal'
    }
  }
  
  /**
   * 渲染背景
   */
  renderBackground(ctx, width, height, startX = 0) {
    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(startX, 0, width - startX, height)
  }
  
  /**
   * 渲染单行文本（支持语法高亮）
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text - 文本内容
   * @param {number} x - x 坐标
   * @param {number} y - y 坐标（行顶部）
   * @param {number} lineIndex - 行号
   * @param {Object} context - 上下文（代码块状态等）
   */
  renderLine(ctx, text, x, y, lineIndex = 0, context = {}) {
    // 计算文本垂直居中位置（y是行顶部，需要加上半个行高）
    // 关键：四舍五入到整数像素，避免子像素模糊
    const textY = Math.round(y + this.lineHeight / 2)
    const textX = Math.round(x)
    
    if (!this.enableSyntaxHighlight || !this.lexer || !this.highlighter) {
      // 无语法高亮，直接渲染
      this.setupContext(ctx)
      ctx.fillText(text, textX, textY)
      return
    }
    
    // 解析语法
    const tokens = this.lexer.parseLine(text, lineIndex, context)
    
    if (tokens.length === 0) {
      // 空行
      return
    }
    
    // 按 token 渲染
    let currentX = textX
    for (const token of tokens) {
      const style = this.highlighter.getStyle(token.type)
      
      // 设置样式（必须在渲染和测量之前）
      this.setupContext(ctx, style)
      
      // 渲染文本（确保在整数像素位置）
      ctx.fillText(token.text, Math.round(currentX), textY)
      
      // 测量实际渲染的文本宽度（必须在设置样式后，使用相同的样式）
      const textWidth = this.measureText(ctx, token.text)
      
      // 添加装饰（下划线、删除线）
      if (style.underline || style.strikethrough) {
        ctx.beginPath()
        
        if (style.underline) {
          const underlineY = Math.round(textY + this.fontSize / 2 + 2)  // 在文本下方
          ctx.moveTo(Math.round(currentX), underlineY)
          ctx.lineTo(Math.round(currentX + textWidth), underlineY)
        }
        
        if (style.strikethrough) {
          const strikeY = textY  // 在文本中间（因为textBaseline是middle）
          ctx.moveTo(Math.round(currentX), strikeY)
          ctx.lineTo(Math.round(currentX + textWidth), strikeY)
        }
        
        ctx.strokeStyle = style.color
        ctx.lineWidth = 1
        ctx.stroke()
      }
      
      // 移动 x 坐标
      currentX += textWidth
    }
  }
  
  /**
   * 渲染多行文本（包括背景）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Document} document - 文档对象
   * @param {ViewportManager} viewport - 视口管理器
   */
  render(ctx, document, viewport) {
    // 渲染背景
    this.renderBackground(ctx, viewport.width, viewport.height)
    
    // 渲染内容
    this.renderContent(ctx, document, viewport)
  }
  
  /**
   * 渲染文本内容（不包括背景）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Document} document - 文档对象
   * @param {ViewportManager} viewport - 视口管理器
   */
  renderContent(ctx, document, viewport) {
    // 获取可见行范围
    const { startLine, endLine } = viewport.getVisibleRange()
    
    // 代码块上下文
    const context = { inCodeBlock: false }
    
    // 检查从文档开始到可见范围的代码块状态
    for (let i = 0; i < startLine && i < document.getLineCount(); i++) {
      const line = document.getLine(i)
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    // 渲染每一行
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const text = document.getLine(lineIndex)
      const { x, y } = viewport.docToCanvas(lineIndex, 0, this, '')
      
      this.renderLine(ctx, text, x, y, lineIndex, context)
      
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
   * 获取字符宽度（用于坐标转换）
   */
  getCharWidth() {
    return this.charWidth
  }
  
  /**
   * 计算文本在某列的 x 坐标（精确版）
   * @param {string} text - 完整行文本
   * @param {number} column - 列号（0-based）
   * @param {CanvasRenderingContext2D} ctx - 可选的上下文
   * @returns {number} x 坐标
   */
  getColumnX(text, column, ctx = null) {
    if (column === 0) {
      return 0
    }
    
    if (column >= text.length) {
      // 测量整行文本宽度
      return this.measureText(ctx, text)
    }
    
    // 测量从行首到指定列的文本宽度
    const textBeforeColumn = text.substring(0, column)
    return this.measureText(ctx, textBeforeColumn)
  }
  
  /**
   * 根据 x 坐标查找对应的列号（精确版）
   * @param {string} text - 完整行文本
   * @param {number} x - x 坐标
   * @param {CanvasRenderingContext2D} ctx - 可选的上下文
   * @returns {number} 列号
   */
  getColumnFromX(text, x, ctx = null) {
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
      const textWidth = this.measureText(ctx, text.substring(0, mid))
      
      if (textWidth <= x) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    
    // 检查是否更接近下一个字符
    if (left < text.length) {
      const currentWidth = this.measureText(ctx, text.substring(0, left))
      const nextWidth = this.measureText(ctx, text.substring(0, left + 1))
      const currentDist = Math.abs(x - currentWidth)
      const nextDist = Math.abs(x - nextWidth)
      
      if (nextDist < currentDist) {
        return left + 1
      }
    }
    
    return left
  }
}
