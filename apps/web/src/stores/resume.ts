import { computed, h, ref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { ElMessage, ElNotification } from "element-plus";
import { usePlaygroundStore } from "./playground";
import { buildPagedExportDocumentHtml } from "@desktop/utils/pagedExport";
import {
  parseMarkdownOutline,
  reorderOutlineSiblings,
  type ResumeOutlineNode,
} from "@desktop/utils/markdownOutline";
import {
  resolvePhotoAdjustments,
  resolveTemplateValues,
  type PhotoAdjustments,
  type ResumeStyle,
} from "@resume-core";

interface FileItem {
  name: string;
  path: string;
}

type ActiveFileStatus = "ready" | "missing" | "conflict";

export type MobileActiveTab = "editor" | "preview";
export const MOBILE_BREAKPOINT = 768;

const WEB_FILE_PATH = "web-playground.md";

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });

const pickSingleFile = (accept: string) =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

const buildDisplayNameFromMarkdown = (markdown: string) => {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || "Web Playground";
};

const WEB_PRINT_SCRIPT = `
  <script>
    window.addEventListener('load', () => {
      window.setTimeout(() => window.print(), 180);
    });
    window.addEventListener('afterprint', () => {
      window.close();
    });
  </script>
`;

const triggerStarEncouragement = () => {
  const DISMISSED_KEY = "md2cv_star_prompt_dismissed_v2";
  const SESSION_KEY = "md2cv_star_prompt_session_shown";

  try {
    // 若用户已点过 Star 或选择长期免扰
    if (localStorage.getItem(DISMISSED_KEY) === "1") {
      return;
    }
    // 同一会话内不重复弹出
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      return;
    }
  } catch {
    // 忽略存储读取异常
  }

  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}

  setTimeout(() => {
    ElNotification({
      title: "🎉 简历已准备导出",
      customClass: "star-encouragement-notify",
      duration: 0,
      position: "bottom-right",
      message: h("div", { class: "flex flex-col gap-2.5 pt-1 text-xs text-on-surface-variant font-['Manrope']" }, [
        h("p", { class: "leading-relaxed" }, "如果小简帮到了你，不妨在 GitHub 给我们点个 Star 支持一下开源项目～"),
        h("div", { class: "flex items-center gap-2 pt-0.5" }, [
          h(
            "a",
            {
              href: "https://github.com/max-doo/max-md2cv",
              target: "_blank",
              rel: "noreferrer",
              class:
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity cursor-pointer",
              onClick: () => {
                try {
                  localStorage.setItem(DISMISSED_KEY, "1");
                } catch {}
                ElNotification.closeAll();
              },
            },
            [
              h(
                "span",
                {
                  class: "material-symbols-outlined text-[14px]",
                  style: "font-variation-settings: 'FILL' 1;",
                },
                "star",
              ),
              "去点个 Star",
            ],
          ),
          h(
            "button",
            {
              class:
                "inline-flex items-center px-2.5 py-1.5 rounded-full text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer text-xs",
              onClick: () => {
                ElNotification.closeAll();
              },
            },
            "下次再说",
          ),
        ]),
      ]),
    });
  }, 600);
};

const getPreviewPagesContainer = () => {
  return document.querySelector(".pagedjs_pages");
};

const buildWebPrintHtml = async (
  documentTitle: string,
  pagesContainer: HTMLElement,
  cvStyle: ResumeStyle,
  photoAdjustments: PhotoAdjustments,
) => {
  const htmlContent = await buildPagedExportDocumentHtml({
    documentTitle,
    pagesContainer,
    cvStyle,
    photoAdjustments,
  });

  return htmlContent.replace("</body>", `${WEB_PRINT_SCRIPT}</body>`);
};

