<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { Previewer } from 'pagedjs'
import { useResumeStore, type ResumeStyle } from '../stores/resume'
import { useDebounceFn } from '@vueuse/core'
import { enhanceResumeHtml } from '../utils/resumeParser'
import { renderManualPageBreaks } from '../utils/manualPageBreak'
import { pingFangFontFaceCss } from '../utils/fontAssets'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
const isTemplateDropdownOpen = ref(false)
let paged: any = null
let activeRenderPromise: Promise<void> | null = null
let pendingRenderRequest: PreviewRenderRequest | null = null

const photoInput = ref<HTMLInputElement | null>(null)

const handlePhotoUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 1024 * 1024) {
    ElMessage.error('照片大小不能超过 1MB')
    target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (evt) => {
    store.photoBase64 = evt.target?.result as string
    target.value = ''
  }
  reader.readAsDataURL(file)
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

// ─── Resume Fonts ────────────────────────────────────────────────────────────
// Fixed set of common Chinese and English resume fonts
const FONT_OPTIONS = [
  { label: '苹方', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: '黑体', value: '"SimHei", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"SimSun", "Times New Roman", serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
] as const

const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].value

const normalizeFontFamily = (fontFamily?: string | null): string => {
  const resolvedFontFamily = (fontFamily ?? '')
    .replace(/^var\(\s*--[^,]+,\s*(.+)\)$/, '$1')

  const primaryFont = resolvedFontFamily
    .split(',')[0]
    ?.replace(/["']/g, '')
    .trim()
    .toLowerCase()

  switch (primaryFont) {
    case 'pingfang sc':
      return FONT_OPTIONS[0].value
    case 'microsoft yahei':
      return FONT_OPTIONS[1].value
    case 'simhei':
      return FONT_OPTIONS[2].value
    case 'simsun':
      return FONT_OPTIONS[3].value
    case 'helvetica':
    case 'helvetica neue':
      return FONT_OPTIONS[4].value
    case 'arial':
    case 'arial narrow':
      return FONT_OPTIONS[5].value
    case 'times new roman':
      return FONT_OPTIONS[6].value
    default:
      return DEFAULT_FONT_FAMILY
  }
}

onMounted(async () => {
  await store.loadTemplates()
  syncDefaultsFromTemplate()
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

// ─── CSS Parsing ──────────────────────────────────────────────────────────────
const getCssBlocks = (css: string, selector: string): string[] => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const selectorRe = new RegExp(`${escapedSelector}\\s*\\{`, 'g')
  const blocks: string[] = []

  while (selectorRe.exec(css) !== null) {
    const blockStart = selectorRe.lastIndex - 1
    let depth = 1
    let cursor = blockStart + 1

    while (cursor < css.length && depth > 0) {
      const char = css[cursor]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      cursor += 1
    }

    if (depth !== 0) break

    blocks.push(css.slice(blockStart + 1, cursor - 1))
    selectorRe.lastIndex = cursor
  }

  return blocks
}

const extractTopLevelProp = (block: string, prop: string): string | null => {
  let depth = 0
  let flattened = ''

  for (const char of block) {
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0) {
      flattened += char
    }
  }

  const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...flattened.matchAll(new RegExp(`${escapedProp}\\s*:\\s*([^;]+)`, 'g'))]
  return matches.length > 0 ? matches[matches.length - 1][1].trim() : null
}

const extractCssProp = (css: string, selector: string, prop: string, fallback: string): string => {
  const blocks = getCssBlocks(css, selector)
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const value = extractTopLevelProp(blocks[i], prop)
    if (value) return value
  }
  return fallback
}

const resolveCssFallbackValue = (raw: string, fallback: string): string => {
  const value = raw.trim()
  if (!value.startsWith('var(')) return value

  const inner = value.slice(4, -1)
  const commaIndex = inner.indexOf(',')
  if (commaIndex === -1) return fallback

  return inner.slice(commaIndex + 1).trim() || fallback
}

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
  }
  .resume-document h3 {
    font-size: ${cvStyle.h3Size}px !important;
    color: ${cvStyle.themeColor} !important;
  }
  .resume-document p,
  .resume-document ul,
  .resume-document ol,
  .resume-document .job-intention + p,
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

