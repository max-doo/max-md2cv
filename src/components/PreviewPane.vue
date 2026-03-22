<script setup lang="ts">
import { ref, shallowRef, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { Previewer } from 'pagedjs'
import { useResumeStore, type ResumeStyle } from '../stores/resume'
import { useDebounceFn } from '@vueuse/core'
import { enhanceResumeHtml } from '../utils/resumeParser'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
let paged: any = null

const photoInput = ref<HTMLInputElement | null>(null)
const jobColorInput = ref<HTMLInputElement | null>(null)

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

// ─── System Fonts ────────────────────────────────────────────────────────────
// Common fonts available on Windows/macOS/Linux, shown with their real names
const COMMON_FONTS = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: '微软雅黑 (YaHei)', value: '"Microsoft YaHei", sans-serif' },
  { label: '宋体 (SimSun)', value: 'SimSun, serif' },
  { label: '黑体 (SimHei)', value: 'SimHei, sans-serif' },
  { label: '楷体 (KaiTi)', value: 'KaiTi, serif' },
  { label: '仿宋 (FangSong)', value: 'FangSong, serif' },
  { label: 'PingFang SC', value: '"PingFang SC", sans-serif' },
  { label: 'Hiragino Kaku Gothic', value: '"Hiragino Kaku Gothic ProN", sans-serif' },
]
const fontOptions = shallowRef(COMMON_FONTS)

