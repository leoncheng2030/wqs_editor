/**
 * Selection - 选区模型
 * 管理文本选区的起点和终点
 */

import type { Document } from './Document'
import type { Range, Position } from '../types'

export interface OrderedRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export class Selection {
  /** 锚点行（选区起点，按下鼠标的位置） */
  public anchorLine: number
  /** 锚点列 */
  public anchorColumn: number
  /** 焦点行（选区终点，当前光标位置） */
  public focusLine: number
  /** 焦点列 */
  public focusColumn: number
  /** 是否有选区 */
  public hasSelection: boolean

  constructor() {
    this.anchorLine = 0
    this.anchorColumn = 0
    this.focusLine = 0
    this.focusColumn = 0
    this.hasSelection = false
  }
  
  /**
   * 设置选区范围
   */
  setRange(anchorLine: number, anchorColumn: number, focusLine: number, focusColumn: number): void {
    this.anchorLine = anchorLine
    this.anchorColumn = anchorColumn
    this.focusLine = focusLine
    this.focusColumn = focusColumn
    this.hasSelection = !(
      anchorLine === focusLine && anchorColumn === focusColumn
    )
  }
  
  /**
   * 折叠选区到焦点位置
   */
  collapse(): void {
    this.anchorLine = this.focusLine
    this.anchorColumn = this.focusColumn
    this.hasSelection = false
  }
  
  /**
   * 折叠选区到起点
   */
  collapseToStart(): void {
    const { startLine, startColumn } = this.getOrderedRange()
    this.anchorLine = startLine
    this.anchorColumn = startColumn
    this.focusLine = startLine
    this.focusColumn = startColumn
    this.hasSelection = false
  }
  
  /**
   * 折叠选区到终点
   */
  collapseToEnd(): void {
    const { endLine, endColumn } = this.getOrderedRange()
    this.anchorLine = endLine
    this.anchorColumn = endColumn
    this.focusLine = endLine
    this.focusColumn = endColumn
    this.hasSelection = false
  }
  
  /**
   * 获取有序的选区范围（保证 start <= end）
   */
  getOrderedRange(): OrderedRange {
    if (this.anchorLine < this.focusLine) {
      return {
        startLine: this.anchorLine,
        startColumn: this.anchorColumn,
        endLine: this.focusLine,
        endColumn: this.focusColumn
      }
    } else if (this.anchorLine > this.focusLine) {
      return {
        startLine: this.focusLine,
        startColumn: this.focusColumn,
        endLine: this.anchorLine,
        endColumn: this.anchorColumn
      }
    } else {
      // 同一行
      if (this.anchorColumn <= this.focusColumn) {
        return {
          startLine: this.anchorLine,
          startColumn: this.anchorColumn,
          endLine: this.focusLine,
          endColumn: this.focusColumn
        }
      } else {
        return {
          startLine: this.focusLine,
          startColumn: this.focusColumn,
          endLine: this.anchorLine,
          endColumn: this.anchorColumn
        }
      }
    }
  }
  
  /**
   * 全选文档
   */
  selectAll(document: Document): void {
    this.anchorLine = 0
    this.anchorColumn = 0
    this.focusLine = document.getLineCount() - 1
    this.focusColumn = document.getLine(this.focusLine).length
    this.hasSelection = true
  }
  
  /**
   * 选择一行
   */
  selectLine(line: number, document: Document): void {
    this.anchorLine = line
    this.anchorColumn = 0
    this.focusLine = line
    this.focusColumn = document.getLine(line).length
    this.hasSelection = true
  }
  
  /**
   * 扩展选区（Shift + 移动键）
   */
  extend(line: number, column: number): void {
    this.focusLine = line
    this.focusColumn = column
    this.hasSelection = !(
      this.anchorLine === this.focusLine && 
      this.anchorColumn === this.focusColumn
    )
  }
  
  /**
   * 获取选中的文本
   */
  getSelectedText(document: Document): string {
    if (!this.hasSelection) {
      return ''
    }
    
    const { startLine, startColumn, endLine, endColumn } = this.getOrderedRange()
    return document.getTextRange(startLine, startColumn, endLine, endColumn)
  }
  
  /**
   * 删除选中的文本
   */
  deleteSelectedText(document: Document): Position {
    if (!this.hasSelection) {
      return { line: this.focusLine, column: this.focusColumn }
    }
    
    const { startLine, startColumn, endLine, endColumn } = this.getOrderedRange()
    document.deleteText(startLine, startColumn, endLine, endColumn)
    
    // 折叠到起点
    this.anchorLine = startLine
    this.anchorColumn = startColumn
    this.focusLine = startLine
    this.focusColumn = startColumn
    this.hasSelection = false
    
    return { line: startLine, column: startColumn }
  }
  
  /**
   * 替换选中的文本
   */
  replaceSelectedText(document: Document, text: string): Position {
    const { line, column } = this.deleteSelectedText(document)
    document.insertText(line, column, text)
    
    // 计算新位置
    const lines = text.split('\n')
    if (lines.length === 1) {
      return { line, column: column + text.length }
    } else {
      return {
        line: line + lines.length - 1,
        column: lines[lines.length - 1].length
      }
    }
  }
  
  /**
   * 清除选区
   */
  clear(): void {
    this.hasSelection = false
    this.anchorLine = this.focusLine
    this.anchorColumn = this.focusColumn
  }
}
