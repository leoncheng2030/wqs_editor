/**
 * Input Manager
 * 管理键盘和鼠标输入
 */

export interface InputManagerOptions {
  canvas: HTMLCanvasElement
}

export interface InputEventData {
  data: string
}

export interface MouseEventData {
  x: number
  y: number
  event: MouseEvent
  clickCount?: number
}

type InputEventType = 'input' | 'keydown' | 'click' | 'dblclick' | 'tripleclick' | 'mousedown' | 'mousemove' | 'mouseup'

type InputCallback = (data: any) => void

interface InputCallbacks {
  input: InputCallback[]
  keydown: InputCallback[]
  click: InputCallback[]
  dblclick: InputCallback[]
  tripleclick: InputCallback[]
  mousedown: InputCallback[]
  mousemove: InputCallback[]
  mouseup: InputCallback[]
}

export class InputManager {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private textarea: HTMLTextAreaElement
  private callbacks: InputCallbacks
  private isComposing: boolean
  private clickCount: number
  private lastClickTime: number
  private clickDelay: number
  
  // 保存绑定的事件处理函数引用，便于清理
  private boundHandleMouseMove: (event: MouseEvent) => void
  private boundHandleMouseUp: (event: MouseEvent) => void
  private boundHandleInput: (event: Event) => void
  private boundHandleKeydown: (event: KeyboardEvent) => void
  private boundHandleClick: (event: MouseEvent) => void
  private boundHandleDblClick: (event: MouseEvent) => void
  private boundHandleMouseDown: (event: MouseEvent) => void
  private boundHandleCompositionStart: () => void
  private boundHandleCompositionEnd: (e: CompositionEvent) => void
  private boundHandleBlur: () => void
  private boundHandleFocus: () => void

