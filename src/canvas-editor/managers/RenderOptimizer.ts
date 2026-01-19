/**
 * RenderOptimizer - 渲染优化管理器
 * 负责增量渲染、防抖、离屏Canvas缓存等性能优化
 */

import type { RenderOptimizerOptions, RenderContext, DirtyRegion } from '../types'

type RenderCallback = (context: RenderContext) => void

export class RenderOptimizer {
  private debounceDelay: number
  private renderTimer: ReturnType<typeof setTimeout> | null
  private pendingRender: boolean
  private useRAF: boolean
  private rafId: number | null
  private lastFrameTime: number
  private targetFPS: number
  private frameInterval: number
  private dirtyRegions: DirtyRegion[]
  private fullRenderNeeded: boolean
  private offscreenCanvas: HTMLCanvasElement | null
  private offscreenCtx: CanvasRenderingContext2D | null
  private staticLayerDirty: boolean
  private renderCount: number
  private lastRenderTime: number
  private avgRenderTime: number
  private onRenderCallback: RenderCallback | null

  constructor(options: RenderOptimizerOptions = {}) {
    this.debounceDelay = options.debounceDelay || 16
    this.renderTimer = null
    this.pendingRender = false
    
    this.useRAF = options.useRAF !== false
    this.rafId = null
    this.lastFrameTime = 0
    this.targetFPS = options.targetFPS || 60
    this.frameInterval = 1000 / this.targetFPS
    
    this.dirtyRegions = []
    this.fullRenderNeeded = true
    
    this.offscreenCanvas = null
    this.offscreenCtx = null
    this.staticLayerDirty = true
    
    this.renderCount = 0
    this.lastRenderTime = 0
    this.avgRenderTime = 0
    
    this.onRenderCallback = null
  }
  
  /**
   * 初始化离屏Canvas
   */
  initOffscreenCanvas(width: number, height: number): void {
    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = width
    this.offscreenCanvas.height = height
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')
    this.staticLayerDirty = true
  }
  
  /**
   * 调整离屏Canvas尺寸
   */
  resizeOffscreenCanvas(width: number, height: number): void {
    if (!this.offscreenCanvas || 
        this.offscreenCanvas.width !== width || 
        this.offscreenCanvas.height !== height) {
      this.initOffscreenCanvas(width, height)
    }
  }
  
  /**
   * 标记需要完整重新渲染
   */
  markFullRender(): void {
    this.fullRenderNeeded = true
    this.staticLayerDirty = true
    this.dirtyRegions = []
  }
  
  /**
   * 添加脏区域（用于增量渲染）
   * 使用两阶段合并算法：先插入，后合并相邻区域
   */
  addDirtyRegion(startLine: number, endLine: number): void {
    if (this.fullRenderNeeded) {
      return
    }
    
    const newRegion: DirtyRegion = { startLine, endLine }
    this.dirtyRegions.push(newRegion)
    
    // 合并所有可合并的区域
    this.mergeDirtyRegions()
    
    // 检查是否需要全量渲染：基于覆盖率而非数量
    // 如果脏区域覆盖了70%以上的可见区域，则全量渲染更高效
    if (this.shouldTriggerFullRender()) {
      this.markFullRender()
    }
  }
  
  /**
   * 合并相邻的脏区域
   */
  private mergeDirtyRegions(): void {
    if (this.dirtyRegions.length <= 1) return
    
    // 按起始行排序
    this.dirtyRegions.sort((a, b) => a.startLine - b.startLine)
    
    const merged: DirtyRegion[] = []
    let current = this.dirtyRegions[0]
    
    for (let i = 1; i < this.dirtyRegions.length; i++) {
      const region = this.dirtyRegions[i]
      
      // 如果区域相邻或重叠（允许1行间隙），合并
      if (region.startLine <= current.endLine + 2) {
        current.endLine = Math.max(current.endLine, region.endLine)
      } else {
        merged.push(current)
        current = { ...region }
      }
    }
    merged.push(current)
    
    this.dirtyRegions = merged
  }
  
  /**
   * 判断是否应该触发全量渲染
   * 基于脏区域覆盖率而非简单的数量判断
   */
  private shouldTriggerFullRender(): boolean {
    // 如果区域数量超过15个，无论覆盖率如何都全量渲染
    if (this.dirtyRegions.length > 15) return true
    
    // 计算脏区域总行数
    let totalDirtyLines = 0
    for (const region of this.dirtyRegions) {
      totalDirtyLines += region.endLine - region.startLine + 1
    }
    
    // 估算可见行数（使用默认值，实际应从viewport获取）
    const estimatedVisibleLines = Math.ceil(600 / 26) // height / lineHeight
    
    // 如果脏区域覆盖超过70%的估算可见区域，触发全量渲染
    return totalDirtyLines > estimatedVisibleLines * 0.7
  }
  
  /**
   * 标记静态层需要重绘（如行号、背景）
   */
  markStaticLayerDirty(): void {
    console.log('🟢 markStaticLayerDirty 被调用，设置 staticLayerDirty = true')
    this.staticLayerDirty = true
  }
  
  /**
   * 请求渲染（带防抖和RAF）
   */
  requestRender(renderFn: RenderCallback, immediate: boolean = false): void {
    this.onRenderCallback = renderFn
    
    if (immediate) {
      this.performRender()
      return
    }
    
    if (this.useRAF) {
      if (this.rafId) {
        return
      }
      
      this.rafId = requestAnimationFrame((timestamp) => {
        this.rafId = null
        
        if (timestamp - this.lastFrameTime < this.frameInterval) {
          this.requestRender(renderFn, false)
          return
        }
        
        this.lastFrameTime = timestamp
        this.performRender()
      })
    } else {
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
  private performRender(): void {
    if (!this.onRenderCallback) {
      return
    }
    
    const startTime = performance.now()
    
    this.onRenderCallback({
      fullRender: this.fullRenderNeeded,
      dirtyRegions: [...this.dirtyRegions],
      staticLayerDirty: this.staticLayerDirty,
      offscreenCtx: this.offscreenCtx,
      offscreenCanvas: this.offscreenCanvas
    })

    this.fullRenderNeeded = false
    this.dirtyRegions = []
    this.staticLayerDirty = false
    
    const renderTime = performance.now() - startTime
    this.renderCount++
    this.lastRenderTime = renderTime
    this.avgRenderTime = (this.avgRenderTime * (this.renderCount - 1) + renderTime) / this.renderCount
  }
  
  /**
   * 立即渲染（跳过防抖）
   */
  forceRender(): void {
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
  cancelPendingRender(): void {
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
   */
  getStats(): { renderCount: number; lastRenderTime: string; avgRenderTime: string } {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime.toFixed(2),
      avgRenderTime: this.avgRenderTime.toFixed(2)
    }
  }
  
  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.renderCount = 0
    this.lastRenderTime = 0
    this.avgRenderTime = 0
  }
  
  /**
   * 销毁优化器
   */
  destroy(): void {
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
