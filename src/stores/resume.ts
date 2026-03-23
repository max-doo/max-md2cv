import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ElMessage } from "element-plus";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  parseMarkdownOutline,
  reorderOutlineSiblings,
  type ResumeOutlineNode,
} from "../utils/markdownOutline";

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

export interface EditorJumpRequest {
  line: number;
  token: number;
}

const DEFAULT_MARKDOWN = "";
const DEFAULT_FILE_NAME = "未命名.md";
const DEFAULT_TEMPLATE_ID = "modern";

const STORAGE_KEYS = {
  workspacePath: "resume-workspace-path",
  lastOpenedPath: "resume-last-opened-path",
  lastPhotoPath: "resume-last-photo-path",
} as const;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

const createDefaultResumeStyle = (): ResumeStyle => ({
  themeColor: "#4c49cc",
  fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: 14,
  paragraphSpacing: 8,
  h1Size: 28,
  h2Size: 20,
  h3Size: 16,
  dateSize: 14,
  dateWeight: "400",
  lineHeight: 1.6,
  marginV: 10,
  marginH: 12,
  personalInfoMode: "text",
});

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

export const useResumeStore = defineStore("resume", () => {
  const markdownContent = ref(DEFAULT_MARKDOWN);

  const availableTemplates = ref<ResumeTemplate[]>([]);
  const activeTemplate = ref(DEFAULT_TEMPLATE_ID);
  const isExporting = ref(false);
  const templatesLoaded = ref(false);
  const resumeStyle = ref<ResumeStyle>(createDefaultResumeStyle());

  const workspacePath = ref<string | null>(null);
  const fileList = ref<FileItem[]>([]);
  const pdfFileList = ref<FileItem[]>([]);
  const photoFileList = ref<PhotoItem[]>([]);
  const activeFilePath = ref<string | null>(null);
  const sidebarPrimaryView = ref<SidebarPrimaryView>("library");
  const isSidebarOpen = ref(false);
  const shouldShowWorkspaceDialog = ref(false);
  const currentPhotoPath = ref<string | null>(null);
  const photoBase64 = ref<string | null>(null);
  const editorJumpRequest = ref<EditorJumpRequest | null>(null);
  const editorJumpToken = ref(0);

  const clearPhotoState = () => {
    currentPhotoPath.value = null;
    photoBase64.value = null;
    removeStorageItem(STORAGE_KEYS.lastPhotoPath);
  };

  const clearWorkspaceState = () => {
    workspacePath.value = null;
    fileList.value = [];
    pdfFileList.value = [];
    photoFileList.value = [];
    activeFilePath.value = null;
    markdownContent.value = DEFAULT_MARKDOWN;
    sidebarPrimaryView.value = "library";
    editorJumpRequest.value = null;
    clearPhotoState();
    removeStorageItem(STORAGE_KEYS.workspacePath);
    removeStorageItem(STORAGE_KEYS.lastOpenedPath);
  };

  const invalidateWorkspace = () => {
    clearWorkspaceState();
    shouldShowWorkspaceDialog.value = true;
  };

  const setWorkspacePath = (path: string | null) => {
    workspacePath.value = path;

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
      const content = await invoke<string>("read_resume", { path });
      markdownContent.value = content;
      activeFilePath.value = path;
      editorJumpRequest.value = null;
      setLastOpenedPath(path);
    } catch (error) {
      console.error("Failed to read file:", error);
      ElMessage.error("读取文件失败");

      if (fileList.value.length > 0) {
        await openFile(fileList.value[0].path);
      }
    }
  };

  const saveCurrentFile = async (silent = false) => {
    if (!activeFilePath.value) {
      return;
    }

    try {
      await invoke("write_resume", {
        path: activeFilePath.value,
        content: markdownContent.value,
      });

      if (!silent) {
        ElMessage.success("文件已保存");
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      ElMessage.error("保存文件失败");
    }
  };

  const replaceMarkdownFromOutline = async (nextMarkdown: string) => {
    if (markdownContent.value === nextMarkdown) {
      return;
    }

    markdownContent.value = nextMarkdown;
    await saveCurrentFile(true);
  };

  const createFile = async (name: string) => {
    if (!workspacePath.value) {
      return;
    }

    try {
      const newPath = await join(workspacePath.value, ensureMarkdownFileName(name));
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
      await invoke("delete_resume", { path });

      if (!workspacePath.value) {
        ElMessage.success("文件已删除");
        return;
      }

      const files = await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);

      if (activeFilePath.value === path) {
        await openDefaultFile(files);
      }

      ElMessage.success("文件已删除");
    } catch (error) {
      console.error("Failed to delete file:", error);
      ElMessage.error("删除文件失败");
    }
  };

  const deletePdf = async (path: string) => {
    try {
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
      if (oldPath === newPath) {
        return;
      }

      await invoke("rename_resume", { oldPath, newPath });
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);

      if (activeFilePath.value === oldPath) {
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
      const originalFile = fileList.value.find((file) => file.path === path);
      if (!originalFile) {
        return;
      }

      const baseName = originalFile.name.replace(/\.md$/, "");
      let counter = 1;
      let nextName = `${baseName}-副本.md`;
      let nextPath = await join(workspacePath.value, nextName);

      while (fileList.value.some((file) => file.path === nextPath)) {
        counter += 1;
        nextName = `${baseName}-副本(${counter}).md`;
        nextPath = await join(workspacePath.value, nextName);
      }

      await invoke("duplicate_resume", { path, newPath: nextPath });
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
    const patchCss = `\n\n${marker}\n.resume-document {\n  font-family: ${style.fontFamily};\n  font-size: ${style.fontSize}px;\n  line-height: ${style.lineHeight};\n  --cv-font-size: ${style.fontSize}px;\n  --cv-paragraph-spacing: ${style.paragraphSpacing}px;\n  --cv-contact-render: ${style.personalInfoMode || "text"};\n}\n.resume-document h1 { font-size: ${style.h1Size}px; }\n.resume-document h2 { font-size: ${style.h2Size}px; }\n.resume-document h3 { font-size: ${style.h3Size}px; }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document .job-intention + p,\n.resume-document .contact-info--icon,\n.resume-document .contact-info-item { font-size: var(--cv-font-size); }\n.resume-document blockquote { font-size: calc(var(--cv-font-size) * 0.9); }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document blockquote { margin-bottom: var(--cv-paragraph-spacing); }\n@page { margin: ${style.marginV}mm ${style.marginH}mm; }\n.resume-document h2 { border-left-color: ${style.themeColor}; background-color: color-mix(in srgb, ${style.themeColor} 10%, transparent); }\n`;
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
      const files = await refreshWorkspaceLists(savedWorkspace);
      const lastOpenedPath = localStorage.getItem(STORAGE_KEYS.lastOpenedPath);

      if (lastOpenedPath && files.some((file) => file.path === lastOpenedPath)) {
        await openFile(lastOpenedPath);
        return;
      }

      await openDefaultFile(files);
    } catch {
      shouldShowWorkspaceDialog.value = true;
    }
  };

  void initWorkspace();

  return {
    markdownContent,
    availableTemplates,
    activeTemplate,
    isExporting,
    templatesLoaded,
    resumeStyle,
    loadTemplates,
    saveCurrentTemplate,
    workspacePath,
    fileList,
    pdfFileList,
    photoFileList,
    activeFilePath,
    activeFileName,
    outlineTree,
    sidebarPrimaryView,
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    currentPhotoPath,
    editorJumpRequest,
    selectWorkspace,
    openWorkspaceDirectory,
    openFile,
    saveCurrentFile,
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
