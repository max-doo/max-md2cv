# Mobile Web Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 max-md2cv Web Playground 构建高性能、原生体验的移动端操作层，保留单一页面入口与单实例编辑器/渲染器生命周期，支持分段编辑/预览、划词浮动格式工具条、A4 自适应宽度预览、证件照上传与底部样式微调抽屉。

**Architecture:** 采用“共享编辑与渲染核心，新增移动端操作层”的架构设计。Web 端基于视口宽度响应式切换单栏/双栏布局，全局保持唯一的 `EditorPane` 与 `PreviewPane` 实例；通过向共享组件开放具名插槽与指令暴露接口，桌面端无缝保留默认工具栏与页脚，移动端注入专用操作层组件。

**Tech Stack:** Vue 3, TypeScript, Pinia, Tailwind CSS, CodeMirror 6, Paged.js, Element Plus, Vite.

---

## File Structure & Responsibilities

```
apps/web/
├── index.html                               # 补充 viewport-fit=cover
├── src/
│   ├── App.vue                              # 统一入口，移动端单列流 + 桌面端双栏流，维护单实例生命周期
│   ├── styles/app.css                       # 移动端专用视口、触控安全区、浮动工具栏与抽屉动效样式
│   ├── stores/resume.ts                     # 增加移动端视口监听、当前活动Tab (editor/preview) 与抽屉开关状态
│   └── components/
│       ├── WebTopNavBar.vue                 # 移动端适配：精简品牌、分段控制器、GitHub Star、导出
│       └── mobile/
│           ├── MobileEditorToolbar.vue      # 选中文本后浮动的气泡格式工具条 (Bubble Menu)
│           ├── MobilePreviewActions.vue     # 预览页底部的悬浮胶囊：简历调整、智能一页
│           └── MobileAdjustSheet.vue        # 底部滑出的调整抽屉：证件照、模板、主题色、间距

src/components/
├── EditorPane.vue                           # 开放 toolbar/overlay 插槽与选区格式化方法，保持桌面端默认兼容
└── PreviewPane.vue                          # 开放 toolbar/footer 插槽，增加 autoFitWidth 自适应能力与状态暴露
```

---

### Task 1: Viewport & UI State in Web Resume Store

**Files:**
- Modify: `apps/web/src/stores/resume.ts`
- Test: `apps/web/src/stores/resume.ts`

- [ ] **Step 1: Write type definitions and reactive state for mobile UI**

在 `apps/web/src/stores/resume.ts` 中增加移动端界面状态管理：
```typescript
// 移动端视口与视图模式
const isMobileViewport = ref(false);
const mobileActiveTab = ref<"editor" | "preview">("editor");
const isMobileAdjustSheetOpen = ref(false);

const setMobileActiveTab = (tab: "editor" | "preview") => {
  mobileActiveTab.value = tab;
};

const setMobileAdjustSheetOpen = (open: boolean) => {
  isMobileAdjustSheetOpen.value = open;
};

const toggleMobileAdjustSheet = () => {
  isMobileAdjustSheetOpen.value = !isMobileAdjustSheetOpen.value;
};

const updateViewportWidth = (width: number) => {
  isMobileViewport.value = width < 768;
};
```

并在 store 返回对象中暴露：
```typescript
return {
  // ...已有导出
  isMobileViewport,
  mobileActiveTab,
  isMobileAdjustSheetOpen,
  setMobileActiveTab,
  setMobileAdjustSheetOpen,
  toggleMobileAdjustSheet,
  updateViewportWidth,
};
```

- [ ] **Step 2: Run web typecheck to verify interface addition**

Run: `npm --prefix apps/web run build`
Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Commit store changes**

```bash
git add apps/web/src/stores/resume.ts
git commit -m "feat(web): add mobile viewport and view mode state to resume store"
```

---

### Task 2: Viewport Meta & Mobile App Shell Styles

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Update viewport meta in index.html**

在 `apps/web/index.html` 中：
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

- [ ] **Step 2: Add mobile safe-area, touch and layout tokens in app.css**

