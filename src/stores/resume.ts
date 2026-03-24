import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  parseMarkdownOutline,
  reorderOutlineSiblings,
  type ResumeOutlineNode,
} from "../utils/markdownOutline";
import {
  cloneResumeStyle,
  createDefaultResumeStyle,
  parseResumeStyleFromTemplateCss,
} from "../utils/templateStyle";

export interface ResumeTemplate {
  id: string;
  name: string;
  css: string;
}

export interface FileItem {
  name: string;
  path: string;
}

export interface PhotoItem extends FileItem {
  isIdPhoto: boolean;
}

export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  fontSize: number;
  paragraphSpacing: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  dateSize?: number;
  dateWeight?: string;
  lineHeight: number;
  marginV: number;
  marginH: number;
  personalInfoMode?: "text" | "icon";
}

export type SidebarPrimaryView = "library" | "outline";
export type ActiveFileStatus = "ready" | "missing" | "conflict";

export interface EditorJumpRequest {
  line: number;
  token: number;
}

export interface WorkspaceChangedEvent {
  workspacePath: string;
  paths: string[];
}

export interface ResumeRenderProfile {
  templateId: string;
  style: ResumeStyle;
}

interface WorkspaceRenderState {
  version: number;
  files: Record<string, ResumeRenderProfile>;
}

const DEFAULT_MARKDOWN = "";
const DEFAULT_FILE_NAME = "未命名.md";
const DEFAULT_TEMPLATE_ID = "modern";
const WATCH_REFRESH_DELAY = 160;
const LOCAL_MUTATION_TTL = 4000;
const RENDER_STATE_VERSION = 1;
const IS_WINDOWS =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

const STORAGE_KEYS = {
  workspacePath: "resume-workspace-path",
  lastOpenedPath: "resume-last-opened-path",
  lastPhotoPath: "resume-last-photo-path",
} as const;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

const ensureMarkdownFileName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_FILE_NAME;
  }

  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
};

const removeStorageItem = (key: string) => {
  localStorage.removeItem(key);
};

const normalizePathKey = (path: string) => {
  const normalized = path.replace(/\\/g, "/");
  return IS_WINDOWS ? normalized.toLowerCase() : normalized;
};

