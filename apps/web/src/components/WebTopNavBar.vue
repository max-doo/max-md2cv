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
    <div class="flex h-16 min-w-0 items-center justify-between gap-6 px-8">
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
        >
          <span class="material-symbols-outlined text-[18px]">install_desktop</span>
          <span>下载安装包</span>
        </a>

        <a
          :href="WEB_REPOSITORY_URL"
          target="_blank"
          rel="noreferrer"
          class="web-topbar-secondary-action"
        >
          <span class="material-symbols-outlined text-[18px]">code</span>
          <span>GitHub 仓库</span>
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