在 `apps/web/src/styles/app.css` 底部增加移动端基础规则：
```css
/* Mobile Safe Area & Layout */
@media (max-width: 767px) {
  html, body, #app {
    height: 100%;
    height: 100dvh;
    overflow: hidden;
  }

  .web-app-shell {
    padding: 0 !important;
    gap: 0 !important;
    height: 100% !important;
    height: 100dvh !important;
  }

  .web-content-shell {
    height: 100% !important;
    height: 100dvh !important;
  }

  .web-main-container {
    padding: 0 !important;
    gap: 0 !important;
  }

  /* 移动端安全区底部适配 */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}

/* 浮动选区工具条与抽屉通用动效 */
.mobile-bubble-toolbar {
  transform: translateY(8px) scale(0.96);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.mobile-bubble-toolbar--visible {
  transform: translateY(0) scale(1);
  opacity: 1;
  pointer-events: auto;
}

.mobile-sheet-backdrop {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-sheet-backdrop--open {
  opacity: 1;
  pointer-events: auto;
}

.mobile-sheet-panel {
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-sheet-panel--open {
  transform: translateY(0);
}
```

- [ ] **Step 3: Run web build to verify CSS**

Run: `npm --prefix apps/web run build`
Expected: PASS.

- [ ] **Step 4: Commit changes**

```bash
git add apps/web/index.html apps/web/src/styles/app.css
git commit -m "style(web): add mobile viewport meta and responsive app styles"
```

---

### Task 3: Slots & Extension Interface in EditorPane

**Files:**
- Modify: `src/components/EditorPane.vue`

- [ ] **Step 1: Expose formatting commands and slots in EditorPane.vue**

在 `src/components/EditorPane.vue` 中：
1. 保持现有 `<template #toolbar>` 默认渲染 `<EditorToolbar />`，但外层允许外部替换或补充插槽；
2. 增加 `<slot name="overlay" ...>` 用于挂载选区浮动工具栏；
3. 向插槽暴露选区状态与格式化动作：
   - `hasTextSelection`
   - `currentLineFormat`
   - `applyLineFormat(format)`
   - `toggleBold()`
   - `toggleItalic()`
   - `insertEmphasis()`
   - `toggleLink()`
   - `focusEditor()`
4. 通过 `defineExpose` 暴露：
   - `focusEditor`: `() => focusEditor()`
   - `requestMeasure`: `() => view?.requestMeasure()`
   - `toggleInlineSyntax`
   - `applyCurrentLineFormat`
   - `toggleLinkSyntax`
   - `insertEmphasisSyntax`

修改模板结构：
```vue
<template>
  <EditorShell
    v-model:recovery-file-name="recoveryFileName"
    :has-active-file="hasActiveFile"
    :has-alternative-files="hasAlternativeFiles"
    :is-missing-file="isMissingFile"
    @open-other-file="handleOpenOtherFile"
    @recover-missing-file="handleRecoverMissingFile"
  >
    <template #toolbar>
      <slot
        name="toolbar"
        :has-active-file="hasActiveFile"
        :has-text-selection="hasTextSelection"
        :current-line-format="currentLineFormat"
        :apply-line-format="applyCurrentLineFormat"
        :toggle-bold="() => toggleInlineSyntax('**')"
        :toggle-italic="() => toggleInlineSyntax('*')"
        :insert-emphasis="insertEmphasisSyntax"
        :toggle-link="toggleLinkSyntax"
        :focus-editor="focusEditor"
      >
        <EditorToolbar
          :current-line-format="currentLineFormat"
          :has-active-file="hasActiveFile"
          :has-copied-markdown="hasCopiedMarkdown"
          :has-text-selection="hasTextSelection"
          :is-formatting-disabled="isFormattingDisabled"
          :is-render-view="isRenderView"
          @apply-line-format="applyCurrentLineFormat"
          @copy-markdown="copyMarkdown"
          @insert-command="handleInsertCommand"
          @insert-emphasis="insertEmphasisSyntax"
          @toggle-bold="toggleInlineSyntax('**')"
          @toggle-italic="toggleInlineSyntax('*')"
          @toggle-view="toggleEditorView"
        />
      </slot>
    </template>

    <div ref="editorContainer" class="custom-scrollbar h-full w-full"></div>

    <slot
      name="overlay"
      :has-text-selection="hasTextSelection"
      :current-line-format="currentLineFormat"
      :apply-line-format="applyCurrentLineFormat"
      :toggle-bold="() => toggleInlineSyntax('**')"
      :toggle-italic="() => toggleInlineSyntax('*')"
      :insert-emphasis="insertEmphasisSyntax"
      :toggle-link="toggleLinkSyntax"
      :focus-editor="focusEditor"
    />
  </EditorShell>
</template>
```

- [ ] **Step 2: Run root and web build to ensure zero regression on desktop**

