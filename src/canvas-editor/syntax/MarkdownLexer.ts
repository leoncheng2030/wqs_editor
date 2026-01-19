/**
 * MarkdownLexer - Markdown 词法分析器
 * 将文本解析为 tokens 用于语法高亮
 */

import type { Token, ParserContext } from '../types'

interface CacheStats {
  hits: number
  misses: number
}

interface ParseResult {
  nextPos: number
  nestedText?: string
  nestedStart?: number
}

const TOKEN_TYPES = {
  TEXT: 'text',
  HEADING1: 'heading1',
  HEADING2: 'heading2',
  HEADING3: 'heading3',
  HEADING4: 'heading4',
  HEADING5: 'heading5',
  HEADING6: 'heading6',
  BOLD_DELIMITER: 'bold_delimiter',
  BOLD_TEXT: 'bold_text',
  ITALIC_DELIMITER: 'italic_delimiter',
  ITALIC_TEXT: 'italic_text',
  CODE_DELIMITER: 'code_delimiter',
  CODE_TEXT: 'code_text',
  CODE_BLOCK_DELIMITER: 'code_block_delimiter',
  CODE_BLOCK_LANG: 'code_block_lang',
  CODE_BLOCK_TEXT: 'code_block_text',
  LINK_BRACKET: 'link_bracket',
  LINK_TEXT: 'link_text',
  LINK_PAREN: 'link_paren',
  LINK_URL: 'link_url',
  IMAGE_BANG: 'image_bang',
  IMAGE_BRACKET: 'image_bracket',
  IMAGE_ALT: 'image_alt',
  IMAGE_PAREN: 'image_paren',
  IMAGE_URL: 'image_url',
  LIST_MARKER: 'list_marker',
  QUOTE_MARKER: 'quote_marker',
  STRIKETHROUGH_DELIMITER: 'strikethrough_delimiter',
  STRIKETHROUGH_TEXT: 'strikethrough_text',
  HR: 'hr',
  TABLE_DELIMITER: 'table_delimiter',
  TABLE_HEADER: 'table_header',
  TABLE_ALIGN: 'table_align',
  TABLE_CELL: 'table_cell',
  TASK_BRACKET: 'task_bracket',
  TASK_CHECKBOX: 'task_checkbox',
  TASK_TEXT: 'task_text',
  FOOTNOTE_MARKER: 'footnote_marker',
  FOOTNOTE_REF: 'footnote_ref',
  FOOTNOTE_DEF: 'footnote_def',
  MATH_DELIMITER: 'math_delimiter',
  MATH_CONTENT: 'math_content'
} as const

export class MarkdownLexer {
  public TOKEN_TYPES = TOKEN_TYPES
  
  private cache: Map<string, Token[]>
  private dirtyLines: Set<number>
  private cacheStats: CacheStats
  private maxCacheSize: number

  constructor() {
    this.cache = new Map()
    this.dirtyLines = new Set()
    this.cacheStats = {
      hits: 0,
      misses: 0
    }
    this.maxCacheSize = 2000 // 限制缓存大小
  }
  
  /**
   * 生成稳定的缓存键
   * 使用哈希算法处理长文本，确保context序列化稳定
   */
  private getCacheKey(text: string, lineIndex: number, context: ParserContext): string {
    // 对于短文本直接使用，长文本使用哈希
    const textKey = text.length > 100 ? this.simpleHash(text) : text
    // 使用稳定的context表示（按键排序）
    const contextKey = context.inCodeBlock ? '1' : '0'
    return `${lineIndex}:${contextKey}:${textKey}`
  }
  
