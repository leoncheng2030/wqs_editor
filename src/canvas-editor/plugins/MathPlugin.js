/**
 * 数学公式插件
 * 使用KaTeX渲染数学公式
 * 支持行内公式 $..$ 和块级公式 $$...$$
 */
export const MathPlugin = {
  id: 'math',
  name: 'Math Formula',
  version: '1.0.0',
  description: 'KaTeX数学公式支持',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    // 注册插入行内公式命令
    registerCommand('insertInlineMath', () => {
      this.insertInlineMath(editor)
    }, {
      title: '插入行内公式',
      description: '插入行内数学公式 $...$'
    })

    // 注册插入块级公式命令
    registerCommand('insertBlockMath', () => {
      this.insertBlockMath(editor)
    }, {
      title: '插入块级公式',
      description: '插入块级数学公式 $$...$$'
    })

    // 注册快捷键
    registerKeybinding('ctrl+m', 'insertInlineMath')
    registerKeybinding('ctrl+shift+m', 'insertBlockMath')

    // 注册工具栏按钮
    registerToolbarButton({
      id: 'insert-math',
      icon: '∑',
      title: '插入数学公式 (Ctrl+M)',
      command: 'math.insertInlineMath'
    })
  },

  deactivate() {
    // 清理资源
  },

  /**
   * 插入行内公式
   */
  insertInlineMath(editor) {
    const { cursor, document, history, selection } = editor

    if (!cursor || !document) return

    let textToInsert = ''
    let cursorOffset = 1

    if (selection && selection.hasSelection) {
      // 有选区，包裹选中的文本
      const selectedText = selection.getSelectedText(document)
      textToInsert = `$${selectedText}$`
      cursorOffset = textToInsert.length

      const { startLine, startColumn } = selection.getOrderedRange()

      // 删除选中的文本
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: selectedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })

      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
    } else {
      // 无选区，插入空公式
      textToInsert = '$$'
      cursorOffset = 1
    }

    // 记录插入操作
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: textToInsert,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line, column: cursor.column + cursorOffset }
    })

    // 插入文本
    document.insertText(cursor.line, cursor.column, textToInsert)

    // 移动光标
    cursor.column += cursorOffset

    console.log('[math] Inserted inline math')
  },

  /**
   * 插入块级公式
   */
  insertBlockMath(editor) {
    const { cursor, document, history, selection } = editor

    if (!cursor || !document) return

    let textToInsert = ''
    let cursorOffset = 3

    if (selection && selection.hasSelection) {
      // 有选区，包裹选中的文本
      const selectedText = selection.getSelectedText(document)
      textToInsert = `$$\n${selectedText}\n$$`
      cursorOffset = 3 + selectedText.length

      const { startLine, startColumn } = selection.getOrderedRange()

      // 删除选中的文本
      history.record({
        type: 'delete',
        line: startLine,
        column: startColumn,
        text: selectedText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: startLine, column: startColumn }
      })

      const pos = selection.deleteSelectedText(document)
      cursor.setPosition(pos.line, pos.column)
    } else {
      // 无选区，插入空公式块
      textToInsert = '$$\n\n$$'
      cursorOffset = 3
    }

    // 记录插入操作
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: textToInsert,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line + 1, column: 0 }
    })

    // 插入文本
    document.insertText(cursor.line, cursor.column, textToInsert)

    // 移动光标到中间行
    cursor.line += 1
    cursor.column = 0

    console.log('[math] Inserted block math')
  }
}
