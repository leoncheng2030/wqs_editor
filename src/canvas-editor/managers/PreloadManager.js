/**
 * PreloadManager - 预加载管理器
 * 智能预加载即将可见的内容，提升滚动体验
 */
export class PreloadManager {
  constructor(options = {}) {
    // 预加载配置
    this.preloadLines = options.preloadLines || 10  // 预加载行数
    this.preloadThreshold = options.preloadThreshold || 0.3  // 触发阈值（30%）
    
    // 滚动状态
    this.lastScrollTop = 0
    this.scrollDirection = 'down'  // 'up' or 'down'
    this.scrollSpeed = 0
    this.lastScrollTime = 0
    
    // 预加载状态
    this.preloadedRanges = new Set()  // 已预加载的范围
    this.preloadQueue = []  // 预加载队列
    this.isPreloading = false
    
    // 回调
    this.onPreload = options.onPreload  // 预加载回调
    
    // 统计
    this.stats = {
      preloadCount: 0,
      hitCount: 0,
      missCount: 0
    }
  }
  
  /**
   * 更新滚动状态
   * @param {number} scrollTop - 当前滚动位置
   * @param {number} viewportHeight - 视口高度
   * @param {number} totalHeight - 总高度
   */
  updateScroll(scrollTop, viewportHeight, totalHeight) {
    const now = Date.now()
    const timeDelta = now - this.lastScrollTime
    
    // 计算滚动方向
    if (scrollTop > this.lastScrollTop) {
      this.scrollDirection = 'down'
    } else if (scrollTop < this.lastScrollTop) {
      this.scrollDirection = 'up'
    }
    
    // 计算滚动速度（像素/毫秒）
    if (timeDelta > 0) {
      const scrollDelta = Math.abs(scrollTop - this.lastScrollTop)
      this.scrollSpeed = scrollDelta / timeDelta
    }
    
    this.lastScrollTop = scrollTop
    this.lastScrollTime = now
    
    // 检查是否需要预加载
    this.checkPreload(scrollTop, viewportHeight, totalHeight)
  }
  
  /**
   * 检查是否需要预加载
   */
  checkPreload(scrollTop, viewportHeight, totalHeight) {
    const scrollableHeight = totalHeight - viewportHeight
    if (scrollableHeight <= 0) return
    
    // 计算滚动进度
    const scrollProgress = scrollTop / scrollableHeight
    
    // 根据滚动方向判断是否需要预加载
    if (this.scrollDirection === 'down') {
      // 向下滚动，检查是否接近底部
      const distanceToBottom = totalHeight - (scrollTop + viewportHeight)
      const threshold = viewportHeight * this.preloadThreshold
      
      if (distanceToBottom < threshold) {
        this.triggerPreload('down', scrollTop, viewportHeight)
      }
    } else {
      // 向上滚动，检查是否接近顶部
      const distanceToTop = scrollTop
      const threshold = viewportHeight * this.preloadThreshold
      
      if (distanceToTop < threshold) {
        this.triggerPreload('up', scrollTop, viewportHeight)
      }
    }
  }
  
  /**
   * 触发预加载
   * @param {string} direction - 方向 'up' 或 'down'
   * @param {number} scrollTop - 当前滚动位置
   * @param {number} viewportHeight - 视口高度
   */
  triggerPreload(direction, scrollTop, viewportHeight) {
    if (this.isPreloading) return
    
    // 计算预加载范围
    const lineHeight = 26  // 假设行高
    const currentLine = Math.floor(scrollTop / lineHeight)
    const visibleLines = Math.ceil(viewportHeight / lineHeight)
    
    let preloadStartLine, preloadEndLine
    
    if (direction === 'down') {
      // 向下预加载
      preloadStartLine = currentLine + visibleLines
      preloadEndLine = preloadStartLine + this.preloadLines
    } else {
      // 向上预加载
      preloadEndLine = currentLine
      preloadStartLine = Math.max(0, preloadEndLine - this.preloadLines)
    }
    
    // 检查是否已经预加载过
    const rangeKey = `${preloadStartLine}-${preloadEndLine}`
    if (this.preloadedRanges.has(rangeKey)) {
      return
    }
    
    // 执行预加载
    this.performPreload(preloadStartLine, preloadEndLine, rangeKey)
  }
  
  /**
   * 执行预加载
   */
  async performPreload(startLine, endLine, rangeKey) {
    if (!this.onPreload) return
    
    this.isPreloading = true
    
    try {
      // 调用预加载回调
      await this.onPreload({
        startLine,
        endLine,
        direction: this.scrollDirection,
        speed: this.scrollSpeed
      })
      
      // 标记已预加载
      this.preloadedRanges.add(rangeKey)
      this.stats.preloadCount++
      
      // 限制缓存大小
      if (this.preloadedRanges.size > 20) {
        const firstKey = this.preloadedRanges.values().next().value
        this.preloadedRanges.delete(firstKey)
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
  recordHit() {
    this.stats.hitCount++
  }
  
  /**
   * 记录未命中
   */
  recordMiss() {
    this.stats.missCount++
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.hitCount + this.stats.missCount
    const hitRate = total > 0 ? (this.stats.hitCount / total * 100).toFixed(1) : 0
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`
    }
  }
  
  /**
   * 清除预加载缓存
   */
  clear() {
    this.preloadedRanges.clear()
    this.preloadQueue = []
    this.isPreloading = false
  }
  
  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      preloadCount: 0,
      hitCount: 0,
      missCount: 0
    }
  }
  
  /**
   * 销毁
   */
  destroy() {
    this.clear()
    this.onPreload = null
  }
}
