<script setup lang="ts">
import SoftSelect from '../shared/SoftSelect.vue'
import { useResumeStore } from '@resume-store'

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
</script>

<template>
  <div class="preview-toolbar flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface-container-high/35 px-5 backdrop-blur-sm z-10">
    <div class="flex items-center gap-2">
      <SoftSelect
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
              class="h-4 w-4 rounded-full border border-outline-variant/50 shadow-inner"
              :style="{ backgroundColor: store.resumeStyle.themeColor }"
            ></div>
          </div>
        </template>

        <div class="preview-toolbar-panel flex flex-col gap-3 font-sans">
          <div class="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <span>主题颜色</span>
          </div>

          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="color in THEME_COLORS"
              :key="color"
              class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-outline-variant/20 shadow-sm transition-transform hover:scale-110"
              :style="{ backgroundColor: color }"
              @click="store.resumeStyle.themeColor = color"
            >
              <span
                v-if="store.resumeStyle.themeColor.toLowerCase() === color.toLowerCase()"
                class="material-symbols-outlined text-[16px] text-white drop-shadow-md"
              >
                check
              </span>
            </div>
          </div>

          <div class="my-1 h-[1px] w-full bg-outline-variant/20"></div>

          <div class="flex items-center gap-3">
            <div class="relative h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-outline-variant/30 shadow-sm flex items-center justify-center">
              <div class="absolute inset-0 z-0" :style="{ backgroundColor: store.resumeStyle.themeColor }"></div>
              <span class="material-symbols-outlined pointer-events-none z-10 text-[18px] text-white/80 drop-shadow">colorize</span>
              <input
                v-model="store.resumeStyle.themeColor"
                type="color"
                class="absolute inset-[-10px] z-20 h-12 w-12 cursor-pointer opacity-0"
              />
            </div>

            <div class="flex flex-1 items-center rounded-md border border-outline-variant/30 bg-surface-container px-3 py-1.5">
              <span class="mr-1 font-mono text-xs text-on-surface-variant/50">#</span>
              <input
                type="text"
                :value="store.resumeStyle.themeColor.replace('#', '')"
                class="w-full border-none bg-transparent font-mono text-xs uppercase text-on-surface-variant outline-none"
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
              <span>段落间距</span>
              <span class="text-primary">{{ store.resumeStyle.paragraphSpacing }}px</span>
            </div>
            <el-slider v-model="store.resumeStyle.paragraphSpacing" :min="0" :max="24" :step="1" :show-tooltip="false" />

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
