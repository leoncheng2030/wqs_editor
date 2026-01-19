/**
 * 插件管理器
 * 负责插件的注册、加载、卸载和事件分发
 * 
 * 增强功能：
 * - 插件依赖管理
 * - 插件间通信（事件总线）
 * - 配置持久化
 * - Hook 优先级控制
 * - 快捷键冲突处理
 * - 错误隔离与健康监控
 */

import type { 
  Plugin, 
  PluginContext, 
  PluginCommand, 
  PluginKeybinding, 
  ToolbarButton, 
  HookHandler, 
  HooksMap, 
  HookName,
  HookOptions,
  HookEntry,
  HookContext,
  KeybindingEnhancedOptions,
  PluginConfigSchema,
  PluginHealth
} from '../../types'
import { DependencyResolver } from './DependencyResolver'
import { EventBus } from './EventBus'
import { ConfigurationManager } from './ConfigurationManager'
import { PluginHealthMonitor } from './PluginHealthMonitor'

interface EditorInterface {
  render(force?: boolean): void
  document: any
  cursor: any
  selection: any
  viewport: any
  history: any
  clipboard: any
  [key: string]: any
}

interface RegisteredPlugin extends Plugin {
  active: boolean
}

// 编辑器状态上下文（用于 when 条件判断）
interface EditorState {
  editorFocus: boolean
  readOnly: boolean
  hasSelection: boolean
  [key: string]: any
}

const DEFAULT_HOOK_PRIORITY = 100
const DEFAULT_KEYBINDING_PRIORITY = 100

export class PluginManager {
  private editor: EditorInterface
  private plugins: Map<string, RegisteredPlugin>
  private commands: Map<string, PluginCommand>
  private keybindings: Map<string, PluginKeybinding[]>
  private toolbarButtons: ToolbarButton[]
  private hooks: HooksMap

  // 新增模块
  private dependencyResolver: DependencyResolver
  private eventBus: EventBus
  private configManager: ConfigurationManager
  private healthMonitor: PluginHealthMonitor

  // 编辑器状态
  private editorState: EditorState = {
    editorFocus: true,
    readOnly: false,
    hasSelection: false
  }

  constructor(editor: EditorInterface) {
    this.editor = editor
    this.plugins = new Map()
    this.commands = new Map()
    this.keybindings = new Map()
    this.toolbarButtons = []
    this.hooks = {
      beforeInit: [],
      afterInit: [],
      beforeRender: [],
      afterRender: [],
      beforeChange: [],
      afterChange: [],
      beforeCommand: [],
      afterCommand: [],
      beforeDestroy: [],
      afterDestroy: []
    }

    // 初始化新模块
    this.dependencyResolver = new DependencyResolver()
    this.eventBus = new EventBus()
    this.configManager = new ConfigurationManager()
    this.healthMonitor = new PluginHealthMonitor()

    // 关联事件总线
    this.configManager.setEventBus(this.eventBus)
    this.healthMonitor.setEventBus(this.eventBus)
  }

