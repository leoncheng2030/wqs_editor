/**
 * Document Model
 * 管理文档数据（行数组）
 */

export interface DocumentChangeInfo {
  startLine: number
  endLine: number
}

export interface LineChangeInfo {
  startLine: number
  endLine: number
}

type ChangeListener = (changeInfo?: DocumentChangeInfo) => void
type LineChangeListener = (lineChangeInfo: LineChangeInfo) => void

interface DocumentListeners {
  change: ChangeListener[]
  lineChange: LineChangeListener[]
}

interface Lexer {
  clearCache(): void
  markDirty(line: number): void
  markDirtyRange(startLine: number, endLine: number): void
}

export class Document {
  private lines: string[]
  private listeners: DocumentListeners
  private lexer: Lexer | null

  constructor(initialText: string = '') {
    // 将文本分割成行数组
    this.lines = initialText ? initialText.split('\n') : ['']
    
    // 事件监听器
    this.listeners = {
      change: [],
      lineChange: []
    }
    
    // Lexer 引用（用于标记脏行）
    this.lexer = null
  }
  
  /**
   * 获取指定行的内容
   */
  getLine(lineIndex: number): string {
    return this.lines[lineIndex] || ''
  }
  
  /**
   * 获取总行数
   */
  getLineCount(): number {
    return this.lines.length
  }
  
  /**
   * 获取完整文本
   */
  getText(): string {
    return this.lines.join('\n')
  }
  
  /**
   * 设置 Lexer 引用（用于缓存失效）
   */
  setLexer(lexer: Lexer): void {
    this.lexer = lexer
  }
  
  /**
   * 设置完整文本
   */
  setText(text: string): void {
    this.lines = text ? text.split('\n') : ['']
    
    // 所有行都变脏
    if (this.lexer) {
      this.lexer.clearCache()
    }
    
    this.emit('change')
  }
  
  /**
   * 在指定位置插入文本
   * @param line - 行号
   * @param column - 列号
   * @param text - 要插入的文本
   */
  insertText(line: number, column: number, text: string): void {
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
   * @param startLine - 起始行
   * @param startColumn - 起始列
   * @param endLine - 结束行
   * @param endColumn - 结束列
   */
  deleteText(startLine: number, startColumn: number, endLine: number, endColumn: number): void {
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
  getTextRange(startLine: number, startColumn: number, endLine: number, endColumn: number): string {
    if (startLine === endLine) {
      return this.lines[startLine].slice(startColumn, endColumn)
    }
    
    const result: string[] = []
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
  on(event: 'change', callback: ChangeListener): void
  on(event: 'lineChange', callback: LineChangeListener): void
  on(event: keyof DocumentListeners, callback: ChangeListener | LineChangeListener): void {
    if (this.listeners[event]) {
      (this.listeners[event] as any[]).push(callback)
    }
  }
  
  /**
   * 移除事件监听
   */
  off(event: 'change', callback: ChangeListener): void
  off(event: 'lineChange', callback: LineChangeListener): void
  off(event: keyof DocumentListeners, callback: ChangeListener | LineChangeListener): void {
    if (this.listeners[event]) {
      this.listeners[event] = (this.listeners[event] as any[]).filter((cb: any) => cb !== callback)
    }
  }
  
  /**
   * 触发事件
   */
  private emit(event: 'change', changeInfo?: DocumentChangeInfo): void
  private emit(event: 'lineChange', lineChangeInfo?: LineChangeInfo): void
  private emit(event: keyof DocumentListeners, ...args: any[]): void {
    if (this.listeners[event]) {
      (this.listeners[event] as any[]).forEach((callback: any) => callback(...args))
    }
  }
}
