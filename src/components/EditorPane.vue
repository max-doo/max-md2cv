<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState, type Range } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { ElMessage } from 'element-plus'
import EditorShell from './editor/EditorShell.vue'
import EditorToolbar from './editor/EditorToolbar.vue'
import { type InsertMenuValue, type LineFormatValue } from './editor/toolbarOptions'
import { useResumeStore } from '../stores/resume'
import { MANUAL_PAGE_BREAK_MARKER } from '../utils/manualPageBreak'

const editorContainer = ref<HTMLElement | null>(null)
const hasCopiedMarkdown = ref(false)
const hasTextSelection = ref(false)
const recoveryFileName = ref('')
const store = useResumeStore()

const hasActiveFile = computed(() => Boolean(store.activeFilePath))
const isMissingFile = computed(() => store.activeFileStatus === 'missing')
const hasAlternativeFiles = computed(() => store.fileList.length > 0)
const editorViewMode = ref<'source' | 'render'>('source')
const isRenderView = computed(() => editorViewMode.value === 'render')
const isFormattingDisabled = computed(
  () => !store.activeFilePath || store.activeFileStatus === 'missing',
)

let view: EditorView | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let isExternalUpdate = false

const editableCompartment = new Compartment()
const readOnlyCompartment = new Compartment()
const editorViewModeCompartment = new Compartment()
const renderDecorationsCompartment = new Compartment()

const LINE_FORMAT_PREFIXES: Record<LineFormatValue, string> = {
  paragraph: '',
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  heading4: '#### ',
  list: '- ',
  quote: '> ',
}

const currentLineFormat = ref<LineFormatValue>('paragraph')

interface ParsedLineFormat {
  leadingWhitespace: string
  prefix: string
  content: string
  format: LineFormatValue
}

interface LineFormatChange {
  line: {
    from: number
    to: number
    length: number
    number: number
    text: string
  }
  parsedLine: ParsedLineFormat
  nextText: string
  delta: number
}

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

const HEADING_LINE_RE = /^(\s*)(#{1,4}\s+)/
const QUOTE_LINE_RE = /^(\s*)(>\s?)/
const LIST_LINE_RE = /^(\s*)([-*+]\s+|\d+\.\s+)/

class InlineTextWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string,
  ) {
    super()
  }

  eq(other: InlineTextWidget) {
    return other.text === this.text && other.className === this.className
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = this.className
    span.textContent = this.text
    return span
  }

  ignoreEvent() {
    return false
  }
}

const buildPageBreakLineDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)

    if (line.text.trim() !== MANUAL_PAGE_BREAK_MARKER) {
      continue
    }

    decorations.push(Decoration.line({ class: 'cm-md-source-page-break-line' }).range(line.from))
  }

  return Decoration.set(decorations, true)
}

const sourcePageBreakDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildPageBreakLineDecorations(view.state)
  }

  update(update: ViewUpdate) {
    if (!update.docChanged) {
      return
    }

    this.decorations = buildPageBreakLineDecorations(update.state)
  }
}, {
  decorations: (value) => value.decorations,
})

const createReplaceDecoration = (
  from: number,
  to: number,
  widgetText?: string,
  widgetClassName?: string,
) => {
  if (widgetText && widgetClassName) {
    return Decoration.replace({
      widget: new InlineTextWidget(widgetText, widgetClassName),
    }).range(from, to)
  }

  return Decoration.replace({}).range(from, to)
}

const buildRenderDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)

    if (line.text.trim() === MANUAL_PAGE_BREAK_MARKER) {
      decorations.push(Decoration.line({ class: 'cm-md-render-page-break-line' }).range(line.from))
      decorations.push(
        createReplaceDecoration(
          line.from,
          line.to,
          '--分页符--',
          'cm-md-render-page-break-chip',
        ),
      )
      continue
    }

    const headingMatch = line.text.match(HEADING_LINE_RE)
    if (headingMatch) {
      const prefixFrom = line.from + headingMatch[1].length
      const prefixTo = prefixFrom + headingMatch[2].length

      decorations.push(
        Decoration.line({
          class: `cm-md-render-heading cm-md-render-heading-${headingMatch[2].trim().length}`,
        }).range(line.from),
      )
      decorations.push(createReplaceDecoration(prefixFrom, prefixTo))
      continue
    }

    const quoteMatch = line.text.match(QUOTE_LINE_RE)
    if (quoteMatch) {
      const prefixFrom = line.from + quoteMatch[1].length
      const prefixTo = prefixFrom + quoteMatch[2].length

      decorations.push(Decoration.line({ class: 'cm-md-render-quote' }).range(line.from))
      decorations.push(createReplaceDecoration(prefixFrom, prefixTo))
      continue
    }

    const listMatch = line.text.match(LIST_LINE_RE)
    if (!listMatch) {
      continue
    }

    const prefixFrom = line.from + listMatch[1].length
    const prefixTo = prefixFrom + listMatch[2].length
    const rawMarker = listMatch[2].trim()
    const isOrderedMarker = /^\d+\.$/.test(rawMarker)

    decorations.push(Decoration.line({ class: 'cm-md-render-list' }).range(line.from))
    decorations.push(
      createReplaceDecoration(
        prefixFrom,
        prefixTo,
        isOrderedMarker ? `${rawMarker} ` : '• ',
        isOrderedMarker
          ? 'cm-md-render-list-marker cm-md-render-list-marker-ordered'
          : 'cm-md-render-list-marker',
      ),
    )
  }

  syntaxTree(state).iterate({
    enter: ({ from, to, type }) => {
      if (type.name === 'StrongEmphasis') {
        decorations.push(Decoration.mark({ class: 'cm-md-render-strong' }).range(from, to))
        return
      }

      if (type.name === 'Emphasis') {
        decorations.push(Decoration.mark({ class: 'cm-md-render-emphasis' }).range(from, to))
        return
      }

      if (type.name === 'Link') {
        decorations.push(Decoration.mark({ class: 'cm-md-render-link' }).range(from, to))
        return
      }

      if (type.name === 'InlineCode') {
        decorations.push(Decoration.mark({ class: 'cm-md-render-inline-code' }).range(from, to))
        return
      }

      if (type.name === 'EmphasisMark' || type.name === 'LinkMark' || type.name === 'URL' || type.name === 'CodeMark') {
        decorations.push(createReplaceDecoration(from, to))
      }
    },
  })

  return Decoration.set(decorations, true)
}

const renderMarkdownDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildRenderDecorations(view.state)
  }

  update(update: ViewUpdate) {
    if (!update.docChanged && !update.viewportChanged) {
      return
    }

    this.decorations = buildRenderDecorations(update.state)
  }
}, {
  decorations: (value) => value.decorations,
})

const createEditorViewModeExtension = () => EditorView.editorAttributes.of({
  class: isRenderView.value ? 'cm-editor-render' : 'cm-editor-source',
})

const createRenderDecorationsExtension = () => (
  isRenderView.value ? [renderMarkdownDecorations] : []
)

const parseLineFormat = (lineText: string): ParsedLineFormat => {
  const leadingWhitespace = lineText.match(/^\s*/)?.[0] ?? ''
  const contentText = lineText.slice(leadingWhitespace.length)
  const headingMatch = contentText.match(/^(#{1,4})\s+/)

  if (headingMatch) {
    return {
      leadingWhitespace,
      prefix: headingMatch[0],
      content: contentText.slice(headingMatch[0].length),
      format: `heading${headingMatch[1].length}` as LineFormatValue,
    }
  }

  const listMatch = contentText.match(/^(?:[-*+]\s+|\d+\.\s+)/)
  if (listMatch) {
    return {
      leadingWhitespace,
      prefix: listMatch[0],
      content: contentText.slice(listMatch[0].length),
      format: 'list' as const,
    }
  }

  const quoteMatch = contentText.match(/^>\s?/)
  if (quoteMatch) {
    return {
      leadingWhitespace,
      prefix: quoteMatch[0],
      content: contentText.slice(quoteMatch[0].length),
      format: 'quote' as const,
    }
  }

  return {
    leadingWhitespace,
    prefix: '',
    content: contentText,
    format: 'paragraph' as const,
  }
}

const syncCurrentLineFormat = (state: EditorState) => {
  const activeLine = state.doc.lineAt(state.selection.main.head)
  currentLineFormat.value = parseLineFormat(activeLine.text).format
}

const syncTextSelection = (state: EditorState) => {
  hasTextSelection.value = !state.selection.main.empty
}

const scheduleAutoSave = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(async () => {
    if (store.activeFilePath && store.activeFileStatus === 'ready') {
      await store.saveCurrentFile(true)
    }
    autoSaveTimer = null
  }, 1000)
}

const syncEditorReadOnly = () => {
  if (!view) {
    return
  }

  const isReadOnly = isMissingFile.value
  view.dispatch({
    effects: [
      editableCompartment.reconfigure(EditorView.editable.of(!isReadOnly)),
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(isReadOnly)),
    ],
  })
}

