/**
 * Markdown Lexer Worker
 * 在后台线程解析 Markdown 语法
 * 
 * 功能：
 * - 单行解析
 * - 批量解析
 * - 增量解析
 * - 解析缓存
 * - 性能统计
 */

// Worker 环境类型声明
const ctx: Worker = self as unknown as Worker

// ============ 类型定义 ============

type TokenType = 
  | 'text'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'bold_italic'
  | 'strikethrough'
  | 'code'
  | 'code_block'
  | 'code_block_start'
  | 'code_block_end'
  | 'link'
  | 'image'
  | 'list'
  | 'list_ordered'
  | 'checkbox'
  | 'checkbox_checked'
  | 'quote'
  | 'hr'
  | 'table'
  | 'table_separator'
  | 'math_inline'
  | 'math_block'
  | 'html_tag'
  | 'footnote'
  | 'highlight'

interface Token {
  type: TokenType | string
  start: number
  end: number
  text: string
  level?: number
  language?: string
  url?: string
  title?: string
  checked?: boolean
}

interface ParserContext {
  inCodeBlock: boolean
  codeBlockLanguage?: string
  inMathBlock: boolean
  inTable: boolean
}

interface WorkerMessage {
  type: string
  id?: number
  data?: any
  priority?: 'high' | 'normal' | 'low'
}

interface ParseResult {
  lineIndex: number
  tokens: Token[]
  context?: ParserContext
}

interface WorkerStats {
  parseCount: number
  cacheHits: number
  cacheMisses: number
  cacheSize: number
  avgParseTime: number
  totalParseTime: number
}

// ============ 缓存和统计 ============

const cache = new Map<string, Token[]>()
const MAX_CACHE_SIZE = 1000

const stats: WorkerStats = {
  parseCount: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheSize: 0,
  avgParseTime: 0,
  totalParseTime: 0
}

// ============ 解析正则表达式 ============

