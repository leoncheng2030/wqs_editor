/**
 * Cursor
 * 光标模型
 */
export class Cursor {
  constructor(line = 0, column = 0) {
    this.line = line
    this.column = column
  }
  
  /**
   * 设置光标位置
   */
  setPosition(line, column) {
    this.line = line
    this.column = column
  }
  
  /**
   * 向左移动
   */
  moveLeft(document) {
    if (this.column > 0) {
      this.column--
    } else if (this.line > 0) {
      // 移动到上一行末尾
      this.line--
      this.column = document.getLine(this.line).length
    }
  }
  
  /**
   * 向右移动
   */
  moveRight(document) {
    const lineText = document.getLine(this.line)
    if (this.column < lineText.length) {
      this.column++
    } else if (this.line < document.getLineCount() - 1) {
      // 移动到下一行开头
      this.line++
      this.column = 0
    }
  }
  
  /**
   * 向上移动
   */
  moveUp(document) {
    if (this.line > 0) {
      this.line--
      // 确保列不超出行长度
      const lineText = document.getLine(this.line)
      this.column = Math.min(this.column, lineText.length)
    }
  }
  
  /**
   * 向下移动
   */
  moveDown(document) {
    if (this.line < document.getLineCount() - 1) {
      this.line++
      // 确保列不超出行长度
      const lineText = document.getLine(this.line)
      this.column = Math.min(this.column, lineText.length)
    }
  }
  
  /**
   * 移动到行首
   */
  moveToLineStart() {
    this.column = 0
  }
  
  /**
   * 移动到行尾
   */
  moveToLineEnd(document) {
    const lineText = document.getLine(this.line)
    this.column = lineText.length
  }
  
  /**
   * 克隆
   */
  clone() {
    return new Cursor(this.line, this.column)
  }
}