export const useResumeStore = defineStore("resume", () => {
  const playground = usePlaygroundStore();
  const { photoBase64, resumeStyle, templateValues, currentTemplate } =
    storeToRefs(playground);

  if (!playground.hydrated) {
    playground.hydrate();
  }

  const templatesLoaded = ref(true);
  const isExporting = ref(false);
  const isExportingImage = ref(false);
  const isPreviewRendering = ref(false);
  const isPreviewReady = ref(false);
  const activeFileStatus = ref<ActiveFileStatus>("ready");
  const isDirty = ref(false);
  const isSidebarOpen = ref(false);
  const sidebarPrimaryView = ref<"library" | "outline">("outline");
  const shouldShowWorkspaceDialog = ref(false);
  const isTemplateDialogVisible = ref(false);
  const editorJumpRequest = ref<{ line: number; token: number } | null>(null);
  const editorJumpToken = ref(0);
  let previewRenderToken = 0;

  const isMobileViewport = ref(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );
  const mobileActiveTab = ref<MobileActiveTab>("editor");
  const isMobileAdjustSheetOpen = ref(false);

  const setMobileActiveTab = (tab: MobileActiveTab) => {
    mobileActiveTab.value = tab;
  };

  const setMobileAdjustSheetOpen = (open: boolean) => {
    isMobileAdjustSheetOpen.value = open;
  };

  const toggleMobileAdjustSheet = () => {
    isMobileAdjustSheetOpen.value = !isMobileAdjustSheetOpen.value;
  };

  const updateViewportWidth = (width: number) => {
    isMobileViewport.value = width < MOBILE_BREAKPOINT;
  };

  const fileList = ref<FileItem[]>([
    {
      name: WEB_FILE_PATH,
      path: WEB_FILE_PATH,
    },
  ]);

  const markdownContent = computed({
    get: () => playground.markdown,
    set: (value: string) => {
      playground.updateMarkdown(value);
    },
  });

  const availableTemplates = computed(() => playground.templates);
  const activeTemplate = computed({
    get: () => playground.templateId,
    set: (value: string) => {
      playground.setTemplate(value);
    },
  });

  const activeFilePath = computed(() => WEB_FILE_PATH);
  const activeFileName = computed(() => buildDisplayNameFromMarkdown(playground.markdown));
  const outlineResult = computed(() => parseMarkdownOutline(playground.markdown));
  const outlineTree = computed<ResumeOutlineNode[]>(() => outlineResult.value.tree);

  const currentPhotoPath = computed(() => {
    return photoBase64.value ? "web-photo" : null;
  });

  const loadTemplates = async () => {
    templatesLoaded.value = true;
  };

  const startPreviewRender = (_promise: Promise<void>) => {
    const token = ++previewRenderToken;
    isPreviewRendering.value = true;
    isPreviewReady.value = false;
    return token;
  };

  const finishPreviewRender = (token: number, ready: boolean) => {
    if (token !== previewRenderToken) {
      return;
    }

    isPreviewRendering.value = false;
    isPreviewReady.value = ready;
  };

  const updateMarkdownContent = (content: string, markDirty = true) => {
    playground.updateMarkdown(content);
    if (markDirty) {
      isDirty.value = true;
    }
  };

  const saveCurrentFile = async (_silent = false) => {
    playground.persistNow();
    isDirty.value = false;
  };

  const replaceMarkdownFromOutline = async (nextMarkdown: string) => {
    updateMarkdownContent(nextMarkdown);
    await saveCurrentFile(true);
  };

  const persistActiveFileRenderState = async () => {
    playground.persistNow();
  };

  const resetActiveFileRenderSettings = () => {
    playground.resetTemplateValues();
  };

  const setActiveTemplateForCurrentFile = (templateId: string) => {
    playground.setTemplate(templateId);
  };

  const saveCurrentTemplate = async () => {
    playground.persistNow();
  };

  const exportCurrentPdf = async () => {
    isExporting.value = true;
    try {
      const pagesContainer = getPreviewPagesContainer();
      if (!(pagesContainer instanceof HTMLElement)) {
        throw new Error("预览内容还在生成中，请稍后再试");
      }

      const documentTitle = activeFileName.value || "Web Playground";
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        throw new Error("浏览器拦截了打印窗口，请允许弹窗后重试");
      }

      const htmlContent = await buildWebPrintHtml(
        documentTitle,
        pagesContainer,
        resumeStyle.value,
        resolvePhotoAdjustments(
          resolveTemplateValues(
            currentTemplate.value ?? {
              defaults: {},
              editorSchema: [],
            },
            templateValues.value,
          ),
        ),
      );
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      triggerStarEncouragement();
    } catch (error) {
      console.error("Web PDF export failed:", error);
      ElMessage.error(
        error instanceof Error ? error.message : "导出失败，请稍后重试",
      );
    } finally {
      isExporting.value = false;
    }
  };

  const importIdPhoto = async () => {
    const file = await pickSingleFile("image/png,image/jpeg,image/webp,image/bmp,image/gif");
    if (!file) {
      return;
    }

    await playground.uploadPhoto(file);
  };

  const selectPhoto = async (_path: string) => {
    return;
  };

  const deletePhoto = async (_path: string) => {
    playground.setPhotoBase64(null);
  };

  const importMarkdownFile = async () => {
    const file = await pickSingleFile(".md,text/markdown,text/plain");
    if (!file) {
      return;
    }

    updateMarkdownContent(await readFileAsText(file), false);
    await saveCurrentFile(true);
  };

  const requestEditorJump = (nodeId: string) => {
    const targetNode = outlineResult.value.nodesById.get(nodeId);
    if (!targetNode) {
      return;
    }

    editorJumpRequest.value = {
      line: targetNode.startLine,
      token: ++editorJumpToken.value,
    };
  };

  const clearEditorJumpRequest = () => {
    editorJumpRequest.value = null;
  };

  const resetDraft = () => {
    playground.resetDraft();
    isDirty.value = false;
  };

  const moveOutlineNode = async (
    nodeId: string,
    targetIndex: number,
    parentId: string | null,
  ) => {
    if (activeFileStatus.value !== "ready") {
      return;
    }

    const nextMarkdown = reorderOutlineSiblings(
      playground.markdown,
      nodeId,
      targetIndex,
      parentId,
    );

    if (nextMarkdown === playground.markdown) {
      return;
    }

    await replaceMarkdownFromOutline(nextMarkdown);
  };

  return {
    markdownContent,
    availableTemplates,
    activeTemplate,
    isExporting,
    isExportingImage,
    isPreviewRendering,
    isPreviewReady,
    templatesLoaded,
    resumeStyle,
    templateValues,
    currentTemplate,
    setTemplateValue: playground.setTemplateValue,
    setTemplateValues: playground.setTemplateValues,
    renderProfilesByFile: computed(() => ({})),
    workspacePath: computed(() => null),
    fileList,
    pdfFileList: computed(() => [] as FileItem[]),
    photoFileList: computed(() => [] as FileItem[]),
    activeFilePath,
    activeFileStatus,
    activeFileName,
    isDirty,
    pendingLocalMutationPaths: computed(() => [] as string[]),
    outlineTree,
    sidebarPrimaryView,
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    isTemplateDialogVisible,
    currentPhotoPath,
    editorJumpRequest,
    photoBase64,
    loadTemplates,
    saveCurrentTemplate,
    exportCurrentPdf,
    exportCurrentImage: async () => undefined,
    persistActiveFileRenderState,
    resetActiveFileRenderSettings,
    setActiveTemplateForCurrentFile,
    selectWorkspace: async () => undefined,
    openWorkspaceDirectory: async () => undefined,
    openFile: async () => undefined,
    openFirstAvailableFile: async () => undefined,
    updateMarkdownContent,
    saveCurrentFile,
    saveMissingFileAs: async (_name: string) => false,
    replaceMarkdownFromOutline,
    createFile: async (_name: string) => undefined,
    createFromTemplate: async (_name: string, _company: string, _position: string) => undefined,
    deleteFile: async (_path: string) => undefined,
    deletePdf: async (_path: string) => undefined,
    renameFile: async (_oldPath: string, _newName: string) => undefined,
    duplicateFile: async (_path: string) => undefined,
    renamePdf: async (_oldPath: string, _newName: string) => undefined,
    duplicatePdf: async (_path: string) => undefined,
    refreshFileList: async (_dirPath: string) => fileList.value,
    refreshPdfList: async (_dirPath: string) => [],
    refreshPhotoList: async (_dirPath: string) => [],
    selectPhoto,
    importIdPhoto,
    deletePhoto,
    moveOutlineNode,
    requestEditorJump,
    clearEditorJumpRequest,
    startPreviewRender,
    finishPreviewRender,
    openTemplateDialog: () => {
      isTemplateDialogVisible.value = true;
    },
    importMarkdownFile,
    resetDraft,
    isMobileViewport,
    mobileActiveTab,
    isMobileAdjustSheetOpen,
    setMobileActiveTab,
    setMobileAdjustSheetOpen,
    toggleMobileAdjustSheet,
    updateViewportWidth,
  };
});
