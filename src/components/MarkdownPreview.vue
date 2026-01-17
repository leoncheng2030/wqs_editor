<script>
import { h } from 'vue'
import { marked } from 'marked'
import MarkdownCodeBlock from './MarkdownCodeBlock.vue'
import MarkdownQuote from './MarkdownQuote.vue'

const renderTokens = tokens =>
  (tokens || []).map((token, index) => {
    if (!token) return null
    if (token.type === 'code') {
      return h(MarkdownCodeBlock, {
        key: index,
        code: token.text || '',
        lang: token.lang || '',
      })
    }
    if (token.type === 'blockquote') {
      return h(
        MarkdownQuote,
        { key: index },
        {
          default: () => renderTokens(token.tokens || []),
        },
      )
    }
    const html = marked.parser([token])
    return h('div', {
      key: index,
      innerHTML: html,
    })
  })

export default {
  name: 'MarkdownPreview',
  props: {
    tokens: {
      type: Array,
      default: () => [],
    },
  },
  render() {
    return h(
      'div',
      { class: 'markdown-editor__preview' },
      renderTokens(this.tokens),
    )
  },
}
</script>

