<script setup lang="ts">
import { computed } from 'vue'
import SoftSelect from '../shared/SoftSelect.vue'
import { useResumeStore } from '@resume-store'
import {
  resolvePhotoAdjustments,
  resolveTemplateValues,
  type PhotoAdjustments,
  type TemplateFieldSchema,
  type TemplateValue,
} from '@resume-core'

defineProps<{
  zoomLevel: number
}>()

defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
}>()

const store = useResumeStore()

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

const GROUP_ICONS: Record<string, string> = {
  '基础': 'palette',
  '字号': 'format_size',
  '间距': 'format_line_spacing',
  '布局': 'dashboard_customize'
}

const HIDDEN_PREVIEW_FIELD_KEYS = new Set([
  'headerLayout',
  'personalInfoMode',
  'photoPlacement',
  'photoVisible',
  'photoSize',
  'photoOffsetX',
  'photoOffsetY',
  'sectionTitlePreset',
])

const SPECIAL_TOP_LEVEL_FIELD_KEYS = new Set([
  'fontFamily',
  'themeColor',
])

const handleTemplateChange = (templateId: string) => {
  store.setActiveTemplateForCurrentFile(templateId)
}

const activeSchemaGroups = computed(() => {
  const groups = new Map<string, TemplateFieldSchema[]>()

  for (const field of store.currentTemplate?.editorSchema ?? []) {
    if (
      HIDDEN_PREVIEW_FIELD_KEYS.has(field.key) ||
      SPECIAL_TOP_LEVEL_FIELD_KEYS.has(field.key)
    ) {
      continue
    }

    const groupName = field.group || '基础'
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }

    groups.get(groupName)?.push(field)
  }

  return Array.from(groups.entries()).map(([name, fields]) => ({
    name,
    icon: GROUP_ICONS[name] ?? 'tune',
    fields,
  })).filter(group => group.fields.length > 0)
})

const fontField = computed(
  () => store.currentTemplate?.editorSchema.find(field => field.key === 'fontFamily') ?? null,
)

const themeColorField = computed(
  () => store.currentTemplate?.editorSchema.find(field => field.key === 'themeColor') ?? null,
)

const resolvedTemplateValues = computed(() =>
  store.currentTemplate
    ? resolveTemplateValues(store.currentTemplate, store.templateValues)
    : store.templateValues,
)

const photoAdjustments = computed<PhotoAdjustments>(() =>
  resolvePhotoAdjustments(resolvedTemplateValues.value),
)

const PHOTO_SLIDERS = [
  { key: 'photoSize', label: '大小', min: 88, max: 112, step: 1, unit: '%' },
  { key: 'photoOffsetY', label: '上下', min: -24, max: 24, step: 1, unit: 'px' },
  { key: 'photoOffsetX', label: '左右', min: -24, max: 24, step: 1, unit: 'px' },
] as const

const getFieldValue = (field: TemplateFieldSchema): TemplateValue => {
  const overrideValue = store.templateValues?.[field.key]
  if (overrideValue !== undefined) {
    return overrideValue
  }

  return store.currentTemplate?.defaults?.[field.key] ?? ''
}

const getDisplayValue = (field: TemplateFieldSchema) => {
  const value = getFieldValue(field)
  if (typeof value === 'number') {
    return `${value}${field.unit ?? ''}`
  }

  return String(value)
}

const setFieldValue = (key: string, value: TemplateValue) => {
  store.setTemplateValue(key, value)
}

const handleThemeColorHexInput = (fieldKey: string, event: Event) => {
  const nextValue = (event.target as HTMLInputElement).value.trim()
  if (/^[0-9A-Fa-f]{6}$/.test(nextValue)) {
    setFieldValue(fieldKey, `#${nextValue}`)
  }
}

const isThemeColorSelected = (field: TemplateFieldSchema, color: string) =>
  String(getFieldValue(field)).toLowerCase() === color.toLowerCase()

const isSegmentedSelectField = (field: TemplateFieldSchema) =>
  field.key === 'dateWeight' && (field.options?.length ?? 0) > 0

