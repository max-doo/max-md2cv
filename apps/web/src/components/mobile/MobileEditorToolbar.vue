<script setup lang="ts">
import { ref } from "vue";

export type MobileFormatAction =
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "emphasis"
  | "list"
  | "quote"
  | "link";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "format", action: MobileFormatAction): void;
  (e: "dismiss"): void;
}>();

const scrollContainer = ref<HTMLElement | null>(null);
let touchStartX = 0;
let touchStartScroll = 0;
let isSwiping = false;

const onTouchStart = (e: TouchEvent) => {
  touchStartX = e.touches[0]?.clientX ?? 0;
  touchStartScroll = scrollContainer.value?.scrollLeft ?? 0;
  isSwiping = false;
};

const onTouchMove = (e: TouchEvent) => {
  if (!scrollContainer.value) return;
  const currentX = e.touches[0]?.clientX ?? 0;
  const deltaX = touchStartX - currentX;
  if (Math.abs(deltaX) > 6) {
    isSwiping = true;
  }
  scrollContainer.value.scrollLeft = touchStartScroll + deltaX;
};

const handleAction = (action: MobileFormatAction) => {
  if (isSwiping) return;
  emit("format", action);
};

const handleDismiss = () => {
  if (isSwiping) return;
  emit("dismiss");
};
</script>

<template>
  <div
    class="mobile-bubble-toolbar absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 flex items-center justify-between p-1.5 rounded-2xl bg-slate-900/92 backdrop-blur-md shadow-2xl text-white select-none border border-white/10"
    :class="{ 'mobile-bubble-toolbar--visible': visible }"
    @mousedown.prevent
    @touchstart.prevent="onTouchStart"
    @touchmove="onTouchMove"
  >
    <div
      ref="scrollContainer"
      class="flex items-center gap-1 overflow-x-auto hide-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full px-1"
    >
      <span class="text-[10px] text-indigo-300 font-bold px-1 shrink-0 uppercase tracking-wider">格式</span>
      <button
        type="button"
        @click="handleAction('h2')"
        @touchend.prevent="handleAction('h2')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors cursor-pointer"
      >
        H2
      </button>
      <button
        type="button"
        @click="handleAction('h3')"
        @touchend.prevent="handleAction('h3')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors cursor-pointer"
      >
        H3
      </button>
      <button
        type="button"
        @click="handleAction('bold')"
        @touchend.prevent="handleAction('bold')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors cursor-pointer"
      >
        粗体
      </button>
      <button
        type="button"
        @click="handleAction('italic')"
        @touchend.prevent="handleAction('italic')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs italic shrink-0 transition-colors cursor-pointer"
      >
        斜体
      </button>
      <button
        type="button"
        @click="handleAction('emphasis')"
        @touchend.prevent="handleAction('emphasis')"
        class="px-2 py-1 rounded-lg bg-primary/40 text-primary-fixed hover:bg-primary/60 text-xs font-bold shrink-0 transition-colors cursor-pointer"
      >
        强调
      </button>
      <button
        type="button"
        @click="handleAction('list')"
        @touchend.prevent="handleAction('list')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors cursor-pointer"
      >
        • 列表
      </button>
      <button
        type="button"
        @click="handleAction('quote')"
        @touchend.prevent="handleAction('quote')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors cursor-pointer"
      >
        “ 引用
      </button>
      <button
        type="button"
        @click="handleAction('link')"
        @touchend.prevent="handleAction('link')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors cursor-pointer"
      >
        链接
      </button>
      <button
        type="button"
        @click="handleDismiss"
        @touchend.prevent="handleDismiss"
        class="px-2 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white text-xs shrink-0 ml-auto transition-colors cursor-pointer"
      >
        ✕
      </button>
    </div>
  </div>
</template>
