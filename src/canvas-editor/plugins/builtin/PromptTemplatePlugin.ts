/**
 * Prompt模板插件
 * 支持模板化提示词创建、复用和团队协作
 */

import type { Plugin, PluginContext } from '../../types'

interface EditorInterface {
  cursor: { line: number; column: number }
  document: {
    getText(): string
    setText(text: string): void
    insertText(line: number, column: number, text: string): void
    on(event: string, handler: () => void): void
  }
  emit?(event: string, data: any): void
}

interface Template {
  id: string
  name: string
  content: string
  metadata: any
}

interface PluginConfig {
  colors: {
    variable: string
    required: string
    optional: string
    filled: string
    example: string
  }
  keybindings: {
    jumpNext: string
    jumpPrev: string
    validate: string
    showLibrary: string
  }
  autoSave: boolean
  autoSaveInterval: number
}

const config: PluginConfig = {
  colors: {
    variable: '#FFF3CD',
    required: '#FFE5E5',
    optional: '#E5F5FF',
    filled: '#E5FFE5',
    example: '#F0F0F0',
  },
  keybindings: {
    jumpNext: 'Tab',
    jumpPrev: 'Shift+Tab',
    validate: 'Ctrl+Enter',
    showLibrary: 'Ctrl+K Ctrl+T',
  },
  autoSave: true,
  autoSaveInterval: 30000,
}

// Placeholder implementations
class TemplateParser {
  parse(content: string): any {
    return { fields: [], content }
  }
  generate(parsed: any, fieldData: Map<string, any>): string {
    return parsed.content
  }
}

class TemplateValidator {
  validate(parsed: any, fieldData: Map<string, any>): { valid: boolean; errors: any[] } {
    return { valid: true, errors: [] }
  }
}

class TemplateLibrary {
  categories: string[] = []
  async initialize(): Promise<void> {}
  async getAll(): Promise<Template[]> { return [] }
  async use(templateId: string): Promise<Template | null> { return null }
  async save(template: Template): Promise<void> {}
  destroy(): void {}
}

class FieldNavigator {
  constructor(editor: any) {}
  initialize(parsed: any): void {}
  jumpToNext(): any { return null }
  jumpToPrev(): any { return null }
  getProgress(): { total: number; filled: number } { return { total: 0, filled: 0 } }
  destroy(): void {}
}

class TemplateRenderer {
  constructor(editor: any, colors: any) {}
  highlightFields(parsed: any): void {}
  renderProgressBar(progress: any): void {}
  updateFieldStatus(fieldData: Map<string, any>, parsed: any): void {}
  destroy(): void {}
}

