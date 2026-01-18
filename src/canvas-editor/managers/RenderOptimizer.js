/**
 * RenderOptimizer - 渲染优化管理器
 * 负责增量渲染、防抖、离屏Canvas缓存等性能优化
 */
export class RenderOptimizer {
  constructor(options = {}) {
    // 防抖配置
    this.debounceDelay = options.debounceDelay || 16 // 约60fps
    this.renderTimer = null
    this.pendingRender = false
    
    // RAF控制
    this.useRAF = options.useRAF !== false  // 默认启用RAF
    this.rafId = null
    this.lastFrameTime = 0
    this.targetFPS = options.targetFPS || 60
    this.frameInterval = 1000 / this.targetFPS
    
    // 脏区域追踪（用于增量渲染）
    this.dirtyRegions = []
    this.fullRenderNeeded = true
    
    // 离屏Canvas缓存
    this.offscreenCanvas = null
    this.offscreenCtx = null
    this.staticLayerDirty = true
    
    // 性能统计
    this.renderCount = 0
    this.lastRenderTime = 0
    this.avgRenderTime = 0
    
    // 渲染回调
    this.onRenderCallback = null
  }
  
  /**
   * 初始化离屏Canvas
   * @param {number} width - Canvas宽度
   * @param {number} height - Canvas高度
   */
  initOffscreenCanvas(width, height) {
    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = width
    this.offscreenCanvas.height = height
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')
    this.staticLayerDirty = true
  }
  
  /**
   * 调整离屏Canvas尺寸
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resizeOffscreenCanvas(width, height) {
    if (!this.offscreenCanvas || 
        this.offscreenCanvas.width !== width || 
        this.offscreenCanvas.height !== height) {
      this.initOffscreenCanvas(width, height)
    }
  }
  
  /**
   * 标记需要完整重新渲染
   */
  markFullRender() {
    this.fullRenderNeeded = true
    this.staticLayerDirty = true
    this.dirtyRegions = []
  }
  
  /**
   * 添加脏区域（用于增量渲染）
   * @param {number} startLine - 起始行
   * @param {number} endLine - 结束行
   */
  addDirtyRegion(startLine, endLine) {
    // 如果已经是完整渲染，不需要追踪脏区域
    if (this.fullRenderNeeded) {
      return
    }
    
    // 合并重叠的脏区域
    const newRegion = { startLine, endLine }
    let merged = false
    
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      const region = this.dirtyRegions[i]
      
      // 检查是否重叠或相邻
      if (startLine <= region.endLine + 1 && endLine >= region.startLine - 1) {
        region.startLine = Math.min(region.startLine, startLine)
        region.endLine = Math.max(region.endLine, endLine)
        merged = true
        break
      }
    }
    
    if (!merged) {
      this.dirtyRegions.push(newRegion)
    }
    
    // 如果脏区域太多，转为完整渲染
    if (this.dirtyRegions.length > 10) {
      this.markFullRender()
    }
  }
  
  /**
   * 标记静态层需要重绘（如行号、背景）
   */
  markStaticLayerDirty() {
    console.log('🟢 markStaticLayerDirty 被调用，设置 staticLayerDirty = true')
    this.staticLayerDirty = true
  }
  
  /**
   * 请求渲染（带防抖和RAF）
   * @param {Function} renderFn - 实际渲染函数
   * @param {boolean} immediate - 是否立即渲染（跳过防抖）
   */
  requestRender(renderFn, immediate = false) {
    this.onRenderCallback = renderFn
    
    if (immediate) {
      this.performRender()
      return
    }
    
    if (this.useRAF) {
      // 使用RAF + 防抖
      if (this.rafId) {
        return  // 已有待处理的RAF
      }
      
      this.rafId = requestAnimationFrame((timestamp) => {
        this.rafId = null
        
        // 帧率控制
        if (timestamp - this.lastFrameTime < this.frameInterval) {
          // 帧率过高，跳过此帧
          this.requestRender(renderFn, false)
          return
        }
        
        this.lastFrameTime = timestamp
        this.performRender()
      })
    } else {
      // 使用setTimeout防抖
      if (this.renderTimer) {
        clearTimeout(this.renderTimer)
      }
      
      this.renderTimer = setTimeout(() => {
        this.performRender()
      }, this.debounceDelay)
    }
  }
  
  /**
   * 执行渲染
   */
  performRender() {
    if (!this.onRenderCallback) {
      return
    }
    
    console.log('🔵 performRender 开始:', {
      staticLayerDirty: this.staticLayerDirty,
      fullRenderNeeded: this.fullRenderNeeded
    })
    
    const startTime = performance.now()
    
    // 调用实际渲染函数
    this.onRenderCallback({
      fullRender: this.fullRenderNeeded,
      dirtyRegions: [...this.dirtyRegions],
      staticLayerDirty: this.staticLayerDirty,
      offscreenCtx: this.offscreenCtx,
      offscreenCanvas: this.offscreenCanvas
    })
    
    // 清除脏标记
    console.log('🔴 清除脏标记: staticLayerDirty = false')
    this.fullRenderNeeded = false
    this.dirtyRegions = []
    this.staticLayerDirty = false
    
    // 性能统计
    const renderTime = performance.now() - startTime
    this.renderCount++
    this.lastRenderTime = renderTime
    this.avgRenderTime = (this.avgRenderTime * (this.renderCount - 1) + renderTime) / this.renderCount
  }
  
  /**
   * 立即渲染（跳过防抖）
   */
  forceRender() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
      this.renderTimer = null
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.performRender()
  }
  
  /**
   * 取消待处理的渲染
   */
  cancelPendingRender() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
      this.renderTimer = null
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
  
  /**
   * 获取性能统计
   * @returns {{renderCount: number, lastRenderTime: number, avgRenderTime: number}}
   */
  getStats() {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime.toFixed(2),
      avgRenderTime: this.avgRenderTime.toFixed(2)
    }
  }
  
  /**
   * 重置性能统计
   */
  resetStats() {
    this.renderCount = 0
    this.lastRenderTime = 0
    this.avgRenderTime = 0
  }
  
  /**
   * 销毁优化器
   */
  destroy() {
    this.cancelPendingRender()
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.offscreenCanvas = null
    this.offscreenCtx = null
    this.dirtyRegions = []
    this.onRenderCallback = null
  }
}
