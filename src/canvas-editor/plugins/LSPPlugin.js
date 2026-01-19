/**
 * LSP集成插件
 * 🚀 将LSP客户端集成到编辑器，提供智能补全、诊断等功能
 */
import { LSPClient } from '../lsp/LSPClient.js'

export const LSPPlugin = {
  id: 'lsp',
  name: 'LSP Support',
  version: '1.0.0',
  description: '语言服务器协议支持，提供智能补全和诊断',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, log } = context

    // 创建LSP客户端
    const lspClient = new LSPClient({
      serverUrl: null, // 由用户配置
      onDiagnostics: (uri, diagnostics) => {
        handleDiagnostics(uri, diagnostics)
      },
    })

    // 存储补全状态
    let completionItems = []
    let completionVisible = false
    let completionTriggerPosition = null

    /**
     * 🚀 触发补全
     */
    const triggerCompletion = async () => {
      if (!lspClient.connected) {
        log('LSP客户端未连接')
        return
      }

      const { cursor, document } = editor
      const uri = 'file:///document.md' // 简化URI
      const line = cursor.line
      const character = cursor.column

      try {
        // 请求补全
        const result = await lspClient.completion(uri, line, character)

        if (result && result.items) {
          completionItems = Array.isArray(result.items) ? result.items : result.items.items
          completionVisible = completionItems.length > 0
          completionTriggerPosition = { line, character }

          // 触发UI显示（需要集成CompletionPopup组件）
          editor.emit('completion:show', {
            items: completionItems,
            position: completionTriggerPosition,
          })

          log(`显示 ${completionItems.length} 个补全项`)
        }
      } catch (error) {
        console.error('补全请求失败:', error)
      }
    }

    /**
     * 🚀 处理诊断信息
     */
    const handleDiagnostics = (uri, diagnostics) => {
      // 将LSP诊断转换为编辑器格式
      const editorDiagnostics = diagnostics.map(diag => ({
        line: diag.range.start.line,
        column: diag.range.start.character,
        length: diag.range.end.character - diag.range.start.character,
        message: diag.message,
        severity: getDiagnosticSeverity(diag.severity),
        source: diag.source || 'lsp',
      }))

      // 更新编辑器诊断
      if (editor.textRenderer && editor.textRenderer.setDiagnostics) {
        editor.textRenderer.setDiagnostics(editorDiagnostics)
        editor.render()
      }

      log(`收到 ${diagnostics.length} 个诊断`)
    }

    /**
     * 转换诊断严重级别
     */
    const getDiagnosticSeverity = lspSeverity => {
      // LSP: 1=Error, 2=Warning, 3=Information, 4=Hint
      const map = {
        1: 'error',
        2: 'warning',
        3: 'info',
        4: 'hint',
      }
      return map[lspSeverity] || 'info'
    }

    /**
     * 🚀 打开文档
     */
    const openDocument = () => {
      if (!lspClient.connected) return

      const uri = 'file:///document.md'
      const text = editor.document.getText()

      lspClient.openDocument(uri, 'markdown', 1, text)
      log('文档已打开')
    }

    /**
     * 🚀 文档变化通知
     */
    const notifyDocumentChange = () => {
      if (!lspClient.connected) return

      const uri = 'file:///document.md'
      const text = editor.document.getText()
      const version = Date.now() // 简化版本号

      lspClient.changeDocument(uri, version, [
        {
          text, // 全文更新（简化实现）
        },
      ])
    }

    /**
     * 🚀 请求悬停信息
     */
    const requestHover = async () => {
      if (!lspClient.connected) return

      const { cursor } = editor
      const uri = 'file:///document.md'

      try {
        const result = await lspClient.hover(uri, cursor.line, cursor.column)

        if (result && result.contents) {
          const content = getHoverContent(result.contents)
          editor.emit('hover:show', {
            content,
            position: { line: cursor.line, column: cursor.column },
          })
        }
      } catch (error) {
        console.error('悬停请求失败:', error)
      }
    }

    /**
     * 获取悬停内容
     */
    const getHoverContent = contents => {
      if (typeof contents === 'string') return contents
      if (Array.isArray(contents)) {
        return contents.map(c => (typeof c === 'string' ? c : c.value)).join('\n\n')
      }
      if (contents.value) return contents.value
      return ''
    }

    /**
     * 🚀 连接到LSP服务器
     */
    registerCommand(
      'lsp.connect',
      async serverUrl => {
        try {
          lspClient.serverUrl = serverUrl || 'ws://localhost:3000'
          await lspClient.connect()
          openDocument()
          log('LSP服务器已连接')
        } catch (error) {
          console.error('连接LSP服务器失败:', error)
          log('连接失败: ' + error.message)
        }
      },
      {
        title: '连接LSP服务器',
        description: '连接到语言服务器',
      }
    )

    /**
     * 🚀 断开LSP连接
     */
    registerCommand(
      'lsp.disconnect',
      () => {
        lspClient.disconnect()
        log('LSP服务器已断开')
      },
      {
        title: '断开LSP连接',
      }
    )

    /**
     * 🚀 触发补全命令
     */
    registerCommand('lsp.completion', triggerCompletion, {
      title: '触发补全',
      description: '显示代码补全建议',
    })

    /**
     * 🚀 显示悬停信息
     */
    registerCommand('lsp.hover', requestHover, {
      title: '显示悬停信息',
    })

    /**
     * 🚀 获取LSP状态
     */
    registerCommand(
      'lsp.status',
      () => {
        const stats = lspClient.getStats()
        log('LSP状态: ' + JSON.stringify(stats, null, 2))
        return stats
      },
      {
        title: '查看LSP状态',
      }
    )

    // 注册快捷键
    registerKeybinding('ctrl+space', 'lsp.completion')
    registerKeybinding('ctrl+k ctrl+i', 'lsp.hover')

    // 监听文档变化
    editor.document.on('change', () => {
      // 延迟通知，避免频繁更新
      if (lspClient.connected) {
        setTimeout(notifyDocumentChange, 500)
      }
    })

    // 存储客户端引用
    context.lspClient = lspClient

    log('LSP插件已激活')
    log('使用 Ctrl+Space 触发补全')
  },

  deactivate(context) {
    if (context.lspClient) {
      context.lspClient.destroy()
    }
  },
}
