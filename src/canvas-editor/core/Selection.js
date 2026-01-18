/**
 * Selection - 选区模型
 * 管理文本选区的起点和终点
 */
export class Selection {
  constructor() {
    // 锚点（选区起点，按下鼠标的位置）
    this.anchorLine = 0
    this.anchorColumn = 0
    
    // 焦点（选区终点，当前光标位置）
    this.focusLine = 0
    this.focusColumn = 0
    
    // 是否有选区
    this.hasSelection = false
  }
  
  /**
   * 设置选区范围
   * @param {number} anchorLine - 起点行
   * @param {number} anchorColumn - 起点列
   * @param {number} focusLine - 终点行
   * @param {number} focusColumn - 终点列
   */
  setRange(anchorLine, anchorColumn, focusLine, focusColumn) {
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
  collapse() {
    this.anchorLine = this.focusLine
    this.anchorColumn = this.focusColumn
    this.hasSelection = false
  }
  
  /**
   * 折叠选区到起点
   */
  collapseToStart() {
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
  collapseToEnd() {
    const { endLine, endColumn } = this.getOrderedRange()
    this.anchorLine = endLine
    this.anchorColumn = endColumn
    this.focusLine = endLine
    this.focusColumn = endColumn
    this.hasSelection = false
  }
  
  /**
   * 获取有序的选区范围（保证 start <= end）
   * @returns {{startLine, startColumn, endLine, endColumn}}
   */
  getOrderedRange() {
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
   * @param {Document} document - 文档对象
   */
  selectAll(document) {
    this.anchorLine = 0
    this.anchorColumn = 0
    this.focusLine = document.getLineCount() - 1
    this.focusColumn = document.getLine(this.focusLine).length
    this.hasSelection = true
  }
  
  /**
   * 选择一行
   * @param {number} line - 行号
   * @param {Document} document - 文档对象
   */
  selectLine(line, document) {
    this.anchorLine = line
    this.anchorColumn = 0
    this.focusLine = line
    this.focusColumn = document.getLine(line).length
    this.hasSelection = true
  }
  
  /**
   * 扩展选区（Shift + 移动键）
   * @param {number} line - 新的焦点行
   * @param {number} column - 新的焦点列
   */
  extend(line, column) {
    this.focusLine = line
    this.focusColumn = column
    this.hasSelection = !(
      this.anchorLine === this.focusLine && 
      this.anchorColumn === this.focusColumn
    )
  }
  
  /**
   * 获取选中的文本
   * @param {Document} document - 文档对象
   * @returns {string} 选中的文本
   */
  getSelectedText(document) {
    if (!this.hasSelection) {
      return ''
    }
    
    const { startLine, startColumn, endLine, endColumn } = this.getOrderedRange()
    return document.getTextRange(startLine, startColumn, endLine, endColumn)
  }
  
  /**
   * 删除选中的文本
   * @param {Document} document - 文档对象
   * @returns {{line, column}} 删除后的光标位置
   */
  deleteSelectedText(document) {
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
   * @param {Document} document - 文档对象
   * @param {string} text - 新文本
   * @returns {{line, column}} 替换后的光标位置
   */
  replaceSelectedText(document, text) {
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
  clear() {
    this.hasSelection = false
    this.anchorLine = this.focusLine
    this.anchorColumn = this.focusColumn
  }
}
