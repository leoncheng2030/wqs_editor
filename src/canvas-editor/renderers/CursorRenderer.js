/**
 * CursorRenderer - 光标渲染器
 * 负责在 Canvas 上绘制光标并实现闪烁动画
 */
export class CursorRenderer {
  constructor(options = {}) {
    this.color = options.color || '#000000'
    this.width = options.width || 2
    this.blinkInterval = options.blinkInterval || 530 // 标准光标闪烁间隔
    
    // 光标可见状态
    this.visible = true
    
    // 闪烁定时器
    this.blinkTimer = null
    
    // 是否启用闪烁
    this.blinkEnabled = true
    
    // 上次输入时间（用于重置闪烁）
    this.lastInputTime = 0
  }
  
  /**
   * 渲染光标
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {Cursor} cursor - 光标对象
   * @param {ViewportManager} viewport - 视口管理器
   * @param {TextRenderer} textRenderer - 文本渲染器
   * @param {string} lineText - 当前行文本
   * @param {number} lineHeight - 行高
   */
  render(ctx, cursor, viewport, textRenderer, lineText, lineHeight) {
    if (!this.visible) {
      return
    }
    
    // 将文档坐标转换为 Canvas 坐标（使用精确测量）
    const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer, lineText)
    
    // 检查光标是否在可见区域内
    if (x < 0 || x > viewport.width || y < 0 || y > viewport.height) {
      return
    }
    
    // 计算光标实际高度（使用fontSize，不是lineHeight）
    const cursorHeight = textRenderer.fontSize
    
    // 计算光标垂直居中位置（在行内居中）
    const cursorY = y + (lineHeight - cursorHeight) / 2
    
    // 绘制光标（竖线）
    ctx.fillStyle = this.color
    ctx.fillRect(x, cursorY, this.width, cursorHeight)
  }
  
  /**
   * 启动光标闪烁动画
   * @param {Function} onBlink - 闪烁回调函数（用于重绘）
   */
  startBlinking(onBlink) {
    this.stopBlinking()
    
    if (!this.blinkEnabled) {
      this.visible = true
      return
    }
    
    this.visible = true
    this.blinkTimer = setInterval(() => {
      this.visible = !this.visible
      if (onBlink) {
        onBlink()
      }
    }, this.blinkInterval)
  }
  
  /**
   * 停止光标闪烁动画
   */
  stopBlinking() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer)
      this.blinkTimer = null
    }
  }
  
  /**
   * 重置光标闪烁（用户输入或移动光标时调用）
   * @param {Function} onBlink - 闪烁回调函数
   */
  resetBlink(onBlink) {
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
   * @param {string} color - CSS 颜色值
   */
  setColor(color) {
    this.color = color
  }
  
  /**
   * 启用/禁用光标闪烁
   * @param {boolean} enabled - 是否启用
   * @param {Function} onBlink - 闪烁回调函数
   */
  setBlinkEnabled(enabled, onBlink) {
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
  show() {
    this.visible = true
  }
  
  /**
   * 隐藏光标（立即隐藏，不触发重绘）
   */
  hide() {
    this.visible = false
  }
  
  /**
   * 销毁光标渲染器
   */
  destroy() {
    this.stopBlinking()
  }
}
