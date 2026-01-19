/**
 * Lexer Worker Manager
 * 管理 Web Worker 进行后台 Markdown 解析
 * 
 * 功能：
 * - Worker 生命周期管理
 * - 任务队列和优先级
 * - 批量和增量解析
 * - 缓存管理
 * - 性能统计
 */

import type { 
  Token, 
  ParserContext, 
  WorkerMessage, 
  WorkerMessageType,
  WorkerTaskPriority,
  ParseResult,
  WorkerStats
} from '../types'

// Vite worker 导入
import LexerWorker from '../workers/markdown-lexer.worker.ts?worker'

export interface LexerWorkerOptions {
  enableWorker?: boolean
  maxQueueSize?: number
  batchDelay?: number
}

interface PendingTask {
  id: number
  resolve: (value: any) => void
  reject: (error: any) => void
  priority: WorkerTaskPriority
  timestamp: number
}

export class LexerWorkerManager {
  private worker: Worker | null = null
  private isReady = false
  private enableWorker: boolean
  private pendingTasks: Map<number, PendingTask> = new Map()
  private taskIdCounter = 0
  private taskQueue: Array<{ message: WorkerMessage; task: PendingTask }> = []
  private maxQueueSize: number
  private batchDelay: number
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private batchedLines: Array<{ text: string; lineIndex: number; resolve: (tokens: Token[]) => void; priority?: WorkerTaskPriority }> = []
  
  // 本地缓存（用于 Worker 不可用时）
  private localCache: Map<string, Token[]> = new Map()
  private maxLocalCacheSize = 500
  
  // 当前解析上下文
  private currentContext: ParserContext = {
    inCodeBlock: false,
    inMathBlock: false,
    inTable: false
  }

  constructor(options: LexerWorkerOptions = {}) {
    this.enableWorker = options.enableWorker !== false
    this.maxQueueSize = options.maxQueueSize || 100
    this.batchDelay = options.batchDelay || 16 // 约一帧
    
    if (this.enableWorker && typeof Worker !== 'undefined') {
      this.initWorker()
    }
  }
  
