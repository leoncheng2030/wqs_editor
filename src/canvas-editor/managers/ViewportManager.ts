/**
 * Viewport Manager
 * 管理可见区域、滚动、虚拟滚动
 */

import type { ViewportOptions, VisibleRange, Position } from '../types'

export interface TextRenderer {
  charWidth: number
  getColumnX(lineText: string, column: number): number
  getColumnFromX(lineText: string, x: number): number
}

export class ViewportManager {
  public width: number
  public height: number
  public lineHeight: number
  public padding: number
  public scrollTop: number
  public scrollLeft: number
  public contentHeight: number
  public totalLines: number

  constructor(options: ViewportOptions = {}) {
    this.width = options.width || 800
    this.height = options.height || 600
    this.lineHeight = options.lineHeight || 24
    this.padding = options.padding || 16
    
    this.scrollTop = 0
    this.scrollLeft = 0
    this.contentHeight = 0
    this.totalLines = 0
  }
  
  /**
   * 设置画布尺寸
   */
  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
  }
  
  /**
   * 设置文档总行数
   */
  setTotalLines(lineCount: number): void {
    this.totalLines = lineCount
    this.contentHeight = lineCount * this.lineHeight + this.padding * 2
  }
  
  /**
   * 获取总高度（别名，与 contentHeight 保持一致）
   */
  get totalHeight(): number {
    return this.contentHeight
  }
  
  /**
   * 设置滚动位置
   */
  setScrollTop(scrollTop: number): void {
    const maxScroll = Math.max(0, this.contentHeight - this.height)
    this.scrollTop = Math.max(0, Math.min(scrollTop, maxScroll))
  }
  
  /**
   * 获取可见行范围（虚拟滚动）
   */
  getVisibleRange(bufferLines: number = 2): VisibleRange {
    const startLine = Math.max(0, Math.floor(this.scrollTop / this.lineHeight) - bufferLines)
    const visibleLines = Math.ceil(this.height / this.lineHeight)
    const endLine = Math.min(this.totalLines, startLine + visibleLines + bufferLines * 2 + 1)
    
    return {
      startLine,
      endLine
    }
  }
  
  /**
   * 文档坐标 → Canvas 坐标（精确版）
   */
  docToCanvas(line: number, column: number = 0, textRenderer: TextRenderer | null = null, lineText: string = ''): { x: number; y: number } {
    let x: number
    if (textRenderer && lineText && column > 0) {
      const textX = textRenderer.getColumnX(lineText, column)
      x = this.padding + textX - this.scrollLeft
    } else {
      const charWidth = textRenderer ? textRenderer.charWidth : 8.4
      x = this.padding + column * charWidth - this.scrollLeft
    }
    
    const y = line * this.lineHeight - this.scrollTop
    
    return { x, y }
  }
  
  /**
   * Canvas 坐标 → 文档坐标（精确版）
   */
  canvasToDoc(x: number, y: number, textRenderer: TextRenderer | null = null, lineText: string = ''): Position {
    const line = Math.floor((y + this.scrollTop) / this.lineHeight)
    
    let column: number
    if (textRenderer && lineText) {
      const textX = x + this.scrollLeft - this.padding
      column = textRenderer.getColumnFromX(lineText, textX)
    } else {
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
  scrollToLine(line: number): void {
    const targetY = line * this.lineHeight
    this.setScrollTop(targetY - this.height / 2)
  }
  
  /**
   * 确保指定行可见
   */
  ensureLineVisible(line: number): void {
    const lineY = line * this.lineHeight
    const viewportTop = this.scrollTop
    const viewportBottom = this.scrollTop + this.height
    
    if (lineY < viewportTop) {
      this.setScrollTop(lineY)
    } else if (lineY + this.lineHeight > viewportBottom) {
      this.setScrollTop(lineY + this.lineHeight - this.height)
    }
  }
}
