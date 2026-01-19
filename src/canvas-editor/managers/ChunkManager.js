/**
 * 文档分片管理器
 * 🚀 支持超大文档(5万行+)的分片加载和管理
 */
export class ChunkManager {
  constructor(options = {}) {
    // 分片配置
    this.chunkSize = options.chunkSize || 1000 // 每个分片1000行
    this.maxLoadedChunks = options.maxLoadedChunks || 10 // 最多保留10个分片在内存
    this.preloadChunks = options.preloadChunks || 2 // 预加载相邻2个分片

    // 分片存储
    this.chunks = new Map() // chunkIndex -> { lines: [], loaded: boolean, lastAccess: timestamp }
    this.chunkMetadata = [] // 每个分片的元数据
    this.totalLines = 0

    // 访问追踪（LRU）
    this.accessOrder = []

    // 加载状态
    this.loadingChunks = new Set()

    // 统计
    this.stats = {
      totalChunks: 0,
      loadedChunks: 0,
      chunkLoads: 0,
      chunkEvictions: 0,
    }
  }

  /**
   * 🚀 初始化文档分片
   * @param {string} fullText - 完整文档文本
   */
  initializeFromText(fullText) {
    const allLines = fullText.split('\n')
    this.totalLines = allLines.length
    this.stats.totalChunks = Math.ceil(this.totalLines / this.chunkSize)

    // 创建分片元数据
    this.chunkMetadata = []
    for (let i = 0; i < this.stats.totalChunks; i++) {
      const startLine = i * this.chunkSize
      const endLine = Math.min(startLine + this.chunkSize, this.totalLines)

      this.chunkMetadata.push({
        chunkIndex: i,
        startLine,
        endLine,
        lineCount: endLine - startLine,
        loaded: false,
      })
    }

    // 加载第一个分片（首屏）
    this.loadChunk(0, allLines)

    // 如果文档小于单个分片，直接全部加载
    if (this.stats.totalChunks === 1) {
      return
    }

    // 预加载前几个分片
    for (let i = 1; i < Math.min(3, this.stats.totalChunks); i++) {
      this.loadChunk(i, allLines)
    }
  }

  /**
   * 🚀 加载指定分片
   * @param {number} chunkIndex - 分片索引
   * @param {Array} allLines - 完整文档行数组（可选，用于初始化）
   */
  loadChunk(chunkIndex, allLines = null) {
    // 检查是否已加载或正在加载
    if (this.chunks.has(chunkIndex) || this.loadingChunks.has(chunkIndex)) {
      this.recordAccess(chunkIndex)
      return Promise.resolve(this.chunks.get(chunkIndex))
    }

    // 检查索引有效性
    if (chunkIndex < 0 || chunkIndex >= this.stats.totalChunks) {
      return Promise.reject(new Error(`Invalid chunk index: ${chunkIndex}`))
    }

    this.loadingChunks.add(chunkIndex)

    return new Promise(resolve => {
      // 检查是否需要驱逐旧分片
      this.evictIfNeeded()

      const metadata = this.chunkMetadata[chunkIndex]
      let chunkLines

      if (allLines) {
        // 从完整文档中提取分片
        chunkLines = allLines.slice(metadata.startLine, metadata.endLine)
      } else {
        // 从存储中加载（预留接口，用于未来从服务器加载）
        chunkLines = this.loadChunkFromStorage(chunkIndex)
      }

      // 存储分片
      const chunk = {
        lines: chunkLines,
        loaded: true,
        lastAccess: Date.now(),
        chunkIndex,
      }

      this.chunks.set(chunkIndex, chunk)
      metadata.loaded = true
      this.stats.loadedChunks = this.chunks.size
      this.stats.chunkLoads++

      this.loadingChunks.delete(chunkIndex)
      this.recordAccess(chunkIndex)

      resolve(chunk)
    })
  }

  /**
   * 从存储加载分片（占位方法）
   */
  loadChunkFromStorage(chunkIndex) {
    // TODO: 从IndexedDB或服务器加载
    console.warn(`Chunk ${chunkIndex} not in memory, should load from storage`)
    return []
  }

  /**
   * 🚀 获取指定行
   * @param {number} lineIndex - 行号（全局）
   */
  async getLine(lineIndex) {
    if (lineIndex < 0 || lineIndex >= this.totalLines) {
      return ''
    }

    const chunkIndex = Math.floor(lineIndex / this.chunkSize)
    const chunk = await this.ensureChunkLoaded(chunkIndex)

    const localLineIndex = lineIndex - chunk.chunkIndex * this.chunkSize
    return chunk.lines[localLineIndex] || ''
  }

