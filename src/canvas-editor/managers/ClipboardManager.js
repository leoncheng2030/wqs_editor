/**
 * Clipboard - 剪贴板管理器
 * 处理复制、剪切、粘贴操作
 */
export class Clipboard {
  constructor() {
    this.internalClipboard = '' // 内部剪贴板（备用）
  }
  
  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>} 是否成功
   */
  async copy(text) {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        this.internalClipboard = text
        return true
      }
      
      // 降级方案：使用 execCommand
      return this.copyFallback(text)
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
      // 保存到内部剪贴板
      this.internalClipboard = text
      return false
    }
  }
  
  /**
   * 从剪贴板粘贴文本
   * @returns {Promise<string>} 粘贴的文本
   */
  async paste() {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        return text
      }
      
      // 降级方案：返回内部剪贴板
      return this.internalClipboard
    } catch (error) {
      console.warn('Failed to paste from clipboard:', error)
      return this.internalClipboard
    }
  }
  
  /**
   * 复制降级方案（使用 execCommand）
   * @param {string} text - 要复制的文本
   * @returns {boolean} 是否成功
   */
  copyFallback(text) {
    try {
      // 创建临时 textarea
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      
      // 选中并复制
      textarea.select()
      textarea.setSelectionRange(0, text.length)
      const success = document.execCommand('copy')
      
      // 清理
      document.body.removeChild(textarea)
      
      if (success) {
        this.internalClipboard = text
      }
      
      return success
    } catch (error) {
      console.warn('Fallback copy failed:', error)
      this.internalClipboard = text
      return false
    }
  }
  
  /**
   * 剪切文本（复制并返回成功标志）
   * @param {string} text - 要剪切的文本
   * @returns {Promise<boolean>} 是否成功
   */
  async cut(text) {
    return await this.copy(text)
  }
  
  /**
   * 检查剪贴板权限
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermission() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'clipboard-read' })
        return result.state === 'granted' || result.state === 'prompt'
      }
      return true
    } catch (error) {
      return true
    }
  }
}
