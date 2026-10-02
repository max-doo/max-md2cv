<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useResumeStore } from '@resume-store'
import { useDebounceFn } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { renderResume } from '../../packages/resume-renderer/src'
import PreviewToolbar from './preview/PreviewToolbar.vue'
import {
  interpolateOnePageValues,
  relaxOnePageCandidate,
  resolveTemplateValues,
  type ResumeTemplate,
} from '@resume-core'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
let activeRenderPromise: Promise<void> | null = null
let pendingRenderRequest: PreviewRenderRequest | null = null
let renderDebounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingPreviewPromise: Promise<void> | null = null
let resolvePendingPreviewPromise: (() => void) | null = null
let pendingPreviewRenderToken: number | null = null
let lastRenderSucceeded = false

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const getPreviewLayoutWidth = () =>
  previewScrollContainer.value?.clientWidth
  ?? Math.round(previewContainer.value?.getBoundingClientRect().width ?? 0)

const waitForStablePreviewLayout = async (stableFrameTarget = 3) => {
  let stableFrames = 0
  let lastWidth = -1

  while (stableFrames < stableFrameTarget) {
    await waitForNextPaint()
    const currentWidth = getPreviewLayoutWidth()

    if (!currentWidth) {
      stableFrames = 0
      continue
    }

    if (Math.abs(currentWidth - lastWidth) < 1) {
      stableFrames += 1
    } else {
      lastWidth = currentWidth
      stableFrames = 0
    }
  }
}

const zoomLevel = ref(100)
const zoomIn = () => { if (zoomLevel.value < 200) zoomLevel.value += 10 }
const zoomOut = () => { if (zoomLevel.value > 50) zoomLevel.value -= 10 }

const totalPages = ref(0)
interface PreviewRenderRequest {
  markdownText: string
  templateDefinition: ResumeTemplate
  photoBase64: string | null
  values: ReturnType<typeof resolveTemplateValues>
}

const createPreviewStagingContainer = () => {
  const stagingContainer = document.createElement('div')
  const previewWidth = previewContainer.value?.getBoundingClientRect().width
    ?? previewScrollContainer.value?.clientWidth
    ?? window.innerWidth

  stagingContainer.className = 'pagedjs-wrapper'
  stagingContainer.setAttribute('aria-hidden', 'true')
  stagingContainer.style.position = 'fixed'
  stagingContainer.style.left = '-100000px'
  stagingContainer.style.top = '0'
  stagingContainer.style.visibility = 'hidden'
  stagingContainer.style.pointerEvents = 'none'
  stagingContainer.style.zIndex = '-1'
  stagingContainer.style.width = `${previewWidth}px`

  document.body.appendChild(stagingContainer)

  return stagingContainer
}

const beginPendingPreviewRender = () => {
  if (pendingPreviewPromise && pendingPreviewRenderToken !== null) {
    return pendingPreviewRenderToken
  }

  pendingPreviewPromise = new Promise<void>((resolve) => {
    resolvePendingPreviewPromise = resolve
  })
  pendingPreviewRenderToken = store.startPreviewRender(pendingPreviewPromise)

  return pendingPreviewRenderToken
}

const settlePendingPreviewRender = (token: number, isReady: boolean) => {
  if (pendingPreviewRenderToken !== token) {
    return
  }

  const resolve = resolvePendingPreviewPromise
  pendingPreviewPromise = null
  resolvePendingPreviewPromise = null
  pendingPreviewRenderToken = null
  resolve?.()
  store.finishPreviewRender(token, isReady)
}

onMounted(async () => {
  if (!store.templatesLoaded) {
    await store.loadTemplates()
  }
  await waitForStablePreviewLayout()
  queuePreviewRender(store.markdownContent)

  if (previewContainer.value) {
    previewContainer.value.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.resume-photo-wrapper')) {
        store.importIdPhoto()
      }
    })
  }
})
const createPreviewRenderRequest = (markdownText: string): PreviewRenderRequest => {
  const activeTemplateData =
    store.availableTemplates.find(t => t.id === store.activeTemplate)
    ?? store.currentTemplate
    ?? {
      id: store.activeTemplate,
      name: store.activeTemplate,
      version: '1.0.0',
      entryCss: 'style.css',
      css: '',
      defaults: {},
      editorSchema: [],
    }
  const resolvedTemplateValues = resolveTemplateValues(activeTemplateData, store.templateValues)

  return {
    markdownText,
    templateDefinition: activeTemplateData,
    photoBase64: store.photoBase64,
    values: resolvedTemplateValues,
  }
}