const setPhotoVisibility = (visible: boolean) => {
  setFieldValue('photoVisible', visible)
}

const setPhotoSliderValue = (
  key: typeof PHOTO_SLIDERS[number]['key'],
  value: number,
) => {
  setFieldValue(key, value)
}

const getPhotoSliderValue = (key: typeof PHOTO_SLIDERS[number]['key']) =>
  Number(resolvedTemplateValues.value[key] ?? 0)
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
        v-if="fontField"
        class="preview-toolbar-font-select"
        :model-value="String(getFieldValue(fontField))"
        width="108px"
        placeholder="字体"
        @update:model-value="setFieldValue(fontField.key, $event as string)"
      >
        <el-option
          v-for="option in fontField.options ?? []"
          :key="String(option.value)"
          :label="option.label"
          :value="String(option.value)"
        />
      </SoftSelect>

      <el-popover
        v-if="themeColorField"
        placement="bottom"
        trigger="click"
        :width="240"
        popper-class="preview-toolbar-popper preview-toolbar-theme-popper"
      >
        <template #reference>
          <div class="preview-toolbar-icon cursor-pointer" :title="themeColorField.label">
            <div
              class="preview-theme-trigger-indicator h-4 w-4 rounded-full border border-outline-variant/50 shadow-inner"
              :style="{ backgroundColor: String(getFieldValue(themeColorField)) }"
            ></div>
          </div>
        </template>

        <div class="preview-toolbar-panel preview-theme-panel flex flex-col gap-3 font-sans">
          <div class="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <span>{{ themeColorField.label }}</span>
          </div>

          <div class="preview-theme-grid">
            <button
              v-for="color in THEME_COLORS"
              :key="color"
              type="button"
              class="preview-theme-swatch"
              :class="{ 'is-active': isThemeColorSelected(themeColorField, color) }"
              :style="{ backgroundColor: color }"
              @click="setFieldValue(themeColorField.key, color)"
            >
              <span
                v-if="isThemeColorSelected(themeColorField, color)"
                class="material-symbols-outlined text-[16px] text-white drop-shadow-md"
              >
                check
              </span>
            </button>
          </div>

          <div class="preview-theme-custom-row">
            <label class="preview-theme-custom-trigger">
              <div
                class="absolute inset-0 z-0 rounded-full"
                :style="{ backgroundColor: String(getFieldValue(themeColorField)) }"
              ></div>
              <span class="material-symbols-outlined pointer-events-none z-10 text-[18px] text-white/80 drop-shadow">colorize</span>
              <input
                :value="String(getFieldValue(themeColorField))"
                type="color"
                class="preview-theme-native-input"
                @input="setFieldValue(themeColorField.key, ($event.target as HTMLInputElement).value)"
              />
            </label>

            <div class="preview-theme-hex-field">
              <span class="mr-1 font-mono text-xs text-on-surface-variant/50">#</span>
              <input
                type="text"
                :value="String(getFieldValue(themeColorField)).replace('#', '')"
                class="preview-theme-hex-input"
                maxlength="6"
                @input="handleThemeColorHexInput(themeColorField.key, $event)"
              />
            </div>
          </div>
        </div>
      </el-popover>

      <el-popover
        placement="bottom"
        trigger="click"
        :width="280"
        popper-class="preview-toolbar-popper preview-toolbar-photo-popper"
      >
        <template #reference>
          <button
            type="button"
            class="preview-toolbar-icon cursor-pointer"
            :class="{ 'is-active': photoAdjustments.visible }"
            title="证件照调整"
          >
            <span class="material-symbols-outlined text-[15px]">portrait</span>
          </button>
        </template>

        <div class="preview-toolbar-panel preview-photo-panel flex flex-col gap-3 font-sans">
          <div class="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <span>证件照</span>
            <span class="text-[11px] text-on-surface-variant/60">
              {{ store.photoBase64 ? '已添加照片' : '未添加照片' }}
            </span>
          </div>

          <div class="preview-field-stack">
            <div class="preview-field-block">
              <div class="mb-2 text-xs font-bold text-on-surface-variant">显示状态</div>
              <div class="preview-segmented-control">
                <button
                  type="button"
                  class="preview-segmented-button"
                  :class="{ 'is-active': photoAdjustments.visible }"
                  @click="setPhotoVisibility(true)"
                >
                  显示
                </button>
                <button
                  type="button"
                  class="preview-segmented-button"
                  :class="{ 'is-active': !photoAdjustments.visible }"
                  @click="setPhotoVisibility(false)"
                >
                  隐藏
                </button>
              </div>
              <p
                v-if="!store.photoBase64"
                class="mt-2 text-[11px] leading-5 text-on-surface-variant/70"
              >
                先在左侧照片库导入，或点击预览里的照片占位区添加。
              </p>
            </div>

            <div
              v-for="slider in PHOTO_SLIDERS"
              :key="slider.key"
              class="preview-field-block"
            >
              <div class="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
                <span>{{ slider.label }}</span>
                <span class="text-primary">{{ getPhotoSliderValue(slider.key) }}{{ slider.unit }}</span>
              </div>
              <el-slider
                :model-value="getPhotoSliderValue(slider.key)"
                :min="slider.min"
                :max="slider.max"
                :step="slider.step"
                :show-tooltip="false"
                @update:model-value="setPhotoSliderValue(slider.key, Number($event))"
              />
            </div>
          </div>
        </div>
      </el-popover>

      <el-dropdown
        v-for="group in activeSchemaGroups"
        :key="group.name"
        trigger="click"
        :hide-on-click="false"
        popper-class="soft-dropdown-popper preview-toolbar-popper"
      >
        <button class="preview-toolbar-icon cursor-pointer" :title="group.name">
          <span class="material-symbols-outlined text-[14px]">{{ group.icon }}</span>
        </button>
        <template #dropdown>
          <div class="preview-toolbar-panel preview-group-panel w-72 rounded-xl p-4 font-sans shadow-ambient">
            <div class="mb-3 flex items-center justify-between text-xs font-bold text-on-surface-variant">
              <span>{{ group.name }}</span>
              <span class="text-[11px] text-on-surface-variant/60">{{ group.fields.length }} 项</span>
            </div>

            <div class="preview-field-stack">
              <div
                v-for="field in group.fields"
                :key="field.key"
                class="preview-field-block"
              >
                <template v-if="field.type === 'color'">
                  <div class="mb-2 flex items-center justify-between text-xs font-bold text-on-surface-variant">
                    <span>{{ field.label }}</span>
                  </div>

                  <div class="preview-theme-grid">
                    <button
                      v-for="color in THEME_COLORS"
                      :key="color"
                      type="button"
                      class="preview-theme-swatch"
                      :class="{ 'is-active': isThemeColorSelected(field, color) }"
                      :style="{ backgroundColor: color }"
                      @click="setFieldValue(field.key, color)"
                    >
                      <span
                        v-if="isThemeColorSelected(field, color)"
                        class="material-symbols-outlined text-[16px] text-white drop-shadow-md"
                      >
                        check
                      </span>
                    </button>
                  </div>

                  <div class="preview-theme-custom-row">
                    <label class="preview-theme-custom-trigger">
                      <div
                        class="absolute inset-0 z-0 rounded-full"
                        :style="{ backgroundColor: String(getFieldValue(field)) }"
                      ></div>
                      <span class="material-symbols-outlined pointer-events-none z-10 text-[18px] text-white/80 drop-shadow">colorize</span>
                      <input
                        :value="String(getFieldValue(field))"
                        type="color"
                        class="preview-theme-native-input"
                        @input="setFieldValue(field.key, ($event.target as HTMLInputElement).value)"
                      />
                    </label>

                    <div class="preview-theme-hex-field">
                      <span class="mr-1 font-mono text-xs text-on-surface-variant/50">#</span>
                      <input
                        type="text"
                        :value="String(getFieldValue(field)).replace('#', '')"
                        class="preview-theme-hex-input"
                        maxlength="6"
                        @input="handleThemeColorHexInput(field.key, $event)"
                      />
                    </div>
                  </div>
                </template>

                <template v-else-if="field.type === 'number'">
                  <div class="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
                    <span>{{ field.label }}</span>
                    <span class="text-primary">{{ getDisplayValue(field) }}</span>
                  </div>
                  <el-slider
                    :model-value="Number(getFieldValue(field))"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step ?? 1"
                    :show-tooltip="false"
                    @update:model-value="setFieldValue(field.key, Number($event))"
                  />
                </template>

                <template v-else-if="field.type === 'select' && isSegmentedSelectField(field)">
                  <div class="mb-2 text-xs font-bold text-on-surface-variant">{{ field.label }}</div>
                  <div class="preview-segmented-control">
                    <button
                      v-for="option in field.options ?? []"
                      :key="String(option.value)"
                      type="button"
                      class="preview-segmented-button"
                      :class="{ 'is-active': String(getFieldValue(field)) === String(option.value) }"
                      @click="setFieldValue(field.key, String(option.value))"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </template>

                <template v-else-if="field.type === 'select'">
                  <div class="mb-2 text-xs font-bold text-on-surface-variant">{{ field.label }}</div>
                  <SoftSelect
                    :model-value="String(getFieldValue(field))"
                    width="100%"
                    :placeholder="field.label"
                    @update:model-value="setFieldValue(field.key, $event as string)"
                  >
                    <el-option
                      v-for="option in field.options ?? []"
                      :key="String(option.value)"
                      :label="option.label"
                      :value="String(option.value)"
                    />
                  </SoftSelect>
                </template>

                <template v-else-if="field.type === 'boolean'">
                  <div class="mb-2 text-xs font-bold text-on-surface-variant">{{ field.label }}</div>
                  <div class="flex items-center gap-2 rounded-full bg-surface-container p-1">
                    <button
                      type="button"
                      class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      :class="getFieldValue(field) === true
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'"
                      @click="setFieldValue(field.key, true)"
                    >
                      开启
                    </button>
                    <button
                      type="button"
                      class="flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      :class="getFieldValue(field) === false
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'"
                      @click="setFieldValue(field.key, false)"
                    >
                      关闭
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="mb-2 text-xs font-bold text-on-surface-variant">{{ field.label }}</div>
                  <input
                    :value="String(getFieldValue(field))"
                    type="text"
                    class="preview-text-input"
                    :placeholder="field.placeholder || field.label"
                    @input="setFieldValue(field.key, ($event.target as HTMLInputElement).value)"
                  />
                </template>
              </div>
            </div>
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

