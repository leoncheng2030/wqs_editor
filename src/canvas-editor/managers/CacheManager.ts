/**
 * 统一缓存管理器
 * 实现LRU缓存策略，动态调整缓存大小，协调各组件缓存
 */

export interface CacheManagerOptions {
  totalMemoryLimit?: number
  autoCleanup?: boolean
  cleanupInterval?: number
}

export interface CacheConfig {
  maxSize?: number
  priority?: number
  estimatedItemSize?: number
}

interface CacheEntry {
  instance: Map<any, any>
  maxSize: number
  priority: number
  estimatedItemSize: number
}

interface CacheStatsEntry {
  hits: number
  misses: number
  evictions: number
  lastAccessTime: number
}

interface CacheStatsOutput {
  size: number
  maxSize: number
  hits: number
  misses: number
  evictions: number
  hitRate: string
  priority: number
  estimatedMemory: string
}

interface AllStatsOutput {
  caches: Record<string, CacheStatsOutput>
  totalMemory: string
  memoryLimit: string
  memoryUsage: string
}

export class CacheManager {
  private totalMemoryLimit: number
  private caches: Map<string, CacheEntry>
  private cacheStats: Map<string, CacheStatsEntry>
  private autoCleanup: boolean
  private cleanupInterval: number
  private cleanupTimer: ReturnType<typeof setInterval> | null

  constructor(options: CacheManagerOptions = {}) {
    this.totalMemoryLimit = options.totalMemoryLimit || 50 * 1024 * 1024
    this.caches = new Map()
    this.cacheStats = new Map()

    this.autoCleanup = options.autoCleanup !== false
    this.cleanupInterval = options.cleanupInterval || 30000
    this.cleanupTimer = null

    if (this.autoCleanup) {
      this.startAutoCleanup()
    }
  }

  /**
   * 注册缓存实例
   */
  registerCache(name: string, cache: Map<any, any>, options: CacheConfig = {}): void {
    this.caches.set(name, {
      instance: cache,
      maxSize: options.maxSize || 1000,
      priority: options.priority || 1,
      estimatedItemSize: options.estimatedItemSize || 1024,
    })

    this.cacheStats.set(name, {
      hits: 0,
      misses: 0,
      evictions: 0,
      lastAccessTime: Date.now(),
    })
  }

  /**
   * 获取缓存实例
   */
  getCache(name: string): Map<any, any> | null {
    const cache = this.caches.get(name)
    if (cache) {
      const stats = this.cacheStats.get(name)
      if (stats) {
        stats.lastAccessTime = Date.now()
      }
      return cache.instance
    }
    return null
  }

  /**
   * 记录缓存命中
   */
  recordHit(name: string): void {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.hits++
      stats.lastAccessTime = Date.now()
    }
  }

  /**
   * 记录缓存未命中
   */
  recordMiss(name: string): void {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.misses++
    }
  }

  /**
   * 记录缓存驱逐
   */
  recordEviction(name: string): void {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.evictions++
    }
  }

  /**
   * 获取总内存使用量估计
   */
  getEstimatedMemoryUsage(): number {
    let totalSize = 0

    for (const [_name, cache] of this.caches) {
      const size = cache.instance.size || 0
      const itemSize = cache.estimatedItemSize
      totalSize += size * itemSize
    }

    return totalSize
  }

  /**
   * 动态调整缓存大小
   */
  adjustCacheSizes(): void {
    const memoryUsage = this.getEstimatedMemoryUsage()
    const memoryPressure = memoryUsage / this.totalMemoryLimit

    if (memoryPressure < 0.7) {
      return
    }

    console.log(`💾 内存压力: ${(memoryPressure * 100).toFixed(1)}%, 开始调整缓存...`)

    const cacheList = Array.from(this.caches.entries())
      .map(([name, cache]) => ({
        name,
        cache,
        stats: this.cacheStats.get(name)!,
        hitRate: this.getHitRate(name),
      }))
      .sort((a, b) => {
        if (a.cache.priority !== b.cache.priority) {
          return a.cache.priority - b.cache.priority
        }
        return a.hitRate - b.hitRate
      })

    let freedMemory = 0
    const targetFree = (memoryPressure - 0.5) * this.totalMemoryLimit

    for (const { name, cache, stats } of cacheList) {
      if (freedMemory >= targetFree) break

      const currentSize = cache.instance.size || 0
      const reduceBy = Math.ceil(currentSize * 0.3)

      this.evictOldest(cache.instance, reduceBy)

      const freedSize = reduceBy * cache.estimatedItemSize
      freedMemory += freedSize
      stats.evictions += reduceBy

      console.log(
        `  清理缓存 "${name}": 删除 ${reduceBy} 项, 释放约 ${(freedSize / 1024).toFixed(1)}KB`
      )
    }

    console.log(`✅ 缓存调整完成, 释放约 ${(freedMemory / 1024).toFixed(1)}KB`)
  }

  /**
   * 驱逐最旧的缓存项（LRU策略）
   */
  private evictOldest(cache: Map<any, any>, count: number): void {
    if (!cache || typeof cache.keys !== 'function') return

    const keys = Array.from(cache.keys())
    const toDelete = keys.slice(0, Math.min(count, keys.length))

    for (const key of toDelete) {
      cache.delete(key)
    }
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(name: string): number {
    const stats = this.cacheStats.get(name)
    if (!stats) return 0

    const total = stats.hits + stats.misses
    return total > 0 ? stats.hits / total : 0
  }

  /**
   * 获取所有缓存统计
   */
  getAllStats(): AllStatsOutput {
    const stats: Record<string, CacheStatsOutput> = {}

    for (const [name, cache] of this.caches) {
      const cacheStats = this.cacheStats.get(name)!
      stats[name] = {
        size: cache.instance.size || 0,
        maxSize: cache.maxSize,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        evictions: cacheStats.evictions,
        hitRate: `${(this.getHitRate(name) * 100).toFixed(1)}%`,
        priority: cache.priority,
        estimatedMemory: `${(((cache.instance.size || 0) * cache.estimatedItemSize) / 1024).toFixed(1)}KB`,
      }
    }

    return {
      caches: stats,
      totalMemory: `${(this.getEstimatedMemoryUsage() / 1024).toFixed(1)}KB`,
      memoryLimit: `${(this.totalMemoryLimit / 1024).toFixed(1)}KB`,
      memoryUsage: `${((this.getEstimatedMemoryUsage() / this.totalMemoryLimit) * 100).toFixed(1)}%`,
    }
  }

  /**
   * 启动自动清理
   */
  startAutoCleanup(): void {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(() => {
      this.adjustCacheSizes()
    }, this.cleanupInterval)
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const [name, cache] of this.caches) {
      if (cache.instance && typeof cache.instance.clear === 'function') {
        cache.instance.clear()
      }

      const stats = this.cacheStats.get(name)
      if (stats) {
        stats.hits = 0
        stats.misses = 0
        stats.evictions = 0
      }
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.stopAutoCleanup()
    this.clearAll()
    this.caches.clear()
    this.cacheStats.clear()
  }
}