// Try to enrich with actual system fonts via Font Access API
onMounted(async () => {
  try {
    // @ts-ignore – queryLocalFonts is non-standard but available in Chromium (Tauri uses WebView)
    if (typeof window.queryLocalFonts === 'function') {
      const fonts: { family: string }[] = await (window as any).queryLocalFonts()
      const seen = new Set<string>()
      const systemFonts = fonts
        .filter(f => {
          if (seen.has(f.family)) return false
          seen.add(f.family)
          return true
        })
        .map(f => ({ label: f.family, value: `"${f.family}", sans-serif` }))
      if (systemFonts.length > 0) {
        fontOptions.value = systemFonts
      }
    }
  } catch {
    // queryLocalFonts not available – keep the static list
  }

  await store.loadTemplates()
  syncDefaultsFromTemplate()
  renderPdfPreview(store.markdownContent)

  if (previewContainer.value) {
    previewContainer.value.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.resume-photo-wrapper')) {
        store.importIdPhoto()
      } else if (target.closest('.job-intention')) {
        jobColorInput.value?.click()
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

const buildPreviewStyles = (cvStyle: ResumeStyle): string => `
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
`

const syncDefaultsFromTemplate = () => {
  const tpl = store.availableTemplates.find(t => t.id === store.activeTemplate)
  const css = tpl?.css ?? ''

  const lineHeightRaw = extractCssProp(css, '.resume-document', 'line-height', '1.6')
  const lineHeight = parseFloat(lineHeightRaw)

  const fontFamily = extractCssProp(css, '.resume-document', 'font-family',
    '"PingFang SC", "Microsoft YaHei", sans-serif')

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
  const bodyFontRaw = extractCssProp(css, '.resume-document', 'font-size', '14px')
  store.resumeStyle.fontSize = toNum(bodyFontRaw, 14)

  // Page margins from @page rule
  const pageMarginRaw = extractCssProp(css, '@page', 'margin', '10mm 12mm')
  const marginParts = pageMarginRaw.match(/([\d.]+)/g) ?? []
  store.resumeStyle.marginV = marginParts.length >= 1 ? parseFloat(marginParts[0] as string) : 10
  store.resumeStyle.marginH = marginParts.length >= 2 ? parseFloat(marginParts[1] as string) : 12
}

// ─── Render ───────────────────────────────────────────────────────────────────
const renderPdfPreview = async (markdownText: string) => {
  if (!previewContainer.value) return

  // Clean up previous Paged.js injected styles
  document.querySelectorAll('style[data-pagedjs-inserted-styles]').forEach(el => el.remove())

  const activeTemplateData = store.availableTemplates.find(t => t.id === store.activeTemplate)
  const cssText = activeTemplateData?.css ?? ''
  const htmlContent = await marked.parse(markdownText)

  const cvStyle = store.resumeStyle

  const injectCss = buildPreviewStyles(cvStyle)
  const stylesheetSources = [
    { [`${window.location.href}#template-${store.activeTemplate}`]: cssText },
    { [`${window.location.href}#runtime-preview`]: injectCss }
  ]

  const photoHtml = `
    <div class="resume-photo-wrapper" title="点击上传证件照 (最大1MB)">
      ${store.photoBase64 ? `<img src="${store.photoBase64}" />` : '<div class="photo-placeholder-text"><span class="material-symbols-outlined" style="font-size: 24px; margin-bottom: 4px;">add_a_photo</span><br/><span>添加证件照</span></div>'}
    </div>
  `

  let finalHtml = enhanceResumeHtml(htmlContent, store.resumeStyle)

  const sourceDiv = document.createElement('div')
  sourceDiv.innerHTML = `<div class="resume-document">${photoHtml}${finalHtml}</div>`
  const photoWrapper = sourceDiv.querySelector('.resume-photo-wrapper')
  photoWrapper?.classList.add(store.photoBase64 ? 'has-photo' : 'is-empty')

  previewContainer.value.innerHTML = ''
  paged = new Previewer()

  try {
    await paged.preview(sourceDiv, stylesheetSources, previewContainer.value)
    // Count rendered pages
    totalPages.value = previewContainer.value?.querySelectorAll('.pagedjs_page').length ?? 0
  } catch (err) {
    console.error('Paged.js rendering error:', err)
    totalPages.value = 0
  }
}

const debouncedRender = useDebounceFn((text: string) => {
  renderPdfPreview(text)
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
    <input 
      type="color" 
      ref="jobColorInput" 
      class="hidden" 
      :value="store.resumeStyle.jobIntentionColor || store.resumeStyle.themeColor"
      @input="(e) => store.resumeStyle.jobIntentionColor = (e.target as HTMLInputElement).value" 
    />

    <!-- Preview Controls -->
    <div class="h-14 shrink-0 flex items-center px-6 justify-between bg-surface-container-high/40 backdrop-blur-sm border-b border-outline-variant/10 z-10">
      <div class="flex items-center gap-2">
        <el-dropdown trigger="click" @command="(cmd: string) => store.activeTemplate = cmd">
          <span class="text-xs font-bold text-on-surface-variant tracking-wider cursor-pointer flex items-center gap-1 hover:text-primary transition-colors focus:outline-none bg-surface-container-lowest border border-outline-variant/30 rounded-full px-3 py-1.5">
            {{ store.availableTemplates.find(t => t.id === store.activeTemplate)?.name || '未知模板' }}
            <span class="material-symbols-outlined text-[14px]">expand_more</span>
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
      <div class="flex flex-1 items-center justify-center gap-3">
        <!-- Font Selection -->
        <el-select v-model="store.resumeStyle.fontFamily" size="small" style="width: 130px" placeholder="字体">
          <el-option
            v-for="f in fontOptions"
            :key="f.value"
            :label="f.label"
            :value="f.value"
          />
        </el-select>

        <!-- Custom Theme Color Picker (Replaces el-color-picker) -->
        <el-popover placement="bottom" trigger="click" :width="240">
          <template #reference>
            <div class="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 flex items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-colors" title="主题色">
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
          <button class="px-2 py-1.5 hover:bg-surface-container-highest rounded-md text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer text-xs gap-1 border border-outline-variant/30 bg-surface-container-lowest h-8" title="字号">
            <span class="material-symbols-outlined text-[14px]">format_size</span>
          </button>
          <template #dropdown>
            <div class="p-4 w-64 font-sans shadow-ambient rounded-xl">
              <!-- H1 -->
              <div class="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
                <span>H1 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h1Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h1Size" :min="12" :max="60" :step="1" :show-tooltip="false" />

              <!-- H2 -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>H2 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h2Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h2Size" :min="10" :max="40" :step="1" :show-tooltip="false" />

              <!-- H3 -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>H3 标题大小</span>
                <span class="text-primary">{{ Math.round(store.resumeStyle.h3Size) }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.h3Size" :min="10" :max="30" :step="1" :show-tooltip="false" />

              <!-- Body -->
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2 flex justify-between">
                <span>正文大小</span>
                <span class="text-primary">{{ store.resumeStyle.fontSize }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.fontSize" :min="10" :max="20" :step="1" :show-tooltip="false" />
              
              <div class="h-[1px] w-full bg-outline-variant/20 my-4"></div>

              <!-- Date customization -->
              <div class="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
                <span>日期大小</span>
                <span class="text-primary">{{ store.resumeStyle.dateSize }}px</span>
              </div>
              <el-slider v-model="store.resumeStyle.dateSize" :min="10" :max="20" :step="1" :show-tooltip="false" />
              
              <div class="text-xs font-bold text-on-surface-variant mt-4 mb-2">日期粗细</div>
              <el-select v-model="store.resumeStyle.dateWeight" size="small" style="width: 100%">
                <el-option label="默认 (由模板决定)" value="" />
                <el-option label="极细 (Lighter)" value="300" />
                <el-option label="常规 (Normal)" value="400" />
                <el-option label="中等 (Medium)" value="500" />
                <el-option label="加粗 (Bold)" value="700" />
                <el-option label="黑体 (Bolder)" value="900" />
              </el-select>
            </div>
          </template>
        </el-dropdown>

        <!-- Spacing Dropdown -->
        <el-dropdown trigger="click" :hide-on-click="false">
          <button class="px-2 py-1.5 hover:bg-surface-container-highest rounded-md text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer text-xs gap-1 border border-outline-variant/30 bg-surface-container-lowest h-8" title="间距">
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
      
      <div class="flex items-center gap-1 bg-surface-container-lowest/50 backdrop-blur rounded-lg px-1.5 py-1">
        <button @click="zoomOut" class="p-1 hover:bg-surface-container-highest rounded-md text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer" title="缩小">
          <span class="material-symbols-outlined text-base">remove_circle_outline</span>
        </button>
        <span class="text-[11px] font-bold text-on-surface-variant w-9 text-center select-none">{{ zoomLevel }}%</span>
        <button @click="zoomIn" class="p-1 hover:bg-surface-container-highest rounded-md text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer" title="放大">
          <span class="material-symbols-outlined text-base">add_circle_outline</span>
        </button>
      </div>
    </div>
    
    <!-- Scrollable Preview Area -->
    <div class="flex-1 overflow-auto custom-scrollbar p-10 bg-surface-variant/70 flex justify-center">
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