  /**
   * 🚀 获取指定范围的行
   * @param {number} startLine - 起始行
   * @param {number} endLine - 结束行
   */
  async getLines(startLine, endLine) {
    const lines = []
    const startChunk = Math.floor(startLine / this.chunkSize)
    const endChunk = Math.floor(endLine / this.chunkSize)

    // 加载所有需要的分片
    const chunks = []
    for (let i = startChunk; i <= endChunk; i++) {
      chunks.push(await this.ensureChunkLoaded(i))
    }

    // 提取行
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      if (lineIndex >= this.totalLines) break

      const chunkIndex = Math.floor(lineIndex / this.chunkSize)
      const chunk = chunks[chunkIndex - startChunk]
      const localLineIndex = lineIndex - chunk.chunkIndex * this.chunkSize

      lines.push(chunk.lines[localLineIndex] || '')
    }

    return lines
  }

  /**
   * 🚀 确保分片已加载
   */
  async ensureChunkLoaded(chunkIndex) {
    if (this.chunks.has(chunkIndex)) {
      this.recordAccess(chunkIndex)
      return this.chunks.get(chunkIndex)
    }

    return await this.loadChunk(chunkIndex)
  }

  /**
   * 🚀 预加载相邻分片
   * @param {number} centerChunk - 中心分片索引
   */
  async preloadAdjacentChunks(centerChunk) {
    const chunksToPreload = []

    // 向前预加载
    for (let i = 1; i <= this.preloadChunks; i++) {
      const prevChunk = centerChunk - i
      if (prevChunk >= 0 && !this.chunks.has(prevChunk)) {
        chunksToPreload.push(prevChunk)
      }
    }

    // 向后预加载
    for (let i = 1; i <= this.preloadChunks; i++) {
      const nextChunk = centerChunk + i
      if (nextChunk < this.stats.totalChunks && !this.chunks.has(nextChunk)) {
        chunksToPreload.push(nextChunk)
      }
    }

    // 异步预加载（不阻塞）
    chunksToPreload.forEach(chunkIndex => {
      this.loadChunk(chunkIndex).catch(err => {
        console.warn(`Preload chunk ${chunkIndex} failed:`, err)
      })
    })
  }

  /**
   * 🚀 驱逐最少使用的分片（LRU）
   */
  evictIfNeeded() {
    if (this.chunks.size < this.maxLoadedChunks) {
      return
    }

    // 按访问时间排序
    const sortedChunks = Array.from(this.chunks.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    )

    // 驱逐最旧的分片
    const toEvict = sortedChunks.slice(0, Math.ceil(this.maxLoadedChunks * 0.3))

    for (const [chunkIndex, _chunk] of toEvict) {
      this.chunks.delete(chunkIndex)
      this.chunkMetadata[chunkIndex].loaded = false
      this.stats.chunkEvictions++
    }

    this.stats.loadedChunks = this.chunks.size

    console.log(`💾 驱逐 ${toEvict.length} 个分片，当前加载: ${this.chunks.size}`)
  }

  /**
   * 记录访问
   */
  recordAccess(chunkIndex) {
    const chunk = this.chunks.get(chunkIndex)
    if (chunk) {
      chunk.lastAccess = Date.now()
    }

    // 更新访问顺序
    const index = this.accessOrder.indexOf(chunkIndex)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(chunkIndex)

    // 限制访问历史长度
    if (this.accessOrder.length > 50) {
      this.accessOrder.shift()
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      loadedChunks: this.chunks.size,
      memoryUsage: `${((this.chunks.size * this.chunkSize * 100) / 1024).toFixed(1)}KB`,
      hitRate:
        this.stats.chunkLoads > 0
          ? `${((1 - this.stats.chunkEvictions / this.stats.chunkLoads) * 100).toFixed(1)}%`
          : '0%',
    }
  }

  /**
   * 清空所有分片
   */
  clear() {
    this.chunks.clear()
    this.chunkMetadata = []
    this.accessOrder = []
    this.loadingChunks.clear()
    this.stats = {
      totalChunks: 0,
      loadedChunks: 0,
      chunkLoads: 0,
      chunkEvictions: 0,
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.clear()
  }
}
