<script setup lang="ts">
import { ref } from 'vue'
import SoftSelect from '../shared/SoftSelect.vue'
import SyntaxHelpDialog from './SyntaxHelpDialog.vue'
import {
  INSERT_MENU_OPTIONS,
  LINE_FORMAT_OPTIONS,
  getLineFormatOption,
  type InsertMenuValue,
  type LineFormatValue,
} from './toolbarOptions'

defineProps<{
  currentLineFormat: LineFormatValue
  hasActiveFile: boolean
  hasCopiedMarkdown: boolean
  hasTextSelection: boolean
  isFormattingDisabled: boolean
  isRenderView: boolean
}>()

const emit = defineEmits<{
  (event: 'apply-line-format', value: LineFormatValue): void
  (event: 'copy-markdown'): void
  (event: 'insert-command', value: InsertMenuValue): void
  (event: 'insert-emphasis'): void
  (event: 'toggle-bold'): void
  (event: 'toggle-italic'): void
  (event: 'toggle-view'): void
}>()

const handleInsertCommand = (command: string | number | object) => {
  if (typeof command !== 'string') {
    return
  }

  emit('insert-command', command as InsertMenuValue)
}

const isHelpDialogOpen = ref(false)
</script>

<template>
  <div
    class="flex h-14 shrink-0 items-center justify-center border-b border-outline-variant/10 bg-surface-container-lowest/50 px-6 backdrop-blur-sm transition-all duration-300"
    :class="{ 'pointer-events-none opacity-20 grayscale': !hasActiveFile }"
  >
    <div
      class="editor-toolbar-actions transition-opacity"
      :class="{ 'opacity-45': isFormattingDisabled }"
    >
      <SoftSelect
        :model-value="currentLineFormat"
        placeholder="文本属性"
        width="3.5rem"
        centered
        :disabled="isFormattingDisabled"
        @update:model-value="emit('apply-line-format', $event as LineFormatValue)"
      >
        <template #label="{ value }">
          <span class="editor-line-format-current">
            <span class="material-symbols-outlined text-[18px]">
              {{ getLineFormatOption(value as LineFormatValue).icon }}
            </span>
          </span>
        </template>
        <el-option
          v-for="option in LINE_FORMAT_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        >
          <div class="editor-line-format-option">
            <span class="editor-toolbar-dropdown-icon material-symbols-outlined text-[18px]">
              {{ option.icon }}
            </span>
            <span>{{ option.label }}</span>
          </div>
        </el-option>
      </SoftSelect>

      <button
        type="button"
        class="editor-toolbar-icon group"
        title="加粗"
        :disabled="isFormattingDisabled || !hasTextSelection"
        @click="emit('toggle-bold')"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          format_bold
        </span>
      </button>

      <button
        type="button"
        class="editor-toolbar-icon group"
        title="斜体"
        :disabled="isFormattingDisabled || !hasTextSelection"
        @click="emit('toggle-italic')"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          format_italic
        </span>
      </button>

      <button
        type="button"
        class="editor-toolbar-icon group"
        title="强调"
        :disabled="isFormattingDisabled || !hasTextSelection"
        @click="emit('insert-emphasis')"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          priority_high
        </span>
      </button>

      <el-dropdown trigger="click" popper-class="soft-dropdown-popper" :disabled="isFormattingDisabled" @command="handleInsertCommand">
        <button type="button" class="editor-toolbar-icon group" title="插入" :disabled="isFormattingDisabled">
          <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
            add
          </span>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="soft-dropdown-menu editor-toolbar-dropdown">
            <el-dropdown-item
              v-for="option in INSERT_MENU_OPTIONS"
              :key="option.value"
              :command="option.value"
            >
              <div class="editor-toolbar-dropdown-item">
                <span class="editor-toolbar-dropdown-icon material-symbols-outlined text-[18px]">
                  {{ option.icon }}
                </span>
                <span>{{ option.label }}</span>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <span class="editor-toolbar-divider" aria-hidden="true"></span>

      <button
        type="button"
        class="editor-toolbar-icon group"
        :class="{ 'editor-toolbar-icon-active': isRenderView }"
        :title="isRenderView ? '切换到源码视图' : '切换到渲染视图'"
        @click="emit('toggle-view')"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          code_off
        </span>
      </button>

      <button
        type="button"
        class="editor-toolbar-icon group"
        :title="hasCopiedMarkdown ? '已复制 Markdown 文本' : '复制 Markdown 文本'"
        @click="emit('copy-markdown')"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          {{ hasCopiedMarkdown ? 'check' : 'content_copy' }}
        </span>
      </button>

      <button
        type="button"
        class="editor-toolbar-icon group"
        title="语法说明"
        @click="isHelpDialogOpen = true"
      >
        <span class="material-symbols-outlined text-xl transition-transform group-hover:scale-110">
          help_outline
        </span>
      </button>
    </div>

    <SyntaxHelpDialog v-model="isHelpDialogOpen" />
  </div>
</template>

<style scoped>
.editor-toolbar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  color: var(--color-on-surface-variant);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.editor-toolbar-icon:hover:not(:disabled) {
  background-color: var(--color-surface-container-low);
  color: var(--color-on-surface);
}

.editor-toolbar-icon:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.editor-toolbar-icon-active {
  background-color: color-mix(in srgb, var(--color-primary) 10%, white);
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.editor-toolbar-icon-active:hover {
  background-color: color-mix(in srgb, var(--color-primary) 14%, white);
  color: var(--color-primary);
}

.editor-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 100%;
}

.editor-toolbar-divider {
  width: 1px;
  height: 1.25rem;
  margin-inline: 0.25rem 0.125rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-outline-variant) 72%, white);
}

.editor-toolbar-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: inherit;
}

.editor-toolbar-dropdown-icon {
  color: color-mix(in srgb, var(--color-on-surface-variant) 88%, white);
}

.editor-line-format-current {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.editor-line-format-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: inherit;
}
</style>
