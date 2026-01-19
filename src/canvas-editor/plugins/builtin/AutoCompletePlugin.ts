/**
 * 代码补全插件
 * 提供Markdown语法、Emoji、代码片段等智能补全
 */

import type { Plugin, PluginContext } from '../../types'

interface CompletionItem {
  label: string
  insertText: string
  description?: string
  detail?: string
  prefix?: string
}

interface CompletionSource {
  trigger?: string
  prefix?: string
  items: CompletionItem[]
}

interface CompletionState {
  active: boolean
  items: CompletionItem[]
  selectedIndex: number
  triggerPosition: { line: number; column: number } | null
  triggerChar: string | null
  sourceType?: string
  prefix?: string
  panel: HTMLDivElement | null
}

interface EditorInterface {
  cursor: { line: number; column: number }
  viewport: any
  textRenderer: { lineHeight: number }
  document: {
    getLine(line: number): string
    insertText(line: number, column: number, text: string): void
    deleteText(startLine: number, startColumn: number, endLine: number, endColumn: number): void
  }
  history: {
    record(operation: any): void
  }
  render(): void
}

const completionSources: {
  markdown: CompletionSource[]
  emoji: CompletionSource[]
  snippets: CompletionItem[]
} = {
  markdown: [
    { trigger: '#', items: [
      { label: '标题', insertText: '# ', description: '一级标题，最高级别的标题' },
      { label: '标题', insertText: '## ', description: '二级标题' },
      { label: '标题', insertText: '### ', description: '三级标题' },
      { label: '标题', insertText: '#### ', description: '四级标题' },
      { label: '标题', insertText: '##### ', description: '五级标题' },
      { label: '标题', insertText: '###### ', description: '六级标题，最低级别的标题' }
    ]},
    { trigger: '-', items: [
      { label: '列表', insertText: '- ', description: '无序列表项' },
      { label: '任务列表', insertText: '- [ ] ', description: '待办事项，可选中的复选框' },
      { label: '任务列表', insertText: '- [x] ', description: '已完成任务' },
      { label: '分隔线', insertText: '---\n', description: '水平分隔线' }
    ]},
    { trigger: '>', items: [
      { label: '引用', insertText: '> ', description: '引用块，用于引用其他内容' }
    ]},
    { trigger: '`', items: [
      { label: '代码', insertText: '`', description: '行内代码，用于标记代码或命令' },
      { label: '代码块', insertText: '``\n\n```', description: '多行代码块，支持语法高亮' }
    ]},
    { trigger: '[', items: [
      { label: '链接', insertText: '[', description: 'Markdown链接语法' },
      { label: '图片', insertText: '![', description: '插入图片' }
    ]},
    { trigger: '*', items: [
      { label: '*斜体*', insertText: '*', description: '斜体文字' },
      { label: '**粗体**', insertText: '**', description: '加粗文字' },
      { label: '***粗斜体***', insertText: '***', description: '加粗且斜体' }
    ]},
    { trigger: '|', items: [
      { label: '表格', insertText: '| ', description: 'Markdown表格分隔符' }
    ]},
    { trigger: '$', items: [
      { label: '数学公式', insertText: '$', description: '行内数学公式，使用LaTeX语法' },
      { label: '数学公式', insertText: '$\n\n$$', description: '块级数学公式，独立行显示' }
    ]}
  ],
  emoji: [
    { trigger: ':', prefix: 'smile', items: [
      { label: ':smile:', insertText: '😊', description: '微笑的脸' },
      { label: ':grin:', insertText: '😁', description: '露齿笑，开心的表情' },
      { label: ':joy:', insertText: '😂', description: '笑哭了，非常有趣' },
      { label: ':heart:', insertText: '❤️', description: '红色爱心' },
      { label: ':fire:', insertText: '🔥', description: '火焰，热门或热烈' },
      { label: ':star:', insertText: '⭐', description: '星星，表示优秀或关注' },
      { label: ':check:', insertText: '✅', description: '完成标记' },
      { label: ':rocket:', insertText: '🚀', description: '火箭，表示发布或进步' },
      { label: ':bulb:', insertText: '💡', description: '灯泡，代表想法或创意' },
      { label: ':tada:', insertText: '🎉', description: '庆祝，表示完成或成功' },
      { label: ':warning:', insertText: '⚠️', description: '警告标志' },
      { label: ':question:', insertText: '❓', description: '疑问' },
      { label: ':thumbsup:', insertText: '👍', description: '点赞，赞同' },
      { label: ':memo:', insertText: '📝', description: '笔记或文档' },
      { label: ':book:', insertText: '📖', description: '书籍或文档' }
    ]}
  ],
  snippets: [
    { 
      prefix: 'table', 
      label: 'table',
      insertText: '| Header1 | Header2 | Header3 |\n| ------- | ------- | ------- |\n| Cell1   | Cell2   | Cell3   |\n',
      description: '插入3列3列的Markdown表格模板'
    },
    {
      prefix: 'code',
      label: 'code',
      insertText: '```javascript\n\n```',
      description: '插入JavaScript代码块，支持语法高亮'
    },
    {
      prefix: 'todo',
      label: 'todo',
      insertText: '- [ ] ',
      description: '插入待办事项，可点击完成'
    },
    {
      prefix: 'mermaid',
      label: 'mermaid',
      insertText: '```mermaid\ngraph TD\n    A[开始] --> B[结束]\n```',
      description: '插入Mermaid流程图模板'
    },
    {
      prefix: 'math',
      label: 'math',
      insertText: '$$\n\n$$',
      description: '插入块级数学公式，使用LaTeX语法'
    },
    {
      prefix: 'quote',
      label: 'quote',
      insertText: '> ',
      description: '插入引用块，用于摘录或引用'
    },
    {
      prefix: 'link',
      label: 'link',
      insertText: '[文字](url)',
      description: '插入链接模板'
    }
  ]
}

