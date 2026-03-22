<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { marked } from 'marked'
import { Previewer } from 'pagedjs'
import { useResumeStore } from '../stores/resume'
import { useDebounceFn } from '@vueuse/core'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
let paged: any = null

const renderPdfPreview = async (markdownText: string) => {
  if (!previewContainer.value) return
  
  // Convert MD to HTML
  const htmlContent = await marked.parse(markdownText)
  
  // Create a temporary hidden container for Paged.js to read from
  const sourceDiv = document.createElement('div')
  sourceDiv.innerHTML = `<div class="resume-document">${htmlContent}</div>`
  
  // Paged.js caches processed stylesheets in document head, 
  // clear previous generated content safely
  previewContainer.value.innerHTML = ''
  
  paged = new Previewer()
  
  try {
    await paged.preview(sourceDiv, [], previewContainer.value)
  } catch (err) {
    console.error("Paged.js rendering error:", err)
  }
}

// Debounce the render function to avoid blocking the main thread while typing
const debouncedRender = useDebounceFn((text: string) => {
  renderPdfPreview(text)
}, 500)

onMounted(() => {
  renderPdfPreview(store.markdownContent)
})

watch(() => store.markdownContent, (newVal) => {
  debouncedRender(newVal)
})
</script>

<template>
  <section class="flex flex-col bg-surface-container rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden relative">
    <!-- Preview Controls -->
    <div class="h-14 shrink-0 flex items-center px-6 justify-between bg-surface-container-high/40 backdrop-blur-sm border-b border-outline-variant/10 z-10">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-on-surface-variant tracking-wider">现代简约 (默认)</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant transition-colors" title="打印/导出预览">
          <!-- Additional controls can go here -->
        </button>
      </div>
    </div>
    
    <!-- Scrollable Preview Area -->
    <div class="flex-1 overflow-auto custom-scrollbar p-10 bg-[#e7e8ee]/40 flex justify-center">
      <!-- Paged.js Render Container -->
      <div ref="previewContainer" class="pagedjs-wrapper overflow-visible"></div>
    </div>
  </section>
</template>

<style>
/* =========================================
   Paged.js Core Overrides
   These styles ensure Paged.js renders a 
   nice A4 paper shadow effect in the UI 
   ========================================= */

.pagedjs-wrapper {
  --color-paper: #ffffff;
  --color-bg: transparent;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pagedjs_pages {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.pagedjs_page {
  background-color: var(--color-paper);
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  flex-shrink: 0;
}

@page {
  size: A4;
  margin: 15mm 20mm;
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-size: 10px;
    color: #c7c4d6;
    font-family: 'Manrope', sans-serif;
    letter-spacing: 0.1em;
  }
}

/* =========================================
   Resume Document Styling (Modern Minimal)
   ========================================= */

.resume-document {
  color: var(--color-on-surface);
  line-height: 1.6;
  font-family: var(--font-body);
}

.resume-document h1 {
  font-size: 1.875rem; 
  font-weight: 800;
  letter-spacing: -0.025em;
  margin-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 1.5rem;
}

.resume-document h2 {
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-primary);
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.resume-document h3 {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.resume-document ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  color: var(--color-on-surface-variant);
  margin-bottom: 1rem;
}

.resume-document p {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}
</style>
