<script setup lang="ts">
import Sidebar from "@desktop/components/Sidebar.vue";
import EditorPane from "@desktop/components/EditorPane.vue";
import PreviewPane from "@desktop/components/PreviewPane.vue";
import { useResumeStore } from "@resume-store";
import WebTopNavBar from "./components/WebTopNavBar.vue";

const store = useResumeStore();

void store.loadTemplates();
</script>

<template>
  <div
    class="web-app-shell bg-surface text-on-surface antialiased font-['Manrope'] w-full h-screen relative flex overflow-hidden p-4"
    :class="store.isSidebarOpen ? 'gap-4' : ''"
  >
    <Sidebar
      mode="outline-only"
      class="web-sidebar-shell"
      :class="{ 'web-sidebar-shell--open': store.isSidebarOpen }"
    />

    <section class="web-content-shell flex-1 flex flex-col h-full min-w-0 overflow-hidden relative transition-all duration-700">
      <WebTopNavBar />

      <main class="flex-1 flex min-w-0 overflow-hidden px-6 pb-6 pt-2 gap-4">
        <EditorPane class="web-editor-pane w-[40%] min-w-0" />
        <PreviewPane class="web-preview-shell w-[60%] min-w-0" />
      </main>
    </section>
  </div>
</template>
