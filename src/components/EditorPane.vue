<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { useResumeStore } from '../stores/resume'

const editorContainer = ref<HTMLElement | null>(null)
const store = useResumeStore()
let view: EditorView | null = null

onMounted(() => {
  if (!editorContainer.value) return

  view = new EditorView({
    doc: store.markdownContent,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          store.markdownContent = update.state.doc.toString()
        }
      }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "transparent" },
        ".cm-scroller": { overflow: "auto", padding: "2rem" },
        ".cm-content": { 
          fontFamily: "var(--font-body), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", 
          fontSize: "14px",
          color: "var(--color-on-surface-variant)"
        },
        "&.cm-focused": { outline: "none" },
        ".cm-gutters": {
          backgroundColor: "transparent",
          color: "var(--color-outline-variant)",
          borderRight: "none"
        },
        ".cm-activeLineGutter": {
          backgroundColor: "transparent",
          color: "var(--color-primary)"
        }
      })
    ],
    parent: editorContainer.value,
  })
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
  }
})

watch(() => store.markdownContent, (newVal) => {
  if (view && view.state.doc.toString() !== newVal) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
  }
})

// Toolbar Actions (Simple implementation)
const insertSyntax = (prefix: string, suffix: string = '') => {
  if (!view) return
  const { from, to } = view.state.selection.main
  const text = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${prefix}${text}${suffix}` },
    selection: { anchor: from + prefix.length, head: from + prefix.length + text.length }
  })
  view.focus()
}
</script>

<template>
  <section class="flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
    <!-- Toolbar -->
    <div class="h-14 border-b border-outline-variant/10 flex items-center px-6 justify-between bg-surface-container-lowest/50 backdrop-blur-sm shrink-0">
      <div class="flex items-center gap-3">
        <button @click="insertSyntax('**', '**')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors" title="加粗">
          <span class="material-symbols-outlined text-xl">format_bold</span>
        </button>
        <button @click="insertSyntax('*', '*')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors" title="斜体">
          <span class="material-symbols-outlined text-xl">format_italic</span>
        </button>
        <button @click="insertSyntax('- ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors" title="列表">
          <span class="material-symbols-outlined text-xl">format_list_bulleted</span>
        </button>
        <button @click="insertSyntax('[', '](url)')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors" title="链接">
          <span class="material-symbols-outlined text-xl">link</span>
        </button>
        <div class="h-5 w-[1px] bg-outline-variant/20 mx-1"></div>
        <button @click="insertSyntax('> ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors" title="引用">
          <span class="material-symbols-outlined text-xl">format_quote</span>
        </button>
      </div>
      <div class="text-[10px] font-bold uppercase tracking-widest text-outline/60 bg-surface-container-low px-2 py-1 rounded">Markdown</div>
    </div>
    <!-- Editor Area -->
    <div class="flex-1 w-full bg-transparent overflow-hidden">
      <!-- CodeMirror 6 Mount Point -->
      <div ref="editorContainer" class="h-full w-full custom-scrollbar"></div>
    </div>
  </section>
</template>

