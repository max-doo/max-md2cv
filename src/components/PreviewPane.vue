<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Previewer } from 'pagedjs'
import { useResumeStore } from '@resume-store'
import { useDebounceFn } from '@vueuse/core'
import { enhanceResumeHtml, resolveSectionType } from '../utils/resumeParser'
import { ensurePreviewFontsReady, pingFangFontFaceCss } from '../utils/fontAssets'
import { renderMarkdownToHtml } from '../utils/markdownRender'
import { buildRuntimeResumeStyleCss } from '../utils/runtimeResumeStyle'
import PreviewToolbar from './preview/PreviewToolbar.vue'
import {
  resolvePhotoAdjustments,
  resolveTemplateValues,
  type PersonalInfoMode,
  type TemplateHeaderLayout,
  type TemplatePhotoPlacement,
  type TemplateSectionTitlePreset,
  type PhotoAdjustments,
  type ResumeStyle,
  type ResumeTemplate,
} from '@resume-core'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
let paged: any = null
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
  templateId: string
  cssText: string
  cvStyle: ResumeStyle
  templateDefinition: ResumeTemplate
  layoutConfig: {
    headerLayout: TemplateHeaderLayout
    personalInfoMode: PersonalInfoMode
    photoPlacement: TemplatePhotoPlacement
    sectionTitlePreset: TemplateSectionTitlePreset
  }
  photoAdjustments: PhotoAdjustments
  photoBase64: string | null
}

const applyResumeDocumentLayoutHooks = (
  documentRoot: HTMLElement,
  layoutConfig: PreviewRenderRequest['layoutConfig'],
  photoVisible: boolean,
) => {
  documentRoot.dataset.headerLayout = layoutConfig.headerLayout
  documentRoot.dataset.personalInfoMode = layoutConfig.personalInfoMode
  documentRoot.dataset.photoPlacement = layoutConfig.photoPlacement
  documentRoot.dataset.photoVisible = photoVisible ? 'true' : 'false'
  documentRoot.dataset.sectionTitlePreset = layoutConfig.sectionTitlePreset

  const photoWrapper = documentRoot.querySelector(':scope > .resume-photo-wrapper') as HTMLElement | null
  const primaryTitle = documentRoot.querySelector(':scope > h1') as HTMLElement | null
  const personalHeader = documentRoot.querySelector(':scope > .personal-header') as HTMLElement | null

  if (!photoWrapper && !primaryTitle && !personalHeader) {
    return null
  }

  const headerWrapper = document.createElement('div')
  headerWrapper.className = 'resume-header'

  const headerBody = document.createElement('div')
  headerBody.className = 'resume-header-body'

  const headerMain = document.createElement('div')
  headerMain.className = 'resume-header-main'

  const headerMeta = document.createElement('div')
  headerMeta.className = 'resume-header-meta'

  const headerPhoto = document.createElement('div')
  headerPhoto.className = 'resume-header-photo'

  if (primaryTitle) {
    headerMain.appendChild(primaryTitle)
  }

  if (personalHeader) {
    headerMeta.appendChild(personalHeader)
  }

  if (headerMain.childElementCount > 0) {
    headerBody.appendChild(headerMain)
  }

  if (headerMeta.childElementCount > 0) {
    headerBody.appendChild(headerMeta)
  }

  if (headerBody.childElementCount > 0) {
    headerWrapper.appendChild(headerBody)
  }

  if (photoWrapper) {
    headerPhoto.appendChild(photoWrapper)
    headerWrapper.appendChild(headerPhoto)
  }

  documentRoot.prepend(headerWrapper)

  if (
    photoWrapper &&
    photoVisible &&
    layoutConfig.photoPlacement !== 'header-right' &&
    layoutConfig.photoPlacement !== 'hidden'
  ) {
    headerBody.classList.add('dodge-photo')
  }

  return {
    photoWrapper,
    headerBody,
  }
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
  const rawTemplateValues = store.templateValues
  const resolvedTemplateValues = resolveTemplateValues(activeTemplateData, store.templateValues)

  return {
    markdownText,
    templateId: store.activeTemplate,
    cssText: activeTemplateData?.css ?? '',
    cvStyle: { ...store.resumeStyle },
    templateDefinition: activeTemplateData,
    layoutConfig: {
      headerLayout: String(
        rawTemplateValues.headerLayout
          ?? activeTemplateData.layout?.headerLayout
          ?? activeTemplateData.defaults?.headerLayout
          ?? 'stack',
      ) as TemplateHeaderLayout,
      personalInfoMode: String(
        rawTemplateValues.personalInfoMode
          ?? activeTemplateData.layout?.personalInfoMode
          ?? activeTemplateData.defaults?.personalInfoMode
          ?? store.resumeStyle.personalInfoMode
          ?? 'text',
      ) as PersonalInfoMode,
      photoPlacement: String(
        rawTemplateValues.photoPlacement
          ?? activeTemplateData.layout?.photoPlacement
          ?? activeTemplateData.defaults?.photoPlacement
          ?? 'top-right',
      ) as TemplatePhotoPlacement,
      sectionTitlePreset: String(
        rawTemplateValues.sectionTitlePreset
          ?? activeTemplateData.layout?.sectionTitlePreset
          ?? activeTemplateData.defaults?.sectionTitlePreset
          ?? 'accent-bar',
      ) as TemplateSectionTitlePreset,
    },
    photoAdjustments: resolvePhotoAdjustments(resolvedTemplateValues),
    photoBase64: store.photoBase64,
  }
}