const syncRecoveryFileName = () => {
  if (!isMissingFile.value) {
    recoveryFileName.value = ''
    return
  }

  recoveryFileName.value = store.activeFileName || '恢复稿'
}

const focusEditor = () => {
  view?.focus()
}

const hasEditableEditor = () => {
  return Boolean(view) && !isFormattingDisabled.value
}

const hasNonEmptySelection = () => {
  if (!view) {
    return false
  }

  return !view.state.selection.main.empty
}

const setEditorViewMode = (mode: 'source' | 'render') => {
  editorViewMode.value = mode

  if (view) {
    view.dispatch({
      effects: [
        editorViewModeCompartment.reconfigure(createEditorViewModeExtension()),
        renderDecorationsCompartment.reconfigure(createRenderDecorationsExtension()),
      ],
    })
  }

  requestAnimationFrame(() => {
    view?.requestMeasure()
    focusEditor()
  })
}

const toggleEditorView = () => {
  setEditorViewMode(isRenderView.value ? 'source' : 'render')
}

const scrollEditorToLine = (lineNumber: number) => {
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

const applyCurrentLineFormat = (nextFormat: LineFormatValue) => {
  if (!hasEditableEditor() || !view) {
    return
  }

  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to > from ? to - 1 : to)
  const rangeFrom = startLine.from
  const rangeTo = endLine.to
  const nextPrefix = LINE_FORMAT_PREFIXES[nextFormat]
  const lineChanges: LineFormatChange[] = []

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const parsedLine = parseLineFormat(line.text)
    const nextText = `${parsedLine.leadingWhitespace}${nextPrefix}${parsedLine.content}`

    lineChanges.push({
      line,
      parsedLine,
      nextText,
      delta: nextText.length - line.length,
    })
  }

  const mapSelectionPos = (position: number) => {
    let cumulativeDelta = 0

    for (const lineChange of lineChanges) {
      const { line, parsedLine } = lineChange
      const leadingEnd = line.from + parsedLine.leadingWhitespace.length
      const contentStart = leadingEnd + parsedLine.prefix.length
      const nextLineFrom = line.from + cumulativeDelta
      const nextContentStart = nextLineFrom + parsedLine.leadingWhitespace.length + nextPrefix.length

      if (position < line.from) {
        return position + cumulativeDelta
      }

      if (position <= line.to) {
        if (position < leadingEnd) {
          return position + cumulativeDelta
        }

        if (position <= contentStart) {
          return nextContentStart
        }

        const contentOffset = Math.min(position - contentStart, parsedLine.content.length)
        return nextContentStart + contentOffset
      }

      cumulativeDelta += lineChange.delta
    }

    return position + cumulativeDelta
  }

  view.dispatch({
    changes: {
      from: rangeFrom,
      to: rangeTo,
      insert: lineChanges.map((lineChange) => lineChange.nextText).join('\n'),
    },
    selection: {
      anchor: mapSelectionPos(state.selection.main.anchor),
      head: mapSelectionPos(state.selection.main.head),
    },
  })
  focusEditor()
}

const jumpToLine = (lineNumber: number) => {
  if (!view) {
    return
  }

  scrollEditorToLine(lineNumber)
}

const insertManualPageBreak = () => {
  if (!hasEditableEditor() || !view) return

  const { state } = view
  const { from, to } = state.selection.main
  const line = state.doc.lineAt(from)
  const isCurrentLinePageBreak =
    line.from !== line.to && line.text.trim() === MANUAL_PAGE_BREAK_MARKER

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
  if (!hasEditableEditor() || !view || !hasNonEmptySelection()) return

  const { state } = view
  const { from, to } = state.selection.main
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

  if (beforeSelection === prefix && afterSelection === suffix) {
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
      head: to + prefix.length,
    },
  })
  focusEditor()
}

