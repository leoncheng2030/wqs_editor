/**
 * Markdown表格插件
 * 提供表格插入、编辑、格式化功能
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { line: number; column: number; setPosition(line: number, column: number): void }
  document: {
    getLine(line: number): string
    getLineCount(): number
    insertText(line: number, column: number, text: string): void
    deleteText(startLine: number, startColumn: number, endLine: number, endColumn: number): void
  }
  history: {
    record(operation: any): void
  }
}

interface TableRange {
  startLine: number
  endLine: number
}

export const TablePlugin: Plugin = {
  id: 'markdown-table',
  name: 'Markdown Table',
  version: '1.0.0',
  description: 'Markdown表格支持',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    registerCommand('insertTable', (rows: number = 3, cols: number = 3) => {
      insertTable(editor as unknown as EditorInterface, rows, cols)
    }, {
      title: '插入表格',
      description: '在光标位置插入Markdown表格'
    })

    registerCommand('formatTable', () => {
      formatTable(editor as unknown as EditorInterface)
    }, {
      title: '格式化表格',
      description: '格式化当前行的表格'
    })

    registerCommand('addTableRow', () => {
      addTableRow(editor as unknown as EditorInterface)
    }, {
      title: '添加表格行',
      description: '在当前行下方添加新行'
    })

    registerCommand('addTableColumn', () => {
      addTableColumn(editor as unknown as EditorInterface)
    }, {
      title: '添加表格列',
      description: '在当前列右侧添加新列'
    })

    registerKeybinding('ctrl+shift+t', 'insertTable')
    registerKeybinding('ctrl+shift+f', 'formatTable')

    registerToolbarButton({
      id: 'insert-table',
      icon: 'GridOutline',
      title: '插入表格 (Ctrl+Shift+T)',
      command: 'markdown-table.insertTable',
      commandArgs: [3, 3]
    })
  },

  deactivate() {
    // 清理资源
  }
}

function insertTable(editor: EditorInterface, rows: number, cols: number): void {
  const { cursor, document, history } = editor

  if (!cursor || !document) return

  const tableLines: string[] = []
  
  const headerCells = Array(cols).fill('Header').map((h, i) => `${h}${i + 1}`)
  tableLines.push('| ' + headerCells.join(' | ') + ' |')
  
  const separator = Array(cols).fill('---').join(' | ')
  tableLines.push('| ' + separator + ' |')
  
  for (let i = 0; i < rows - 1; i++) {
    const cells = Array(cols).fill('Cell')
    tableLines.push('| ' + cells.join(' | ') + ' |')
  }

  const tableText = '\n' + tableLines.join('\n') + '\n'

  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: tableText,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line + tableLines.length + 1, column: 0 }
  })

  document.insertText(cursor.line, cursor.column, tableText)
  
  cursor.setPosition(cursor.line + tableLines.length + 1, 0)

  console.log(`[markdown-table] Inserted ${rows}x${cols} table`)
}

function formatTable(editor: EditorInterface): void {
  const { cursor, document } = editor

  if (!cursor || !document) return

  const currentLine = cursor.line
  const lineText = document.getLine(currentLine)

  if (!lineText.trim().startsWith('|')) {
    console.warn('[markdown-table] Current line is not a table row')
    return
  }

  const tableRange = findTableRange(document, currentLine)
  if (!tableRange) return

  const table = parseTable(document, tableRange)
  if (!table) return

  const formattedLines = formatTableData(table)

  const { startLine, endLine } = tableRange
  
  for (let i = endLine; i >= startLine; i--) {
    const lineContent = document.getLine(i)
    document.deleteText(i, 0, i, lineContent.length)
    if (i < endLine) {
      document.deleteText(i, 0, i + 1, 0)
    }
  }

  const newTableText = formattedLines.join('\n')
  document.insertText(startLine, 0, newTableText)

  console.log(`[markdown-table] Table formatted`)
}

function addTableRow(editor: EditorInterface): void {
  const { cursor, document } = editor

  if (!cursor || !document) return

  const currentLine = cursor.line
  const lineText = document.getLine(currentLine)

  if (!lineText.trim().startsWith('|')) {
    console.warn('[markdown-table] Current line is not a table row')
    return
  }

  const cells = lineText.split('|').filter(c => c.trim()).length
  
  const newRow = '| ' + Array(cells).fill('Cell').join(' | ') + ' |'

  document.insertText(currentLine + 1, 0, '\n' + newRow)

  console.log(`[markdown-table] Added new row`)
}

function addTableColumn(editor: EditorInterface): void {
  const { cursor, document } = editor

  if (!cursor || !document) return

  const currentLine = cursor.line
  const lineText = document.getLine(currentLine)

  if (!lineText.trim().startsWith('|')) {
    console.warn('[markdown-table] Current line is not a table row')
    return
  }

  const tableRange = findTableRange(document, currentLine)
  if (!tableRange) return

  const { startLine, endLine } = tableRange

  for (let i = startLine; i <= endLine; i++) {
    const line = document.getLine(i)
    const newLine = line.trimEnd().replace(/\|$/, '') + ' Cell |'
    
    document.deleteText(i, 0, i, line.length)
    document.insertText(i, 0, newLine)
  }

  console.log(`[markdown-table] Added new column`)
}

function findTableRange(document: EditorInterface['document'], currentLine: number): TableRange | null {
  let startLine = currentLine
  let endLine = currentLine

  while (startLine > 0) {
    const prevLine = document.getLine(startLine - 1)
    if (!prevLine.trim().startsWith('|')) break
    startLine--
  }

  while (endLine < document.getLineCount() - 1) {
    const nextLine = document.getLine(endLine + 1)
    if (!nextLine.trim().startsWith('|')) break
    endLine++
  }

  return { startLine, endLine }
}

function parseTable(document: EditorInterface['document'], tableRange: TableRange): string[][] {
  const { startLine, endLine } = tableRange
  const rows: string[][] = []

  for (let i = startLine; i <= endLine; i++) {
    const lineText = document.getLine(i)
    const cells = lineText
      .split('|')
      .filter(c => c.trim())
      .map(c => c.trim())
    
    rows.push(cells)
  }

  return rows
}

function formatTableData(table: string[][]): string[] {
  if (table.length === 0) return []

  const colWidths: number[] = []
  const colCount = table[0].length

  for (let col = 0; col < colCount; col++) {
    let maxWidth = 0
    for (const row of table) {
      if (row[col]) {
        maxWidth = Math.max(maxWidth, row[col].length)
      }
    }
    colWidths.push(Math.max(maxWidth, 3))
  }

  const formattedLines: string[] = []
  
  for (let i = 0; i < table.length; i++) {
    const row = table[i]
    const paddedCells = row.map((cell, col) => {
      if (cell.includes('-')) {
        return '-'.repeat(colWidths[col])
      }
      return cell.padEnd(colWidths[col], ' ')
    })
    
    formattedLines.push('| ' + paddedCells.join(' | ') + ' |')
  }

  return formattedLines
}
