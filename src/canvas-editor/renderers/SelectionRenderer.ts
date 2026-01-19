/**
 * SelectionRenderer - 选区渲染器
 * 负责在 Canvas 上绘制文本选区背景
 */

import type { SelectionRendererOptions } from '../types'
import type { Selection, OrderedRange } from '../core/Selection'
import type { Document } from '../core/Document'

interface ViewportManager {
  width: number
  height: number
  getVisibleRange(): { startLine: number; endLine: number }
  docToCanvas(line: number, column: number, textRenderer: TextRenderer, lineText: string): { x: number; y: number }
}

interface TextRenderer {
  fontSize: number
  getColumnX(text: string, column: number): number
}

export class SelectionRenderer {
  private color: string
  private activeColor: string
  private padding: number

  constructor(options: SelectionRendererOptions = {}) {
    this.color = options.color || 'rgba(100, 150, 255, 0.3)'
    this.activeColor = 'rgba(100, 150, 255, 0.4)'
    this.padding = 0
  }
  
  /**
   * 渲染选区
   */
  render(
    ctx: CanvasRenderingContext2D,
    selection: Selection,
    viewport: ViewportManager,
    document: Document,
    textRenderer: TextRenderer,
    lineHeight: number
  ): void {
    if (!selection.hasSelection) {
      return
    }
    
    const { startLine, startColumn, endLine, endColumn } = selection.getOrderedRange()
    
    const { startLine: visibleStart, endLine: visibleEnd } = viewport.getVisibleRange()
    
    const renderStartLine = Math.max(startLine, visibleStart)
    const renderEndLine = Math.min(endLine, visibleEnd - 1)
    
    if (renderStartLine > renderEndLine) {
      return
    }
    
    ctx.fillStyle = this.color
    
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
   */
  private renderSingleLine(
    ctx: CanvasRenderingContext2D,
    line: number,
    startColumn: number,
    endColumn: number,
    viewport: ViewportManager,
    textRenderer: TextRenderer,
    lineText: string,
    lineHeight: number
  ): void {
    if (startColumn >= endColumn) {
      return
    }
    
    const start = viewport.docToCanvas(line, startColumn, textRenderer as any, lineText)
    
    const startX = textRenderer.getColumnX(lineText, startColumn)
    const endX = textRenderer.getColumnX(lineText, endColumn)
    const width = endX - startX
    
    const selectionHeight = textRenderer.fontSize + 4
    
    const selectionY = start.y + (lineHeight - selectionHeight) / 2
    
    ctx.fillRect(start.x, selectionY, width, selectionHeight)
  }
  
  /**
   * 渲染矩形选区（用于后续可能的列选择模式）
   */
  renderRectangle(
    ctx: CanvasRenderingContext2D,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    viewport: ViewportManager,
    charWidth: number,
    lineHeight: number
  ): void {
    const minLine = Math.min(startLine, endLine)
    const maxLine = Math.max(startLine, endLine)
    const minColumn = Math.min(startColumn, endColumn)
    const maxColumn = Math.max(startColumn, endColumn)
    
    ctx.fillStyle = this.color
    
    for (let line = minLine; line <= maxLine; line++) {
      // Note: This simplified version doesn't use textRenderer for rectangle selection
      const start = viewport.docToCanvas(line, minColumn, null as any, '')
      const width = (maxColumn - minColumn) * charWidth
      ctx.fillRect(start.x, start.y, width, lineHeight)
    }
  }
  
  /**
   * 设置选区颜色
   */
  setColor(color: string): void {
    this.color = color
  }
  
  /**
   * 设置激活状态颜色
   */
  setActiveColor(color: string): void {
    this.activeColor = color
  }
}
