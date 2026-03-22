import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus";

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

const DEFAULT_MARKDOWN = "";
const LAST_PHOTO_PATH_KEY = "resume-last-photo-path";

export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  fontSize: number;   // body font size in px
  h1Size: number;     // H1 size in px
  h2Size: number;     // H2 size in px
  h3Size: number;     // H3 size in px
  dateSize?: number;  // Date size in px
  dateWeight?: string;// Date font weight (CSS)
  lineHeight: number;
  marginV: number;    // mm
  marginH: number;    // mm
  jobIntentionColor?: string; // override color
}

export const useResumeStore = defineStore("resume", () => {
  const markdownContent = ref(DEFAULT_MARKDOWN);

  const availableTemplates = ref<ResumeTemplate[]>([]);
  const activeTemplate = ref("modern");
  const isExporting = ref(false);
  const templatesLoaded = ref(false);

  // Styling state
  const resumeStyle = ref<ResumeStyle>({
    themeColor: '#4c49cc',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,
    h1Size: 28,
    h2Size: 20,
    h3Size: 16,
    dateSize: 14,
    dateWeight: '',
    lineHeight: 1.6,
    marginV: 10,
    marginH: 12
  });

  // File management states
  const workspacePath = ref<string | null>(null);
  const fileList = ref<FileItem[]>([]);
  const pdfFileList = ref<FileItem[]>([]);
  const photoFileList = ref<PhotoItem[]>([]);
  const activeFilePath = ref<string | null>(null);
  const isSidebarOpen = ref(false);
  const shouldShowWorkspaceDialog = ref(false);
  const currentPhotoPath = ref<string | null>(null);
  const photoBase64 = ref<string | null>(null);

  /** Load templates dynamically from Tauri backend */
  const loadTemplates = async () => {
    try {
      const templates = await invoke<ResumeTemplate[]>("list_templates");
      availableTemplates.value = templates;
      if (templates.length > 0 && !templates.find((t) => t.id === activeTemplate.value)) {
        activeTemplate.value = templates[0].id;
      }
      templatesLoaded.value = true;
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  };

  /** Check workspace and list markdown files */
  const refreshFileList = async (dirPath: string) => {
    try {
      const entries = await invoke<FileItem[]>("list_resumes", { dirPath });
      fileList.value = entries;
      return entries;
    } catch (err) {
      console.error("Failed to read directory:", err);
      // If reading fails, workspace might be invalid
      workspacePath.value = null;
      fileList.value = [];
      pdfFileList.value = [];
      photoFileList.value = [];
      currentPhotoPath.value = null;
      photoBase64.value = null;
      localStorage.removeItem(LAST_PHOTO_PATH_KEY);
      localStorage.removeItem('resume-workspace-path');
      shouldShowWorkspaceDialog.value = true;
      throw err;
    }
  };

  const refreshPdfList = async (dirPath: string) => {
    try {
      const entries = await invoke<FileItem[]>("list_pdfs", { dirPath });
      pdfFileList.value = entries;
      return entries;
    } catch (err) {
      console.error("Failed to read pdf directory:", err);
      pdfFileList.value = [];
      throw err;
    }
  };

  const loadPhoto = async (path: string | null) => {
    if (!path) {
      currentPhotoPath.value = null;
      photoBase64.value = null;
      localStorage.removeItem(LAST_PHOTO_PATH_KEY);
      return;
    }

    try {
      const dataUrl = await invoke<string>("read_image_as_data_url", { path });
      currentPhotoPath.value = path;
      photoBase64.value = dataUrl;
      localStorage.setItem(LAST_PHOTO_PATH_KEY, path);
    } catch (err) {
      console.error("Failed to load image:", err);
      currentPhotoPath.value = null;
      photoBase64.value = null;
      localStorage.removeItem(LAST_PHOTO_PATH_KEY);
      throw err;
    }
  };

  const refreshPhotoList = async (dirPath: string) => {
    try {
      const entries = await invoke<PhotoItem[]>("list_images", { dirPath });
      photoFileList.value = entries;

      const storedPhotoPath = localStorage.getItem(LAST_PHOTO_PATH_KEY);
      const nextPhotoPath =
        [currentPhotoPath.value, storedPhotoPath]
          .filter((path): path is string => Boolean(path))
          .find((path) => entries.some((entry) => entry.path === path))
        ?? entries.find((entry) => entry.isIdPhoto)?.path
        ?? null;

      if (!nextPhotoPath) {
        await loadPhoto(null);
      } else if (nextPhotoPath !== currentPhotoPath.value || !photoBase64.value) {
        await loadPhoto(nextPhotoPath);
      }

      return entries;
    } catch (err) {
      console.error("Failed to read image directory:", err);
      photoFileList.value = [];
      await loadPhoto(null);
      throw err;
    }
  };

  const selectPhoto = async (path: string) => {
    if (!photoFileList.value.some((file) => file.path === path)) {
      return;
    }

    try {
      await loadPhoto(path);
    } catch (err) {
      ElMessage.error("证件照加载失败");
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
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"],
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

      currentPhotoPath.value = imported.path;
      localStorage.setItem(LAST_PHOTO_PATH_KEY, imported.path);
      await refreshPhotoList(workspacePath.value);
      ElMessage.success(`证件照已保存为 ${imported.name}`);
    } catch (err) {
      console.error("Failed to import id photo:", err);
      ElMessage.error(`证件照上传失败: ${err}`);
    }
  };

  /** Select a workspace directory */
  const selectWorkspace = async () => {
    try {
      const dir = await openDialog({ directory: true, multiple: false });
      if (dir && typeof dir === 'string') {
        workspacePath.value = dir;
        localStorage.setItem('resume-workspace-path', dir);
        shouldShowWorkspaceDialog.value = false;
        const files = await refreshFileList(dir);
        await refreshPdfList(dir);
        await refreshPhotoList(dir);
        
        if (files.length > 0) {
          await openFile(files[0].path);
        } else {
          await createFile("未命名.md");
        }
      }
    } catch (err) {
      console.error("Failed to open dialog:", err);
    }
  };

  /** Open a specific file */
  const openFile = async (path: string) => {
    try {
      const content = await invoke<string>("read_resume", { path });
      markdownContent.value = content;
      activeFilePath.value = path;
      localStorage.setItem('resume-last-opened-path', path);
    } catch (err) {
      console.error("Failed to read file:", err);
      ElMessage.error("文件读取失败");
      // If specific file fails, fallback to first available
      if (fileList.value.length > 0) {
        await openFile(fileList.value[0].path);
      }
    }
  };

  /** Save current file content if there is an active file.
   * @param silent - if true, suppress the success toast (used by auto-save) */
  const saveCurrentFile = async (silent = false) => {
    if (activeFilePath.value) {
      try {
        await invoke("write_resume", { path: activeFilePath.value, content: markdownContent.value });
        if (!silent) ElMessage.success("已保存");
      } catch (err) {
        console.error("Failed to save file:", err);
        ElMessage.error("保存失败");
      }
    }
  };

  /** Create a new markdown file */
  const createFile = async (name: string) => {
    if (!workspacePath.value) return;
    try {
      let fileName = name;
      if (!fileName.endsWith('.md')) {
        fileName += '.md';
      }
      const newPath = await join(workspacePath.value, fileName);
      await invoke("write_resume", { path: newPath, content: DEFAULT_MARKDOWN });
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);
      await openFile(newPath);
      ElMessage.success("新建成功");
    } catch (err) {
      console.error("Failed to create file:", err);
      ElMessage.error("新建文件失败");
    }
  };

  /** Delete a file */
  const deleteFile = async (path: string) => {
    try {
      await invoke("delete_resume", { path });
      if (workspacePath.value) {
        const files = await refreshFileList(workspacePath.value);
        await refreshPdfList(workspacePath.value);
        if (activeFilePath.value === path) {
          if (files.length > 0) {
            await openFile(files[0].path);
          } else {
            await createFile("未命名.md");
          }
        }
      }
      ElMessage.success("已移动到回收站");
    } catch (err) {
      console.error("Failed to delete file:", err);
      ElMessage.error("删除失败");
    }
  };

  /** Delete a PDF file */
  const deletePdf = async (path: string) => {
    try {
      await invoke("delete_resume", { path });
      if (workspacePath.value) {
        await refreshPdfList(workspacePath.value);
      }
      ElMessage.success("PDF 已移动到回收站");
    } catch (err) {
      console.error("Failed to delete pdf:", err);
      ElMessage.error("PDF 删除失败");
    }
  };

  /** Rename a file */
  const renameFile = async (oldPath: string, newName: string) => {
    if (!workspacePath.value) return;
    try {
      let finalName = newName.trim();
      if (!finalName) return;
      if (!finalName.endsWith('.md')) {
        finalName += '.md';
      }
      const newPath = await join(workspacePath.value, finalName);
      if (oldPath === newPath) return; // Same name
      await invoke("rename_resume", { oldPath, newPath });
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);
      if (activeFilePath.value === oldPath) {
        await openFile(newPath);
      }
      ElMessage.success("重命名成功");
    } catch (err) {
      console.error("Failed to rename file:", err);
      ElMessage.error("重命名失败");
    }
  };

  /** Duplicate a file */
  const duplicateFile = async (path: string) => {
    if (!workspacePath.value) return;
    try {
      const originalFile = fileList.value.find(f => f.path === path);
      if (!originalFile) return;

      const baseName = originalFile.name.replace(/\.md$/, '');
      let newName = `${baseName}-副本.md`;
      let newPath = await join(workspacePath.value, newName);
      
      let counter = 1;
      while (fileList.value.some(f => f.path === newPath)) {
        counter++;
        newName = `${baseName}-副本(${counter}).md`;
        newPath = await join(workspacePath.value, newName);
      }

      await invoke("duplicate_resume", { path, newPath });
      await refreshFileList(workspacePath.value);
      await refreshPdfList(workspacePath.value);
      ElMessage.success("创建副本成功");
    } catch (err) {
      console.error("Failed to duplicate file:", err);
      ElMessage.error("创建副本失败");
    }
  };

  /** Overwrite the active template CSS with the current resumeStyle */
  const saveCurrentTemplate = async () => {
    const tpl = availableTemplates.value.find(t => t.id === activeTemplate.value);
    if (!tpl) {
      ElMessage.error("未找到当前模板");
      return;
    }
    const style = resumeStyle.value;
    const marker = '/* @user-overrides */';
    const baseCSS = tpl.css.split(marker)[0].trimEnd();
    const patchCSS = `\n\n${marker}\n.resume-document {\n  font-family: ${style.fontFamily};\n  font-size: ${style.fontSize}px;\n  line-height: ${style.lineHeight};\n}\n.resume-document h1 { font-size: ${style.h1Size}px; }\n.resume-document h2 { font-size: ${style.h2Size}px; }\n.resume-document h3 { font-size: ${style.h3Size}px; }\n@page { margin: ${style.marginV}mm ${style.marginH}mm; }\n.resume-document h2 { border-left-color: ${style.themeColor}; background-color: color-mix(in srgb, ${style.themeColor} 10%, transparent); }\n`;
    const newCSS = baseCSS + patchCSS;
    try {
      await invoke("save_template", { id: tpl.id, css: newCSS });
      tpl.css = newCSS;
      ElMessage.success("模板已保存");
    } catch (err) {
      console.error("Failed to save template:", err);
      ElMessage.error("模板保存失败");
    }
  };

  // Initialize workspace path and handle auto-open logic
  const initWorkspace = async () => {
    const savedWorkspace = localStorage.getItem('resume-workspace-path');
    if (!savedWorkspace) {
      shouldShowWorkspaceDialog.value = true;
      return;
    }

    workspacePath.value = savedWorkspace;
    try {
      const files = await refreshFileList(savedWorkspace);
      await refreshPdfList(savedWorkspace);
      await refreshPhotoList(savedWorkspace);
      const lastPath = localStorage.getItem('resume-last-opened-path');
      
      if (lastPath && files.some(f => f.path === lastPath)) {
        await openFile(lastPath);
      } else if (files.length > 0) {
        await openFile(files[0].path);
      } else {
        await createFile("未命名.md");
      }
    } catch (err) {
      // workspace path invalid or inaccessible
      shouldShowWorkspaceDialog.value = true;
    }
  };
  
  // Call init when store is instantiated
  initWorkspace();

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
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    currentPhotoPath,
    selectWorkspace,
    openFile,
    saveCurrentFile,
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
    photoBase64
  };
});
