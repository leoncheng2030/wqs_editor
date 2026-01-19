/**
 * 配置管理器
 * 负责插件配置的持久化、合并、校验
 */

import type { PluginConfigSchema, PluginConfig, StorageAdapter, PluginConfigField } from '../../types'
import { EventBus } from './EventBus'

/**
 * localStorage 存储适配器
 */
export class LocalStorageAdapter implements StorageAdapter {
  private prefix = 'canvas-editor:plugin:'

  async get(key: string): Promise<any> {
    try {
      const value = localStorage.getItem(this.prefix + key)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: any): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key)
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  async keys(): Promise<string[]> {
    const result: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.prefix)) {
        result.push(key.slice(this.prefix.length))
      }
    }
    return result
  }
}

/**
 * 内存存储适配器（用于测试或无持久化场景）
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, any> = new Map()

  async get(key: string): Promise<any> {
    return this.storage.get(key) ?? null
  }

  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }
}

/**
 * 配置管理器
 */
export class ConfigurationManager {
  private configs: Map<string, PluginConfig> = new Map()
  private storage: StorageAdapter
  private eventBus: EventBus | null = null

  constructor(storage?: StorageAdapter) {
    // 检查是否在浏览器环境
    if (storage) {
      this.storage = storage
    } else if (typeof localStorage !== 'undefined') {
      this.storage = new LocalStorageAdapter()
    } else {
      this.storage = new MemoryStorageAdapter()
    }
  }

  /**
   * 设置事件总线（用于发布配置变更事件）
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
  }

  /**
   * 注册插件配置模式
   */
  async registerSchema(pluginId: string, schema: PluginConfigSchema): Promise<void> {
    // 加载已保存的配置
    const savedConfig = await this.storage.get(`${pluginId}:config`)

    const config: PluginConfig = {
      pluginId,
      schema,
      values: {},
      userOverrides: savedConfig || {}
    }

    // 初始化默认值
    for (const [key, field] of Object.entries(schema)) {
      config.values[key] = field.default
    }

    // 应用用户覆盖值
    for (const [key, value] of Object.entries(config.userOverrides)) {
      if (key in schema) {
        const validated = this.validateValue(schema[key], value)
        if (validated.valid) {
          config.values[key] = value
        } else {
          console.warn(`Invalid config value for "${pluginId}.${key}":`, validated.reason)
        }
      }
    }

    this.configs.set(pluginId, config)
  }

  /**
   * 获取配置值
   */
  get<T = any>(pluginId: string, key: string): T {
    const config = this.configs.get(pluginId)
    if (!config) {
      console.warn(`Config not registered for plugin "${pluginId}"`)
      return undefined as T
    }

    if (!(key in config.values)) {
      console.warn(`Config key "${key}" not found for plugin "${pluginId}"`)
      return undefined as T
    }

    return config.values[key] as T
  }

  /**
   * 获取插件的所有配置
   */
  getAll(pluginId: string): Record<string, any> {
    const config = this.configs.get(pluginId)
    if (!config) {
      return {}
    }
    return { ...config.values }
  }

  /**
   * 设置配置值
   */
  async set(pluginId: string, key: string, value: any): Promise<void> {
    const config = this.configs.get(pluginId)
    if (!config) {
      console.warn(`Config not registered for plugin "${pluginId}"`)
      return
    }

    const field = config.schema[key]
    if (!field) {
      console.warn(`Config key "${key}" not in schema for plugin "${pluginId}"`)
      return
    }

    // 校验值
    const validated = this.validateValue(field, value)
    if (!validated.valid) {
      console.warn(`Invalid config value for "${pluginId}.${key}":`, validated.reason)
      return
    }

    const oldValue = config.values[key]
    config.values[key] = value
    config.userOverrides[key] = value

    // 持久化
    await this.storage.set(`${pluginId}:config`, config.userOverrides)

    // 发布配置变更事件
    if (this.eventBus) {
      this.eventBus.publish({
        type: `config:${pluginId}:changed`,
        source: 'config-manager',
        data: { key, value, oldValue },
        timestamp: Date.now(),
        propagation: true
      })
    }
  }

  /**
   * 重置配置
   */
  async reset(pluginId: string, key?: string): Promise<void> {
    const config = this.configs.get(pluginId)
    if (!config) {
      return
    }

    if (key) {
      // 重置单个配置项
      const field = config.schema[key]
      if (field) {
        const oldValue = config.values[key]
        config.values[key] = field.default
        delete config.userOverrides[key]

        await this.storage.set(`${pluginId}:config`, config.userOverrides)

        if (this.eventBus) {
          this.eventBus.publish({
            type: `config:${pluginId}:changed`,
            source: 'config-manager',
            data: { key, value: field.default, oldValue },
            timestamp: Date.now(),
            propagation: true
          })
        }
      }
    } else {
      // 重置所有配置
      for (const [k, field] of Object.entries(config.schema)) {
        config.values[k] = field.default
      }
      config.userOverrides = {}

      await this.storage.remove(`${pluginId}:config`)

      if (this.eventBus) {
        this.eventBus.publish({
          type: `config:${pluginId}:reset`,
          source: 'config-manager',
          data: { values: { ...config.values } },
          timestamp: Date.now(),
          propagation: true
        })
      }
    }
  }

  /**
   * 校验配置值
   */
  private validateValue(field: PluginConfigField, value: any): { valid: boolean; reason?: string } {
    // 类型校验
    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (field.type !== actualType && !(field.type === 'object' && actualType === 'object')) {
      return { valid: false, reason: `Expected ${field.type}, got ${actualType}` }
    }

    // 枚举校验
    if (field.enum && !field.enum.includes(value)) {
      return { valid: false, reason: `Value must be one of: ${field.enum.join(', ')}` }
    }

    // 自定义校验
    if (field.validate && !field.validate(value)) {
      return { valid: false, reason: 'Custom validation failed' }
    }

    return { valid: true }
  }

  /**
   * 导出配置
   */
  async exportConfig(pluginId?: string): Promise<string> {
    if (pluginId) {
      const config = this.configs.get(pluginId)
      if (!config) {
        return '{}'
      }
      return JSON.stringify({ [pluginId]: config.userOverrides }, null, 2)
    }

    const allConfigs: Record<string, any> = {}
    for (const [id, config] of this.configs) {
      allConfigs[id] = config.userOverrides
    }
    return JSON.stringify(allConfigs, null, 2)
  }

  /**
   * 导入配置
   */
  async importConfig(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json)
      
      for (const [pluginId, overrides] of Object.entries(imported)) {
        const config = this.configs.get(pluginId)
        if (config && typeof overrides === 'object' && overrides !== null) {
          for (const [key, value] of Object.entries(overrides as Record<string, any>)) {
            if (key in config.schema) {
              await this.set(pluginId, key, value)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to import config:', error)
      throw error
    }
  }

  /**
   * 清理插件配置
   */
  async cleanup(pluginId: string): Promise<void> {
    this.configs.delete(pluginId)
    await this.storage.remove(`${pluginId}:config`)
  }

  /**
   * 清理所有配置
   */
  async clear(): Promise<void> {
    this.configs.clear()
    await this.storage.clear()
  }
}
