/**
 * 数学公式插件
 * 使用KaTeX渲染数学公式
 * 支持行内公式 $..$ 和块级公式 $$...$$
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { line: number; column: number; setPosition(line: number, column: number): void }
  document: {
    insertText(line: number, column: number, text: string): void
  }
  selection: {
    hasSelection: boolean
    getSelectedText(document: any): string
    getOrderedRange(): { startLine: number; startColumn: number }
    deleteSelectedText(document: any): { line: number; column: number }
  }
  history: {
    record(operation: any): void
  }
}

export const MathPlugin: Plugin = {
  id: 'math',
  name: 'Math Formula',
  version: '1.0.0',
  description: 'KaTeX数学公式支持',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    registerCommand('insertInlineMath', () => {
      insertInlineMath(editor as unknown as EditorInterface)
    }, {
      title: '插入行内公式',
      description: '插入行内数学公式 $...$'
    })

    registerCommand('insertBlockMath', () => {
      insertBlockMath(editor as unknown as EditorInterface)
    }, {
      title: '插入块级公式',
      description: '插入块级数学公式 $$...$$'
    })

    registerKeybinding('ctrl+m', 'insertInlineMath')
    registerKeybinding('ctrl+shift+m', 'insertBlockMath')

    registerToolbarButton({
      id: 'insert-math',
      icon: 'CalculatorOutline',
      title: '插入数学公式 (Ctrl+M)',
      command: 'math.insertInlineMath'
    })
  },

  deactivate() {
    // 清理资源
  }
}

function insertInlineMath(editor: EditorInterface): void {
  const { cursor, document, history, selection } = editor

  if (!cursor || !document) return

  let textToInsert = ''
  let cursorOffset = 1

  if (selection && selection.hasSelection) {
    const selectedText = selection.getSelectedText(document)
    textToInsert = `$${selectedText}$`
    cursorOffset = textToInsert.length

    const { startLine, startColumn } = selection.getOrderedRange()

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
    textToInsert = '$$'
    cursorOffset = 1
  }

  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: textToInsert,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line, column: cursor.column + cursorOffset }
  })

  document.insertText(cursor.line, cursor.column, textToInsert)

  cursor.column += cursorOffset

  console.log('[math] Inserted inline math')
}

function insertBlockMath(editor: EditorInterface): void {
  const { cursor, document, history, selection } = editor

  if (!cursor || !document) return

  let textToInsert = ''

  if (selection && selection.hasSelection) {
    const selectedText = selection.getSelectedText(document)
    textToInsert = `$$\n${selectedText}\n$$`

    const { startLine, startColumn } = selection.getOrderedRange()

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
    textToInsert = '$$\n\n$$'
  }

  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: textToInsert,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line + 1, column: 0 }
  })

  document.insertText(cursor.line, cursor.column, textToInsert)

  cursor.line += 1
  cursor.column = 0

  console.log('[math] Inserted block math')
}
