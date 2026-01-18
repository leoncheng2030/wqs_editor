/**
 * Input Manager
 * 管理键盘和鼠标输入
 */
export class InputManager {
  constructor(container, options = {}) {
    this.container = container
    this.canvas = options.canvas
    
    // 创建隐藏的 textarea 用于捕获输入
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
    
    // 事件回调
    this.callbacks = {
      input: [],
      keydown: [],
      click: [],
      dblclick: [],
      mousedown: [],
      mousemove: [],
      mouseup: []
    }
    
    // 输入法状态
    this.isComposing = false
    
    // 点击检测
    this.clickCount = 0
    this.lastClickTime = 0
    this.clickDelay = 500 // 多击检测延迟
    
    this.bindEvents()
    
    // 初始聚焦
    setTimeout(() => this.focus(), 0)
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 键盘事件
    this.textarea.addEventListener('input', this.handleInput.bind(this))
    this.textarea.addEventListener('keydown', this.handleKeydown.bind(this))
    this.textarea.addEventListener('compositionstart', (e) => {
      this.isComposing = true
    })
    this.textarea.addEventListener('compositionend', (e) => {
      this.isComposing = false
      // 输入法结束后，主动处理最终的文本
      const data = e.data || this.textarea.value
      if (data) {
        this.textarea.value = ''
        this.emit('input', { data })
      }
    })
    
    // 阻止 textarea 失去焦点（仅当需要时）
    this.textarea.addEventListener('blur', (e) => {
      // 如果是用户主动点击其他元素，不重新聚焦
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        return
      }
      // 延迟重新聚焦
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'BODY') {
          this.focus()
        }
      }, 10)
    })
    
    // 鼠标事件
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('dblclick', this.handleDblClick.bind(this))
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    
    // 全局监听 mousemove 和 mouseup，支持拖拽移出 Canvas 区域
    document.addEventListener('mousemove', this.handleMouseMove.bind(this))
    document.addEventListener('mouseup', this.handleMouseUp.bind(this))
    
    // Canvas 点击时聚焦 textarea
    this.canvas.addEventListener('mousedown', (e) => {
      this.focus()
    })
  }
  
  /**
   * 聚焦输入
   */
  focus() {
    try {
      this.textarea.focus({ preventScroll: true })
    } catch (e) {
      // 降级方案
      this.textarea.focus()
    }
  }
  
  /**
   * 更新 textarea 位置（让 IME 候选框跟随光标）
   * @param {number} x - 光标 x 坐标
   * @param {number} y - 光标 y 坐标
   */
  updateTextareaPosition(x, y) {
    this.textarea.style.left = `${x}px`
    this.textarea.style.top = `${y}px`
  }
  
  /**
   * 处理输入
   */
  handleInput(event) {
    if (this.isComposing) return
    
    const data = event.data || this.textarea.value
    
    // 清空 textarea
    this.textarea.value = ''
    
    this.emit('input', { data })
  }
  
  /**
   * 处理键盘按下
   */
  handleKeydown(event) {
    this.emit('keydown', event)
  }
  
  /**
   * 处理鼠标点击
   */
  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // 检测多击
    const now = Date.now()
    if (now - this.lastClickTime < this.clickDelay) {
      this.clickCount++
    } else {
      this.clickCount = 1
    }
    this.lastClickTime = now
    
    // 三击选行
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
  handleDblClick(event) {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('dblclick', { x, y, event })
  }
  
  /**
   * 处理鼠标按下
   */
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('mousedown', { x, y, event })
  }
  
  /**
   * 处理鼠标移动
   */
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // 即使鼠标移出 Canvas 区域，也要触发 mousemove 事件
    // 这样在拖拽选择时可以继续更新选区
    this.emit('mousemove', { x, y, event })
  }
  
  /**
   * 处理鼠标释放
   */
  handleMouseUp(event) {
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.emit('mouseup', { x, y, event })
  }
  
  /**
   * 注册事件监听
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback)
    }
  }
  
  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data))
    }
  }
  
  /**
   * 销毁
   */
  destroy() {
    // 移除全局事件监听器
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this))
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this))
    
    this.textarea.remove()
  }
}
