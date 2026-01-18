/**
 * MarkdownLexer - Markdown 词法分析器
 * 将文本解析为 tokens 用于语法高亮
 */
export class MarkdownLexer {
  constructor() {
    // Token 类型定义
    this.TOKEN_TYPES = {
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
    }
    
    // 缓存解析结果
    this.cache = new Map()
    
    // 脏行标记（需要重新解析的行）
    this.dirtyLines = new Set()
    
    // 缓存统计（用于性能监控）
    this.cacheStats = {
      hits: 0,
      misses: 0
    }
  }
  
  /**
   * 解析单行文本
   * @param {string} text - 行文本
   * @param {number} lineIndex - 行号
   * @param {Object} context - 上下文（如代码块状态）
   * @returns {Array} tokens 数组
   */
  parseLine(text, lineIndex = 0, context = {}) {
    // 检查缓存（如果不是脏行）
    const cacheKey = `${lineIndex}:${text}:${JSON.stringify(context)}`
    if (!this.dirtyLines.has(lineIndex) && this.cache.has(cacheKey)) {
      this.cacheStats.hits++
      return this.cache.get(cacheKey)
    }
    
    this.cacheStats.misses++
    
    const tokens = []
    
    // 空行
    if (!text || text.trim().length === 0) {
      this.cache.set(cacheKey, tokens)
      return tokens
    }
    
    // 检查是否在代码块内
    if (context.inCodeBlock) {
      tokens.push({
        type: this.TOKEN_TYPES.CODE_BLOCK_TEXT,
        start: 0,
        end: text.length,
        text: text
      })
      this.cache.set(cacheKey, tokens)
      return tokens
    }
    
    // 检查代码块起始/结束
    if (text.trimStart().startsWith('```')) {
      const match = text.match(/^(\s*)(```)(.*)?$/)
      if (match) {
        let pos = 0
        
        // 前导空格
        if (match[1]) {
          tokens.push({
            type: this.TOKEN_TYPES.TEXT,
            start: pos,
            end: pos + match[1].length,
            text: match[1]
          })
          pos += match[1].length
        }
        
        // 代码块标记
        tokens.push({
          type: this.TOKEN_TYPES.CODE_BLOCK_DELIMITER,
          start: pos,
          end: pos + 3,
          text: '```'
        })
        pos += 3
        
        // 语言标识
        if (match[3]) {
          tokens.push({
            type: this.TOKEN_TYPES.CODE_BLOCK_LANG,
            start: pos,
            end: text.length,
            text: match[3]
          })
        }
        
        this.cache.set(cacheKey, tokens)
        return tokens
      }
    }
    
    // 解析行内语法
    this.parseInlineSyntax(text, tokens)
    
