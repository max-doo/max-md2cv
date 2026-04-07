<script setup lang="ts">
import SoftSelect from '../shared/SoftSelect.vue'
import { useResumeStore } from '@resume-store'
import { RESUME_STYLE_LIMITS } from '../../utils/templateStyle'

defineProps<{
  zoomLevel: number
}>()

defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
}>()

const store = useResumeStore()

const FONT_OPTIONS = [
  { label: '苹方', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: '黑体', value: '"SimHei", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"SimSun", "Times New Roman", serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
] as const

const THEME_COLORS = [
  '#4c49cc',
  '#302EA3',
  '#0050D1',
  '#0062FF',
  '#2C83EC',
  '#2477BF',
  '#0D98BA',
  '#004A99',
  '#003396',
  '#005451',
  '#008080',
  '#1AB0A5',
  '#ED7700',
  '#000000',
  '#242424'
] as const

const handleTemplateChange = (templateId: string) => {
  store.setActiveTemplateForCurrentFile(templateId)
}

const handleThemeColorHexInput = (event: Event) => {
  const nextValue = (event.target as HTMLInputElement).value.trim()
  if (/^[0-9A-Fa-f]{6}$/.test(nextValue)) {
    store.resumeStyle.themeColor = `#${nextValue}`
  }
}

const isThemeColorSelected = (color: string) =>
  store.resumeStyle.themeColor.toLowerCase() === color.toLowerCase()
</script>

<template>
  <div class="preview-toolbar flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface-container-high/35 px-5 backdrop-blur-sm z-10">
    <div class="flex items-center gap-2">
      <SoftSelect
        class="preview-toolbar-template-select"
        :model-value="store.activeTemplate"
        width="130px"
        placeholder="模板"
        @update:model-value="handleTemplateChange($event as string)"
      >
        <template #label="{ value }">
          <span class="preview-template-select-label">
            <span class="material-symbols-outlined preview-template-select-icon text-[16px]">palette</span>
            <span class="preview-toolbar-label">
              {{ store.availableTemplates.find(t => t.id === value)?.name || '模板' }}
            </span>
          </span>
        </template>
        <el-option
          v-for="tpl in store.availableTemplates"
          :key="tpl.id"
          :label="tpl.name"
          :value="tpl.id"
        />
      </SoftSelect>
    </div>

    <div class="preview-toolbar-center flex flex-1 items-center justify-center gap-3">
      <SoftSelect
        class="preview-toolbar-font-select"
        v-model="store.resumeStyle.fontFamily"
        width="108px"
        placeholder="字体"
      >
        <el-option
          v-for="font in FONT_OPTIONS"
          :key="font.value"
          :label="font.label"
          :value="font.value"
        />
      </SoftSelect>

      <el-popover placement="bottom" trigger="click" :width="240" popper-class="preview-toolbar-popper preview-toolbar-theme-popper">
        <template #reference>
          <div class="preview-toolbar-icon cursor-pointer" title="主题色">
            <div
              class="preview-theme-trigger-indicator h-4 w-4 rounded-full border border-outline-variant/50 shadow-inner"
              :style="{ backgroundColor: store.resumeStyle.themeColor }"
            ></div>
          </div>
        </template>

        <div class="preview-toolbar-panel preview-theme-panel flex flex-col gap-3 font-sans">
          <div class="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <span>主题颜色</span>
          </div>

          <div class="preview-theme-grid">
            <button
              v-for="color in THEME_COLORS"
              :key="color"
              type="button"
              class="preview-theme-swatch"
              :class="{ 'is-active': isThemeColorSelected(color) }"
              :style="{ backgroundColor: color }"
              @click="store.resumeStyle.themeColor = color"
            >
              <span
                v-if="isThemeColorSelected(color)"
                class="material-symbols-outlined text-[16px] text-white drop-shadow-md"
              >
                check
              </span>
            </button>
          </div>

          <div class="preview-theme-custom-row">
            <label class="preview-theme-custom-trigger">
              <div class="absolute inset-0 z-0 rounded-full" :style="{ backgroundColor: store.resumeStyle.themeColor }"></div>
              <span class="material-symbols-outlined pointer-events-none z-10 text-[18px] text-white/80 drop-shadow">colorize</span>
              <input
                v-model="store.resumeStyle.themeColor"
                type="color"
                class="preview-theme-native-input"
              />
            </label>

            <div class="preview-theme-hex-field">
              <span class="mr-1 font-mono text-xs text-on-surface-variant/50">#</span>
              <input
                type="text"
                :value="store.resumeStyle.themeColor.replace('#', '')"
                class="preview-theme-hex-input"
                maxlength="6"
                @input="handleThemeColorHexInput"
              />
            </div>
          </div>
        </div>
      </el-popover>

      <el-dropdown trigger="click" :hide-on-click="false" popper-class="soft-dropdown-popper preview-toolbar-popper">
        <button class="preview-toolbar-icon cursor-pointer" title="字号">
          <span class="material-symbols-outlined text-[14px]">format_size</span>
        </button>
        <template #dropdown>
          <div class="preview-toolbar-panel w-64 rounded-xl p-4 font-sans shadow-ambient">
            <div class="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H1 标题大小</span>
              <span class="text-primary">{{ Math.round(store.resumeStyle.h1Size) }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h1Size" :min="24" :max="34" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H2 标题大小</span>
              <span class="text-primary">{{ Math.round(store.resumeStyle.h2Size) }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h2Size" :min="14" :max="22" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H3 标题大小</span>
              <span class="text-primary">{{ Math.round(store.resumeStyle.h3Size) }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h3Size" :min="12" :max="18" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>正文字号</span>
              <span class="text-primary">{{ store.resumeStyle.fontSize }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.fontSize" :min="11" :max="16" :step="1" :show-tooltip="false" />

            <div class="my-4 h-[1px] w-full bg-outline-variant/20"></div>

            <div class="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>日期字号</span>
              <span class="text-primary">{{ store.resumeStyle.dateSize }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.dateSize" :min="11" :max="16" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 text-xs font-bold text-on-surface-variant">日期字重</div>
            <div class="flex items-center gap-2 rounded-full bg-surface-container p-1">
              <button
                type="button"
                class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="store.resumeStyle.dateWeight === '400'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'"
                @click="store.resumeStyle.dateWeight = '400'"
              >
                常规
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

      <el-dropdown trigger="click" :hide-on-click="false" popper-class="soft-dropdown-popper preview-toolbar-popper">
        <button class="preview-toolbar-icon cursor-pointer" title="间距">
          <span class="material-symbols-outlined text-[14px]">format_line_spacing</span>
        </button>
        <template #dropdown>
          <div class="preview-toolbar-panel w-60 rounded-xl p-4 font-sans shadow-ambient">
            <div class="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>行高</span>
              <span class="text-primary">{{ store.resumeStyle.lineHeight }}</span>
            </div>
            <el-slider v-model="store.resumeStyle.lineHeight" :min="1.0" :max="2.5" :step="0.1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>正文块间距</span>
              <span class="text-primary">{{ store.resumeStyle.paragraphSpacing }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.paragraphSpacing" :min="RESUME_STYLE_LIMITS.paragraphSpacing.min" :max="RESUME_STYLE_LIMITS.paragraphSpacing.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H2 上边距</span>
              <span class="text-primary">{{ store.resumeStyle.h2MarginTop }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h2MarginTop" :min="RESUME_STYLE_LIMITS.h2MarginTop.min" :max="RESUME_STYLE_LIMITS.h2MarginTop.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H2 下边距</span>
              <span class="text-primary">{{ store.resumeStyle.h2MarginBottom }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h2MarginBottom" :min="RESUME_STYLE_LIMITS.h2MarginBottom.min" :max="RESUME_STYLE_LIMITS.h2MarginBottom.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H3 上边距</span>
              <span class="text-primary">{{ store.resumeStyle.h3MarginTop }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h3MarginTop" :min="RESUME_STYLE_LIMITS.h3MarginTop.min" :max="RESUME_STYLE_LIMITS.h3MarginTop.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>H3 下边距</span>
              <span class="text-primary">{{ store.resumeStyle.h3MarginBottom }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.h3MarginBottom" :min="RESUME_STYLE_LIMITS.h3MarginBottom.min" :max="RESUME_STYLE_LIMITS.h3MarginBottom.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>个人信息栏底部间距</span>
              <span class="text-primary">{{ store.resumeStyle.personalHeaderSpacing }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.personalHeaderSpacing" :min="RESUME_STYLE_LIMITS.personalHeaderSpacing.min" :max="RESUME_STYLE_LIMITS.personalHeaderSpacing.max" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>上下页边距</span>
              <span class="text-primary">{{ store.resumeStyle.marginV }}mm</span>
            </div>
            <el-slider v-model="store.resumeStyle.marginV" :min="0" :max="50" :step="1" :show-tooltip="false" />

            <div class="mt-4 mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
              <span>左右页边距</span>
              <span class="text-primary">{{ store.resumeStyle.marginH }}mm</span>
            </div>
            <el-slider v-model="store.resumeStyle.marginH" :min="0" :max="50" :step="1" :show-tooltip="false" />
          </div>
        </template>
      </el-dropdown>
    </div>

    <div class="preview-toolbar-group preview-toolbar-zoom">
      <button
        class="flex cursor-pointer items-center justify-center text-on-surface-variant transition-colors"
        title="缩小"
        @click="$emit('zoom-out')"
      >
        <span class="material-symbols-outlined text-base">remove_circle_outline</span>
      </button>
      <span class="w-9 select-none text-center text-[11px] font-bold text-on-surface-variant">{{ zoomLevel }}%</span>
      <button
        class="flex cursor-pointer items-center justify-center text-on-surface-variant transition-colors"
        title="放大"
        @click="$emit('zoom-in')"
      >
        <span class="material-symbols-outlined text-base">add_circle_outline</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview-template-select-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.preview-template-select-label .preview-toolbar-label {
  min-width: 0;
  flex: 1;
}

.preview-template-select-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.preview-toolbar-center {
  gap: 0.625rem;
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
  padding: 0;
  gap: 0.5rem;
  background: transparent;
  box-shadow: none;
}

.preview-toolbar-zoom button {
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

.preview-toolbar-zoom button:hover {
  background-color: var(--color-surface-container-high);
  color: var(--color-on-surface);
  transform: scale(1.04);
}

.preview-theme-panel {
  gap: 0.875rem;
  padding: 0.25rem;
}

.preview-theme-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.625rem;
}

.preview-theme-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 18%, transparent);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.26),
    0 6px 14px rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.preview-theme-swatch:hover {
  transform: scale(1.06);
}

.preview-theme-swatch.is-active {
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.9),
    0 0 0 4px color-mix(in srgb, var(--color-primary) 24%, transparent),
    0 8px 18px rgba(15, 23, 42, 0.12);
}

.preview-theme-custom-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 16%, transparent);
}

.preview-theme-custom-trigger {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  overflow: hidden;
  border-radius: 999px;
  cursor: pointer;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.24),
    0 8px 18px rgba(15, 23, 42, 0.12);
}

.preview-theme-native-input {
  position: absolute;
  inset: -0.5rem;
  z-index: 20;
  cursor: pointer;
  opacity: 0;
}

.preview-theme-hex-field {
  display: flex;
  flex: 1;
  align-items: center;
  min-height: 2.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--color-surface-container) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 18%, transparent);
  padding-inline: 0.75rem;
}

.preview-theme-hex-input {
  width: 100%;
  border: none;
  background: transparent;
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  outline: none;
}
</style>
