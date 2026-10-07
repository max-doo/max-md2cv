<script setup lang="ts">
withDefaults(
  defineProps<{
    isAutoFitting?: boolean;
  }>(),
  {
    isAutoFitting: false,
  },
);

const emit = defineEmits<{
  (e: "open-adjust"): void;
  (e: "smart-one-page"): void;
}>();
</script>

<template>
  <div
    class="mobile-preview-actions fixed left-1/2 -translate-x-1/2 z-30 select-none whitespace-nowrap bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
  >
    <div class="flex items-center flex-nowrap gap-1.5 px-3.5 py-1.5 rounded-full bg-white/92 backdrop-blur-xl shadow-ambient border border-slate-200/70 whitespace-nowrap">
      <!-- 简历调整 -->
      <button
        type="button"
        @click="emit('open-adjust')"
        class="flex items-center flex-nowrap shrink-0 gap-1.5 px-3 py-1.5 min-h-[34px] rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
      >
        <span class="material-symbols-outlined text-[16px] text-primary shrink-0">tune</span>
        <span class="whitespace-nowrap">简历调整</span>
      </button>

      <!-- 分隔线 -->
      <div class="w-px h-3.5 bg-slate-200/70 shrink-0"></div>

      <!-- 智能一页 -->
      <button
        type="button"
        @click="emit('smart-one-page')"
        :disabled="isAutoFitting"
        :aria-busy="isAutoFitting"
        class="flex items-center flex-nowrap shrink-0 gap-1.5 px-3 py-1.5 min-h-[34px] rounded-full text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:pointer-events-none cursor-pointer whitespace-nowrap"
      >
        <span v-if="isAutoFitting" class="material-symbols-outlined text-[16px] animate-spin shrink-0">progress_activity</span>
        <span v-else class="material-symbols-outlined text-[16px] shrink-0">auto_fix_high</span>
        <span class="whitespace-nowrap">智能一页</span>
      </button>
    </div>
  </div>
</template>