const PATTERNS = {
  // 块级元素
  heading: /^(#{1,6})\s+(.+)$/,
  codeBlockStart: /^(`{3,}|~{3,})(\w*)?$/,
  codeBlockEnd: /^(`{3,}|~{3,})$/,
  quote: /^(\s*>+)\s?(.*)$/,
  hr: /^[-*_]{3,}\s*$/,
  listUnordered: /^(\s*)([-*+])\s+(.*)$/,
  listOrdered: /^(\s*)(\d+\.)\s+(.*)$/,
  checkbox: /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/,
  table: /^\|(.+)\|$/,
  tableSeparator: /^\|[\s:-]+\|$/,
  mathBlockDelimiter: /^\$\$\s*$/,
  
  // 行内元素
  boldItalic: /\*\*\*(.+?)\*\*\*|___(.+?)___/g,
  bold: /\*\*(.+?)\*\*|__(.+?)__/g,
  italic: /\*([^*]+?)\*|_([^_]+?)_/g,
  strikethrough: /~~(.+?)~~/g,
  inlineCode: /`([^`]+)`/g,
  mathInline: /\$([^$]+)\$/g,
  link: /\[([^\]]+)\]\(([^)]+)\)/g,
  image: /!\[([^\]]*)\]\(([^)]+)\)/g,
  highlight: /==(.+?)==/g,
  htmlTag: /<(\/?[a-zA-Z][a-zA-Z0-9]*)[^>]*>/g,
  footnote: /\[\^([^\]]+)\]/g
}

// ============ 解析函数 ============

/**
 * 创建初始上下文
 */
function createContext(): ParserContext {
  return {
    inCodeBlock: false,
    codeBlockLanguage: undefined,
    inMathBlock: false,
    inTable: false
  }
}

/**
 * 解析单行 Markdown
 */
function parseLine(text: string, lineIndex: number, context: ParserContext): { tokens: Token[]; contextUpdate: Partial<ParserContext> } {
  const tokens: Token[] = []
  const contextUpdate: Partial<ParserContext> = {}
  
  if (!text) {
    return { tokens, contextUpdate }
  }
  
  const trimmed = text.trimStart()
  const indent = text.length - trimmed.length
  
  // 代码块处理
  if (context.inCodeBlock) {
    if (PATTERNS.codeBlockEnd.test(trimmed)) {
      tokens.push({
        type: 'code_block_end',
        text,
        start: 0,
        end: text.length
      })
      contextUpdate.inCodeBlock = false
      contextUpdate.codeBlockLanguage = undefined
    } else {
      tokens.push({
        type: 'code',
        text,
        start: 0,
        end: text.length,
        language: context.codeBlockLanguage
      })
    }
    return { tokens, contextUpdate }
  }
  
  // 数学块处理
  if (context.inMathBlock) {
    if (PATTERNS.mathBlockDelimiter.test(trimmed)) {
      tokens.push({
        type: 'math_block',
        text,
        start: 0,
        end: text.length
      })
      contextUpdate.inMathBlock = false
    } else {
      tokens.push({
        type: 'math_block',
        text,
        start: 0,
        end: text.length
      })
    }
    return { tokens, contextUpdate }
  }
  
  // 代码块开始
  const codeBlockMatch = trimmed.match(PATTERNS.codeBlockStart)
  if (codeBlockMatch) {
    tokens.push({
      type: 'code_block_start',
      text,
      start: 0,
      end: text.length,
      language: codeBlockMatch[2] || undefined
    })
    contextUpdate.inCodeBlock = true
    contextUpdate.codeBlockLanguage = codeBlockMatch[2] || undefined
    return { tokens, contextUpdate }
  }
  
  // 数学块开始
  if (PATTERNS.mathBlockDelimiter.test(trimmed)) {
    tokens.push({
      type: 'math_block',
      text,
      start: 0,
      end: text.length
    })
    contextUpdate.inMathBlock = true
    return { tokens, contextUpdate }
  }
  
  // 标题
  const headingMatch = text.match(PATTERNS.heading)
  if (headingMatch) {
    tokens.push({
      type: 'heading',
      text,
      start: 0,
      end: text.length,
      level: headingMatch[1].length
    })
    return { tokens, contextUpdate }
  }
  
  // 分隔线
  if (PATTERNS.hr.test(trimmed)) {
    tokens.push({
      type: 'hr',
      text,
      start: 0,
      end: text.length
    })
    return { tokens, contextUpdate }
  }
  
  // 表格分隔行
  if (PATTERNS.tableSeparator.test(trimmed)) {
    tokens.push({
      type: 'table_separator',
      text,
      start: 0,
      end: text.length
    })
    contextUpdate.inTable = true
    return { tokens, contextUpdate }
  }
  
  // 表格行
  if (PATTERNS.table.test(trimmed)) {
    tokens.push({
      type: 'table',
      text,
      start: 0,
      end: text.length
    })
    return { tokens, contextUpdate }
  }
  
  // 引用
  const quoteMatch = text.match(PATTERNS.quote)
  if (quoteMatch) {
    tokens.push({
      type: 'quote',
      text,
      start: 0,
      end: text.length
    })
    return { tokens, contextUpdate }
  }
  
  // 任务列表（checkbox）
  const checkboxMatch = text.match(PATTERNS.checkbox)
  if (checkboxMatch) {
    const checked = checkboxMatch[3].toLowerCase() === 'x'
    tokens.push({
      type: checked ? 'checkbox_checked' : 'checkbox',
      text,
      start: 0,
      end: text.length,
      checked
    })
    return { tokens, contextUpdate }
  }
  
  // 无序列表
  const ulMatch = text.match(PATTERNS.listUnordered)
  if (ulMatch) {
    tokens.push({
      type: 'list',
      text,
      start: 0,
      end: text.length
    })
    return { tokens, contextUpdate }
  }
  
  // 有序列表
  const olMatch = text.match(PATTERNS.listOrdered)
  if (olMatch) {
    tokens.push({
      type: 'list_ordered',
      text,
      start: 0,
      end: text.length
    })
    return { tokens, contextUpdate }
  }
  
  // 如果不是表格行，重置表格状态
  if (context.inTable && !PATTERNS.table.test(trimmed)) {
    contextUpdate.inTable = false
  }
  
  // 解析行内元素
  parseInlineTokens(text, tokens)
  
  // 如果没有找到任何 token，添加纯文本
  if (tokens.length === 0) {
    tokens.push({
      type: 'text',
      text,
      start: 0,
      end: text.length
    })
  }
  
  return { tokens, contextUpdate }
}

/**
 * 解析行内元素
 */
function parseInlineTokens(text: string, tokens: Token[]): void {
  const inlineMatches: Array<{ type: TokenType; start: number; end: number; text: string; extra?: any }> = []
  
  // 匹配所有行内元素
  const matchPatterns = [
    { pattern: PATTERNS.boldItalic, type: 'bold_italic' as TokenType },
    { pattern: PATTERNS.bold, type: 'bold' as TokenType },
    { pattern: PATTERNS.italic, type: 'italic' as TokenType },
    { pattern: PATTERNS.strikethrough, type: 'strikethrough' as TokenType },
    { pattern: PATTERNS.inlineCode, type: 'code' as TokenType },
    { pattern: PATTERNS.mathInline, type: 'math_inline' as TokenType },
    { pattern: PATTERNS.image, type: 'image' as TokenType },
    { pattern: PATTERNS.link, type: 'link' as TokenType },
    { pattern: PATTERNS.highlight, type: 'highlight' as TokenType },
    { pattern: PATTERNS.footnote, type: 'footnote' as TokenType }
  ]
  
  for (const { pattern, type } of matchPatterns) {
    // 重置正则的 lastIndex
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      inlineMatches.push({
        type,
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      })
    }
  }
  
  // 按位置排序
  inlineMatches.sort((a, b) => a.start - b.start)
  
  // 移除重叠的匹配（保留先出现的）
  const filteredMatches: typeof inlineMatches = []
  let lastEnd = 0
  for (const match of inlineMatches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match)
      lastEnd = match.end
    }
  }
  
  // 生成 tokens，包括未匹配的文本部分
  let pos = 0
  for (const match of filteredMatches) {
    // 添加匹配前的文本
    if (match.start > pos) {
      tokens.push({
        type: 'text',
        text: text.substring(pos, match.start),
        start: pos,
        end: match.start
      })
    }
    
    // 添加匹配的 token
    tokens.push({
      type: match.type,
      text: match.text,
      start: match.start,
      end: match.end
    })
    
    pos = match.end
  }
  
  // 添加剩余文本
  if (pos < text.length && filteredMatches.length > 0) {
    tokens.push({
      type: 'text',
      text: text.substring(pos),
      start: pos,
      end: text.length
    })
  }
}

/**
 * 解析多行（批量）
 */
function parseLines(
  lines: Array<{ text: string; lineIndex: number }>,
  initialContext?: ParserContext
): ParseResult[] {
  const results: ParseResult[] = []
  let context = initialContext || createContext()
  
  for (const { text, lineIndex } of lines) {
    const cacheKey = getCacheKey(text, lineIndex, context)
    
    // 检查缓存
    if (cache.has(cacheKey)) {
      stats.cacheHits++
      results.push({
        lineIndex,
        tokens: cache.get(cacheKey)!,
        context: { ...context }
      })
      continue
    }
    
    stats.cacheMisses++
    const startTime = performance.now()
    
    const { tokens, contextUpdate } = parseLine(text, lineIndex, context)
    
    // 更新统计
    const parseTime = performance.now() - startTime
    stats.parseCount++
    stats.totalParseTime += parseTime
    stats.avgParseTime = stats.totalParseTime / stats.parseCount
    
    // 更新上下文
    context = { ...context, ...contextUpdate }
    
    // 添加到缓存
    addToCache(cacheKey, tokens)
    
    results.push({
      lineIndex,
      tokens,
      context: { ...context }
    })
  }
  
  return results
}

/**
 * 解析完整文档
 */
function parseDocument(lines: string[]): ParseResult[] {
  const lineData = lines.map((text, index) => ({ text, lineIndex: index }))
  return parseLines(lineData)
}

/**
 * 增量解析
 */
function parseIncremental(
  changes: Array<{ lineIndex: number; text: string; action: 'insert' | 'update' | 'delete' }>,
  existingContext?: ParserContext
): ParseResult[] {
  const results: ParseResult[] = []
  let context = existingContext || createContext()
  
  for (const change of changes) {
    if (change.action === 'delete') {
      // 删除行不需要解析，但可能影响上下文
      invalidateCacheForLine(change.lineIndex)
      continue
    }
    
    const { tokens, contextUpdate } = parseLine(change.text, change.lineIndex, context)
    context = { ...context, ...contextUpdate }
    
    results.push({
      lineIndex: change.lineIndex,
      tokens,
      context: { ...context }
    })
    
    // 更新缓存
    const cacheKey = getCacheKey(change.text, change.lineIndex, context)
    addToCache(cacheKey, tokens)
  }
  
  return results
}

// ============ 缓存管理 ============

function getCacheKey(text: string, lineIndex: number, context: ParserContext): string {
  return `${lineIndex}:${context.inCodeBlock ? '1' : '0'}:${context.inMathBlock ? '1' : '0'}:${text}`
}

function addToCache(key: string, tokens: Token[]): void {
  // LRU 淘汰
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      cache.delete(firstKey)
    }
  }
  
  cache.set(key, tokens)
  stats.cacheSize = cache.size
}

function invalidateCacheForLine(lineIndex: number): void {
  const keysToDelete: string[] = []
  for (const key of cache.keys()) {
    if (key.startsWith(`${lineIndex}:`)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => cache.delete(key))
  stats.cacheSize = cache.size
}

function clearCache(): void {
  cache.clear()
  stats.cacheSize = 0
  stats.cacheHits = 0
  stats.cacheMisses = 0
}

function getStats(): WorkerStats {
  return { ...stats }
}

// ============ Worker 消息处理 ============

ctx.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { type, id, data } = e.data
  
  try {
    switch (type) {
      case 'parseLine': {
        const { text, lineIndex, context } = data
        const result = parseLine(text, lineIndex, context || createContext())
        ctx.postMessage({
          type: 'result',
          id,
          data: {
            lineIndex,
            tokens: result.tokens,
            context: result.contextUpdate
          }
        })
        break
      }
      
      case 'parseLines': {
        const { lines, context } = data
        const results = parseLines(lines, context)
        ctx.postMessage({
          type: 'result',
          id,
          data: { results }
        })
        break
      }
      
      case 'parseDocument': {
        const { lines } = data
        const results = parseDocument(lines)
        ctx.postMessage({
          type: 'result',
          id,
          data: { results }
        })
        break
      }
      
      case 'parseIncremental': {
        const { changes, context } = data
        const results = parseIncremental(changes, context)
        ctx.postMessage({
          type: 'result',
          id,
          data: { results }
        })
        break
      }
      
      case 'clearCache': {
        clearCache()
        ctx.postMessage({
          type: 'result',
          id,
          data: { success: true }
        })
        break
      }
      
      case 'getStats': {
        ctx.postMessage({
          type: 'result',
          id,
          data: { stats: getStats() }
        })
        break
      }
      
      default:
        console.warn('Unknown worker message type:', type)
    }
  } catch (error) {
    ctx.postMessage({
      type: 'error',
      id,
      data: { 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    })
  }
}

// Worker 就绪通知
ctx.postMessage({ type: 'ready' })
