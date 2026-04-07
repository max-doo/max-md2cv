<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Previewer } from 'pagedjs'
import { useResumeStore } from '@resume-store'
import { useDebounceFn } from '@vueuse/core'
import { enhanceResumeHtml, resolveSectionType } from '../utils/resumeParser'
import { ensurePreviewFontsReady, pingFangFontFaceCss } from '../utils/fontAssets'
import { renderMarkdownToHtml } from '../utils/markdownRender'
import PreviewToolbar from './preview/PreviewToolbar.vue'
import type { ResumeStyle } from '@resume-core'

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
    --cv-h2-margin-top: ${cvStyle.h2MarginTop}px;
    --cv-h2-margin-bottom: ${cvStyle.h2MarginBottom}px;
    --cv-h3-margin-top: ${cvStyle.h3MarginTop}px;
    --cv-h3-margin-bottom: ${cvStyle.h3MarginBottom}px;
    --cv-personal-header-spacing: ${cvStyle.personalHeaderSpacing}px;
    font-family: ${cvStyle.fontFamily} !important;
    font-size: ${cvStyle.fontSize}px !important;
    line-height: ${cvStyle.lineHeight} !important;
    position: relative !important;
    ${cvStyle.dateWeight ? `--cv-date-weight: ${cvStyle.dateWeight};` : ''}
    ${cvStyle.dateSize ? `--cv-date-size: ${cvStyle.dateSize}px;` : ''}
  }
  .resume-document .resume-photo-wrapper {
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
  .resume-document .resume-photo-wrapper.is-empty {
    background-color: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: var(--cv-photo-radius);
    overflow: hidden;
  }
  .resume-document > .resume-photo-wrapper.is-empty:hover {
    border-color: ${cvStyle.themeColor};
    background-color: color-mix(in srgb, ${cvStyle.themeColor} 5%, #f8f9fa);
  }
  .resume-document .resume-photo-wrapper.has-photo {
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
  .resume-document .resume-photo-wrapper img {
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
  .resume-document .resume-photo-wrapper.has-photo img {
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
  .resume-document .dodge-photo:not(h2) {
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
    margin-top: var(--cv-h2-margin-top) !important;
    margin-bottom: var(--cv-h2-margin-bottom) !important;
  }
  .resume-document h3 {
    font-size: ${cvStyle.h3Size}px !important;
    color: ${cvStyle.themeColor} !important;
    margin-top: var(--cv-h3-margin-top) !important;
    margin-bottom: var(--cv-h3-margin-bottom) !important;
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
  .resume-document p:not(.job-intention),
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
    margin-top: 0 !important;
    margin-bottom: var(--cv-paragraph-spacing) !important;
  }
  .resume-document li {
    margin-bottom: calc(var(--cv-paragraph-spacing) * 0.5) !important;
  }
  .resume-document .personal-header {
    margin-bottom: var(--cv-personal-header-spacing) !important;
  }
  .resume-document .contact-info--text,
  .resume-document .contact-info--icon,
  .resume-document .job-intention + p {
    margin-bottom: 0 !important;
  }
  .resume-document .contact-info-item::before {
    content: "";
    display: inline-block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    background-color: var(--cv-theme-color);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
  .resume-document .contact-info-item[data-icon="call"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="mail"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="location_on"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="cake"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="link_2"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="work"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="github"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8'/%3E%3C/svg%3E");
  }
  .resume-document .contact-info-item[data-icon="wechat"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.176 14.429c-2.665 0-4.826-1.8-4.826-4.018 0-2.22 2.159-4.02 4.824-4.02S16 8.191 16 10.411c0 1.21-.65 2.301-1.666 3.036a.32.32 0 0 0-.12.366l.218.81a.6.6 0 0 1 .029.117.166.166 0 0 1-.162.162.2.2 0 0 1-.092-.03l-1.057-.61a.5.5 0 0 0-.256-.074.5.5 0 0 0-.142.021 5.7 5.7 0 0 1-1.576.22M9.064 9.542a.647.647 0 1 0 .557-1 .645.645 0 0 0-.646.647.6.6 0 0 0 .09.353Zm3.232.001a.646.646 0 1 0 .546-1 .645.645 0 0 0-.644.644.63.63 0 0 0 .098.356'/%3E%3Cpath d='M0 6.826c0 1.455.781 2.765 2.001 3.656a.385.385 0 0 1 .143.439l-.161.6-.1.373a.5.5 0 0 0-.032.14.19.19 0 0 0 .193.193q.06 0 .111-.029l1.268-.733a.6.6 0 0 1 .308-.088q.088 0 .171.025a6.8 6.8 0 0 0 1.625.26 4.5 4.5 0 0 1-.177-1.251c0-2.936 2.785-5.02 5.824-5.02l.15.002C10.587 3.429 8.392 2 5.796 2 2.596 2 0 4.16 0 6.826m4.632-1.555a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0m3.875 0a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.176 14.429c-2.665 0-4.826-1.8-4.826-4.018 0-2.22 2.159-4.02 4.824-4.02S16 8.191 16 10.411c0 1.21-.65 2.301-1.666 3.036a.32.32 0 0 0-.12.366l.218.81a.6.6 0 0 1 .029.117.166.166 0 0 1-.162.162.2.2 0 0 1-.092-.03l-1.057-.61a.5.5 0 0 0-.256-.074.5.5 0 0 0-.142.021 5.7 5.7 0 0 1-1.576.22M9.064 9.542a.647.647 0 1 0 .557-1 .645.645 0 0 0-.646.647.6.6 0 0 0 .09.353Zm3.232.001a.646.646 0 1 0 .546-1 .645.645 0 0 0-.644.644.63.63 0 0 0 .098.356'/%3E%3Cpath d='M0 6.826c0 1.455.781 2.765 2.001 3.656a.385.385 0 0 1 .143.439l-.161.6-.1.373a.5.5 0 0 0-.032.14.19.19 0 0 0 .193.193q.06 0 .111-.029l1.268-.733a.6.6 0 0 1 .308-.088q.088 0 .171.025a6.8 6.8 0 0 0 1.625.26 4.5 4.5 0 0 1-.177-1.251c0-2.936 2.785-5.02 5.824-5.02l.15.002C10.587 3.429 8.392 2 5.796 2 2.596 2 0 4.16 0 6.826m4.632-1.555a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0m3.875 0a.77.77 0 1 1-1.54 0 .77.77 0 0 1 1.54 0'/%3E%3C/svg%3E");
  }
  .resume-document .personal-header {
    break-inside: avoid;
    box-sizing: border-box;
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
  
  // Add photo classes and dodging logic
  const photoWrapper = sourceDiv.querySelector('.resume-photo-wrapper')
  if (photoWrapper) {
    photoWrapper.classList.add(request.photoBase64 ? 'has-photo' : 'is-empty')
    // Mark siblings to dodge the photo area effectively even after DOM restructuring
    let sibling = photoWrapper.nextElementSibling
    for (let i = 0; i < 3 && sibling; i++) {
        sibling.classList.add('dodge-photo')
        sibling = sibling.nextElementSibling
    }
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

watch(() => store.resumeStyle, () => {
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
