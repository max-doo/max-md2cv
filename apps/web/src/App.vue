<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useResumeStore } from "@resume-store";
import Sidebar from "@desktop/components/Sidebar.vue";
import EditorPane from "@desktop/components/EditorPane.vue";
import PreviewPane from "@desktop/components/PreviewPane.vue";
import WebTopNavBar from "./components/WebTopNavBar.vue";
import MobileEditorToolbar from "./components/mobile/MobileEditorToolbar.vue";
import MobilePreviewActions from "./components/mobile/MobilePreviewActions.vue";
import MobileBottomNav from "./components/mobile/MobileBottomNav.vue";
import MobileOutlineDrawer from "./components/mobile/MobileOutlineDrawer.vue";
import MobileAdjustSheet from "./components/mobile/MobileAdjustSheet.vue";

const store = useResumeStore();

void store.loadTemplates();

const editorPaneRef = ref<InstanceType<typeof EditorPane> | null>(null);
const previewPaneRef = ref<InstanceType<typeof PreviewPane> | null>(null);
const isEditorToolbarVisible = ref(true);

const handleResize = () => {
  store.updateViewportWidth(window.innerWidth);
};

onMounted(() => {
  window.addEventListener("resize", handleResize);
  store.updateViewportWidth(window.innerWidth);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

watch(
  () => store.mobileActiveTab,
  (newTab) => {
    if (newTab === "editor") {
      isEditorToolbarVisible.value = true;
      nextTick(() => {
        editorPaneRef.value?.requestMeasure();
      });
    } else if (newTab === "preview") {
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      nextTick(() => {
        previewPaneRef.value?.fitToWidth();
      });
    }
  },
);

watch(
  () => editorPaneRef.value?.hasTextSelection,
  (hasSelection) => {
    if (!hasSelection) {
      isEditorToolbarVisible.value = true;
    }
  },
);

const handleMobileFormat = (
  action: "h2" | "h3" | "bold" | "italic" | "emphasis" | "list" | "quote" | "link",
  commands: {
    applyLineFormat: (format: "h2" | "h3" | "bullet" | "quote" | "paragraph") => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    insertEmphasis: () => void;
    toggleLink: () => void;
    focusEditor: () => void;
  },
) => {
  switch (action) {
    case "h2":
      commands.applyLineFormat("h2");
      break;
    case "h3":
      commands.applyLineFormat("h3");
      break;
    case "bold":
      commands.toggleBold();
      break;
    case "italic":
      commands.toggleItalic();
      break;
    case "emphasis":
      commands.insertEmphasis();
      break;
    case "list":
      commands.applyLineFormat("bullet");
      break;
    case "quote":
      commands.applyLineFormat("quote");
      break;
    case "link":
      commands.toggleLink();
      break;
  }
  commands.focusEditor();
};

const handleOutlineJump = () => {
  if (store.isMobileViewport) {
    store.setMobileActiveTab("editor");
  }
};

const editorPaneClass = computed(() => {
  if (store.isMobileViewport) {
    return store.mobileActiveTab === "editor"
      ? "w-full h-full flex-1 min-w-0"
      : "mobile-pane-offscreen";
  }
  return "web-editor-pane w-[40%] min-w-0";
});

const previewPaneClass = computed(() => {
  if (store.isMobileViewport) {
    return store.mobileActiveTab === "preview"
      ? "w-full h-full flex-1 min-w-0"
      : "mobile-pane-offscreen";
  }
  return "web-preview-shell w-[60%] min-w-0";
});
</script>

<template>
  <div
    class="web-app-shell bg-surface text-on-surface antialiased font-['Manrope'] w-full h-screen relative flex overflow-hidden p-4"
    :class="store.isSidebarOpen && !store.isMobileViewport ? 'gap-4' : ''"
  >
    <Sidebar
      v-if="!store.isMobileViewport"
      mode="outline-only"
      class="web-sidebar-shell"
      :class="{ 'web-sidebar-shell--open': store.isSidebarOpen }"
    />

    <section
      class="web-content-shell flex-1 flex flex-col h-full min-w-0 overflow-hidden relative transition-all duration-700"
    >
      <WebTopNavBar
        @open-outline="store.isSidebarOpen = true"
      />

      <main class="web-main-container flex-1 flex min-w-0 overflow-hidden px-6 pb-6 pt-2 gap-4">
        <!-- EditorPane: Always mounted -->
        <EditorPane
          ref="editorPaneRef"
          :class="editorPaneClass"
        >
          <!-- Mobile compact toolbar / Desktop default toolbar -->
          <template #[store.isMobileViewport?'toolbar':'_desktopToolbar']>
            <div class="hidden"></div>
          </template>

          <!-- Mobile bubble toolbar overlay / Desktop overlay -->
          <template
            #[store.isMobileViewport?'overlay':'_desktopOverlay']="{
              hasTextSelection,
              applyLineFormat,
              toggleBold,
              toggleItalic,
              insertEmphasis,
              toggleLink,
              focusEditor,
            }"
          >
            <MobileEditorToolbar
              :visible="Boolean(hasTextSelection) && isEditorToolbarVisible"
              @format="
                (action) =>
                  handleMobileFormat(action, {
                    applyLineFormat: (fmt) => {
                      const mapped =
                        fmt === 'h2'
                           ? 'heading2'
                          : fmt === 'h3'
                            ? 'heading3'
                            : fmt === 'bullet'
                              ? 'list'
                              : fmt;
                      applyLineFormat(mapped as any);
                    },
                    toggleBold,
                    toggleItalic,
                    insertEmphasis,
                    toggleLink,
                    focusEditor,
                  })
              "
              @dismiss="isEditorToolbarVisible = false"
            />
          </template>
        </EditorPane>

        <!-- PreviewPane: Always mounted -->
        <PreviewPane
          ref="previewPaneRef"
          :class="previewPaneClass"
          :auto-fit-width="store.isMobileViewport && store.mobileActiveTab === 'preview'"
        >
          <!-- Mobile hide toolbar / Desktop default toolbar -->
          <template #[store.isMobileViewport?'toolbar':'_desktopToolbar']>
            <div class="hidden"></div>
          </template>

          <!-- Mobile footer / Desktop default footer -->
          <template #[store.isMobileViewport?'footer':'_desktopFooter']="{ isAutoFitting, runSmartOnePage }">
            <MobilePreviewActions
              v-if="store.mobileActiveTab === 'preview'"
              :is-auto-fitting="isAutoFitting"
              @open-adjust="store.setMobileAdjustSheetOpen(true)"
              @smart-one-page="runSmartOnePage"
            />
          </template>
        </PreviewPane>
      </main>
    </section>

    <!-- Mobile Bottom Navigation Bar -->
    <MobileBottomNav
      v-if="store.isMobileViewport"
      :active-tab="store.mobileActiveTab"
      @switch-tab="store.setMobileActiveTab"
    />

    <!-- Mobile Outline Drawer -->
    <MobileOutlineDrawer
      v-if="store.isMobileViewport"
      :visible="store.isSidebarOpen"
      @close="store.isSidebarOpen = false"
      @jump="handleOutlineJump"
    />

    <!-- Mobile Adjust Bottom Sheet -->
    <MobileAdjustSheet
      :visible="store.isMobileAdjustSheetOpen"
      @close="store.setMobileAdjustSheetOpen(false)"
    />
  </div>
</template>
