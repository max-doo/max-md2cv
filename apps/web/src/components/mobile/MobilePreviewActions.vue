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
    class="mobile-preview-actions fixed left-1/2 -translate-x-1/2 z-30 select-none bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
  >
    <div class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/92 backdrop-blur-xl shadow-ambient ghost-border">
      <!-- 简历调整 -->
      <button
        type="button"
        @click="emit('open-adjust')"
        class="flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-[16px] text-primary">tune</span>
        <span>简历调整</span>
      </button>

      <!-- 分隔线 -->
      <div class="w-px h-3.5 bg-slate-200/70"></div>

      <!-- 一页排版 -->
      <button
        type="button"
        @click="emit('smart-one-page')"
        :disabled="isAutoFitting"
        :aria-busy="isAutoFitting"
        class="flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-full text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:pointer-events-none cursor-pointer"
      >
        <span v-if="isAutoFitting" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
        <span v-else class="material-symbols-outlined text-[16px]">auto_fix_high</span>
        <span>一页排版</span>
      </button>
    </div>
  </div>
</template>
