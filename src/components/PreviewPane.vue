<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Previewer } from 'pagedjs'
import { useResumeStore, type ResumeStyle } from '../stores/resume'
import { useDebounceFn } from '@vueuse/core'
import { enhanceResumeHtml } from '../utils/resumeParser'
import { pingFangFontFaceCss } from '../utils/fontAssets'
import { renderMarkdownToHtml } from '../utils/markdownRender'
import PreviewToolbar from './preview/PreviewToolbar.vue'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
let paged: any = null
let activeRenderPromise: Promise<void> | null = null
let pendingRenderRequest: PreviewRenderRequest | null = null

const zoomLevel = ref(100)
const zoomIn = () => { if (zoomLevel.value < 200) zoomLevel.value += 10 }
const zoomOut = () => { if (zoomLevel.value > 50) zoomLevel.value -= 10 }

const totalPages = ref(0)
interface PreviewRenderRequest {
  markdownText: string
  templateId: string
  cssText: string
  cvStyle: ResumeStyle
  photoBase64: string | null
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

onMounted(async () => {
  await store.loadTemplates()
  schedulePreviewRender(store.markdownContent)

  if (previewContainer.value) {
    previewContainer.value.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.resume-photo-wrapper')) {
        store.importIdPhoto()
      }
    })
  }
})
// ─── Resume Fonts ────────────────────────────────────────────────────────────
// Fixed set of common Chinese and English resume fonts
const buildPreviewStyles = (cvStyle: ResumeStyle): string => `
  ${pingFangFontFaceCss}
  @page {
    size: A4;
    margin: ${cvStyle.marginV}mm ${cvStyle.marginH}mm;
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-size: 10px;
      color: #c7c4d6;
      font-family: 'Manrope', sans-serif;
      letter-spacing: 0.1em;
    }
  }
  .resume-document {
    --cv-photo-width: 90px;
    --cv-photo-height: 120px;
    --cv-photo-gap: 18px;
    --cv-photo-radius: 8px;
    --cv-photo-reserve: calc(var(--cv-photo-width) + var(--cv-photo-gap));
    --cv-theme-color: ${cvStyle.themeColor};
    --cv-font-size: ${cvStyle.fontSize}px;
    --cv-paragraph-spacing: ${cvStyle.paragraphSpacing}px;
    font-family: ${cvStyle.fontFamily} !important;
    font-size: ${cvStyle.fontSize}px !important;
    line-height: ${cvStyle.lineHeight} !important;
    position: relative !important;
    ${cvStyle.dateWeight ? `--cv-date-weight: ${cvStyle.dateWeight};` : ''}
    ${cvStyle.dateSize ? `--cv-date-size: ${cvStyle.dateSize}px;` : ''}
  }
  .resume-document > .resume-photo-wrapper {
    position: absolute !important;
    top: 0;
    right: 0;
    width: var(--cv-photo-width);
    height: var(--cv-photo-height);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    cursor: pointer;
    z-index: 10;
    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }
  .resume-document > .resume-photo-wrapper.is-empty {
    background-color: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: var(--cv-photo-radius);
    overflow: hidden;
  }
  .resume-document > .resume-photo-wrapper.is-empty:hover {
    border-color: ${cvStyle.themeColor};
    background-color: color-mix(in srgb, ${cvStyle.themeColor} 5%, #f8f9fa);
  }
  .resume-document > .resume-photo-wrapper.has-photo {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
    box-shadow: none;
  }
  .resume-document > .resume-photo-wrapper.has-photo:hover {
    background: transparent;
    border: none;
    box-shadow: none;
  }
  .resume-document > .resume-photo-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    filter: none !important;
    clip-path: none !important;
    background: transparent;
  }
  .resume-document > .resume-photo-wrapper.has-photo img {
    position: absolute;
    inset: 0;
  }
  .resume-document > .resume-photo-wrapper .photo-placeholder-text {
    color: #adb5bd;
    font-size: 12px;
    text-align: center;
    line-height: 1.2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
  }
  .resume-document > .resume-photo-wrapper + *,
  .resume-document > .resume-photo-wrapper + * + *,
  .resume-document > .resume-photo-wrapper + * + * + * {
    padding-right: var(--cv-photo-reserve) !important;
    box-sizing: border-box;
  }
  .resume-document h1 {
    font-size: ${cvStyle.h1Size}px !important;
    color: ${cvStyle.themeColor} !important;
    border-color: ${cvStyle.themeColor} !important;
  }
  .resume-document h2 {
    font-size: ${cvStyle.h2Size}px !important;
    color: ${cvStyle.themeColor} !important;
    border-bottom-color: ${cvStyle.themeColor} !important;
    border-left-color: ${cvStyle.themeColor} !important;
  }
  .resume-document h3 {
    font-size: ${cvStyle.h3Size}px !important;
    color: ${cvStyle.themeColor} !important;
  }
  .resume-document .experience-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .resume-document h3.experience-line {
    align-items: flex-end;
  }
  .resume-document .experience-title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .resume-document .experience-date {
    font-size: var(--cv-date-size, inherit);
    font-weight: var(--cv-date-weight, inherit);
    flex-shrink: 0;
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }
  .resume-document p,
  .resume-document ul,
  .resume-document ol,
  .resume-document .job-intention + p,
  .resume-document .contact-info--text,
  .resume-document .contact-info-text-line,
  .resume-document .contact-info--icon,
  .resume-document .contact-info-item {
    font-size: var(--cv-font-size) !important;
  }
  .resume-document blockquote {
    font-size: calc(var(--cv-font-size) * 0.9) !important;
  }
  .resume-document p,
  .resume-document ul,
  .resume-document ol,
  .resume-document blockquote {
    margin-bottom: var(--cv-paragraph-spacing);
  }
  .resume-document .manual-page-break {
    break-before: page;
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
`