  /**
   * 注册插件
   */
  register(plugin: Plugin): void {
    if (!plugin.id) {
      throw new Error('Plugin must have an id')
    }

    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered`)
      return
    }

    this.plugins.set(plugin.id, {
      ...plugin,
      active: false
    })

    // 初始化健康监控
    this.healthMonitor.initPlugin(plugin.id)

    // 重建依赖图
    this.dependencyResolver.buildGraph(this.plugins as Map<string, Plugin>)

    // 校验依赖
    const validation = this.dependencyResolver.validateDependencies(plugin.id)
    if (!validation.valid) {
      console.warn(`Plugin "${plugin.id}" has missing dependencies:`, validation.missing)
    }
    if (validation.optional.length > 0) {
      console.info(`Plugin "${plugin.id}" has optional dependencies not available:`, validation.optional)
    }
  }

  /**
   * 激活插件
   */
  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (plugin.active) {
      console.warn(`Plugin ${pluginId} is already active`)
      return
    }

    // 检查健康状态
    if (!this.healthMonitor.isPluginUsable(pluginId)) {
      console.warn(`Plugin ${pluginId} is disabled due to health issues`)
      return
    }

    // 先激活依赖
    const dependencies = this.dependencyResolver.getAllDependencies(pluginId)
    for (const depId of dependencies) {
      const depPlugin = this.plugins.get(depId)
      if (depPlugin && !depPlugin.active) {
        await this.activate(depId)
      }
    }

    try {
      const context = this.createPluginContext(pluginId)
      
      if (typeof plugin.activate === 'function') {
        await plugin.activate(context)
      }

      plugin.active = true

      // 设置恢复回调
      this.healthMonitor.setRecoveryCallback(pluginId, async () => {
        try {
          await this.deactivate(pluginId)
          await this.activate(pluginId)
          return true
        } catch {
          return false
        }
      })

      // 发布激活事件
      this.eventBus.publish({
        type: 'plugin:activated',
        source: 'plugin-manager',
        data: { pluginId },
        timestamp: Date.now(),
        propagation: true
      })

    } catch (error) {
      this.healthMonitor.recordError(pluginId, 'activation', error as Error)
      console.error(`Failed to activate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 批量激活所有插件（按依赖顺序）
   */
  async activateAll(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys())
    const order = this.dependencyResolver.getActivationOrder(pluginIds)

    for (const pluginId of order) {
      try {
        await this.activate(pluginId)
      } catch (error) {
        console.error(`Failed to activate plugin ${pluginId}, continuing with others:`, error)
      }
    }
  }

  /**
   * 停用插件
   */
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (!plugin.active) {
      return
    }

    // 检查是否有其他插件依赖此插件
    const activePlugins = new Set(
      this.getActivePlugins().map(p => p.id)
    )
    if (!this.dependencyResolver.canDeactivate(pluginId, activePlugins)) {
      const dependents = this.dependencyResolver.getAllDependents(pluginId)
        .filter(id => activePlugins.has(id))
      console.warn(`Cannot deactivate plugin "${pluginId}", it is required by:`, dependents)
      return
    }

