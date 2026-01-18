/**
 * History - 历史记录管理器
 * 管理撤销/重做功能
 */
export class History {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100 // 最大历史记录数
    
    // 历史记录栈
    this.undoStack = []
    this.redoStack = []
    
    // 是否正在应用历史记录
    this.isApplying = false
    
    // 合并延迟（毫秒）
    this.mergeDelay = options.mergeDelay || 300
    this.lastRecordTime = 0
  }
  
  /**
   * 记录操作
   * @param {Object} operation - 操作对象
   *   {
   *     type: 'insert' | 'delete',
   *     line: number,
   *     column: number,
   *     text: string,
   *     cursorBefore: {line, column},
   *     cursorAfter: {line, column}
   *   }
   */
  record(operation) {
    if (this.isApplying) {
      return
    }
    
    const now = Date.now()
    const canMerge = now - this.lastRecordTime < this.mergeDelay
    
    // 尝试合并连续的插入或删除操作
    if (canMerge && this.undoStack.length > 0) {
      const lastOp = this.undoStack[this.undoStack.length - 1]
      
      // 合并连续的字符插入
      if (
        operation.type === 'insert' && 
        lastOp.type === 'insert' &&
        operation.line === lastOp.line &&
        operation.column === lastOp.column + lastOp.text.length &&
        !operation.text.includes('\n') &&
        !lastOp.text.includes('\n')
      ) {
        lastOp.text += operation.text
        lastOp.cursorAfter = operation.cursorAfter
        this.lastRecordTime = now
        return
      }
      
      // 合并连续的字符删除（Backspace）
      if (
        operation.type === 'delete' &&
        lastOp.type === 'delete' &&
        operation.line === lastOp.line &&
        operation.column === lastOp.column - operation.text.length &&
        !operation.text.includes('\n') &&
        !lastOp.text.includes('\n')
      ) {
        lastOp.text = operation.text + lastOp.text
        lastOp.column = operation.column
        lastOp.cursorBefore = operation.cursorBefore
        this.lastRecordTime = now
        return
      }
    }
    
    // 添加新记录
    this.undoStack.push(operation)
    
    // 限制栈大小
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift()
    }
    
    // 清空重做栈
    this.redoStack = []
    
    this.lastRecordTime = now
  }
  
  /**
   * 撤销
   * @returns {Object|null} 撤销操作
   */
  undo() {
    if (this.undoStack.length === 0) {
      return null
    }
    
    const operation = this.undoStack.pop()
    this.redoStack.push(operation)
    
    return operation
  }
  
  /**
   * 重做
   * @returns {Object|null} 重做操作
   */
  redo() {
    if (this.redoStack.length === 0) {
      return null
    }
    
    const operation = this.redoStack.pop()
    this.undoStack.push(operation)
    
    return operation
  }
  
  /**
   * 开始应用历史记录
   */
  startApplying() {
    this.isApplying = true
  }
  
  /**
   * 结束应用历史记录
   */
  endApplying() {
    this.isApplying = false
  }
  
  /**
   * 清空历史记录
   */
  clear() {
    this.undoStack = []
    this.redoStack = []
  }
  
  /**
   * 是否可以撤销
   */
  canUndo() {
    return this.undoStack.length > 0
  }
  
  /**
   * 是否可以重做
   */
  canRedo() {
    return this.redoStack.length > 0
  }
}
