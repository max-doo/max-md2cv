<script setup lang="ts">
import { ref, shallowRef, watch, onMounted } from 'vue'
import { marked } from 'marked'
import { Previewer } from 'pagedjs'
import { useResumeStore } from '../stores/resume'
import { useDebounceFn } from '@vueuse/core'

const store = useResumeStore()
const previewContainer = ref<HTMLElement | null>(null)
let paged: any = null

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
})

// ─── CSS Parsing ──────────────────────────────────────────────────────────────
const extractCssProp = (css: string, selector: string, prop: string, fallback: string): string => {
  const escapedSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escapedSel + '\\s*\\{([^}]*)\\}')
  const blockMatch = css.match(re)
  if (!blockMatch) return fallback
  const propMatch = blockMatch[1].match(new RegExp(prop + '\\s*:\\s*([^;]+)'))
  return propMatch ? propMatch[1].trim() : fallback
}

const syncDefaultsFromTemplate = () => {
  const tpl = store.availableTemplates.find(t => t.id === store.activeTemplate)
  const css = tpl?.css ?? ''

  const lineHeightRaw = extractCssProp(css, '\.resume-document', 'line-height', '1.6')
  const lineHeight = parseFloat(lineHeightRaw)

  const fontFamily = extractCssProp(css, '\.resume-document', 'font-family',
    '"PingFang SC", "Microsoft YaHei", sans-serif')

  // Parse heading sizes from the template
  const h1Raw = extractCssProp(css, '\.resume-document h1', 'font-size', '28px')
  const h2Raw = extractCssProp(css, '\.resume-document h2', 'font-size', '20px')
  const h3Raw = extractCssProp(css, '\.resume-document h3', 'font-size', '16px')

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
  const themeColorRaw = extractCssProp(css, '\\.resume-document h2', 'color', '')
    || extractCssProp(css, '\\.resume-document h1', 'color', '#3b82f6')
  store.resumeStyle.themeColor = themeColorRaw.startsWith('var(') ? '#3b82f6' : themeColorRaw

  // Body font size
  const bodyFontRaw = extractCssProp(css, '\\.resume-document', 'font-size', '14px')
  store.resumeStyle.fontSize = toNum(bodyFontRaw, 14)

  // Page margins from @page rule
  const pageMarginRaw = extractCssProp(css, '@page', 'margin', '15mm 20mm')
  const marginParts = pageMarginRaw.match(/([\d.]+)/g) ?? []
  store.resumeStyle.marginV = marginParts.length >= 1 ? parseFloat(marginParts[0]) : 15
  store.resumeStyle.marginH = marginParts.length >= 2 ? parseFloat(marginParts[1]) : store.resumeStyle.marginV
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

  // Concrete CSS overrides — avoid :root vars since Paged.js isolates the document
  const injectCss = `
    @page {
      margin: ${cvStyle.marginV}mm ${cvStyle.marginH}mm;
    }
    .resume-document {
      font-family: ${cvStyle.fontFamily} !important;
      font-size: ${cvStyle.fontSize}px !important;
      line-height: ${cvStyle.lineHeight} !important;
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

  const sourceDiv = document.createElement('div')
  sourceDiv.innerHTML = `<style>${cssText}</style><style>${injectCss}</style><div class="resume-document">${htmlContent}</div>`

  previewContainer.value.innerHTML = ''
  paged = new Previewer()

  try {
    await paged.preview(sourceDiv, [], previewContainer.value)
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

        <!-- Theme Color: instant update, no OK/Clear needed -->
        <el-color-picker
          :model-value="store.resumeStyle.themeColor"
          @active-change="(v: string) => { if (v) store.resumeStyle.themeColor = v }"
          @change="(v: string | null) => { if (v) store.resumeStyle.themeColor = v }"
          size="small"
          :predefine="['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#000000', '#333333']"
          class="no-clear-picker"
        />

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
            覆盖保存模板
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

@page {
  size: A4;
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-size: 10px;
    color: #c7c4d6;
    font-family: 'Manrope', sans-serif;
    letter-spacing: 0.1em;
  }
}


</style>