Run: `npm run build && npm run build:web`
Expected: PASS on both targets.

- [ ] **Step 3: Commit changes**

```bash
git add src/components/EditorPane.vue
git commit -m "feat(editor): expose toolbar slots and formatter methods for mobile integration"
```

---

### Task 4: Mobile Editor Formatting Bubble Toolbar Component

**Files:**
- Create: `apps/web/src/components/mobile/MobileEditorToolbar.vue`

- [ ] **Step 1: Implement MobileEditorToolbar.vue**

新建 `apps/web/src/components/mobile/MobileEditorToolbar.vue`：
支持在有选区时浮出深色高对比度工具条，包含 H2、H3、粗体、斜体、强调、列表、引用、链接与关闭。
注意：点击按钮时通过 `@mousedown.prevent` / `@touchstart.prevent` 阻止编辑器失焦，保留 CodeMirror 的当前选区。

```vue
<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "format", action: "h2" | "h3" | "bold" | "italic" | "emphasis" | "list" | "quote" | "link"): void;
  (e: "dismiss"): void;
}>();

const handleAction = (action: "h2" | "h3" | "bold" | "italic" | "emphasis" | "list" | "quote" | "link") => {
  emit("format", action);
};
</script>

<template>
  <div
    class="mobile-bubble-toolbar absolute bottom-5 left-3 right-3 z-30 flex items-center justify-between p-1.5 rounded-2xl bg-slate-900/92 backdrop-blur-md shadow-2xl text-white select-none border border-white/10"
    :class="{ 'mobile-bubble-toolbar--visible': visible }"
    @mousedown.prevent
    @touchstart.prevent
  >
    <div class="flex items-center gap-1 overflow-x-auto hide-scrollbar w-full px-1">
      <span class="text-[10px] text-indigo-300 font-bold px-1 shrink-0 uppercase tracking-wider">格式</span>
      <button
        @click="handleAction('h2')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors"
      >
        H2
      </button>
      <button
        @click="handleAction('h3')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors"
      >
        H3
      </button>
      <button
        @click="handleAction('bold')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold shrink-0 transition-colors"
      >
        粗体
      </button>
      <button
        @click="handleAction('italic')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs italic shrink-0 transition-colors"
      >
        斜体
      </button>
      <button
        @click="handleAction('emphasis')"
        class="px-2 py-1 rounded-lg bg-primary/40 text-primary-fixed hover:bg-primary/60 text-xs font-bold shrink-0 transition-colors"
      >
        强调
      </button>
      <button
        @click="handleAction('list')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors"
      >
        • 列表
      </button>
      <button
        @click="handleAction('quote')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors"
      >
        “ 引用
      </button>
      <button
        @click="handleAction('link')"
        class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs shrink-0 transition-colors"
      >
        链接
      </button>
      <button
        @click="emit('dismiss')"
        class="px-2 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white text-xs shrink-0 ml-auto transition-colors"
      >
        ✕
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run web build to verify new component**

Run: `npm --prefix apps/web run build`
Expected: PASS.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/components/mobile/MobileEditorToolbar.vue
git commit -m "feat(web): add MobileEditorToolbar component for selection formatting"
```

---

### Task 5: Mobile Adjust Bottom Sheet Component

**Files:**
- Create: `apps/web/src/components/mobile/MobileAdjustSheet.vue`

- [ ] **Step 1: Implement MobileAdjustSheet.vue**

新建 `apps/web/src/components/mobile/MobileAdjustSheet.vue`：
支持照片上传/移除、内置模板切换、精简色板圆点选择、间距预设（紧凑/标准/宽松）联动，严格使用现有的 store 接口与数据。

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useResumeStore } from "@resume-store";

