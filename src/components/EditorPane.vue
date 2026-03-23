<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { ElMessage } from 'element-plus'
import { useResumeStore } from '../stores/resume'
import { MANUAL_PAGE_BREAK_MARKER } from '../utils/manualPageBreak'

const editorContainer = ref<HTMLElement | null>(null)
const hasCopiedMarkdown = ref(false)
const store = useResumeStore()

let view: EditorView | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let isExternalUpdate = false

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: 'var(--color-primary)',
    fontWeight: '700',
    textDecoration: 'none',
  },
  {
    tag: tags.strong,
    fontWeight: '700',
    color: 'var(--color-on-surface)',
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
    color: 'var(--color-on-surface)',
  },
  {
    tag: tags.quote,
    color: 'color-mix(in srgb, var(--color-primary) 74%, var(--color-on-surface-variant) 26%)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--color-primary) 55%, transparent)',
  },
  {
    tag: tags.monospace,
    color: 'var(--color-on-surface)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    borderRadius: '0.4rem',
  },
  {
    tag: [tags.processingInstruction, tags.contentSeparator],
    color: 'var(--color-primary)',
    fontWeight: '600',
  },
])

const scheduleAutoSave = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(async () => {
    if (store.activeFilePath) {
      await store.saveCurrentFile(true)
    }
    autoSaveTimer = null
  }, 1000)
}

const focusEditor = () => {
  view?.focus()
}

const jumpToLine = (lineNumber: number) => {
  if (!view) {
    return
  }

  const boundedLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines))
  const targetLine = view.state.doc.line(boundedLine)

  view.dispatch({
    selection: { anchor: targetLine.from, head: targetLine.from },
    effects: EditorView.scrollIntoView(targetLine.from, { y: 'center' }),
  })
  focusEditor()
}

const insertManualPageBreak = () => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const line = state.doc.lineAt(from)
  const isCurrentLinePageBreak = line.from !== line.to && line.text.trim() === MANUAL_PAGE_BREAK_MARKER

  if (isCurrentLinePageBreak) {
    const removeFrom = Math.max(0, line.from - (line.from > 0 ? 1 : 0))
    const removeTo = Math.min(state.doc.length, line.to + (line.to < state.doc.length ? 1 : 0))
    view.dispatch({
      changes: { from: removeFrom, to: removeTo, insert: '' },
      selection: { anchor: removeFrom, head: removeFrom },
    })
    focusEditor()
    return
  }

  const beforeChar = from > 0 ? state.doc.sliceString(from - 1, from) : ''
  const afterChar = to < state.doc.length ? state.doc.sliceString(to, to + 1) : ''
  const prefix = beforeChar === '\n' || from === 0 ? '' : '\n'
  const suffix = afterChar === '\n' || to === state.doc.length ? '\n' : '\n\n'
  const insertText = `${prefix}${MANUAL_PAGE_BREAK_MARKER}${suffix}`
  const cursorPosition = from + insertText.length

  view.dispatch({
    changes: { from, to, insert: insertText },
    selection: { anchor: cursorPosition, head: cursorPosition },
  })
  focusEditor()
}

const toggleInlineSyntax = (prefix: string, suffix: string = prefix) => {
  if (!view) return

  const { state } = view
  const { from, to, empty } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const selectedHasWrapper =
    selectedText.length >= prefix.length + suffix.length &&
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix)

  if (selectedHasWrapper) {
    const unwrappedText = selectedText.slice(prefix.length, selectedText.length - suffix.length)
    view.dispatch({
      changes: { from, to, insert: unwrappedText },
      selection: { anchor: from, head: from + unwrappedText.length },
    })
    focusEditor()
    return
  }

  const beforeSelection = from >= prefix.length
    ? state.doc.sliceString(from - prefix.length, from)
    : ''
  const afterSelection = to + suffix.length <= state.doc.length
    ? state.doc.sliceString(to, to + suffix.length)
    : ''

  if (!empty && beforeSelection === prefix && afterSelection === suffix) {
    view.dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' },
      ],
      selection: { anchor: from - prefix.length, head: to - prefix.length },
    })
    focusEditor()
    return
  }

  view.dispatch({
    changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
    selection: {
      anchor: from + prefix.length,
      head: empty ? from + prefix.length : to + prefix.length,
    },
  })
  focusEditor()
}

const toggleLinePrefix = (prefix: string) => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to > from ? to - 1 : to)
  const rangeFrom = startLine.from
  const rangeTo = endLine.to
  const blockText = state.doc.sliceString(rangeFrom, rangeTo)
  const lines = blockText.split('\n')

  if (lines.length === 1 && lines[0] === '') {
    view.dispatch({
      changes: { from: rangeFrom, to: rangeTo, insert: prefix },
      selection: { anchor: rangeFrom + prefix.length, head: rangeFrom + prefix.length },
    })
    focusEditor()
    return
  }

  const nonEmptyLines = lines.filter((line) => line.length > 0)
  const shouldRemove = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.startsWith(prefix))
  const nextBlockText = lines
    .map((line) => {
      if (!line.length) {
        return line
      }

      if (shouldRemove && line.startsWith(prefix)) {
        return line.slice(prefix.length)
      }

      return shouldRemove ? line : `${prefix}${line}`
    })
    .join('\n')

  view.dispatch({
    changes: { from: rangeFrom, to: rangeTo, insert: nextBlockText },
    selection: { anchor: rangeFrom, head: rangeFrom + nextBlockText.length },
  })
  focusEditor()
}

