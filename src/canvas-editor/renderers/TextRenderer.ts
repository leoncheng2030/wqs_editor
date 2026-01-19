/**
 * Text Renderer
 * 负责文本渲染，支持语法高亮
 */

import type { TextRendererOptions, Token, ParserContext } from '../types'

interface TextStyle {
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

interface Lexer {
  parseLine(text: string, lineIndex: number, context?: ParserContext): Token[]
  clearDirtyMarks(): void
}

interface Highlighter {
  theme: string
  getStyle(tokenType: string): TextStyle
}

interface ViewportManager {
  width: number
  height: number
  getVisibleRange(): { startLine: number; endLine: number }
  docToCanvas(line: number, column: number, textRenderer: TextRenderer, lineText: string): { x: number; y: number }
}

interface Document {
  getLine(lineIndex: number): string
  getLineCount(): number
}

export class TextRenderer {
  public fontFamily: string
  public fontSize: number
  public lineHeight: number
  public textColor: string
  public backgroundColor: string
  public charWidth: number
  public enableSyntaxHighlight: boolean
  
  private measureCanvas: HTMLCanvasElement | null
  private measureCtx: CanvasRenderingContext2D | null
  private lexer: Lexer | null
  private highlighter: Highlighter | null

  constructor(options: TextRendererOptions = {}) {
    this.fontFamily = options.fontFamily || '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace'
    this.fontSize = options.fontSize || 14
    this.lineHeight = options.lineHeight || 24
    this.textColor = options.textColor || '#333333'
    this.backgroundColor = options.backgroundColor || '#ffffff'
    
    this.charWidth = 8.4
    
    this.measureCanvas = null
    this.measureCtx = null
    
    this.enableSyntaxHighlight = options.enableSyntaxHighlight !== false
    this.lexer = null
    this.highlighter = null
  }
  
  /**
   * 获取测量上下文
   */
  private getMeasureContext(): CanvasRenderingContext2D {
    if (!this.measureCtx) {
      this.measureCanvas = document.createElement('canvas')
      this.measureCtx = this.measureCanvas.getContext('2d')!
    }
    this.measureCtx.font = `${this.fontSize}px ${this.fontFamily}`
    return this.measureCtx
  }
  
  /**
   * 测量文本宽度
   */
  measureText(ctx: CanvasRenderingContext2D | null, text: string): number {
    if (!text || text.length === 0) return 0
    
    if (!ctx) {
      ctx = this.getMeasureContext()
    }
    ctx.font = `${this.fontSize}px ${this.fontFamily}`
    
    return ctx.measureText(text).width
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
    }
  }
  
  /**
   * 初始化 Canvas 上下文
   */
  setupContext(ctx: CanvasRenderingContext2D, style: TextStyle = {}): void {
    const fontWeight = style.bold ? 'bold' : 'normal'
    const fontStyle = style.italic ? 'italic' : 'normal'
    
    ctx.font = `${fontStyle} ${fontWeight} ${this.fontSize}px ${this.fontFamily}`
    ctx.fillStyle = style.color || this.textColor
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = '0px'
    }
    if ('fontKerning' in ctx) {
      (ctx as any).fontKerning = 'normal'
    }
  }
  
  /**
   * 渲染背景
   */
  renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number, startX: number = 0): void {
    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(startX, 0, width - startX, height)
  }
  
  /**
   * 渲染单行文本（支持语法高亮）
   */
  renderLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, lineIndex: number = 0, context: ParserContext = {}): void {
    const textY = Math.round(y + this.lineHeight / 2)
    const textX = Math.round(x)
    
    if (!this.enableSyntaxHighlight || !this.lexer || !this.highlighter) {
      this.setupContext(ctx)
      ctx.fillText(text, textX, textY)
      return
    }
    
    const tokens = this.lexer.parseLine(text, lineIndex, context)
    
    if (tokens.length === 0) {
      return
    }
    
    let currentX = textX
    for (const token of tokens) {
      const style = this.highlighter.getStyle(token.type)
      
      this.setupContext(ctx, style)
      
      ctx.fillText(token.text, Math.round(currentX), textY)
      
      const textWidth = this.measureText(ctx, token.text)
      
      if (style.underline || style.strikethrough) {
        ctx.beginPath()
        
        if (style.underline) {
          const underlineY = Math.round(textY + this.fontSize / 2 + 2)
          ctx.moveTo(Math.round(currentX), underlineY)
          ctx.lineTo(Math.round(currentX + textWidth), underlineY)
        }
        
        if (style.strikethrough) {
          const strikeY = textY
          ctx.moveTo(Math.round(currentX), strikeY)
          ctx.lineTo(Math.round(currentX + textWidth), strikeY)
        }
        
        ctx.strokeStyle = style.color || this.textColor
        ctx.lineWidth = 1
        ctx.stroke()
      }
      
      currentX += textWidth
    }
  }
  
  /**
   * 渲染多行文本（包括背景）
   */
  render(ctx: CanvasRenderingContext2D, document: Document, viewport: ViewportManager): void {
    this.renderBackground(ctx, viewport.width, viewport.height)
    this.renderContent(ctx, document, viewport)
  }
  
  /**
   * 渲染文本内容（不包括背景）
   */
  renderContent(ctx: CanvasRenderingContext2D, document: Document, viewport: ViewportManager): void {
    const { startLine, endLine } = viewport.getVisibleRange()
    
    const context: ParserContext = { inCodeBlock: false }
    
    for (let i = 0; i < startLine && i < document.getLineCount(); i++) {
      const line = document.getLine(i)
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const text = document.getLine(lineIndex)
      const { x, y } = viewport.docToCanvas(lineIndex, 0, this, '')
      
      this.renderLine(ctx, text, x, y, lineIndex, context)
      
      if (text.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
    }
    
    if (this.lexer) {
      this.lexer.clearDirtyMarks()
    }
  }
  
  /**
   * 获取字符宽度（用于坐标转换）
   */
  getCharWidth(): number {
    return this.charWidth
  }
  
  /**
   * 计算文本在某列的 x 坐标（精确版）
   */
  getColumnX(text: string, column: number, ctx: CanvasRenderingContext2D | null = null): number {
    if (column === 0) {
      return 0
    }
    
    if (column >= text.length) {
      return this.measureText(ctx, text)
    }
    
    const textBeforeColumn = text.substring(0, column)
    return this.measureText(ctx, textBeforeColumn)
  }
  
  /**
   * 根据 x 坐标查找对应的列号（精确版）
   */
  getColumnFromX(text: string, x: number, ctx: CanvasRenderingContext2D | null = null): number {
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
      const textWidth = this.measureText(ctx, text.substring(0, mid))
      
      if (textWidth <= x) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    
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
