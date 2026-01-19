/**
 * 全局类型定义
 */

// ============ 核心类型 ============

export interface Position {
  line: number
  column: number
}

export interface Range {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

// ============ 事件类型 ============

export interface KeyboardEventData {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
  preventDefault(): void
}

export interface InputEventData {
  data: string
}

export interface MouseEventData {
  x: number
  y: number
  button: number
}

// ============ 渲染相关类型 ============

export interface RenderContext {
  fullRender: boolean
  dirtyRegions: DirtyRegion[]
  staticLayerDirty: boolean
  offscreenCtx: CanvasRenderingContext2D | null
  offscreenCanvas: HTMLCanvasElement | null
}

export interface DirtyRegion {
  startLine: number
  endLine: number
}

export interface VisibleRange {
  startLine: number
  endLine: number
}

// ============ Token 类型 ============

export interface Token {
  type: string
  start: number
  end: number
  text: string
  escaped?: boolean
  checked?: boolean
  level?: number
  language?: string
  url?: string
  title?: string
}

export interface ParserContext {
  inCodeBlock?: boolean
  codeBlockLanguage?: string
  inMathBlock?: boolean
  inTable?: boolean
  [key: string]: any
}

// ============ Worker 类型 ============

export type TokenType = 
  | 'text'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'bold_italic'
  | 'strikethrough'
  | 'code'
  | 'code_block'
  | 'code_block_start'
  | 'code_block_end'
  | 'link'
  | 'image'
  | 'list'
  | 'list_ordered'
  | 'checkbox'
  | 'checkbox_checked'
  | 'quote'
  | 'hr'
  | 'table'
  | 'table_separator'
  | 'math_inline'
  | 'math_block'
  | 'html_tag'
  | 'footnote'
  | 'highlight'

export interface WorkerMessage {
  type: WorkerMessageType
  id?: number
  data?: any
  priority?: WorkerTaskPriority
}

export type WorkerMessageType = 
  | 'ready'
  | 'parseLine'
  | 'parseLines'
  | 'parseDocument'
  | 'parseIncremental'
  | 'clearCache'
  | 'getStats'
  | 'result'
  | 'error'

export type WorkerTaskPriority = 'high' | 'normal' | 'low'

export interface ParseLineRequest {
  text: string
  lineIndex: number
  context?: ParserContext
}

export interface ParseLinesRequest {
  lines: Array<{ text: string; lineIndex: number }>
  context?: ParserContext
}

export interface ParseIncrementalRequest {
  changedLines: Array<{ lineIndex: number; text: string; action: 'insert' | 'update' | 'delete' }>
  context?: ParserContext
}

export interface ParseResult {
  lineIndex: number
  tokens: Token[]
  context?: ParserContext
}

export interface WorkerStats {
  parseCount: number
  cacheHits: number
  cacheMisses: number
  cacheSize: number
  avgParseTime: number
  totalParseTime: number
}

// ============ 插件类型 ============

// 插件依赖声明
export interface PluginDependency {
  pluginId: string
  version?: string
  optional?: boolean
  reason?: string
}

// 事件总线相关
export interface PluginEvent {
  type: string
  source: string
  data: any
  timestamp: number
  propagation: boolean
}

export interface EventSubscription {
  id: string
  pluginId: string
  eventType: string
  handler: (event: PluginEvent) => void | Promise<void>
  priority: number
  once: boolean
}

export interface EventBusAPI {
  publish: (type: string, data?: any) => void
  subscribe: (eventType: string, handler: (event: PluginEvent) => void | Promise<void>, options?: EventSubscribeOptions) => string
  unsubscribe: (subscriptionId: string) => void
}

export interface EventSubscribeOptions {
  priority?: number
  once?: boolean
}

// 配置管理相关
export interface PluginConfigSchema {
  [key: string]: PluginConfigField
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  default: any
  description?: string
  enum?: any[]
  validate?: (value: any) => boolean
}

export interface PluginConfig {
  pluginId: string
  schema: PluginConfigSchema
  values: Record<string, any>
  userOverrides: Record<string, any>
}

export interface StorageAdapter {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}

export interface ConfigAPI {
  registerSchema: (schema: PluginConfigSchema) => void
  get: <T = any>(key: string) => T
  set: (key: string, value: any) => Promise<void>
  reset: (key?: string) => Promise<void>
}

// Hook 优先级相关
export interface HookOptions {
  priority?: number
  cancelable?: boolean
  timeout?: number
}

export interface HookContext {
  hookName: HookName
  data: any
  stopped: boolean
  stopPropagation: () => void
  isStopped: () => boolean
}

// 快捷键增强
export interface KeybindingEnhancedOptions extends KeybindingOptions {
  priority?: number
  conflictStrategy?: 'override' | 'fallback' | 'prompt'
}

// 健康监控相关
export type PluginPhase = 'activation' | 'command' | 'hook' | 'deactivation'
export type PluginStatus = 'healthy' | 'degraded' | 'failed' | 'disabled'

export interface PluginError {
  timestamp: number
  phase: PluginPhase
  error: Error
  context?: any
  recovered: boolean
}

export interface PluginHealth {
  pluginId: string
  status: PluginStatus
  errors: PluginError[]
  lastError?: Date
  errorCount: number
  recoveryAttempts: number
}

export interface ErrorRecoveryPolicy {
  maxErrors: number
  timeWindow: number
  recoveryAction: 'disable' | 'restart' | 'ignore'
  notifyUser: boolean
}

// 依赖解析相关
export interface DependencyNode {
  pluginId: string
  dependencies: string[]
  dependents: string[]
  depth: number
  state: 'pending' | 'resolving' | 'resolved' | 'failed'
}

export interface PluginContext {
  editor: EditorCore
  pluginId: string
  registerCommand: (commandId: string, handler: CommandHandler, options?: CommandOptions) => void
  registerKeybinding: (key: string, commandId: string, options?: KeybindingEnhancedOptions) => void
  registerToolbarButton: (button: Omit<ToolbarButton, 'pluginId'>) => void
  onBeforeInit: (handler: HookHandler, options?: HookOptions) => void
  onAfterInit: (handler: HookHandler, options?: HookOptions) => void
  onBeforeRender: (handler: HookHandler, options?: HookOptions) => void
  onAfterRender: (handler: HookHandler, options?: HookOptions) => void
  onBeforeChange: (handler: HookHandler, options?: HookOptions) => void
  onAfterChange: (handler: HookHandler, options?: HookOptions) => void
  onBeforeCommand: (handler: HookHandler, options?: HookOptions) => void
  onAfterCommand: (handler: HookHandler, options?: HookOptions) => void
  onBeforeDestroy: (handler: HookHandler, options?: HookOptions) => void
  onAfterDestroy: (handler: HookHandler, options?: HookOptions) => void
  eventBus: EventBusAPI
  config: ConfigAPI
  log: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export interface Plugin {
  id: string
  name: string
  version: string
  description?: string
  dependencies?: PluginDependency[]
  provides?: string[]
  activate: (context: PluginContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

export interface EditorCore {
  document: any
  cursor: any
  selection: any
  viewport: any
  history: any
  clipboard: any
  render: (immediate?: boolean) => void
}

export type CommandHandler = (...args: any[]) => any

export interface CommandOptions {
  title?: string
  description?: string
}

export interface KeybindingOptions {
  when?: string
}

export interface ToolbarButton {
  id: string
  icon: string
  title: string
  command: string
  commandArgs?: any[]
  pluginId?: string
}

export type HookHandler = (data?: any) => void | Promise<void>

export interface PluginCommand {
  pluginId: string
  commandId: string
  handler: (...args: any[]) => any
  options: Record<string, any>
  fullCommandId: string
}

export interface PluginKeybinding {
  pluginId: string
  key: string
  commandId: string
  priority: number
  when?: string
  conflictStrategy: 'override' | 'fallback' | 'prompt'
  options: Record<string, any>
}

export type HookName = 'beforeInit' | 'afterInit' | 'beforeRender' | 'afterRender' | 
  'beforeChange' | 'afterChange' | 'beforeCommand' | 'afterCommand' | 
  'beforeDestroy' | 'afterDestroy'

export interface HookEntry {
  pluginId: string
  handler: HookHandler
  priority: number
  cancelable: boolean
  timeout?: number
}

export type HooksMap = {
  [K in HookName]: HookEntry[]
}

// ============ 语法诊断类型 ============

export interface Diagnostic {
  line: number
  column: number
  length: number
  message: string
  severity: 'error' | 'warning' | 'info'
  source?: string
}

// ============ 主题类型 ============

export type Theme = 'light' | 'dark'

export interface ThemeColors {
  background: string
  text: string
  comment: string
  keyword: string
  string: string
  number: string
  operator: string
  punctuation: string
  [key: string]: string
}

// ============ 配置类型 ============

export interface EditorConfig {
  theme?: Theme
  fontSize?: number
  lineHeight?: number
  fontFamily?: string
  enableSyntaxHighlight?: boolean
  showLineNumbers?: boolean
  showToolbar?: boolean
}

export interface ViewportOptions {
  width?: number
  height?: number
  lineHeight?: number
  padding?: number
}

export interface RenderOptimizerOptions {
  debounceDelay?: number
  useRAF?: boolean
  targetFPS?: number
}

export interface PreloadOptions {
  preloadLines?: number
  preloadThreshold?: number
  onPreload?: (data: PreloadData) => void | Promise<void>
}

export interface PreloadData {
  startLine: number
  endLine: number
  direction: 'up' | 'down'
  speed: number
}

export interface PredictiveRendererOptions {
  enablePrediction?: boolean
  learningRate?: number
  onPredict?: (predictions: Predictions) => void
}

export interface Predictions {
  nextScrollDirection: 'up' | 'down'
  nextScrollSpeed: 'fast' | 'slow' | 'normal'
  likelyAction: string
}

// ============ 历史记录类型 ============

export interface HistoryOperation {
  type: 'insert' | 'delete'
  line: number
  column: number
  text: string
  cursorBefore: Position
  cursorAfter: Position
  timestamp?: number
}

export interface HistoryOptions {
  maxSize?: number
  mergeDelay?: number
}

// ============ 渲染器选项类型 ============

export interface TextRendererOptions {
  fontSize?: number
  lineHeight?: number
  fontFamily?: string
  textColor?: string
  backgroundColor?: string
  enableSyntaxHighlight?: boolean
}

export interface CursorRendererOptions {
  color?: string
  width?: number
  blinkInterval?: number
}

export interface SelectionRendererOptions {
  color?: string
}

export interface LineNumberRendererOptions {
  fontSize?: number
  color?: string
  backgroundColor?: string
  padding?: number
  width?: number
}

// ============ 统计类型 ============

export interface PerformanceStats {
  optimizer?: {
    dirtyRegions: number
    fullRenderNeeded: boolean
    hasOffscreenCanvas: boolean
  }
  preload?: {
    preloadCount: number
    hitCount: number
    missCount: number
    hitRate: string
  }
  prediction?: {
    predictions: number
    correctPredictions: number
    incorrectPredictions: number
    accuracy: string
    patterns: any
    currentPrediction: Predictions
  }
}