let completionState: CompletionState = {
  active: false,
  items: [],
  selectedIndex: 0,
  triggerPosition: null,
  triggerChar: null,
  panel: null
}

export const AutoCompletePlugin: Plugin = {
  id: 'autocomplete',
  name: 'Auto Complete',
  version: '1.0.0',
  description: '智能代码补全',

  activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding } = context
    const ed = editor as unknown as EditorInterface

    completionState = {
      active: false,
      items: [],
      selectedIndex: 0,
      triggerPosition: null,
      triggerChar: null,
      panel: null
    }

    registerCommand('trigger', () => {
      triggerCompletion(ed)
    }, {
      title: '触发补全',
      description: '手动触发代码补全'
    })

    registerCommand('accept', () => {
      if (!completionState.active) return false
      acceptCompletion(ed)
      return true
    }, {
      title: '接受补全',
      description: '接受当前选中的补全项'
    })

    registerCommand('next', () => {
      if (!completionState.active) return false
      selectNext()
      return true
    }, {
      title: '下一个补全',
      description: '选择下一个补全项'
    })

    registerCommand('previous', () => {
      if (!completionState.active) return false
      selectPrevious()
      return true
    }, {
      title: '上一个补全',
      description: '选择上一个补全项'
    })

    registerCommand('cancel', () => {
      if (!completionState.active) return false
      cancelCompletion()
      return true
    }, {
      title: '取消补全',
      description: '关闭补全面板'
    })

    registerKeybinding('ctrl+space', 'trigger')
    registerKeybinding('tab', 'accept')
    registerKeybinding('enter', 'accept')
    registerKeybinding('arrowdown', 'next')
    registerKeybinding('arrowup', 'previous')
    registerKeybinding('escape', 'cancel')

    ;(context as any).onAfterChange?.((data: any) => {
      onTextChange(ed, data)
    })

    createCompletionPanel(ed)
  },

  deactivate() {
    destroyCompletionPanel()
  }
}

