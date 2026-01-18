/**
 * SelectionRenderer - 选区渲染器
 * 负责在 Canvas 上绘制文本选区背景
 */
export class SelectionRenderer {
  constructor(options = {}) {
    this.color = options.color || 'rgba(100, 150, 255, 0.3)'
    this.activeColor = options.activeColor || 'rgba(100, 150, 255, 0.4)'
    this.padding = options.padding || 0
  }
  
  /**
   * 渲染选区
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {Selection} selection - 选区对象
   * @param {ViewportManager} viewport - 视口管理器
   * @param {Document} document - 文档对象
   * @param {TextRenderer} textRenderer - 文本渲染器
   * @param {number} lineHeight - 行高
   */
  render(ctx, selection, viewport, document, textRenderer, lineHeight) {
    if (!selection.hasSelection) {
      return
    }
    
    const { startLine, startColumn, endLine, endColumn } = selection.getOrderedRange()
    
    // 获取可见范围
    const { startLine: visibleStart, endLine: visibleEnd } = viewport.getVisibleRange()
    
    // 只渲染可见范围内的选区
    const renderStartLine = Math.max(startLine, visibleStart)
    const renderEndLine = Math.min(endLine, visibleEnd - 1)
    
    if (renderStartLine > renderEndLine) {
      return
    }
    
    ctx.fillStyle = this.color
    
    // 单行选区
    if (startLine === endLine) {
      const lineText = document.getLine(startLine)
      this.renderSingleLine(
        ctx, 
        startLine, 
        startColumn, 
        endColumn, 
        viewport, 
        textRenderer,
        lineText,
        lineHeight
      )
      return
    }
    
    // 多行选区
    // 第一行（从 startColumn 到行尾）
    if (startLine >= visibleStart && startLine < visibleEnd) {
      const lineText = document.getLine(startLine)
      this.renderSingleLine(
        ctx,
        startLine,
        startColumn,
        lineText.length,
        viewport,
        textRenderer,
        lineText,
        lineHeight
      )
    }
    
    // 中间完整行
    for (let line = Math.max(startLine + 1, visibleStart); line < Math.min(endLine, visibleEnd); line++) {
      const lineText = document.getLine(line)
      this.renderSingleLine(
        ctx,
        line,
        0,
        lineText.length,
        viewport,
        textRenderer,
        lineText,
        lineHeight
      )
    }
    
    // 最后一行（从行首到 endColumn）
    if (endLine >= visibleStart && endLine < visibleEnd) {
      const lineText = document.getLine(endLine)
      this.renderSingleLine(
        ctx,
        endLine,
        0,
        endColumn,
        viewport,
        textRenderer,
        lineText,
        lineHeight
      )
    }
  }
  
  /**
   * 渲染单行选区
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {number} line - 行号
   * @param {number} startColumn - 起始列
   * @param {number} endColumn - 结束列
   * @param {ViewportManager} viewport - 视口管理器
   * @param {TextRenderer} textRenderer - 文本渲染器
   * @param {string} lineText - 当前行文本
   * @param {number} lineHeight - 行高
   */
  renderSingleLine(ctx, line, startColumn, endColumn, viewport, textRenderer, lineText, lineHeight) {
    if (startColumn >= endColumn) {
      return
    }
    
    // 计算起点坐标（使用精确测量）
    const start = viewport.docToCanvas(line, startColumn, textRenderer, lineText)
    
    // 计算选区宽度
    const startX = textRenderer.getColumnX(lineText, startColumn)
    const endX = textRenderer.getColumnX(lineText, endColumn)
    const width = endX - startX
    
    // 计算选区实际高度（比文字稍高一点，上下各+2px）
    const selectionHeight = textRenderer.fontSize + 4
    
    // 计算选区垂直居中位置（在行内居中）
    const selectionY = start.y + (lineHeight - selectionHeight) / 2
    
    // 绘制选区背景
    ctx.fillRect(start.x, selectionY, width, selectionHeight)
  }
  
  /**
   * 渲染矩形选区（用于后续可能的列选择模式）
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {number} startLine - 起始行
   * @param {number} startColumn - 起始列
   * @param {number} endLine - 结束行
   * @param {number} endColumn - 结束列
   * @param {ViewportManager} viewport - 视口管理器
   * @param {number} charWidth - 字符宽度
   * @param {number} lineHeight - 行高
   */
  renderRectangle(ctx, startLine, startColumn, endLine, endColumn, viewport, charWidth, lineHeight) {
    const minLine = Math.min(startLine, endLine)
    const maxLine = Math.max(startLine, endLine)
    const minColumn = Math.min(startColumn, endColumn)
    const maxColumn = Math.max(startColumn, endColumn)
    
    ctx.fillStyle = this.color
    
    for (let line = minLine; line <= maxLine; line++) {
      this.renderSingleLine(
        ctx,
        line,
        minColumn,
        maxColumn,
        viewport,
        charWidth,
        lineHeight
      )
    }
  }
  
  /**
   * 设置选区颜色
   * @param {string} color - CSS 颜色值
   */
  setColor(color) {
    this.color = color
  }
  
  /**
   * 设置激活状态颜色
   * @param {string} color - CSS 颜色值
   */
  setActiveColor(color) {
    this.activeColor = color
  }
}
