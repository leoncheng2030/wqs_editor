/**
 * Document Model
 * 管理文档数据（行数组）
 */
export class Document {
  constructor(initialText = '') {
    // 将文本分割成行数组
    this.lines = initialText ? initialText.split('\n') : ['']
    
    // 事件监听器
    this.listeners = {
      change: [],
      lineChange: []  // 新增：行变化事件
    }
    
    // Lexer 引用（用于标记脏行）
    this.lexer = null
  }
  
  /**
   * 获取指定行的内容
   */
  getLine(lineIndex) {
    return this.lines[lineIndex] || ''
  }
  
  /**
   * 获取总行数
   */
  getLineCount() {
    return this.lines.length
  }
  
  /**
   * 获取完整文本
   */
  getText() {
    return this.lines.join('\n')
  }
  
  /**
   * 设置 Lexer 引用（用于缓存失效）
   */
  setLexer(lexer) {
    this.lexer = lexer
  }
  
  /**
   * 设置完整文本
   */
  setText(text) {
    this.lines = text ? text.split('\n') : ['']
    
    // 所有行都变脏
    if (this.lexer) {
      this.lexer.clearCache()
    }
    
    this.emit('change')
  }
  
  /**
   * 在指定位置插入文本
   * @param {number} line - 行号
   * @param {number} column - 列号
   * @param {string} text - 要插入的文本
   */
  insertText(line, column, text) {
    if (line < 0 || line >= this.lines.length) return
    
    const currentLine = this.lines[line]
    const before = currentLine.slice(0, column)
    const after = currentLine.slice(column)
    
    // 处理多行插入
    if (text.includes('\n')) {
      const insertLines = text.split('\n')
      this.lines[line] = before + insertLines[0]
      
      for (let i = 1; i < insertLines.length; i++) {
        this.lines.splice(line + i, 0, insertLines[i])
      }
      
      const lastInsertLine = line + insertLines.length - 1
      this.lines[lastInsertLine] += after
      
      // 标记受影响的行
      if (this.lexer) {
        this.lexer.markDirtyRange(line, lastInsertLine)
      }
      
      this.emit('lineChange', { startLine: line, endLine: lastInsertLine })
    } else {
      this.lines[line] = before + text + after
      
      // 标记当前行
      if (this.lexer) {
        this.lexer.markDirty(line)
      }
      
      this.emit('lineChange', { startLine: line, endLine: line })
    }
    
    this.emit('change')
  }
  
  /**
   * 删除指定范围的文本
   * @param {number} startLine - 起始行
   * @param {number} startColumn - 起始列
   * @param {number} endLine - 结束行
   * @param {number} endColumn - 结束列
   */
  deleteText(startLine, startColumn, endLine, endColumn) {
    if (startLine === endLine) {
      // 单行删除
      const line = this.lines[startLine]
      this.lines[startLine] = line.slice(0, startColumn) + line.slice(endColumn)
      
      // 标记当前行
      if (this.lexer) {
        this.lexer.markDirty(startLine)
      }
      
      this.emit('lineChange', { startLine, endLine: startLine })
    } else {
      // 多行删除
      const firstLine = this.lines[startLine].slice(0, startColumn)
      const lastLine = this.lines[endLine].slice(endColumn)
      
      this.lines.splice(startLine, endLine - startLine + 1, firstLine + lastLine)
      
      // 标记受影响的行（删除后的合并行）
      if (this.lexer) {
        this.lexer.markDirty(startLine)
      }
      
      this.emit('lineChange', { startLine, endLine: startLine })
    }
    
    this.emit('change')
  }
  
  /**
   * 获取指定范围的文本
   */
  getTextRange(startLine, startColumn, endLine, endColumn) {
    if (startLine === endLine) {
      return this.lines[startLine].slice(startColumn, endColumn)
    }
    
    const result = []
    result.push(this.lines[startLine].slice(startColumn))
    
    for (let i = startLine + 1; i < endLine; i++) {
      result.push(this.lines[i])
    }
    
    result.push(this.lines[endLine].slice(0, endColumn))
    
    return result.join('\n')
  }
  
  /**
   * 添加事件监听
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback)
    }
  }
  
  /**
   * 移除事件监听
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }
  
  /**
   * 触发事件
   */
  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(...args))
    }
  }
}
