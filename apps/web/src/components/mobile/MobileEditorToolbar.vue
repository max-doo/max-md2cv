<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";

export type MobileFormatAction = "h2" | "h3" | "bold" | "italic" | "emphasis" | "list" | "quote" | "link";

const props = defineProps<{
  visible: boolean;
  editorElement?: HTMLElement;
}>();

const emit = defineEmits<{
  (e: "format", action: MobileFormatAction): void;
  (e: "dismiss"): void;
}>();

const actions: { value: MobileFormatAction; label: string; icon: string }[] = [
  { value: "bold", label: "粗体", icon: "format_bold" },
  { value: "italic", label: "斜体", icon: "format_italic" },
  { value: "emphasis", label: "强调", icon: "priority_high" },
  { value: "h2", label: "二级标题", icon: "format_h2" },
  { value: "h3", label: "三级标题", icon: "format_h3" },
  { value: "list", label: "列表", icon: "format_list_bulleted" },
  { value: "quote", label: "引用", icon: "format_quote" },
  { value: "link", label: "链接", icon: "link" },
];

const toolbar = ref<HTMLElement | null>(null);
const top = ref(0);
let resizeObserver: ResizeObserver | null = null;

const updatePosition = () => {
  if (!toolbar.value || !props.editorElement) return;
  const editorRect = props.editorElement.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  // Stay above both the keyboard and the bottom navigation, including iOS pan.
  const bottom = Math.min(editorRect.bottom, viewportBottom);
  top.value = Math.max(viewportTop + 8, bottom - toolbar.value.offsetHeight - 12);
};

watch(() => [props.visible, props.editorElement], async () => {
  await nextTick();
  resizeObserver?.disconnect();
  if (toolbar.value) resizeObserver?.observe(toolbar.value);
  if (props.editorElement) resizeObserver?.observe(props.editorElement);
  updatePosition();
}, { immediate: true });

onMounted(() => {
  resizeObserver = new ResizeObserver(updatePosition);
  if (toolbar.value) resizeObserver.observe(toolbar.value);
  if (props.editorElement) resizeObserver.observe(props.editorElement);
  window.addEventListener("resize", updatePosition);
  window.visualViewport?.addEventListener("resize", updatePosition);
  window.visualViewport?.addEventListener("scroll", updatePosition);
  updatePosition();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updatePosition);
  window.visualViewport?.removeEventListener("resize", updatePosition);
  window.visualViewport?.removeEventListener("scroll", updatePosition);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="toolbar"
      role="toolbar"
      aria-label="选中文字格式"
      class="mobile-bubble-toolbar mobile-bubble-toolbar--visible fixed left-3 right-3 z-40 flex items-center gap-1 rounded-2xl bg-surface-container-lowest p-1.5 text-on-surface shadow-ambient select-none"
      :style="{ top: `${top}px` }"
      @pointerdown.prevent
      @mousedown.prevent
    >
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
        <button
          v-for="action in actions"
          :key="action.value"
          type="button"
          :aria-label="action.label"
          :title="action.label"
          class="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container active:bg-primary/10 active:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          @click="emit('format', action.value)"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ action.icon }}</span>
          <span v-if="action.value === 'bold' || action.value === 'italic' || action.value === 'emphasis'">{{ action.label }}</span>
        </button>
      </div>
      <button
        type="button"
        aria-label="收起格式工具条"
        title="收起格式工具条"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container active:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"
        @click="emit('dismiss')"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
      </button>
    </div>
  </Teleport>
</template>