const renderPdfPreview = async (request: PreviewRenderRequest) => {
  if (!previewContainer.value) return false

  const scrollContainer = previewScrollContainer.value
  const preservedScrollTop = scrollContainer?.scrollTop ?? 0
  const preservedScrollLeft = scrollContainer?.scrollLeft ?? 0
  const stagingContainer = createPreviewStagingContainer()
  let renderSucceeded = false
  try {
    await waitForStablePreviewLayout()
    const renderResult = await renderResume({
      markdown: request.markdownText,
      documentTitle: 'Preview',
      template: request.templateDefinition,
      values: request.values,
      photoDataUrl: request.photoBase64,
      sourceDirectory: null,
      options: {
        strictFonts: false,
        allowNetwork: false,
        timeoutMs: 30_000,
        showPhotoPlaceholder: true,
      },
    }, stagingContainer)

    previewContainer.value.replaceChildren(...Array.from(stagingContainer.childNodes))
    totalPages.value = renderResult.pageCount
    renderSucceeded = totalPages.value > 0
  } catch (err) {
    console.error('Paged.js rendering error:', err)
    totalPages.value = 0
  } finally {
    stagingContainer.remove()

    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer.scrollTo({
          top: preservedScrollTop,
          left: preservedScrollLeft,
          behavior: 'auto'
        })
      })
    }
  }

  return renderSucceeded
}

const schedulePreviewRender = (markdownText: string) => {
  if (!store.templatesLoaded) {
    return null
  }

  pendingRenderRequest = createPreviewRenderRequest(markdownText)

  if (activeRenderPromise) {
    return activeRenderPromise
  }

  activeRenderPromise = (async () => {
    let latestRenderSucceeded = false

    while (pendingRenderRequest) {
      const request = pendingRenderRequest
      pendingRenderRequest = null
      latestRenderSucceeded = await renderPdfPreview(request)
    }

    lastRenderSucceeded = latestRenderSucceeded
  })().finally(() => {
    activeRenderPromise = null
  })

  return activeRenderPromise
}

const queuePreviewRender = (text: string) => {
  if (!store.templatesLoaded) {
    return
  }

  const token = beginPendingPreviewRender()

  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }

  renderDebounceTimer = setTimeout(() => {
    renderDebounceTimer = null
    const renderPromise = schedulePreviewRender(text)

    if (!renderPromise) {
      settlePendingPreviewRender(token, false)
      return
    }

    void renderPromise.finally(() => {
      queueMicrotask(() => {
        if (renderDebounceTimer || activeRenderPromise || pendingRenderRequest) {
          return
        }

        settlePendingPreviewRender(token, lastRenderSucceeded)
      })
    })
  }, 500)
}

const persistRenderState = useDebounceFn(() => {
  void store.persistActiveFileRenderState()
}, 400)

watch(() => store.markdownContent, (newVal) => {
  queuePreviewRender(newVal)
})

watch(() => store.photoBase64, () => {
  queuePreviewRender(store.markdownContent)
})

watch(() => store.activeTemplate, () => {
  queuePreviewRender(store.markdownContent)
  persistRenderState()
})

watch(() => store.templateValues, () => {
  queuePreviewRender(store.markdownContent)
  persistRenderState()
}, { deep: true })

const isAutoFitting = ref(false)

const probeRenderPageCount = async (values: ReturnType<typeof resolveTemplateValues>): Promise<number> => {
  const baseRequest = createPreviewRenderRequest(store.markdownContent)
  const stagingContainer = createPreviewStagingContainer()
  try {
    const renderResult = await renderResume({
      markdown: baseRequest.markdownText,
      documentTitle: 'Probe',
      template: baseRequest.templateDefinition,
      values,
      photoDataUrl: baseRequest.photoBase64,
      sourceDirectory: null,
      options: {
        strictFonts: false,
        allowNetwork: false,
        timeoutMs: 15_000,
        showPhotoPlaceholder: true,
      },
    }, stagingContainer)
    return renderResult.pageCount
  } catch (err) {
    console.error('Probe render failed:', err)
    return 999
  } finally {
    stagingContainer.remove()
  }
}

