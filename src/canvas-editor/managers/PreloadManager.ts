/**
 * PreloadManager - 预加载管理器
 * 智能预加载即将可见的内容，提升滚动体验
 */

import type { PreloadOptions, PreloadData } from '../types'

type ScrollDirection = 'up' | 'down'

interface PreloadStats {
  preloadCount: number
  hitCount: number
  missCount: number
}

export class PreloadManager {
  private preloadLines: number
  private preloadThreshold: number
  private lastScrollTop: number
  private scrollDirection: ScrollDirection
  private scrollSpeed: number
  private lastScrollTime: number
  private preloadedRanges: Set<string>
  private preloadQueue: number[]
  private isPreloading: boolean
  private onPreload: ((data: PreloadData) => void | Promise<void>) | undefined
  private stats: PreloadStats

  constructor(options: PreloadOptions = {}) {
    this.preloadLines = options.preloadLines || 10
    this.preloadThreshold = options.preloadThreshold || 0.3
    
    this.lastScrollTop = 0
    this.scrollDirection = 'down'
    this.scrollSpeed = 0
    this.lastScrollTime = 0
    
    this.preloadedRanges = new Set()
    this.preloadQueue = []
    this.isPreloading = false
    
    this.onPreload = options.onPreload
    
    this.stats = {
      preloadCount: 0,
      hitCount: 0,
      missCount: 0
    }
  }
  
  /**
   * 更新滚动状态
   */
  updateScroll(scrollTop: number, viewportHeight: number, totalHeight: number): void {
    const now = Date.now()
    const timeDelta = now - this.lastScrollTime
    
    if (scrollTop > this.lastScrollTop) {
      this.scrollDirection = 'down'
    } else if (scrollTop < this.lastScrollTop) {
      this.scrollDirection = 'up'
    }
    
    if (timeDelta > 0) {
      const scrollDelta = Math.abs(scrollTop - this.lastScrollTop)
      this.scrollSpeed = scrollDelta / timeDelta
    }
    
    this.lastScrollTop = scrollTop
    this.lastScrollTime = now
    
    this.checkPreload(scrollTop, viewportHeight, totalHeight)
  }
  
  /**
   * 检查是否需要预加载
   */
  private checkPreload(scrollTop: number, viewportHeight: number, totalHeight: number): void {
    const scrollableHeight = totalHeight - viewportHeight
    if (scrollableHeight <= 0) return
    
    if (this.scrollDirection === 'down') {
      const distanceToBottom = totalHeight - (scrollTop + viewportHeight)
      const threshold = viewportHeight * this.preloadThreshold
      
      if (distanceToBottom < threshold) {
        this.triggerPreload('down', scrollTop, viewportHeight)
      }
    } else {
      const distanceToTop = scrollTop
      const threshold = viewportHeight * this.preloadThreshold
      
      if (distanceToTop < threshold) {
        this.triggerPreload('up', scrollTop, viewportHeight)
      }
    }
  }
  
  /**
   * 触发预加载
   */
  private triggerPreload(direction: ScrollDirection, scrollTop: number, viewportHeight: number): void {
    if (this.isPreloading) return
    
    const lineHeight = 26
    const currentLine = Math.floor(scrollTop / lineHeight)
    const visibleLines = Math.ceil(viewportHeight / lineHeight)
    
    let preloadStartLine: number
    let preloadEndLine: number
    
    if (direction === 'down') {
      preloadStartLine = currentLine + visibleLines
      preloadEndLine = preloadStartLine + this.preloadLines
    } else {
      preloadEndLine = currentLine
      preloadStartLine = Math.max(0, preloadEndLine - this.preloadLines)
    }
    
    const rangeKey = `${preloadStartLine}-${preloadEndLine}`
    if (this.preloadedRanges.has(rangeKey)) {
      return
    }
    
    this.performPreload(preloadStartLine, preloadEndLine, rangeKey)
  }
  
  /**
   * 执行预加载
   */
  private async performPreload(startLine: number, endLine: number, rangeKey: string): Promise<void> {
    if (!this.onPreload) return
    
    this.isPreloading = true
    
    try {
      await this.onPreload({
        startLine,
        endLine,
        direction: this.scrollDirection,
        speed: this.scrollSpeed
      })
      
      this.preloadedRanges.add(rangeKey)
      this.stats.preloadCount++
      
      if (this.preloadedRanges.size > 20) {
        const firstKey = this.preloadedRanges.values().next().value
        if (firstKey) {
          this.preloadedRanges.delete(firstKey)
        }
      }
    } catch (error) {
      console.error('Preload failed:', error)
    } finally {
      this.isPreloading = false
    }
  }
  
  /**
   * 记录命中
   */
  recordHit(): void {
    this.stats.hitCount++
  }
  
  /**
   * 记录未命中
   */
  recordMiss(): void {
    this.stats.missCount++
  }
  
  /**
   * 获取统计信息
   */
  getStats(): PreloadStats & { hitRate: string } {
    const total = this.stats.hitCount + this.stats.missCount
    const hitRate = total > 0 ? (this.stats.hitCount / total * 100).toFixed(1) : '0'
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`
    }
  }
  
  /**
   * 清除预加载缓存
   */
  clear(): void {
    this.preloadedRanges.clear()
    this.preloadQueue = []
    this.isPreloading = false
  }
  
  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      preloadCount: 0,
      hitCount: 0,
      missCount: 0
    }
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.clear()
    this.onPreload = undefined
  }
}