  /**
   * 简单的字符串哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }
  
  /**
   * LRU缓存淘汰
   */
  private evictCache(): void {
    if (this.cache.size <= this.maxCacheSize) return
    
    // 删除最早的条目（Map保持插入顺序）
    const keysToDelete: string[] = []
    let count = 0
    const targetDelete = Math.floor(this.maxCacheSize * 0.2) // 删除20%
    
    for (const key of this.cache.keys()) {
      if (count >= targetDelete) break
      keysToDelete.push(key)
      count++
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }
  
  /**
   * 解析单行文本
   */
  parseLine(text: string, lineIndex: number = 0, context: ParserContext = {}): Token[] {
    const cacheKey = this.getCacheKey(text, lineIndex, context)
    
    if (!this.dirtyLines.has(lineIndex) && this.cache.has(cacheKey)) {
      this.cacheStats.hits++
      // 移动到Map末尾（LRU）
      const cached = this.cache.get(cacheKey)!
      this.cache.delete(cacheKey)
      this.cache.set(cacheKey, cached)
      return cached
    }
    
    this.cacheStats.misses++
    
    const tokens: Token[] = []
    
    if (!text || text.trim().length === 0) {
      this.cache.set(cacheKey, tokens)
      this.evictCache()
      return tokens
    }
    
    if (context.inCodeBlock) {
      tokens.push({
        type: TOKEN_TYPES.CODE_BLOCK_TEXT,
        start: 0,
        end: text.length,
        text: text
      })
      this.cache.set(cacheKey, tokens)
      this.evictCache()
      return tokens
      return tokens
    }
    
    if (text.trimStart().startsWith('```')) {
      const match = text.match(/^(\s*)(```)(.*)?$/)
      if (match) {
        let pos = 0
        
        if (match[1]) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            start: pos,
            end: pos + match[1].length,
            text: match[1]
          })
          pos += match[1].length
        }
        
        tokens.push({
          type: TOKEN_TYPES.CODE_BLOCK_DELIMITER,
          start: pos,
          end: pos + 3,
          text: '```'
        })
        pos += 3
        
        if (match[3]) {
          tokens.push({
            type: TOKEN_TYPES.CODE_BLOCK_LANG,
            start: pos,
            end: text.length,
            text: match[3]
          })
        }
        
        this.cache.set(cacheKey, tokens)
        this.evictCache()
        return tokens
      }
    }
    
    this.parseInlineSyntax(text, tokens)
    
    this.cache.set(cacheKey, tokens)
    this.evictCache()
    return tokens
  }
  
