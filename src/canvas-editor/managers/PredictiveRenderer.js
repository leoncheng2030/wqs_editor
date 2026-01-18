/**
 * PredictiveRenderer - 智能预测渲染器
 * 基于用户行为预测并提前准备渲染资源
 */
export class PredictiveRenderer {
  constructor(options = {}) {
    // 配置
    this.enablePrediction = options.enablePrediction !== false
    this.learningRate = options.learningRate || 0.1
    
    // 用户行为历史
    this.behaviorHistory = []
    this.maxHistorySize = 100
    
    // 行为模式
    this.patterns = {
      scrollDown: 0,      // 向下滚动频率
      scrollUp: 0,        // 向上滚动频率
      fastScroll: 0,      // 快速滚动频率
      slowScroll: 0,      // 慢速滚动频率
      jumpToLine: 0,      // 跳转行频率
      search: 0,          // 搜索频率
      edit: 0             // 编辑频率
    }
    
    // 预测状态
    this.predictions = {
      nextScrollDirection: 'down',
      nextScrollSpeed: 'normal',
      likelyAction: 'scroll'
    }
    
    // 预渲染缓存
    this.preRenderedContent = new Map()
    this.maxCacheSize = 10
    
    // 回调
    this.onPredict = options.onPredict
    
    // 统计
    this.stats = {
      predictions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0
    }
  }
  
  /**
   * 记录用户行为
   * @param {string} action - 行为类型
   * @param {Object} data - 行为数据
   */
  recordBehavior(action, data = {}) {
    if (!this.enablePrediction) return
    
    const behavior = {
      action,
      data,
      timestamp: Date.now()
    }
    
    this.behaviorHistory.push(behavior)
    
    // 限制历史大小
    if (this.behaviorHistory.length > this.maxHistorySize) {
      this.behaviorHistory.shift()
    }
    
    // 更新模式
    this.updatePatterns(action, data)
    
    // 生成预测
    this.generatePrediction()
  }
  
  /**
   * 更新行为模式
   */
  updatePatterns(action, data) {
    // 使用指数移动平均更新模式
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
  generatePrediction() {
    // 预测滚动方向
    if (this.patterns.scrollDown > this.patterns.scrollUp) {
      this.predictions.nextScrollDirection = 'down'
    } else {
      this.predictions.nextScrollDirection = 'up'
    }
    
    // 预测滚动速度
    if (this.patterns.fastScroll > this.patterns.slowScroll) {
      this.predictions.nextScrollSpeed = 'fast'
    } else {
      this.predictions.nextScrollSpeed = 'slow'
    }
    
    // 预测下一个动作
    const actionScores = {
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
    
    // 触发预测回调
    if (this.onPredict) {
      this.onPredict(this.predictions)
    }
  }
  
  /**
   * 获取预测结果
   */
  getPrediction() {
    return { ...this.predictions }
  }
  
  /**
   * 验证预测准确性
   * @param {string} actualAction - 实际发生的动作
   * @returns {boolean} 预测是否正确
   */
  validatePrediction(actualAction) {
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
   * @param {string} key - 缓存键
   * @param {Function} renderFn - 渲染函数
   */
  async preRender(key, renderFn) {
    if (!this.enablePrediction) return
    
    // 检查缓存
    if (this.preRenderedContent.has(key)) {
      return this.preRenderedContent.get(key)
    }
    
    try {
      // 执行预渲染
      const content = await renderFn()
      
      // 存入缓存
      if (this.preRenderedContent.size >= this.maxCacheSize) {
        const firstKey = this.preRenderedContent.keys().next().value
        this.preRenderedContent.delete(firstKey)
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
   * @param {string} key - 缓存键
   */
  getPreRendered(key) {
    return this.preRenderedContent.get(key)
  }
  
  /**
   * 分析用户行为模式
   */
  analyzePatterns() {
    const recentBehaviors = this.behaviorHistory.slice(-20)
    
    const analysis = {
      dominantAction: null,
      frequency: {},
      averageSpeed: 0,
      consistency: 0
    }
    
    // 统计频率
    recentBehaviors.forEach(b => {
      analysis.frequency[b.action] = (analysis.frequency[b.action] || 0) + 1
    })
    
    // 找出主导动作
    let maxFreq = 0
    for (const [action, freq] of Object.entries(analysis.frequency)) {
      if (freq > maxFreq) {
        maxFreq = freq
        analysis.dominantAction = action
      }
    }
    
    // 计算一致性（主导动作占比）
    analysis.consistency = recentBehaviors.length > 0 
      ? maxFreq / recentBehaviors.length 
      : 0
    
    return analysis
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.correctPredictions + this.stats.incorrectPredictions
    const accuracy = total > 0 
      ? (this.stats.correctPredictions / total * 100).toFixed(1)
      : 0
    
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
  clear() {
    this.preRenderedContent.clear()
  }
  
  /**
   * 重置学习
   */
  reset() {
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
  destroy() {
    this.clear()
    this.behaviorHistory = []
    this.onPredict = null
  }
}
