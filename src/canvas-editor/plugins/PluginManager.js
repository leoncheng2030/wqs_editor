/**
 * 插件管理器
 * 负责插件的注册、加载、卸载和事件分发
 */
export class PluginManager {
  constructor(editor) {
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
  }

  /**
   * 注册插件
   * @param {Object} plugin - 插件对象
   * @param {string} plugin.id - 插件唯一标识
   * @param {string} plugin.name - 插件名称
   * @param {string} plugin.version - 插件版本
   * @param {Function} plugin.activate - 激活函数
   * @param {Function} plugin.deactivate - 停用函数（可选）
   */
  register(plugin) {
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
  }

  /**
   * 激活插件
   * @param {string} pluginId - 插件ID
   */
  async activate(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (plugin.active) {
      console.warn(`Plugin ${pluginId} is already active`)
      return
    }

    try {
      // 创建插件API上下文
      const context = this.createPluginContext(pluginId)
      
      // 调用插件的activate函数
      if (typeof plugin.activate === 'function') {
        await plugin.activate(context)
      }

      plugin.active = true
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 停用插件
   * @param {string} pluginId - 插件ID
   */
  async deactivate(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    if (!plugin.active) {
      return
    }

    try {
      // 调用插件的deactivate函数
      if (typeof plugin.deactivate === 'function') {
        await plugin.deactivate()
      }

      // 清理插件注册的命令、快捷键等
      this.cleanupPlugin(pluginId)

      plugin.active = false
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 创建插件API上下文
   * @param {string} pluginId - 插件ID
   */
  createPluginContext(pluginId) {
    return {
      // 编辑器核心API
      editor: this.editor,
      
      // 注册命令
      registerCommand: (commandId, handler, options = {}) => {
        this.registerCommand(pluginId, commandId, handler, options)
      },
      
      // 注册快捷键
      registerKeybinding: (key, commandId, options = {}) => {
        this.registerKeybinding(pluginId, key, commandId, options)
      },
      
      // 注册工具栏按钮
      registerToolbarButton: (button) => {
        this.registerToolbarButton(pluginId, button)
      },
      
      // 注册生命周期钩子
      onBeforeInit: (handler) => this.registerHook('beforeInit', pluginId, handler),
      onAfterInit: (handler) => this.registerHook('afterInit', pluginId, handler),
      onBeforeRender: (handler) => this.registerHook('beforeRender', pluginId, handler),
      onAfterRender: (handler) => this.registerHook('afterRender', pluginId, handler),
      onBeforeChange: (handler) => this.registerHook('beforeChange', pluginId, handler),
      onAfterChange: (handler) => this.registerHook('afterChange', pluginId, handler),
      onBeforeCommand: (handler) => this.registerHook('beforeCommand', pluginId, handler),
      onAfterCommand: (handler) => this.registerHook('afterCommand', pluginId, handler),
      onBeforeDestroy: (handler) => this.registerHook('beforeDestroy', pluginId, handler),
      onAfterDestroy: (handler) => this.registerHook('afterDestroy', pluginId, handler),
      
      // 工具函数
      log: (...args) => console.log(`[${pluginId}]`, ...args),
      warn: (...args) => console.warn(`[${pluginId}]`, ...args),
      error: (...args) => console.error(`[${pluginId}]`, ...args)
    }
  }

  /**
   * 注册命令
   */
  registerCommand(pluginId, commandId, handler, options = {}) {
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
   * 注册快捷键
   */
  registerKeybinding(pluginId, key, commandId, options = {}) {
    const fullCommandId = commandId.includes('.') ? commandId : `${pluginId}.${commandId}`
    
    if (!this.commands.has(fullCommandId)) {
      console.warn(`Command ${fullCommandId} not found`)
      return
    }

    const keybinding = {
      pluginId,
      key: key.toLowerCase(),
      commandId: fullCommandId,
      options
    }

    if (!this.keybindings.has(keybinding.key)) {
      this.keybindings.set(keybinding.key, [])
    }

    this.keybindings.get(keybinding.key).push(keybinding)
  }

  /**
   * 注册工具栏按钮
   */
  registerToolbarButton(pluginId, button) {
    const toolbarButton = {
      pluginId,
      ...button
    }

    this.toolbarButtons.push(toolbarButton)
  }

  /**
   * 注册生命周期钩子
   */
  registerHook(hookName, pluginId, handler) {
    if (!this.hooks[hookName]) {
      console.warn(`Hook ${hookName} not found`)
      return
    }

    this.hooks[hookName].push({
      pluginId,
      handler
    })
  }

  /**
   * 执行命令
   */
  executeCommand(commandId, ...args) {
    const command = this.commands.get(commandId)
    if (!command) {
      console.warn(`Command ${commandId} not found`)
      return
    }

    try {
      // 执行命令（同步执行，不等待钩子）
      const result = command.handler(...args)

      // 异步触发钩子，不影响返回值
      Promise.resolve().then(async () => {
        await this.triggerHook('beforeCommand', { commandId, args })
        await this.triggerHook('afterCommand', { commandId, args, result })
      })

      return result
    } catch (error) {
      console.error(`Failed to execute command ${commandId}:`, error)
      throw error
    }
  }

  /**
   * 处理快捷键
   */
  handleKeybinding(event) {
    const key = this.getKeyString(event)
    const bindings = this.keybindings.get(key)

    if (!bindings || bindings.length === 0) {
      return false
    }

    // 执行第一个匹配的命令，如果命令返回false则认为未处理
    const binding = bindings[0]
    
    // 先执行命令，看是否需要处理
    const result = this.executeCommand(binding.commandId)
    
    // 如果命令返回false，表示没有处理，不阻止默认行为
    if (result === false) {
      return false
    }
    
    // 命令处理了，阻止默认行为
    event.preventDefault()
    return true
  }

  /**
   * 获取快捷键字符串
   */
  getKeyString(event) {
    const parts = []
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    parts.push(event.key.toLowerCase())

    return parts.join('+')
  }

  /**
   * 触发生命周期钩子
   */
  async triggerHook(hookName, data = {}) {
    const hooks = this.hooks[hookName]
    if (!hooks || hooks.length === 0) {
      return
    }

    for (const { handler } of hooks) {
      try {
        await handler(data)
      } catch (error) {
        console.error(`Error in ${hookName} hook:`, error)
      }
    }
  }

  /**
   * 清理插件资源
   */
  cleanupPlugin(pluginId) {
    // 移除命令
    for (const [commandId, command] of this.commands.entries()) {
      if (command.pluginId === pluginId) {
        this.commands.delete(commandId)
      }
    }

    // 移除快捷键
    for (const [key, bindings] of this.keybindings.entries()) {
      const filtered = bindings.filter(b => b.pluginId !== pluginId)
      if (filtered.length === 0) {
        this.keybindings.delete(key)
      } else {
        this.keybindings.set(key, filtered)
      }
    }

    // 移除工具栏按钮
    this.toolbarButtons = this.toolbarButtons.filter(b => b.pluginId !== pluginId)

    // 移除钩子
    for (const hookName in this.hooks) {
      this.hooks[hookName] = this.hooks[hookName].filter(h => h.pluginId !== pluginId)
    }
  }

  /**
   * 获取所有插件
   */
  getPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取激活的插件
   */
  getActivePlugins() {
    return this.getPlugins().filter(p => p.active)
  }

  /**
   * 获取工具栏按钮
   */
  getToolbarButtons() {
    return this.toolbarButtons
  }

  /**
   * 销毁插件管理器
   */
  async destroy() {
    // 停用所有插件
    for (const plugin of this.plugins.values()) {
      if (plugin.active) {
        await this.deactivate(plugin.id)
      }
    }

    this.plugins.clear()
    this.commands.clear()
    this.keybindings.clear()
    this.toolbarButtons = []
    
    for (const hookName in this.hooks) {
      this.hooks[hookName] = []
    }
  }
}
