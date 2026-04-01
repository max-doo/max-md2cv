<script setup lang="ts">
import { computed } from 'vue'
import { useResumeStore } from '@resume-store'

const store = useResumeStore()

const currentFileName = computed(() => {
  return store.activeFileName ?? ''
})

const currentFileStatusLabel = computed(() => {
  if (store.activeFileStatus === 'missing') {
    return '已删除'
  }

  if (store.activeFileStatus === 'conflict') {
    return '有冲突'
  }

  return ''
})

const handleExport = async () => {
  await store.exportCurrentPdf()
}
</script>

<template>
  <nav class="z-50 w-full shrink-0 bg-transparent font-['Manrope'] text-sm font-medium tracking-wide antialiased">
    <div class="flex h-16 min-w-0 items-center justify-between gap-6 px-8">
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <button
          v-show="!store.isSidebarOpen"
          title="展开侧边栏"
          @click="store.isSidebarOpen = true"
          class="group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-surface-variant"
        >
          <span
            class="material-symbols-outlined text-[30px]! text-on-surface transition-colors group-hover:text-primary"
          >
            dock_to_right
          </span>
        </button>

        <div v-if="currentFileName" class="flex min-w-0 flex-1 items-center gap-3">
          <div
            class="min-w-0 max-w-[20rem] truncate text-base font-semibold tracking-[0.02em] text-on-surface lg:max-w-[28rem]"
            :title="currentFileName"
          >
            {{ currentFileName }}
          </div>

          <span
            v-if="currentFileStatusLabel"
            class="rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error"
          >
            {{ currentFileStatusLabel }}
          </span>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-4">
        <button
          @click="handleExport"
          :disabled="store.isExporting || store.isPreviewRendering || !store.isPreviewReady"
          class="btn-primary shrink-0"
        >
          <span v-if="store.isExporting" class="material-symbols-outlined animate-spin text-base">refresh</span>
          <span v-else class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">download</span>
          <span>导出为 PDF</span>
        </button>
      </div>
    </div>
  </nav>
</template>
