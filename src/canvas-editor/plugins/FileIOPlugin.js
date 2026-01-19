/**
 * 文件导入导出插件
 * 支持.md文件的导入和导出功能
 */
export const FileIOPlugin = {
  id: 'file-io',
  name: 'File Import/Export',
  version: '1.0.0',
  description: 'Markdown文件导入导出支持',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton, log } = context

    // 注册导入文件命令
    registerCommand(
      'importFile',
      () => {
        this.importFile(editor, log)
      },
      {
        title: '导入文件',
        description: '从本地导入Markdown文件',
      }
    )

    // 注册导出文件命令
    registerCommand(
      'exportFile',
      filename => {
        this.exportFile(editor, filename, log)
      },
      {
        title: '导出文件',
        description: '将当前内容导出为Markdown文件',
      }
    )

    // 注册快捷键
    registerKeybinding('ctrl+o', 'importFile')
    registerKeybinding('ctrl+s', 'exportFile')

    // 注册工具栏按钮
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
  },

  /**
   * 导入文件
   */
  importFile(editor, log) {
    const { document, cursor } = editor

    if (!document) return

    // 创建隐藏的文件输入元素
    const input = window.document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.style.display = 'none'

    // 处理文件选择
    input.addEventListener('change', event => {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()

      reader.onload = e => {
        const content = e.target.result

        // 设置文档内容
        document.setText(content)

        // 移动光标到开头
        if (cursor) {
          cursor.setPosition(0, 0)
        }

        // 触发重新渲染
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

    // 触发文件选择
    window.document.body.appendChild(input)
    input.click()
    window.document.body.removeChild(input)
  },

  /**
   * 导出文件
   */
  exportFile(editor, filename, log) {
    const { document } = editor

    if (!document) return

    // 获取文档内容
    const content = document.getText()

    // 生成文件名
    const defaultFilename = filename || `markdown_${this.formatDate(new Date())}.md`

    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = defaultFilename
    link.style.display = 'none'

    // 触发下载
    window.document.body.appendChild(link)
    link.click()

    // 清理
    window.document.body.removeChild(link)
    URL.revokeObjectURL(url)

    log(`Exported file: ${defaultFilename}`)
  },

  /**
   * 格式化日期为文件名友好格式
   */
  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}_${hours}${minutes}${seconds}`
  },
}
