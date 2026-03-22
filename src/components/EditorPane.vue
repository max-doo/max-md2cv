<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useResumeStore } from '../stores/resume'

const editorContainer = ref<HTMLElement | null>(null)
const store = useResumeStore()
let view: EditorView | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
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
    fontWeight: '600',
    textDecoration: 'none',
  },
])
/** 标志位：当前 dispatch 是由外部（watch/openFile）触发的，不应触发自动保存 */
let isExternalUpdate = false

/** 防抖自动保存：停止输入 1 秒后保存文件 */
const scheduleAutoSave = () => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    if (store.activeFilePath) {
      await store.saveCurrentFile(true) // silent: 自动保存不弹通知
    }
    autoSaveTimer = null
  }, 1000)
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
        if (update.docChanged) {
          store.markdownContent = update.state.doc.toString()
          // 只有用户真实输入才触发自动保存，外部赋值跳过
          if (!isExternalUpdate) {
            scheduleAutoSave()
          }
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

onBeforeUnmount(async () => {
  // 销毁前确保当前内容已保存
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (store.activeFilePath) {
    await store.saveCurrentFile(true) // silent: 销毁时静默保存
  }
  if (view) {
    view.destroy()
  }
})

watch(() => store.markdownContent, (newVal) => {
  if (view && view.state.doc.toString() !== newVal) {
    isExternalUpdate = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
    isExternalUpdate = false
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
  <section class="flex flex-col card-soft ghost-border shadow-ambient overflow-hidden h-full relative">
    <!-- Empty State Overlay -->
    <transition name="fade">
      <div v-if="!store.activeFilePath" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm">
        <div class="p-8 rounded-[2rem] bg-surface-container-high text-on-surface-variant/40 mb-4 ring-1 ring-outline-variant/10 shadow-inner border border-white/5">
          <span class="material-symbols-outlined text-4xl">edit_note</span>
        </div>
        <p class="text-on-surface text-sm font-semibold tracking-wide">选择或创建一个文件</p>
        <p class="text-[11px] text-on-surface-variant/60 mt-2 font-medium">开启你的简历编辑之旅</p>
      </div>
    </transition>

    <!-- Toolbar -->
    <div 
      class="h-14 border-b border-outline-variant/10 flex items-center px-6 justify-between bg-surface-container-lowest/50 backdrop-blur-sm shrink-0 transition-all duration-300"
      :class="{ 'opacity-20 grayscale pointer-events-none': !store.activeFilePath }"
    >
      <div class="flex items-center gap-3">
        <button @click="insertSyntax('**', '**')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="加粗">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_bold</span>
        </button>
        <button @click="insertSyntax('*', '*')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="斜体">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_italic</span>
        </button>
        <button @click="insertSyntax('- ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="列表">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_list_bulleted</span>
        </button>
        <button @click="insertSyntax('[', '](url)')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="链接">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">link</span>
        </button>
        <div class="h-5 w-[1px] bg-outline-variant/20 mx-1"></div>
        <button @click="insertSyntax('> ')" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors group" title="引用">
          <span class="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">format_quote</span>
        </button>
      </div>
      <div class="text-[10px] font-bold uppercase tracking-widest text-outline/60 bg-surface-container-low px-2 py-1 rounded">Markdown</div>
    </div>
    <!-- Editor Area -->
    <div 
      class="flex-1 w-full bg-transparent overflow-hidden transition-opacity duration-300"
      :class="{ 'opacity-0': !store.activeFilePath }"
    >
      <!-- CodeMirror 6 Mount Point -->
      <div ref="editorContainer" class="h-full w-full custom-scrollbar"></div>
    </div>
  </section>
</template>