.preview-toolbar-center :deep(.preview-toolbar-icon.is-active) {
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent);
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

.preview-group-panel {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  border-radius: 1rem;
}

.preview-theme-panel {
  gap: 0.875rem;
  padding: 0.25rem;
}

.preview-field-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-field-block + .preview-field-block {
  padding-top: 1rem;
  border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 16%, transparent);
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
  padding-top: 0.625rem;
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

.preview-theme-hex-input,
.preview-text-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  color: var(--color-on-surface-variant);
}

.preview-segmented-control {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--color-surface-container) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 18%, transparent);
}

.preview-segmented-button {
  flex: 1 1 0;
  min-height: 2.25rem;
  border-radius: 0.8rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-on-surface-variant);
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.preview-segmented-button:hover {
  color: var(--color-on-surface);
}

.preview-segmented-button.is-active {
  background: var(--color-surface-container-lowest);
  color: var(--color-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 12%, transparent),
    0 1px 4px rgba(15, 23, 42, 0.05);
}

:global(.preview-toolbar-popper) {
  border-radius: 1rem !important;
}

:global(.preview-toolbar-popper .el-dropdown-menu) {
  border-radius: 1rem !important;
}

:global(.preview-toolbar-popper .el-popper__arrow::before) {
  border-radius: 0.25rem !important;
}

.preview-theme-hex-input {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.preview-text-input {
  min-height: 2.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--color-surface-container) 92%, white);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline-variant) 18%, transparent);
  padding: 0.65rem 0.8rem;
}
</style>
