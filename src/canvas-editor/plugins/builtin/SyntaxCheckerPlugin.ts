/**
 * 语法检查插件
 * 提供Markdown语法检查、拼写检查、格式规范检查
 */

import type { Plugin, PluginContext, Diagnostic } from '../../types'

interface SyntaxIssue {
  line: number
  column: number
  length: number
  severity: 'error' | 'warning' | 'info'
  message: string
  rule: string
  fix?: { insert: string; at: number }
}

interface CheckContext {
  emptyLineCount: number
  inCodeBlock: boolean
  codeBlockStart: number
  lastHeadingLevel?: number
}

interface Rule {
  enabled: boolean
  name: string
  check: (line: number, lineText: string, context: CheckContext) => SyntaxIssue[]
}

interface EditorInterface {
  cursor: { line: number; column: number; setPosition(line: number, column: number): void }
  viewport: { scrollToLine(line: number): void }
  document: {
    getLine(line: number): string
    getLineCount(): number
    insertText(line: number, column: number, text: string): void
  }
  history: { record(operation: any): void }
  textRenderer?: { setDiagnostics(diagnostics: Diagnostic[]): void }
  render(): void
}

const rules: Record<string, Rule> = {
  heading: {
    enabled: true,
    name: '标题格式',
    check: (line, lineText) => {
      const issues: SyntaxIssue[] = []
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
  list: {
    enabled: true,
    name: '列表格式',
    check: (line, lineText) => {
      const issues: SyntaxIssue[] = []
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
      return issues
    }
  },
  link: {
    enabled: true,
    name: '链接格式',
    check: (line, lineText) => {
      const issues: SyntaxIssue[] = []
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
  emptyLines: {
    enabled: true,
    name: '空行规范',
    check: (line, lineText, context) => {
      const issues: SyntaxIssue[] = []
      if (lineText.trim() === '' && context.emptyLineCount >= 2) {
        issues.push({
          line,
          column: 0,
          length: 0,
          severity: 'info',
          message: '连续空行过多，建议最多保留1个',
          rule: 'multiple-blank-lines'
        })
      }
      return issues
    }
  },
  trailingSpace: {
    enabled: true,
    name: '行尾空格',
    check: (line, lineText) => {
      const issues: SyntaxIssue[] = []
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
  }
}

let diagnostics: SyntaxIssue[] = []
let checkTimer: ReturnType<typeof setTimeout> | undefined
let diagnosticStatusBar: HTMLDivElement | null = null
let diagnosticDetailPanel: HTMLDivElement | null = null

export const SyntaxCheckerPlugin: Plugin = {
  id: 'syntax-checker',
  name: 'Syntax Checker',
  version: '1.0.0',
  description: 'Markdown语法检查和诊断',

  activate(context: PluginContext) {
    const { editor, registerCommand } = context
    const ed = editor as unknown as EditorInterface

    diagnostics = []

    registerCommand('check', () => {
      checkSyntax(ed)
    }, {
      title: '检查语法',
      description: '检查Markdown语法'
    })

    registerCommand('fix', (line: number) => {
      fixIssue(ed, line)
    }, {
      title: '修复问题',
      description: '自动修复语法问题'
    })

    registerCommand('toggle', (ruleName: string) => {
      toggleRule(ruleName)
    }, {
      title: '切换规则',
      description: '启用/禁用检查规则'
    })

    ;(context as any).onAfterChange?.(() => {
      clearTimeout(checkTimer)
      checkTimer = setTimeout(() => {
        checkSyntax(ed)
      }, 500)
    })

    createDiagnosticPanel(ed)
    checkSyntax(ed)
  },

  deactivate() {
    clearTimeout(checkTimer)
    destroyDiagnosticPanel()
  }
}

function createDiagnosticPanel(editor: EditorInterface): void {
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
    display: none;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    z-index: 100;
  `

  const container = document.querySelector('.canvas-editor-container')
  if (container) {
    container.appendChild(statusBar)
  }

  diagnosticStatusBar = statusBar

  statusBar.addEventListener('click', () => {
    if (diagnosticDetailPanel) {
      const isVisible = diagnosticDetailPanel.style.display !== 'none'
      diagnosticDetailPanel.style.display = isVisible ? 'none' : 'block'
    }
  })

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

  diagnosticDetailPanel = detailPanel
}

function destroyDiagnosticPanel(): void {
  if (diagnosticStatusBar) {
    diagnosticStatusBar.remove()
    diagnosticStatusBar = null
  }
  if (diagnosticDetailPanel) {
    diagnosticDetailPanel.remove()
    diagnosticDetailPanel = null
  }
}

function checkSyntax(editor: EditorInterface): void {
  const { document } = editor
  if (!document) return

  diagnostics = []
  const context: CheckContext = {
    emptyLineCount: 0,
    inCodeBlock: false,
    codeBlockStart: -1
  }

  for (let line = 0; line < document.getLineCount(); line++) {
    const lineText = document.getLine(line)

    if (lineText.trim() === '') {
      context.emptyLineCount++
    } else {
      context.emptyLineCount = 0
    }

    if (lineText.trim().startsWith('```')) {
      context.inCodeBlock = !context.inCodeBlock
      if (context.inCodeBlock) {
        context.codeBlockStart = line
      }
    }

    if (context.inCodeBlock && line !== context.codeBlockStart) {
      continue
    }

    for (const ruleKey in rules) {
      const rule = rules[ruleKey]
      if (!rule.enabled) continue

      const issues = rule.check(line, lineText, context)
      diagnostics.push(...issues)
    }
  }

  updateDiagnosticPanel(editor)
  
  const { textRenderer } = editor
  if (textRenderer && textRenderer.setDiagnostics) {
    textRenderer.setDiagnostics(diagnostics as Diagnostic[])
  }
  
  editor.render()
}

function updateDiagnosticPanel(editor: EditorInterface): void {
  if (!diagnosticStatusBar) return

  if (diagnostics.length === 0) {
    diagnosticStatusBar.style.display = 'none'
    return
  }

  diagnosticStatusBar.style.display = 'flex'

  const errorCount = diagnostics.filter(d => d.severity === 'error').length
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length
  const infoCount = diagnostics.filter(d => d.severity === 'info').length

  let html = ''
  if (errorCount > 0) {
    html += `<span style="color: #f44336; margin-right: 12px;">● ${errorCount} 错误</span>`
  }
  if (warningCount > 0) {
    html += `<span style="color: #ff9800; margin-right: 12px;">● ${warningCount} 警告</span>`
  }
  if (infoCount > 0) {
    html += `<span style="color: #2196f3; margin-right: 12px;">● ${infoCount} 提示</span>`
  }
  html += `<span style="color: #999;">点击查看详情</span>`

  diagnosticStatusBar.innerHTML = html

  if (diagnosticDetailPanel) {
    const detailHtml = diagnostics.map(diagnostic => `
      <div style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; align-items: center; gap: 8px;" data-line="${diagnostic.line}">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${
          diagnostic.severity === 'error' ? '#f44336' : 
          diagnostic.severity === 'warning' ? '#ff9800' : '#2196f3'
        };"></span>
        <span style="flex: 1; color: #333;">${escapeHtml(diagnostic.message)}</span>
        <span style="color: #888; font-size: 11px;">${diagnostic.line + 1}:${diagnostic.column + 1}</span>
      </div>
    `).join('')

    diagnosticDetailPanel.innerHTML = detailHtml

    diagnosticDetailPanel.querySelectorAll('[data-line]').forEach(item => {
      item.addEventListener('click', () => {
        const line = parseInt((item as HTMLElement).dataset.line || '0')
        jumpToLine(editor, line)
      })
    })
  }
}

function jumpToLine(editor: EditorInterface, line: number): void {
  const { cursor, viewport, render } = editor
  
  cursor.setPosition(line, 0)
  viewport.scrollToLine(line)
  render()
}

function fixIssue(editor: EditorInterface, line: number): void {
  const { document, history } = editor

  const issues = diagnostics.filter(d => d.line === line && d.fix)

  if (issues.length === 0) {
    console.log('[syntax-checker] No fixable issues on this line')
    return
  }

  issues.forEach(issue => {
    if (issue.fix?.insert) {
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

  checkSyntax(editor)
  editor.render()
}

function toggleRule(ruleName: string): void {
  if (rules[ruleName]) {
    rules[ruleName].enabled = !rules[ruleName].enabled
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