  /**
   * 解析行内语法
   */
  private parseInlineSyntax(text: string, tokens: Token[]): void {
    const footnoteDefMatch = text.match(/^\[\^(\w+)\]:\s+(.*)$/)
    if (footnoteDefMatch) {
      tokens.push({
        type: TOKEN_TYPES.FOOTNOTE_MARKER,
        start: 0,
        end: 2,
        text: '[^'
      })
      
      tokens.push({
        type: TOKEN_TYPES.FOOTNOTE_REF,
        start: 2,
        end: 2 + footnoteDefMatch[1].length,
        text: footnoteDefMatch[1]
      })
      
      const colonPos = text.indexOf(']:')
      tokens.push({
        type: TOKEN_TYPES.FOOTNOTE_MARKER,
        start: 2 + footnoteDefMatch[1].length,
        end: colonPos + 2,
        text: ']:'
      })
      
      const contentPos = text.indexOf(footnoteDefMatch[2], colonPos + 2)
      if (contentPos > colonPos + 2) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: colonPos + 2,
          end: contentPos,
          text: text.substring(colonPos + 2, contentPos)
        })
      }
      
      tokens.push({
        type: TOKEN_TYPES.FOOTNOTE_DEF,
        start: contentPos,
        end: text.length,
        text: footnoteDefMatch[2]
      })
      return
    }
    
    if (text.trimStart().startsWith('|')) {
      this.parseTableRow(text, tokens)
      return
    }
    
    const headingMatch = text.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingType = `heading${level}` as keyof typeof TOKEN_TYPES
      
      tokens.push({
        type: TOKEN_TYPES[headingType.toUpperCase() as keyof typeof TOKEN_TYPES] || TOKEN_TYPES.TEXT,
        start: 0,
        end: headingMatch[1].length,
        text: headingMatch[1]
      })
      
      const spaceLen = text.indexOf(headingMatch[2])
      if (spaceLen > headingMatch[1].length) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: headingMatch[1].length,
          end: spaceLen,
          text: text.substring(headingMatch[1].length, spaceLen)
        })
      }
      
      this.parseInlineStyles(headingMatch[2], tokens, spaceLen)
      return
    }
    
    const taskMatch = text.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      this.parseTaskList(text, taskMatch, tokens)
      return
    }
    
    const listMatch = text.match(/^(\s*)([-*+])\s+(.*)$/)
    if (listMatch) {
      let currentPos = 0
      
      if (listMatch[1]) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: currentPos,
          end: currentPos + listMatch[1].length,
          text: listMatch[1]
        })
        currentPos += listMatch[1].length
      }
      
      tokens.push({
        type: TOKEN_TYPES.LIST_MARKER,
        start: currentPos,
        end: currentPos + 1,
        text: listMatch[2]
      })
      currentPos += 1
      
      const spaceLen = text.indexOf(listMatch[3])
      if (spaceLen > currentPos) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: currentPos,
          end: spaceLen,
          text: text.substring(currentPos, spaceLen)
        })
        currentPos = spaceLen
      }
      
      this.parseInlineStyles(listMatch[3], tokens, currentPos)
      return
    }
    
    const quoteMatch = text.match(/^(\s*)(>+)\s+(.*)$/)
    if (quoteMatch) {
      let currentPos = 0
      
      if (quoteMatch[1]) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: currentPos,
          end: currentPos + quoteMatch[1].length,
          text: quoteMatch[1]
        })
        currentPos += quoteMatch[1].length
      }
      
      tokens.push({
        type: TOKEN_TYPES.QUOTE_MARKER,
        start: currentPos,
        end: currentPos + quoteMatch[2].length,
        text: quoteMatch[2]
      })
      currentPos += quoteMatch[2].length
      
      const spaceLen = text.indexOf(quoteMatch[3])
      if (spaceLen > currentPos) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: currentPos,
          end: spaceLen,
          text: text.substring(currentPos, spaceLen)
        })
        currentPos = spaceLen
      }
      
      this.parseInlineStyles(quoteMatch[3], tokens, currentPos)
      return
    }
    
    if (/^(\s*)([-*_])\2{2,}\s*$/.test(text)) {
      tokens.push({
        type: TOKEN_TYPES.HR,
        start: 0,
        end: text.length,
        text: text
      })
      return
    }
    
    this.parseInlineStyles(text, tokens, 0)
  }
  
  /**
   * 解析行内样式（粗体、斜体、代码等）
   */
  private parseInlineStyles(text: string, tokens: Token[], offset: number = 0): void {
    let pos = 0
    
    while (pos < text.length) {
      if (text[pos] === '\\' && pos + 1 < text.length) {
        const escapedChar = text[pos + 1]
        
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: offset + pos,
          end: offset + pos + 2,
          text: escapedChar,
          escaped: true
        })
        
        pos += 2
        continue
      }
      
      const nextSpecial = this.findNextSpecialChar(text, pos)
      
      if (nextSpecial === -1) {
        if (pos < text.length) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            start: offset + pos,
            end: offset + text.length,
            text: text.substring(pos)
          })
        }
        break
      }
      
      if (nextSpecial > pos) {
        tokens.push({
          type: TOKEN_TYPES.TEXT,
          start: offset + pos,
          end: offset + nextSpecial,
          text: text.substring(pos, nextSpecial)
        })
      }
      
      const result = this.parseSpecialChar(text, nextSpecial, tokens, offset)
      
      if (result.nestedText && result.nestedStart !== undefined) {
        this.parseInlineStyles(result.nestedText, tokens, offset + result.nestedStart)
      }
      
      pos = result.nextPos
    }
  }
  
  /**
   * 解析表格行
   */
  private parseTableRow(text: string, tokens: Token[]): void {
    let inCell = false
    let cellStart = 0
    
    const alignMatch = text.match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/)
    const isAlignRow = !!alignMatch
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      
      if (char === '|') {
        if (inCell) {
          const cellContent = text.substring(cellStart, i)
          const trimmed = cellContent.trim()
          
          if (trimmed.length > 0) {
            const leadingSpaces = cellContent.length - cellContent.trimStart().length
            const trailingSpaces = cellContent.length - cellContent.trimEnd().length
            
            const cellType = isAlignRow ? TOKEN_TYPES.TABLE_ALIGN : TOKEN_TYPES.TABLE_CELL
            
            if (leadingSpaces > 0) {
              tokens.push({
                type: TOKEN_TYPES.TEXT,
                start: cellStart,
                end: cellStart + leadingSpaces,
                text: cellContent.substring(0, leadingSpaces)
              })
            }
            
            tokens.push({
              type: cellType,
              start: cellStart + leadingSpaces,
              end: i - trailingSpaces,
              text: trimmed
            })
            
            if (trailingSpaces > 0) {
              tokens.push({
                type: TOKEN_TYPES.TEXT,
                start: i - trailingSpaces,
                end: i,
                text: cellContent.substring(cellContent.length - trailingSpaces)
              })
            }
          }
          inCell = false
        }
        
        tokens.push({
          type: TOKEN_TYPES.TABLE_DELIMITER,
          start: i,
          end: i + 1,
          text: '|'
        })
        
        cellStart = i + 1
        inCell = true
      }
    }
    
    if (inCell && cellStart < text.length) {
      const cellContent = text.substring(cellStart)
      const trimmed = cellContent.trim()
      
      if (trimmed.length > 0) {
        const leadingSpaces = cellContent.length - cellContent.trimStart().length
        const trailingSpaces = cellContent.length - cellContent.trimEnd().length
        
        const cellType = isAlignRow ? TOKEN_TYPES.TABLE_ALIGN : TOKEN_TYPES.TABLE_CELL
        
        if (leadingSpaces > 0) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            start: cellStart,
            end: cellStart + leadingSpaces,
            text: cellContent.substring(0, leadingSpaces)
          })
        }
        
        tokens.push({
          type: cellType,
          start: cellStart + leadingSpaces,
          end: text.length - trailingSpaces,
          text: trimmed
        })
        
        if (trailingSpaces > 0) {
          tokens.push({
            type: TOKEN_TYPES.TEXT,
            start: text.length - trailingSpaces,
            end: text.length,
            text: cellContent.substring(cellContent.length - trailingSpaces)
          })
        }
      }
    }
  }
  
  /**
   * 解析任务列表
   */
  private parseTaskList(text: string, match: RegExpMatchArray, tokens: Token[]): void {
    let currentPos = 0
    
    if (match[1]) {
      tokens.push({
        type: TOKEN_TYPES.TEXT,
        start: currentPos,
        end: currentPos + match[1].length,
        text: match[1]
      })
      currentPos += match[1].length
    }
    
    tokens.push({
      type: TOKEN_TYPES.LIST_MARKER,
      start: currentPos,
      end: currentPos + 1,
      text: match[2]
    })
    currentPos += 1
    
    const bracketPos = text.indexOf('[', currentPos)
    if (bracketPos > currentPos) {
      tokens.push({
        type: TOKEN_TYPES.TEXT,
        start: currentPos,
        end: bracketPos,
        text: text.substring(currentPos, bracketPos)
      })
      currentPos = bracketPos
    }
    
    tokens.push({
      type: TOKEN_TYPES.TASK_BRACKET,
      start: currentPos,
      end: currentPos + 1,
      text: '['
    })
    currentPos += 1
    
    const checked = match[3].toLowerCase() === 'x'
    tokens.push({
      type: TOKEN_TYPES.TASK_CHECKBOX,
      start: currentPos,
      end: currentPos + 1,
      text: match[3],
      checked: checked
    })
    currentPos += 1
    
    tokens.push({
      type: TOKEN_TYPES.TASK_BRACKET,
      start: currentPos,
      end: currentPos + 1,
      text: ']'
    })
    currentPos += 1
    
    const textPos = text.indexOf(match[4], currentPos)
    if (textPos > currentPos) {
      tokens.push({
        type: TOKEN_TYPES.TEXT,
        start: currentPos,
        end: textPos,
        text: text.substring(currentPos, textPos)
      })
      currentPos = textPos
    }
    
    this.parseInlineStyles(match[4], tokens, currentPos)
  }
  
  /**
   * 查找下一个特殊字符位置
   */
  private findNextSpecialChar(text: string, start: number): number {
    const specialChars = ['*', '_', '`', '[', '!', '~', '$']
    
    for (let i = start; i < text.length; i++) {
      const char = text[i]
      
      if (char === '\\' && i + 1 < text.length) {
        i++
        continue
      }
      
      if (specialChars.includes(char)) {
        return i
      }
    }
    
    return -1
  }
  
  /**
   * 解析特殊字符（粗体、斜体等）
   */
  private parseSpecialChar(text: string, pos: number, tokens: Token[], offset: number): ParseResult {
    const char = text[pos]
    
    if (char === '`') {
      const endPos = text.indexOf('`', pos + 1)
      if (endPos !== -1) {
        tokens.push({
          type: TOKEN_TYPES.CODE_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: '`'
        })
        
        if (endPos > pos + 1) {
          tokens.push({
            type: TOKEN_TYPES.CODE_TEXT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        tokens.push({
          type: TOKEN_TYPES.CODE_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: '`'
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    if ((char === '*' && text[pos + 1] === '*') || (char === '_' && text[pos + 1] === '_')) {
      const delimiter = char + char
      const endPos = text.indexOf(delimiter, pos + 2)
      if (endPos !== -1) {
        tokens.push({
          type: TOKEN_TYPES.BOLD_DELIMITER,
          start: offset + pos,
          end: offset + pos + 2,
          text: delimiter
        })
        
        const innerText = text.substring(pos + 2, endPos)
        if (innerText.length > 0) {
          const innerTokens: Token[] = []
          this.parseInlineStyles(innerText, innerTokens, 0)
          
          for (const token of innerTokens) {
            tokens.push({
              ...token,
              start: offset + pos + 2 + token.start,
              end: offset + pos + 2 + token.end,
              type: token.type === TOKEN_TYPES.TEXT ? TOKEN_TYPES.BOLD_TEXT : token.type
            })
          }
        }
        
        tokens.push({
          type: TOKEN_TYPES.BOLD_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 2,
          text: delimiter
        })
        
        return { nextPos: endPos + 2 }
      }
    }
    
    if (char === '*' || char === '_') {
      const endPos = text.indexOf(char, pos + 1)
      if (endPos !== -1) {
        tokens.push({
          type: TOKEN_TYPES.ITALIC_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: char
        })
        
        if (endPos > pos + 1) {
          tokens.push({
            type: TOKEN_TYPES.ITALIC_TEXT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        tokens.push({
          type: TOKEN_TYPES.ITALIC_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: char
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    if (char === '~' && text[pos + 1] === '~') {
      const endPos = text.indexOf('~~', pos + 2)
      if (endPos !== -1) {
        tokens.push({
          type: TOKEN_TYPES.STRIKETHROUGH_DELIMITER,
          start: offset + pos,
          end: offset + pos + 2,
          text: '~~'
        })
        
        if (endPos > pos + 2) {
          tokens.push({
            type: TOKEN_TYPES.STRIKETHROUGH_TEXT,
            start: offset + pos + 2,
            end: offset + endPos,
            text: text.substring(pos + 2, endPos)
          })
        }
        
        tokens.push({
          type: TOKEN_TYPES.STRIKETHROUGH_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 2,
          text: '~~'
        })
        
        return { nextPos: endPos + 2 }
      }
    }
    
    if (char === '[') {
      const footnoteMatch = text.substring(pos).match(/^\[\^(\w+)\]/)
      if (footnoteMatch) {
        tokens.push({
          type: TOKEN_TYPES.FOOTNOTE_MARKER,
          start: offset + pos,
          end: offset + pos + 2,
          text: '[^'
        })
        
        tokens.push({
          type: TOKEN_TYPES.FOOTNOTE_REF,
          start: offset + pos + 2,
          end: offset + pos + 2 + footnoteMatch[1].length,
          text: footnoteMatch[1]
        })
        
        tokens.push({
          type: TOKEN_TYPES.FOOTNOTE_MARKER,
          start: offset + pos + 2 + footnoteMatch[1].length,
          end: offset + pos + footnoteMatch[0].length,
          text: ']'
        })
        
        return { nextPos: pos + footnoteMatch[0].length }
      }
      
      const closePos = text.indexOf(']', pos + 1)
      if (closePos !== -1 && text[closePos + 1] === '(') {
        const urlEndPos = text.indexOf(')', closePos + 2)
        if (urlEndPos !== -1) {
          tokens.push({
            type: TOKEN_TYPES.LINK_BRACKET,
            start: offset + pos,
            end: offset + pos + 1,
            text: '['
          })
          
          const linkText = text.substring(pos + 1, closePos)
          if (linkText.length > 0) {
            const innerTokens: Token[] = []
            this.parseInlineStyles(linkText, innerTokens, 0)
            
            for (const token of innerTokens) {
              tokens.push({
                ...token,
                start: offset + pos + 1 + token.start,
                end: offset + pos + 1 + token.end,
                type: token.type === TOKEN_TYPES.TEXT ? TOKEN_TYPES.LINK_TEXT : token.type
              })
            }
          }
          
          tokens.push({
            type: TOKEN_TYPES.LINK_BRACKET,
            start: offset + closePos,
            end: offset + closePos + 1,
            text: ']'
          })
          
          tokens.push({
            type: TOKEN_TYPES.LINK_PAREN,
            start: offset + closePos + 1,
            end: offset + closePos + 2,
            text: '('
          })
          
          if (urlEndPos > closePos + 2) {
            tokens.push({
              type: TOKEN_TYPES.LINK_URL,
              start: offset + closePos + 2,
              end: offset + urlEndPos,
              text: text.substring(closePos + 2, urlEndPos)
            })
          }
          
          tokens.push({
            type: TOKEN_TYPES.LINK_PAREN,
            start: offset + urlEndPos,
            end: offset + urlEndPos + 1,
            text: ')'
          })
          
          return { nextPos: urlEndPos + 1 }
        }
      }
    }
    
    if (char === '!' && text[pos + 1] === '[') {
      const closePos = text.indexOf(']', pos + 2)
      if (closePos !== -1 && text[closePos + 1] === '(') {
        const urlEndPos = text.indexOf(')', closePos + 2)
        if (urlEndPos !== -1) {
          tokens.push({
            type: TOKEN_TYPES.IMAGE_BANG,
            start: offset + pos,
            end: offset + pos + 1,
            text: '!'
          })
          
          tokens.push({
            type: TOKEN_TYPES.IMAGE_BRACKET,
            start: offset + pos + 1,
            end: offset + pos + 2,
            text: '['
          })
          
          if (closePos > pos + 2) {
            tokens.push({
              type: TOKEN_TYPES.IMAGE_ALT,
              start: offset + pos + 2,
              end: offset + closePos,
              text: text.substring(pos + 2, closePos)
            })
          }
          
          tokens.push({
            type: TOKEN_TYPES.IMAGE_BRACKET,
            start: offset + closePos,
            end: offset + closePos + 1,
            text: ']'
          })
          
          tokens.push({
            type: TOKEN_TYPES.IMAGE_PAREN,
            start: offset + closePos + 1,
            end: offset + closePos + 2,
            text: '('
          })
          
          if (urlEndPos > closePos + 2) {
            tokens.push({
              type: TOKEN_TYPES.IMAGE_URL,
              start: offset + closePos + 2,
              end: offset + urlEndPos,
              text: text.substring(closePos + 2, urlEndPos)
            })
          }
          
          tokens.push({
            type: TOKEN_TYPES.IMAGE_PAREN,
            start: offset + urlEndPos,
            end: offset + urlEndPos + 1,
            text: ')'
          })
          
          return { nextPos: urlEndPos + 1 }
        }
      }
    }
    
    if (char === '$') {
      const endPos = text.indexOf('$', pos + 1)
      if (endPos !== -1) {
        tokens.push({
          type: TOKEN_TYPES.MATH_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: '$'
        })
        
        if (endPos > pos + 1) {
          tokens.push({
            type: TOKEN_TYPES.MATH_CONTENT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        tokens.push({
          type: TOKEN_TYPES.MATH_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: '$'
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    tokens.push({
      type: TOKEN_TYPES.TEXT,
      start: offset + pos,
      end: offset + pos + 1,
      text: char
    })
    
    return { nextPos: pos + 1 }
  }
  
  /**
   * 标记脏行（需要重新解析）
   */
  markDirty(lineIndex: number): void {
    this.dirtyLines.add(lineIndex)
  }
  
  /**
   * 标记多行为脏
   */
  markDirtyRange(startLine: number, endLine: number): void {
    for (let i = startLine; i <= endLine; i++) {
      this.dirtyLines.add(i)
    }
  }
  
  /**
   * 清除脏行标记
   */
  clearDirtyMarks(): void {
    this.dirtyLines.clear()
  }
  
  /**
   * 清除指定行的缓存
   */
  invalidateLine(lineIndex: number): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${lineIndex}:`)) {
        this.cache.delete(key)
      }
    }
    this.markDirty(lineIndex)
  }
  
  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.dirtyLines.clear()
    this.cacheStats = { hits: 0, misses: 0 }
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats & { total: number; hitRate: string; cacheSize: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : '0'
    return {
      ...this.cacheStats,
      total,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size
    }
  }
  
  /**
   * 解析整个文档
   */
  parseDocument(lines: string[]): Token[][] {
    const result: Token[][] = []
    const context: ParserContext = { inCodeBlock: false }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const tokens = this.parseLine(line, i, context)
      
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
      
      result.push(tokens)
    }
    
    return result
  }
}