function createCompletionPanel(editor: EditorInterface): void {
  const panel = window.document.createElement('div')
  panel.className = 'autocomplete-panel'
  panel.style.cssText = `
    position: absolute;
    display: none;
    background: white;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
    max-height: 320px;
    overflow-y: auto;
    z-index: 1000;
    min-width: 280px;
    max-width: 400px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  `

  window.document.body.appendChild(panel)
  completionState.panel = panel

  panel.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.autocomplete-item')
    if (item) {
      const index = parseInt((item as HTMLElement).dataset.index || '0')
      completionState.selectedIndex = index
      acceptCompletion(editor)
    }
  })
}

function destroyCompletionPanel(): void {
  if (completionState.panel) {
    completionState.panel.remove()
    completionState.panel = null
  }
}

function onTextChange(editor: EditorInterface, _data: any): void {
  const { cursor, document } = editor
  if (!cursor || !document) return

  const line = cursor.line
  const column = cursor.column
  const lineText = document.getLine(line)
  const beforeCursor = lineText.slice(0, column)

  const lastChar = beforeCursor[beforeCursor.length - 1]
  
  const markdownTriggers = ['#', '-', '>', '`', '[', '*', '|', '$']
  if (markdownTriggers.includes(lastChar)) {
    if (column === 1 || beforeCursor[column - 2] === ' ' || lastChar === '|' || lastChar === '$') {
      showCompletion(editor, lastChar, 'markdown')
      return
    }
  }

  const emojiMatch = beforeCursor.match(/:(\w+)$/)
  if (emojiMatch) {
    showCompletion(editor, ':', 'emoji', emojiMatch[1])
    return
  }

  const snippetMatch = beforeCursor.match(/(\w+)$/)
  if (snippetMatch && snippetMatch[1].length >= 2) {
    showCompletion(editor, '', 'snippets', snippetMatch[1])
    return
  }

  cancelCompletion()
}

function showCompletion(editor: EditorInterface, triggerChar: string, sourceType: string, prefix: string = ''): void {
  const { cursor } = editor

  let items: CompletionItem[] = []
  if (sourceType === 'markdown') {
    const source = completionSources.markdown.find(s => s.trigger === triggerChar)
    items = source ? source.items : []
  } else if (sourceType === 'emoji') {
    items = completionSources.emoji[0].items.filter(item => 
      item.label.includes(prefix.toLowerCase())
    )
  } else if (sourceType === 'snippets') {
    items = completionSources.snippets.filter(item =>
      item.prefix?.startsWith(prefix.toLowerCase())
    )
  }

  if (items.length === 0) {
    cancelCompletion()
    return
  }

  completionState.active = true
  completionState.items = items
  completionState.selectedIndex = 0
  completionState.triggerPosition = { line: cursor.line, column: cursor.column }
  completionState.triggerChar = triggerChar
  completionState.sourceType = sourceType
  completionState.prefix = prefix

  renderCompletionPanel(editor)
}

function renderCompletionPanel(editor: EditorInterface): void {
  const { cursor, viewport, textRenderer, document } = editor
  const panel = completionState.panel

  if (!panel) return

  const lineText = document.getLine(cursor.line)
  const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer, lineText)
  
  const container = window.document.querySelector('.canvas-editor')
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  
  panel.style.left = `${rect.left + x}px`
  panel.style.top = `${rect.top + y + textRenderer.lineHeight}px`
  panel.style.display = 'block'

  const html = completionState.items.map((item, index) => {
    const selected = index === completionState.selectedIndex
    const icon = getCompletionIcon(item)
    const description = item.description || item.detail || ''
    
    return `
      <div class="autocomplete-item ${selected ? 'selected' : ''}" data-index="${index}" style="
        display: flex;
        align-items: center;
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f6f8fa;
        gap: 10px;
        ${selected ? 'background: #ddf4ff; border-left: 3px solid #0969da; padding-left: 9px;' : ''}
      ">
        <div style="font-size: 18px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; color: #24292f; font-size: 14px;">${escapeHtml(item.label)}</div>
          ${description ? `<div style="font-size: 12px; color: #57606a; margin-top: 2px;">${escapeHtml(description)}</div>` : ''}
        </div>
      </div>
    `
  }).join('')

  panel.innerHTML = html
}

