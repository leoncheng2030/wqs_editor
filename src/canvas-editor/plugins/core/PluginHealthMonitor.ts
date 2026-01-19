/**
 * 插件健康监控
 * 负责监控插件运行状态，记录错误，自动恢复
 */

import type { PluginHealth, PluginError, PluginPhase, PluginStatus, ErrorRecoveryPolicy } from '../../types'
import { EventBus } from './EventBus'

const DEFAULT_RECOVERY_POLICY: ErrorRecoveryPolicy = {
  maxErrors: 5,
  timeWindow: 60000, // 1 分钟
  recoveryAction: 'disable',
  notifyUser: true
}

export class PluginHealthMonitor {
  private healthMap: Map<string, PluginHealth> = new Map()
  private recoveryPolicies: Map<string, ErrorRecoveryPolicy> = new Map()
  private eventBus: EventBus | null = null
  private recoveryCallbacks: Map<string, () => Promise<boolean>> = new Map()

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
  }

  /**
   * 注册恢复回调
   */
  setRecoveryCallback(pluginId: string, callback: () => Promise<boolean>): void {
    this.recoveryCallbacks.set(pluginId, callback)
  }

  /**
   * 初始化插件健康状态
   */
  initPlugin(pluginId: string): void {
    if (!this.healthMap.has(pluginId)) {
      this.healthMap.set(pluginId, {
        pluginId,
        status: 'healthy',
        errors: [],
        errorCount: 0,
        recoveryAttempts: 0
      })
    }
  }

  /**
   * 记录错误
   */
  recordError(pluginId: string, phase: PluginPhase, error: Error, context?: any): void {
    let health = this.healthMap.get(pluginId)
    if (!health) {
      this.initPlugin(pluginId)
      health = this.healthMap.get(pluginId)!
    }

    const pluginError: PluginError = {
      timestamp: Date.now(),
      phase,
      error,
      context,
      recovered: false
    }

    health.errors.push(pluginError)
    health.errorCount++
    health.lastError = new Date()

    // 只保留最近 50 条错误记录
    if (health.errors.length > 50) {
      health.errors = health.errors.slice(-50)
    }

    // 检查是否需要触发恢复策略
    this.checkRecoveryPolicy(pluginId)

    // 发布健康状态变更事件
    this.emitHealthChanged(pluginId, health)

    console.error(`[PluginHealthMonitor] Error in plugin "${pluginId}" during ${phase}:`, error)
  }

  /**
   * 标记错误已恢复
   */
  markRecovered(pluginId: string): void {
    const health = this.healthMap.get(pluginId)
    if (health && health.errors.length > 0) {
      const lastError = health.errors[health.errors.length - 1]
      lastError.recovered = true
    }
  }

  /**
   * 获取插件健康状态
   */
  getHealth(pluginId: string): PluginHealth | null {
    return this.healthMap.get(pluginId) || null
  }

  /**
   * 获取所有插件健康状态
   */
  getAllHealth(): PluginHealth[] {
    return Array.from(this.healthMap.values())
  }

  /**
   * 设置恢复策略
   */
  setRecoveryPolicy(pluginId: string, policy: Partial<ErrorRecoveryPolicy>): void {
    this.recoveryPolicies.set(pluginId, {
      ...DEFAULT_RECOVERY_POLICY,
      ...policy
    })
  }

  /**
   * 尝试恢复插件
   */
  async attemptRecovery(pluginId: string): Promise<boolean> {
    const health = this.healthMap.get(pluginId)
    if (!health) {
      return false
    }

    const policy = this.recoveryPolicies.get(pluginId) || DEFAULT_RECOVERY_POLICY

    // 检查恢复尝试次数
    if (health.recoveryAttempts >= 3) {
      console.warn(`[PluginHealthMonitor] Max recovery attempts reached for plugin "${pluginId}"`)
      this.updateStatus(pluginId, 'disabled')
      return false
    }

    health.recoveryAttempts++

    // 尝试执行恢复回调
    const callback = this.recoveryCallbacks.get(pluginId)
    if (callback) {
      try {
        const success = await callback()
        if (success) {
          this.updateStatus(pluginId, 'healthy')
          health.recoveryAttempts = 0
          console.log(`[PluginHealthMonitor] Plugin "${pluginId}" recovered successfully`)
          return true
        }
      } catch (error) {
        console.error(`[PluginHealthMonitor] Recovery failed for plugin "${pluginId}":`, error)
      }
    }

    // 恢复失败，根据策略处理
    if (policy.recoveryAction === 'disable') {
      this.updateStatus(pluginId, 'disabled')
    } else {
      this.updateStatus(pluginId, 'degraded')
    }

    return false
  }

  /**
   * 检查恢复策略
   */
  private checkRecoveryPolicy(pluginId: string): void {
    const health = this.healthMap.get(pluginId)
    if (!health) return

    const policy = this.recoveryPolicies.get(pluginId) || DEFAULT_RECOVERY_POLICY
    const now = Date.now()

    // 计算时间窗口内的错误数
    const recentErrors = health.errors.filter(
      e => now - e.timestamp < policy.timeWindow
    )

    if (recentErrors.length >= policy.maxErrors) {
      // 触发恢复策略
      switch (policy.recoveryAction) {
        case 'disable':
          this.updateStatus(pluginId, 'disabled')
          break
        case 'restart':
          this.updateStatus(pluginId, 'degraded')
          this.attemptRecovery(pluginId)
          break
        case 'ignore':
          this.updateStatus(pluginId, 'degraded')
          break
      }

      if (policy.notifyUser) {
        this.notifyUser(pluginId, recentErrors.length)
      }
    } else if (recentErrors.length > 0) {
      this.updateStatus(pluginId, 'degraded')
    }
  }

  /**
   * 更新插件状态
   */
  private updateStatus(pluginId: string, status: PluginStatus): void {
    const health = this.healthMap.get(pluginId)
    if (health && health.status !== status) {
      const oldStatus = health.status
      health.status = status
      this.emitHealthChanged(pluginId, health, oldStatus)
    }
  }

  /**
   * 发布健康状态变更事件
   */
  private emitHealthChanged(pluginId: string, health: PluginHealth, oldStatus?: PluginStatus): void {
    if (this.eventBus) {
      this.eventBus.publish({
        type: 'plugin:health-changed',
        source: 'health-monitor',
        data: {
          pluginId,
          health: { ...health },
          oldStatus
        },
        timestamp: Date.now(),
        propagation: true
      })
    }
  }

  /**
   * 通知用户
   */
  private notifyUser(pluginId: string, errorCount: number): void {
    console.warn(`[PluginHealthMonitor] Plugin "${pluginId}" has ${errorCount} errors in the time window`)
    
    if (this.eventBus) {
      this.eventBus.publish({
        type: 'plugin:health-warning',
        source: 'health-monitor',
        data: {
          pluginId,
          errorCount,
          message: `插件 "${pluginId}" 运行异常，已记录 ${errorCount} 个错误`
        },
        timestamp: Date.now(),
        propagation: true
      })
    }
  }

  /**
   * 重置插件健康状态
   */
  resetHealth(pluginId: string): void {
    this.healthMap.set(pluginId, {
      pluginId,
      status: 'healthy',
      errors: [],
      errorCount: 0,
      recoveryAttempts: 0
    })
  }

  /**
   * 清理插件健康记录
   */
  cleanup(pluginId: string): void {
    this.healthMap.delete(pluginId)
    this.recoveryPolicies.delete(pluginId)
    this.recoveryCallbacks.delete(pluginId)
  }

  /**
   * 清理所有记录
   */
  clear(): void {
    this.healthMap.clear()
    this.recoveryPolicies.clear()
    this.recoveryCallbacks.clear()
  }

  /**
   * 判断插件是否可用
   */
  isPluginUsable(pluginId: string): boolean {
    const health = this.healthMap.get(pluginId)
    if (!health) return true
    return health.status !== 'disabled' && health.status !== 'failed'
  }

  /**
   * 获取健康统计
   */
  getStats(): {
    total: number
    healthy: number
    degraded: number
    failed: number
    disabled: number
  } {
    const stats = {
      total: this.healthMap.size,
      healthy: 0,
      degraded: 0,
      failed: 0,
      disabled: 0
    }

    for (const health of this.healthMap.values()) {
      stats[health.status]++
    }

    return stats
  }
}
