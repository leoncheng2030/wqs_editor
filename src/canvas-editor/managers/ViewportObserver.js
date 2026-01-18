/**
 * ViewportObserver - 视口观察器
 * 使用 Intersection Observer 优化可见性检测
 */
export class ViewportObserver {
  constructor(options = {}) {
    this.container = options.container
    this.threshold = options.threshold || [0, 0.25, 0.5, 0.75, 1.0]
    this.rootMargin = options.rootMargin || '50px'  // 提前加载边距
    
    // 观察的元素集合
    this.observedElements = new Map()
    
    // 可见性回调
    this.onVisibilityChange = options.onVisibilityChange
    
    // 创建 Intersection Observer
    this.observer = null
    this.init()
  }
  
  /**
   * 初始化 Observer
   */
  init() {
    if (!('IntersectionObserver' in window)) {
      console.warn('Intersection Observer not supported')
      return
    }
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const elementData = this.observedElements.get(entry.target)
          if (!elementData) return
          
          // 更新可见性状态
          elementData.isVisible = entry.isIntersecting
          elementData.intersectionRatio = entry.intersectionRatio
          
          // 触发回调
          if (this.onVisibilityChange) {
            this.onVisibilityChange({
              element: entry.target,
              isVisible: entry.isIntersecting,
              ratio: entry.intersectionRatio,
              data: elementData
            })
          }
        })
      },
      {
        root: this.container,
        rootMargin: this.rootMargin,
        threshold: this.threshold
      }
    )
  }
  
  /**
   * 观察元素
   * @param {HTMLElement} element - 要观察的元素
   * @param {Object} data - 关联数据（如行号）
   */
  observe(element, data = {}) {
    if (!this.observer || !element) return
    
    this.observedElements.set(element, {
      ...data,
      isVisible: false,
      intersectionRatio: 0
    })
    
    this.observer.observe(element)
  }
  
  /**
   * 停止观察元素
   * @param {HTMLElement} element - 要停止观察的元素
   */
  unobserve(element) {
    if (!this.observer || !element) return
    
    this.observer.unobserve(element)
    this.observedElements.delete(element)
  }
  
  /**
   * 获取可见元素列表
   * @returns {Array} 可见元素数组
   */
  getVisibleElements() {
    const visible = []
    for (const [element, data] of this.observedElements.entries()) {
      if (data.isVisible) {
        visible.push({ element, data })
      }
    }
    return visible
  }
  
  /**
   * 检查元素是否可见
   * @param {HTMLElement} element - 要检查的元素
   * @returns {boolean}
   */
  isVisible(element) {
    const data = this.observedElements.get(element)
    return data ? data.isVisible : false
  }
  
  /**
   * 清除所有观察
   */
  clear() {
    if (!this.observer) return
    
    for (const element of this.observedElements.keys()) {
      this.observer.unobserve(element)
    }
    
    this.observedElements.clear()
  }
  
  /**
   * 销毁观察器
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    this.observedElements.clear()
    this.onVisibilityChange = null
  }
}
