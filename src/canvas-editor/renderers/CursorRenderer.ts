/**
 * CursorRenderer - 光标渲染器
 * 负责在 Canvas 上绘制光标并实现闪烁动画
 * 支持独立渲染模式，避免触发全屏重绘
 */

import type { CursorRendererOptions } from '../types'
import type { Cursor } from '../core/Cursor'

interface ViewportManager {
  width: number
  height: number
  docToCanvas(line: number, column: number, textRenderer: TextRenderer, lineText: string): { x: number; y: number }
}

interface TextRenderer {
  fontSize: number
  backgroundColor?: string
}

type BlinkCallback = () => void

export class CursorRenderer {
  private color: string
  private width: number
  private blinkInterval: number
  private visible: boolean
  private blinkTimer: ReturnType<typeof setInterval> | null
  private blinkEnabled: boolean
  private lastInputTime: number
  
  // 独立渲染相关
  private lastCursorX: number = 0
  private lastCursorY: number = 0
  private lastCursorHeight: number = 0
  private ctx: CanvasRenderingContext2D | null = null
  private backgroundColor: string = '#ffffff'

  constructor(options: CursorRendererOptions = {}) {
    this.color = options.color || '#000000'
    this.width = options.width || 2
    this.blinkInterval = options.blinkInterval || 530
    
    this.visible = true
    this.blinkTimer = null
    this.blinkEnabled = true
    this.lastInputTime = 0
  }
  
  /**
   * 设置独立渲染上下文
   */
  setRenderContext(ctx: CanvasRenderingContext2D, backgroundColor: string): void {
    this.ctx = ctx
    this.backgroundColor = backgroundColor
  }
  
  /**
   * 渲染光标
   */
  render(
    ctx: CanvasRenderingContext2D,
    cursor: Cursor,
    viewport: ViewportManager,
    textRenderer: TextRenderer,
    lineText: string,
    lineHeight: number
  ): void {
    if (!this.visible) {
      return
    }
    
    const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer as any, lineText)
    
    if (x < 0 || x > viewport.width || y < 0 || y > viewport.height) {
      return
    }
    
    const cursorHeight = textRenderer.fontSize
    const cursorY = y + (lineHeight - cursorHeight) / 2
    
    // 保存位置用于独立渲染
    this.lastCursorX = x
    this.lastCursorY = cursorY
    this.lastCursorHeight = cursorHeight
    this.ctx = ctx
    this.backgroundColor = textRenderer.backgroundColor || '#ffffff'
    
    ctx.fillStyle = this.color
    ctx.fillRect(x, cursorY, this.width, cursorHeight)
  }
  
  /**
   * 独立渲染光标（不触发全屏重绘）
   * 仅更新光标区域，大幅减少渲染开销
   */
  private renderCursorOnly(): void {
    if (!this.ctx) return
    
    // 计算需要重绘的区域（光标位置 + 一点边距）
    const clearX = Math.max(0, this.lastCursorX - 1)
    const clearY = Math.max(0, this.lastCursorY - 1)
    const clearWidth = this.width + 2
    const clearHeight = this.lastCursorHeight + 2
    
    // 清除旧的光标区域
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(clearX, clearY, clearWidth, clearHeight)
    
    // 如果可见，绘制新的光标
    if (this.visible) {
      this.ctx.fillStyle = this.color
      this.ctx.fillRect(this.lastCursorX, this.lastCursorY, this.width, this.lastCursorHeight)
    }
  }
  
  /**
   * 启动光标闪烁动画
   * @param onBlink 可选回调，仅在需要全屏重绘时调用（如选区变化）
   */
  startBlinking(onBlink?: BlinkCallback): void {
    this.stopBlinking()
    
    if (!this.blinkEnabled) {
      this.visible = true
      return
    }
    
    this.visible = true
    this.blinkTimer = setInterval(() => {
      this.visible = !this.visible
      
      // 如果有独立渲染上下文，使用独立渲染
      if (this.ctx && this.lastCursorHeight > 0) {
        this.renderCursorOnly()
      } else if (onBlink) {
        // 降级到全屏重绘
        onBlink()
      }
    }, this.blinkInterval)
  }
  
  /**
   * 停止光标闪烁动画
   */
  stopBlinking(): void {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer)
      this.blinkTimer = null
    }
  }
  
  /**
   * 重置光标闪烁（用户输入或移动光标时调用）
   */
  resetBlink(onBlink?: BlinkCallback): void {
    this.visible = true
    this.lastInputTime = Date.now()
    
    if (this.blinkEnabled) {
      this.startBlinking(onBlink)
    }
    
    if (onBlink) {
      onBlink()
    }
  }
  
  /**
   * 设置光标颜色
   */
  setColor(color: string): void {
    this.color = color
  }
  
  /**
   * 启用/禁用光标闪烁
   */
  setBlinkEnabled(enabled: boolean, onBlink?: BlinkCallback): void {
    this.blinkEnabled = enabled
    
    if (enabled) {
      this.startBlinking(onBlink)
    } else {
      this.stopBlinking()
      this.visible = true
      if (onBlink) {
        onBlink()
      }
    }
  }
  
  /**
   * 显示光标（立即显示，不触发重绘）
   */
  show(): void {
    this.visible = true
  }
  
  /**
   * 隐藏光标（立即隐藏，不触发重绘）
   */
  hide(): void {
    this.visible = false
  }
  
  /**
   * 清除独立渲染状态
   */
  clearRenderState(): void {
    this.lastCursorX = 0
    this.lastCursorY = 0
    this.lastCursorHeight = 0
  }
  
  /**
   * 销毁光标渲染器
   */
  destroy(): void {
    this.stopBlinking()
    this.ctx = null
  }
}
