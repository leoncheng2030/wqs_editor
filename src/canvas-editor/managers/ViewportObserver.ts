/**
 * ViewportObserver - 视口观察器
 * 使用 Intersection Observer 优化可见性检测
 */

export interface ViewportObserverOptions {
  container?: Element | null
  threshold?: number[]
  rootMargin?: string
  onVisibilityChange?: (data: VisibilityChangeData) => void
}

export interface VisibilityChangeData {
  element: Element
  isVisible: boolean
  ratio: number
  data: ElementData
}

export interface ElementData {
  isVisible: boolean
  intersectionRatio: number
  [key: string]: any
}

export class ViewportObserver {
  private container: Element | null
  private threshold: number[]
  private rootMargin: string
  private observedElements: Map<Element, ElementData>
  private onVisibilityChange: ((data: VisibilityChangeData) => void) | undefined
  private observer: IntersectionObserver | null

  constructor(options: ViewportObserverOptions = {}) {
    this.container = options.container || null
    this.threshold = options.threshold || [0, 0.25, 0.5, 0.75, 1.0]
    this.rootMargin = options.rootMargin || '50px'
    this.observedElements = new Map()
    this.onVisibilityChange = options.onVisibilityChange
    this.observer = null
    this.init()
  }
  
  /**
   * 初始化 Observer
   */
  private init(): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('Intersection Observer not supported')
      return
    }
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const elementData = this.observedElements.get(entry.target)
          if (!elementData) return
          
          elementData.isVisible = entry.isIntersecting
          elementData.intersectionRatio = entry.intersectionRatio
          
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
   */
  observe(element: Element, data: Record<string, any> = {}): void {
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
   */
  unobserve(element: Element): void {
    if (!this.observer || !element) return
    
    this.observer.unobserve(element)
    this.observedElements.delete(element)
  }
  
  /**
   * 获取可见元素列表
   */
  getVisibleElements(): Array<{ element: Element; data: ElementData }> {
    const visible: Array<{ element: Element; data: ElementData }> = []
    for (const [element, data] of this.observedElements.entries()) {
      if (data.isVisible) {
        visible.push({ element, data })
      }
    }
    return visible
  }
  
  /**
   * 检查元素是否可见
   */
  isVisible(element: Element): boolean {
    const data = this.observedElements.get(element)
    return data ? data.isVisible : false
  }
  
  /**
   * 清除所有观察
   */
  clear(): void {
    if (!this.observer) return
    
    for (const element of this.observedElements.keys()) {
      this.observer.unobserve(element)
    }
    
    this.observedElements.clear()
  }
  
  /**
   * 销毁观察器
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    this.observedElements.clear()
    this.onVisibilityChange = undefined
  }
}
