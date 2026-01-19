/**
 * 文件导入导出插件
 * 支持.md文件的导入和导出功能
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { setPosition(line: number, column: number): void }
  document: {
    setText(text: string): void
    getText(): string
  }
  render(force?: boolean): void
}

type LogFn = (...args: any[]) => void

export const FileIOPlugin: Plugin = {
  id: 'file-io',
  name: 'File Import/Export',
  version: '1.0.0',
  description: 'Markdown文件导入导出支持',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton, log } = context

    registerCommand(
      'importFile',
      () => {
        importFile(editor as unknown as EditorInterface, log)
      },
      {
        title: '导入文件',
        description: '从本地导入Markdown文件',
      }
    )

    registerCommand(
      'exportFile',
      (filename?: string) => {
        exportFile(editor as unknown as EditorInterface, filename, log)
      },
      {
        title: '导出文件',
        description: '将当前内容导出为Markdown文件',
      }
    )

    registerKeybinding('ctrl+o', 'importFile')
    registerKeybinding('ctrl+s', 'exportFile')

    registerToolbarButton({
      id: 'import-file',
      icon: 'folder-open',
      title: '导入文件 (Ctrl+O)',
      command: 'file-io.importFile',
    })

    registerToolbarButton({
      id: 'export-file',
      icon: 'save',
      title: '导出文件 (Ctrl+S)',
      command: 'file-io.exportFile',
    })

    log('FileIOPlugin activated')
  },

  deactivate() {
    // 清理资源
  }
}

function importFile(editor: EditorInterface, log: LogFn): void {
  const { document, cursor } = editor

  if (!document) return

  const input = window.document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.style.display = 'none'

  input.addEventListener('change', event => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = e => {
      const content = e.target?.result as string

      document.setText(content)

      if (cursor) {
        cursor.setPosition(0, 0)
      }

      if (editor.render) {
        editor.render(true)
      }

      log(`Imported file: ${file.name}`)
    }

    reader.onerror = () => {
      console.error('Failed to read file')
    }

    reader.readAsText(file, 'UTF-8')
  })

  window.document.body.appendChild(input)
  input.click()
  window.document.body.removeChild(input)
}

function exportFile(editor: EditorInterface, filename: string | undefined, log: LogFn): void {
  const { document } = editor

  if (!document) return

  const content = document.getText()

  const defaultFilename = filename || `markdown_${formatDate(new Date())}.md`

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })

  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = defaultFilename
  link.style.display = 'none'

  window.document.body.appendChild(link)
  link.click()

  window.document.body.removeChild(link)
  URL.revokeObjectURL(url)

  log(`Exported file: ${defaultFilename}`)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}
