<script setup lang="ts">
import { useResumeStore } from "@resume-store";

const WEB_RELEASES_URL = "https://github.com/max-doo/max-md2cv/releases";
const WEB_REPOSITORY_URL = "https://github.com/max-doo/max-md2cv";
const PRODUCT_NAME = "小简-MD2CV简历工作台";
const PRODUCT_TAGLINE = "Web Playground";

const store = useResumeStore();

const handleExport = async () => {
  await store.exportCurrentPdf();
};
</script>

<template>
  <nav class="web-topbar z-50 w-full shrink-0 bg-transparent font-['Manrope'] text-sm font-medium tracking-wide antialiased">
    <!-- Mobile Viewport -->
    <div
      v-if="store.isMobileViewport"
      class="flex h-14 min-w-0 items-center justify-between gap-2 px-3"
    >
      <!-- Left: Compact Brand -->
      <div class="flex min-w-0 shrink-0 items-center gap-1.5">
        <img
          src="/favicon.png"
          alt="小简简历"
          class="h-5 w-5 shrink-0 rounded object-contain"
        />
        <span class="truncate text-sm font-bold text-on-surface">小简简历</span>
      </div>

      <!-- Center: Segmented Switcher -->
      <div class="flex shrink-0 items-center rounded-full border border-outline-variant/10 bg-surface-container-high/60 p-0.5 text-xs">
        <button
          type="button"
          @click="store.setMobileActiveTab('editor')"
          class="cursor-pointer transition-all"
          :class="store.mobileActiveTab === 'editor'
            ? 'rounded-full bg-white px-3 py-1 font-bold text-primary shadow-xs'
            : 'px-3 py-1 text-on-surface-variant hover:text-on-surface'"
        >
          编辑
        </button>
        <button
          type="button"
          @click="store.setMobileActiveTab('preview')"
          class="cursor-pointer transition-all"
          :class="store.mobileActiveTab === 'preview'
            ? 'rounded-full bg-white px-3 py-1 font-bold text-primary shadow-xs'
            : 'px-3 py-1 text-on-surface-variant hover:text-on-surface'"
        >
          预览
        </button>
      </div>

      <!-- Right: GitHub Link & Export Button -->
      <div class="flex shrink-0 items-center gap-1.5">
        <a
          :href="WEB_REPOSITORY_URL"
          target="_blank"
          rel="noreferrer"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant"
          title="在 GitHub 点个 Star 支持一下吧！"
        >
          <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
          </svg>
        </a>

        <button
          type="button"
          @click="handleExport"
          :disabled="store.isExporting || store.isPreviewRendering || !store.isPreviewReady"
          class="flex cursor-pointer items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
        >
          <span
            v-if="store.isExporting"
            class="material-symbols-outlined animate-spin text-sm"
          >
            refresh
          </span>
          <span
            v-else
            class="material-symbols-outlined text-sm"
            style="font-variation-settings: 'FILL' 1;"
          >
            download
          </span>
          <span>导出</span>
        </button>
      </div>
    </div>

    <!-- Desktop Viewport -->
    <div
      v-else
      class="flex h-16 min-w-0 items-center justify-between gap-6 px-8"
    >
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

        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="min-w-0">
            <div
              class="truncate text-base font-semibold tracking-[0.02em] text-on-surface"
              :title="PRODUCT_NAME"
            >
              {{ PRODUCT_NAME }}
            </div>
            <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/70">
              {{ PRODUCT_TAGLINE }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-3 whitespace-nowrap">
        <a
          :href="WEB_RELEASES_URL"
          target="_blank"
          rel="noreferrer"
          class="web-topbar-secondary-action"
          title="下载桌面端安装包，体验本地工作区、文件管理及多模板等完整功能"
        >
          <span class="material-symbols-outlined text-[18px]">install_desktop</span>
          <span>安装桌面端体验完整功能</span>
        </a>

        <a
          :href="WEB_REPOSITORY_URL"
          target="_blank"
          rel="noreferrer"
          class="web-topbar-secondary-action group cursor-pointer"
          title="在 GitHub 点个 Star 支持一下吧！"
        >
          <svg class="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-105" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
          </svg>
          <span>Star on GitHub</span>
          <span
            class="material-symbols-outlined text-[15px] text-amber-500 transition-transform duration-200 group-hover:scale-125"
            style="font-variation-settings: 'FILL' 1;"
          >
            star
          </span>
        </a>

        <button
          @click="handleExport"
          :disabled="store.isExporting || store.isPreviewRendering || !store.isPreviewReady"
          class="btn-primary shrink-0"
        >
          <span
            v-if="store.isExporting"
            class="material-symbols-outlined animate-spin text-base"
          >
            refresh
          </span>
          <span
            v-else
            class="material-symbols-outlined text-base"
            style="font-variation-settings: 'FILL' 1;"
          >
            download
          </span>
          <span>导出为 PDF</span>
        </button>
      </div>
    </div>
  </nav>
</template>