function getCompletionIcon(item: CompletionItem): string {
  const sourceType = completionState.sourceType
  
  if (sourceType === 'markdown') {
    const iconMap: Record<string, string> = {
      '标题': '🎯',
      '列表': '📋',
      '代码块': '💻',
      '任务列表': '☑️',
      '表格': '📑',
      '引用': '💬',
      '链接': '🔗',
      '图片': '🖼️',
      '数学公式': '🧮'
    }
    return iconMap[item.label] || '📝'
  } else if (sourceType === 'emoji') {
    return item.insertText || '😊'
  } else if (sourceType === 'snippets') {
    return '⚡'
  }
  
  return '📝'
}

function triggerCompletion(editor: EditorInterface): void {
  showCompletion(editor, '', 'snippets', '')
}

function acceptCompletion(editor: EditorInterface): void {
  if (!completionState.active) return

  const { cursor, document, history } = editor
  const item = completionState.items[completionState.selectedIndex]

  if (!item) return

  const lineText = document.getLine(cursor.line)
  let deleteLength = 0

  if (completionState.sourceType === 'emoji') {
    const match = lineText.slice(0, cursor.column).match(/:(\w+)$/)
    if (match) {
      deleteLength = match[0].length
    }
  } else if (completionState.sourceType === 'snippets') {
    const match = lineText.slice(0, cursor.column).match(/(\w+)$/)
    if (match) {
      deleteLength = match[0].length
    }
  }

  if (deleteLength > 0) {
    const startColumn = cursor.column - deleteLength
    history.record({
      type: 'delete',
      line: cursor.line,
      column: startColumn,
      text: lineText.slice(startColumn, cursor.column),
      cursorBefore: { line: cursor.line, column: cursor.column },
      cursorAfter: { line: cursor.line, column: startColumn }
    })
    document.deleteText(cursor.line, startColumn, cursor.line, cursor.column)
    cursor.column = startColumn
  }

  const insertText = item.insertText
  history.record({
    type: 'insert',
    line: cursor.line,
    column: cursor.column,
    text: insertText,
    cursorBefore: { line: cursor.line, column: cursor.column },
    cursorAfter: { line: cursor.line, column: cursor.column + insertText.length }
  })

  document.insertText(cursor.line, cursor.column, insertText)
  
  const lines = insertText.split('\n')
  if (lines.length === 1) {
    cursor.column += insertText.length
  } else {
    cursor.line += lines.length - 1
    cursor.column = lines[lines.length - 1].length
  }

  cancelCompletion()
  editor.render()
}

function selectNext(): void {
  if (!completionState.active) return

  completionState.selectedIndex = 
    (completionState.selectedIndex + 1) % completionState.items.length

  const items = completionState.panel?.querySelectorAll('.autocomplete-item')
  items?.forEach((item, index) => {
    (item as HTMLElement).style.background = index === completionState.selectedIndex ? '#ddf4ff' : ''
    ;(item as HTMLElement).style.borderLeft = index === completionState.selectedIndex ? '3px solid #0969da' : ''
  })
}

function selectPrevious(): void {
  if (!completionState.active) return

  completionState.selectedIndex = 
    (completionState.selectedIndex - 1 + completionState.items.length) % 
    completionState.items.length

  const items = completionState.panel?.querySelectorAll('.autocomplete-item')
  items?.forEach((item, index) => {
    (item as HTMLElement).style.background = index === completionState.selectedIndex ? '#ddf4ff' : ''
    ;(item as HTMLElement).style.borderLeft = index === completionState.selectedIndex ? '3px solid #0969da' : ''
  })
}

function cancelCompletion(): void {
  completionState.active = false
  if (completionState.panel) {
    completionState.panel.style.display = 'none'
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