  constructor(container: HTMLElement, options: InputManagerOptions) {
    this.container = container
    this.canvas = options.canvas
    
    this.textarea = document.createElement('textarea')
    this.textarea.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      z-index: -1;
      overflow: hidden;
      resize: none;
      padding: 0;
      margin: 0;
      border: 0;
    `
    this.textarea.setAttribute('autocomplete', 'off')
    this.textarea.setAttribute('autocorrect', 'off')
    this.textarea.setAttribute('autocapitalize', 'off')
    this.textarea.setAttribute('spellcheck', 'false')
    container.appendChild(this.textarea)
    
    this.callbacks = {
      input: [],
      keydown: [],
      click: [],
      dblclick: [],
      tripleclick: [],
      mousedown: [],
      mousemove: [],
      mouseup: []
    }
    
    this.isComposing = false
    this.clickCount = 0
    this.lastClickTime = 0
    this.clickDelay = 500
    
    // 绑定所有事件处理函数
    this.boundHandleMouseMove = this.handleMouseMove.bind(this)
    this.boundHandleMouseUp = this.handleMouseUp.bind(this)
    this.boundHandleInput = this.handleInput.bind(this)
    this.boundHandleKeydown = this.handleKeydown.bind(this)
    this.boundHandleClick = this.handleClick.bind(this)
    this.boundHandleDblClick = this.handleDblClick.bind(this)
    this.boundHandleMouseDown = this.handleMouseDown.bind(this)
    this.boundHandleCompositionStart = () => { this.isComposing = true }
    this.boundHandleCompositionEnd = (e: CompositionEvent) => {
      this.isComposing = false
      const data = e.data || this.textarea.value
      if (data) {
        this.textarea.value = ''
        this.emit('input', { data })
      }
    }
    this.boundHandleBlur = () => {
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        return
      }
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'BODY') {
          this.focus()
        }
      }, 10)
    }
    this.boundHandleFocus = () => { this.focus() }
    
    this.bindEvents()
    
    setTimeout(() => this.focus(), 0)
  }
  
  /**
   * 绑定事件
   */
  private bindEvents(): void {
    this.textarea.addEventListener('input', this.boundHandleInput)
    this.textarea.addEventListener('keydown', this.boundHandleKeydown)
    this.textarea.addEventListener('compositionstart', this.boundHandleCompositionStart)
    this.textarea.addEventListener('compositionend', this.boundHandleCompositionEnd)
    this.textarea.addEventListener('blur', this.boundHandleBlur)
    
    this.canvas.addEventListener('click', this.boundHandleClick)
    this.canvas.addEventListener('dblclick', this.boundHandleDblClick)
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.addEventListener('mousedown', this.boundHandleFocus)
    
    document.addEventListener('mousemove', this.boundHandleMouseMove)
    document.addEventListener('mouseup', this.boundHandleMouseUp)
  }
  
  /**
   * 聚焦输入
   */
  focus(): void {
    try {
      this.textarea.focus({ preventScroll: true })
    } catch (e) {
      this.textarea.focus()
    }
  }
  
  /**
   * 更新 textarea 位置（让 IME 候选框跟随光标）
   */
  updateTextareaPosition(x: number, y: number): void {
    this.textarea.style.left = `${x}px`
    this.textarea.style.top = `${y}px`
  }
  
  /**
   * 处理输入
   */
  private handleInput(event: Event): void {
    if (this.isComposing) return
    
    const inputEvent = event as InputEvent
    const data = inputEvent.data || this.textarea.value
    
    this.textarea.value = ''
    
    this.emit('input', { data })
  }
  
  /**
   * 处理键盘按下
   */
  private handleKeydown(event: KeyboardEvent): void {
    this.emit('keydown', event)
  }
  
  /**
   * 处理鼠标点击
   */
  private handleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    const now = Date.now()
    if (now - this.lastClickTime < this.clickDelay) {
      this.clickCount++
    } else {
      this.clickCount = 1
    }
    this.lastClickTime = now
    
    if (this.clickCount === 3) {
      this.emit('tripleclick', { x, y, event })
      this.clickCount = 0
      return
    }
    
    this.emit('click', { x, y, event, clickCount: this.clickCount })
  }
  
  /**
   * 处理双击
   */
  private handleDblClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('dblclick', { x, y, event })
  }
  
  /**
   * 处理鼠标按下
   */
  private handleMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('mousedown', { x, y, event })
  }
  
  /**
   * 处理鼠标移动
   */
  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('mousemove', { x, y, event })
  }
  
  /**
   * 处理鼠标释放
   */
  private handleMouseUp(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('mouseup', { x, y, event })
  }
  
  /**
   * 注册事件监听
   */
  on(event: InputEventType, callback: InputCallback): void {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback)
    }
  }
  
  /**
   * 触发事件
   */
  private emit(event: InputEventType, data: any): void {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data))
    }
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    // 清理document级别的事件
    document.removeEventListener('mousemove', this.boundHandleMouseMove)
    document.removeEventListener('mouseup', this.boundHandleMouseUp)
    
    // 清理canvas上的事件
    this.canvas.removeEventListener('click', this.boundHandleClick)
    this.canvas.removeEventListener('dblclick', this.boundHandleDblClick)
    this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.removeEventListener('mousedown', this.boundHandleFocus)
    
    // 清理textarea上的事件
    this.textarea.removeEventListener('input', this.boundHandleInput)
    this.textarea.removeEventListener('keydown', this.boundHandleKeydown)
    this.textarea.removeEventListener('compositionstart', this.boundHandleCompositionStart)
    this.textarea.removeEventListener('compositionend', this.boundHandleCompositionEnd)
    this.textarea.removeEventListener('blur', this.boundHandleBlur)
    
    // 清理所有回调
    this.callbacks = {
      input: [],
      keydown: [],
      click: [],
      dblclick: [],
      tripleclick: [],
      mousedown: [],
      mousemove: [],
      mouseup: []
    }
    
    this.textarea.remove()
  }
}
