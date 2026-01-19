/**
 * 文档分片管理器
 * 支持超大文档(5万行+)的分片加载和管理
 */

export interface ChunkManagerOptions {
  chunkSize?: number
  maxLoadedChunks?: number
  preloadChunks?: number
}

interface Chunk {
  lines: string[]
  loaded: boolean
  lastAccess: number
  chunkIndex: number
}

interface ChunkMetadata {
  chunkIndex: number
  startLine: number
  endLine: number
  lineCount: number
  loaded: boolean
}

interface ChunkStats {
  totalChunks: number
  loadedChunks: number
  chunkLoads: number
  chunkEvictions: number
}

export class ChunkManager {
  private chunkSize: number
  private maxLoadedChunks: number
  private preloadChunks: number
  private chunks: Map<number, Chunk>
  private chunkMetadata: ChunkMetadata[]
  private totalLines: number
  private accessOrder: number[]
  private loadingChunks: Set<number>
  private stats: ChunkStats

  constructor(options: ChunkManagerOptions = {}) {
    this.chunkSize = options.chunkSize || 1000
    this.maxLoadedChunks = options.maxLoadedChunks || 10
    this.preloadChunks = options.preloadChunks || 2

    this.chunks = new Map()
    this.chunkMetadata = []
    this.totalLines = 0

    this.accessOrder = []

    this.loadingChunks = new Set()

    this.stats = {
      totalChunks: 0,
      loadedChunks: 0,
      chunkLoads: 0,
      chunkEvictions: 0,
    }
  }

  /**
   * 初始化文档分片
   */
  initializeFromText(fullText: string): void {
    const allLines = fullText.split('\n')
    this.totalLines = allLines.length
    this.stats.totalChunks = Math.ceil(this.totalLines / this.chunkSize)

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

    this.loadChunk(0, allLines)

    if (this.stats.totalChunks === 1) {
      return
    }

    for (let i = 1; i < Math.min(3, this.stats.totalChunks); i++) {
      this.loadChunk(i, allLines)
    }
  }

  /**
   * 加载指定分片
   */
  loadChunk(chunkIndex: number, allLines: string[] | null = null): Promise<Chunk> {
    if (this.chunks.has(chunkIndex) || this.loadingChunks.has(chunkIndex)) {
      this.recordAccess(chunkIndex)
      return Promise.resolve(this.chunks.get(chunkIndex)!)
    }

    if (chunkIndex < 0 || chunkIndex >= this.stats.totalChunks) {
      return Promise.reject(new Error(`Invalid chunk index: ${chunkIndex}`))
    }

    this.loadingChunks.add(chunkIndex)

    return new Promise(resolve => {
      this.evictIfNeeded()

      const metadata = this.chunkMetadata[chunkIndex]
      let chunkLines: string[]

      if (allLines) {
        chunkLines = allLines.slice(metadata.startLine, metadata.endLine)
      } else {
        chunkLines = this.loadChunkFromStorage(chunkIndex)
      }

      const chunk: Chunk = {
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
  private loadChunkFromStorage(chunkIndex: number): string[] {
    console.warn(`Chunk ${chunkIndex} not in memory, should load from storage`)
    return []
  }

  /**
   * 获取指定行
   */
  async getLine(lineIndex: number): Promise<string> {
    if (lineIndex < 0 || lineIndex >= this.totalLines) {
      return ''
    }

    const chunkIndex = Math.floor(lineIndex / this.chunkSize)
    const chunk = await this.ensureChunkLoaded(chunkIndex)

    const localLineIndex = lineIndex - chunk.chunkIndex * this.chunkSize
    return chunk.lines[localLineIndex] || ''
  }

  /**
   * 获取指定范围的行
   */
  async getLines(startLine: number, endLine: number): Promise<string[]> {
    const lines: string[] = []
    const startChunk = Math.floor(startLine / this.chunkSize)
    const endChunk = Math.floor(endLine / this.chunkSize)

    const chunks: Chunk[] = []
    for (let i = startChunk; i <= endChunk; i++) {
      chunks.push(await this.ensureChunkLoaded(i))
    }

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
   * 确保分片已加载
   */
  async ensureChunkLoaded(chunkIndex: number): Promise<Chunk> {
    if (this.chunks.has(chunkIndex)) {
      this.recordAccess(chunkIndex)
      return this.chunks.get(chunkIndex)!
    }

    return await this.loadChunk(chunkIndex)
  }

  /**
   * 预加载相邻分片
   */
  async preloadAdjacentChunks(centerChunk: number): Promise<void> {
    const chunksToPreload: number[] = []

    for (let i = 1; i <= this.preloadChunks; i++) {
      const prevChunk = centerChunk - i
      if (prevChunk >= 0 && !this.chunks.has(prevChunk)) {
        chunksToPreload.push(prevChunk)
      }
    }

    for (let i = 1; i <= this.preloadChunks; i++) {
      const nextChunk = centerChunk + i
      if (nextChunk < this.stats.totalChunks && !this.chunks.has(nextChunk)) {
        chunksToPreload.push(nextChunk)
      }
    }

    chunksToPreload.forEach(chunkIndex => {
      this.loadChunk(chunkIndex).catch(err => {
        console.warn(`Preload chunk ${chunkIndex} failed:`, err)
      })
    })
  }

  /**
   * 驱逐最少使用的分片（LRU）
   */
  private evictIfNeeded(): void {
    if (this.chunks.size < this.maxLoadedChunks) {
      return
    }

    const sortedChunks = Array.from(this.chunks.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    )

    const toEvict = sortedChunks.slice(0, Math.ceil(this.maxLoadedChunks * 0.3))

    for (const [chunkIndex] of toEvict) {
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
  private recordAccess(chunkIndex: number): void {
    const chunk = this.chunks.get(chunkIndex)
    if (chunk) {
      chunk.lastAccess = Date.now()
    }

    const index = this.accessOrder.indexOf(chunkIndex)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(chunkIndex)

    if (this.accessOrder.length > 50) {
      this.accessOrder.shift()
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): ChunkStats & { memoryUsage: string; hitRate: string } {
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
  clear(): void {
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
  destroy(): void {
    this.clear()
  }
}