const toggleLinkSyntax = () => {
  if (!view) return

  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const selectedLinkMatch = selectedText.match(/^\[([\s\S]*)\]\(([^()]*)\)$/)

  if (selectedLinkMatch) {
    const label = selectedLinkMatch[1]
    view.dispatch({
      changes: { from, to, insert: label },
      selection: { anchor: from, head: from + label.length },
    })
    focusEditor()
    return
  }

  const precedingChar = from > 0 ? state.doc.sliceString(from - 1, from) : ''
  const trailingText = state.doc.sliceString(to, Math.min(state.doc.length, to + 2048))
  const surroundingLinkMatch = precedingChar === '[' ? trailingText.match(/^\]\(([^()]*)\)/) : null

  if (surroundingLinkMatch) {
    const suffixLength = surroundingLinkMatch[0].length
    view.dispatch({
      changes: [
        { from: from - 1, to: from, insert: '' },
        { from: to, to: to + suffixLength, insert: '' },
      ],
      selection: { anchor: from - 1, head: to - 1 },
    })
    focusEditor()
    return
  }

  view.dispatch({
    changes: { from, to, insert: `[${selectedText}](url)` },
    selection: {
      anchor: from + 1,
      head: selectedText.length > 0 ? from + 1 + selectedText.length : from + 1,
    },
  })
  focusEditor()
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard unavailable')
  }
}

const showCopyFeedback = () => {
  hasCopiedMarkdown.value = true

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }

  copyFeedbackTimer = setTimeout(() => {
    hasCopiedMarkdown.value = false
    copyFeedbackTimer = null
  }, 1600)
}

const copyMarkdown = async () => {
  if (!store.activeFilePath) {
    return
  }

  try {
    await copyTextToClipboard(store.markdownContent)
    showCopyFeedback()
    ElMessage.success('Markdown 已复制')
  } catch (error) {
    console.error('Failed to copy markdown:', error)
    ElMessage.error('复制失败')
  }
}

onMounted(() => {
  if (!editorContainer.value) return

  view = new EditorView({
    doc: store.markdownContent,
    extensions: [
      basicSetup,
      EditorView.lineWrapping,
      markdown(),
      syntaxHighlighting(markdownHighlightStyle),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return
        }

        store.markdownContent = update.state.doc.toString()
        if (!isExternalUpdate) {
          scheduleAutoSave()
        }
      }),
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'transparent' },
        '.cm-scroller': { overflow: 'auto', padding: '2rem' },
        '.cm-content': {
          fontFamily: 'var(--font-body), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
          color: 'var(--color-on-surface-variant)',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--color-outline-variant)',
          borderRight: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: 'var(--color-primary)',
        },
      }),
    ],
    parent: editorContainer.value,
  })
})

onBeforeUnmount(async () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }

  if (store.activeFilePath) {
    await store.saveCurrentFile(true)
  }

  if (view) {
    view.destroy()
  }
})

watch(() => store.markdownContent, (newVal) => {
  if (!view || view.state.doc.toString() === newVal) {
    return
  }

  isExternalUpdate = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: newVal },
  })
  isExternalUpdate = false
})

watch(
  () => store.editorJumpRequest?.token,
  () => {
    if (!store.editorJumpRequest) {
      return
    }

    jumpToLine(store.editorJumpRequest.line)
    store.clearEditorJumpRequest()
  },
)
</script>

<template>
  <section class="flex flex-col card-soft ghost-border shadow-ambient overflow-hidden h-full relative">
    <transition name="fade">
      <div
        v-if="!store.activeFilePath"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm"
      >
        <div class="p-8 rounded-[2rem] bg-surface-container-high text-on-surface-variant/40 mb-4 ring-1 ring-outline-variant/10 shadow-inner border border-white/5">
          <span class="material-symbols-outlined text-4xl">edit_note</span>
        </div>
        <p class="text-on-surface text-sm font-semibold tracking-wide">选择或创建一个文件</p>
        <p class="text-[11px] text-on-surface-variant/60 mt-2 font-medium">开启你的简历编辑之旅</p>
      </div>
    </transition>

    <div
      class="h-14 border-b border-outline-variant/10 flex items-center px-6 justify-between bg-surface-container-lowest/50 backdrop-blur-sm shrink-0 transition-all duration-300"
      :class="{ 'opacity-20 grayscale pointer-events-none': !store.activeFilePath }"
    >
      <div class="flex items-center gap-3">
        <button @click="toggleInlineSyntax('**')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="加粗">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_bold</span>
        </button>
        <button @click="toggleInlineSyntax('*')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="斜体">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_italic</span>
        </button>
        <button @click="toggleLinePrefix('- ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="列表">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_list_bulleted</span>
        </button>
        <button @click="toggleLinkSyntax" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="链接">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">link</span>
        </button>
        <button @click="insertManualPageBreak" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" :title="`插入分页 ${MANUAL_PAGE_BREAK_MARKER}`">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">insert_page_break</span>
        </button>
        <button @click="toggleLinePrefix('> ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="引用">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_quote</span>
        </button>
      </div>

      <button
        @click="copyMarkdown"
        class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group"
        :title="hasCopiedMarkdown ? '已复制 Markdown 文本' : '复制 Markdown 文本'"
      >
        <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
          {{ hasCopiedMarkdown ? 'check' : 'content_copy' }}
        </span>
      </button>
    </div>

    <div
      class="flex-1 w-full bg-transparent overflow-hidden transition-opacity duration-300"
      :class="{ 'opacity-0': !store.activeFilePath }"
    >
      <div ref="editorContainer" class="h-full w-full custom-scrollbar"></div>
    </div>
  </section>
</template>
