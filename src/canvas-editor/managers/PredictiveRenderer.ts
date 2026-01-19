/**
 * PredictiveRenderer - 智能预测渲染器
 * 基于用户行为预测并提前准备渲染资源
 */

import type { PredictiveRendererOptions, Predictions } from '../types'

interface BehaviorPattern {
  scrollDown: number
  scrollUp: number
  fastScroll: number
  slowScroll: number
  jumpToLine: number
  search: number
  edit: number
}

interface BehaviorRecord {
  action: string
  data: Record<string, any>
  timestamp: number
}

interface PredictiveStats {
  predictions: number
  correctPredictions: number
  incorrectPredictions: number
}

interface PatternAnalysis {
  dominantAction: string | null
  frequency: Record<string, number>
  averageSpeed: number
  consistency: number
}

export class PredictiveRenderer {
  private enablePrediction: boolean
  private learningRate: number
  private behaviorHistory: BehaviorRecord[]
  private maxHistorySize: number
  private patterns: BehaviorPattern
  private predictions: Predictions
  private preRenderedContent: Map<string, any>
  private maxCacheSize: number
  private onPredict: ((predictions: Predictions) => void) | undefined
  private stats: PredictiveStats

  constructor(options: PredictiveRendererOptions = {}) {
    this.enablePrediction = options.enablePrediction !== false
    this.learningRate = options.learningRate || 0.1
    
    this.behaviorHistory = []
    this.maxHistorySize = 100
    
    this.patterns = {
      scrollDown: 0,
      scrollUp: 0,
      fastScroll: 0,
      slowScroll: 0,
      jumpToLine: 0,
      search: 0,
      edit: 0
    }
    
    this.predictions = {
      nextScrollDirection: 'down',
      nextScrollSpeed: 'normal',
      likelyAction: 'scroll'
    }
    
    this.preRenderedContent = new Map()
    this.maxCacheSize = 10
    
    this.onPredict = options.onPredict
    
    this.stats = {
      predictions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0
    }
  }
  
  /**
   * 记录用户行为
   */
  recordBehavior(action: string, data: Record<string, any> = {}): void {
    if (!this.enablePrediction) return
    
    const behavior: BehaviorRecord = {
      action,
      data,
      timestamp: Date.now()
    }
    
    this.behaviorHistory.push(behavior)
    
    if (this.behaviorHistory.length > this.maxHistorySize) {
      this.behaviorHistory.shift()
    }
    
    this.updatePatterns(action, data)
    this.generatePrediction()
  }
  
  /**
   * 更新行为模式
   */
  private updatePatterns(action: string, data: Record<string, any>): void {
    const alpha = this.learningRate
    
    switch (action) {
      case 'scroll':
        if (data.direction === 'down') {
          this.patterns.scrollDown = this.patterns.scrollDown * (1 - alpha) + alpha
          this.patterns.scrollUp = this.patterns.scrollUp * (1 - alpha)
        } else {
          this.patterns.scrollUp = this.patterns.scrollUp * (1 - alpha) + alpha
          this.patterns.scrollDown = this.patterns.scrollDown * (1 - alpha)
        }
        
        if (data.speed > 1) {
          this.patterns.fastScroll = this.patterns.fastScroll * (1 - alpha) + alpha
          this.patterns.slowScroll = this.patterns.slowScroll * (1 - alpha)
        } else {
          this.patterns.slowScroll = this.patterns.slowScroll * (1 - alpha) + alpha
          this.patterns.fastScroll = this.patterns.fastScroll * (1 - alpha)
        }
        break
        
      case 'jump':
        this.patterns.jumpToLine = this.patterns.jumpToLine * (1 - alpha) + alpha
        break
        
      case 'search':
        this.patterns.search = this.patterns.search * (1 - alpha) + alpha
        break
        
      case 'edit':
        this.patterns.edit = this.patterns.edit * (1 - alpha) + alpha
        break
    }
  }
  
