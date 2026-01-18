/**
 * Markdown表格插件
 * 提供表格插入、编辑、格式化功能
 */
export const TablePlugin = {
  id: 'markdown-table',
  name: 'Markdown Table',
  version: '1.0.0',
  description: 'Markdown表格支持',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    // 注册插入表格命令
    registerCommand('insertTable', (rows = 3, cols = 3) => {
      this.insertTable(editor, rows, cols)
    }, {
      title: '插入表格',
      description: '在光标位置插入Markdown表格'
    })

    // 注册格式化表格命令
    registerCommand('formatTable', () => {
      this.formatTable(editor)
    }, {
      title: '格式化表格',
      description: '格式化当前行的表格'
    })

    // 注册添加行命令
    registerCommand('addTableRow', () => {
      this.addTableRow(editor)
    }, {
      title: '添加表格行',
      description: '在当前行下方添加新行'
    })

    // 注册添加列命令
    registerCommand('addTableColumn', () => {
      this.addTableColumn(editor)
    }, {
      title: '添加表格列',
      description: '在当前列右侧添加新列'
    })

    // 注册快捷键
    registerKeybinding('ctrl+shift+t', 'insertTable')
    registerKeybinding('ctrl+shift+f', 'formatTable')

    // 注册工具栏按钮
    registerToolbarButton({
      id: 'insert-table',
      icon: '📊',
      title: '插入表格',
      command: 'markdown-table.insertTable',
      commandArgs: [3, 3]
    })
  },

  deactivate() {
    // 清理资源
  },

  /**
   * 插入表格
   */
  insertTable(editor, rows, cols) {
    const { cursor, document, history } = editor

    if (!cursor || !document) return

    // 生成表格Markdown
    const tableLines = []
    
    // 表头
    const headerCells = Array(cols).fill('Header').map((h, i) => `${h}${i + 1}`)
    tableLines.push('| ' + headerCells.join(' | ') + ' |')
    
    // 分隔符
    const separator = Array(cols).fill('---').join(' | ')
    tableLines.push('| ' + separator + ' |')
    
    // 数据行
    for (let i = 0; i < rows - 1; i++) {
      const cells = Array(cols).fill('Cell')
      tableLines.push('| ' + cells.join(' | ') + ' |')
    }

    const tableText = '\n' + tableLines.join('\n') + '\n'

    // 记录操作
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: tableText,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line + tableLines.length + 1, column: 0 }
    })

    // 插入表格
    document.insertText(cursor.line, cursor.column, tableText)
    
    // 移动光标到表格后
    cursor.setPosition(cursor.line + tableLines.length + 1, 0)

    console.log(`[markdown-table] Inserted ${rows}x${cols} table`)
  },

  /**
   * 格式化表格
   */
  formatTable(editor) {
    const { cursor, document } = editor

    if (!cursor || !document) return

    // 检测当前行是否在表格中
    const currentLine = cursor.line
    const lineText = document.getLine(currentLine)

    if (!lineText.trim().startsWith('|')) {
      console.warn('[markdown-table] Current line is not a table row')
      return
    }

    // 查找表格范围
    const tableRange = this.findTableRange(document, currentLine)
    if (!tableRange) return

    // 解析表格
    const table = this.parseTable(document, tableRange)
    if (!table) return

    // 格式化表格
    const formattedLines = this.formatTableData(table)

    // 替换表格内容
    const { startLine, endLine } = tableRange
    
    // 删除旧表格
    for (let i = endLine; i >= startLine; i--) {
      const lineContent = document.getLine(i)
      document.deleteText(i, 0, i, lineContent.length)
      if (i < endLine) {
        document.deleteText(i, 0, i + 1, 0) // 删除换行符
      }
    }

    // 插入新表格
    const newTableText = formattedLines.join('\n')
    document.insertText(startLine, 0, newTableText)

    console.log(`[markdown-table] Table formatted`)
  },

  /**
   * 添加表格行
   */
  addTableRow(editor) {
    const { cursor, document } = editor

    if (!cursor || !document) return

    const currentLine = cursor.line
    const lineText = document.getLine(currentLine)

    if (!lineText.trim().startsWith('|')) {
      console.warn('[markdown-table] Current line is not a table row')
      return
    }

    // 计算列数
    const cells = lineText.split('|').filter(c => c.trim()).length
    
    // 生成新行
    const newRow = '| ' + Array(cells).fill('Cell').join(' | ') + ' |'

    // 插入新行
    document.insertText(currentLine + 1, 0, '\n' + newRow)

    console.log(`[markdown-table] Added new row`)
  },

  /**
   * 添加表格列
   */
  addTableColumn(editor) {
    const { cursor, document } = editor

    if (!cursor || !document) return

    const currentLine = cursor.line
    const lineText = document.getLine(currentLine)

    if (!lineText.trim().startsWith('|')) {
      console.warn('[markdown-table] Current line is not a table row')
      return
    }

    // 查找表格范围
    const tableRange = this.findTableRange(document, currentLine)
    if (!tableRange) return

    const { startLine, endLine } = tableRange

    // 在每一行末尾添加新列
    for (let i = startLine; i <= endLine; i++) {
      const line = document.getLine(i)
      const newLine = line.trimEnd().replace(/\|$/, '') + ' Cell |'
      
      document.deleteText(i, 0, i, line.length)
      document.insertText(i, 0, newLine)
    }

    console.log(`[markdown-table] Added new column`)
  },

  /**
   * 查找表格范围
   */
  findTableRange(document, currentLine) {
    let startLine = currentLine
    let endLine = currentLine

    // 向上查找表格开始
    while (startLine > 0) {
      const prevLine = document.getLine(startLine - 1)
      if (!prevLine.trim().startsWith('|')) break
      startLine--
    }

    // 向下查找表格结束
    while (endLine < document.getLineCount() - 1) {
      const nextLine = document.getLine(endLine + 1)
      if (!nextLine.trim().startsWith('|')) break
      endLine++
    }

    return { startLine, endLine }
  },

  /**
   * 解析表格
   */
  parseTable(document, tableRange) {
    const { startLine, endLine } = tableRange
    const rows = []

    for (let i = startLine; i <= endLine; i++) {
      const lineText = document.getLine(i)
      const cells = lineText
        .split('|')
        .filter(c => c.trim())
        .map(c => c.trim())
      
      rows.push(cells)
    }

    return rows
  },

  /**
   * 格式化表格数据
   */
  formatTableData(table) {
    if (table.length === 0) return []

    // 计算每列的最大宽度
    const colWidths = []
    const colCount = table[0].length

    for (let col = 0; col < colCount; col++) {
      let maxWidth = 0
      for (const row of table) {
        if (row[col]) {
          maxWidth = Math.max(maxWidth, row[col].length)
        }
      }
      colWidths.push(Math.max(maxWidth, 3)) // 最小宽度3
    }

    // 格式化每一行
    const formattedLines = []
    
    for (let i = 0; i < table.length; i++) {
      const row = table[i]
      const paddedCells = row.map((cell, col) => {
        // 如果是分隔符行（包含---）
        if (cell.includes('-')) {
          return '-'.repeat(colWidths[col])
        }
        // 普通单元格，右侧填充空格
        return cell.padEnd(colWidths[col], ' ')
      })
      
      formattedLines.push('| ' + paddedCells.join(' | ') + ' |')
    }

    return formattedLines
  }
}
