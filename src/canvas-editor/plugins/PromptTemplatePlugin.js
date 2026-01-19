/**
 * Prompt模板插件
 * 🚀 支持模板化提示词创建、复用和团队协作
 */
import { TemplateParser } from './prompt-template/TemplateParser.js'
import { TemplateValidator } from './prompt-template/TemplateValidator.js'
import { TemplateLibrary } from './prompt-template/TemplateLibrary.js'
import { FieldNavigator } from './prompt-template/FieldNavigator.js'
import { TemplateRenderer } from './prompt-template/TemplateRenderer.js'

export const PromptTemplatePlugin = {
  id: 'prompt-template',
  name: 'Prompt模板系统',
  version: '1.0.0',
  description: '支持提示词模板化创建、空白引导和团队协作',
  author: 'Canvas Editor Team',

  // 插件配置
  config: {
    // 高亮颜色
    colors: {
      variable: '#FFF3CD',
      required: '#FFE5E5',
      optional: '#E5F5FF',
      filled: '#E5FFE5',
      example: '#F0F0F0',
    },

    // 快捷键
    keybindings: {
      jumpNext: 'Tab',
      jumpPrev: 'Shift+Tab',
      validate: 'Ctrl+Enter',
      showLibrary: 'Ctrl+K Ctrl+T',
    },

    // 自动保存
    autoSave: true,
    autoSaveInterval: 30000, // 30秒
  },

  /**
   * 🚀 插件激活
   */
  async activate(context) {
    const { editor, registerCommand, registerKeybinding, registerToolbarButton, log } = context

    // 初始化核心模块
    const parser = new TemplateParser()
    const validator = new TemplateValidator()
    const library = new TemplateLibrary()
    const navigator = new FieldNavigator(editor)
    const renderer = new TemplateRenderer(editor, this.config.colors)

    // 初始化库
    await library.initialize()

    // 当前模板状态
    let currentTemplate = null
    let isTemplateMode = false
    const fieldData = new Map()
    let autoSaveTimer = null

    // ==================== 命令：模板管理 ====================

    /**
     * 创建新模板
     */
    registerCommand(
      'create',
      () => {
        isTemplateMode = true
        currentTemplate = {
          id: `template_${Date.now()}`,
          name: '未命名模板',
          content: editor.document.getText() || '',
          metadata: {},
        }

        log('✅ 进入模板创建模式')
        context.emit('promptTemplate:modeChanged', { mode: 'create', template: currentTemplate })
      },
      {
        title: '创建Prompt模板',
        category: 'Prompt模板',
      }
    )

    /**
     * 保存模板
     */
    registerCommand(
      'save',
      async (options = {}) => {
        if (!currentTemplate) {
          log('❌ 没有可保存的模板')
          return
        }

        // 更新内容
        currentTemplate.content = editor.document.getText()

        // 解析并验证
        const parsed = parser.parse(currentTemplate.content)
        const validation = validator.validate(parsed, fieldData)

        if (!validation.valid && !options.force) {
          log('❌ 模板验证失败')
          context.emit('promptTemplate:validationFailed', validation)
          return
        }

        currentTemplate.metadata = parsed

        // 请求用户输入名称和分类
        if (!options.silent) {
          context.emit('promptTemplate:requestSave', currentTemplate)
        } else {
          await library.save(currentTemplate)
          log(`✅ 模板已保存: ${currentTemplate.name}`)
        }
      },
      {
        title: '保存模板',
        category: 'Prompt模板',
      }
    )

    /**
     * 打开模板库
     */
    registerCommand(
      'openLibrary',
      async () => {
        const templates = await library.getAll()

        context.emit('promptTemplate:showLibrary', {
          templates,
          categories: library.categories,
          onSelect: async templateId => {
            const template = await library.use(templateId)
            if (!template) {
              log('❌ 模板不存在')
              return
            }

            editor.document.setText(template.content)
            currentTemplate = template
            isTemplateMode = true
            fieldData.clear()

            const parsed = parser.parse(template.content)
            navigator.initialize(parsed)
            renderer.highlightFields(parsed)

            const progress = navigator.getProgress()
            renderer.renderProgressBar(progress)

            log(`📝 开始使用模板: ${template.name}`)
            context.emit('promptTemplate:templateLoaded', { template, parsed })

            setTimeout(() => {
              navigator.jumpToNext()
            }, 100)
          },
        })

        log(`📚 模板库: ${templates.length}个模板`)
      },
      {
        title: '打开模板库',
        category: 'Prompt模板',
      }
    )

    /**
     * 使用模板
     */
    registerCommand(
      'use',
      async templateId => {
        const template = await library.use(templateId)
        if (!template) {
          log('❌ 模板不存在')
          return
        }

        // 加载模板内容
        editor.document.setText(template.content)
        currentTemplate = template
        isTemplateMode = true
        fieldData.clear()

        // 解析
        const parsed = parser.parse(template.content)

        // 初始化导航
        navigator.initialize(parsed)

        // 高亮
        renderer.highlightFields(parsed)

        // 显示进度
        const progress = navigator.getProgress()
        renderer.renderProgressBar(progress)

        log(`📝 开始使用模板: ${template.name}`)
        context.emit('promptTemplate:templateLoaded', { template, parsed })

        // 跳转到第一个字段
        setTimeout(() => {
          navigator.jumpToNext()
        }, 100)
      },
      {
        title: '使用模板',
        category: 'Prompt模板',
      }
    )

    // ==================== 命令：模板编辑 ====================

    /**
     * 插入变量
     */
    registerCommand(
      'insertVariable',
      params => {
        const { name, placeholder } = params || {}
        const varName = name || 'VAR_NAME'
        const varPlaceholder = placeholder || '变量说明'
        const variable = `{{${varName}:${varPlaceholder}}}`

        const cursor = editor.cursor
        editor.document.insertText(cursor.line, cursor.column, variable)

        log(`插入变量: ${variable}`)
      },
      {
        title: '插入变量',
        category: 'Prompt模板',
      }
    )

    /**
     * 标记必填项
     */
    registerCommand(
      'markRequired',
      params => {
        const { name } = params || {}
        const fieldName = name || '字段名'
        const required = `[REQUIRED:${fieldName}]\n_______________\n`

        const cursor = editor.cursor
        editor.document.insertText(cursor.line, cursor.column, required)

        log(`标记必填: ${fieldName}`)
      },
      {
        title: '标记必填项',
        category: 'Prompt模板',
      }
    )

    /**
     * 标记可选项
     */
    registerCommand(
      'markOptional',
      params => {
        const { name } = params || {}
        const fieldName = name || '字段名'
        const optional = `[OPTIONAL:${fieldName}]\n_______________\n`

        const cursor = editor.cursor
        editor.document.insertText(cursor.line, cursor.column, optional)

        log(`标记可选: ${fieldName}`)
      },
      {
        title: '标记可选项',
        category: 'Prompt模板',
      }
    )

    /**
     * 插入选项组
     */
    registerCommand(
      'insertChoice',
      params => {
        const { options } = params || {}
        const choices = options || ['选项A', '选项B', '选项C']
        const choice = `{${choices.join('|')}}`

        const cursor = editor.cursor
        editor.document.insertText(cursor.line, cursor.column, choice)

        log(`插入选项: ${choice}`)
      },
      {
        title: '插入选项组',
        category: 'Prompt模板',
      }
    )

    // ==================== 命令：导航与验证 ====================

    /**
     * 跳转到下一个字段
     */
    registerCommand(
      'jumpNext',
      () => {
        if (!isTemplateMode) return

        const next = navigator.jumpToNext()
        if (next) {
          log(`跳转到: ${next.name}`)
          context.emit('promptTemplate:fieldFocused', next)
        } else {
          log('✅ 已完成所有字段')
          context.emit('promptTemplate:allFieldsComplete')
        }
      },
      {
        title: '下一个字段',
        category: 'Prompt模板',
      }
    )

    /**
     * 跳转到上一个字段
     */
    registerCommand(
      'jumpPrev',
      () => {
        if (!isTemplateMode) return

        const prev = navigator.jumpToPrev()
        if (prev) {
          log(`跳转到: ${prev.name}`)
          context.emit('promptTemplate:fieldFocused', prev)
        }
      },
      {
        title: '上一个字段',
        category: 'Prompt模板',
      }
    )

    /**
     * 验证模板
     */
    registerCommand(
      'validate',
      async () => {
        if (!currentTemplate) return null

        const content = editor.document.getText()
        const parsed = parser.parse(content)
        const validation = validator.validate(parsed, fieldData)

        if (validation.valid) {
          log('✅ 模板验证通过')
          context.emit('promptTemplate:validationSuccess', validation)
        } else {
          log(`❌ 验证失败: ${validation.errors.length}个错误`)
          context.emit('promptTemplate:validationFailed', validation)
        }

        return validation
      },
      {
        title: '验证模板',
        category: 'Prompt模板',
      }
    )

    /**
     * 生成最终Prompt
     */
    registerCommand(
      'generate',
      async () => {
        if (!currentTemplate) return null

        const content = editor.document.getText()
        const parsed = parser.parse(content)
        const validation = validator.validate(parsed, fieldData)

        if (!validation || !validation.valid) {
          log('❌ 请先完成所有必填项')
          context.emit('promptTemplate:validationFailed', validation)
          return null
        }

        const finalPrompt = parser.generate(parsed, fieldData)

        context.emit('promptTemplate:generated', {
          prompt: finalPrompt,
          template: currentTemplate,
        })

        log('✅ Prompt已生成')
        return finalPrompt
      },
      {
        title: '生成Prompt',
        category: 'Prompt模板',
      }
    )

    // ==================== 快捷键 ====================

    registerKeybinding('Tab', 'prompt-template.jumpNext', {
      when: () => isTemplateMode,
      preventDefault: true,
    })

    registerKeybinding('Shift+Tab', 'prompt-template.jumpPrev', {
      when: () => isTemplateMode,
      preventDefault: true,
    })

    registerKeybinding('Ctrl+Enter', 'prompt-template.generate', {
      when: () => isTemplateMode,
    })

    // 快捷键
    registerKeybinding('Ctrl+Alt+T', 'prompt-template.openLibrary')

    // ==================== 注册工具栏按钮 ====================

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

    // ==================== 事件监听 ====================

    // 实时高亮
    editor.document.on('change', () => {
      if (isTemplateMode && currentTemplate) {
        const parsed = parser.parse(editor.document.getText())
        renderer.highlightFields(parsed)

        // 更新进度
        const progress = navigator.getProgress()
        renderer.renderProgressBar(progress)
      }
    })

    // 自动保存
    if (this.config.autoSave) {
      editor.document.on('change', () => {
        if (isTemplateMode && currentTemplate) {
          if (autoSaveTimer) clearTimeout(autoSaveTimer)

          autoSaveTimer = setTimeout(() => {
            currentTemplate.content = editor.document.getText()
            const parsed = parser.parse(currentTemplate.content)
            currentTemplate.metadata = parsed
            library.save(currentTemplate)
          }, this.config.autoSaveInterval)
        }
      })
    }

    // ==================== 存储引用 ====================

    context.promptTemplate = {
      parser,
      validator,
      library,
      navigator,
      renderer,
      getCurrentTemplate: () => currentTemplate,
      isTemplateMode: () => isTemplateMode,
      getFieldData: () => fieldData,
      setFieldData: (key, value) => {
        fieldData.set(key, value)
        // 更新高亮
        if (currentTemplate) {
          const parsed = parser.parse(editor.document.getText())
          renderer.updateFieldStatus(fieldData, parsed)
        }
      },
    }

    // 添加事件发射函数
    context.emit = (eventName, data) => {
      // 通过编辑器事件系统广播
      if (editor.emit) {
        editor.emit(eventName, data)
      }
    }

    log('✅ Prompt模板插件已激活')
    log('💡 使用 Ctrl+Alt+T 打开模板库')
  },

  /**
   * 🚀 插件停用
   */
  deactivate(context) {
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