const renderPdfPreview = async (request: PreviewRenderRequest) => {
  if (!previewContainer.value) return false

  const scrollContainer = previewScrollContainer.value
  const preservedScrollTop = scrollContainer?.scrollTop ?? 0
  const preservedScrollLeft = scrollContainer?.scrollLeft ?? 0
  const previousPagedStyles = Array.from(document.querySelectorAll('style[data-pagedjs-inserted-styles]'))
  const previousPagedStyleSet = new Set(previousPagedStyles)
  const stagingContainer = createPreviewStagingContainer()
  let renderSucceeded = false

  const htmlContent = await renderMarkdownToHtml(request.markdownText)
  const cvStyle = request.cvStyle
  await ensurePreviewFontsReady(cvStyle.fontFamily, cvStyle.fontSize)
  await waitForStablePreviewLayout()

  const injectCss = buildRuntimeResumeStyleCss(cvStyle, {
    extraCss: pingFangFontFaceCss,
    photoAdjustments: request.photoAdjustments,
  })
  const stylesheetSources = [
    { [`${window.location.href}#template-${request.templateId}`]: request.cssText },
    { [`${window.location.href}#runtime-preview`]: injectCss }
  ]

  const photoHtml = `
    <div class="resume-photo-wrapper" title="点击上传证件照 (最大1MB)">
      ${request.photoBase64 ? `<img src="${request.photoBase64}" />` : '<div class="photo-placeholder-text"><span class="material-symbols-outlined" style="font-size: 24px; margin-bottom: 4px;">add_a_photo</span><br/><span>添加证件照</span></div>'}
    </div>
  `

  const finalHtml = enhanceResumeHtml(
    htmlContent,
    {
      ...cvStyle,
      personalInfoMode: request.layoutConfig.personalInfoMode,
    },
    request.templateId,
  )

  const sourceDiv = document.createElement('div')
  sourceDiv.innerHTML = `<div class="resume-document">${photoHtml}${finalHtml}</div>`

  const documentRoot = sourceDiv.querySelector('.resume-document') as HTMLElement | null
  if (!documentRoot) {
    return false
  }

  const headerHooks = applyResumeDocumentLayoutHooks(
    documentRoot,
    request.layoutConfig,
    request.photoAdjustments.visible,
  )

  if (headerHooks?.photoWrapper) {
    headerHooks.photoWrapper.classList.add(
      request.photoBase64 ? 'has-photo' : 'is-empty',
      `photo-placement-${request.layoutConfig.photoPlacement}`,
    )
  }

  paged = new Previewer()

  // Suppress non-fatal Paged.js internal errors (e.g. null getAttribute in findElement)
  const suppressPagedjsErrors = (event: ErrorEvent) => {
    const src = event.filename ?? ''
    if (src.includes('dom.js') || src.includes('layout.js') || src.includes('page.js')) {
      event.preventDefault()
      return true
    }
  }
  window.addEventListener('error', suppressPagedjsErrors)

  try {
    await paged.preview(sourceDiv, stylesheetSources, stagingContainer)

    previewContainer.value.replaceChildren(...Array.from(stagingContainer.childNodes))
    previousPagedStyles.forEach(el => el.remove())

    // Patch h2 section classes that may be lost during Paged.js rendering
    previewContainer.value.querySelectorAll('.resume-document h2').forEach((h2) => {
      const hasSection = Array.from(h2.classList).some((c) => c.startsWith('section-'))
      if (hasSection) return
      const plainText = (h2.textContent ?? '').trim()
      const sectionDef = resolveSectionType(plainText)
      h2.classList.add(sectionDef ? `section-${sectionDef.key}` : 'section-default')
    })

    // Count rendered pages
    totalPages.value = previewContainer.value?.querySelectorAll('.pagedjs_page').length ?? 0
    renderSucceeded = totalPages.value > 0
  } catch (err) {
    console.error('Paged.js rendering error:', err)
    totalPages.value = 0
  } finally {
    if (!renderSucceeded) {
      const currentPagedStyles = Array.from(document.querySelectorAll('style[data-pagedjs-inserted-styles]'))
      currentPagedStyles
        .filter(el => !previousPagedStyleSet.has(el))
        .forEach(el => el.remove())
    }

    window.removeEventListener('error', suppressPagedjsErrors)
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
      <!-- Left: Reset -->
      <div class="flex items-center gap-3">
        <button
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