  /**
   * 生成预测
   */
  private generatePrediction(): void {
    if (this.patterns.scrollDown > this.patterns.scrollUp) {
      this.predictions.nextScrollDirection = 'down'
    } else {
      this.predictions.nextScrollDirection = 'up'
    }
    
    if (this.patterns.fastScroll > this.patterns.slowScroll) {
      this.predictions.nextScrollSpeed = 'fast'
    } else {
      this.predictions.nextScrollSpeed = 'slow'
    }
    
    const actionScores: Record<string, number> = {
      scroll: this.patterns.scrollDown + this.patterns.scrollUp,
      jump: this.patterns.jumpToLine,
      search: this.patterns.search,
      edit: this.patterns.edit
    }
    
    let maxScore = 0
    let likelyAction = 'scroll'
    
    for (const [action, score] of Object.entries(actionScores)) {
      if (score > maxScore) {
        maxScore = score
        likelyAction = action
      }
    }
    
    this.predictions.likelyAction = likelyAction
    
    this.stats.predictions++
    
    if (this.onPredict) {
      this.onPredict(this.predictions)
    }
  }
  
  /**
   * 获取预测结果
   */
  getPrediction(): Predictions {
    return { ...this.predictions }
  }
  
  /**
   * 验证预测准确性
   */
  validatePrediction(actualAction: string): boolean {
    const predicted = this.predictions.likelyAction
    const correct = predicted === actualAction
    
    if (correct) {
      this.stats.correctPredictions++
    } else {
      this.stats.incorrectPredictions++
    }
    
    return correct
  }
  
  /**
   * 预渲染内容
   */
  async preRender<T>(key: string, renderFn: () => T | Promise<T>): Promise<T | null> {
    if (!this.enablePrediction) return null
    
    if (this.preRenderedContent.has(key)) {
      return this.preRenderedContent.get(key)
    }
    
    try {
      const content = await renderFn()
      
      if (this.preRenderedContent.size >= this.maxCacheSize) {
        const firstKey = this.preRenderedContent.keys().next().value
        if (firstKey) {
          this.preRenderedContent.delete(firstKey)
        }
      }
      
      this.preRenderedContent.set(key, content)
      return content
    } catch (error) {
      console.error('Pre-render failed:', error)
      return null
    }
  }
  
  /**
   * 获取预渲染内容
   */
  getPreRendered<T>(key: string): T | undefined {
    return this.preRenderedContent.get(key)
  }
  
  /**
   * 分析用户行为模式
   */
  analyzePatterns(): PatternAnalysis {
    const recentBehaviors = this.behaviorHistory.slice(-20)
    
    const analysis: PatternAnalysis = {
      dominantAction: null,
      frequency: {},
      averageSpeed: 0,
      consistency: 0
    }
    
    recentBehaviors.forEach(b => {
      analysis.frequency[b.action] = (analysis.frequency[b.action] || 0) + 1
    })
    
    let maxFreq = 0
    for (const [action, freq] of Object.entries(analysis.frequency)) {
      if (freq > maxFreq) {
        maxFreq = freq
        analysis.dominantAction = action
      }
    }
    
    analysis.consistency = recentBehaviors.length > 0 
      ? maxFreq / recentBehaviors.length 
      : 0
    
    return analysis
  }
  
  /**
   * 获取统计信息
   */
  getStats(): PredictiveStats & { accuracy: string; patterns: BehaviorPattern; currentPrediction: Predictions } {
    const total = this.stats.correctPredictions + this.stats.incorrectPredictions
    const accuracy = total > 0 
      ? (this.stats.correctPredictions / total * 100).toFixed(1)
      : '0'
    
    return {
      ...this.stats,
      accuracy: `${accuracy}%`,
      patterns: this.patterns,
      currentPrediction: this.predictions
    }
  }
  
  /**
   * 清除缓存
   */
  clear(): void {
    this.preRenderedContent.clear()
  }
  
  /**
   * 重置学习
   */
  reset(): void {
    this.behaviorHistory = []
    this.patterns = {
      scrollDown: 0,
      scrollUp: 0,
      fastScroll: 0,
      slowScroll: 0,
      jumpToLine: 0,
      search: 0,
      edit: 0
    }
    this.clear()
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.clear()
    this.behaviorHistory = []
    this.onPredict = undefined
  }
}
