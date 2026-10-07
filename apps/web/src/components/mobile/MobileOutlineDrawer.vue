<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import ResumeOutlinePanel from "@desktop/components/sidebar/ResumeOutlinePanel.vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "jump", nodeId: string): void;
}>();

const handleJump = (nodeId: string) => {
  emit("jump", nodeId);
  emit("close");
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.visible) {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="mobile-outline-drawer-wrapper">
    <!-- 背景遮罩 -->
    <div
      class="mobile-sheet-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50"
      :class="{ 'mobile-sheet-backdrop--open': visible }"
      @click="emit('close')"
    ></div>

    <!-- 侧边抽屉主体 (从左滑出) -->
    <aside
      class="fixed inset-y-0 left-0 w-[84vw] max-w-[320px] bg-white z-50 shadow-2xl flex flex-col select-none transition-transform duration-300 ease-out safe-area-bottom"
      :class="visible ? 'translate-x-0' : '-translate-x-full pointer-events-none'"
      :aria-hidden="!visible"
      :inert="!visible || undefined"
    >
      <!-- 抽屉顶栏 -->
      <div class="flex h-14 shrink-0 items-center justify-between px-4 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px] text-primary">dock_to_right</span>
          <h3 class="text-sm font-bold text-slate-800">大纲调整</h3>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="关闭大纲"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <!-- 提示条 -->
      <div class="px-4 py-2 bg-slate-50/80 border-b border-slate-100/60 text-[11px] text-slate-500 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[14px] text-slate-400">drag_indicator</span>
        <span>可上下拖拽模块排序，点击快速跳转</span>
      </div>

      <!-- 大纲内容 -->
      <div class="flex-1 overflow-y-auto p-3">
        <ResumeOutlinePanel
          :hide-document-title="true"
          @jump="handleJump"
        />
      </div>
    </aside>
  </div>
</template>
