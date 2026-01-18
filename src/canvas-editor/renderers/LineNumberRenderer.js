/**
 * LineNumberRenderer - 行号渲染器
 * 负责在 Canvas 左侧渲染行号
 */
export class LineNumberRenderer {
  constructor(options = {}) {
    this.width = options.width || 50
    this.fontSize = options.fontSize || 13
    this.fontFamily = options.fontFamily || 'Consolas, Monaco, "Courier New", monospace'
    this.textColor = options.textColor || '#858585'
    this.backgroundColor = options.backgroundColor || '#f5f5f5'
    this.activeLineColor = options.activeLineColor || '#e8e8e8'
    this.activeTextColor = options.activeTextColor || '#333333'
    this.borderColor = options.borderColor || '#e0e0e0'
    this.padding = options.padding || 8
  }
  
  /**
   * 更新主题颜色
   * @param {string} theme - 'light' 或 'dark'
   */
  updateTheme(theme) {
    if (theme === 'dark') {
      this.textColor = '#858585'
      this.backgroundColor = '#1e1e1e'
      this.activeLineColor = '#2a2a2a'
      this.activeTextColor = '#cccccc'
      this.borderColor = '#3e3e3e'
    } else {
      this.textColor = '#858585'
      this.backgroundColor = '#f5f5f5'
      this.activeLineColor = '#e8e8e8'
      this.activeTextColor = '#333333'
      this.borderColor = '#e0e0e0'
    }
  }
  
  /**
   * 渲染行号
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {ViewportManager} viewport - 视口管理器
   * @param {number} totalLines - 总行数
   * @param {number} currentLine - 当前光标所在行
   * @param {number} lineHeight - 行高
   */
  render(ctx, viewport, totalLines, currentLine, lineHeight) {
    const { startLine, endLine } = viewport.getVisibleRange()
    
    // 渲染背景
    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(0, 0, this.width, viewport.height)
    
    // 渲染右侧边框
    ctx.strokeStyle = this.borderColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(this.width - 0.5, 0)
    ctx.lineTo(this.width - 0.5, viewport.height)
    ctx.stroke()
    
    // 设置文字样式
    ctx.font = `${this.fontSize}px ${this.fontFamily}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'  // 使用 middle 基线与主文本保持一致
    
    // 渲染每一行的行号
    let renderedCount = 0
    for (let lineIndex = startLine; lineIndex < endLine && lineIndex < totalLines; lineIndex++) {
      renderedCount++
      const y = lineIndex * lineHeight - viewport.scrollTop
      
      // 当前行高亮背景
      if (lineIndex === currentLine) {
        ctx.fillStyle = this.activeLineColor
        ctx.fillRect(0, y, this.width, lineHeight)
      }
      
      // 行号文字（垂直居中）
      ctx.fillStyle = lineIndex === currentLine ? this.activeTextColor : this.textColor
      const lineNumber = (lineIndex + 1).toString()
      const textX = this.width - this.padding
      const textY = y + lineHeight / 2  // 行号也垂直居中
      
      ctx.fillText(lineNumber, textX, textY)
    }
  }
  
  /**
   * 计算行号需要的宽度
   * @param {number} totalLines - 总行数
   * @returns {number} 宽度（像素）
   */
  calculateWidth(totalLines) {
    const digits = totalLines.toString().length
    // 每个数字约 8px，加上左右 padding
    return Math.max(50, digits * 8 + this.padding * 2)
  }
}
