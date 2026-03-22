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

const DEFAULT_MARKDOWN = "";

export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  fontSize: number;   // body font size in px
  h1Size: number;     // H1 size in px
  h2Size: number;     // H2 size in px
  h3Size: number;     // H3 size in px
  lineHeight: number;
  marginV: number;    // mm
  marginH: number;    // mm
}

export const useResumeStore = defineStore("resume", () => {
  const markdownContent = ref(DEFAULT_MARKDOWN);

  const availableTemplates = ref<ResumeTemplate[]>([]);
  const activeTemplate = ref("modern");
  const isExporting = ref(false);
  const templatesLoaded = ref(false);

  // Styling state
  const resumeStyle = ref<ResumeStyle>({
    themeColor: '#3b82f6',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,
    h1Size: 28,
    h2Size: 20,
    h3Size: 16,
    lineHeight: 1.6,
    marginV: 15,
    marginH: 20
  });

  // File management states
  const workspacePath = ref<string | null>(null);
  const fileList = ref<FileItem[]>([]);
  const activeFilePath = ref<string | null>(null);
  const isSidebarOpen = ref(false);
  const shouldShowWorkspaceDialog = ref(false);

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
      localStorage.removeItem('resume-workspace-path');
      shouldShowWorkspaceDialog.value = true;
      throw err;
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

  /** Save current file content if there is an active file */
  const saveCurrentFile = async () => {
    if (activeFilePath.value) {
      try {
        await invoke("write_resume", { path: activeFilePath.value, content: markdownContent.value });
        ElMessage.success("已保存");
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
        if (activeFilePath.value === path) {
          if (files.length > 0) {
            await openFile(files[0].path);
          } else {
            await createFile("未命名.md");
          }
        }
      }
      ElMessage.success("删除成功");
    } catch (err) {
      console.error("Failed to delete file:", err);
      ElMessage.error("删除失败");
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
    const patchCSS = `\n\n${marker}\n.resume-document {\n  font-family: ${style.fontFamily};\n  font-size: ${style.fontSize}px;\n  line-height: ${style.lineHeight};\n}\n.resume-document h1 { font-size: ${style.h1Size}px; }\n.resume-document h2 { font-size: ${style.h2Size}px; }\n.resume-document h3 { font-size: ${style.h3Size}px; }\n@page { margin: ${style.marginV}mm ${style.marginH}mm; }\n`;
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
    activeFilePath,
    isSidebarOpen,
    shouldShowWorkspaceDialog,
    selectWorkspace,
    openFile,
    saveCurrentFile,
    createFile,
    deleteFile,
    refreshFileList
  };
});
