import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  parseMarkdownOutline,
  reorderOutlineSiblings,
  type ResumeOutlineNode,
} from "../../utils/markdownOutline";
import {
  createDefaultTemplateValues,
  extractTemplateValueOverrides,
  resolveResumeStyle,
  resolveTemplateValues,
} from "../../utils/templateStyle";
import {
  DEFAULT_MARKDOWN,
  DEFAULT_TEMPLATE_ID,
  STORAGE_KEYS,
} from "./constants";
import type {
  ResumeStoreBaseContext,
  ResumeStoreRuntime,
  ResumeStoreState,
} from "./context";
import { createEditorModule } from "./modules/editor";
import { createExportModule } from "./modules/export";
import { createPhotoModule } from "./modules/photos";
import { createRenderProfileModule } from "./modules/render-profile";
import { createWorkspaceFilesModule } from "./modules/workspace-files";
import { createWorkspaceWatchModule } from "./modules/workspace-watch";
import { normalizePathKey, removeStorageItem } from "./path-utils";
import type {
  EditorJumpRequest,
  FileItem,
  PhotoItem,
  ResumeRenderProfile,
  ResumeStyle,
  ResumeTemplate,
  SidebarPrimaryView,
  TemplateValue,
  TemplateValues,
} from "./types";

export type {
  ActiveFileStatus,
  EditorJumpRequest,
  FileItem,
  PhotoItem,
  ResumeRenderProfile,
  ResumeStyle,
  ResumeTemplate,
  SidebarPrimaryView,
  TemplateFieldSchema,
  TemplateValue,
  TemplateValues,
  WorkspaceChangedEvent,
  WorkspaceRenderState,
} from "./types";

const createBaseContext = (
  state: ResumeStoreState,
  runtime: ResumeStoreRuntime,
): ResumeStoreBaseContext => ({
  state,
  runtime,
  platform: {
    invoke,
    listen,
    join,
    openDialog,
    document: typeof document !== "undefined" ? document : undefined,
  },
  ui: {
    message: ElMessage,
    messageBox: ElMessageBox,
  },
});

