/**
 * Lexer Worker Manager
 * 管理 Web Worker 进行后台 Markdown 解析
 */
export class LexerWorkerManager {
  constructor(options = {}) {
    this.worker = null
    this.isReady = false
    this.enableWorker = options.enableWorker !== false
    
    // 回调队列
    this.callbacks = new Map()
    this.callbackId = 0
    
    // 缓存解析结果
    this.cache = new Map()
    this.maxCacheSize = options.maxCacheSize || 500
    
    if (this.enableWorker && typeof Worker !== 'undefined') {
      this.initWorker()
    }
  }
  
  /**
   * 初始化 Worker
   */
  initWorker() {
    try {
      // 创建 Worker（需要 Vite 配置支持）
      const workerCode = `
        ${this.getWorkerCode()}
      `
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      
      this.worker = new Worker(workerUrl)
      
      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e.data)
      }
      
      this.worker.onerror = (error) => {
        console.error('Lexer Worker error:', error)
        this.isReady = false
      }
    } catch (error) {
      console.warn('Failed to create worker, falling back to sync parsing:', error)
      this.enableWorker = false
    }
  }
  
  /**
   * 获取 Worker 代码（内联）
   */
  getWorkerCode() {
    // 这里内联 Worker 代码以避免构建配置问题
    return `
      const TOKEN_TYPES = {
        TEXT: 'text',
        HEADING: 'heading',
        BOLD: 'bold',
        ITALIC: 'italic',
        CODE: 'code',
        CODE_BLOCK: 'code_block'
      };
      
      function parseLine(text, lineIndex, context = {}) {
        const tokens = [];
        
        if (!text || text.length === 0) return tokens;
        
        if (text.trimStart().startsWith('\`\`\`')) {
          tokens.push({ type: TOKEN_TYPES.CODE_BLOCK, text, start: 0, end: text.length });
          return tokens;
        }
        
        if (context.inCodeBlock) {
          tokens.push({ type: TOKEN_TYPES.CODE, text, start: 0, end: text.length });
          return tokens;
        }
        
        const headingMatch = text.match(/^(#{1,6})\\s+(.+)$/);
        if (headingMatch) {
          tokens.push({ type: TOKEN_TYPES.HEADING, level: headingMatch[1].length, text, start: 0, end: text.length });
          return tokens;
        }
        
        tokens.push({ type: TOKEN_TYPES.TEXT, text, start: 0, end: text.length });
        return tokens;
      }
      
      self.onmessage = function(e) {
        const { type, data, id } = e.data;
        
        if (type === 'parseLine') {
          const { text, lineIndex, context } = data;
          const tokens = parseLine(text, lineIndex, context);
          self.postMessage({ type: 'parseLine', id, data: { lineIndex, tokens } });
        }
      };
      
      self.postMessage({ type: 'ready' });
    `
  }
  
  /**
   * 处理 Worker 消息
   */
  handleWorkerMessage(message) {
    const { type, id, data } = message
    
    switch (type) {
      case 'ready':
        this.isReady = true
        break
        
      case 'parseLine': {
        const callback = this.callbacks.get(id)
        if (callback) {
          callback(data)
          this.callbacks.delete(id)
        }
        break
      }
      
      default:
        console.warn('Unknown worker message:', type)
    }
  }
  
  /**
   * 异步解析单行（使用 Worker）
   */
  parseLineAsync(text, lineIndex, context = {}) {
    return new Promise((resolve) => {
      if (!this.enableWorker || !this.isReady) {
        // 降级到同步解析
        resolve(this.parseLineSync(text, lineIndex, context))
        return
      }
      
      // 检查缓存
      const cacheKey = `${lineIndex}_${text}`
      if (this.cache.has(cacheKey)) {
        resolve(this.cache.get(cacheKey))
        return
      }
      
      // 发送到 Worker
      const id = this.callbackId++
      this.callbacks.set(id, (data) => {
        // 缓存结果
        if (this.cache.size >= this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value
          this.cache.delete(firstKey)
        }
        this.cache.set(cacheKey, data.tokens)
        
        resolve(data.tokens)
      })
      
      this.worker.postMessage({
        type: 'parseLine',
        id,
        data: { text, lineIndex, context }
      })
    })
  }
  
  /**
   * 同步解析单行（降级方案）
   */
  parseLineSync(text, lineIndex, context = {}) {
    // 简化的同步解析实现
    const tokens = []
    
    if (!text || text.length === 0) return tokens
    
    // 代码块
    if (text.trimStart().startsWith('```')) {
      tokens.push({
        type: 'code_block',
        text,
        start: 0,
        end: text.length
      })
      return tokens
    }
    
    // 标题
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: headingMatch[1].length,
        text,
        start: 0,
        end: text.length
      })
      return tokens
    }
    
    // 默认文本
    tokens.push({
      type: 'text',
      text,
      start: 0,
      end: text.length
    })
    
    return tokens
  }
  
  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
  }
  
  /**
   * 销毁 Worker
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    
    this.callbacks.clear()
    this.cache.clear()
    this.isReady = false
  }
}
