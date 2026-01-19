/**
 * 流程图插件
 * 使用Mermaid渲染流程图、时序图等
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { line: number; column: number }
  document: {
    insertText(line: number, column: number, text: string): void
  }
  history: {
    record(operation: any): void
  }
}

type DiagramType = 'flowchart' | 'sequence' | 'gantt'

const templates: Record<DiagramType, string> = {
  flowchart: `\`\`\`mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[执行操作]
    B -->|否| D[其他操作]
    C --> E[结束]
    D --> E
\`\`\``,
  sequence: `\`\`\`mermaid
sequenceDiagram
    participant A as 用户
    participant B as 系统
    A->>B: 发送请求
    B->>B: 处理请求
    B-->>A: 返回响应
\`\`\``,
  gantt: `\`\`\`mermaid
gantt
    title 项目进度
    dateFormat  YYYY-MM-DD
    section 阶段1
    任务1           :a1, 2024-01-01, 30d
    任务2           :after a1, 20d
    section 阶段2
    任务3           :2024-02-01, 12d
\`\`\``
}

export const MermaidPlugin: Plugin = {
  id: 'mermaid',
  name: 'Mermaid Diagrams',
  version: '1.0.0',
  description: 'Mermaid流程图支持',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    registerCommand('insertFlowchart', () => {
      insertDiagram(editor as unknown as EditorInterface, 'flowchart')
    }, {
      title: '插入流程图',
      description: '插入Mermaid流程图'
    })

    registerCommand('insertSequence', () => {
      insertDiagram(editor as unknown as EditorInterface, 'sequence')
    }, {
      title: '插入时序图',
      description: '插入Mermaid时序图'
    })

    registerCommand('insertGantt', () => {
      insertDiagram(editor as unknown as EditorInterface, 'gantt')
    }, {
      title: '插入甘特图',
      description: '插入Mermaid甘特图'
    })

    registerKeybinding('ctrl+shift+d', 'insertFlowchart')

    registerToolbarButton({
      id: 'insert-diagram',
      icon: 'GitNetworkOutline',
      title: '插入流程图 (Ctrl+Shift+D)',
      command: 'mermaid.insertFlowchart'
    })
  },

  deactivate() {
    // 清理资源
  }
}

function insertDiagram(editor: EditorInterface, type: DiagramType): void {
  const { cursor, document, history } = editor

  if (!cursor || !document) return

  const textToInsert = '\n' + (templates[type] || templates.flowchart) + '\n'

  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: textToInsert,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line + textToInsert.split('\n').length - 1, column: 0 }
  })

  document.insertText(cursor.line, cursor.column, textToInsert)

  const lines = textToInsert.split('\n')
  cursor.line += lines.length - 1
  cursor.column = 0

  console.log(`[mermaid] Inserted ${type} diagram`)
}
