/**
 * Clipboard - 剪贴板管理器
 * 处理复制、剪切、粘贴操作
 */
export class Clipboard {
  private internalClipboard: string

  constructor() {
    this.internalClipboard = ''
  }
  
  /**
   * 复制文本到剪贴板
   */
  async copy(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        this.internalClipboard = text
        return true
      }
      
      return this.copyFallback(text)
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
      this.internalClipboard = text
      return false
    }
  }
  
  /**
   * 从剪贴板粘贴文本
   */
  async paste(): Promise<string> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        return text
      }
      
      return this.internalClipboard
    } catch (error) {
      console.warn('Failed to paste from clipboard:', error)
      return this.internalClipboard
    }
  }
  
  /**
   * 复制降级方案（使用 execCommand）
   */
  private copyFallback(text: string): boolean {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      
      textarea.select()
      textarea.setSelectionRange(0, text.length)
      const success = document.execCommand('copy')
      
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
   */
  async cut(text: string): Promise<boolean> {
    return await this.copy(text)
  }
  
  /**
   * 检查剪贴板权限
   */
  async checkPermission(): Promise<boolean> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
        return result.state === 'granted' || result.state === 'prompt'
      }
      return true
    } catch (error) {
      return true
    }
  }
}