export const PromptTemplatePlugin: Plugin = {
  id: 'prompt-template',
  name: 'Prompt模板系统',
  version: '1.0.0',
  description: '支持提示词模板化创建、空白引导和团队协作',

  async activate(context: PluginContext) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton, log } = context
    const ed = editor as unknown as EditorInterface

    const parser = new TemplateParser()
    const validator = new TemplateValidator()
    const library = new TemplateLibrary()
    const navigator = new FieldNavigator(ed)
    const renderer = new TemplateRenderer(ed, config.colors)

    await library.initialize()

    let currentTemplate: Template | null = null
    let isTemplateMode = false
    const fieldData = new Map<string, any>()
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

    const emit = (eventName: string, data?: any) => {
      if (ed.emit) {
        ed.emit(eventName, data)
      }
    }

    registerCommand('create', () => {
      isTemplateMode = true
      currentTemplate = {
        id: `template_${Date.now()}`,
        name: '未命名模板',
        content: ed.document.getText() || '',
        metadata: {},
      }

      log('进入模板创建模式')
      emit('promptTemplate:modeChanged', { mode: 'create', template: currentTemplate })
    }, {
      title: '创建Prompt模板',
    })

    registerCommand('save', async (options: { force?: boolean; silent?: boolean } = {}) => {
      if (!currentTemplate) {
        log('没有可保存的模板')
        return
      }

      currentTemplate.content = ed.document.getText()

      const parsed = parser.parse(currentTemplate.content)
      const validation = validator.validate(parsed, fieldData)

      if (!validation.valid && !options.force) {
        log('模板验证失败')
        emit('promptTemplate:validationFailed', validation)
        return
      }

      currentTemplate.metadata = parsed

      if (!options.silent) {
        emit('promptTemplate:requestSave', currentTemplate)
      } else {
        await library.save(currentTemplate)
        log(`模板已保存: ${currentTemplate.name}`)
      }
    }, {
      title: '保存模板',
    })

    registerCommand('openLibrary', async () => {
      const templates = await library.getAll()

      emit('promptTemplate:showLibrary', {
        templates,
        categories: library.categories,
        onSelect: async (templateId: string) => {
          const template = await library.use(templateId)
          if (!template) {
            log('模板不存在')
            return
          }

          ed.document.setText(template.content)
          currentTemplate = template
          isTemplateMode = true
          fieldData.clear()

          const parsed = parser.parse(template.content)
          navigator.initialize(parsed)
          renderer.highlightFields(parsed)

          const progress = navigator.getProgress()
          renderer.renderProgressBar(progress)

          log(`开始使用模板: ${template.name}`)
          emit('promptTemplate:templateLoaded', { template, parsed })

          setTimeout(() => {
            navigator.jumpToNext()
          }, 100)
        },
      })

      log(`模板库: ${templates.length}个模板`)
    }, {
      title: '打开模板库',
    })

    registerCommand('insertVariable', (params?: { name?: string; placeholder?: string }) => {
      const varName = params?.name || 'VAR_NAME'
      const varPlaceholder = params?.placeholder || '变量说明'
      const variable = `{{${varName}:${varPlaceholder}}}`

      const cursor = ed.cursor
      ed.document.insertText(cursor.line, cursor.column, variable)

      log(`插入变量: ${variable}`)
    }, {
      title: '插入变量',
    })

    registerCommand('jumpNext', () => {
      if (!isTemplateMode) return

      const next = navigator.jumpToNext()
      if (next) {
        log(`跳转到: ${next.name}`)
        emit('promptTemplate:fieldFocused', next)
      } else {
        log('已完成所有字段')
        emit('promptTemplate:allFieldsComplete')
      }
    }, {
      title: '下一个字段',
    })

    registerCommand('jumpPrev', () => {
      if (!isTemplateMode) return

      const prev = navigator.jumpToPrev()
      if (prev) {
        log(`跳转到: ${prev.name}`)
        emit('promptTemplate:fieldFocused', prev)
      }
    }, {
      title: '上一个字段',
    })

    registerCommand('validate', async () => {
      if (!currentTemplate) return null

      const content = ed.document.getText()
      const parsed = parser.parse(content)
      const validation = validator.validate(parsed, fieldData)

      if (validation.valid) {
        log('模板验证通过')
        emit('promptTemplate:validationSuccess', validation)
      } else {
        log(`验证失败: ${validation.errors.length}个错误`)
        emit('promptTemplate:validationFailed', validation)
      }

      return validation
    }, {
      title: '验证模板',
    })

    registerCommand('generate', async () => {
      if (!currentTemplate) return null

      const content = ed.document.getText()
      const parsed = parser.parse(content)
      const validation = validator.validate(parsed, fieldData)

      if (!validation.valid) {
        log('请先完成所有必填项')
        emit('promptTemplate:validationFailed', validation)
        return null
      }

      const finalPrompt = parser.generate(parsed, fieldData)

      emit('promptTemplate:generated', {
        prompt: finalPrompt,
        template: currentTemplate,
      })

      log('Prompt已生成')
      return finalPrompt
    }, {
      title: '生成Prompt',
    })

    registerKeybinding('Ctrl+Alt+T', 'prompt-template.openLibrary')

    registerToolbarButton({
      id: 'prompt-template-library',
      icon: 'prompt-template-library',
      title: '模板库 (Ctrl+Alt+T)',
      command: 'prompt-template.openLibrary',
    })

    registerToolbarButton({
      id: 'prompt-template-create',
      icon: 'prompt-template-create',
      title: '创建模板',
      command: 'prompt-template.create',
    })

    ed.document.on('change', () => {
      if (isTemplateMode && currentTemplate) {
        const parsed = parser.parse(ed.document.getText())
        renderer.highlightFields(parsed)

        const progress = navigator.getProgress()
        renderer.renderProgressBar(progress)
      }
    })

    if (config.autoSave) {
      ed.document.on('change', () => {
        if (isTemplateMode && currentTemplate) {
          if (autoSaveTimer) clearTimeout(autoSaveTimer)

          autoSaveTimer = setTimeout(() => {
            if (currentTemplate) {
              currentTemplate.content = ed.document.getText()
              const parsed = parser.parse(currentTemplate.content)
              currentTemplate.metadata = parsed
              library.save(currentTemplate)
            }
          }, config.autoSaveInterval)
        }
      })
    }

    ;(context as any).promptTemplate = {
      parser,
      validator,
      library,
      navigator,
      renderer,
      getCurrentTemplate: () => currentTemplate,
      isTemplateMode: () => isTemplateMode,
      getFieldData: () => fieldData,
      setFieldData: (key: string, value: any) => {
        fieldData.set(key, value)
        if (currentTemplate) {
          const parsed = parser.parse(ed.document.getText())
          renderer.updateFieldStatus(fieldData, parsed)
        }
      },
    }

    log('Prompt模板插件已激活')
    log('使用 Ctrl+Alt+T 打开模板库')
  },

  deactivate(context?: any) {
    if (context && context.promptTemplate) {
      if (context.promptTemplate.library) {
        context.promptTemplate.library.destroy()
      }
      if (context.promptTemplate.navigator) {
        context.promptTemplate.navigator.destroy()
      }
      if (context.promptTemplate.renderer) {
        context.promptTemplate.renderer.destroy()
      }
      context.promptTemplate = null
    }
  },
}
