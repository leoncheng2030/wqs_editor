/**
 * Viewport Manager
 * 管理可见区域、滚动、虚拟滚动
 */
export class ViewportManager {
  constructor(options = {}) {
    this.width = options.width || 800
    this.height = options.height || 600
    this.lineHeight = options.lineHeight || 24
    this.padding = options.padding || 16
    
    // 滚动位置
    this.scrollTop = 0
    this.scrollLeft = 0
    
    // 总内容高度
    this.contentHeight = 0
    
    // 文档总行数
    this.totalLines = 0
  }
  
  /**
   * 设置画布尺寸
   */
  setSize(width, height) {
    this.width = width
    this.height = height
  }
  
  /**
   * 设置文档总行数
   */
  setTotalLines(lineCount) {
    this.totalLines = lineCount
    this.contentHeight = lineCount * this.lineHeight + this.padding * 2
  }
  
  /**
   * 获取总高度（别名，与 contentHeight 保持一致）
   */
  get totalHeight() {
    return this.contentHeight
  }
  
  /**
   * 设置滚动位置
   */
  setScrollTop(scrollTop) {
    const maxScroll = Math.max(0, this.contentHeight - this.height)
    this.scrollTop = Math.max(0, Math.min(scrollTop, maxScroll))
  }
  
  /**
   * 获取可见行范围（虚拟滚动）
   */
  getVisibleRange() {
    // 计算第一个可见行
    const startLine = Math.floor(Math.max(0, this.scrollTop) / this.lineHeight)
    
    // 计算最后一个可见行（多渲染1行避免滚动时闪烁）
    const visibleLines = Math.ceil(this.height / this.lineHeight)
    const endLine = Math.min(this.totalLines, startLine + visibleLines + 1)
    
    return {
      startLine,
      endLine
    }
  }
  
  /**
   * 文档坐标 → Canvas 坐标（精确版）
   * @param {number} line - 行号
   * @param {number} column - 列号
   * @param {TextRenderer} textRenderer - 文本渲染器
   * @param {string} lineText - 当前行文本
   * @returns {{x: number, y: number}}
   */
  docToCanvas(line, column = 0, textRenderer = null, lineText = '') {
    let x
    if (textRenderer && lineText && column > 0) {
      // 使用精确测量
      const textX = textRenderer.getColumnX(lineText, column)
      x = this.padding + textX - this.scrollLeft
    } else {
      // 退化方案：使用默认字符宽度
      const charWidth = textRenderer ? textRenderer.charWidth : 8.4
      x = this.padding + column * charWidth - this.scrollLeft
    }
    
    // Y 坐标不需要 padding（padding 只用于 X 方向的偏移）
    const y = line * this.lineHeight - this.scrollTop
    
    return { x, y }
  }
  
  /**
   * Canvas 坐标 → 文档坐标（精确版）
   * @param {number} x - Canvas x 坐标
   * @param {number} y - Canvas y 坐标
   * @param {TextRenderer} textRenderer - 文本渲染器
   * @param {string} lineText - 当前行文本
   * @returns {{line: number, column: number}}
   */
  canvasToDoc(x, y, textRenderer = null, lineText = '') {
    // Y 坐标不需要 padding
    const line = Math.floor((y + this.scrollTop) / this.lineHeight)
    
    let column
    if (textRenderer && lineText) {
      // 使用精确测量
      const textX = x + this.scrollLeft - this.padding
      column = textRenderer.getColumnFromX(lineText, textX)
    } else {
      // 退化方案：使用默认字符宽度
      const charWidth = textRenderer ? textRenderer.charWidth : 8.4
      column = Math.round((x + this.scrollLeft - this.padding) / charWidth)
    }
    
    return {
      line: Math.max(0, Math.min(line, this.totalLines - 1)),
      column: Math.max(0, column)
    }
  }
  
  /**
   * 滚动到指定行
   */
  scrollToLine(line) {
    const targetY = line * this.lineHeight
    this.setScrollTop(targetY - this.height / 2)
  }
  
  /**
   * 确保指定行可见
   */
  ensureLineVisible(line) {
    const lineY = line * this.lineHeight
    const viewportTop = this.scrollTop
    const viewportBottom = this.scrollTop + this.height
    
    if (lineY < viewportTop) {
      // 行在视口上方，滚动到行
      this.setScrollTop(lineY)
    } else if (lineY + this.lineHeight > viewportBottom) {
      // 行在视口下方，滚动到行
      this.setScrollTop(lineY + this.lineHeight - this.height)
    }
  }
}
