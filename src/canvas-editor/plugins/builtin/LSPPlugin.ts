/**
 * LSP集成插件
 * 将LSP客户端集成到编辑器，提供智能补全、诊断等功能
 */

import type { Plugin, PluginContext, Diagnostic } from '../../types'

interface LSPClientInterface {
  connected: boolean
  serverUrl: string | null
  connect(): Promise<void>
  disconnect(): void
  completion(uri: string, line: number, character: number): Promise<any>
  hover(uri: string, line: number, character: number): Promise<any>
  openDocument(uri: string, languageId: string, version: number, text: string): void
  changeDocument(uri: string, version: number, changes: any[]): void
  getStats(): any
  destroy(): void
}

interface EditorInterface {
  cursor: { line: number; column: number }
  document: {
    getText(): string
    on(event: string, handler: () => void): void
  }
  textRenderer?: {
    setDiagnostics(diagnostics: Diagnostic[]): void
  }
  render(): void
  emit(event: string, data: any): void
}

type LogFn = (...args: any[]) => void

// Placeholder for actual LSP client implementation
class LSPClient implements LSPClientInterface {
  connected = false
  serverUrl: string | null = null
  private onDiagnostics: ((uri: string, diagnostics: any[]) => void) | null = null

  constructor(options: { serverUrl: string | null; onDiagnostics: (uri: string, diagnostics: any[]) => void }) {
    this.serverUrl = options.serverUrl
    this.onDiagnostics = options.onDiagnostics
  }

  async connect(): Promise<void> {
    // Placeholder implementation
    this.connected = true
  }

  disconnect(): void {
    this.connected = false
  }

  async completion(_uri: string, _line: number, _character: number): Promise<any> {
    return { items: [] }
  }

  async hover(_uri: string, _line: number, _character: number): Promise<any> {
    return null
  }

  openDocument(_uri: string, _languageId: string, _version: number, _text: string): void {
    // Placeholder
  }

  changeDocument(_uri: string, _version: number, _changes: any[]): void {
    // Placeholder
  }

  getStats(): any {
    return { connected: this.connected }
  }

  destroy(): void {
    this.disconnect()
  }
}

export const LSPPlugin: Plugin = {
  id: 'lsp',
  name: 'LSP Support',
  version: '1.0.0',
  description: '语言服务器协议支持，提供智能补全和诊断',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, log } = context
    const ed = editor as unknown as EditorInterface

    const lspClient = new LSPClient({
      serverUrl: null,
      onDiagnostics: (uri, diagnostics) => {
        handleDiagnostics(ed, diagnostics, log)
      },
    })

    let completionItems: any[] = []
    let completionVisible = false
    let completionTriggerPosition: { line: number; character: number } | null = null

    const triggerCompletion = async () => {
      if (!lspClient.connected) {
        log('LSP客户端未连接')
        return
      }

      const { cursor, document } = ed
      const uri = 'file:///document.md'
      const line = cursor.line
      const character = cursor.column

      try {
        const result = await lspClient.completion(uri, line, character)

        if (result && result.items) {
          completionItems = Array.isArray(result.items) ? result.items : result.items.items
          completionVisible = completionItems.length > 0
          completionTriggerPosition = { line, character }

          ed.emit('completion:show', {
            items: completionItems,
            position: completionTriggerPosition,
          })

          log(`显示 ${completionItems.length} 个补全项`)
        }
      } catch (error) {
        console.error('补全请求失败:', error)
      }
    }

    const openDocument = () => {
      if (!lspClient.connected) return

      const uri = 'file:///document.md'
      const text = ed.document.getText()

      lspClient.openDocument(uri, 'markdown', 1, text)
      log('文档已打开')
    }

    const notifyDocumentChange = () => {
      if (!lspClient.connected) return

      const uri = 'file:///document.md'
      const text = ed.document.getText()
      const version = Date.now()

      lspClient.changeDocument(uri, version, [{ text }])
    }

    const requestHover = async () => {
      if (!lspClient.connected) return

      const { cursor } = ed
      const uri = 'file:///document.md'

      try {
        const result = await lspClient.hover(uri, cursor.line, cursor.column)

        if (result && result.contents) {
          const content = getHoverContent(result.contents)
          ed.emit('hover:show', {
            content,
            position: { line: cursor.line, column: cursor.column },
          })
        }
      } catch (error) {
        console.error('悬停请求失败:', error)
      }
    }

    registerCommand(
      'lsp.connect',
      async (serverUrl?: string) => {
        try {
          lspClient.serverUrl = serverUrl || 'ws://localhost:3000'
          await lspClient.connect()
          openDocument()
          log('LSP服务器已连接')
        } catch (error: any) {
          console.error('连接LSP服务器失败:', error)
          log('连接失败: ' + error.message)
        }
      },
      {
        title: '连接LSP服务器',
        description: '连接到语言服务器',
      }
    )

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

    registerCommand('lsp.completion', triggerCompletion, {
      title: '触发补全',
      description: '显示代码补全建议',
    })

    registerCommand('lsp.hover', requestHover, {
      title: '显示悬停信息',
    })

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

    registerKeybinding('ctrl+space', 'lsp.completion')

    ed.document.on('change', () => {
      if (lspClient.connected) {
        setTimeout(notifyDocumentChange, 500)
      }
    })

    ;(context as any).lspClient = lspClient

    log('LSP插件已激活')
    log('使用 Ctrl+Space 触发补全')
  },

  deactivate(context?: any) {
    if (context && context.lspClient) {
      context.lspClient.destroy()
    }
  },
}

function handleDiagnostics(editor: EditorInterface, diagnostics: any[], log: LogFn): void {
  const editorDiagnostics: Diagnostic[] = diagnostics.map(diag => ({
    line: diag.range.start.line,
    column: diag.range.start.character,
    length: diag.range.end.character - diag.range.start.character,
    message: diag.message,
    severity: getDiagnosticSeverity(diag.severity),
    source: diag.source || 'lsp',
  }))

  if (editor.textRenderer && editor.textRenderer.setDiagnostics) {
    editor.textRenderer.setDiagnostics(editorDiagnostics)
    editor.render()
  }

  log(`收到 ${diagnostics.length} 个诊断`)
}

function getDiagnosticSeverity(lspSeverity: number): 'error' | 'warning' | 'info' {
  const map: Record<number, 'error' | 'warning' | 'info'> = {
    1: 'error',
    2: 'warning',
    3: 'info',
    4: 'info',
  }
  return map[lspSeverity] || 'info'
}

function getHoverContent(contents: any): string {
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) {
    return contents.map(c => (typeof c === 'string' ? c : c.value)).join('\n\n')
  }
  if (contents.value) return contents.value
  return ''
}