defineProps<{
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

// 主题色候选板
const THEME_COLORS = [
  "#4e4ccf", // 默认靛蓝
  "#0050d1", // 经典蓝
  "#0ea5e9", // 天空蓝
  "#10b981", // 翡翠绿
  "#b91c1c", // 绯红
  "#334155", // 雅致灰
];

const currentThemeColor = computed(() => {
  return (store.templateValues?.themeColor as string) || "#4e4ccf";
});

const setThemeColor = (hex: string) => {
  store.setTemplateValue("themeColor", hex);
};

// 间距预设映射 (紧凑 1 / 标准 2 / 宽松 3)
const spacingMode = computed(() => {
  const pSpace = Number(store.templateValues?.paragraphSpacing ?? 5);
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
  await store.importIdPhoto();
};

const handleRemovePhoto = async () => {
  await store.deletePhoto("");
};
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
      :class="{ 'mobile-sheet-panel--open': visible }"
    >
      <!-- 抓手条 -->
      <div class="w-10 h-1 rounded-full bg-slate-200 self-center mb-3"></div>

      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 class="text-sm font-bold text-slate-800">简历风格与调整</h3>
        <button
          @click="emit('close')"
          class="text-xs font-bold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
        >
          完成
        </button>
      </div>

      <div class="py-3 overflow-y-auto space-y-4 text-xs">
        <!-- 证件照项 -->
        <div class="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-12 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
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
          <div class="flex items-center gap-1.5">
            <button
              @click="handleImportPhoto"
              class="px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
            >
              上传/更换
            </button>
            <button
              v-if="store.photoBase64"
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
              @click="activeTemplate = tmpl.id"
              class="py-2.5 px-1 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="activeTemplate === tmpl.id
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'"
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
              @click="setSpacing('compact')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'compact'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'"
            >
              紧凑
            </button>
            <button
              @click="setSpacing('standard')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'standard'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'"
            >
              标准
            </button>
            <button
              @click="setSpacing('loose')"
              class="py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer"
              :class="spacingMode === 'loose'
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'"
            >
              宽松
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run web build to verify MobileAdjustSheet.vue**

Run: `npm --prefix apps/web run build`
Expected: PASS.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/components/mobile/MobileAdjustSheet.vue
git commit -m "feat(web): add MobileAdjustSheet component for template and style options"
```

---

### Task 6: Slots, Auto-Fit Width & Control Interface in PreviewPane

**Files:**
- Modify: `src/components/PreviewPane.vue`

- [ ] **Step 1: Enhance PreviewPane with auto-fit width and slots**

在 `src/components/PreviewPane.vue` 中：
1. 增加 `autoFitWidth?: boolean` prop；
2. 保持现有 `<PreviewToolbar>` 默认渲染，允许外部替换插槽；
3. 将页脚包装进 `<slot name="footer" :is-auto-fitting="isAutoFitting" :run-smart-one-page="runSmartOnePage" :total-pages="totalPages">`；
4. 当 `autoFitWidth` 为真时，根据容器宽度自动换算 `zoomLevel`：
   `const fitZoom = Math.max(35, Math.min(100, Math.floor(((currentWidth - 32) / 794) * 100)))`
5. 暴露 `runSmartOnePage`、`isAutoFitting`、`totalPages`、`zoomLevel`、`fitToWidth`。

- [ ] **Step 2: Run root and web build to ensure zero regression**

Run: `npm run build && npm run build:web`
Expected: PASS.

- [ ] **Step 3: Commit changes**

```bash
git add src/components/PreviewPane.vue
git commit -m "feat(preview): add autoFitWidth calculation and footer slot in PreviewPane"
```

---

### Task 7: Mobile Preview Bottom Actions Component

**Files:**
- Create: `apps/web/src/components/mobile/MobilePreviewActions.vue`

- [ ] **Step 1: Implement MobilePreviewActions.vue**

新建 `apps/web/src/components/mobile/MobilePreviewActions.vue`：
提供半透明磨砂悬浮胶囊栏，仅包含“简历调整”与“智能一页”，通过已有方法调用。

```vue
<script setup lang="ts">
defineProps<{
  isAutoFitting: boolean;
}>();

const emit = defineEmits<{
  (e: "open-adjust"): void;
  (e: "smart-one-page"): void;
}>();
</script>

<template>
  <div class="mobile-preview-actions fixed bottom-5 left-1/2 -translate-x-1/2 z-30 select-none safe-area-bottom">
    <div class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/92 backdrop-blur-xl shadow-lg border border-slate-200/60">
      <!-- 简历调整 -->
      <button
        @click="emit('open-adjust')"
        class="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
      >
        <span class="material-symbols-outlined text-[15px] text-primary">tune</span>
        <span>简历调整</span>
      </button>

      <div class="w-px h-3.5 bg-slate-200"></div>

      <!-- 智能一页 -->
      <button
        @click="emit('smart-one-page')"
        :disabled="isAutoFitting"
        class="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
      >
        <span v-if="isAutoFitting" class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
        <span v-else class="material-symbols-outlined text-[15px]">auto_fix_high</span>
        <span>一页排版</span>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run web build to verify MobilePreviewActions.vue**

Run: `npm --prefix apps/web run build`
Expected: PASS.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/components/mobile/MobilePreviewActions.vue
git commit -m "feat(web): add MobilePreviewActions component for floating controls"
```

---

### Task 8: Responsive Top Navigation Bar in WebTopNavBar

**Files:**
- Modify: `apps/web/src/components/WebTopNavBar.vue`

- [ ] **Step 1: Adapt WebTopNavBar for mobile viewports**

在 `apps/web/src/components/WebTopNavBar.vue` 中：
- 当 `store.isMobileViewport` 为真时：
  - 左侧：精简品牌 Logo + "小简简历"
  - 中间：胶囊分段控制器 `[编辑] [预览]`，联动 `store.setMobileActiveTab`
  - 右侧：常驻 GitHub Star 药丸按钮 + 紧凑型“导出”按钮
- 当 `store.isMobileViewport` 为假（桌面端）时：
  - 100% 保持现有布局（大标题 + 安装桌面端体验完整功能 + Star on GitHub + 导出为 PDF）

- [ ] **Step 2: Run web build to verify WebTopNavBar**

Run: `npm --prefix apps/web run build`
Expected: PASS.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/components/WebTopNavBar.vue
git commit -m "feat(web): make WebTopNavBar responsive with mobile segmented switcher"
```

---

### Task 9: Integrated Mobile/Desktop Shell in Web App.vue

**Files:**
- Modify: `apps/web/src/App.vue`

- [ ] **Step 1: Implement single-instance lifecycle & responsive layout in App.vue**

在 `apps/web/src/App.vue` 中：
1. 监听窗口 resize / matchMedia，同步 `store.updateViewportWidth(window.innerWidth)`；
2. 保持**唯一的** `EditorPane` 实例与**唯一的** `PreviewPane` 实例；
3. 移动端隐藏侧边栏 `Sidebar`；
4. 在移动端下：
   - 当 `mobileActiveTab === 'editor'`：
     - `EditorPane` 填满视口，注入 `#toolbar`（显示已同步草稿与“简历调整”按钮）以及 `#overlay`（注入 `MobileEditorToolbar`）；
     - `PreviewPane` 移至屏幕外保留明确宽度（例如 `fixed -left-[99999px] top-0 w-screen h-screen opacity-0 pointer-events-none -z-50`），保持渲染管线正常测量；
     - 切换回编辑时，调用 `editorPaneRef?.requestMeasure()`。
   - 当 `mobileActiveTab === 'preview'`：
     - `PreviewPane` 填满视口，开启 `auto-fit-width`，注入 `#footer`（注入 `MobilePreviewActions`）；
     - `EditorPane` 隐藏；
5. 挂载 `MobileAdjustSheet`，双端均可呼出修改。

- [ ] **Step 2: Run full web build and root app build**

Run: `npm run build && npm run build:web`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add apps/web/src/App.vue
git commit -m "feat(web): integrate mobile responsive shell with single-instance lifecycle"
```

---

### Task 10: End-to-End Build and Verification Check

**Files:**
- Test: `npm run build:web`
- Test: `npm run build`
- Verify: desktop & mobile browser behaviors

- [ ] **Step 1: Run comprehensive build verification**

Run: `npm run build:web && npm run build`
Expected: Both exit with code 0 without any type or bundling errors.

- [ ] **Step 2: Verify desktop Web layout unchanged**

通过浏览器打开 Web 构建产物或 dev 预览，在宽屏（>= 768px）下确认：
- 侧边栏大纲功能正常
- 双栏（40% 编辑 + 60% 预览）排版保持原样
- 桌面顶栏所有按钮保留原貌

- [ ] **Step 3: Verify mobile Web layout**

在移动端视口（< 768px）下确认：
- 顶栏精简展示并支持【编辑】/【预览】切换
- 选中文本即刻弹出 `MobileEditorToolbar`，点击格式后文本被正确包裹或转换
- 点击“简历调整”可弹出底抽屉，支持上传证件照、切换模板、改变主题色与间距
- 预览页 A4 纸张自适应屏幕宽度，支持纵向滑动
- 智能一页与导出 PDF 流程顺畅
- 桌面端 Tauri 客户端不受任何干扰

- [ ] **Step 4: Commit final verification**

```bash
git commit --allow-empty -m "chore(web): complete mobile playground adaptation verification"
```