const syncDefaultsFromTemplate = () => {
  const tpl = store.availableTemplates.find(t => t.id === store.activeTemplate)
  const css = tpl?.css ?? ''

  const lineHeightRaw = resolveCssFallbackValue(
    extractCssProp(css, '.resume-document', 'line-height', '1.6'),
    '1.6'
  )
  const lineHeight = parseFloat(lineHeightRaw)

  const fontFamily = normalizeFontFamily(
    extractCssProp(css, '.resume-document', 'font-family', DEFAULT_FONT_FAMILY)
  )

  // Parse heading sizes from the template
  const h1Raw = extractCssProp(css, '.resume-document h1', 'font-size', '28px')
  const h2Raw = extractCssProp(css, '.resume-document h2', 'font-size', '20px')
  const h3Raw = extractCssProp(css, '.resume-document h3', 'font-size', '16px')

  // Convert rem → px (assume 16px base) or strip px
  const toNum = (v: string, fallback: number) => {
    const rem = v.match(/([\d.]+)rem/)
    if (rem) return parseFloat(rem[1]) * 16
    const px = v.match(/([\d.]+)px/)
    if (px) return parseFloat(px[1])
    return fallback
  }

  store.resumeStyle.lineHeight = isNaN(lineHeight) ? 1.6 : lineHeight
  store.resumeStyle.fontFamily = fontFamily
  store.resumeStyle.h1Size = toNum(h1Raw, 28)
  store.resumeStyle.h2Size = toNum(h2Raw, 20)
  store.resumeStyle.h3Size = toNum(h3Raw, 16)

  // Theme color: try h2 color first, then h1
  // Extract fallback from var() expressions, e.g. var(--cv-theme-color, #4c49cc) → #4c49cc
  const parseColor = (raw: string, fallback: string): string => {
    if (!raw) return fallback
    const varMatch = raw.match(/var\([^,]+,\s*([^)]+)\)/)
    if (varMatch) return varMatch[1].trim()
    if (raw.startsWith('var(')) return fallback
    return raw
  }
  const themeColorRaw = extractCssProp(css, '.resume-document h2', 'color', '')
    || extractCssProp(css, '.resume-document h1', 'color', '#4c49cc')
  store.resumeStyle.themeColor = parseColor(themeColorRaw, '#4c49cc')

  // Body font size
  const bodyFontRaw = resolveCssFallbackValue(
    extractCssProp(
      css,
      '.resume-document',
      '--cv-font-size',
      extractCssProp(css, '.resume-document p', 'font-size', extractCssProp(css, '.resume-document', 'font-size', '14px'))
    ),
    '14px'
  )
  store.resumeStyle.fontSize = toNum(bodyFontRaw, 14)

  const dateWeightRaw = resolveCssFallbackValue(
    extractCssProp(
      css,
      '.resume-document .experience-date',
      'font-weight',
      extractCssProp(css, '.resume-document', '--cv-date-weight', '400')
    ),
    '400'
  ).toLowerCase()
  store.resumeStyle.dateWeight = ['bold', 'bolder', '700', '800', '900'].includes(dateWeightRaw) ? '700' : '400'

  const paragraphSpacingRaw = extractCssProp(
    css,
    '.resume-document',
    '--cv-paragraph-spacing',
    extractCssProp(css, '.resume-document p', 'margin-bottom', '0.5rem')
  )
  store.resumeStyle.paragraphSpacing = toNum(paragraphSpacingRaw, 8)

  // Page margins from @page rule
  const pageMarginRaw = extractCssProp(css, '@page', 'margin', '10mm 12mm')
  const marginParts = pageMarginRaw.match(/([\d.]+)/g) ?? []
  store.resumeStyle.marginV = marginParts.length >= 1 ? parseFloat(marginParts[0] as string) : 10
  store.resumeStyle.marginH = marginParts.length >= 2 ? parseFloat(marginParts[1] as string) : 12

  const contactRenderMode = extractCssProp(css, '.resume-document', '--cv-contact-render', 'text')
  store.resumeStyle.personalInfoMode = contactRenderMode === 'icon' ? 'icon' : 'text'
}