    try {
      if (typeof plugin.deactivate === 'function') {
        await plugin.deactivate()
      }

      this.cleanupPlugin(pluginId)

      plugin.active = false

      // 发布停用事件
      this.eventBus.publish({
        type: 'plugin:deactivated',
        source: 'plugin-manager',
        data: { pluginId },
        timestamp: Date.now(),
        propagation: true
      })

    } catch (error) {
      this.healthMonitor.recordError(pluginId, 'deactivation', error as Error)
      console.error(`Failed to deactivate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 创建插件API上下文
   */
  createPluginContext(pluginId: string): PluginContext {
    const self = this

    return {
      editor: this.editor,
      pluginId,
      
      registerCommand: (commandId: string, handler: (...args: any[]) => any, options = {}) => {
        this.registerCommand(pluginId, commandId, handler, options)
      },
      
      registerKeybinding: (key: string, commandId: string, options: KeybindingEnhancedOptions = {}) => {
        this.registerKeybinding(pluginId, key, commandId, options)
      },
      
      registerToolbarButton: (button: Omit<ToolbarButton, 'pluginId'>) => {
        this.registerToolbarButton(pluginId, button)
      },
      
      // Hook 注册（支持优先级）
      onBeforeInit: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('beforeInit', pluginId, handler, options),
      onAfterInit: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('afterInit', pluginId, handler, options),
      onBeforeRender: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('beforeRender', pluginId, handler, options),
      onAfterRender: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('afterRender', pluginId, handler, options),
      onBeforeChange: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('beforeChange', pluginId, handler, options),
      onAfterChange: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('afterChange', pluginId, handler, options),
      onBeforeCommand: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('beforeCommand', pluginId, handler, options),
      onAfterCommand: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('afterCommand', pluginId, handler, options),
      onBeforeDestroy: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('beforeDestroy', pluginId, handler, options),
      onAfterDestroy: (handler: HookHandler, options?: HookOptions) => 
        this.registerHook('afterDestroy', pluginId, handler, options),

      // 事件总线 API
      eventBus: {
        publish: (type: string, data?: any) => {
          this.eventBus.publish({
            type,
            source: pluginId,
            data,
            timestamp: Date.now(),
            propagation: true
          })
        },
        subscribe: (eventType: string, handler: any, options?: any) => {
          return this.eventBus.subscribe(pluginId, eventType, handler, options)
        },
        unsubscribe: (subscriptionId: string) => {
          this.eventBus.unsubscribe(subscriptionId)
        }
      },

      // 配置 API
      config: {
        registerSchema: (schema: PluginConfigSchema) => {
          this.configManager.registerSchema(pluginId, schema)
        },
        get: <T = any>(key: string): T => {
          return this.configManager.get<T>(pluginId, key)
        },
        set: async (key: string, value: any) => {
          await this.configManager.set(pluginId, key, value)
        },
        reset: async (key?: string) => {
          await this.configManager.reset(pluginId, key)
        }
      },
      
      log: (...args: any[]) => console.log(`[${pluginId}]`, ...args),
      warn: (...args: any[]) => console.warn(`[${pluginId}]`, ...args),
      error: (...args: any[]) => console.error(`[${pluginId}]`, ...args)
    }
  }

  /**
   * 注册命令
   */
  registerCommand(pluginId: string, commandId: string, handler: (...args: any[]) => any, options: Record<string, any> = {}): void {
    const fullCommandId = `${pluginId}.${commandId}`
    
    if (this.commands.has(fullCommandId)) {
      console.warn(`Command ${fullCommandId} is already registered`)
      return
    }

    this.commands.set(fullCommandId, {
      pluginId,
      commandId,
      handler,
      options,
      fullCommandId
    })
  }

  /**
   * 注册快捷键（支持优先级和条件）
   */
  registerKeybinding(pluginId: string, key: string, commandId: string, options: KeybindingEnhancedOptions = {}): void {
    const fullCommandId = commandId.includes('.') ? commandId : `${pluginId}.${commandId}`
    
    if (!this.commands.has(fullCommandId)) {
      console.warn(`Command ${fullCommandId} not found`)
      return
    }

    const keybinding: PluginKeybinding = {
      pluginId,
      key: key.toLowerCase(),
      commandId: fullCommandId,
      priority: options.priority ?? DEFAULT_KEYBINDING_PRIORITY,
      when: options.when,
      conflictStrategy: options.conflictStrategy ?? 'override',
      options
    }

    if (!this.keybindings.has(keybinding.key)) {
      this.keybindings.set(keybinding.key, [])
    }

    this.keybindings.get(keybinding.key)!.push(keybinding)

    // 按优先级排序（高优先级在前）
    this.keybindings.get(keybinding.key)!.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 注册工具栏按钮
   */
  registerToolbarButton(pluginId: string, button: Omit<ToolbarButton, 'pluginId'>): void {
    const toolbarButton: ToolbarButton = {
      pluginId,
      ...button
    }

    this.toolbarButtons.push(toolbarButton)
  }

  /**
   * 注册生命周期钩子（支持优先级）
   */
  registerHook(hookName: HookName, pluginId: string, handler: HookHandler, options: HookOptions = {}): void {
    if (!this.hooks[hookName]) {
      console.warn(`Hook ${hookName} not found`)
      return
    }

    const entry: HookEntry = {
      pluginId,
      handler,
      priority: options.priority ?? DEFAULT_HOOK_PRIORITY,
      cancelable: options.cancelable ?? false,
      timeout: options.timeout
    }

    this.hooks[hookName].push(entry)

    // 按优先级排序（小数字先执行）
    this.hooks[hookName].sort((a, b) => a.priority - b.priority)
  }

  /**
   * 执行命令
   */
  executeCommand(commandId: string, ...args: any[]): any {
    const command = this.commands.get(commandId)
    if (!command) {
      console.warn(`Command ${commandId} not found`)
      return
    }

    // 检查插件健康状态
    if (!this.healthMonitor.isPluginUsable(command.pluginId)) {
      console.warn(`Command ${commandId} skipped, plugin ${command.pluginId} is not usable`)
      return
    }

    try {
      const result = command.handler(...args)

      Promise.resolve().then(async () => {
        await this.triggerHook('beforeCommand', { commandId, args })
        await this.triggerHook('afterCommand', { commandId, args, result })
      })

      return result
    } catch (error) {
      this.healthMonitor.recordError(command.pluginId, 'command', error as Error, { commandId, args })
      console.error(`Failed to execute command ${commandId}:`, error)
      throw error
    }
  }

  /**
   * 处理快捷键（支持优先级和条件）
   */
  handleKeybinding(event: KeyboardEvent): boolean {
    const key = this.getKeyString(event)
    const bindings = this.keybindings.get(key)

    if (!bindings || bindings.length === 0) {
      return false
    }

    // 过滤满足条件的绑定
    const validBindings = bindings.filter(binding => {
      // 检查插件是否可用
      if (!this.healthMonitor.isPluginUsable(binding.pluginId)) {
        return false
      }
      // 检查 when 条件
      if (binding.when && !this.evaluateCondition(binding.when)) {
        return false
      }
      return true
    })

    if (validBindings.length === 0) {
      return false
    }

    // 选择最高优先级的绑定
    const binding = validBindings[0]
    
    try {
      const result = this.executeCommand(binding.commandId)
      
      if (result === false) {
        // 如果命令返回 false 且策略是 fallback，尝试下一个
        if (binding.conflictStrategy === 'fallback' && validBindings.length > 1) {
          for (let i = 1; i < validBindings.length; i++) {
            const fallbackResult = this.executeCommand(validBindings[i].commandId)
            if (fallbackResult !== false) {
              event.preventDefault()
              return true
            }
          }
        }
        return false
      }
      
      event.preventDefault()
      return true
    } catch {
      return false
    }
  }

  /**
   * 评估 when 条件表达式
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // 简单的条件解析器
      // 支持: editorFocus, readOnly, hasSelection, &&, ||, !
      const tokens = condition.split(/\s+/)
      let result = true
      let operator = '&&'

      for (const token of tokens) {
        if (token === '&&' || token === '||') {
          operator = token
          continue
        }

        let value: boolean
        if (token.startsWith('!')) {
          const varName = token.slice(1)
          value = !this.editorState[varName]
        } else {
          value = !!this.editorState[token]
        }

        if (operator === '&&') {
          result = result && value
        } else {
          result = result || value
        }
      }

      return result
    } catch {
      return true // 解析失败时默认通过
    }
  }

  /**
   * 更新编辑器状态（供外部调用）
   */
  updateEditorState(state: Partial<EditorState>): void {
    this.editorState = { ...this.editorState, ...state }
  }

  /**
   * 获取快捷键字符串
   */
  getKeyString(event: KeyboardEvent): string {
    const parts: string[] = []
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    parts.push(event.key.toLowerCase())

    return parts.join('+')
  }

  /**
   * 触发生命周期钩子（支持优先级和取消）
   */
  async triggerHook(hookName: HookName, data: Record<string, any> = {}): Promise<void> {
    const hooks = this.hooks[hookName]
    if (!hooks || hooks.length === 0) {
      return
    }

    // 创建 hook 上下文
    const context: HookContext = {
      hookName,
      data,
      stopped: false,
      stopPropagation() {
        this.stopped = true
      },
      isStopped() {
        return this.stopped
      }
    }

    for (const entry of hooks) {
      // 检查是否已停止传播
      if (context.stopped) {
        break
      }

      // 检查插件是否可用
      if (!this.healthMonitor.isPluginUsable(entry.pluginId)) {
        continue
      }

      try {
        // 执行 handler，支持超时
        if (entry.timeout) {
          await this.withTimeout(
            entry.handler(entry.cancelable ? context : data),
            entry.timeout
          )
        } else {
          await entry.handler(entry.cancelable ? context : data)
        }
      } catch (error) {
        this.healthMonitor.recordError(entry.pluginId, 'hook', error as Error, { hookName })
        console.error(`Error in ${hookName} hook from plugin "${entry.pluginId}":`, error)
      }
    }
  }

  /**
   * 带超时的 Promise 执行
   */
  private async withTimeout<T>(promise: T | Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Hook timeout')), timeout)
      )
    ])
  }

  /**
   * 清理插件资源
   */
  cleanupPlugin(pluginId: string): void {
    // 清理命令
    for (const [commandId, command] of this.commands.entries()) {
      if (command.pluginId === pluginId) {
        this.commands.delete(commandId)
      }
    }

    // 清理快捷键
    for (const [key, bindings] of this.keybindings.entries()) {
      const filtered = bindings.filter(b => b.pluginId !== pluginId)
      if (filtered.length === 0) {
        this.keybindings.delete(key)
      } else {
        this.keybindings.set(key, filtered)
      }
    }

    // 清理工具栏按钮
    this.toolbarButtons = this.toolbarButtons.filter(b => b.pluginId !== pluginId)

    // 清理 hooks
    for (const hookName in this.hooks) {
      this.hooks[hookName as HookName] = this.hooks[hookName as HookName].filter(h => h.pluginId !== pluginId)
    }

    // 清理事件订阅
    this.eventBus.unsubscribeAll(pluginId)

    // 清理配置
    this.configManager.cleanup(pluginId)
  }

  /**
   * 获取所有插件
   */
  getPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取激活的插件
   */
  getActivePlugins(): RegisteredPlugin[] {
    return this.getPlugins().filter(p => p.active)
  }

  /**
   * 获取工具栏按钮
   */
  getToolbarButtons(): ToolbarButton[] {
    return this.toolbarButtons
  }

  /**
   * 获取插件健康状态
   */
  getPluginHealth(pluginId?: string): PluginHealth | PluginHealth[] | null {
    if (pluginId) {
      return this.healthMonitor.getHealth(pluginId)
    }
    return this.healthMonitor.getAllHealth()
  }

  /**
   * 获取事件总线（供外部使用）
   */
  getEventBus(): EventBus {
    return this.eventBus
  }

  /**
   * 获取配置管理器（供外部使用）
   */
  getConfigManager(): ConfigurationManager {
    return this.configManager
  }

  /**
   * 导出所有插件配置
   */
  async exportConfig(): Promise<string> {
    return this.configManager.exportConfig()
  }

  /**
   * 导入插件配置
   */
  async importConfig(json: string): Promise<void> {
    await this.configManager.importConfig(json)
  }

  /**
   * 销毁插件管理器
   */
  async destroy(): Promise<void> {
    // 按依赖顺序逆序停用插件
    const activePlugins = this.getActivePlugins().map(p => p.id)
    const order = this.dependencyResolver.getActivationOrder(activePlugins)
    
    for (const pluginId of order.reverse()) {
      const plugin = this.plugins.get(pluginId)
      if (plugin?.active) {
        try {
          await this.deactivate(pluginId)
        } catch (error) {
          console.error(`Error deactivating plugin ${pluginId} during destroy:`, error)
        }
      }
    }

    this.plugins.clear()
    this.commands.clear()
    this.keybindings.clear()
    this.toolbarButtons = []
    
    for (const hookName in this.hooks) {
      this.hooks[hookName as HookName] = []
    }

    // 清理新模块
    this.dependencyResolver.reset()
    this.eventBus.clear()
    await this.configManager.clear()
    this.healthMonitor.clear()
  }
}
