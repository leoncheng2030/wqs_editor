import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const normalizeText = value => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

export const highlightCode = (source, lang) => {
  const text = normalizeText(source)
  const langValue = (lang || '').trim()
  const language = langValue && hljs.getLanguage(langValue) ? langValue : ''
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : hljs.highlightAuto(text).value

  const lines = text ? text.replace(/\n$/, '').split('\n') : ['']
  const langLabel = langValue || language || 'text'
  const langClass = language ? `language-${language}` : ''

  return {
    html: highlighted,
    lines,
    langLabel,
    langClass,
  }
}

marked.setOptions({
  breaks: true,
  langPrefix: 'hljs language-',
})

export const tokenizeMarkdown = value => marked.lexer(value || '')

export const parseMarkdown = value => marked.parse(value || '')