const createPreviewRenderRequest = (markdownText: string): PreviewRenderRequest => {
  const activeTemplateData = store.availableTemplates.find(t => t.id === store.activeTemplate)

  return {
    markdownText,
    templateId: store.activeTemplate,
    cssText: activeTemplateData?.css ?? '',
    cvStyle: { ...store.resumeStyle },
    photoBase64: store.photoBase64,
  }
}

const renderPdfPreview = async (request: PreviewRenderRequest) => {
  if (!previewContainer.value) return

  const scrollContainer = previewScrollContainer.value
  const preservedScrollTop = scrollContainer?.scrollTop ?? 0
  const preservedScrollLeft = scrollContainer?.scrollLeft ?? 0
  const previousPagedStyles = Array.from(document.querySelectorAll('style[data-pagedjs-inserted-styles]'))
  const previousPagedStyleSet = new Set(previousPagedStyles)
  const stagingContainer = createPreviewStagingContainer()
  let renderSucceeded = false

  const htmlContent = await renderMarkdownToHtml(request.markdownText)
  const cvStyle = request.cvStyle

  const injectCss = buildPreviewStyles(cvStyle)
  const stylesheetSources = [
    { [`${window.location.href}#template-${request.templateId}`]: request.cssText },
    { [`${window.location.href}#runtime-preview`]: injectCss }
  ]

  const photoHtml = `
    <div class="resume-photo-wrapper" title="点击上传证件照 (最大1MB)">
      ${request.photoBase64 ? `<img src="${request.photoBase64}" />` : '<div class="photo-placeholder-text"><span class="material-symbols-outlined" style="font-size: 24px; margin-bottom: 4px;">add_a_photo</span><br/><span>添加证件照</span></div>'}
    </div>
  `

  const finalHtml = enhanceResumeHtml(htmlContent, cvStyle, request.templateId)

  const sourceDiv = document.createElement('div')
  sourceDiv.innerHTML = `<div class="resume-document">${photoHtml}${finalHtml}</div>`
  const photoWrapper = sourceDiv.querySelector('.resume-photo-wrapper')
  photoWrapper?.classList.add(request.photoBase64 ? 'has-photo' : 'is-empty')

  paged = new Previewer()

  try {
    await paged.preview(sourceDiv, stylesheetSources, stagingContainer)

    previewContainer.value.replaceChildren(...Array.from(stagingContainer.childNodes))
    previousPagedStyles.forEach(el => el.remove())

    // Count rendered pages
    totalPages.value = previewContainer.value?.querySelectorAll('.pagedjs_page').length ?? 0
    renderSucceeded = true
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
}

const schedulePreviewRender = (markdownText: string) => {
  pendingRenderRequest = createPreviewRenderRequest(markdownText)

  if (activeRenderPromise) {
    return activeRenderPromise
  }

  activeRenderPromise = (async () => {
    while (pendingRenderRequest) {
      const request = pendingRenderRequest
      pendingRenderRequest = null
      await renderPdfPreview(request)
    }
  })().finally(() => {
    activeRenderPromise = null
  })

  return activeRenderPromise
}

const debouncedRender = useDebounceFn((text: string) => {
  schedulePreviewRender(text)
}, 500)

const persistRenderState = useDebounceFn(() => {
  void store.persistActiveFileRenderState()
}, 400)

watch(() => store.markdownContent, (newVal) => {
  debouncedRender(newVal)
})

watch(() => store.photoBase64, () => {
  debouncedRender(store.markdownContent)
})

watch(() => store.activeTemplate, () => {
  debouncedRender(store.markdownContent)
  persistRenderState()
})

watch(() => store.resumeStyle, () => {
  debouncedRender(store.markdownContent)
  persistRenderState()
}, { deep: true })
</script>

<template>
  <section class="flex flex-col card-soft ghost-border shadow-ambient overflow-hidden relative">
    <!-- Preview Controls -->
    <PreviewToolbar :zoom-level="zoomLevel" @zoom-in="zoomIn" @zoom-out="zoomOut" />

    <!-- Scrollable Preview Area -->
    <div ref="previewScrollContainer" class="preview-scroll-area flex flex-1 justify-center overflow-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(225,226,232,0.86)_52%,_rgba(236,238,243,0.92)_100%)] px-8 py-9">
      <!-- Paged.js Render Container -->
      <div ref="previewContainer" class="pagedjs-wrapper overflow-visible transition-transform duration-200" :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"></div>
    </div>

    <!-- Footer -->
    <div class="h-10 shrink-0 flex items-center px-5 justify-between bg-surface-container-high/30 backdrop-blur-sm border-t border-outline-variant/10">
      <!-- Left: Reset + Save -->
      <div class="flex items-center gap-3">
        <button
          @click="store.resetActiveFileRenderSettings()"
          class="text-xs flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          title="恢复模板默认属性"
        >
          <span class="material-symbols-outlined text-[14px]">restart_alt</span>
          恢复默认
        </button>
        <el-popconfirm
        title="确定要覆盖保存当前模板吗？设置将持久化并覆盖原始属性。"
        confirm-button-text="确定保存"
        cancel-button-text="取消"
        confirm-button-type="primary"
        @confirm="store.persistActiveFileRenderState()"
        width="280"
      >
        <template #reference>
          <button class="text-xs flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span class="material-symbols-outlined text-[14px]">save</span>
            覆盖模板
          </button>
        </template>
      </el-popconfirm>
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
