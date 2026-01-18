/**
 * SyntaxHighlighter - 语法高亮渲染器
 * 根据 tokens 渲染不同颜色的文本
 */
export class SyntaxHighlighter {
  constructor(options = {}) {
    this.theme = options.theme || 'light'
    this.themes = {
      light: {
        text: '#333333',
        heading1: '#0066cc',
        heading2: '#0077dd',
        heading3: '#0088ee',
        heading4: '#0099ff',
        heading5: '#00aaff',
        heading6: '#00bbff',
        bold_delimiter: '#666666',
        bold_text: '#000000',
        italic_delimiter: '#666666',
        italic_text: '#555555',
        code_delimiter: '#999999',
        code_text: '#d14',
        code_block_delimiter: '#999999',
        code_block_lang: '#0088cc',
        code_block_text: '#333333',
        link_bracket: '#999999',
        link_text: '#0066cc',
        link_paren: '#999999',
        link_url: '#0088cc',
        image_bang: '#cc6600',
        image_bracket: '#999999',
        image_alt: '#cc6600',
        image_paren: '#999999',
        image_url: '#0088cc',
        list_marker: '#cc6600',
        quote_marker: '#999999',
        strikethrough_delimiter: '#999999',
        strikethrough_text: '#999999',
        hr: '#cccccc',
        table_delimiter: '#999999',
        table_header: '#0066cc',
        table_align: '#999999',
        table_cell: '#333333',
        task_bracket: '#999999',
        task_checkbox: '#00aa00',
        task_text: '#333333',
        footnote_marker: '#999999',
        footnote_ref: '#0066cc',
        footnote_def: '#555555',
        math_delimiter: '#cc0099',
        math_content: '#cc0099'
      },
      dark: {
        text: '#cccccc',
        heading1: '#6699ff',
        heading2: '#7799ff',
        heading3: '#8899ff',
        heading4: '#9999ff',
        heading5: '#aa99ff',
        heading6: '#bb99ff',
        bold_delimiter: '#999999',
        bold_text: '#ffffff',
        italic_delimiter: '#999999',
        italic_text: '#aaaaaa',
        code_delimiter: '#666666',
        code_text: '#ff9966',
        code_block_delimiter: '#666666',
        code_block_lang: '#66ccff',
        code_block_text: '#cccccc',
        link_bracket: '#666666',
        link_text: '#6699ff',
        link_paren: '#666666',
        link_url: '#66ccff',
        image_bang: '#ff9966',
        image_bracket: '#666666',
        image_alt: '#ff9966',
        image_paren: '#666666',
        image_url: '#66ccff',
        list_marker: '#ff9966',
        quote_marker: '#666666',
        strikethrough_delimiter: '#666666',
        strikethrough_text: '#666666',
        hr: '#444444',
        table_delimiter: '#666666',
        table_header: '#6699ff',
        table_align: '#666666',
        table_cell: '#cccccc',
        task_bracket: '#666666',
        task_checkbox: '#00cc00',
        task_text: '#cccccc',
        footnote_marker: '#666666',
        footnote_ref: '#6699ff',
        footnote_def: '#aaaaaa',
        math_delimiter: '#ff66cc',
        math_content: '#ff66cc'
      }
    }
  }
  
  /**
   * 获取 token 对应的颜色
   * @param {string} tokenType - token 类型
   * @returns {string} 颜色值
   */
  getColor(tokenType) {
    const currentTheme = this.themes[this.theme]
    return currentTheme[tokenType] || currentTheme.text
  }
  
  /**
   * 获取 token 对应的字体样式
   * @param {string} tokenType - token 类型
   * @returns {Object} 样式对象
   */
  getStyle(tokenType) {
    const style = {
      color: this.getColor(tokenType),
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false
    }
    
    // 粗体
    if (tokenType === 'bold_text' || tokenType.startsWith('heading')) {
      style.bold = true
    }
    
    // 斜体
    if (tokenType === 'italic_text') {
      style.italic = true
    }
    
    // 删除线
    if (tokenType === 'strikethrough_text') {
      style.strikethrough = true
    }
    
    // 链接下划线
    if (tokenType === 'link_url') {
      style.underline = true
    }
    
    return style
  }
  
  /**
   * 设置主题
   * @param {string} theme - 主题名称（light/dark）
   */
  setTheme(theme) {
    if (this.themes[theme]) {
      this.theme = theme
    }
  }
  
  /**
   * 自定义主题颜色
   * @param {string} theme - 主题名称
   * @param {string} tokenType - token 类型
   * @param {string} color - 颜色值
   */
  setColor(theme, tokenType, color) {
    if (this.themes[theme]) {
      this.themes[theme][tokenType] = color
    }
  }
}
