<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { useResumeStore } from "@resume-store";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const store = useResumeStore();

// 模板选择
const activeTemplate = computed({
  get: () => store.activeTemplate,
  set: (val: string) => {
    store.setActiveTemplateForCurrentFile(val);
  },
});

const handleSelectTemplate = (id: string) => {
  store.setActiveTemplateForCurrentFile(id);
};

// 主题色候选板
const THEME_COLORS = [
  "#4c49cc", // 默认靛蓝
  "#0050d1", // 经典蓝
  "#0ea5e9", // 天空蓝
  "#10b981", // 翡翠绿
  "#b91c1c", // 绯红
  "#334155", // 雅致灰
];

const currentThemeColor = computed(() => {
  return (
    (store.templateValues?.themeColor as string) ||
    store.resumeStyle?.themeColor ||
    "#4c49cc"
  );
});

const setThemeColor = (hex: string) => {
  store.setTemplateValue("themeColor", hex);
};

// 间距预设映射 (紧凑 1 / 标准 2 / 宽松 3)
const spacingMode = computed(() => {
  const pSpace = Number(
    store.templateValues?.paragraphSpacing ??
    store.resumeStyle?.paragraphSpacing ??
    5,
  );
  if (pSpace <= 3) return "compact";
  if (pSpace >= 8) return "loose";
  return "standard";
});

const setSpacing = (mode: "compact" | "standard" | "loose") => {
  if (mode === "compact") {
    store.setTemplateValues({
      paragraphSpacing: 3,
      lineHeight: 1.25,
      h2MarginTop: 6,
      h2MarginBottom: 3,
    });
  } else if (mode === "loose") {
    store.setTemplateValues({
      paragraphSpacing: 8,
      lineHeight: 1.5,
      h2MarginTop: 10,
      h2MarginBottom: 5,
    });
  } else {
    // 恢复标准默认
    store.setTemplateValues({
      paragraphSpacing: 5,
      lineHeight: 1.35,
      h2MarginTop: 8,
      h2MarginBottom: 4,
    });
  }
};

const handleImportPhoto = async () => {
  try {
    await store.importIdPhoto();
  } catch (error) {
    const message = error instanceof Error ? error.message : "证件照上传失败，请重试";
    ElMessage.warning(message);
  }
};

const handleRemovePhoto = async () => {
  await store.deletePhoto("");
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
  <div class="mobile-adjust-sheet-wrapper">
    <!-- 背景遮罩 -->
    <div
      class="mobile-sheet-backdrop fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-50"
      :class="{ 'mobile-sheet-backdrop--open': visible }"
      @click="emit('close')"
    ></div>

    <!-- 底部抽屉主体 -->
    <div
      class="mobile-sheet-panel fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-[28px] z-50 p-5 shadow-2xl flex flex-col safe-area-bottom select-none"
      :class="{ 'mobile-sheet-panel--open': visible, 'pointer-events-none': !visible }"
      :aria-hidden="!visible"
      :inert="!visible || undefined"
    >
      <!-- 抓手条 -->
      <div class="w-10 h-1 rounded-full bg-slate-200 self-center mb-3"></div>

      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 class="text-sm font-bold text-slate-800">简历风格与调整</h3>
        <button
          type="button"
          @click="emit('close')"
          class="text-xs font-bold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
        >
          完成
        </button>
      </div>

      <div class="py-3 overflow-y-auto space-y-4 text-xs">
        <!-- 证件照项 -->
        <div class="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-12 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
              <img
                v-if="store.photoBase64"
                :src="store.photoBase64"
                alt="证件照"
                class="w-full h-full object-cover"
              />
              <span v-else class="material-symbols-outlined text-[20px] text-slate-400">person</span>
            </div>
            <div>
              <span class="font-bold text-slate-800 block text-xs">个人证件照</span>
              <span class="text-[11px] text-slate-400">
                {{ store.photoBase64 ? "已设置照片" : "未上传 (选填)" }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              @click="handleImportPhoto"
              class="px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
            >
              上传/更换
            </button>
            <button
              v-if="store.photoBase64"
              type="button"
              @click="handleRemovePhoto"
              class="px-2.5 py-1.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
            >
              移除
            </button>
          </div>
        </div>

        <!-- 模板选择 -->
        <div>
          <span class="font-bold text-slate-600 block mb-2">模板样式</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="tmpl in store.availableTemplates"
              :key="tmpl.id"
              type="button"
              @click="handleSelectTemplate(tmpl.id)"
              class="py-2.5 px-1 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer truncate"
              :class="activeTemplate === tmpl.id
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'"
              :title="tmpl.name"
            >
              {{ tmpl.name }}
            </button>
          </div>
        </div>

        <!-- 主题色 -->
        <div>
          <span class="font-bold text-slate-600 block mb-2">主题颜色</span>
          <div class="flex items-center gap-3">
            <button
              v-for="color in THEME_COLORS"
              :key="color"
              type="button"
              :title="color"
              @click="setThemeColor(color)"
              class="w-7 h-7 rounded-full transition-transform active:scale-90 cursor-pointer"
              :style="{ backgroundColor: color }"
              :class="currentThemeColor.toLowerCase() === color.toLowerCase()
                ? 'ring-2 ring-offset-2 ring-primary scale-110'
                : 'hover:scale-105'"
            ></button>
          </div>
        </div>

        <!-- 间距微调 -->
        <div>
          <span class="font-bold text-slate-600 block mb-2">正文排版间隙</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="setSpacing('compact')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'compact'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'"
            >
              紧凑
            </button>
            <button
              type="button"
              @click="setSpacing('standard')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'standard'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'"
            >
              标准
            </button>
            <button
              type="button"
              @click="setSpacing('loose')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'loose'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'"
            >
              宽松
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
