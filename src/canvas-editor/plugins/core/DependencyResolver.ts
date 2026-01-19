/**
 * 插件依赖解析器
 * 负责解析插件依赖关系，执行拓扑排序，检测循环依赖
 */

import type { Plugin, DependencyNode } from '../../types'

export class DependencyResolver {
  private nodes: Map<string, DependencyNode> = new Map()
  private plugins: Map<string, Plugin> = new Map()

  /**
   * 构建依赖图
   */
  buildGraph(plugins: Map<string, Plugin>): DependencyNode[] {
    this.plugins = plugins
    this.nodes.clear()

    // 创建所有节点
    for (const [pluginId, plugin] of plugins) {
      this.nodes.set(pluginId, {
        pluginId,
        dependencies: [],
        dependents: [],
        depth: 0,
        state: 'pending'
      })
    }

    // 解析依赖关系
    for (const [pluginId, plugin] of plugins) {
      const node = this.nodes.get(pluginId)!
      
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          // 检查依赖是否存在
          if (this.nodes.has(dep.pluginId)) {
            node.dependencies.push(dep.pluginId)
            // 更新被依赖方的 dependents
            const depNode = this.nodes.get(dep.pluginId)!
            depNode.dependents.push(pluginId)
          } else if (!dep.optional) {
            console.warn(`Plugin "${pluginId}" depends on "${dep.pluginId}" which is not registered`)
          }
        }
      }
    }

    return Array.from(this.nodes.values())
  }

  /**
   * Kahn 算法拓扑排序
   * 返回激活顺序（依赖在前，被依赖在后）
   */
  topologicalSort(nodes: DependencyNode[]): string[] {
    const result: string[] = []
    const inDegree: Map<string, number> = new Map()
    const queue: string[] = []

    // 计算入度
    for (const node of nodes) {
      inDegree.set(node.pluginId, node.dependencies.length)
      if (node.dependencies.length === 0) {
        queue.push(node.pluginId)
      }
    }

    // BFS 处理
    while (queue.length > 0) {
      const pluginId = queue.shift()!
      result.push(pluginId)

      const node = this.nodes.get(pluginId)!
      for (const dependent of node.dependents) {
        const degree = inDegree.get(dependent)! - 1
        inDegree.set(dependent, degree)
        if (degree === 0) {
          queue.push(dependent)
        }
      }
    }

    // 检查是否所有节点都被处理
    if (result.length !== nodes.length) {
      const remaining = nodes
        .filter(n => !result.includes(n.pluginId))
        .map(n => n.pluginId)
      console.warn('Circular dependency detected, remaining plugins:', remaining)
    }

    return result
  }

  /**
   * 检测循环依赖 (DFS)
   * 返回所有循环依赖的环
   */
  detectCycles(nodes: DependencyNode[]): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const path: string[] = []

    const dfs = (pluginId: string): boolean => {
      if (visiting.has(pluginId)) {
        // 找到循环，提取环
        const cycleStart = path.indexOf(pluginId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), pluginId])
        }
        return true
      }

      if (visited.has(pluginId)) {
        return false
      }

      visiting.add(pluginId)
      path.push(pluginId)

      const node = this.nodes.get(pluginId)
      if (node) {
        for (const dep of node.dependencies) {
          dfs(dep)
        }
      }

      path.pop()
      visiting.delete(pluginId)
      visited.add(pluginId)

      return false
    }

    for (const node of nodes) {
      if (!visited.has(node.pluginId)) {
        dfs(node.pluginId)
      }
    }

    return cycles
  }

  /**
   * 获取插件的激活顺序
   */
  getActivationOrder(pluginIds: string[]): string[] {
    // 只处理指定的插件
    const relevantNodes = Array.from(this.nodes.values())
      .filter(n => pluginIds.includes(n.pluginId))

    // 检测循环依赖
    const cycles = this.detectCycles(relevantNodes)
    if (cycles.length > 0) {
      console.error('Circular dependencies detected:', cycles)
      // 即使有循环依赖，也尝试返回一个合理的顺序
    }

    return this.topologicalSort(relevantNodes)
  }

  /**
   * 检查插件是否可以安全停用
   * 如果有其他活跃插件依赖它，则不能停用
   */
  canDeactivate(pluginId: string, activePlugins: Set<string>): boolean {
    const node = this.nodes.get(pluginId)
    if (!node) return true

    for (const dependent of node.dependents) {
      if (activePlugins.has(dependent)) {
        return false
      }
    }

    return true
  }

  /**
   * 获取插件的所有依赖（递归）
   */
  getAllDependencies(pluginId: string): string[] {
    const result = new Set<string>()
    const visited = new Set<string>()

    const collect = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)

      const node = this.nodes.get(id)
      if (node) {
        for (const dep of node.dependencies) {
          result.add(dep)
          collect(dep)
        }
      }
    }

    collect(pluginId)
    return Array.from(result)
  }

  /**
   * 获取依赖该插件的所有插件（递归）
   */
  getAllDependents(pluginId: string): string[] {
    const result = new Set<string>()
    const visited = new Set<string>()

    const collect = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)

      const node = this.nodes.get(id)
      if (node) {
        for (const dep of node.dependents) {
          result.add(dep)
          collect(dep)
        }
      }
    }

    collect(pluginId)
    return Array.from(result)
  }

  /**
   * 验证依赖完整性
   */
  validateDependencies(pluginId: string): { valid: boolean; missing: string[]; optional: string[] } {
    const plugin = this.plugins.get(pluginId)
    const missing: string[] = []
    const optional: string[] = []

    if (plugin?.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep.pluginId)) {
          if (dep.optional) {
            optional.push(dep.pluginId)
          } else {
            missing.push(dep.pluginId)
          }
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      optional
    }
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.nodes.clear()
    this.plugins.clear()
  }
}
