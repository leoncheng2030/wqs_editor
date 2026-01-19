/**
 * 事件总线
 * 负责插件间的解耦通信，支持发布/订阅模式
 */

import type { PluginEvent, EventSubscription, EventSubscribeOptions } from '../../types'

export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map()
  private subscriptionById: Map<string, EventSubscription> = new Map()
  private wildcardSubscriptions: Map<string, EventSubscription[]> = new Map()
  private subscriptionIdCounter = 0

  /**
   * 发布事件
   */
  publish(event: PluginEvent): void {
    const { type } = event
    
    // 确保 propagation 默认为 true
    if (event.propagation === undefined) {
      event.propagation = true
    }

    // 获取精确匹配的订阅
    const exactSubscriptions = this.subscriptions.get(type) || []
    
    // 获取通配符匹配的订阅
    const wildcardMatches = this.getWildcardMatches(type)

    // 合并并按优先级排序
    const allSubscriptions = [...exactSubscriptions, ...wildcardMatches]
      .sort((a, b) => a.priority - b.priority)

    // 依次执行订阅处理器
    for (const subscription of allSubscriptions) {
      if (!event.propagation) {
        break
      }

      try {
        const result = subscription.handler(event)
        
        // 如果是 Promise，不等待完成
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Error in event handler for "${type}" from plugin "${subscription.pluginId}":`, error)
          })
        }

        // 处理 once 订阅
        if (subscription.once) {
          this.unsubscribe(subscription.id)
        }
      } catch (error) {
        console.error(`Error in event handler for "${type}" from plugin "${subscription.pluginId}":`, error)
      }
    }
  }

  /**
   * 订阅事件
   */
  subscribe(
    pluginId: string,
    eventType: string,
    handler: (event: PluginEvent) => void | Promise<void>,
    options: EventSubscribeOptions = {}
  ): string {
    const id = `sub_${++this.subscriptionIdCounter}`
    const subscription: EventSubscription = {
      id,
      pluginId,
      eventType,
      handler,
      priority: options.priority ?? 100,
      once: options.once ?? false
    }

    this.subscriptionById.set(id, subscription)

    // 检查是否是通配符订阅
    if (eventType.endsWith(':*')) {
      const prefix = eventType.slice(0, -1) // 移除 '*'
      if (!this.wildcardSubscriptions.has(prefix)) {
        this.wildcardSubscriptions.set(prefix, [])
      }
      this.wildcardSubscriptions.get(prefix)!.push(subscription)
    } else {
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.set(eventType, [])
      }
      this.subscriptions.get(eventType)!.push(subscription)
    }

    return id
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptionById.get(subscriptionId)
    if (!subscription) return

    this.subscriptionById.delete(subscriptionId)

    // 从精确匹配列表中移除
    const exactList = this.subscriptions.get(subscription.eventType)
    if (exactList) {
      const index = exactList.findIndex(s => s.id === subscriptionId)
      if (index !== -1) {
        exactList.splice(index, 1)
      }
    }

    // 从通配符列表中移除
    if (subscription.eventType.endsWith(':*')) {
      const prefix = subscription.eventType.slice(0, -1)
      const wildcardList = this.wildcardSubscriptions.get(prefix)
      if (wildcardList) {
        const index = wildcardList.findIndex(s => s.id === subscriptionId)
        if (index !== -1) {
          wildcardList.splice(index, 1)
        }
      }
    }
  }

  /**
   * 取消插件的所有订阅
   */
  unsubscribeAll(pluginId: string): void {
    const toRemove: string[] = []

    for (const [id, subscription] of this.subscriptionById) {
      if (subscription.pluginId === pluginId) {
        toRemove.push(id)
      }
    }

    for (const id of toRemove) {
      this.unsubscribe(id)
    }
  }

  /**
   * 获取通配符匹配的订阅
   */
  private getWildcardMatches(eventType: string): EventSubscription[] {
    const results: EventSubscription[] = []

    for (const [prefix, subscriptions] of this.wildcardSubscriptions) {
      if (eventType.startsWith(prefix)) {
        results.push(...subscriptions)
      }
    }

    return results
  }

  /**
   * 创建事件
   */
  createEvent(source: string, type: string, data?: any): PluginEvent {
    return {
      type,
      source,
      data,
      timestamp: Date.now(),
      propagation: true
    }
  }

  /**
   * 等待事件（返回 Promise）
   */
  waitFor(eventType: string, timeout: number = 5000): Promise<PluginEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.unsubscribe(subscriptionId)
        reject(new Error(`Timeout waiting for event "${eventType}"`))
      }, timeout)

      const subscriptionId = this.subscribe(
        '__internal__',
        eventType,
        (event) => {
          clearTimeout(timeoutId)
          resolve(event)
        },
        { once: true }
      )
    })
  }

  /**
   * 获取事件类型的订阅数量
   */
  getSubscriptionCount(eventType?: string): number {
    if (eventType) {
      return (this.subscriptions.get(eventType)?.length || 0) +
        this.getWildcardMatches(eventType).length
    }
    return this.subscriptionById.size
  }

  /**
   * 清空所有订阅
   */
  clear(): void {
    this.subscriptions.clear()
    this.subscriptionById.clear()
    this.wildcardSubscriptions.clear()
  }
}
