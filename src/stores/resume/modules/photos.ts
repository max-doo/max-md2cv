import { IMAGE_EXTENSIONS, STORAGE_KEYS } from "../constants";
import type { ResumeStoreBaseContext } from "../context";
import type { PhotoItem } from "../types";

interface PhotoModuleContext extends ResumeStoreBaseContext {
  registerLocalMutation: (...paths: Array<string | null | undefined>) => void;
  persistActiveFileRenderState: () => Promise<void>;
  setCurrentPhoto: (path: string | null, dataUrl: string | null) => void;
}

export const createPhotoModule = (context: PhotoModuleContext) => {
  const { state, platform, ui } = context;

  const clearPhotoState = () => {
    context.setCurrentPhoto(null, null);
  };

  const resolveNextPhotoPath = (entries: PhotoItem[]) => {
    const preferredPaths = [
      state.currentPhotoPath.value,
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
      context.setCurrentPhoto(null, null);
      return;
    }

    try {
      const dataUrl = await platform.invoke<string>("read_image_as_data_url", {
        path,
      });
      context.setCurrentPhoto(path, dataUrl);
    } catch (error) {
      console.error("Failed to load image:", error);
      context.setCurrentPhoto(null, null);
      throw error;
    }
  };

  const refreshPhotoList = async (dirPath: string) => {
    try {
      const entries = await platform.invoke<PhotoItem[]>("list_images", {
        dirPath,
      });
      const idPhotos = entries.filter((entry) => entry.isIdPhoto);
      state.photoFileList.value = idPhotos;

      const nextPhotoPath = resolveNextPhotoPath(idPhotos);
      if (!nextPhotoPath) {
        await loadPhoto(null);
      } else if (
        nextPhotoPath !== state.currentPhotoPath.value ||
        !state.photoBase64.value
      ) {
        await loadPhoto(nextPhotoPath);
      }

      return idPhotos;
    } catch (error) {
      console.error("Failed to read image directory:", error);
      state.photoFileList.value = [];
      await loadPhoto(null);
      throw error;
    }
  };

  const selectPhoto = async (path: string) => {
    if (!state.photoFileList.value.some((file) => file.path === path)) {
      return;
    }

    try {
      await loadPhoto(path);
      void context.persistActiveFileRenderState();
    } catch {
      ui.message.error("加载证件照失败");
    }
  };

  const importIdPhoto = async () => {
    if (!state.workspacePath.value) {
      ui.message.warning("请先选择工作文件夹");
      return;
    }

    try {
      const selected = await platform.openDialog({
        multiple: true,
        filters: [
          {
            name: "图片文件",
            extensions: IMAGE_EXTENSIONS,
          },
        ],
      });

      const selectedPaths = Array.isArray(selected)
        ? selected
        : typeof selected === "string"
          ? [selected]
          : [];

      if (selectedPaths.length === 0) {
        return;
      }

      const importedEntries: PhotoItem[] = [];

      for (const sourcePath of selectedPaths) {
        const imported = await platform.invoke<PhotoItem>("import_id_photo", {
          sourcePath,
          workspacePath: state.workspacePath.value,
        });

        context.registerLocalMutation(imported.path);
        importedEntries.push(imported);
      }

      await refreshPhotoList(state.workspacePath.value);
      const imported = importedEntries[importedEntries.length - 1]!;
      await selectPhoto(imported.path);
      ui.message.success(`已导入证件照：${imported.name}`);
    } catch (error) {
      console.error("Failed to import id photo:", error);
      ui.message.error(`导入证件照失败：${String(error)}`);
    }
  };

  const deletePhoto = async (path: string) => {
    try {
      context.registerLocalMutation(path);
      await platform.invoke("delete_resume", { path });

      if (state.workspacePath.value) {
        await refreshPhotoList(state.workspacePath.value);
      } else if (state.currentPhotoPath.value === path) {
        await loadPhoto(null);
      }

      void context.persistActiveFileRenderState();
      ui.message.success("证件照已移至回收站");
    } catch (error) {
      console.error("Failed to delete photo:", error);
      ui.message.error("删除证件照失败");
    }
  };

  return {
    clearPhotoState,
    resolveNextPhotoPath,
    loadPhoto,
    refreshPhotoList,
    selectPhoto,
    importIdPhoto,
    deletePhoto,
  };
};
