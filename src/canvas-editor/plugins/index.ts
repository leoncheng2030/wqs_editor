/**
 * 插件系统入口
 */

// 核心模块
export { PluginManager } from './core/PluginManager'
export { DependencyResolver } from './core/DependencyResolver'
export { EventBus } from './core/EventBus'
export { ConfigurationManager, LocalStorageAdapter, MemoryStorageAdapter } from './core/ConfigurationManager'
export { PluginHealthMonitor } from './core/PluginHealthMonitor'

// 内置插件
export { TablePlugin } from './builtin/TablePlugin'
export { TodoListPlugin } from './builtin/TodoListPlugin'
export { MathPlugin } from './builtin/MathPlugin'
export { MermaidPlugin } from './builtin/MermaidPlugin'
export { AutoCompletePlugin } from './builtin/AutoCompletePlugin'
export { SyntaxCheckerPlugin } from './builtin/SyntaxCheckerPlugin'
export { FileIOPlugin } from './builtin/FileIOPlugin'
export { LSPPlugin } from './builtin/LSPPlugin'
export { PromptTemplatePlugin } from './builtin/PromptTemplatePlugin'