export const useResumeStore = defineStore("resume", () => {
  const markdownContent = ref(DEFAULT_MARKDOWN);

  const availableTemplates = ref<ResumeTemplate[]>([]);
  const activeTemplate = ref(DEFAULT_TEMPLATE_ID);
  const isExporting = ref(false);
  const templatesLoaded = ref(false);
  const resumeStyle = ref<ResumeStyle>(createDefaultResumeStyle());
  const renderProfilesByFile = ref<Record<string, ResumeRenderProfile>>({});

  const workspacePath = ref<string | null>(null);
  const fileList = ref<FileItem[]>([]);
  const pdfFileList = ref<FileItem[]>([]);
  const photoFileList = ref<PhotoItem[]>([]);
  const activeFilePath = ref<string | null>(null);
  const activeFileStatus = ref<ActiveFileStatus>("ready");
  const isDirty = ref(false);
  const pendingLocalMutationPaths = ref<string[]>([]);
  const sidebarPrimaryView = ref<SidebarPrimaryView>("library");
  const isSidebarOpen = ref(false);
  const shouldShowWorkspaceDialog = ref(false);
  const currentPhotoPath = ref<string | null>(null);
  const photoBase64 = ref<string | null>(null);
  const editorJumpRequest = ref<EditorJumpRequest | null>(null);
  const editorJumpToken = ref(0);

  const localMutationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const queuedWorkspacePaths = new Map<string, string>();
  let queuedWorkspaceRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let workspaceChangedUnlisten: UnlistenFn | null = null;
  let workspaceChangedListenerPromise: Promise<UnlistenFn> | null = null;
  let conflictPromptPromise: Promise<void> | null = null;
  let ignoredExternalContent: { pathKey: string; content: string } | null = null;

  const syncPendingLocalMutationPaths = () => {
    pendingLocalMutationPaths.value = Array.from(localMutationTimers.keys());
  };

  const clearQueuedWorkspaceRefresh = () => {
    if (queuedWorkspaceRefreshTimer) {
      clearTimeout(queuedWorkspaceRefreshTimer);
      queuedWorkspaceRefreshTimer = null;
    }

    queuedWorkspacePaths.clear();
  };

  const clearPendingLocalMutations = () => {
    for (const timer of localMutationTimers.values()) {
      clearTimeout(timer);
    }

    localMutationTimers.clear();
    syncPendingLocalMutationPaths();
  };

  const registerLocalMutation = (...paths: Array<string | null | undefined>) => {
    for (const path of paths) {
      if (!path) {
        continue;
      }

      const key = normalizePathKey(path);
      const existingTimer = localMutationTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      localMutationTimers.set(
        key,
        setTimeout(() => {
          localMutationTimers.delete(key);
          syncPendingLocalMutationPaths();
        }, LOCAL_MUTATION_TTL),
      );
    }

    syncPendingLocalMutationPaths();
  };

  const consumeLocalMutationPaths = (paths: string[]) => {
    const externalPaths: string[] = [];

    for (const path of paths) {
      const key = normalizePathKey(path);
      const timer = localMutationTimers.get(key);

      if (!timer) {
        externalPaths.push(path);
        continue;
      }

      clearTimeout(timer);
      localMutationTimers.delete(key);
    }

    syncPendingLocalMutationPaths();
    return externalPaths;
  };

  const hasFile = (files: FileItem[], path: string) => {
    const pathKey = normalizePathKey(path);
    return files.some((file) => normalizePathKey(file.path) === pathKey);
  };

  const clearPhotoState = () => {
    currentPhotoPath.value = null;
    photoBase64.value = null;
    removeStorageItem(STORAGE_KEYS.lastPhotoPath);
  };

  const resetActiveDocumentState = () => {
    activeFilePath.value = null;
    activeFileStatus.value = "ready";
    markdownContent.value = DEFAULT_MARKDOWN;
    isDirty.value = false;
    ignoredExternalContent = null;
    editorJumpRequest.value = null;
    setLastOpenedPath(null);
  };

  const clearWorkspaceState = () => {
    clearQueuedWorkspaceRefresh();
    clearPendingLocalMutations();
    workspacePath.value = null;
    fileList.value = [];
    pdfFileList.value = [];
    photoFileList.value = [];
    renderProfilesByFile.value = {};
    activeTemplate.value = DEFAULT_TEMPLATE_ID;
    resumeStyle.value = createDefaultResumeStyle();
    resetActiveDocumentState();
    sidebarPrimaryView.value = "library";
    clearPhotoState();
    removeStorageItem(STORAGE_KEYS.workspacePath);
  };

  const getWorkspaceRelativePath = (path: string | null | undefined) => {
    if (!path || !workspacePath.value) {
      return null;
    }

    const normalizedWorkspace = workspacePath.value
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

  const resolveAvailableTemplateId = (templateId?: string | null) => {
    if (
      templateId &&
      availableTemplates.value.some((template) => template.id === templateId)
    ) {
      return templateId;
    }

    const defaultTemplate = availableTemplates.value.find(
      (template) => template.id === DEFAULT_TEMPLATE_ID,
    );

    return (
      defaultTemplate?.id ?? availableTemplates.value[0]?.id ?? DEFAULT_TEMPLATE_ID
    );
  };

  const getTemplateDefaultStyle = (templateId?: string | null) => {
    const resolvedTemplateId = resolveAvailableTemplateId(templateId);
    const template = availableTemplates.value.find(
      (item) => item.id === resolvedTemplateId,
    );

    if (!template) {
      return createDefaultResumeStyle();
    }

    return parseResumeStyleFromTemplateCss(template.css);
  };

  const applyRenderProfile = (profile?: ResumeRenderProfile | null) => {
    const templateId = resolveAvailableTemplateId(profile?.templateId);
    const baseStyle = getTemplateDefaultStyle(templateId);

    activeTemplate.value = templateId;
    resumeStyle.value = cloneResumeStyle(
      profile ? { ...baseStyle, ...profile.style } : baseStyle,
    );
  };

  const syncActiveFileRenderProfile = () => {
    const fileKey = getWorkspaceRelativePath(activeFilePath.value);
    applyRenderProfile(fileKey ? renderProfilesByFile.value[fileKey] : null);
  };

  const loadWorkspaceRenderState = async (dirPath: string) => {
    try {
      const state = await invoke<WorkspaceRenderState>(
        "read_workspace_render_state",
        {
          workspacePath: dirPath,
        },
      );
      const files = state?.files ?? {};

      renderProfilesByFile.value = Object.fromEntries(
        Object.entries(files).map(([path, profile]) => [
          path.replace(/\\/g, "/"),
          {
            templateId: profile?.templateId ?? DEFAULT_TEMPLATE_ID,
            style: cloneResumeStyle(profile?.style),
          },
        ]),
      );
    } catch (error) {
      console.error("Failed to load workspace render state:", error);
      renderProfilesByFile.value = {};
    }
  };

  const persistWorkspaceRenderState = async () => {
    if (!workspacePath.value) {
      return;
    }

    const state: WorkspaceRenderState = {
      version: RENDER_STATE_VERSION,
      files: renderProfilesByFile.value,
    };

    await invoke("write_workspace_render_state", {
      workspacePath: workspacePath.value,
      state,
    });
  };

  const persistActiveFileRenderState = async () => {
    const fileKey = getWorkspaceRelativePath(activeFilePath.value);
    if (!fileKey) {
      return;
    }

    renderProfilesByFile.value = {
      ...renderProfilesByFile.value,
      [fileKey]: {
        templateId: activeTemplate.value,
        style: cloneResumeStyle(resumeStyle.value),
      },
    };

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to persist active render state:", error);
    }
  };

  const resetActiveFileRenderSettings = () => {
    applyRenderProfile({
      templateId: activeTemplate.value,
      style: getTemplateDefaultStyle(activeTemplate.value),
    });
  };

  const setActiveTemplateForCurrentFile = (templateId: string) => {
    applyRenderProfile({
      templateId,
      style: getTemplateDefaultStyle(templateId),
    });
  };

  const updateRenderProfilePath = async (
    oldPath: string,
    newPath: string,
    mode: "move" | "copy",
  ) => {
    const oldKey = getWorkspaceRelativePath(oldPath);
    const newKey = getWorkspaceRelativePath(newPath);

    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    const profile = renderProfilesByFile.value[oldKey];
    if (!profile) {
      return;
    }

    const nextProfiles = { ...renderProfilesByFile.value };
    nextProfiles[newKey] = {
      templateId: profile.templateId,
      style: cloneResumeStyle(profile.style),
    };

    if (mode === "move") {
      delete nextProfiles[oldKey];
    }

    renderProfilesByFile.value = nextProfiles;

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to update render profile path:", error);
    }
  };

  const deleteRenderProfile = async (path: string) => {
    const fileKey = getWorkspaceRelativePath(path);
    if (!fileKey || !renderProfilesByFile.value[fileKey]) {
      return;
    }

    const nextProfiles = { ...renderProfilesByFile.value };
    delete nextProfiles[fileKey];
    renderProfilesByFile.value = nextProfiles;

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to delete render profile:", error);
    }
  };

  const syncWorkspaceWatch = async (path: string | null) => {
    try {
      await invoke("set_workspace_watch", { dirPath: path });
    } catch (error) {
      console.error("Failed to update workspace watcher:", error);
    }
  };

  const invalidateWorkspace = () => {
    clearWorkspaceState();
    void syncWorkspaceWatch(null);
    shouldShowWorkspaceDialog.value = true;
    removeStorageItem(STORAGE_KEYS.lastOpenedPath);
  };

  const setWorkspacePath = (path: string | null) => {
    clearQueuedWorkspaceRefresh();
    workspacePath.value = path;
    void syncWorkspaceWatch(path);

    if (path) {
      localStorage.setItem(STORAGE_KEYS.workspacePath, path);
      shouldShowWorkspaceDialog.value = false;
      return;
    }

    removeStorageItem(STORAGE_KEYS.workspacePath);
  };

  const setLastOpenedPath = (path: string | null) => {
    if (path) {
      localStorage.setItem(STORAGE_KEYS.lastOpenedPath, path);
      return;
    }

    removeStorageItem(STORAGE_KEYS.lastOpenedPath);
  };

  const setCurrentPhoto = (path: string | null, dataUrl: string | null) => {
    currentPhotoPath.value = path;
    photoBase64.value = dataUrl;

    if (path) {
      localStorage.setItem(STORAGE_KEYS.lastPhotoPath, path);
      return;
    }

    removeStorageItem(STORAGE_KEYS.lastPhotoPath);
  };

  const applyOpenedFile = (path: string, content: string) => {
    markdownContent.value = content;
    activeFilePath.value = path;
    activeFileStatus.value = "ready";
    isDirty.value = false;
    ignoredExternalContent = null;
    editorJumpRequest.value = null;
    setLastOpenedPath(path);
  };

  const markActiveFileMissing = () => {
    if (activeFileStatus.value === "missing") {
      return;
    }

    activeFileStatus.value = "missing";
    ignoredExternalContent = null;
    ElMessage.warning("当前打开的文件已从磁盘删除。");
  };

  const readResumeContent = async (path: string) => {
    return await invoke<string>("read_resume", { path });
  };

  const ensurePathExists = async (path: string) => {
    return await invoke<boolean>("path_exists", { path });
  };

  const openDefaultFile = async (files: FileItem[]) => {
    if (files.length > 0) {
      await openFile(files[0].path);
      return;
    }

    await createFile(DEFAULT_FILE_NAME);
  };

  const refreshWorkspaceLists = async (dirPath: string) => {
    const files = await refreshFileList(dirPath);
    await refreshPdfList(dirPath);
    await refreshPhotoList(dirPath);
    return files;
  };

  const resolveNextPhotoPath = (entries: PhotoItem[]) => {
    const preferredPaths = [
      currentPhotoPath.value,
      localStorage.getItem(STORAGE_KEYS.lastPhotoPath),
    ].filter((path): path is string => Boolean(path));

    return (
      preferredPaths.find((path) => entries.some((entry) => entry.path === path)) ??
      entries.find((entry) => entry.isIdPhoto)?.path ??
      null
    );
  };

  const loadPhoto = async (path: string | null) => {
    if (!path) {
      setCurrentPhoto(null, null);
      return;
    }

    try {
      const dataUrl = await invoke<string>("read_image_as_data_url", { path });
      setCurrentPhoto(path, dataUrl);
    } catch (error) {
      console.error("Failed to load image:", error);
      setCurrentPhoto(null, null);
      throw error;
    }
  };

  const loadTemplates = async () => {
    try {
      const templates = await invoke<ResumeTemplate[]>("list_templates");
      availableTemplates.value = templates;

      if (
        templates.length > 0 &&
        !templates.some((template) => template.id === activeTemplate.value)
      ) {
        activeTemplate.value = templates[0].id;
      }

      templatesLoaded.value = true;
      syncActiveFileRenderProfile();
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const refreshFileList = async (dirPath: string) => {
    try {
      const entries = await invoke<FileItem[]>("list_resumes", { dirPath });
      fileList.value = entries;
      return entries;
    } catch (error) {
      console.error("Failed to read directory:", error);
      invalidateWorkspace();
      throw error;
    }
  };

  const refreshPdfList = async (dirPath: string) => {
    try {
      const entries = await invoke<FileItem[]>("list_pdfs", { dirPath });
      pdfFileList.value = entries;
      return entries;
    } catch (error) {
      console.error("Failed to read pdf directory:", error);
      pdfFileList.value = [];
      throw error;
    }
  };

  const refreshPhotoList = async (dirPath: string) => {
    try {
      const entries = await invoke<PhotoItem[]>("list_images", { dirPath });
      photoFileList.value = entries;

      const nextPhotoPath = resolveNextPhotoPath(entries);
      if (!nextPhotoPath) {
        await loadPhoto(null);
      } else if (nextPhotoPath !== currentPhotoPath.value || !photoBase64.value) {
        await loadPhoto(nextPhotoPath);
      }

      return entries;
    } catch (error) {
      console.error("Failed to read image directory:", error);
      photoFileList.value = [];
      await loadPhoto(null);
      throw error;
    }
  };

  const resolveExternalChangeForActiveFile = async (changedPaths: string[]) => {
    const currentPath = activeFilePath.value;
    if (!currentPath) {
      return;
    }

    const currentPathKey = normalizePathKey(currentPath);
    if (!changedPaths.some((path) => normalizePathKey(path) === currentPathKey)) {
      return;
    }

    try {
      const diskContent = await readResumeContent(currentPath);
      if (activeFilePath.value !== currentPath) {
        return;
      }

      if (diskContent === markdownContent.value) {
        ignoredExternalContent = null;
        return;
      }

      if (
        ignoredExternalContent &&
        ignoredExternalContent.pathKey === currentPathKey &&
        ignoredExternalContent.content === diskContent
      ) {
        return;
      }

      if (!isDirty.value) {
        markdownContent.value = diskContent;
        activeFileStatus.value = "ready";
        isDirty.value = false;
        ignoredExternalContent = null;
        ElMessage.info("当前文件已从磁盘重新加载。");
        return;
      }

      if (conflictPromptPromise) {
        return;
      }

      activeFileStatus.value = "conflict";
      conflictPromptPromise = (async () => {
        const shouldReload = await ElMessageBox.confirm(
          "该文件已被其他程序修改。是否重新加载磁盘中的最新内容？",
          "检测到外部更新",
          {
            confirmButtonText: "重新加载",
            cancelButtonText: "保留当前内容",
            type: "warning",
            distinguishCancelAndClose: false,
          },
        )
          .then(() => true)
          .catch(() => false);

        if (activeFilePath.value !== currentPath) {
          return;
        }

        if (shouldReload) {
          markdownContent.value = diskContent;
          activeFileStatus.value = "ready";
          isDirty.value = false;
          ignoredExternalContent = null;
          ElMessage.info("已加载磁盘中的最新内容。");
          return;
        }

        activeFileStatus.value = "ready";
        ignoredExternalContent = {
          pathKey: currentPathKey,
          content: diskContent,
        };
        ElMessage.info("已保留当前编辑内容，后续保存将覆盖磁盘版本。");
      })().finally(() => {
        conflictPromptPromise = null;
        if (activeFileStatus.value === "conflict") {
          activeFileStatus.value = "ready";
        }
      });

      await conflictPromptPromise;
    } catch (error) {
      console.error("Failed to process external file change:", error);

      if (!(await ensurePathExists(currentPath))) {
        markActiveFileMissing();
      }
    }
  };

  const handleWorkspaceChanged = async (paths: string[]) => {
    const currentWorkspace = workspacePath.value;
    if (!currentWorkspace) {
      return;
    }

    const externalPaths = consumeLocalMutationPaths(paths);
    let files: FileItem[] = [];
    try {
      files = await refreshWorkspaceLists(currentWorkspace);
    } catch {
      return;
    }

    if (activeFilePath.value && !hasFile(files, activeFilePath.value)) {
      markActiveFileMissing();
      return;
    }

    if (externalPaths.length === 0) {
      return;
    }

    await resolveExternalChangeForActiveFile(externalPaths);
  };

  const queueWorkspaceChanged = (payload: WorkspaceChangedEvent) => {
    if (!workspacePath.value || payload.workspacePath !== workspacePath.value) {
      return;
    }

    for (const path of payload.paths) {
      queuedWorkspacePaths.set(normalizePathKey(path), path);
    }

    if (queuedWorkspaceRefreshTimer) {
      clearTimeout(queuedWorkspaceRefreshTimer);
    }

    queuedWorkspaceRefreshTimer = setTimeout(() => {
      const changedPaths = Array.from(queuedWorkspacePaths.values());
      queuedWorkspacePaths.clear();
      queuedWorkspaceRefreshTimer = null;
      void handleWorkspaceChanged(changedPaths);
    }, WATCH_REFRESH_DELAY);
  };

  const ensureWorkspaceChangedListener = () => {
    if (workspaceChangedUnlisten || workspaceChangedListenerPromise) {
      return;
    }

    workspaceChangedListenerPromise = listen<WorkspaceChangedEvent>(
      "workspace-changed",
      ({ payload }) => {
        queueWorkspaceChanged(payload);
      },
    )
      .then((unlisten) => {
        workspaceChangedUnlisten = unlisten;
        return unlisten;
      })
      .catch((error) => {
        workspaceChangedListenerPromise = null;
        console.error("Failed to listen for workspace changes:", error);
        throw error;
      });
  };

  const selectPhoto = async (path: string) => {
    if (!photoFileList.value.some((file) => file.path === path)) {
      return;
    }

    try {
      await loadPhoto(path);
    } catch {
      ElMessage.error("加载证件照失败");
    }
  };

  const importIdPhoto = async () => {
    if (!workspacePath.value) {
      ElMessage.warning("请先选择工作文件夹");
      return;
    }

    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "图片文件",
            extensions: IMAGE_EXTENSIONS,
          },
        ],
      });

      if (!selected || typeof selected !== "string") {
        return;
      }

      const imported = await invoke<PhotoItem>("import_id_photo", {
        sourcePath: selected,
        workspacePath: workspacePath.value,
      });

      registerLocalMutation(imported.path);
      setCurrentPhoto(imported.path, photoBase64.value);
      await refreshPhotoList(workspacePath.value);
      ElMessage.success(`已导入证件照：${imported.name}`);
    } catch (error) {
      console.error("Failed to import id photo:", error);
      ElMessage.error(`导入证件照失败：${String(error)}`);
    }
  };

  const deletePhoto = async (path: string) => {
    try {
      registerLocalMutation(path);
      await invoke("delete_resume", { path });

      if (workspacePath.value) {
        await refreshPhotoList(workspacePath.value);
      } else if (currentPhotoPath.value === path) {
        await loadPhoto(null);
      }

      ElMessage.success("证件照已删除");
    } catch (error) {
      console.error("Failed to delete photo:", error);
      ElMessage.error("删除证件照失败");
    }
  };

  const selectWorkspace = async () => {
    try {
      const selectedDir = await openDialog({ directory: true, multiple: false });
      if (!selectedDir || typeof selectedDir !== "string") {
        return;
      }

      setWorkspacePath(selectedDir);
      await loadWorkspaceRenderState(selectedDir);
      const files = await refreshWorkspaceLists(selectedDir);
      await openDefaultFile(files);
    } catch (error) {
      console.error("Failed to open dialog:", error);
    }
  };

  const openWorkspaceDirectory = async () => {
    if (!workspacePath.value) {
      return;
    }

    try {
      await invoke("open_directory", { path: workspacePath.value });
    } catch (error) {
      console.error("Failed to open directory:", error);
      ElMessage.error("打开文件夹失败");
    }
  };

  const openFile = async (path: string) => {
    try {
      const content = await readResumeContent(path);
      applyOpenedFile(path, content);
      syncActiveFileRenderProfile();
    } catch (error) {
      console.error("Failed to read file:", error);
      ElMessage.error("读取文件失败");

      const fallbackFile = fileList.value.find(
        (file) => normalizePathKey(file.path) !== normalizePathKey(path),
      );

      if (fallbackFile) {
        await openFile(fallbackFile.path);
        return;
      }

      resetActiveDocumentState();
    }
  };

  const updateMarkdownContent = (content: string, markDirty = true) => {
    markdownContent.value = content;

    if (markDirty && activeFilePath.value) {
      isDirty.value = true;
    }
  };

  const saveCurrentFile = async (silent = false) => {
    if (!activeFilePath.value) {
      return;
    }

    if (activeFileStatus.value === "missing") {
      if (!silent) {
        ElMessage.warning("当前文件已从磁盘删除，请先另存为新文件。");
      }
      return;
    }

    if (activeFileStatus.value === "conflict") {
      if (!silent) {
        ElMessage.warning("请先处理外部修改冲突。");
      }
      return;
    }

    try {
      const exists = await ensurePathExists(activeFilePath.value);
      if (!exists) {
        markActiveFileMissing();
        if (!silent) {
          ElMessage.warning("当前文件已从磁盘删除，请先另存为新文件。");
        }
        return;
      }

      registerLocalMutation(activeFilePath.value);
      await invoke("write_resume", {
        path: activeFilePath.value,
        content: markdownContent.value,
      });

      isDirty.value = false;
      ignoredExternalContent = null;

      if (!silent) {
        ElMessage.success("文件已保存");
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      ElMessage.error("保存文件失败");
    }
  };

  const saveMissingFileAs = async (name: string) => {
    if (!workspacePath.value) {
      return false;
    }

    try {
      const previousPath = activeFilePath.value;
      const targetPath = await join(
        workspacePath.value,
        ensureMarkdownFileName(name),
      );
      const targetKey = normalizePathKey(targetPath);
      const currentKey = activeFilePath.value
        ? normalizePathKey(activeFilePath.value)
        : null;

      const exists = await ensurePathExists(targetPath);
      if (exists && targetKey !== currentKey) {
        ElMessage.error("同名文件已存在，请换一个名称。");
        return false;
      }

      registerLocalMutation(targetPath);
      await invoke("write_resume", {
        path: targetPath,
        content: markdownContent.value,
      });

      await refreshWorkspaceLists(workspacePath.value);
      if (previousPath) {
        await updateRenderProfilePath(previousPath, targetPath, "move");
      }
      await openFile(targetPath);
      ElMessage.success("已恢复为新文件");
      return true;
    } catch (error) {
      console.error("Failed to recover missing file:", error);
      ElMessage.error("恢复文件失败");
      return false;
    }
  };

  const openFirstAvailableFile = async () => {
    const nextFile = fileList.value[0];
    if (!nextFile) {
      ElMessage.warning("当前目录没有其他可打开的文件。");
      return;
    }

    await openFile(nextFile.path);
  };

  const replaceMarkdownFromOutline = async (nextMarkdown: string) => {
    if (activeFileStatus.value !== "ready" || markdownContent.value === nextMarkdown) {
      return;
    }

    markdownContent.value = nextMarkdown;
    isDirty.value = true;
    await saveCurrentFile(true);
  };

  const createFile = async (name: string) => {
    if (!workspacePath.value) {
      return;
    }

    try {
      const newPath = await join(workspacePath.value, ensureMarkdownFileName(name));
      if (await ensurePathExists(newPath)) {
        ElMessage.error("文件已存在，请换一个名称。");
        return;
      }

      registerLocalMutation(newPath);
      await invoke("write_resume", { path: newPath, content: DEFAULT_MARKDOWN });
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);
      await openFile(newPath);
      ElMessage.success("已创建新文件");
    } catch (error) {
      console.error("Failed to create file:", error);
      ElMessage.error("创建文件失败");
    }
  };

  const deleteFile = async (path: string) => {
    try {
      registerLocalMutation(path);
      await invoke("delete_resume", { path });
      await deleteRenderProfile(path);

      if (!workspacePath.value) {
        ElMessage.success("文件移至回收站");
        return;
      }

      const isDeletingActiveFile =
        activeFilePath.value &&
        normalizePathKey(activeFilePath.value) === normalizePathKey(path);
      const files = await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);

      if (isDeletingActiveFile) {
        await openDefaultFile(files);
      }

      ElMessage.success("文件已移至回收站");
    } catch (error) {
      console.error("Failed to delete file:", error);
      ElMessage.error("删除文件失败");
    }
  };

  const deletePdf = async (path: string) => {
    try {
      registerLocalMutation(path);
      await invoke("delete_resume", { path });

      if (workspacePath.value) {
        await refreshPdfList(workspacePath.value);
      }

      ElMessage.success("PDF 已删除");
    } catch (error) {
      console.error("Failed to delete pdf:", error);
      ElMessage.error("删除 PDF 失败");
    }
  };

  const renameFile = async (oldPath: string, newName: string) => {
    if (!workspacePath.value) {
      return;
    }

    try {
      const newPath = await join(workspacePath.value, ensureMarkdownFileName(newName));
      if (normalizePathKey(oldPath) === normalizePathKey(newPath)) {
        return;
      }

      if (await ensurePathExists(newPath)) {
        ElMessage.error("同名文件已存在，请换一个名称。");
        return;
      }

      registerLocalMutation(oldPath, newPath);
      await invoke("rename_resume", { oldPath, newPath });
      await updateRenderProfilePath(oldPath, newPath, "move");
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);

      if (
        activeFilePath.value &&
        normalizePathKey(activeFilePath.value) === normalizePathKey(oldPath)
      ) {
        await openFile(newPath);
      }

      ElMessage.success("文件名已更新");
    } catch (error) {
      console.error("Failed to rename file:", error);
      ElMessage.error("重命名失败");
    }
  };

  const duplicateFile = async (path: string) => {
    if (!workspacePath.value) {
      return;
    }

    try {
      const originalFile = fileList.value.find(
        (file) => normalizePathKey(file.path) === normalizePathKey(path),
      );
      if (!originalFile) {
        return;
      }

      const baseName = originalFile.name.replace(/\.md$/, "");
      let counter = 1;
      let nextName = `${baseName}-副本.md`;
      let nextPath = await join(workspacePath.value, nextName);

      while (await ensurePathExists(nextPath)) {
        counter += 1;
        nextName = `${baseName}-副本(${counter}).md`;
        nextPath = await join(workspacePath.value, nextName);
      }

      registerLocalMutation(nextPath);
      await invoke("duplicate_resume", { path, newPath: nextPath });
      await updateRenderProfilePath(path, nextPath, "copy");
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);
      ElMessage.success("已创建副本");
    } catch (error) {
      console.error("Failed to duplicate file:", error);
      ElMessage.error("创建副本失败");
    }
  };

  const saveCurrentTemplate = async () => {
    const template = availableTemplates.value.find(
      (item) => item.id === activeTemplate.value,
    );

    if (!template) {
      ElMessage.error("当前模板不存在");
      return;
    }

    const style = resumeStyle.value;
    const marker = "/* @user-overrides */";
    const baseCss = template.css.split(marker)[0].trimEnd();
    const patchCss = `\n\n${marker}\n.resume-document {\n  font-family: ${style.fontFamily};\n  font-size: ${style.fontSize}px;\n  line-height: ${style.lineHeight};\n  --cv-theme-color: ${style.themeColor};\n  --cv-font-size: ${style.fontSize}px;\n  --cv-paragraph-spacing: ${style.paragraphSpacing}px;\n  --cv-contact-render: ${style.personalInfoMode || "text"};\n}\n.resume-document h1 { font-size: ${style.h1Size}px; }\n.resume-document h2 { font-size: ${style.h2Size}px; }\n.resume-document h3 { font-size: ${style.h3Size}px; }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document .job-intention + p,\n.resume-document .contact-info--text,\n.resume-document .contact-info-text-line,\n.resume-document .contact-info--icon,\n.resume-document .contact-info-item { font-size: var(--cv-font-size); }\n.resume-document blockquote { font-size: calc(var(--cv-font-size) * 0.9); }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document blockquote { margin-bottom: var(--cv-paragraph-spacing); }\n@page { margin: ${style.marginV}mm ${style.marginH}mm; }\n.resume-document h2 { border-left-color: var(--cv-theme-color); border-bottom-color: var(--cv-theme-color); background-color: color-mix(in srgb, var(--cv-theme-color) 10%, transparent); }\n`;
    const newCss = baseCss + patchCss;

    try {
      await invoke("save_template", { id: template.id, css: newCss });
      template.css = newCss;
      ElMessage.success("模板已保存");
    } catch (error) {
      console.error("Failed to save template:", error);
      ElMessage.error("保存模板失败");
    }
  };

  const outlineResult = computed(() => parseMarkdownOutline(markdownContent.value));
  const outlineTree = computed<ResumeOutlineNode[]>(() => outlineResult.value.tree);
  const activeFileName = computed(() => {
    if (!activeFilePath.value) {
      return "";
    }

    return activeFilePath.value.split(/[/\\]/).pop()?.replace(/\.md$/, "") ?? "";
  });

  const moveOutlineNode = async (
    nodeId: string,
    targetIndex: number,
    parentId: string | null,
  ) => {
    if (activeFileStatus.value !== "ready") {
      return;
    }

    const nextMarkdown = reorderOutlineSiblings(
      markdownContent.value,
      nodeId,
      targetIndex,
      parentId,
    );

    if (nextMarkdown === markdownContent.value) {
      return;
    }

    await replaceMarkdownFromOutline(nextMarkdown);
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

  const initWorkspace = async () => {
    const savedWorkspace = localStorage.getItem(STORAGE_KEYS.workspacePath);
    if (!savedWorkspace) {
      shouldShowWorkspaceDialog.value = true;
      return;
    }

    setWorkspacePath(savedWorkspace);

    try {
      await loadWorkspaceRenderState(savedWorkspace);
      const files = await refreshWorkspaceLists(savedWorkspace);
      const lastOpenedPath = localStorage.getItem(STORAGE_KEYS.lastOpenedPath);

      if (
        lastOpenedPath &&
        files.some((file) => normalizePathKey(file.path) === normalizePathKey(lastOpenedPath))
      ) {
        await openFile(lastOpenedPath);
        return;
      }

      await openDefaultFile(files);
    } catch {
      shouldShowWorkspaceDialog.value = true;
    }
  };

  ensureWorkspaceChangedListener();
  void initWorkspace();

  return {
    markdownContent,
    availableTemplates,
    activeTemplate,
    isExporting,
    templatesLoaded,
    resumeStyle,
    renderProfilesByFile,
    loadTemplates,
    saveCurrentTemplate,
    persistActiveFileRenderState,
    resetActiveFileRenderSettings,
    setActiveTemplateForCurrentFile,
    workspacePath,
    fileList,
    pdfFileList,
    photoFileList,
    activeFilePath,
    activeFileStatus,
    activeFileName,
    isDirty,
    pendingLocalMutationPaths,
    outlineTree,
    sidebarPrimaryView,
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    currentPhotoPath,
    editorJumpRequest,
    selectWorkspace,
    openWorkspaceDirectory,
    openFile,
    openFirstAvailableFile,
    updateMarkdownContent,
    saveCurrentFile,
    saveMissingFileAs,
    replaceMarkdownFromOutline,
    createFile,
    deleteFile,
    deletePdf,
    renameFile,
    duplicateFile,
    refreshFileList,
    refreshPdfList,
    refreshPhotoList,
    selectPhoto,
    importIdPhoto,
    deletePhoto,
    moveOutlineNode,
    requestEditorJump,
    clearEditorJumpRequest,
    photoBase64,
  };
});
