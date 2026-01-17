export const createEditorCommands = ({ internalValue, textareaRef, props, emit, syncToParent }) => {
  const applyLineTransform = transform => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return

    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const startLineStart = value.lastIndexOf('\n', start - 1) + 1
    const endLineEndIndex = value.indexOf('\n', end)
    const endLineEnd = endLineEndIndex === -1 ? value.length : endLineEndIndex

    const before = value.slice(0, startLineStart)
    const selectedBlock = value.slice(startLineStart, endLineEnd)
    const after = value.slice(endLineEnd)

    const processed = selectedBlock
      .split('\n')
      .map((line, index) => transform(line, index))
      .join('\n')

    internalValue.value = before + processed + after

    requestAnimationFrame(() => {
      textarea.focus()
    })

    syncToParent()
  }

  const wrapSelection = (prefix, suffix) => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return
    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const selected = value.slice(start, end)
    const isWrapped =
      selected.startsWith(prefix) &&
      selected.endsWith(suffix) &&
      selected.length > prefix.length + suffix.length

    const baseText = selected || ''
    const newText = isWrapped
      ? baseText.slice(prefix.length, baseText.length - suffix.length)
      : `${prefix}${baseText || '文本'}${suffix}`

    const before = value.slice(0, start)
    const after = value.slice(end)
    internalValue.value = before + newText + after

    const newCursorStart = before.length + (isWrapped ? 0 : prefix.length)
    const newCursorEnd = newCursorStart + (baseText || '文本').length

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = newCursorStart
      textarea.selectionEnd = newCursorEnd
    })

    syncToParent()
  }

  const toggleHeading = level => {
    applyLineTransform(line => {
      const trimmed = line.trimStart()
      const withoutHash = trimmed.replace(/^#{1,6}\s+/, '')
      const leadingSpaces = line.length - trimmed.length
      const content = withoutHash || '标题'
      const prefix = '#'.repeat(level) + ' '
      return `${' '.repeat(leadingSpaces)}${prefix}${content}`
    })
  }

  const insertUnorderedList = () => {
    applyLineTransform(line => {
      const trimmed = line.trimStart()
      const leadingSpaces = line.length - trimmed.length
      if (!trimmed) {
        return `${' '.repeat(leadingSpaces)}- `
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        return line
      }
      return `${' '.repeat(leadingSpaces)}- ${trimmed}`
    })
  }

  const insertOrderedList = () => {
    applyLineTransform((line, index) => {
      const trimmed = line.trimStart()
      const leadingSpaces = line.length - trimmed.length
      const order = index + 1
      if (!trimmed) {
        return `${' '.repeat(leadingSpaces)}${order}. `
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        return line
      }
      return `${' '.repeat(leadingSpaces)}${order}. ${trimmed}`
    })
  }

  const insertBlockquote = () => {
    applyLineTransform(line => {
      const trimmed = line.trimStart()
      const leadingSpaces = line.length - trimmed.length
      if (!trimmed) {
        return `${' '.repeat(leadingSpaces)}> `
      }
      if (/^>\s+/.test(trimmed)) {
        return line
      }
      return `${' '.repeat(leadingSpaces)}> ${trimmed}`
    })
  }

  const insertCodeBlock = () => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return
    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const selected = value.slice(start, end)

    if (!selected) {
      const before = value.slice(0, start)
      const after = value.slice(end)
      const prefix = before.endsWith('\n') || !before ? '' : '\n'
      const suffix = after.startsWith('\n') || !after ? '' : '\n'
      const core = '```lang\n代码\n```'
      const snippet = `${prefix}${core}${suffix}`
      internalValue.value = before + snippet + after

      const cursorStart = before.length + prefix.length + 3
      const cursorEnd = cursorStart + 4

      requestAnimationFrame(() => {
        textarea.focus()
        textarea.selectionStart = cursorStart
        textarea.selectionEnd = cursorEnd
      })

      syncToParent()
      return
    }

    const before = value.slice(0, start)
    const after = value.slice(end)
    const prefix = before.endsWith('\n') || !before ? '' : '\n'
    const suffix = after.startsWith('\n') || !after ? '' : '\n'
    const core = `\`\`\`lang\n${selected}\n\`\`\``
    const snippet = `${prefix}${core}${suffix}`

    internalValue.value = before + snippet + after

    const cursorStart = before.length + prefix.length + 3
    const cursorEnd = cursorStart + 4

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = cursorStart
      textarea.selectionEnd = cursorEnd
    })

    syncToParent()
  }

  const insertHorizontalRule = () => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return
    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const before = value.slice(0, start)
    const after = value.slice(end)
    const prefix = before.endsWith('\n') || !before ? '' : '\n'
    const suffix = after.startsWith('\n') || !after ? '' : '\n'
    const snippet = `${prefix}---${suffix}`

    internalValue.value = before + snippet + after

    const cursor = (before + snippet).length

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = cursor
      textarea.selectionEnd = cursor
    })

    syncToParent()
  }

  const insertLink = () => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return
    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const selected = value.slice(start, end)
    const text = selected || '链接文本'
    const urlPlaceholder = 'https://'

    const before = value.slice(0, start)
    const after = value.slice(end)

    const markdown = `[${text}](${urlPlaceholder})`

    internalValue.value = before + markdown + after

    const urlStart = (before + `[${text}](`).length
    const urlEnd = urlStart + urlPlaceholder.length

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = urlStart
      textarea.selectionEnd = urlEnd
    })

    syncToParent()
  }

  const insertImage = () => {
    if (props.readOnly) return
    const textarea = textareaRef.value
    if (!textarea) return
    const value = internalValue.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const selected = value.slice(start, end)
    const altText = selected || '图片描述'
    const urlPlaceholder = 'https://'

    const before = value.slice(0, start)
    const after = value.slice(end)

    const markdown = `![${altText}](${urlPlaceholder})`

    internalValue.value = before + markdown + after

    const urlStart = (before + `![${altText}](`).length
    const urlEnd = urlStart + urlPlaceholder.length

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = urlStart
      textarea.selectionEnd = urlEnd
    })

    syncToParent()
  }

  const handleKeydown = event => {
    const textarea = textareaRef.value
    if (!textarea) return

    const isMod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (isMod && key === 's') {
      event.preventDefault()
      emit('save', internalValue.value)
      return
    }

    if (props.readOnly) return

    if (isMod) {
      if (!event.shiftKey && key === 'b') {
        event.preventDefault()
        wrapSelection('**', '**')
        return
      }
      if (!event.shiftKey && key === 'i') {
        event.preventDefault()
        wrapSelection('*', '*')
        return
      }
      if (event.shiftKey && key === 'u') {
        event.preventDefault()
        insertUnorderedList()
        return
      }
      if (event.shiftKey && key === 'o') {
        event.preventDefault()
        insertOrderedList()
        return
      }
      if (event.shiftKey && key === 'q') {
        event.preventDefault()
        insertBlockquote()
        return
      }
      if (!event.shiftKey && key === 'e') {
        event.preventDefault()
        insertCodeBlock()
        return
      }
      if (event.shiftKey && key === 'h') {
        event.preventDefault()
        insertHorizontalRule()
        return
      }
      if (!event.shiftKey && key === 'k') {
        event.preventDefault()
        insertLink()
        return
      }
      if (event.shiftKey && key === 'k') {
        event.preventDefault()
        insertImage()
        return
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault()

      const value = internalValue.value
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const startLineStart = value.lastIndexOf('\n', start - 1) + 1
      const endLineEndIndex = value.indexOf('\n', end)
      const endLineEnd = endLineEndIndex === -1 ? value.length : endLineEndIndex

      const before = value.slice(0, startLineStart)
      const selectedBlock = value.slice(startLineStart, endLineEnd)
      const after = value.slice(endLineEnd)

      if (event.shiftKey) {
        const processed = selectedBlock
          .split('\n')
          .map(line => (line.startsWith('  ') ? line.slice(2) : line))
          .join('\n')

        internalValue.value = before + processed + after

        const diff = selectedBlock.length - processed.length

        requestAnimationFrame(() => {
          textarea.selectionStart = start - diff
          textarea.selectionEnd = end - diff
        })
      } else {
        const processed = selectedBlock
          .split('\n')
          .map(line => '  ' + line)
          .join('\n')

        internalValue.value = before + processed + after

        const diff = processed.length - selectedBlock.length

        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = end + diff
        })
      }

      syncToParent()
    }
  }

  return {
    applyLineTransform,
    wrapSelection,
    toggleHeading,
    insertUnorderedList,
    insertOrderedList,
    insertBlockquote,
    insertCodeBlock,
    insertHorizontalRule,
    insertLink,
    insertImage,
    handleKeydown,
  }
}