  /**
   * 初始化 Worker
   */
  private initWorker(): void {
    try {
      this.worker = new LexerWorker()
      
      this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(e.data)
      }
      
      this.worker.onerror = (error) => {
        console.error('Lexer Worker error:', error)
        this.handleWorkerError(error)
      }
    } catch (error) {
      console.warn('Failed to create worker, falling back to sync parsing:', error)
      this.enableWorker = false
    }
  }
  
  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    const { type, id, data } = message
    
    switch (type) {
      case 'ready':
        this.isReady = true
        this.processQueue()
        break
        
      case 'result': {
        if (id !== undefined) {
          const task = this.pendingTasks.get(id)
          if (task) {
            task.resolve(data)
            this.pendingTasks.delete(id)
          }
        }
        break
      }
      
      case 'error': {
        if (id !== undefined) {
          const task = this.pendingTasks.get(id)
          if (task) {
            task.reject(new Error(data?.message || 'Worker error'))
            this.pendingTasks.delete(id)
          }
        }
        break
      }
      
      default:
        console.warn('Unknown worker message:', type)
    }
  }
  
  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(error: ErrorEvent): void {
    this.isReady = false
    
    // 拒绝所有待处理的任务
    for (const task of this.pendingTasks.values()) {
      task.reject(error)
    }
    this.pendingTasks.clear()
    
    // 尝试重新初始化
    setTimeout(() => {
      if (this.enableWorker) {
        this.initWorker()
      }
    }, 1000)
  }
  
  /**
   * 发送消息到 Worker
   */
  private sendToWorker<T>(
    type: WorkerMessageType, 
    data: any, 
    priority: WorkerTaskPriority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.taskIdCounter++
      const task: PendingTask = {
        id,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      }
      
      const message: WorkerMessage = { type, id, data, priority }
      
      if (!this.isReady) {
        // 加入队列等待
        if (this.taskQueue.length < this.maxQueueSize) {
          this.taskQueue.push({ message, task })
          // 按优先级排序
          this.taskQueue.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 }
            return priorityOrder[a.task.priority] - priorityOrder[b.task.priority]
          })
        } else {
          reject(new Error('Task queue is full'))
        }
        return
      }
      
      this.pendingTasks.set(id, task)
      this.worker!.postMessage(message)
    })
  }
  
  /**
   * 处理队列中的任务
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.isReady) {
      const { message, task } = this.taskQueue.shift()!
      this.pendingTasks.set(task.id, task)
      this.worker!.postMessage(message)
    }
  }
  
  /**
   * 异步解析单行
   */
  async parseLineAsync(
    text: string, 
    lineIndex: number, 
    context?: ParserContext,
    priority: WorkerTaskPriority = 'normal'
  ): Promise<Token[]> {
    if (!this.enableWorker || !this.isReady) {
      return this.parseLineSync(text, lineIndex, context)
    }
    
    try {
      const result = await this.sendToWorker<{ lineIndex: number; tokens: Token[]; context?: Partial<ParserContext> }>(
        'parseLine',
        { text, lineIndex, context: context || this.currentContext },
        priority
      )
      
      // 更新上下文
      if (result.context) {
        this.currentContext = { ...this.currentContext, ...result.context }
      }
      
      return result.tokens
    } catch (error) {
      console.warn('Worker parse failed, falling back to sync:', error)
      return this.parseLineSync(text, lineIndex, context)
    }
  }
  
  /**
   * 批量解析多行（自动合并请求，自适应延迟）
   */
  parseLineBatched(text: string, lineIndex: number, priority: WorkerTaskPriority = 'normal'): Promise<Token[]> {
    return new Promise((resolve) => {
      this.batchedLines.push({ text, lineIndex, resolve, priority })
      
      if (!this.batchTimer) {
        // 计算自适应延迟
        const delay = this.calculateAdaptiveBatchDelay()
        this.batchTimer = setTimeout(() => {
          this.flushBatch()
        }, delay)
      }
    })
  }
  
  /**
   * 计算自适应批处理延迟
   * 根据队列大小和优先级分布动态调整
   */
  private calculateAdaptiveBatchDelay(): number {
    const queueSize = this.batchedLines.length
    const highPriorityCount = this.batchedLines.filter(l => l.priority === 'high').length
    
    // 高优先级任务较多时，缩短延迟
    if (highPriorityCount > 5) return 5
    
    // 队列较大时，缩短延迟以更快处理
    if (queueSize > 20) return 8
    if (queueSize > 10) return 12
    
    // 默认延迟
    return this.batchDelay
  }
  
  /**
   * 刷新批量请求
   */
  private async flushBatch(): Promise<void> {
    this.batchTimer = null
    
    if (this.batchedLines.length === 0) return
    
    const lines = this.batchedLines.splice(0)
    
    if (!this.enableWorker || !this.isReady) {
      // 同步解析
      for (const { text, lineIndex, resolve } of lines) {
        resolve(this.parseLineSync(text, lineIndex))
      }
      return
    }
    
    try {
      const result = await this.sendToWorker<{ results: ParseResult[] }>(
        'parseLines',
        { 
          lines: lines.map(l => ({ text: l.text, lineIndex: l.lineIndex })),
          context: this.currentContext
        },
        'normal'
      )
      
      // 分发结果
      const resultMap = new Map(result.results.map(r => [r.lineIndex, r]))
      for (const { lineIndex, resolve } of lines) {
        const parseResult = resultMap.get(lineIndex)
        resolve(parseResult?.tokens || [])
        
        // 更新上下文
        if (parseResult?.context) {
          this.currentContext = { ...this.currentContext, ...parseResult.context }
        }
      }
    } catch (error) {
      // 降级到同步解析
      for (const { text, lineIndex, resolve } of lines) {
        resolve(this.parseLineSync(text, lineIndex))
      }
    }
  }
  
  /**
   * 解析完整文档
   */
  async parseDocument(lines: string[]): Promise<ParseResult[]> {
    if (!this.enableWorker || !this.isReady) {
      return this.parseDocumentSync(lines)
    }
    
    try {
      const result = await this.sendToWorker<{ results: ParseResult[] }>(
        'parseDocument',
        { lines },
        'high'
      )
      return result.results
    } catch (error) {
      console.warn('Worker parseDocument failed, falling back to sync:', error)
      return this.parseDocumentSync(lines)
    }
  }
  
  /**
   * 增量解析
   */
  async parseIncremental(
    changes: Array<{ lineIndex: number; text: string; action: 'insert' | 'update' | 'delete' }>
  ): Promise<ParseResult[]> {
    if (!this.enableWorker || !this.isReady) {
      return this.parseIncrementalSync(changes)
    }
    
    try {
      const result = await this.sendToWorker<{ results: ParseResult[] }>(
        'parseIncremental',
        { changes, context: this.currentContext },
        'high'
      )
      return result.results
    } catch (error) {
      console.warn('Worker parseIncremental failed, falling back to sync:', error)
      return this.parseIncrementalSync(changes)
    }
  }
  
  /**
   * 同步解析单行（降级方案）
   */
  parseLineSync(text: string, lineIndex: number, context?: ParserContext): Token[] {
    const ctx = context || this.currentContext
    const cacheKey = `${lineIndex}:${ctx.inCodeBlock}:${text}`
    
    // 检查缓存
    if (this.localCache.has(cacheKey)) {
      return this.localCache.get(cacheKey)!
    }
    
    const tokens: Token[] = []
    
    if (!text || text.length === 0) return tokens
    
    const trimmed = text.trimStart()
    
    // 代码块
    if (ctx.inCodeBlock) {
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        tokens.push({ type: 'code_block_end', text, start: 0, end: text.length })
        this.currentContext.inCodeBlock = false
      } else {
        tokens.push({ type: 'code', text, start: 0, end: text.length })
      }
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 代码块开始
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const match = trimmed.match(/^(`{3,}|~{3,})(\w*)/)
      tokens.push({ 
        type: 'code_block_start', 
        text, 
        start: 0, 
        end: text.length,
        language: match?.[2]
      })
      this.currentContext.inCodeBlock = true
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 标题
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        text,
        start: 0,
        end: text.length,
        level: headingMatch[1].length
      })
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 引用
    if (trimmed.startsWith('>')) {
      tokens.push({ type: 'quote', text, start: 0, end: text.length })
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 列表
    if (/^\s*[-*+]\s/.test(text)) {
      // 任务列表
      if (/^\s*[-*+]\s+\[[ xX]\]/.test(text)) {
        const checked = /\[[xX]\]/.test(text)
        tokens.push({ 
          type: checked ? 'checkbox_checked' : 'checkbox', 
          text, 
          start: 0, 
          end: text.length,
          checked
        })
      } else {
        tokens.push({ type: 'list', text, start: 0, end: text.length })
      }
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 有序列表
    if (/^\s*\d+\.\s/.test(text)) {
      tokens.push({ type: 'list_ordered', text, start: 0, end: text.length })
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 分隔线
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      tokens.push({ type: 'hr', text, start: 0, end: text.length })
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 表格
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|[\s:-]+\|$/.test(trimmed)) {
        tokens.push({ type: 'table_separator', text, start: 0, end: text.length })
      } else {
        tokens.push({ type: 'table', text, start: 0, end: text.length })
      }
      this.addToLocalCache(cacheKey, tokens)
      return tokens
    }
    
    // 默认文本
    tokens.push({ type: 'text', text, start: 0, end: text.length })
    this.addToLocalCache(cacheKey, tokens)
    return tokens
  }
  
  /**
   * 同步解析文档
   */
  private parseDocumentSync(lines: string[]): ParseResult[] {
    const results: ParseResult[] = []
    this.currentContext = { inCodeBlock: false, inMathBlock: false, inTable: false }
    
    for (let i = 0; i < lines.length; i++) {
      const tokens = this.parseLineSync(lines[i], i)
      results.push({
        lineIndex: i,
        tokens,
        context: { ...this.currentContext }
      })
    }
    
    return results
  }
  
  /**
   * 同步增量解析
   */
  private parseIncrementalSync(
    changes: Array<{ lineIndex: number; text: string; action: 'insert' | 'update' | 'delete' }>
  ): ParseResult[] {
    const results: ParseResult[] = []
    
    for (const change of changes) {
      if (change.action === 'delete') continue
      
      const tokens = this.parseLineSync(change.text, change.lineIndex)
      results.push({
        lineIndex: change.lineIndex,
        tokens,
        context: { ...this.currentContext }
      })
    }
    
    return results
  }
  
  /**
   * 添加到本地缓存
   */
  private addToLocalCache(key: string, tokens: Token[]): void {
    if (this.localCache.size >= this.maxLocalCacheSize) {
      const firstKey = this.localCache.keys().next().value
      if (firstKey) {
        this.localCache.delete(firstKey)
      }
    }
    this.localCache.set(key, tokens)
  }
  
  /**
   * 更新解析上下文
   */
  updateContext(context: Partial<ParserContext>): void {
    this.currentContext = { ...this.currentContext, ...context }
  }
  
  /**
   * 重置上下文
   */
  resetContext(): void {
    this.currentContext = {
      inCodeBlock: false,
      inMathBlock: false,
      inTable: false
    }
  }
  
  /**
   * 获取 Worker 统计信息
   */
  async getStats(): Promise<WorkerStats | null> {
    if (!this.enableWorker || !this.isReady) {
      return null
    }
    
    try {
      const result = await this.sendToWorker<{ stats: WorkerStats }>('getStats', {})
      return result.stats
    } catch {
      return null
    }
  }
  
  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    this.localCache.clear()
    
    if (this.enableWorker && this.isReady) {
      try {
        await this.sendToWorker('clearCache', {})
      } catch {
        // 忽略错误
      }
    }
  }
  
  /**
   * 检查 Worker 是否可用
   */
  isWorkerReady(): boolean {
    return this.enableWorker && this.isReady
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    
    this.pendingTasks.clear()
    this.taskQueue = []
    this.batchedLines = []
    this.localCache.clear()
    this.isReady = false
  }
}