const insertWrappedSyntax = (prefix: string, suffix: string, emptyContent: string = '') => {
  if (!hasEditableEditor() || !view) {
    return
  }

  const { state } = view
  const { from, to, empty } = state.selection.main
  const selectedText = state.doc.sliceString(from, to)
  const content = empty ? emptyContent : selectedText

  view.dispatch({
    changes: { from, to, insert: `${prefix}${content}${suffix}` },
    selection: empty
      ? {
          anchor: from + prefix.length,
          head: from + prefix.length + emptyContent.length,
        }
      : {
          anchor: from + prefix.length,
          head: from + prefix.length + selectedText.length,
        },
  })
  focusEditor()
}

const toggleLinkSyntax = () => {
  if (!hasEditableEditor() || !view) return

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
  const surroundingLinkMatch = precedingChar === '['
    ? trailingText.match(/^\]\(([^()]*)\)/)
    : null

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

const insertDateSyntax = () => {
  insertWrappedSyntax('[', ']', 'YYYY.MM - YYYY.MM')
}

const insertEmphasisSyntax = () => {
  toggleInlineSyntax('**【', '】**')
}

const handleInsertCommand = (command: InsertMenuValue) => {
  if (command === 'link') {
    toggleLinkSyntax()
    return
  }

  if (command === 'date') {
    insertDateSyntax()
    return
  }

  if (command === 'emphasis') {
    insertEmphasisSyntax()
    return
  }

  if (command === 'page-break') {
    insertManualPageBreak()
  }
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

const handleRecoverMissingFile = async () => {
  const recovered = await store.saveMissingFileAs(recoveryFileName.value)
  if (recovered) {
    recoveryFileName.value = ''
  }
}

const handleOpenOtherFile = async () => {
  await store.openFirstAvailableFile()
  if (store.activeFileStatus !== 'missing') {
    recoveryFileName.value = ''
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
      editableCompartment.of(EditorView.editable.of(true)),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      editorViewModeCompartment.of(createEditorViewModeExtension()),
      renderDecorationsCompartment.of(createRenderDecorationsExtension()),
      sourcePageBreakDecorations,
      syntaxHighlighting(markdownHighlightStyle),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          syncCurrentLineFormat(update.state)
          syncTextSelection(update.state)
        }

        if (!update.docChanged) {
          return
        }

        store.updateMarkdownContent(update.state.doc.toString(), !isExternalUpdate)
        if (isExternalUpdate) {
          return
        }

        scheduleAutoSave()
      }),
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'transparent' },
        '.cm-scroller': {
          overflow: 'auto',
          padding: '2rem',
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
          scrollbarGutter: 'stable',
        },
        '.cm-scroller::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '.cm-scroller::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '.cm-scroller::-webkit-scrollbar-thumb': {
          backgroundColor: 'color-mix(in srgb, var(--color-surface-variant) 18%, transparent)',
          borderRadius: '999px',
        },
        '&:hover .cm-scroller, &:focus-within .cm-scroller': {
          scrollbarColor: 'var(--color-surface-variant) transparent',
        },
        '&:hover .cm-scroller::-webkit-scrollbar-thumb, &:focus-within .cm-scroller::-webkit-scrollbar-thumb': {
          backgroundColor: 'var(--color-surface-variant)',
        },
        '.cm-content': {
          fontFamily: 'var(--font-body), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
          color: 'var(--color-on-surface-variant)',
        },
        '&.cm-editor-source .cm-line.cm-md-source-page-break-line': {
          color: 'var(--color-primary)',
          fontWeight: '600',
        },
        '&.cm-editor-render .cm-content': {
          fontFamily: 'var(--font-body), "PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: '15px',
          lineHeight: '1.8',
          color: 'var(--color-on-surface)',
        },
        '&.cm-editor-render .cm-line': {
          paddingTop: '0.12rem',
          paddingBottom: '0.12rem',
        },
        '&.cm-editor-render .cm-line.cm-md-render-heading': {
          color: 'var(--color-primary)',
          fontWeight: '700',
          lineHeight: '1.35',
        },
        '&.cm-editor-render .cm-line.cm-md-render-heading-1': {
          fontSize: '1.7rem',
        },
        '&.cm-editor-render .cm-line.cm-md-render-heading-2': {
          fontSize: '1.35rem',
        },
        '&.cm-editor-render .cm-line.cm-md-render-heading-3, &.cm-editor-render .cm-line.cm-md-render-heading-4': {
          fontSize: '1.1rem',
        },
        '&.cm-editor-render .cm-line.cm-md-render-quote': {
          marginLeft: '0.15rem',
          paddingLeft: '0.95rem',
          borderLeft: '3px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
          color: 'color-mix(in srgb, var(--color-primary) 74%, var(--color-on-surface-variant) 26%)',
          fontStyle: 'italic',
        },
        '&.cm-editor-render .cm-md-render-list-marker': {
          display: 'inline-flex',
          minWidth: '1.45rem',
          marginRight: '0.15rem',
          justifyContent: 'center',
          color: 'var(--color-primary)',
          fontWeight: '600',
        },
        '&.cm-editor-render .cm-md-render-list-marker-ordered': {
          justifyContent: 'flex-end',
        },
        '&.cm-editor-render .cm-md-render-strong': {
          fontWeight: '700',
          color: 'var(--color-on-surface)',
        },
        '&.cm-editor-render .cm-md-render-emphasis': {
          fontStyle: 'italic',
          color: 'var(--color-on-surface)',
        },
        '&.cm-editor-render .cm-md-render-link': {
          color: 'var(--color-primary)',
          textDecoration: 'underline',
          textDecorationColor: 'color-mix(in srgb, var(--color-primary) 55%, transparent)',
        },
        '&.cm-editor-render .cm-md-render-inline-code': {
          paddingInline: '0.32rem',
          paddingBlock: '0.08rem',
          borderRadius: '0.4rem',
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: 'var(--color-on-surface)',
        },
        '&.cm-editor-render .cm-line.cm-md-render-page-break-line': {
          textAlign: 'center',
        },
        '&.cm-editor-render .cm-md-render-page-break-chip': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)',
          fontSize: '0.75rem',
          fontWeight: '600',
          letterSpacing: '0.08em',
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

  syncEditorReadOnly()
  syncRecoveryFileName()
  syncCurrentLineFormat(view.state)
  syncTextSelection(view.state)
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

