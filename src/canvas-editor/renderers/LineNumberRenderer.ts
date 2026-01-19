/**
 * LineNumberRenderer - 行号渲染器
 * 负责在 Canvas 左侧渲染行号
 */

import type { LineNumberRendererOptions, Theme } from '../types'

interface ViewportManager {
  height: number
  scrollTop: number
  getVisibleRange(): { startLine: number; endLine: number }
}

export class LineNumberRenderer {
  public width: number
  private fontSize: number
  private fontFamily: string
  private textColor: string
  private backgroundColor: string
  private activeLineColor: string
  private activeTextColor: string
  private borderColor: string
  private padding: number

  constructor(options: LineNumberRendererOptions = {}) {
    this.width = options.width || 50
    this.fontSize = options.fontSize || 13
    this.fontFamily = 'Consolas, Monaco, "Courier New", monospace'
    this.textColor = options.color || '#858585'
    this.backgroundColor = options.backgroundColor || '#f5f5f5'
    this.activeLineColor = '#e8e8e8'
    this.activeTextColor = '#333333'
    this.borderColor = '#e0e0e0'
    this.padding = options.padding || 8
  }
  
  /**
   * 更新主题颜色
   */
  updateTheme(theme: Theme): void {
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
   */
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    totalLines: number,
    currentLine: number,
    lineHeight: number
  ): void {
    const { startLine, endLine } = viewport.getVisibleRange()
    
    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(0, 0, this.width, viewport.height)
    
    ctx.strokeStyle = this.borderColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(this.width - 0.5, 0)
    ctx.lineTo(this.width - 0.5, viewport.height)
    ctx.stroke()
    
    ctx.font = `${this.fontSize}px ${this.fontFamily}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    
    for (let lineIndex = startLine; lineIndex < endLine && lineIndex < totalLines; lineIndex++) {
      const y = lineIndex * lineHeight - viewport.scrollTop
      
      if (lineIndex === currentLine) {
        ctx.fillStyle = this.activeLineColor
        ctx.fillRect(0, y, this.width, lineHeight)
      }
      
      ctx.fillStyle = lineIndex === currentLine ? this.activeTextColor : this.textColor
      const lineNumber = (lineIndex + 1).toString()
      const textX = this.width - this.padding
      const textY = y + lineHeight / 2
      
      ctx.fillText(lineNumber, textX, textY)
    }
  }
  
  /**
   * 计算行号需要的宽度
   */
  calculateWidth(totalLines: number): number {
    const digits = totalLines.toString().length
    return Math.max(50, digits * 8 + this.padding * 2)
  }
}
