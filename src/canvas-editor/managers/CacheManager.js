/**
 * 统一缓存管理器
 * 🚀 实现LRU缓存策略，动态调整缓存大小，协调各组件缓存
 */
export class CacheManager {
  constructor(options = {}) {
    // 全局缓存配置
    this.totalMemoryLimit = options.totalMemoryLimit || 50 * 1024 * 1024 // 50MB
    this.caches = new Map() // 存储各个缓存实例
    this.cacheStats = new Map() // 缓存统计信息

    // 自动清理配置
    this.autoCleanup = options.autoCleanup !== false
    this.cleanupInterval = options.cleanupInterval || 30000 // 30秒
    this.cleanupTimer = null

    if (this.autoCleanup) {
      this.startAutoCleanup()
    }
  }

  /**
   * 🚀 注册缓存实例
   * @param {string} name - 缓存名称
   * @param {Object} cache - 缓存实例（Map或自定义）
   * @param {Object} options - 缓存配置
   */
  registerCache(name, cache, options = {}) {
    this.caches.set(name, {
      instance: cache,
      maxSize: options.maxSize || 1000,
      priority: options.priority || 1, // 优先级：高优先级缓存不易被清理
      estimatedItemSize: options.estimatedItemSize || 1024, // 单项估计大小（字节）
    })

    this.cacheStats.set(name, {
      hits: 0,
      misses: 0,
      evictions: 0,
      lastAccessTime: Date.now(),
    })
  }

  /**
   * 🚀 获取缓存实例
   */
  getCache(name) {
    const cache = this.caches.get(name)
    if (cache) {
      const stats = this.cacheStats.get(name)
      stats.lastAccessTime = Date.now()
      return cache.instance
    }
    return null
  }

  /**
   * 🚀 记录缓存命中
   */
  recordHit(name) {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.hits++
      stats.lastAccessTime = Date.now()
    }
  }

  /**
   * 🚀 记录缓存未命中
   */
  recordMiss(name) {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.misses++
    }
  }

  /**
   * 🚀 记录缓存驱逐
   */
  recordEviction(name) {
    const stats = this.cacheStats.get(name)
    if (stats) {
      stats.evictions++
    }
  }

  /**
   * 🚀 获取总内存使用量估计
   */
  getEstimatedMemoryUsage() {
    let totalSize = 0

    for (const [name, cache] of this.caches) {
      const size = cache.instance.size || 0
      const itemSize = cache.estimatedItemSize
      totalSize += size * itemSize
    }

    return totalSize
  }

  /**
   * 🚀 动态调整缓存大小
   */
  adjustCacheSizes() {
    const memoryUsage = this.getEstimatedMemoryUsage()
    const memoryPressure = memoryUsage / this.totalMemoryLimit

    // 如果内存压力低于70%，不调整
    if (memoryPressure < 0.7) {
      return
    }

    console.log(`💾 内存压力: ${(memoryPressure * 100).toFixed(1)}%, 开始调整缓存...`)

    // 按优先级排序缓存（低优先级先清理）
    const cacheList = Array.from(this.caches.entries())
      .map(([name, cache]) => ({
        name,
        cache,
        stats: this.cacheStats.get(name),
        hitRate: this.getHitRate(name),
      }))
      .sort((a, b) => {
        // 优先级低的排前面
        if (a.cache.priority !== b.cache.priority) {
          return a.cache.priority - b.cache.priority
        }
        // 命中率低的排前面
        return a.hitRate - b.hitRate
      })

    // 清理低优先级和低命中率的缓存
    let freedMemory = 0
    const targetFree = (memoryPressure - 0.5) * this.totalMemoryLimit // 释放到50%

    for (const { name, cache, stats } of cacheList) {
      if (freedMemory >= targetFree) break

      const currentSize = cache.instance.size || 0
      const reduceBy = Math.ceil(currentSize * 0.3) // 减少30%

      // 删除最旧的条目
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
   * 🚀 驱逐最旧的缓存项（LRU策略）
   */
  evictOldest(cache, count) {
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
  getHitRate(name) {
    const stats = this.cacheStats.get(name)
    if (!stats) return 0

    const total = stats.hits + stats.misses
    return total > 0 ? stats.hits / total : 0
  }

  /**
   * 🚀 获取所有缓存统计
   */
  getAllStats() {
    const stats = {}

    for (const [name, cache] of this.caches) {
      const cacheStats = this.cacheStats.get(name)
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
   * 🚀 启动自动清理
   */
  startAutoCleanup() {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(() => {
      this.adjustCacheSizes()
    }, this.cleanupInterval)
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 清空所有缓存
   */
  clearAll() {
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
  destroy() {
    this.stopAutoCleanup()
    this.clearAll()
    this.caches.clear()
    this.cacheStats.clear()
  }
}