watch(
  () => store.markdownContent,
  (newVal) => {
    if (!view || view.state.doc.toString() === newVal) {
      return
    }

    isExternalUpdate = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal },
    })
    isExternalUpdate = false
  },
)

watch(
  () => store.activeFileStatus,
  () => {
    syncEditorReadOnly()
    syncRecoveryFileName()
  },
)

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
  <EditorShell
    v-model:recovery-file-name="recoveryFileName"
    :has-active-file="hasActiveFile"
    :has-alternative-files="hasAlternativeFiles"
    :is-missing-file="isMissingFile"
    @open-other-file="handleOpenOtherFile"
    @recover-missing-file="handleRecoverMissingFile"
  >
    <template #toolbar>
      <EditorToolbar
        :current-line-format="currentLineFormat"
        :has-active-file="hasActiveFile"
        :has-copied-markdown="hasCopiedMarkdown"
        :has-text-selection="hasTextSelection"
        :is-formatting-disabled="isFormattingDisabled"
        :is-render-view="isRenderView"
        @apply-line-format="applyCurrentLineFormat"
        @copy-markdown="copyMarkdown"
        @insert-command="handleInsertCommand"
        @insert-emphasis="insertEmphasisSyntax"
        @toggle-bold="toggleInlineSyntax('**')"
        @toggle-italic="toggleInlineSyntax('*')"
        @toggle-view="toggleEditorView"
      />
    </template>

    <div ref="editorContainer" class="custom-scrollbar h-full w-full"></div>
  </EditorShell>
</template>

<style>

.editor-render-content .manual-page-break {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  margin: 1.4rem 0;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-container-lowest));
  color: var(--color-primary);
}

.editor-render-content .manual-page-break::before {
  content: "分页符";
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}
</style>
