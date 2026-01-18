/**
 * Markdown Lexer Worker
 * 在后台线程解析 Markdown 语法
 */

// Token 类型定义
const TOKEN_TYPES = {
  TEXT: 'text',
  HEADING: 'heading',
  BOLD: 'bold',
  ITALIC: 'italic',
  CODE: 'code',
  CODE_BLOCK: 'code_block',
  LINK: 'link',
  IMAGE: 'image',
  LIST: 'list',
  QUOTE: 'quote',
  HR: 'hr'
}

/**
 * 解析单行 Markdown
 */
function parseLine(text, lineIndex, context = {}) {
  const tokens = []
  
  if (!text || text.length === 0) {
    return tokens
  }
  
  // 代码块检测
  if (text.trimStart().startsWith('```')) {
    tokens.push({
      type: TOKEN_TYPES.CODE_BLOCK,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 在代码块内，不解析其他语法
  if (context.inCodeBlock) {
    tokens.push({
      type: TOKEN_TYPES.CODE,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 标题
  const headingMatch = text.match(/^(#{1,6})\s+(.+)$/)
  if (headingMatch) {
    const level = headingMatch[1].length
    tokens.push({
      type: TOKEN_TYPES.HEADING,
      level,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 引用
  if (text.trimStart().startsWith('>')) {
    tokens.push({
      type: TOKEN_TYPES.QUOTE,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 分隔线
  if (/^[-*_]{3,}$/.test(text.trim())) {
    tokens.push({
      type: TOKEN_TYPES.HR,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 列表
  const listMatch = text.match(/^(\s*)([-*+]|\d+\.)\s+/)
  if (listMatch) {
    tokens.push({
      type: TOKEN_TYPES.LIST,
      text: text,
      start: 0,
      end: text.length
    })
    return tokens
  }
  
  // 行内语法解析（粗体、斜体、代码、链接等）
  let pos = 0
  while (pos < text.length) {
    // 行内代码 `code`
    if (text[pos] === '`') {
      const end = text.indexOf('`', pos + 1)
      if (end !== -1) {
        if (pos > 0) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            text: text.substring(0, pos),
            start: 0,
            end: pos
          })
        }
        tokens.push({
          type: TOKEN_TYPES.CODE,
          text: text.substring(pos, end + 1),
          start: pos,
          end: end + 1
        })
        pos = end + 1
        continue
      }
    }
    
    // 粗体 **bold**
    if (text.substring(pos, pos + 2) === '**') {
      const end = text.indexOf('**', pos + 2)
      if (end !== -1) {
        if (pos > 0) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            text: text.substring(0, pos),
            start: 0,
            end: pos
          })
        }
        tokens.push({
          type: TOKEN_TYPES.BOLD,
          text: text.substring(pos, end + 2),
          start: pos,
          end: end + 2
        })
        pos = end + 2
        continue
      }
    }
    
    // 斜体 *italic*
    if (text[pos] === '*' && text[pos + 1] !== '*') {
      const end = text.indexOf('*', pos + 1)
      if (end !== -1) {
        if (pos > 0) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            text: text.substring(0, pos),
            start: 0,
            end: pos
          })
        }
        tokens.push({
          type: TOKEN_TYPES.ITALIC,
          text: text.substring(pos, end + 1),
          start: pos,
          end: end + 1
        })
        pos = end + 1
        continue
      }
    }
    
    // 链接 [text](url)
    if (text[pos] === '[') {
      const textEnd = text.indexOf(']', pos + 1)
      if (textEnd !== -1 && text[textEnd + 1] === '(') {
        const urlEnd = text.indexOf(')', textEnd + 2)
        if (urlEnd !== -1) {
          if (pos > 0) {
            tokens.push({
              type: TOKEN_TYPES.TEXT,
              text: text.substring(0, pos),
              start: 0,
              end: pos
            })
          }
          tokens.push({
            type: TOKEN_TYPES.LINK,
            text: text.substring(pos, urlEnd + 1),
            start: pos,
            end: urlEnd + 1
          })
          pos = urlEnd + 1
          continue
        }
      }
    }
    
    pos++
  }
  
  // 剩余文本
  if (tokens.length === 0 || tokens[tokens.length - 1].end < text.length) {
    tokens.push({
      type: TOKEN_TYPES.TEXT,
      text: text.substring(tokens.length > 0 ? tokens[tokens.length - 1].end : 0),
      start: tokens.length > 0 ? tokens[tokens.length - 1].end : 0,
      end: text.length
    })
  }
  
  return tokens
}

/**
 * 解析多行文档
 */
function parseDocument(lines) {
  const result = []
  const context = { inCodeBlock: false }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 更新代码块状态
    if (line.trimStart().startsWith('```')) {
      context.inCodeBlock = !context.inCodeBlock
    }
    
    const tokens = parseLine(line, i, context)
    result.push({
      lineIndex: i,
      tokens
    })
  }
  
  return result
}

// Worker 消息处理
self.onmessage = function(e) {
  const { type, data } = e.data
  
  switch (type) {
    case 'parseLine': {
      const { text, lineIndex, context } = data
      const tokens = parseLine(text, lineIndex, context)
      self.postMessage({
        type: 'parseLine',
        data: { lineIndex, tokens }
      })
      break
    }
    
    case 'parseDocument': {
      const { lines } = data
      const result = parseDocument(lines)
      self.postMessage({
        type: 'parseDocument',
        data: { result }
      })
      break
    }
    
    default:
      console.warn('Unknown worker message type:', type)
  }
}

// Worker 就绪通知
self.postMessage({ type: 'ready' })