    this.cache.set(cacheKey, tokens)
    return tokens
  }
  
  /**
   * 解析行内语法
   * @param {string} text - 文本
   * @param {Array} tokens - tokens 数组
   */
  parseInlineSyntax(text, tokens) {
    let pos = 0
    
    // 检查脚注定义 [^1]: 内容
    const footnoteDefMatch = text.match(/^\[\^(\w+)\]:\s+(.*)$/)
    if (footnoteDefMatch) {
      // [^
      tokens.push({
        type: this.TOKEN_TYPES.FOOTNOTE_MARKER,
        start: 0,
        end: 2,
        text: '[^'
      })
      
      // 脚注 ID
      tokens.push({
        type: this.TOKEN_TYPES.FOOTNOTE_REF,
        start: 2,
        end: 2 + footnoteDefMatch[1].length,
        text: footnoteDefMatch[1]
      })
      
      // ]:
      const colonPos = text.indexOf(']:')
      tokens.push({
        type: this.TOKEN_TYPES.FOOTNOTE_MARKER,
        start: 2 + footnoteDefMatch[1].length,
        end: colonPos + 2,
        text: ']:'
      })
      
      // 空格
      const contentPos = text.indexOf(footnoteDefMatch[2], colonPos + 2)
      if (contentPos > colonPos + 2) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: colonPos + 2,
          end: contentPos,
          text: text.substring(colonPos + 2, contentPos)
        })
      }
      
      // 脚注内容（可能包含行内样式）
      tokens.push({
        type: this.TOKEN_TYPES.FOOTNOTE_DEF,
        start: contentPos,
        end: text.length,
        text: footnoteDefMatch[2]
      })
      return
    }
    
    // 检查表格行
    if (text.trimStart().startsWith('|')) {
      this.parseTableRow(text, tokens)
      return
    }
    
    // 检查标题
    const headingMatch = text.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingType = `heading${level}`
      
      // 标题标记
      tokens.push({
        type: this.TOKEN_TYPES[headingType.toUpperCase()],
        start: 0,
        end: headingMatch[1].length,
        text: headingMatch[1]
      })
      
      // 空格
      const spaceLen = text.indexOf(headingMatch[2])
      if (spaceLen > headingMatch[1].length) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: headingMatch[1].length,
          end: spaceLen,
          text: text.substring(headingMatch[1].length, spaceLen)
        })
      }
      
      // 标题文本（可能包含行内样式）
      this.parseInlineStyles(headingMatch[2], tokens, spaceLen)
      return
    }
    
    // 检查任务列表
    const taskMatch = text.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      this.parseTaskList(text, taskMatch, tokens)
      return
    }
    
    // 检查普通列表
    const listMatch = text.match(/^(\s*)([-*+])\s+(.*)$/)
    if (listMatch) {
      let currentPos = 0
      
      // 前导空格
      if (listMatch[1]) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: currentPos,
          end: currentPos + listMatch[1].length,
          text: listMatch[1]
        })
        currentPos += listMatch[1].length
      }
      
      // 列表标记
      tokens.push({
        type: this.TOKEN_TYPES.LIST_MARKER,
        start: currentPos,
        end: currentPos + 1,
        text: listMatch[2]
      })
      currentPos += 1
      
      // 空格
      const spaceLen = text.indexOf(listMatch[3])
      if (spaceLen > currentPos) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: currentPos,
          end: spaceLen,
          text: text.substring(currentPos, spaceLen)
        })
        currentPos = spaceLen
      }
      
      // 列表内容（可能包含行内样式）
      this.parseInlineStyles(listMatch[3], tokens, currentPos)
      return
    }
    
    // 检查引用
    const quoteMatch = text.match(/^(\s*)(>+)\s+(.*)$/)
    if (quoteMatch) {
      let currentPos = 0
      
      // 前导空格
      if (quoteMatch[1]) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: currentPos,
          end: currentPos + quoteMatch[1].length,
          text: quoteMatch[1]
        })
        currentPos += quoteMatch[1].length
      }
      
      // 引用标记
      tokens.push({
        type: this.TOKEN_TYPES.QUOTE_MARKER,
        start: currentPos,
        end: currentPos + quoteMatch[2].length,
        text: quoteMatch[2]
      })
      currentPos += quoteMatch[2].length
      
      // 空格
      const spaceLen = text.indexOf(quoteMatch[3])
      if (spaceLen > currentPos) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: currentPos,
          end: spaceLen,
          text: text.substring(currentPos, spaceLen)
        })
        currentPos = spaceLen
      }
      
      // 引用内容（可能包含行内样式）
      this.parseInlineStyles(quoteMatch[3], tokens, currentPos)
      return
    }
    
    // 检查水平线
    if (/^(\s*)([-*_])\2{2,}\s*$/.test(text)) {
      tokens.push({
        type: this.TOKEN_TYPES.HR,
        start: 0,
        end: text.length,
        text: text
      })
      return
    }
    
    // 普通文本，解析行内样式
    this.parseInlineStyles(text, tokens, 0)
  }
  
  /**
   * 解析行内样式（粗体、斜体、代码等）
   * @param {string} text - 文本
   * @param {Array} tokens - tokens 数组
   * @param {number} offset - 偏移量
   */
  parseInlineStyles(text, tokens, offset = 0) {
    let pos = 0
    
    while (pos < text.length) {
      // 处理转义字符
      if (text[pos] === '\\' && pos + 1 < text.length) {
        const escapedChar = text[pos + 1]
        
        // 添加转义后的字符作为普通文本
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: offset + pos,
          end: offset + pos + 2,
          text: escapedChar,  // 只显示转义后的字符
          escaped: true  // 标记为转义字符
        })
        
        pos += 2
        continue
      }
      
      // 查找下一个特殊字符
      const nextSpecial = this.findNextSpecialChar(text, pos)
      
      if (nextSpecial === -1) {
        // 没有更多特殊字符，添加剩余文本
        if (pos < text.length) {
          tokens.push({
            type: this.TOKEN_TYPES.TEXT,
            start: offset + pos,
            end: offset + text.length,
            text: text.substring(pos)
          })
        }
        break
      }
      
      // 添加特殊字符前的普通文本
      if (nextSpecial > pos) {
        tokens.push({
          type: this.TOKEN_TYPES.TEXT,
          start: offset + pos,
          end: offset + nextSpecial,
          text: text.substring(pos, nextSpecial)
        })
      }
      
      // 处理特殊字符
      const result = this.parseSpecialChar(text, nextSpecial, tokens, offset)
      
      // 如果有嵌套内容，递归解析
      if (result.nestedText) {
        this.parseInlineStyles(result.nestedText, tokens, offset + result.nestedStart)
      }
      
      pos = result.nextPos
    }
  }
  
  /**
   * 解析表格行
   * @param {string} text - 文本
   * @param {Array} tokens - tokens 数组
   */
  parseTableRow(text, tokens) {
    let pos = 0
    let inCell = false
    let cellStart = 0
    
    // 检查是否是对齐行（如 |:---|---:|:---:| ）
    const alignMatch = text.match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/)
    const isAlignRow = !!alignMatch
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      
      if (char === '|') {
        // 表格分隔符
        if (inCell) {
          // 结束当前单元格
          const cellContent = text.substring(cellStart, i)
          const trimmed = cellContent.trim()
          
          if (trimmed.length > 0) {
            // 计算trim后的实际位置
            const leadingSpaces = cellContent.length - cellContent.trimStart().length
            const trailingSpaces = cellContent.length - cellContent.trimEnd().length
            
            const cellType = isAlignRow ? this.TOKEN_TYPES.TABLE_ALIGN : this.TOKEN_TYPES.TABLE_CELL
            
            // 如果有前导空格，添加空格 token
            if (leadingSpaces > 0) {
              tokens.push({
                type: this.TOKEN_TYPES.TEXT,
                start: cellStart,
                end: cellStart + leadingSpaces,
                text: cellContent.substring(0, leadingSpaces)
              })
            }
            
            // 添加单元格内容 token（使用准确的位置）
            tokens.push({
              type: cellType,
              start: cellStart + leadingSpaces,
              end: i - trailingSpaces,
              text: trimmed
            })
            
            // 如果有尾随空格，添加空格 token
            if (trailingSpaces > 0) {
              tokens.push({
                type: this.TOKEN_TYPES.TEXT,
                start: i - trailingSpaces,
                end: i,
                text: cellContent.substring(cellContent.length - trailingSpaces)
              })
            }
          }
          inCell = false
        }
        
        // 分隔符
        tokens.push({
          type: this.TOKEN_TYPES.TABLE_DELIMITER,
          start: i,
          end: i + 1,
          text: '|'
        })
        
        cellStart = i + 1
        inCell = true
      }
    }
    
    // 处理最后一个单元格（如果没有结尾 | ）
    if (inCell && cellStart < text.length) {
      const cellContent = text.substring(cellStart)
      const trimmed = cellContent.trim()
      
      if (trimmed.length > 0) {
        const leadingSpaces = cellContent.length - cellContent.trimStart().length
        const trailingSpaces = cellContent.length - cellContent.trimEnd().length
        
        const cellType = isAlignRow ? this.TOKEN_TYPES.TABLE_ALIGN : this.TOKEN_TYPES.TABLE_CELL
        
        // 如果有前导空格，添加空格 token
        if (leadingSpaces > 0) {
          tokens.push({
            type: this.TOKEN_TYPES.TEXT,
            start: cellStart,
            end: cellStart + leadingSpaces,
            text: cellContent.substring(0, leadingSpaces)
          })
        }
        
        // 添加单元格内容 token
        tokens.push({
          type: cellType,
          start: cellStart + leadingSpaces,
          end: text.length - trailingSpaces,
          text: trimmed
        })
        
        // 如果有尾随空格，添加空格 token
        if (trailingSpaces > 0) {
          tokens.push({
            type: this.TOKEN_TYPES.TEXT,
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
   * @param {string} text - 文本
   * @param {Array} match - 正则匹配结果
   * @param {Array} tokens - tokens 数组
   */
  parseTaskList(text, match, tokens) {
    let currentPos = 0
    
    // 前导空格
    if (match[1]) {
      tokens.push({
        type: this.TOKEN_TYPES.TEXT,
        start: currentPos,
        end: currentPos + match[1].length,
        text: match[1]
      })
      currentPos += match[1].length
    }
    
    // 列表标记
    tokens.push({
      type: this.TOKEN_TYPES.LIST_MARKER,
      start: currentPos,
      end: currentPos + 1,
      text: match[2]
    })
    currentPos += 1
    
    // 空格
    const bracketPos = text.indexOf('[', currentPos)
    if (bracketPos > currentPos) {
      tokens.push({
        type: this.TOKEN_TYPES.TEXT,
        start: currentPos,
        end: bracketPos,
        text: text.substring(currentPos, bracketPos)
      })
      currentPos = bracketPos
    }
    
    // [
    tokens.push({
      type: this.TOKEN_TYPES.TASK_BRACKET,
      start: currentPos,
      end: currentPos + 1,
      text: '['
    })
    currentPos += 1
    
    // 复选框状态
    const checked = match[3].toLowerCase() === 'x'
    tokens.push({
      type: this.TOKEN_TYPES.TASK_CHECKBOX,
      start: currentPos,
      end: currentPos + 1,
      text: match[3],
      checked: checked
    })
    currentPos += 1
    
    // ]
    tokens.push({
      type: this.TOKEN_TYPES.TASK_BRACKET,
      start: currentPos,
      end: currentPos + 1,
      text: ']'
    })
    currentPos += 1
    
    // 空格
    const textPos = text.indexOf(match[4], currentPos)
    if (textPos > currentPos) {
      tokens.push({
        type: this.TOKEN_TYPES.TEXT,
        start: currentPos,
        end: textPos,
        text: text.substring(currentPos, textPos)
      })
      currentPos = textPos
    }
    
    // 任务文本（可能包含行内样式）
    this.parseInlineStyles(match[4], tokens, currentPos)
  }
  
  /**
   * 查找下一个特殊字符位置
   * @param {string} text - 文本
   * @param {number} start - 起始位置
   * @returns {number} 位置，-1 表示未找到
   */
  findNextSpecialChar(text, start) {
    const specialChars = ['*', '_', '`', '[', '!', '~', '$']
    let minPos = text.length
    
    for (let i = start; i < text.length; i++) {
      const char = text[i]
      
      // 检查转义字符
      if (char === '\\' && i + 1 < text.length) {
        // 跳过转义字符及其后面的字符
        i++
        continue
      }
      
      // 检查是否是特殊字符
      if (specialChars.includes(char)) {
        return i
      }
    }
    
    return -1
  }
  
  /**
   * 解析特殊字符（粗体、斜体等）
   * @param {string} text - 文本
   * @param {number} pos - 当前位置
   * @param {Array} tokens - tokens 数组
   * @param {number} offset - 偏移量
   * @returns {{nextPos: number}} 下一个位置
   */
  parseSpecialChar(text, pos, tokens, offset) {
    const char = text[pos]
    
    // 行内代码 `code`
    if (char === '`') {
      const endPos = text.indexOf('`', pos + 1)
      if (endPos !== -1) {
        // 起始标记
        tokens.push({
          type: this.TOKEN_TYPES.CODE_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: '`'
        })
        
        // 代码内容
        if (endPos > pos + 1) {
          tokens.push({
            type: this.TOKEN_TYPES.CODE_TEXT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        // 结束标记
        tokens.push({
          type: this.TOKEN_TYPES.CODE_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: '`'
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    // 粗体 **text** 或 __text__
    if ((char === '*' && text[pos + 1] === '*') || (char === '_' && text[pos + 1] === '_')) {
      const delimiter = char + char
      const endPos = text.indexOf(delimiter, pos + 2)
      if (endPos !== -1) {
        // 起始标记
        tokens.push({
          type: this.TOKEN_TYPES.BOLD_DELIMITER,
          start: offset + pos,
          end: offset + pos + 2,
          text: delimiter
        })
        
        // 粗体内容（可能包含嵌套的斜体）
        const innerText = text.substring(pos + 2, endPos)
        if (innerText.length > 0) {
          // 递归解析内部内容
          const innerTokens = []
          this.parseInlineStyles(innerText, innerTokens, 0)
          
          // 调整 token 位置并添加
          for (const token of innerTokens) {
            tokens.push({
              ...token,
              start: offset + pos + 2 + token.start,
              end: offset + pos + 2 + token.end,
              // 如果内部是普通文本，标记为粗体文本
              type: token.type === this.TOKEN_TYPES.TEXT ? this.TOKEN_TYPES.BOLD_TEXT : token.type
            })
          }
        }
        
        // 结束标记
        tokens.push({
          type: this.TOKEN_TYPES.BOLD_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 2,
          text: delimiter
        })
        
        return { nextPos: endPos + 2 }
      }
    }
    
    // 斜体 *text* 或 _text_
    if (char === '*' || char === '_') {
      const endPos = text.indexOf(char, pos + 1)
      if (endPos !== -1) {
        // 起始标记
        tokens.push({
          type: this.TOKEN_TYPES.ITALIC_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: char
        })
        
        // 斜体内容
        if (endPos > pos + 1) {
          tokens.push({
            type: this.TOKEN_TYPES.ITALIC_TEXT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        // 结束标记
        tokens.push({
          type: this.TOKEN_TYPES.ITALIC_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: char
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    // 删除线 ~~text~~
    if (char === '~' && text[pos + 1] === '~') {
      const endPos = text.indexOf('~~', pos + 2)
      if (endPos !== -1) {
        // 起始标记
        tokens.push({
          type: this.TOKEN_TYPES.STRIKETHROUGH_DELIMITER,
          start: offset + pos,
          end: offset + pos + 2,
          text: '~~'
        })
        
        // 删除线内容
        if (endPos > pos + 2) {
          tokens.push({
            type: this.TOKEN_TYPES.STRIKETHROUGH_TEXT,
            start: offset + pos + 2,
            end: offset + endPos,
            text: text.substring(pos + 2, endPos)
          })
        }
        
        // 结束标记
        tokens.push({
          type: this.TOKEN_TYPES.STRIKETHROUGH_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 2,
          text: '~~'
        })
        
        return { nextPos: endPos + 2 }
      }
    }
    
    // 链接 [text](url) 或 脚注 [^1]
    if (char === '[') {
      // 检查是否是脚注引用 [^1]
      const footnoteMatch = text.substring(pos).match(/^\[\^(\w+)\]/)
      if (footnoteMatch) {
        // 脚注引用
        tokens.push({
          type: this.TOKEN_TYPES.FOOTNOTE_MARKER,
          start: offset + pos,
          end: offset + pos + 2,
          text: '[^'
        })
        
        tokens.push({
          type: this.TOKEN_TYPES.FOOTNOTE_REF,
          start: offset + pos + 2,
          end: offset + pos + 2 + footnoteMatch[1].length,
          text: footnoteMatch[1]
        })
        
        tokens.push({
          type: this.TOKEN_TYPES.FOOTNOTE_MARKER,
          start: offset + pos + 2 + footnoteMatch[1].length,
          end: offset + pos + footnoteMatch[0].length,
          text: ']'
        })
        
        return { nextPos: pos + footnoteMatch[0].length }
      }
      
      // 普通链接 [text](url)
      const closePos = text.indexOf(']', pos + 1)
      if (closePos !== -1 && text[closePos + 1] === '(') {
        const urlEndPos = text.indexOf(')', closePos + 2)
        if (urlEndPos !== -1) {
          // [
          tokens.push({
            type: this.TOKEN_TYPES.LINK_BRACKET,
            start: offset + pos,
            end: offset + pos + 1,
            text: '['
          })
          
          // 链接文本（可能包含粗体、斜体）
          const linkText = text.substring(pos + 1, closePos)
          if (linkText.length > 0) {
            // 递归解析链接文本
            const innerTokens = []
            this.parseInlineStyles(linkText, innerTokens, 0)
            
            // 调整 token 位置并添加
            for (const token of innerTokens) {
              tokens.push({
                ...token,
                start: offset + pos + 1 + token.start,
                end: offset + pos + 1 + token.end,
                // 如果内部是普通文本，标记为链接文本
                type: token.type === this.TOKEN_TYPES.TEXT ? this.TOKEN_TYPES.LINK_TEXT : token.type
              })
            }
          }
          
          // ]
          tokens.push({
            type: this.TOKEN_TYPES.LINK_BRACKET,
            start: offset + closePos,
            end: offset + closePos + 1,
            text: ']'
          })
          
          // (
          tokens.push({
            type: this.TOKEN_TYPES.LINK_PAREN,
            start: offset + closePos + 1,
            end: offset + closePos + 2,
            text: '('
          })
          
          // URL
          if (urlEndPos > closePos + 2) {
            tokens.push({
              type: this.TOKEN_TYPES.LINK_URL,
              start: offset + closePos + 2,
              end: offset + urlEndPos,
              text: text.substring(closePos + 2, urlEndPos)
            })
          }
          
          // )
          tokens.push({
            type: this.TOKEN_TYPES.LINK_PAREN,
            start: offset + urlEndPos,
            end: offset + urlEndPos + 1,
            text: ')'
          })
          
          return { nextPos: urlEndPos + 1 }
        }
      }
    }
    
    // 图片 ![alt](url)
    if (char === '!' && text[pos + 1] === '[') {
      const closePos = text.indexOf(']', pos + 2)
      if (closePos !== -1 && text[closePos + 1] === '(') {
        const urlEndPos = text.indexOf(')', closePos + 2)
        if (urlEndPos !== -1) {
          // !
          tokens.push({
            type: this.TOKEN_TYPES.IMAGE_BANG,
            start: offset + pos,
            end: offset + pos + 1,
            text: '!'
          })
          
          // [
          tokens.push({
            type: this.TOKEN_TYPES.IMAGE_BRACKET,
            start: offset + pos + 1,
            end: offset + pos + 2,
            text: '['
          })
          
          // alt 文本
          if (closePos > pos + 2) {
            tokens.push({
              type: this.TOKEN_TYPES.IMAGE_ALT,
              start: offset + pos + 2,
              end: offset + closePos,
              text: text.substring(pos + 2, closePos)
            })
          }
          
          // ]
          tokens.push({
            type: this.TOKEN_TYPES.IMAGE_BRACKET,
            start: offset + closePos,
            end: offset + closePos + 1,
            text: ']'
          })
          
          // (
          tokens.push({
            type: this.TOKEN_TYPES.IMAGE_PAREN,
            start: offset + closePos + 1,
            end: offset + closePos + 2,
            text: '('
          })
          
          // URL
          if (urlEndPos > closePos + 2) {
            tokens.push({
              type: this.TOKEN_TYPES.IMAGE_URL,
              start: offset + closePos + 2,
              end: offset + urlEndPos,
              text: text.substring(closePos + 2, urlEndPos)
            })
          }
          
          // )
          tokens.push({
            type: this.TOKEN_TYPES.IMAGE_PAREN,
            start: offset + urlEndPos,
            end: offset + urlEndPos + 1,
            text: ')'
          })
          
          return { nextPos: urlEndPos + 1 }
        }
      }
    }
    
    // 数学公式 $formula$
    if (char === '$') {
      const endPos = text.indexOf('$', pos + 1)
      if (endPos !== -1) {
        // 起始标记
        tokens.push({
          type: this.TOKEN_TYPES.MATH_DELIMITER,
          start: offset + pos,
          end: offset + pos + 1,
          text: '$'
        })
        
        // 公式内容
        if (endPos > pos + 1) {
          tokens.push({
            type: this.TOKEN_TYPES.MATH_CONTENT,
            start: offset + pos + 1,
            end: offset + endPos,
            text: text.substring(pos + 1, endPos)
          })
        }
        
        // 结束标记
        tokens.push({
          type: this.TOKEN_TYPES.MATH_DELIMITER,
          start: offset + endPos,
          end: offset + endPos + 1,
          text: '$'
        })
        
        return { nextPos: endPos + 1 }
      }
    }
    
    // 如果无法识别，作为普通文本
    tokens.push({
      type: this.TOKEN_TYPES.TEXT,
      start: offset + pos,
      end: offset + pos + 1,
      text: char
    })
    
    return { nextPos: pos + 1 }
  }
  
  /**
   * 标记脏行（需要重新解析）
   * @param {number} lineIndex - 行号
   */
  markDirty(lineIndex) {
    this.dirtyLines.add(lineIndex)
  }
  
  /**
   * 标记多行为脏
   * @param {number} startLine - 起始行
   * @param {number} endLine - 结束行
   */
  markDirtyRange(startLine, endLine) {
    for (let i = startLine; i <= endLine; i++) {
      this.dirtyLines.add(i)
    }
  }
  
  /**
   * 清除脏行标记
   */
  clearDirtyMarks() {
    this.dirtyLines.clear()
  }
  
  /**
   * 清除指定行的缓存
   * @param {number} lineIndex - 行号
   */
  invalidateLine(lineIndex) {
    // 删除所有包含该行号的缓存
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
  clearCache() {
    this.cache.clear()
    this.dirtyLines.clear()
    this.cacheStats = { hits: 0, misses: 0 }
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0
    return {
      ...this.cacheStats,
      total,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size
    }
  }
  
  /**
   * 解析整个文档
   * @param {Array} lines - 行数组
   * @returns {Array} 每行的 tokens 数组
   */
  parseDocument(lines) {
    const result = []
    const context = { inCodeBlock: false }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const tokens = this.parseLine(line, i, context)
      
      // 检查代码块状态
      if (line.trimStart().startsWith('```')) {
        context.inCodeBlock = !context.inCodeBlock
      }
      
      result.push(tokens)
    }
    
    return result
  }
}