const runSmartOnePage = async () => {
  if (isAutoFitting.value) return
  if (!store.templatesLoaded) return

  isAutoFitting.value = true
  try {
    const activeTemplateData =
      store.availableTemplates.find(t => t.id === store.activeTemplate)
      ?? store.currentTemplate
      ?? {
        id: store.activeTemplate,
        name: store.activeTemplate,
        version: '1.0.0',
        entryCss: 'style.css',
        css: '',
        defaults: {},
        editorSchema: [],
      }

    const currentEffectiveValues = resolveTemplateValues(activeTemplateData, store.templateValues)

    // 1. 快速检查极限最小参数配置 (lambda = 1.0)
    const minValues = interpolateOnePageValues(currentEffectiveValues, 1.0)
    const minPages = await probeRenderPageCount(minValues)

    if (minPages > 1) {
      // 极限压缩后依然超出 1 页，内容严重超量
      store.setTemplateValues(minValues)
      ElMessage.warning('内容超出单页上限，已呈现最紧凑排版，建议适当精简文字')
      return
    }

    // 2. 检查舒适上限配置 (lambda = 0.0)
    const maxValues = interpolateOnePageValues(currentEffectiveValues, 0.0)
    const maxPages = await probeRenderPageCount(maxValues)

    if (maxPages <= 1) {
      // 在最舒适舒展状态下就已经能放下单页（内容排得过紧时自动舒展撑满）
      store.setTemplateValues(maxValues)
      ElMessage.success('已自适应优化为饱满舒适单页排版')
      return
    }

    // 3. 在 [0.0, 1.0] 区间内进行 6 次二分探测，找到满足 <= 1 页的最大字号与最舒适间距
    let low = 0.0
    let high = 1.0
    let bestValues = minValues
    const iterations = 6

    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2
      const candidateValues = interpolateOnePageValues(currentEffectiveValues, mid)
      const pages = await probeRenderPageCount(candidateValues)

      if (pages <= 1) {
        bestValues = candidateValues
        high = mid
      } else {
        low = mid
      }
    }

    // 4. 留白回填补偿优化 (Relaxation / Vertical Redistribution)
    // 当内容成功收纳至单页后，若底部由于量子化分块留有较多空白，
    // 在保证依然 <= 1 页的前提下，将剩余空间逐级回填给行高与各级间距，消除底部突兀留白
    for (let r = 0; r < 4; r++) {
      const relaxedCandidate = relaxOnePageCandidate(bestValues, 1)
      if (
        relaxedCandidate.lineHeight === bestValues.lineHeight &&
        relaxedCandidate.paragraphSpacing === bestValues.paragraphSpacing &&
        relaxedCandidate.h2MarginTop === bestValues.h2MarginTop &&
        relaxedCandidate.h3MarginTop === bestValues.h3MarginTop
      ) {
        break
      }
      const pages = await probeRenderPageCount(relaxedCandidate)
      if (pages <= 1) {
        bestValues = relaxedCandidate
      } else {
        break
      }
    }

    store.setTemplateValues(bestValues)
    ElMessage.success('已通过智能算法自适应为最佳单页排版')
  } catch (error) {
    console.error('Smart fit to one page error:', error)
    ElMessage.error('智能一页处理失败，请重试')
  } finally {
    isAutoFitting.value = false
  }
}
</script>

<template>
  <section class="preview-pane-shell flex flex-col card-soft ghost-border shadow-ambient overflow-hidden relative">
    <!-- Preview Controls -->
    <PreviewToolbar :zoom-level="zoomLevel" @zoom-in="zoomIn" @zoom-out="zoomOut" />

    <!-- Scrollable Preview Area -->
    <div ref="previewScrollContainer" class="preview-scroll-area flex flex-1 justify-center overflow-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(225,226,232,0.86)_52%,_rgba(236,238,243,0.92)_100%)] px-8 py-9">
      <!-- Paged.js Render Container -->
      <div ref="previewContainer" data-preview-root="true" class="pagedjs-wrapper overflow-visible transition-transform duration-200" :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"></div>
    </div>

    <!-- Footer -->
    <div class="preview-footer h-10 shrink-0 flex items-center px-5 justify-between bg-surface-container-high/30 backdrop-blur-sm border-t border-outline-variant/10">
      <!-- Left: Actions -->
      <div class="flex items-center gap-3">
        <button
          @click="runSmartOnePage"
          :disabled="isAutoFitting"
          class="preview-smart-page-button text-xs flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="通过智能算法自适应为最佳单页排版"
        >
          <span v-if="isAutoFitting" class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[14px]">auto_fix_high</span>
          智能一页
        </button>
        <button
          v-if="store.workspacePath"
          @click="store.saveCurrentTemplate()"
          class="preview-reset-button text-xs flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          title="用当前样式覆盖模板默认值"
        >
          <span class="material-symbols-outlined text-[14px]">save</span>
          覆盖模板
        </button>
        <button
          @click="store.resetActiveFileRenderSettings()"
          class="preview-reset-button text-xs flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          title="恢复模板默认属性"
        >
          <span class="material-symbols-outlined text-[14px]">restart_alt</span>
          恢复默认
        </button>
      </div>

      <!-- Right: Page count -->
      <span class="text-[11px] text-on-surface-variant/60 select-none">
        <span v-if="totalPages > 0">共 {{ totalPages }} 页</span>
        <span v-else>渲染中...</span>
      </span>
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

.pagedjs_page:only-child .pagedjs_margin-bottom-right,
.pagedjs_page:first-child:last-child .pagedjs_margin-bottom-right,
.pagedjs_pages[data-page-count="1"] .pagedjs_margin-bottom-right {
  display: none !important;
  visibility: hidden !important;
}
</style>

<style scoped>
.preview-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
}

.preview-scroll-area::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.preview-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.preview-scroll-area::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-surface-variant) 18%, transparent);
  border-radius: 999px;
}

.preview-scroll-area:hover {
  scrollbar-color: var(--color-surface-variant) transparent;
}

.preview-scroll-area:hover::-webkit-scrollbar-thumb {
  background: var(--color-surface-variant);
}
</style>
