/**
 * 代码补全插件
 * 提供Markdown语法、Emoji、代码片段等智能补全
 */
export const AutoCompletePlugin = {
  id: 'autocomplete',
  name: 'Auto Complete',
  version: '1.0.0',
  description: '智能代码补全',

  // 补全数据源
  completionSources: {
    // Markdown语法补全
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

    // Emoji补全
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

    // 代码片段
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
        insertText: '[\u6587\u5b57](url)',
        description: '插入链接模板'
      }
    ]
  },

  activate(context) {
    const { editor, registerCommand, registerKeybinding } = context

    // 当前补全状态
    this.completionState = {
      active: false,
      items: [],
      selectedIndex: 0,
      triggerPosition: null,
      triggerChar: null,
      panel: null
    }

    // 注册补全命令
    registerCommand('trigger', () => {
      this.triggerCompletion(editor)
    }, {
      title: '触发补全',
      description: '手动触发代码补全'
    })

    registerCommand('accept', () => {
      // 只在补全面板激活时执行
      if (!this.completionState.active) return false
      this.acceptCompletion(editor)
      return true
    }, {
      title: '接受补全',
      description: '接受当前选中的补全项'
    })

    registerCommand('next', () => {
      if (!this.completionState.active) return false
      this.selectNext()
      return true
    }, {
      title: '下一个补全',
      description: '选择下一个补全项'
    })

    registerCommand('previous', () => {
      if (!this.completionState.active) return false
      this.selectPrevious()
      return true
    }, {
      title: '上一个补全',
      description: '选择上一个补全项'
    })

    registerCommand('cancel', () => {
      if (!this.completionState.active) return false
      this.cancelCompletion()
      return true
    }, {
      title: '取消补全',
      description: '关闭补全面板'
    })

    // 注册快捷键
    registerKeybinding('ctrl+space', 'trigger')
    // Tab 和 Enter 都用于接受补全，但只在补全面板激活时生效
    registerKeybinding('tab', 'accept')
    registerKeybinding('enter', 'accept')
    registerKeybinding('arrowdown', 'next')
    registerKeybinding('arrowup', 'previous')
    registerKeybinding('escape', 'cancel')

    // 监听文档变化，自动触发补全
    context.onAfterChange((data) => {
      this.onTextChange(editor, data)
    })

    // 创建补全面板
    this.createCompletionPanel(editor)
  },

  deactivate() {
    this.destroyCompletionPanel()
  },

  /**
   * 创建补全面板
   */
  createCompletionPanel(editor) {
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

    // 添加到文档
    window.document.body.appendChild(panel)
    this.completionState.panel = panel

    // 点击项目接受补全
    panel.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item')
      if (item) {
        const index = parseInt(item.dataset.index)
        this.completionState.selectedIndex = index
        this.acceptCompletion(editor)
      }
    })
  },

  /**
   * 销毁补全面板
   */
  destroyCompletionPanel() {
    if (this.completionState.panel) {
      this.completionState.panel.remove()
      this.completionState.panel = null
    }
  },

  /**
   * 文本变化时自动触发补全
   */
  onTextChange(editor, data) {
    const { cursor, document } = editor
    if (!cursor || !document) return

    const line = cursor.line
    const column = cursor.column
    const lineText = document.getLine(line)
    const beforeCursor = lineText.slice(0, column)

    // 检查触发字符
    const lastChar = beforeCursor[beforeCursor.length - 1]
    
    // Markdown语法触发
    const markdownTriggers = ['#', '-', '>', '`', '[', '*', '|', '$']
    if (markdownTriggers.includes(lastChar)) {
      // 检查是否在行首或空格后
      if (column === 1 || beforeCursor[column - 2] === ' ' || lastChar === '|' || lastChar === '$') {
        this.showCompletion(editor, lastChar, 'markdown')
        return
      }
    }

    // Emoji触发 (:word)
    const emojiMatch = beforeCursor.match(/:(\w+)$/)
    if (emojiMatch) {
      this.showCompletion(editor, ':', 'emoji', emojiMatch[1])
      return
    }

    // 片段触发 (word)
    const snippetMatch = beforeCursor.match(/(\w+)$/)
    if (snippetMatch && snippetMatch[1].length >= 2) {
      this.showCompletion(editor, '', 'snippets', snippetMatch[1])
      return
    }

    // 没有匹配，关闭补全
    this.cancelCompletion()
  },

  /**
   * 显示补全
   */
  showCompletion(editor, triggerChar, sourceType, prefix = '') {
    const { cursor, viewport, textRenderer, document: editorDocument } = editor

    // 获取补全项
    let items = []
    if (sourceType === 'markdown') {
      const source = this.completionSources.markdown.find(s => s.trigger === triggerChar)
      items = source ? source.items : []
    } else if (sourceType === 'emoji') {
      items = this.completionSources.emoji[0].items.filter(item => 
        item.label.includes(prefix.toLowerCase())
      )
    } else if (sourceType === 'snippets') {
      items = this.completionSources.snippets.filter(item =>
        item.prefix.startsWith(prefix.toLowerCase())
      )
    }

    if (items.length === 0) {
      this.cancelCompletion()
      return
    }
    
    // 上下文分析和智能排序
    items = this.analyzeAndSortItems(items, editor, triggerChar, prefix)

    // 更新状态
    this.completionState.active = true
    this.completionState.items = items
    this.completionState.selectedIndex = 0
    this.completionState.triggerPosition = { line: cursor.line, column: cursor.column }
    this.completionState.triggerChar = triggerChar
    this.completionState.sourceType = sourceType
    this.completionState.prefix = prefix

    // 渲染补全面板
    this.renderCompletionPanel(editor)
  },
  
  /**
   * 上下文分析和智能排序
   */
  analyzeAndSortItems(items, editor, triggerChar, prefix) {
    const { cursor, document: editorDocument } = editor
    const currentLine = cursor.line
    const lineText = editorDocument.getLine(currentLine)
    
    // 上下文分析
    const context = {
      isStartOfLine: lineText.trim().length === 1, // 是否在行首
      prevLine: currentLine > 0 ? editorDocument.getLine(currentLine - 1) : '',
      hasListAbove: false,
      hasHeadingAbove: false,
      hasCodeBlockAbove: false,
      inList: false
    }
    
    // 分析上一行
    if (context.prevLine) {
      context.hasListAbove = /^\s*[-*+]\s/.test(context.prevLine)
      context.hasHeadingAbove = /^#{1,6}\s/.test(context.prevLine)
      context.hasCodeBlockAbove = context.prevLine.trim().startsWith('```')
    }
    
    // 分析当前行
    context.inList = /^\s*[-*+]\s/.test(lineText)
    
    // 根据上下文调整优先级
    const scoredItems = items.map(item => {
      let score = 0
      
      // 基础分数：前缀匹配度
      if (prefix && item.label) {
        if (item.label.toLowerCase().startsWith(prefix.toLowerCase())) {
          score += 10 // 完全匹配
        } else if (item.label.toLowerCase().includes(prefix.toLowerCase())) {
          score += 5 // 部分匹配
        }
      }
      
      // 上下文加分
      if (context.hasListAbove && item.label.includes('列表')) {
        score += 20 // 上一行是列表，优先推荐列表
      }
      
      if (context.hasHeadingAbove && item.label.includes('标题')) {
        score += 15 // 上一行是标题，推荐标题
      }
      
      if (context.hasCodeBlockAbove && item.label.includes('代码')) {
        score += 15
      }
      
      if (context.isStartOfLine) {
        // 行首位置，优先推荐块级元素
        if (item.label.includes('标题') || item.label.includes('列表') || item.label.includes('代码块')) {
          score += 10
        }
      }
      
      // 常用项加分
      const commonItems = ['标题', '列表', '代码块', '链接']
      if (commonItems.some(common => item.label.includes(common))) {
        score += 3
      }
      
      return { item, score }
    })
    
    // 按分数排序
    scoredItems.sort((a, b) => b.score - a.score)
    
    return scoredItems.map(si => si.item)
  },

  /**
   * 渲染补全面板
   */
  renderCompletionPanel(editor) {
    const { cursor, viewport, textRenderer, document: editorDocument } = editor
    const panel = this.completionState.panel

    if (!panel) return

    // 计算位置
    const lineText = editorDocument.getLine(cursor.line)
    const { x, y } = viewport.docToCanvas(cursor.line, cursor.column, textRenderer, lineText)
    
    // 转换为屏幕坐标
    const container = window.document.querySelector('.canvas-editor')
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    
    panel.style.left = `${rect.left + x}px`
    panel.style.top = `${rect.top + y + textRenderer.lineHeight}px`
    panel.style.display = 'block'

    // 渲染补全项（带图标和详细描述）
    const html = this.completionState.items.map((item, index) => {
      const selected = index === this.completionState.selectedIndex
      const icon = this.getCompletionIcon(item)
      const description = item.description || item.detail || ''
      
      return `
        <div class="autocomplete-item ${selected ? 'selected' : ''}" data-index="${index}">
          <div class="autocomplete-icon">${icon}</div>
          <div class="autocomplete-content">
            <div class="autocomplete-label">${this.escapeHtml(item.label)}</div>
            ${description ? `<div class="autocomplete-description">${this.escapeHtml(description)}</div>` : ''}
          </div>
          ${item.insertText !== item.label ? `<div class="autocomplete-insert-text">${this.escapeHtml(item.insertText)}</div>` : ''}
        </div>
      `
    }).join('')

    panel.innerHTML = html

    // 添加样式
    this.ensureStyles()
  },
  
  /**
   * 获取补全项图标
   */
  getCompletionIcon(item) {
    const sourceType = this.completionState.sourceType
    
    if (sourceType === 'markdown') {
      const iconMap = {
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
  },
  
  /**
   * 确保样式存在
   */
  ensureStyles() {
    if (window.document.getElementById('autocomplete-styles')) return
    
    const style = `
      <style>
        .autocomplete-panel::-webkit-scrollbar {
          width: 8px;
        }
        .autocomplete-panel::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .autocomplete-panel::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        .autocomplete-panel::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        
        .autocomplete-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f6f8fa;
          transition: background 0.1s ease;
          gap: 10px;
        }
        .autocomplete-item:last-child {
          border-bottom: none;
        }
        .autocomplete-item:hover {
          background: #f6f8fa;
        }
        .autocomplete-item.selected {
          background: #ddf4ff;
          border-left: 3px solid #0969da;
          padding-left: 9px;
        }
        
        .autocomplete-icon {
          font-size: 18px;
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .autocomplete-content {
          flex: 1;
          min-width: 0;
        }
        
        .autocomplete-label {
          font-weight: 500;
          color: #24292f;
          font-size: 14px;
          margin-bottom: 2px;
        }
        
        .autocomplete-description {
          font-size: 12px;
          color: #57606a;
          line-height: 1.4;
          margin-top: 2px;
        }
        
        .autocomplete-insert-text {
          font-size: 11px;
          color: #8c959f;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
          background: #f6f8fa;
          padding: 2px 6px;
          border-radius: 3px;
          flex-shrink: 0;
        }
      </style>
    `
    
    const styleEl = window.document.createElement('div')
    styleEl.id = 'autocomplete-styles'
    styleEl.innerHTML = style
    window.document.head.appendChild(styleEl)
  },

  /**
   * 手动触发补全
   */
  triggerCompletion(editor) {
    const { cursor, document } = editor
    if (!cursor || !document) return

    const lineText = document.getLine(cursor.line)
    const beforeCursor = lineText.slice(0, cursor.column)

    // 显示片段补全
    this.showCompletion(editor, '', 'snippets', '')
  },

  /**
   * 接受补全
   */
  acceptCompletion(editor) {
    if (!this.completionState.active) return

    const { cursor, document, history } = editor
    const item = this.completionState.items[this.completionState.selectedIndex]

    if (!item) return

    // 删除触发文本
    const lineText = document.getLine(cursor.line)
    let deleteLength = 0

    if (this.completionState.sourceType === 'emoji') {
      // 删除 :word
      const match = lineText.slice(0, cursor.column).match(/:(\w+)$/)
      if (match) {
        deleteLength = match[0].length
      }
    } else if (this.completionState.sourceType === 'snippets') {
      // 删除 word
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

    // 插入补全文本
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
    
    // 移动光标
    const lines = insertText.split('\n')
    if (lines.length === 1) {
      cursor.column += insertText.length
    } else {
      cursor.line += lines.length - 1
      cursor.column = lines[lines.length - 1].length
    }

    // 关闭补全
    this.cancelCompletion()

    // 触发渲染
    editor.render()
  },

  /**
   * 选择下一个
   */
  selectNext() {
    if (!this.completionState.active) return

    this.completionState.selectedIndex = 
      (this.completionState.selectedIndex + 1) % this.completionState.items.length

    // 更新UI
    const items = this.completionState.panel.querySelectorAll('.autocomplete-item')
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.completionState.selectedIndex)
    })
  },

  /**
   * 选择上一个
   */
  selectPrevious() {
    if (!this.completionState.active) return

    this.completionState.selectedIndex = 
      (this.completionState.selectedIndex - 1 + this.completionState.items.length) % 
      this.completionState.items.length

    // 更新UI
    const items = this.completionState.panel.querySelectorAll('.autocomplete-item')
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.completionState.selectedIndex)
    })
  },

  /**
   * 取消补全
   */
  cancelCompletion() {
    this.completionState.active = false
    if (this.completionState.panel) {
      this.completionState.panel.style.display = 'none'
    }
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