export const useResumeStore = defineStore("resume", () => {
  const availableTemplates = ref<ResumeTemplate[]>([]);
  const activeTemplate = ref(DEFAULT_TEMPLATE_ID);
  const templateValues = ref<TemplateValues>({});
  const currentTemplate = computed<ResumeTemplate | null>(() => {
    return (
      availableTemplates.value.find((template) => template.id === activeTemplate.value) ??
      availableTemplates.value[0] ??
      null
    );
  });
  const resumeStyle = computed<ResumeStyle>(() => {
    if (!currentTemplate.value) {
      return resolveResumeStyle(
        {
          defaults: createDefaultTemplateValues(),
          editorSchema: [],
        },
        templateValues.value,
      );
    }

    return resolveResumeStyle(currentTemplate.value, templateValues.value);
  });

  const setTemplateValue = (key: string, value: TemplateValue) => {
    const template = currentTemplate.value;

    if (!template) {
      templateValues.value = {
        ...templateValues.value,
        [key]: value,
      };
      return;
    }

    const nextResolved = resolveTemplateValues(template, {
      ...templateValues.value,
      [key]: value,
    });

    templateValues.value = extractTemplateValueOverrides(template, nextResolved);
  };

  const resetTemplateValues = () => {
    templateValues.value = {};
  };

  const state: ResumeStoreState = {
    markdownContent: ref(DEFAULT_MARKDOWN),
    availableTemplates,
    activeTemplate,
    isExporting: ref(false),
    isPreviewRendering: ref(false),
    isPreviewReady: ref(false),
    templatesLoaded: ref(false),
    templateValues,
    resumeStyle,
    renderProfilesByFile: ref<Record<string, ResumeRenderProfile>>({}),
    workspacePath: ref<string | null>(null),
    fileList: ref<FileItem[]>([]),
    pdfFileList: ref<FileItem[]>([]),
    photoFileList: ref<PhotoItem[]>([]),
    activeFilePath: ref<string | null>(null),
    activeFileStatus: ref("ready"),
    isDirty: ref(false),
    pendingLocalMutationPaths: ref<string[]>([]),
    sidebarPrimaryView: ref<SidebarPrimaryView>("library"),
    isSidebarOpen: ref(false),
    shouldShowWorkspaceDialog: ref(false),
    currentPhotoPath: ref<string | null>(null),
    photoBase64: ref<string | null>(null),
    editorJumpRequest: ref<EditorJumpRequest | null>(null),
    editorJumpToken: ref(0),
    isTemplateDialogVisible: ref(false),
  };

  const runtime: ResumeStoreRuntime = {
    localMutationTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    queuedWorkspacePaths: new Map<string, string>(),
    queuedWorkspaceRefreshTimer: null,
    previewRenderPromise: null,
    previewRenderToken: 0,
    workspaceChangedUnlisten: null,
    workspaceChangedListenerPromise: null,
    conflictPromptPromise: null,
    ignoredExternalContent: null,
  };

  const baseContext = createBaseContext(state, runtime);

  const openTemplateDialog = () => {
    state.isTemplateDialogVisible.value = true;
  };

  const startPreviewRender = (promise: Promise<void>) => {
    const token = ++runtime.previewRenderToken;
    runtime.previewRenderPromise = promise;
    state.isPreviewRendering.value = true;
    state.isPreviewReady.value = false;
    return token;
  };

  const finishPreviewRender = (token: number, isReady: boolean) => {
    if (token !== runtime.previewRenderToken) {
      return;
    }

    runtime.previewRenderPromise = null;
    state.isPreviewRendering.value = false;
    state.isPreviewReady.value = isReady;
  };

  const setLastOpenedPath = (path: string | null) => {
    if (path) {
      localStorage.setItem(STORAGE_KEYS.lastOpenedPath, path);
      return;
    }

    removeStorageItem(STORAGE_KEYS.lastOpenedPath);
  };

  const setCurrentPhoto = (path: string | null, dataUrl: string | null) => {
    state.currentPhotoPath.value = path;
    state.photoBase64.value = dataUrl;

    if (path) {
      localStorage.setItem(STORAGE_KEYS.lastPhotoPath, path);
      return;
    }

    removeStorageItem(STORAGE_KEYS.lastPhotoPath);
  };

  const getWorkspaceRelativePath = (path: string | null | undefined) => {
    if (!path || !state.workspacePath.value) {
      return null;
    }

    const normalizedWorkspace = state.workspacePath.value
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
    const normalizedPath = path.replace(/\\/g, "/");
    const workspaceKey = normalizePathKey(normalizedWorkspace);
    const pathKey = normalizePathKey(normalizedPath);
    const workspacePrefixKey = `${workspaceKey}/`;

    if (pathKey === workspaceKey) {
      return "";
    }

    if (pathKey.startsWith(workspacePrefixKey)) {
      return normalizedPath.slice(normalizedWorkspace.length + 1);
    }

    return normalizedPath;
  };

  let clearQueuedWorkspaceRefresh = () => {};
  let clearPendingLocalMutations = () => {};
  let clearPhotoState = () => {
    setCurrentPhoto(null, null);
  };
  let resetActiveDocumentState = () => {
    state.activeFilePath.value = null;
    state.activeFileStatus.value = "ready";
    state.markdownContent.value = DEFAULT_MARKDOWN;
    state.isDirty.value = false;
    runtime.ignoredExternalContent = null;
    state.editorJumpRequest.value = null;
    setLastOpenedPath(null);
  };
  let registerLocalMutation = (..._paths: Array<string | null | undefined>) => {};
  let syncActiveFileRenderProfile = () => {};
  let persistActiveFileRenderState = async () => {};
  let loadWorkspaceRenderState = async (_dirPath: string) => {};
  let refreshPdfList = async (_dirPath: string) => [] as FileItem[];
  let refreshPhotoList = async (_dirPath: string) => [] as PhotoItem[];
  let refreshWorkspaceLists = async (_dirPath: string) => [] as FileItem[];
  let openDefaultFile = async (_files: FileItem[]) => {};
  let openFile = async (_path: string) => {};
  let updateRenderProfilePath = async (
    _oldPath: string,
    _newPath: string,
    _mode: "move" | "copy",
  ) => {};
  let deleteRenderProfile = async (_path: string) => {};
  let loadPhoto = async (_path: string | null) => {};
  let resolveNextPhotoPath = (_entries: PhotoItem[]) => null as string | null;
  let ensurePathExists = async (_path: string) => false;
  let readResumeContent = async (_path: string) => "";
  let markActiveFileMissing = () => {};
  let hasFile = (files: FileItem[], path: string) =>
    files.some((file) => normalizePathKey(file.path) === normalizePathKey(path));

  const syncWorkspaceWatch = async (path: string | null) => {
    try {
      await invoke("set_workspace_watch", { dirPath: path });
    } catch (error) {
      console.error("Failed to update workspace watcher:", error);
    }
  };

  const setWorkspacePath = (path: string | null) => {
    clearQueuedWorkspaceRefresh();
    state.workspacePath.value = path;
    void syncWorkspaceWatch(path);

    if (path) {
      localStorage.setItem(STORAGE_KEYS.workspacePath, path);
      state.shouldShowWorkspaceDialog.value = false;
      return;
    }

    removeStorageItem(STORAGE_KEYS.workspacePath);
  };

  const clearWorkspaceState = () => {
    clearQueuedWorkspaceRefresh();
    clearPendingLocalMutations();
    state.workspacePath.value = null;
    state.fileList.value = [];
    state.pdfFileList.value = [];
    state.photoFileList.value = [];
    state.renderProfilesByFile.value = {};
    state.activeTemplate.value = DEFAULT_TEMPLATE_ID;
    state.templateValues.value = {};
    resetActiveDocumentState();
    state.sidebarPrimaryView.value = "library";
    clearPhotoState();
    removeStorageItem(STORAGE_KEYS.workspacePath);
  };

  const invalidateWorkspace = () => {
    clearWorkspaceState();
    void syncWorkspaceWatch(null);
    state.shouldShowWorkspaceDialog.value = true;
    removeStorageItem(STORAGE_KEYS.lastOpenedPath);
  };

  const photoModule = createPhotoModule({
    ...baseContext,
    registerLocalMutation: (...paths) => registerLocalMutation(...paths),
    persistActiveFileRenderState: () => persistActiveFileRenderState(),
    setCurrentPhoto,
  });
  clearPhotoState = photoModule.clearPhotoState;
  loadPhoto = photoModule.loadPhoto;
  resolveNextPhotoPath = photoModule.resolveNextPhotoPath;
  refreshPhotoList = photoModule.refreshPhotoList;

  const renderProfileModule = createRenderProfileModule({
    ...baseContext,
    getWorkspaceRelativePath,
    loadPhoto: (path) => loadPhoto(path),
    resolveNextPhotoPath: (entries) => resolveNextPhotoPath(entries),
  });
  syncActiveFileRenderProfile = renderProfileModule.syncActiveFileRenderProfile;
  persistActiveFileRenderState = renderProfileModule.persistActiveFileRenderState;
  loadWorkspaceRenderState = renderProfileModule.loadWorkspaceRenderState;
  updateRenderProfilePath = renderProfileModule.updateRenderProfilePath;
  deleteRenderProfile = renderProfileModule.deleteRenderProfile;

  const workspaceFilesModule = createWorkspaceFilesModule({
    ...baseContext,
    setWorkspacePath,
    invalidateWorkspace,
    loadWorkspaceRenderState: (dirPath) => loadWorkspaceRenderState(dirPath),
    openTemplateDialog,
    openFile: (path) => openFile(path),
    refreshPhotoList: (dirPath) => refreshPhotoList(dirPath),
    updateRenderProfilePath: (oldPath, newPath, mode) =>
      updateRenderProfilePath(oldPath, newPath, mode),
    deleteRenderProfile: (path) => deleteRenderProfile(path),
    registerLocalMutation: (...paths) => registerLocalMutation(...paths),
    ensurePathExists: (path) => ensurePathExists(path),
  });
  refreshPdfList = workspaceFilesModule.refreshPdfList;
  refreshWorkspaceLists = workspaceFilesModule.refreshWorkspaceLists;
  openDefaultFile = workspaceFilesModule.openDefaultFile;
  hasFile = workspaceFilesModule.hasFile;

  const editorModule = createEditorModule({
    ...baseContext,
    setLastOpenedPath,
    syncActiveFileRenderProfile: () => syncActiveFileRenderProfile(),
    refreshWorkspaceLists: (dirPath) => refreshWorkspaceLists(dirPath),
    updateRenderProfilePath: (oldPath, newPath, mode) =>
      updateRenderProfilePath(oldPath, newPath, mode),
    openDefaultFile: (files) => openDefaultFile(files as FileItem[]),
    registerLocalMutation: (...paths) => registerLocalMutation(...paths),
  });
  resetActiveDocumentState = editorModule.resetActiveDocumentState;
  openFile = editorModule.openFile;
  ensurePathExists = editorModule.ensurePathExists;
  readResumeContent = editorModule.readResumeContent;
  markActiveFileMissing = editorModule.markActiveFileMissing;

  const workspaceWatchModule = createWorkspaceWatchModule({
    ...baseContext,
    refreshWorkspaceLists: (dirPath) => refreshWorkspaceLists(dirPath),
    hasFile: (files, path) => hasFile(files, path),
    markActiveFileMissing: () => markActiveFileMissing(),
    readResumeContent: (path) => readResumeContent(path),
    ensurePathExists: (path) => ensurePathExists(path),
    openFile: (path) => openFile(path),
    openDefaultFile: (files) => openDefaultFile(files),
    setWorkspacePath,
    loadWorkspaceRenderState: (dirPath) => loadWorkspaceRenderState(dirPath),
    syncWorkspaceWatch,
  });
  clearQueuedWorkspaceRefresh = workspaceWatchModule.clearQueuedWorkspaceRefresh;
  clearPendingLocalMutations = workspaceWatchModule.clearPendingLocalMutations;
  registerLocalMutation = workspaceWatchModule.registerLocalMutation;

  const exportModule = createExportModule({
    ...baseContext,
    refreshPdfList: (dirPath) => refreshPdfList(dirPath),
  });

  const outlineResult = computed(() =>
    parseMarkdownOutline(state.markdownContent.value),
  );
  const outlineTree = computed<ResumeOutlineNode[]>(() => outlineResult.value.tree);
  const activeFileName = computed(() => {
    if (!state.activeFilePath.value) {
      return "";
    }

    return (
      state.activeFilePath.value.split(/[/\\]/).pop()?.replace(/\.md$/, "") ?? ""
    );
  });

  const moveOutlineNode = async (
    nodeId: string,
    targetIndex: number,
    parentId: string | null,
  ) => {
    if (state.activeFileStatus.value !== "ready") {
      return;
    }

    const nextMarkdown = reorderOutlineSiblings(
      state.markdownContent.value,
      nodeId,
      targetIndex,
      parentId,
    );

    if (nextMarkdown === state.markdownContent.value) {
      return;
    }

    await editorModule.replaceMarkdownFromOutline(nextMarkdown);
  };

  const requestEditorJump = (nodeId: string) => {
    const targetNode = outlineResult.value.nodesById.get(nodeId);
    if (!targetNode) {
      return;
    }

    state.editorJumpRequest.value = {
      line: targetNode.startLine,
      token: ++state.editorJumpToken.value,
    };
  };

  const clearEditorJumpRequest = () => {
    state.editorJumpRequest.value = null;
  };

  workspaceWatchModule.ensureWorkspaceChangedListener();
  void workspaceWatchModule.initWorkspace();

  return {
    markdownContent: state.markdownContent,
    availableTemplates: state.availableTemplates,
    activeTemplate: state.activeTemplate,
    currentTemplate,
    isExporting: state.isExporting,
    isPreviewRendering: state.isPreviewRendering,
    isPreviewReady: state.isPreviewReady,
    templatesLoaded: state.templatesLoaded,
    templateValues: state.templateValues,
    resumeStyle: state.resumeStyle,
    setTemplateValue,
    resetTemplateValues,
    renderProfilesByFile: state.renderProfilesByFile,
    loadTemplates: renderProfileModule.loadTemplates,
    saveCurrentTemplate: renderProfileModule.saveCurrentTemplate,
    exportCurrentPdf: exportModule.exportCurrentPdf,
    persistActiveFileRenderState: renderProfileModule.persistActiveFileRenderState,
    resetActiveFileRenderSettings: renderProfileModule.resetActiveFileRenderSettings,
    setActiveTemplateForCurrentFile: renderProfileModule.setActiveTemplateForCurrentFile,
    workspacePath: state.workspacePath,
    fileList: state.fileList,
    pdfFileList: state.pdfFileList,
    photoFileList: state.photoFileList,
    activeFilePath: state.activeFilePath,
    activeFileStatus: state.activeFileStatus,
    activeFileName,
    isDirty: state.isDirty,
    pendingLocalMutationPaths: state.pendingLocalMutationPaths,
    outlineTree,
    sidebarPrimaryView: state.sidebarPrimaryView,
    isSidebarOpen: state.isSidebarOpen,
    shouldShowWorkspaceDialog: state.shouldShowWorkspaceDialog,
    isTemplateDialogVisible: state.isTemplateDialogVisible,
    openTemplateDialog,
    currentPhotoPath: state.currentPhotoPath,
    editorJumpRequest: state.editorJumpRequest,
    selectWorkspace: workspaceFilesModule.selectWorkspace,
    openWorkspaceDirectory: workspaceFilesModule.openWorkspaceDirectory,
    openFile: editorModule.openFile,
    openFirstAvailableFile: editorModule.openFirstAvailableFile,
    updateMarkdownContent: editorModule.updateMarkdownContent,
    saveCurrentFile: editorModule.saveCurrentFile,
    saveMissingFileAs: editorModule.saveMissingFileAs,
    replaceMarkdownFromOutline: editorModule.replaceMarkdownFromOutline,
    createFile: workspaceFilesModule.createFile,
    createFromTemplate: workspaceFilesModule.createFromTemplate,
    deleteFile: workspaceFilesModule.deleteFile,
    deletePdf: workspaceFilesModule.deletePdf,
    renameFile: workspaceFilesModule.renameFile,
    duplicateFile: workspaceFilesModule.duplicateFile,
    refreshFileList: workspaceFilesModule.refreshFileList,
    refreshPdfList: workspaceFilesModule.refreshPdfList,
    refreshPhotoList: photoModule.refreshPhotoList,
    selectPhoto: photoModule.selectPhoto,
    importIdPhoto: photoModule.importIdPhoto,
    deletePhoto: photoModule.deletePhoto,
    moveOutlineNode,
    requestEditorJump,
    clearEditorJumpRequest,
    startPreviewRender,
    finishPreviewRender,
    photoBase64: state.photoBase64,
  };
});
