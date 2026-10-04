import defaultResumeTemplate from "../../../../packages/resume-core/src/assets/templates/default-resume.md?raw";
import { DEFAULT_FILE_NAME, DEFAULT_MARKDOWN } from "../constants";
import type { ResumeStoreBaseContext } from "../context";
import {
  ensureMarkdownFileName,
  normalizePathKey,
} from "../path-utils";
import type { ExportFileItem, FileItem } from "../types";

interface WorkspaceFilesModuleContext extends ResumeStoreBaseContext {
  setWorkspacePath: (path: string | null) => void;
  invalidateWorkspace: () => void;
  loadWorkspaceRenderState: (dirPath: string) => Promise<void>;
  openTemplateDialog: () => void;
  openFile: (path: string) => Promise<void>;
  refreshPhotoList: (dirPath: string) => Promise<unknown>;
  updateRenderProfilePath: (
    oldPath: string,
    newPath: string,
    mode: "move" | "copy",
  ) => Promise<void>;
  deleteRenderProfile: (path: string) => Promise<void>;
  registerLocalMutation: (...paths: Array<string | null | undefined>) => void;
  ensurePathExists: (path: string) => Promise<boolean>;
}

export const createWorkspaceFilesModule = (
  context: WorkspaceFilesModuleContext,
) => {
  const { state, platform, ui } = context;

  const hasFile = (files: FileItem[], path: string) => {
    const pathKey = normalizePathKey(path);
    return files.some((file) => normalizePathKey(file.path) === pathKey);
  };

  const refreshFileList = async (dirPath: string) => {
    try {
      const entries = await platform.invoke<FileItem[]>("list_resumes", { dirPath });
      state.fileList.value = entries;
      return entries;
    } catch (error) {
      console.error("Failed to read directory:", error);
      context.invalidateWorkspace();
      throw error;
    }
  };

  const refreshExportList = async (dirPath: string) => {
    try {
      const entries = await platform.invoke<ExportFileItem[]>("list_export_files", { dirPath });
      state.exportFileList.value = entries;
      state.pdfFileList.value = entries.filter((e) => e.fileType === "pdf");
      return entries;
    } catch (error) {
      console.error("Failed to read export files directory:", error);
      state.exportFileList.value = [];
      state.pdfFileList.value = [];
      throw error;
    }
  };

  const refreshPdfList = async (dirPath: string) => {
    await refreshExportList(dirPath);
    return state.pdfFileList.value;
  };

  const refreshWorkspaceLists = async (dirPath: string) => {
    const files = await refreshFileList(dirPath);
    await refreshExportList(dirPath);
    await context.refreshPhotoList(dirPath);
    return files;
  };

  const openDefaultFile = async (files: FileItem[]) => {
    if (files.length > 0) {
      await context.openFile(files[0].path);
      return;
    }

    await createFile(DEFAULT_FILE_NAME);
  };

  const createFile = async (name: string) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const newPath = await platform.join(
        state.workspacePath.value,
        ensureMarkdownFileName(name),
      );
      if (await context.ensurePathExists(newPath)) {
        ui.message.error("文件已存在，请换一个名称。");
        return;
      }

      context.registerLocalMutation(newPath);
      await platform.invoke("write_resume", {
        path: newPath,
        content: DEFAULT_MARKDOWN,
      });
      await refreshFileList(state.workspacePath.value);
      await refreshPdfList(state.workspacePath.value);
      await context.openFile(newPath);
      ui.message.success("已创建新文件");
    } catch (error) {
      console.error("Failed to create file:", error);
      ui.message.error("创建文件失败");
    }
  };

  const createFromTemplate = async (
    name: string,
    company: string,
    position: string,
  ) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const baseName = `${name}-${company}-${position}`;
      let targetName = `${baseName}.md`;
      let newPath = await platform.join(state.workspacePath.value, targetName);
      let counter = 1;

      while (await context.ensurePathExists(newPath)) {
        targetName = `${baseName}(${counter}).md`;
        newPath = await platform.join(state.workspacePath.value, targetName);
        counter += 1;
      }

      let content = defaultResumeTemplate;
      content = content.replace(/^# .+/m, `# ${name || "姓名"}`);
      content = content.replace(
        /\*\*求职意向：[^*]+\*\*/,
        `**求职意向：${position || "某某岗位"}**`,
      );

      context.registerLocalMutation(newPath);
      await platform.invoke("write_resume", { path: newPath, content });
      await refreshFileList(state.workspacePath.value);
      await refreshPdfList(state.workspacePath.value);
      await context.openFile(newPath);
      ui.message.success("已基于模板创建新文件");
    } catch (error) {
      console.error("Failed to create from template:", error);
      ui.message.error("基于模板创建失败");
    }
  };

  const deleteFile = async (path: string) => {
    try {
      context.registerLocalMutation(path);
      await platform.invoke("delete_resume", { path });
      await context.deleteRenderProfile(path);

      if (!state.workspacePath.value) {
        ui.message.success("文件移至回收站");
        return;
      }

      const isDeletingActiveFile =
        state.activeFilePath.value &&
        normalizePathKey(state.activeFilePath.value) === normalizePathKey(path);
      const files = await refreshFileList(state.workspacePath.value);
      await refreshPdfList(state.workspacePath.value);

      if (isDeletingActiveFile) {
        await openDefaultFile(files);
      }

      ui.message.success("文件已移至回收站");
    } catch (error) {
      console.error("Failed to delete file:", error);
      ui.message.error("删除文件失败");
    }
  };

  const deleteExportFile = async (path: string) => {
    try {
      context.registerLocalMutation(path);
      await platform.invoke("delete_resume", { path });

      if (state.workspacePath.value) {
        await refreshExportList(state.workspacePath.value);
      }

      ui.message.success("已移至回收站");
    } catch (error) {
      console.error("Failed to delete export file:", error);
      ui.message.error("删除文件失败");
    }
  };

  const deletePdf = async (path: string) => {
    await deleteExportFile(path);
  };

  const renameFile = async (oldPath: string, newName: string) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const newPath = await platform.join(
        state.workspacePath.value,
        ensureMarkdownFileName(newName),
      );
      if (normalizePathKey(oldPath) === normalizePathKey(newPath)) {
        return;
      }

      if (await context.ensurePathExists(newPath)) {
        ui.message.error("同名文件已存在，请换一个名称。");
        return;
      }

      context.registerLocalMutation(oldPath, newPath);
      await platform.invoke("rename_resume", { oldPath, newPath });
      await context.updateRenderProfilePath(oldPath, newPath, "move");
      await refreshFileList(state.workspacePath.value);
      await refreshPdfList(state.workspacePath.value);

      if (
        state.activeFilePath.value &&
        normalizePathKey(state.activeFilePath.value) === normalizePathKey(oldPath)
      ) {
        await context.openFile(newPath);
      }

      ui.message.success("文件名已更新");
    } catch (error) {
      console.error("Failed to rename file:", error);
      ui.message.error("重命名失败");
    }
  };

  const duplicateFile = async (path: string) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const originalFile = state.fileList.value.find(
        (file) => normalizePathKey(file.path) === normalizePathKey(path),
      );
      if (!originalFile) {
        return;
      }

      const baseName = originalFile.name.replace(/\.md$/, "");
      let counter = 1;
      let nextName = `${baseName}-副本.md`;
      let nextPath = await platform.join(state.workspacePath.value, nextName);

      while (await context.ensurePathExists(nextPath)) {
        counter += 1;
        nextName = `${baseName}-副本(${counter}).md`;
        nextPath = await platform.join(state.workspacePath.value, nextName);
      }

      context.registerLocalMutation(nextPath);
      await platform.invoke("duplicate_resume", { path, newPath: nextPath });
      await context.updateRenderProfilePath(path, nextPath, "copy");
      await refreshFileList(state.workspacePath.value);
      await refreshPdfList(state.workspacePath.value);
      ui.message.success("已创建副本");
    } catch (error) {
      console.error("Failed to duplicate file:", error);
      ui.message.error("创建副本失败");
    }
  };

  const renameExportFile = async (oldPath: string, newName: string) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const ext = oldPath.split(".").pop() || "";
      const baseName = newName.replace(new RegExp(`\\.${ext}$`, "i"), "");
      const newFullName = ext ? `${baseName}.${ext}` : baseName;

      const newPath = await platform.join(
        state.workspacePath.value,
        newFullName,
      );
      if (normalizePathKey(oldPath) === normalizePathKey(newPath)) {
        return;
      }

      if (await context.ensurePathExists(newPath)) {
        ui.message.error("同名文件已存在，请换一个名称。");
        return;
      }

      context.registerLocalMutation(oldPath, newPath);
      await platform.invoke("rename_export_file", { oldPath, newPath });
      await refreshExportList(state.workspacePath.value);
      ui.message.success("文件名已更新");
    } catch (error) {
      console.error("Failed to rename export file:", error);
      ui.message.error("重命名文件失败");
    }
  };

  const duplicateExportFile = async (path: string) => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      const originalFile = state.exportFileList.value.find(
        (file) => normalizePathKey(file.path) === normalizePathKey(path),
      );
      if (!originalFile) {
        return;
      }

      const dotIndex = originalFile.name.lastIndexOf(".");
      const baseName = dotIndex !== -1 ? originalFile.name.slice(0, dotIndex) : originalFile.name;
      const ext = dotIndex !== -1 ? originalFile.name.slice(dotIndex) : "";

      let counter = 1;
      let nextName = `${baseName}-副本${ext}`;
      let nextPath = await platform.join(state.workspacePath.value, nextName);

      while (await context.ensurePathExists(nextPath)) {
        counter += 1;
        nextName = `${baseName}-副本(${counter})${ext}`;
        nextPath = await platform.join(state.workspacePath.value, nextName);
      }

      context.registerLocalMutation(nextPath);
      await platform.invoke("duplicate_export_file", { path, newPath: nextPath });
      await refreshExportList(state.workspacePath.value);
      ui.message.success("已创建副本");
    } catch (error) {
      console.error("Failed to duplicate export file:", error);
      ui.message.error("创建副本失败");
    }
  };

  const openExportedFile = async (path: string) => {
    try {
      await platform.invoke("open_exported_file", { path });
    } catch (error) {
      console.error("Failed to open export file:", error);
      ui.message.error("打开文件失败");
    }
  };

  const renamePdf = async (oldPath: string, newName: string) => {
    await renameExportFile(oldPath, newName);
  };

  const duplicatePdf = async (path: string) => {
    await duplicateExportFile(path);
  };

  const selectWorkspace = async () => {
    try {
      const selectedDir = await platform.openDialog({
        directory: true,
        multiple: false,
      });
      if (!selectedDir || typeof selectedDir !== "string") {
        return;
      }

      context.setWorkspacePath(selectedDir);
      await context.loadWorkspaceRenderState(selectedDir);
      const files = await refreshWorkspaceLists(selectedDir);

      const hasOnboarded = localStorage.getItem("resume-has-onboarded");
      if (!hasOnboarded) {
        localStorage.setItem("resume-has-onboarded", "true");
        context.openTemplateDialog();
      } else {
        await openDefaultFile(files);
      }
    } catch (error) {
      console.error("Failed to open dialog:", error);
    }
  };

  const openWorkspaceDirectory = async () => {
    if (!state.workspacePath.value) {
      return;
    }

    try {
      await platform.invoke("open_directory", { path: state.workspacePath.value });
    } catch (error) {
      console.error("Failed to open directory:", error);
      ui.message.error("打开文件夹失败");
    }
  };

  return {
    hasFile,
    refreshFileList,
    refreshPdfList,
    refreshExportList,
    refreshWorkspaceLists,
    openDefaultFile,
    createFile,
    createFromTemplate,
    deleteFile,
    deletePdf,
    deleteExportFile,
    renameFile,
    duplicateFile,
    renamePdf,
    duplicatePdf,
    renameExportFile,
    duplicateExportFile,
    openExportedFile,
    selectWorkspace,
    openWorkspaceDirectory,
  };
};
