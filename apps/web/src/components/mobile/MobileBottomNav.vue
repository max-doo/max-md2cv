<script setup lang="ts">
defineProps<{
  activeTab: "editor" | "preview";
}>();

const emit = defineEmits<{
  (e: "switch-tab", tab: "editor" | "preview"): void;
}>();
</script>

<template>
  <nav
    class="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(15,23,42,0.04)] select-none safe-area-bottom pointer-events-auto"
  >
    <div
      role="tablist"
      aria-label="视图切换"
      class="flex h-13 max-w-sm mx-auto items-center justify-around px-4"
    >
      <!-- 编辑按钮 -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'editor'"
        @click="emit('switch-tab', 'editor')"
        class="flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer"
        :class="activeTab === 'editor'
          ? 'text-primary font-bold'
          : 'text-slate-400 hover:text-slate-600'"
      >
        <span
          class="material-symbols-outlined text-[22px] transition-transform duration-200"
          :style="activeTab === 'editor' ? { fontVariationSettings: `'FILL' 1` } : {}"
        >
          edit_note
        </span>
        <span class="text-[11px] mt-0.5 leading-none tracking-tight">编辑</span>
      </button>

      <!-- 预览按钮 -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'preview'"
        @click="emit('switch-tab', 'preview')"
        class="flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 cursor-pointer"
        :class="activeTab === 'preview'
          ? 'text-primary font-bold'
          : 'text-slate-400 hover:text-slate-600'"
      >
        <span
          class="material-symbols-outlined text-[22px] transition-transform duration-200"
          :style="activeTab === 'preview' ? { fontVariationSettings: `'FILL' 1` } : {}"
        >
          visibility
        </span>
        <span class="text-[11px] mt-0.5 leading-none tracking-tight">预览</span>
      </button>
    </div>
  </nav>
</template>
