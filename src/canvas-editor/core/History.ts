/**
 * History - 历史记录管理器
 * 管理撤销/重做功能
 */

import type { HistoryOperation, HistoryOptions } from '../types'

export class History {
  /** 最大历史记录数 */
  private maxSize: number
  /** 撤销栈 */
  private undoStack: HistoryOperation[]
  /** 重做栈 */
  private redoStack: HistoryOperation[]
  /** 是否正在应用历史记录 */
  private isApplying: boolean
  /** 合并延迟（毫秒） */
  private mergeDelay: number
  /** 上次记录时间 */
  private lastRecordTime: number

  constructor(options: HistoryOptions = {}) {
    this.maxSize = options.maxSize || 100
    this.undoStack = []
    this.redoStack = []
    this.isApplying = false
    this.mergeDelay = options.mergeDelay || 300
    this.lastRecordTime = 0
  }
  
  /**
   * 记录操作
   */
  record(operation: HistoryOperation): void {
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
   */
  undo(): HistoryOperation | null {
    if (this.undoStack.length === 0) {
      return null
    }
    
    const operation = this.undoStack.pop()!
    this.redoStack.push(operation)
    
    return operation
  }
  
  /**
   * 重做
   */
  redo(): HistoryOperation | null {
    if (this.redoStack.length === 0) {
      return null
    }
    
    const operation = this.redoStack.pop()!
    this.undoStack.push(operation)
    
    return operation
  }
  
  /**
   * 开始应用历史记录
   */
  startApplying(): void {
    this.isApplying = true
  }
  
  /**
   * 结束应用历史记录
   */
  endApplying(): void {
    this.isApplying = false
  }
  
  /**
   * 清空历史记录
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
  
  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }
  
  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }
}
