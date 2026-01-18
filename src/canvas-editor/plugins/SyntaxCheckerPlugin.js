/**
 * 语法检查插件
 * 提供Markdown语法检查、拼写检查、格式规范检查
 */
export const SyntaxCheckerPlugin = {
  id: 'syntax-checker',
  name: 'Syntax Checker',
  version: '1.0.0',
  description: 'Markdown语法检查和诊断',

  // 检查规则
  rules: {
    // 标题规则
    heading: {
      enabled: true,
      name: '标题格式',
      check: (line, lineText) => {
        const issues = []

        // 标题后没有空格：检查 # 后面是否直接跟着非空格的字符（不包括#）
        // 注意：只检查半角空格，全角空格也会报错
        const headingMatch = lineText.match(/^(#{1,6})([^ \t#])/)
        if (headingMatch) {
          issues.push({
            line,
            column: headingMatch[1].length,
            length: 1,
            severity: 'warning',
            message: '标题符号后应该有空格',
            rule: 'heading-space',
            fix: { insert: ' ', at: headingMatch[1].length }
          })
        }

        return issues
      }
    },

    // 列表规则
    list: {
      enabled: true,
      name: '列表格式',
      check: (line, lineText) => {
        const issues = []

        // 无序列表没有空格
        const unorderedMatch = lineText.match(/^(\s*)([-*+])(\S)/)
        if (unorderedMatch) {
          issues.push({
            line,
            column: unorderedMatch[1].length + unorderedMatch[2].length,
            length: 1,
            severity: 'warning',
            message: '列表符号后应该有空格',
            rule: 'list-space'
          })
        }

        // 有序列表没有空格
        const orderedMatch = lineText.match(/^(\s*)(\d+\.)(\S)/)
        if (orderedMatch) {
          issues.push({
            line,
            column: orderedMatch[1].length + orderedMatch[2].length,
            length: 1,
            severity: 'warning',
            message: '列表编号后应该有空格',
            rule: 'list-space'
          })
        }

        return issues
      }
    },

    // 代码块规则
    codeBlock: {
      enabled: true,
      name: '代码块格式',
      check: (line, lineText, context) => {
        const issues = []

        // 代码块围栏不对称
        if (lineText.trim().startsWith('```')) {
          const backticks = lineText.match(/^`+/)?.[0] || ''
          if (backticks.length < 3) {
            issues.push({
              line,
              column: 0,
              length: backticks.length,
              severity: 'error',
              message: '代码块需要至少3个反引号',
              rule: 'code-fence'
            })
          }
        }

        return issues
      }
    },

    // 链接规则
    link: {
      enabled: true,
      name: '链接格式',
      check: (line, lineText) => {
        const issues = []

        // 不完整的链接语法
        const incompleteLinkMatch = lineText.match(/\[([^\]]+)\]\s*\(/g)
        if (incompleteLinkMatch) {
          incompleteLinkMatch.forEach(match => {
            const index = lineText.indexOf(match)
            // 检查是否有闭合的括号
            const afterLink = lineText.slice(index + match.length)
            if (!afterLink.includes(')')) {
              issues.push({
                line,
                column: index,
                length: match.length,
                severity: 'error',
                message: '链接语法不完整，缺少闭合括号',
                rule: 'incomplete-link'
              })
            }
          })
        }

        // 空链接
        const emptyLinkMatch = lineText.match(/\[([^\]]+)\]\(\s*\)/g)
        if (emptyLinkMatch) {
          emptyLinkMatch.forEach(match => {
            const index = lineText.indexOf(match)
            issues.push({
              line,
              column: index,
              length: match.length,
              severity: 'warning',
              message: '链接URL为空',
              rule: 'empty-link'
            })
          })
        }

        return issues
      }
    },

    // 表格规则
    table: {
      enabled: true,
      name: '表格格式',
      check: (line, lineText, context) => {
        const issues = []

        // 表格列不对齐
        if (lineText.trim().startsWith('|')) {
          const cells = lineText.split('|').filter(c => c.trim())
          
          // 检查分隔行
          if (cells.every(c => /^[\s-:]+$/.test(c))) {
            // 这是分隔行，检查是否有效
            const validSeparator = cells.every(c => 
              /^:?-+:?$/.test(c.trim())
            )
            if (!validSeparator) {
              issues.push({
                line,
                column: 0,
                length: lineText.length,
                severity: 'error',
                message: '表格分隔行格式不正确',
                rule: 'table-separator'
              })
            }
          }
        }

        return issues
      }
    },

    // 任务列表规则
    taskList: {
      enabled: true,
      name: '任务列表格式',
      check: (line, lineText) => {
        const issues = []

        // 任务列表格式错误
        const taskMatch = lineText.match(/^(\s*)[-*+]\s+\[(.)\]/)
        if (taskMatch) {
          const checkbox = taskMatch[2]
          if (checkbox !== ' ' && checkbox !== 'x' && checkbox !== 'X') {
            issues.push({
              line,
              column: taskMatch[0].length - 2,
              length: 1,
              severity: 'warning',
              message: '任务列表复选框应该是 [ ] 或 [x]',
              rule: 'task-checkbox'
            })
          }

          // 检查复选框后是否有空格
          const afterCheckbox = lineText.slice(taskMatch[0].length)
          if (afterCheckbox && !afterCheckbox.startsWith(' ')) {
            issues.push({
              line,
              column: taskMatch[0].length,
              length: 1,
              severity: 'warning',
              message: '复选框后应该有空格',
              rule: 'task-space'
            })
          }
        }

        return issues
      }
    },

    // 多余空行
    emptyLines: {
      enabled: true,
      name: '空行规范',
      check: (line, lineText, context) => {
        const issues = []

        if (lineText.trim() === '') {
          // 连续超过2个空行
          if (context.emptyLineCount >= 2) {
            issues.push({
              line,
              column: 0,
              length: 0,
              severity: 'info',
              message: '连续空行过多，建议最多保留1个',
              rule: 'multiple-blank-lines'
            })
          }
        }

        return issues
      }
    },

    // 行尾空格
    trailingSpace: {
      enabled: true,
      name: '行尾空格',
      check: (line, lineText) => {
        const issues = []

        const trailingMatch = lineText.match(/\s+$/)
        if (trailingMatch) {
          issues.push({
            line,
            column: lineText.length - trailingMatch[0].length,
            length: trailingMatch[0].length,
            severity: 'info',
            message: '行尾有多余空格',
            rule: 'trailing-whitespace'
          })
        }

        return issues
      }
    },
    
    // 标题层级
    headingLevel: {
      enabled: true,
      name: '标题层级',
      check: (line, lineText, context) => {
        const issues = []
        
        const headingMatch = lineText.match(/^(#{1,6})\s/)
        if (headingMatch) {
          const currentLevel = headingMatch[1].length
          const prevLevel = context.lastHeadingLevel || 0
          
          // 检查是否跳过级别（如从H1直接到H3）
          if (prevLevel > 0 && currentLevel > prevLevel + 1) {
            issues.push({
              line,
              column: 0,
              length: headingMatch[1].length,
              severity: 'warning',
              message: `标题级别跳过，从 H${prevLevel} 直接到 H${currentLevel}`,
              rule: 'heading-increment'
            })
          }
          
          context.lastHeadingLevel = currentLevel
        }
        
        return issues
      }
    },
    
    // 图片路径
    imagePath: {
      enabled: true,
      name: '图片路径',
      check: (line, lineText) => {
        const issues = []
        
        // 匹配图片语法 ![alt](path)
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
        let match
        
        while ((match = imageRegex.exec(lineText)) !== null) {
          const alt = match[1]
          const path = match[2]
          
          // 检查空路径
          if (!path || path.trim() === '') {
            issues.push({
              line,
              column: match.index,
              length: match[0].length,
              severity: 'error',
              message: '图片路径为空',
              rule: 'empty-image-path'
            })
          }
          
          // 检查空alt文本
          if (!alt || alt.trim() === '') {
            issues.push({
              line,
              column: match.index,
              length: match[0].length,
              severity: 'info',
              message: '建议为图片添加alt描述文字',
              rule: 'empty-image-alt'
            })
          }
        }
        
        return issues
      }
    },
    
    // 链接有效性
    linkValidity: {
      enabled: false, // 默认禁用，因为需要网络请求
      name: '链接有效性',
      check: (line, lineText) => {
        const issues = []
        
        // 匹配链接语法 [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
        let match
        
        while ((match = linkRegex.exec(lineText)) !== null) {
          const url = match[2]
          
          // 检查是否为绝对URL
          if (url.startsWith('http://') || url.startsWith('https://')) {
            // 简单的URL格式验证
            try {
              new URL(url)
            } catch (e) {
              issues.push({
                line,
                column: match.index,
                length: match[0].length,
                severity: 'warning',
                message: 'URL格式不正确',
                rule: 'invalid-url'
              })
            }
          }
        }
        
        return issues
      }
    },
    
    // 代码块语言
    codeLanguage: {
      enabled: true,
      name: '代码块语言',
      check: (line, lineText, context) => {
        const issues = []
        
        // 检查代码块起始行
        if (lineText.trimStart().startsWith('```')) {
          const lang = lineText.trim().slice(3).trim()
          
          // 如果是代码块开始且没有指定语言
          if (!context.inCodeBlock && lang === '') {
            issues.push({
              line,
              column: 0,
              length: 3,
              severity: 'info',
              message: '建议为代码块指定语言，以启用语法高亮',
              rule: 'code-language'
            })
          }
        }
        
        return issues
      }
    },
    
    // 列表缩进
    listIndent: {
      enabled: true,
      name: '列表缩进',
      check: (line, lineText) => {
        const issues = []
        
        const listMatch = lineText.match(/^(\s*)([-*+])\s/)
        if (listMatch) {
          const indent = listMatch[1].length
          
          // 检查缩进是否为2或4的倍数
          if (indent > 0 && indent % 2 !== 0) {
            issues.push({
              line,
              column: 0,
              length: indent,
              severity: 'info',
              message: '列表缩进建议使用2或4个空格',
              rule: 'list-indent'
            })
          }
        }
        
        return issues
      }
    }
  },

  activate(context) {
    const { editor, registerCommand, onAfterChange } = context

    // 诊断结果
    this.diagnostics = []

    // 注册命令
    registerCommand('check', () => {
      this.checkSyntax(editor)
    }, {
      title: '检查语法',
      description: '检查Markdown语法'
    })

    registerCommand('fix', (line) => {
      this.fixIssue(editor, line)
    }, {
      title: '修复问题',
      description: '自动修复语法问题'
    })

    registerCommand('toggle', (ruleName) => {
      this.toggleRule(ruleName)
    }, {
      title: '切换规则',
      description: '启用/禁用检查规则'
    })
    
    registerCommand('config', () => {
      this.showConfigPanel()
    }, {
      title: '配置规则',
      description: '打开语法检查配置面板'
    })

    // 监听文档变化，自动检查
    onAfterChange(() => {
      // 延迟检查，避免频繁触发
      clearTimeout(this.checkTimer)
      this.checkTimer = setTimeout(() => {
        this.checkSyntax(editor)
      }, 500)
    })

    // 创建诊断面板
    this.createDiagnosticPanel(editor)

    // 初始检查
    this.checkSyntax(editor)
  },

  deactivate() {
    clearTimeout(this.checkTimer)
    this.destroyDiagnosticPanel()
  },

  /**
   * 创建诊断面板（改为小型状态栏 + 波浪线标记）
   */
  createDiagnosticPanel(editor) {
    // 创建状态栏（底部小条）
    const statusBar = document.createElement('div')
    statusBar.className = 'diagnostic-status-bar'
    statusBar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 24px;
      background: #f5f5f5;
      border-top: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      z-index: 100;
      user-select: none;
    `

    const container = document.querySelector('.canvas-editor-container')
    if (container) {
      container.appendChild(statusBar)
    }

    this.diagnosticStatusBar = statusBar
    
    // 点击状态栏切换详细面板
    statusBar.addEventListener('click', () => {
      this.toggleDetailPanel()
    })

    // 创建详细面板（默认隐藏）
    const detailPanel = document.createElement('div')
    detailPanel.className = 'diagnostic-detail-panel'
    detailPanel.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 0;
      right: 0;
      max-height: 200px;
      background: white;
      border-top: 1px solid #e0e0e0;
      overflow-y: auto;
      font-size: 13px;
      display: none;
      z-index: 99;
    `

    if (container) {
      container.appendChild(detailPanel)
    }

    this.diagnosticDetailPanel = detailPanel

    // 添加样式
    const style = `
      <style>
        .diagnostic-status-bar:hover {
          background: #ebebeb;
        }
        .diagnostic-status-icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
        }
        .diagnostic-status-icon.error {
          background: #f44336;
        }
        .diagnostic-status-icon.warning {
          background: #ff9800;
        }
        .diagnostic-status-icon.info {
          background: #2196f3;
        }
        .diagnostic-item {
          padding: 6px 12px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .diagnostic-item:hover {
          background: #f9f9f9;
        }
        .diagnostic-severity {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .diagnostic-severity.error {
          background: #f44336;
        }
        .diagnostic-severity.warning {
          background: #ff9800;
        }
        .diagnostic-severity.info {
          background: #2196f3;
        }
        .diagnostic-message {
          flex: 1;
          color: #333;
        }
        .diagnostic-location {
          color: #888;
          font-size: 11px;
        }
        
        /* 行内波浪线标记 */
        .syntax-error-underline {
          text-decoration: underline wavy #f44336;
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
        }
        .syntax-warning-underline {
          text-decoration: underline wavy #ff9800;
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
        }
        .syntax-info-underline {
          text-decoration: underline wavy #2196f3;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }
      </style>
    `
    if (!document.getElementById('diagnostic-styles')) {
      const styleEl = document.createElement('div')
      styleEl.id = 'diagnostic-styles'
      styleEl.innerHTML = style
      document.head.appendChild(styleEl)
    }
  },

  /**
   * 销毁诊断面板
   */
  destroyDiagnosticPanel() {
    if (this.diagnosticStatusBar) {
      this.diagnosticStatusBar.remove()
      this.diagnosticStatusBar = null
    }
    if (this.diagnosticDetailPanel) {
      this.diagnosticDetailPanel.remove()
      this.diagnosticDetailPanel = null
    }
  },

  /**
   * 切换详细面板
   */
  toggleDetailPanel() {
    if (!this.diagnosticDetailPanel) return
    
    const isVisible = this.diagnosticDetailPanel.style.display !== 'none'
    this.diagnosticDetailPanel.style.display = isVisible ? 'none' : 'block'
  },

  /**
   * 检查语法
   */
  checkSyntax(editor) {
    const { document } = editor
    if (!document) return

    this.diagnostics = []
    const context = {
      emptyLineCount: 0,
      inCodeBlock: false,
      codeBlockStart: -1
    }

    // 逐行检查
    for (let line = 0; line < document.getLineCount(); line++) {
      const lineText = document.getLine(line)

      // 更新上下文
      if (lineText.trim() === '') {
        context.emptyLineCount++
      } else {
        context.emptyLineCount = 0
      }

      // 代码块上下文
      if (lineText.trim().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
        if (context.inCodeBlock) {
          context.codeBlockStart = line
        }
      }

      // 跳过代码块内容
      if (context.inCodeBlock && line !== context.codeBlockStart) {
        continue
      }

      // 应用所有规则
      for (const ruleKey in this.rules) {
        const rule = this.rules[ruleKey]
        if (!rule.enabled) continue

        const issues = rule.check(line, lineText, context)
        this.diagnostics.push(...issues)
      }
    }

    // 更新UI
    this.updateDiagnosticPanel(editor)
    
    // 关键：将诊断数据传递给渲染器，显示行内波浪线
    const { textRenderer } = editor
    if (textRenderer && textRenderer.setDiagnostics) {
      textRenderer.setDiagnostics(this.diagnostics)
    }
    
    // 触发渲染
    editor.render()
  },

  /**
   * 更新诊断面板（更新状态栏和详细面板）
   */
  updateDiagnosticPanel(editor) {
    // 更新状态栏
    this.updateStatusBar()
    
    // 更新详细面板
    this.updateDetailPanel(editor)
  },

  /**
   * 更新状态栏
   */
  updateStatusBar() {
    const statusBar = this.diagnosticStatusBar
    if (!statusBar) return
  
    if (this.diagnostics.length === 0) {
      statusBar.style.display = 'none'
      return
    }
  
    statusBar.style.display = 'flex'
  
    // 统计
    const errorCount = this.diagnostics.filter(d => d.severity === 'error').length
    const warningCount = this.diagnostics.filter(d => d.severity === 'warning').length
    const infoCount = this.diagnostics.filter(d => d.severity === 'info').length
  
    let html = ''
    if (errorCount > 0) {
      html += `<span class="diagnostic-status-icon error" title="\u9519\u8bef"></span>${errorCount}`
    }
    if (warningCount > 0) {
      html += `<span style="margin-left: 12px;"><span class="diagnostic-status-icon warning" title="\u8b66\u544a"></span>${warningCount}</span>`
    }
    if (infoCount > 0) {
      html += `<span style="margin-left: 12px;"><span class="diagnostic-status-icon info" title="\u63d0\u793a"></span>${infoCount}</span>`
    }
    html += `<span style="margin-left: 12px; color: #999;">点击查看详情</span>`
    html += `<span style="margin-left: auto; cursor: pointer; padding: 2px 8px; background: #fff; border-radius: 3px; border: 1px solid #ddd;" onclick="document.dispatchEvent(new CustomEvent('syntax-checker-config'))">⚙️ 设置</span>`
  
    statusBar.innerHTML = html
      
    // 监听配置事件
    if (!this.configEventBound) {
      document.addEventListener('syntax-checker-config', () => {
        this.showConfigPanel()
      })
      this.configEventBound = true
    }
  },

  /**
   * 更新详细面板
   */
  updateDetailPanel(editor) {
    const panel = this.diagnosticDetailPanel
    if (!panel) return

    if (this.diagnostics.length === 0) {
      panel.style.display = 'none'
      return
    }

    const html = this.diagnostics.map((diagnostic, index) => `
      <div class="diagnostic-item" data-line="${diagnostic.line}">
        <span class="diagnostic-severity ${diagnostic.severity}"></span>
        <span class="diagnostic-message">${this.escapeHtml(diagnostic.message)}</span>
        <span class="diagnostic-location">${diagnostic.line + 1}:${diagnostic.column + 1}</span>
      </div>
    `).join('')

    panel.innerHTML = html

    // 绑定点击事件
    panel.querySelectorAll('.diagnostic-item').forEach(item => {
      item.addEventListener('click', () => {
        const line = parseInt(item.dataset.line)
        this.jumpToLine(editor, line)
      })
    })
  },

  /**
   * 跳转到行
   */
  jumpToLine(editor, line) {
    const { cursor, viewport, render } = editor
    
    cursor.setPosition(line, 0)
    viewport.scrollToLine(line)
    render()
  },

  /**
   * 修复问题
   */
  fixIssue(editor, line) {
    const { document, history } = editor

    // 查找该行的可修复问题
    const issues = this.diagnostics.filter(d => d.line === line && d.fix)

    if (issues.length === 0) {
      console.log('[syntax-checker] No fixable issues on this line')
      return
    }

    // 应用修复
    issues.forEach(issue => {
      if (issue.fix.insert) {
        history.record({
          type: 'insert',
          line: issue.line,
          column: issue.fix.at,
          text: issue.fix.insert,
          cursorBefore: { line: issue.line, column: issue.fix.at },
          cursorAfter: { line: issue.line, column: issue.fix.at + issue.fix.insert.length }
        })

        document.insertText(issue.line, issue.fix.at, issue.fix.insert)
      }
    })

    // 重新检查
    this.checkSyntax(editor)
    editor.render()
  },

  /**
   * 切换规则
   */
  toggleRule(ruleName) {
    if (this.rules[ruleName]) {
      this.rules[ruleName].enabled = !this.rules[ruleName].enabled
    }
  },
  
  /**
   * 显示配置面板
   */
  showConfigPanel() {
    // 如果已经存在，切换显示/隐藏
    if (this.configPanel) {
      const isVisible = this.configPanel.style.display !== 'none'
      this.configPanel.style.display = isVisible ? 'none' : 'block'
      return
    }
      
    // 创建配置面板
    const panel = document.createElement('div')
    panel.className = 'syntax-checker-config-panel'
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-height: 600px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      z-index: 1001;
      display: flex;
      flex-direction: column;
    `
      
    // 标题栏
    const header = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">⚠️ 语法检查配置</h3>
        <span style="cursor: pointer; font-size: 20px; color: #666; line-height: 1;" onclick="this.closest('.syntax-checker-config-panel').style.display='none'">×</span>
      </div>
    `
    
    // 规则列表
    const rulesHTML = Object.entries(this.rules).map(([key, rule]) => {
      return `
        <div class="rule-item" data-rule="${key}" style="padding: 12px 20px; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${rule.name}</div>
            <div style="font-size: 12px; color: #888;">${this.getRuleDescription(key)}</div>
          </div>
          <label class="switch">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="document.dispatchEvent(new CustomEvent('toggle-rule', {detail: '${key}'}))">
            <span class="slider"></span>
          </label>
        </div>
      `
    }).join('')
    
    panel.innerHTML = header + `
      <div class="rules-container" style="overflow-y: auto; flex: 1;">
        ${rulesHTML}
      </div>
      <div style="padding: 12px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 8px;">
        <button class="reset-btn" onclick="document.dispatchEvent(new CustomEvent('reset-rules'))" style="padding: 6px 16px; border: 1px solid #d0d7de; background: white; color: #24292f; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">重置</button>
        <button class="confirm-btn" onclick="this.closest('.syntax-checker-config-panel').style.display='none'" style="padding: 6px 16px; border: none; background: #0969da; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">确定</button>
      </div>
    `
    
    // 添加到页面
    document.body.appendChild(panel)
    this.configPanel = panel
    
    // 监听规则切换事件
    document.addEventListener('toggle-rule', (e) => {
      this.toggleRule(e.detail)
      this.updateConfigPanel()
    })
    
    // 监听重置事件
    document.addEventListener('reset-rules', () => {
      this.resetRules()
      this.updateConfigPanel()
    })
    
    // 添加开关样式
    this.ensureConfigStyles()
  },
  
  /**
   * 获取规则描述
   */
  getRuleDescription(ruleKey) {
    const descriptions = {
      heading: '检查标题格式，如#后需要空格',
      list: '检查列表格式，如-、*后需要空格',
      codeBlock: '检查代码块围栏是否正确',
      link: '检查链接语法是否完整',
      table: '检查表格分隔符格式',
      taskList: '检查任务列表复选框格式',
      emptyLines: '检查连续空行是否过多',
      trailingSpace: '检查行尾是否有多余空格',
      headingLevel: '检查标题层级是否跳过（如H1直接到H3）',
      imagePath: '检查图片路径和alt文字',
      linkValidity: '检查链接URL格式（需要网络请求）',
      codeLanguage: '检查代码块是否指定语言',
      listIndent: '检查列表缩进是否为2或4的倍数'
    }
    return descriptions[ruleKey] || ''
  },
  
  /**
   * 更新配置面板
   */
  updateConfigPanel() {
    if (!this.configPanel) return
    
    // 重新渲染规则列表
    const rulesContainer = this.configPanel.querySelector('.rules-container')
    if (!rulesContainer) return
    
    const rulesHTML = Object.entries(this.rules).map(([key, rule]) => {
      return `
        <div class="rule-item" data-rule="${key}" style="padding: 12px 20px; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${rule.name}</div>
            <div style="font-size: 12px; color: #888;">${this.getRuleDescription(key)}</div>
          </div>
          <label class="switch">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="document.dispatchEvent(new CustomEvent('toggle-rule', {detail: '${key}'}))">
            <span class="slider"></span>
          </label>
        </div>
      `
    }).join('')
    
    rulesContainer.innerHTML = rulesHTML
  },
  
  /**
   * 重置所有规则
   */
  resetRules() {
    Object.keys(this.rules).forEach(key => {
      this.rules[key].enabled = true
    })
  },
  
  /**
   * 确保配置样式存在
   */
  ensureConfigStyles() {
    if (document.getElementById('syntax-checker-config-styles')) return
    
    const style = `
      <style id="syntax-checker-config-styles">
        /* 滚动条样式（美化版） */
        .syntax-checker-config-panel .rules-container::-webkit-scrollbar {
          width: 6px;
        }
        .syntax-checker-config-panel .rules-container::-webkit-scrollbar-track {
          background: #f8f9fa;
          border-radius: 3px;
        }
        .syntax-checker-config-panel .rules-container::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #d0d7de 0%, #c1c8d0 100%);
          border-radius: 3px;
          border: 1px solid #e8eaed;
        }
        .syntax-checker-config-panel .rules-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #b8c0ca 0%, #a8b0ba 100%);
        }
        
        /* 按钮样式 */
        .syntax-checker-config-panel .reset-btn:hover {
          background: #f6f8fa !important;
          border-color: #afb8c1 !important;
        }
        .syntax-checker-config-panel .reset-btn:active {
          background: #eaeef2 !important;
        }
        .syntax-checker-config-panel .confirm-btn:hover {
          background: #0860ca !important;
        }
        .syntax-checker-config-panel .confirm-btn:active {
          background: #0757ba !important;
        }
        
        /* 开关样式 */
        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .3s;
          border-radius: 24px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #0969da;
        }
        input:checked + .slider:before {
          transform: translateX(20px);
        }
        
        .rule-item:hover {
          background: #f9f9f9;
        }
      </style>
    `
    
    document.head.insertAdjacentHTML('beforeend', style)
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