// ─── Render ───────────────────────────────────────────────────────────────────
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

  const htmlContent = await marked.parse(renderManualPageBreaks(request.markdownText))
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

watch(() => store.markdownContent, (newVal) => {
  debouncedRender(newVal)
})

watch(() => store.photoBase64, () => {
  debouncedRender(store.markdownContent)
})

watch(() => store.activeTemplate, () => {
  syncDefaultsFromTemplate()
  debouncedRender(store.markdownContent)
})

watch(() => store.resumeStyle, () => {
  debouncedRender(store.markdownContent)
}, { deep: true })
</script>

<template>
  <section class="flex flex-col card-soft ghost-border shadow-ambient overflow-hidden relative">
    <!-- Hidden file input for photo upload -->
    <input 
      type="file" 
      ref="photoInput" 
      accept="image/*" 
      class="hidden" 
      @change="handlePhotoUpload" 
    />

    <!-- Preview Controls -->
    <div class="preview-toolbar flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface-container-high/35 px-5 backdrop-blur-sm z-10">
      <div class="flex items-center gap-2">
        <el-dropdown trigger="click" @command="(cmd: string) => store.activeTemplate = cmd" @visible-change="(visible: boolean) => isTemplateDropdownOpen = visible">
          <span :class="['preview-toolbar-pill', 'preview-template-trigger', 'min-w-[108px]', 'max-w-[160px]', 'cursor-pointer', 'justify-between', { 'is-open': isTemplateDropdownOpen }]">
            <i class="bi bi-palette-fill"></i>
            <span class="preview-toolbar-label">{{ store.availableTemplates.find(t => t.id === store.activeTemplate)?.name || '未知模板' }}</span>
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant/70">expand_more</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu class="min-w-[120px] rounded-xl overflow-hidden py-1 border-none shadow-ambient">
              <el-dropdown-item 
                v-for="tpl in store.availableTemplates" 
                :key="tpl.id" 
                :command="tpl.id"
                :class="{ 'text-primary font-bold bg-primary/5': store.activeTemplate === tpl.id }"
              >
                {{ tpl.name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <!-- Style Controls -->
      <div class="preview-toolbar-center flex flex-1 items-center justify-center gap-3">
        <!-- Font Selection -->
        <el-select v-model="store.resumeStyle.fontFamily" size="small" style="width: 108px" placeholder="字体">
          <el-option
            v-for="f in FONT_OPTIONS"
            :key="f.value"
            :label="f.label"
            :value="f.value"
          />
        </el-select>

        <!-- Custom Theme Color Picker (Replaces el-color-picker) -->
        <el-popover placement="bottom" trigger="click" :width="240">
          <template #reference>
            <div class="preview-toolbar-icon cursor-pointer" title="主题色">
              <div 
                class="w-4 h-4 rounded-full border border-outline-variant/50 shadow-inner"
                :style="{ backgroundColor: store.resumeStyle.themeColor }"
              ></div>
            </div>
          </template>

          <div class="flex flex-col gap-3 font-sans">
            <div class="text-xs font-bold text-on-surface-variant flex justify-between items-center">
              <span>选择颜色</span>
            </div>
            
            <!-- Predefined Colors -->
            <div class="grid grid-cols-5 gap-2">
              <div 
                v-for="color in ['#4c49cc', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#000000', '#333333']" 
                :key="color"
                @click="store.resumeStyle.themeColor = color"
                class="w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center transition-transform hover:scale-110 shadow-sm border border-outline-variant/20"
                :style="{ backgroundColor: color }"
              >
                <span v-if="store.resumeStyle.themeColor.toLowerCase() === color.toLowerCase()" class="material-symbols-outlined text-white text-[16px] drop-shadow-md">check</span>
              </div>
            </div>
            
            <div class="h-[1px] w-full bg-outline-variant/20 my-1"></div>
            
            <!-- Custom Color & Hex -->
            <div class="flex items-center gap-3">
              <div class="relative w-8 h-8 rounded-lg overflow-hidden border border-outline-variant/30 shadow-sm cursor-pointer flex-shrink-0">
                <div class="absolute inset-0 z-0" :style="{ backgroundColor: store.resumeStyle.themeColor }"></div>
                <!-- Eyedropper Icon -->
                <span class="material-symbols-outlined absolute inset-0 w-5 h-5 m-auto z-10 text-white/80 drop-shadow flex items-center justify-center text-[18px] pointer-events-none">colorize</span>
                <input 
                  type="color" 
                  v-model="store.resumeStyle.themeColor"
                  class="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer z-20"
                />
              </div>
              
              <div class="flex-1 px-3 py-1.5 bg-surface-container rounded-md border border-outline-variant/30 flex items-center">
                <span class="text-on-surface-variant/50 text-xs font-mono mr-1">#</span>
                <input 
                  type="text" 
                  :value="store.resumeStyle.themeColor.replace('#', '')"
                  @input="(e) => { const v = (e.target as HTMLInputElement).value; if(/^[0-9A-Fa-f]{6}$/.test(v)) store.resumeStyle.themeColor = '#' + v }"
                  class="bg-transparent border-none outline-none text-xs text-on-surface-variant w-full font-mono uppercase"
                  maxlength="6"
                />
              </div>
            </div>
          </div>
        </el-popover>

        <!-- Font Size Dropdown -->
        <el-dropdown trigger="click" :hide-on-click="false">
          <button class="preview-toolbar-icon cursor-pointer" title="字号">
            <span class="material-symbols-outlined text-[14px]">format_size</span>
          </button>
          <template #dropdown>
            <div class="p-4 w-64 font-sans shadow-ambient rounded-xl">
              <!-- H1 -->
              <div class="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
                <span>H1 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h1Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h1Size" :min="24" :max="34" :step="1" :show-tooltip="false" />

              <!-- H2 -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>H2 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h2Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h2Size" :min="14" :max="22" :step="1" :show-tooltip="false" />

              <!-- H3 -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>H3 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h3Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h3Size" :min="12" :max="18" :step="1" :show-tooltip="false" />

              <!-- Body -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>正文大小</span>
                <span class="text-primary">{{ store.resumeStyle.fontSize }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.fontSize" :min="11" :max="16" :step="1" :show-tooltip="false" />
              
              <div class="h-[1px] w-full bg-outline-variant/20 my-4"></div>

              <!-- Date customization -->
              <div class="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
                <span>日期大小</span>
                <span class="text-primary">{{ store.resumeStyle.dateSize }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.dateSize" :min="11" :max="16" :step="1" :show-tooltip="false" />
              
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2">日期粗细</div>
              <div class="flex items-center gap-2 rounded-full bg-surface-container p-1">
                <button
                  type="button"
                  class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="store.resumeStyle.dateWeight === '400'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'"
                  @click="store.resumeStyle.dateWeight = '400'"
                >
                  不加粗
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="store.resumeStyle.dateWeight === '700'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'"
                  @click="store.resumeStyle.dateWeight = '700'"
                >
                  加粗
                </button>
              </div>
            </div>
          </template>
        </el-dropdown>

        <!-- Spacing Dropdown -->
        <el-dropdown trigger="click" :hide-on-click="false">
          <button class="preview-toolbar-icon cursor-pointer" title="间距">
            <span class="material-symbols-outlined text-[14px]">format_line_spacing</span>
          </button>
          <template #dropdown>
            <div class="p-4 w-60 font-sans shadow-ambient rounded-xl">
              <div class="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
                <span>行距</span>
                <span class="text-primary">{{ store.resumeStyle.lineHeight }}</span>
              </div>
              <el-slider v-model="store.resumeStyle.lineHeight" :min="1.0" :max="2.5" :step="0.1" :show-tooltip="false" />

              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>段落间距</span>
                <span class="text-primary">{{ store.resumeStyle.paragraphSpacing }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.paragraphSpacing" :min="0" :max="24" :step="1" :show-tooltip="false" />
              
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>上下页边距</span>
                <span class="text-primary">{{ store.resumeStyle.marginV }}mm</span>
              </div>
              <el-slider v-model="store.resumeStyle.marginV" :min="0" :max="50" :step="1" :show-tooltip="false" />

              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>左右页边距</span>
                <span class="text-primary">{{ store.resumeStyle.marginH }}mm</span>
              </div>
              <el-slider v-model="store.resumeStyle.marginH" :min="0" :max="50" :step="1" :show-tooltip="false" />
            </div>
          </template>
        </el-dropdown>
      </div>
      
      <div class="preview-toolbar-group preview-toolbar-zoom">
        <button @click="zoomOut" class="text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer" title="缩小">
          <span class="material-symbols-outlined text-base">remove_circle_outline</span>
        </button>
        <span class="text-[11px] font-bold text-on-surface-variant w-9 text-center select-none">{{ zoomLevel }}%</span>
        <button @click="zoomIn" class="text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer" title="放大">
          <span class="material-symbols-outlined text-base">add_circle_outline</span>
        </button>
      </div>
    </div>
    
    <!-- Scrollable Preview Area -->
    <div ref="previewScrollContainer" class="flex flex-1 justify-center overflow-auto custom-scrollbar bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(225,226,232,0.86)_52%,_rgba(236,238,243,0.92)_100%)] px-8 py-9">
      <!-- Paged.js Render Container -->
      <div ref="previewContainer" class="pagedjs-wrapper overflow-visible transition-transform duration-200" :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"></div>
    </div>

    <!-- Footer -->
    <div class="h-10 shrink-0 flex items-center px-5 justify-between bg-surface-container-high/30 backdrop-blur-sm border-t border-outline-variant/10">
      <!-- Left: Reset + Save -->
      <div class="flex items-center gap-3">
        <button
          @click="syncDefaultsFromTemplate"
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
        @confirm="store.saveCurrentTemplate"
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
.preview-template-trigger {
  gap: 0.5rem;
  padding-inline: 0.875rem 0.75rem;
  transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.preview-template-trigger .preview-toolbar-label {
  min-width: 0;
  flex: 1;
}

.preview-template-trigger .bi {
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--color-primary) 78%, white);
  transition: transform 0.2s ease, color 0.2s ease;
}

.preview-template-trigger .material-symbols-outlined {
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.preview-template-trigger:hover,
.preview-template-trigger.is-open {
  transform: translateY(-1px);
  color: var(--color-on-surface);
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-container-lowest));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent),
    0 10px 24px rgba(76, 73, 204, 0.08);
}

.preview-template-trigger:hover .bi,
.preview-template-trigger.is-open .bi {
  color: var(--color-primary);
  transform: rotate(-10deg) scale(1.03);
}

.preview-template-trigger:hover .material-symbols-outlined,
.preview-template-trigger.is-open .material-symbols-outlined {
  color: var(--color-primary);
}

.preview-template-trigger.is-open .material-symbols-outlined {
  transform: rotate(180deg);
}

.preview-toolbar-center {
  gap: 0.625rem;
}

.preview-toolbar-center :deep(.el-select) {
  width: 108px !important;
}

.preview-toolbar-center :deep(.el-select .el-select__wrapper) {
  min-height: 2.25rem;
  border-radius: 999px;
  padding-inline: 0.75rem 0.625rem;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 22%, transparent);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.preview-toolbar-center :deep(.el-select:hover .el-select__wrapper),
.preview-toolbar-center :deep(.el-select.is-focus .el-select__wrapper) {
  background-color: var(--color-surface-container-high);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.preview-toolbar-center :deep(.el-select .el-select__selected-item),
.preview-toolbar-center :deep(.el-select .el-select__placeholder) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.preview-toolbar-center :deep(.el-select .el-select__caret) {
  font-size: 1rem;
  color: color-mix(in srgb, var(--color-on-surface-variant) 72%, white);
}

.preview-toolbar-center :deep(button),
.preview-toolbar-center > div[title] {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-surface-container-lowest) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 22%, transparent);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.preview-toolbar-center :deep(button:hover),
.preview-toolbar-center > div[title]:hover {
  background-color: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

.preview-toolbar-zoom {
  height: 2.25rem;
  padding-block: 0;
  padding-inline: 0.75rem;
  gap: 0.625rem;
}

.preview-toolbar-zoom button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  background: transparent;
  box-shadow: none;
  transition: color 0.2s ease, transform 0.2s ease;
}

.preview-toolbar-zoom button:hover {
  color: var(--color-on-surface);
  transform: scale(1.04);
}
</style>
