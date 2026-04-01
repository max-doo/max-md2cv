<script setup lang="ts">
import { useResumeStore } from '@resume-store'
import ResumeOutlineTree from './ResumeOutlineTree.vue'

const store = useResumeStore()

const handleJump = (nodeId: string) => {
  store.requestEditorJump(nodeId)
}

const handleReorder = async (payload: { nodeId: string; targetIndex: number; parentId: string | null }) => {
  await store.moveOutlineNode(payload.nodeId, payload.targetIndex, payload.parentId)
}
</script>

<template>
  <div class="h-full min-h-0">
    <div
      v-if="!store.activeFilePath"
      class="flex h-full flex-col items-center justify-center gap-4 text-center text-on-surface-variant opacity-70"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <span class="material-symbols-outlined text-3xl">format_list_bulleted</span>
      </div>
      <p class="text-sm font-medium">请选择一份简历查看大纲</p>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col">
      <div class="shrink-0 px-1 pb-3">
        <h3 class="sidebar-document-title truncate text-center text-base font-semibold text-on-surface">{{ store.activeFileName }}</h3>
      </div>

      <section
        v-if="store.outlineTree.length === 0"
        class="sidebar-section-card flex min-h-56 flex-1 flex-col items-center justify-center gap-3 text-center text-on-surface-variant"
      >
        <span class="material-symbols-outlined text-3xl">segment</span>
        <p class="text-sm font-medium">未检测到二级、三级或四级标题</p>
        <p class="text-xs leading-5">
          你可以在正文中使用 <code>##</code>、<code>###</code>、<code>####</code> 建立可拖拽的大纲结构。
        </p>
      </section>

      <section v-else class="sidebar-panel-scroll flex-1 pb-2">
        <div class="px-1">
          <ResumeOutlineTree
            :nodes="store.outlineTree"
            :parent-id="null"
            :depth="0"
            @jump="handleJump"
            @reorder="handleReorder"
          />
        </div>
      </section>
    </div>
  </div>
</template>
