/**
 * 任务列表插件
 * 支持Markdown任务列表（Checkbox）
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { line: number; column: number }
  document: {
    getLine(line: number): string
    insertText(line: number, column: number, text: string): void
    deleteText(startLine: number, startColumn: number, endLine: number, endColumn: number): void
  }
  history: {
    record(operation: any): void
  }
}

export const TodoListPlugin: Plugin = {
  id: 'todo-list',
  name: 'Todo List',
  version: '1.0.0',
  description: 'Markdown任务列表支持',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    registerCommand('insertTodo', (checked: boolean = false) => {
      insertTodo(editor as unknown as EditorInterface, checked)
    }, {
      title: '插入待办项',
      description: '在光标位置插入Markdown待办项'
    })

    registerCommand('toggleTodo', () => {
      toggleTodo(editor as unknown as EditorInterface)
    }, {
      title: '切换待办状态',
      description: '切换当前行待办项的完成状态'
    })

    registerKeybinding('ctrl+shift+x', 'toggleTodo')

    registerToolbarButton({
      id: 'insert-todo',
      icon: 'CheckboxOutline',
      title: '插入待办项 (Ctrl+Shift+X)',
      command: 'todo-list.insertTodo',
      commandArgs: [false]
    })
  },

  deactivate() {
    // 清理资源
  }
}

function insertTodo(editor: EditorInterface, checked: boolean = false): void {
  const { cursor, document, history } = editor

  if (!cursor || !document) return

  const todo = checked ? '- [x] ' : '- [ ] '

  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: todo,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line, column: cursor.column + todo.length }
  })

  document.insertText(cursor.line, cursor.column, todo)
  
  cursor.column += todo.length

  console.log(`[todo-list] Inserted todo item (checked: ${checked})`)
}

function toggleTodo(editor: EditorInterface): void {
  const { cursor, document, history } = editor

  if (!cursor || !document) return

  const lineText = document.getLine(cursor.line)
  let newText: string | null = null

  if (lineText.includes('- [ ]')) {
    newText = lineText.replace('- [ ]', '- [x]')
  } else if (lineText.includes('- [x]')) {
    newText = lineText.replace('- [x]', '- [ ]')
  } else if (lineText.includes('- [X]')) {
    newText = lineText.replace('- [X]', '- [ ]')
  }

  if (newText !== null && newText !== lineText) {
    history.record({
      type: 'delete',
      line: cursor.line,
      column: 0,
      text: lineText,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line, column: 0 }
    })

    document.deleteText(cursor.line, 0, cursor.line, lineText.length)

    history.record({
      type: 'insert',
      line: cursor.line,
      column: 0,
      text: newText,
      cursorBefore: { line: cursor.line, column: 0 },
      cursorAfter: { line: cursor.line, column: cursor.column }
    })

    document.insertText(cursor.line, 0, newText)

    console.log('[todo-list] Toggled todo status')
  }
}
