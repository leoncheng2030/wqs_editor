/**
 * 流程图插件
 * 使用Mermaid渲染流程图、时序图等
 */
export const MermaidPlugin = {
  id: 'mermaid',
  name: 'Mermaid Diagrams',
  version: '1.0.0',
  description: 'Mermaid流程图支持',

  activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton } = context

    // 注册插入流程图命令
    registerCommand('insertFlowchart', () => {
      this.insertDiagram(editor, 'flowchart')
    }, {
      title: '插入流程图',
      description: '插入Mermaid流程图'
    })

    // 注册插入时序图命令
    registerCommand('insertSequence', () => {
      this.insertDiagram(editor, 'sequence')
    }, {
      title: '插入时序图',
      description: '插入Mermaid时序图'
    })

    // 注册插入甘特图命令
    registerCommand('insertGantt', () => {
      this.insertDiagram(editor, 'gantt')
    }, {
      title: '插入甘特图',
      description: '插入Mermaid甘特图'
    })

    // 注册快捷键
    registerKeybinding('ctrl+shift+d', 'insertFlowchart')

    // 注册工具栏按钮
    registerToolbarButton({
      id: 'insert-diagram',
      icon: '📊',
      title: '插入流程图 (Ctrl+Shift+D)',
      command: 'mermaid.insertFlowchart'
    })
  },

  deactivate() {
    // 清理资源
  },

  /**
   * 插入图表
   */
  insertDiagram(editor, type) {
    const { cursor, document, history } = editor

    if (!cursor || !document) return

    const templates = {
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

    const textToInsert = '\n' + (templates[type] || templates.flowchart) + '\n'

    // 记录操作
    history.record({
      type: 'insert',
      line: cursor.line,
      column: cursor.column,
      text: textToInsert,
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line + textToInsert.split('\n').length - 1, column: 0 }
    })

    // 插入文本
    document.insertText(cursor.line, cursor.column, textToInsert)

    // 移动光标到图表后
    const lines = textToInsert.split('\n')
    cursor.line += lines.length - 1
    cursor.column = 0

    console.log(`[mermaid] Inserted ${type} diagram`)
  }
}
