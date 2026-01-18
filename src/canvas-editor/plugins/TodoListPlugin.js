/**
 * 任务列表插件
 * 支持Markdown任务列表（Checkbox）
 */
export const TodoListPlugin = {
  id: 'todo-list',
  name: 'Todo List',
  version: '1.0.0',
  description: 'Markdown任务列表支持',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    // 注册插入待办项命令
    registerCommand('insertTodo', (checked = false) => {
      this.insertTodo(editor, checked)
    }, {
      title: '插入待办项',
      description: '在光标位置插入Markdown待办项'
    })

    // 注册切换待办状态命令
    registerCommand('toggleTodo', () => {
      this.toggleTodo(editor)
    }, {
      title: '切换待办状态',
      description: '切换当前行待办项的完成状态'
    })

    // 注册快捷键
    registerKeybinding('ctrl+shift+x', 'toggleTodo')

    // 注册工具栏按钮
    registerToolbarButton({
      id: 'insert-todo',
      icon: '☐',
      title: '插入待办项',
      command: 'todo-list.insertTodo',
      commandArgs: [false]
    })
  },

  deactivate() {
    // 清理资源
  },

  /**
   * 插入待办项
   */
  insertTodo(editor, checked = false) {
    const { cursor, document, history } = editor

    if (!cursor || !document) return

    const todo = checked ? '- [x] ' : '- [ ] '

    // 记录操作
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: todo,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line, column: cursor.column + todo.length }
    })

    // 插入文本
    document.insertText(cursor.line, cursor.column, todo)
    
    // 移动光标
    cursor.column += todo.length

    console.log(`[todo-list] Inserted todo item (checked: ${checked})`)
  },

  /**
   * 切换待办状态
   */
  toggleTodo(editor) {
    const { cursor, document, history } = editor

    if (!cursor || !document) return

    const lineText = document.getLine(cursor.line)
    let newText = null

    // 检测并切换状态
    if (lineText.includes('- [ ]')) {
      newText = lineText.replace('- [ ]', '- [x]')
    } else if (lineText.includes('- [x]')) {
      newText = lineText.replace('- [x]', '- [ ]')
    } else if (lineText.includes('- [X]')) {
      newText = lineText.replace('- [X]', '- [ ]')
    }

    if (newText !== null && newText !== lineText) {
      // 记录删除操作
      history.record({
        type: 'delete',
        line: cursor.line,
        column: 0,
        text: lineText,
        cursorBefore: { line: cursor.line, column: cursor.column },
        cursorAfter: { line: cursor.line, column: 0 }
      })

      // 删除旧文本
      document.deleteText(cursor.line, 0, cursor.line, lineText.length)

      // 记录插入操作
      history.record({
        type: 'insert',
        line: cursor.line,
        column: 0,
        text: newText,
        cursorBefore: { line: cursor.line, column: 0 },
        cursorAfter: { line: cursor.line, column: cursor.column }
      })

      // 插入新文本
      document.insertText(cursor.line, 0, newText)

      console.log('[todo-list] Toggled todo status')
    }
  }
}
