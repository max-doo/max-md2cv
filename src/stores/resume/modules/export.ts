import { buildPagedExportDocumentHtml } from "../../../utils/pagedExport";
import type { ResumeStoreBaseContext } from "../context";

interface ExportModuleContext extends ResumeStoreBaseContext {
  refreshPdfList: (dirPath: string) => Promise<unknown>;
}

export const createExportModule = (context: ExportModuleContext) => {
  const { state, runtime, platform, ui } = context;

  const waitForPreviewReady = async () => {
    while (runtime.previewRenderPromise) {
      const currentPromise = runtime.previewRenderPromise;
      await currentPromise;

      if (runtime.previewRenderPromise === currentPromise) {
        break;
      }
    }

    if (!state.isPreviewReady.value) {
      throw new Error("预览内容尚未准备好，请稍后重试。");
    }
  };

  const exportCurrentPdf = async () => {
    if (!state.activeFilePath.value || !state.workspacePath.value) {
      ui.message.error("未找到当前打开的文件或工作区");
      return;
    }

    state.isExporting.value = true;
    try {
      const fileNameWithExt =
        state.activeFilePath.value.split(/[/\\]/).pop() || "简历.md";
      const documentTitle = fileNameWithExt.replace(/\.[^/.]+$/, "");
      const targetPdfName = `${documentTitle}.pdf`;
      const targetPdfPath = await platform.join(
        state.workspacePath.value,
        targetPdfName,
      );

      const exists = state.pdfFileList.value.some(
        (file) => file.name === targetPdfName,
      );
      if (exists) {
        try {
          await ui.messageBox.confirm(
            `工作区已存在名为 "${targetPdfName}" 的文件，是否覆盖？`,
            "导出确认",
            {
              confirmButtonText: "覆盖",
              cancelButtonText: "取消",
              type: "warning",
            },
          );
        } catch {
          state.isExporting.value = false;
          return;
        }
      }

      await waitForPreviewReady();

      const pagesContainer = platform.document?.querySelector(
        '[data-preview-root="true"] > .pagedjs_pages',
      );
      if (!pagesContainer) {
        throw new Error("预览内容尚未准备好，请稍后重试。");
      }

      if (!pagesContainer.querySelector(".pagedjs_page")) {
        throw new Error("预览分页尚未完成，请稍后重试。");
      }

      const htmlContent = await buildPagedExportDocumentHtml({
        documentTitle,
        pagesContainer: pagesContainer as HTMLElement,
        cvStyle: state.resumeStyle.value,
      });

      await platform.invoke("export_pdf_command", {
        htmlContent,
        outputPath: targetPdfPath,
      });

      if (state.workspacePath.value) {
        await context.refreshPdfList(state.workspacePath.value);
      }

      ui.message.success(`导出成功：${targetPdfName}`);
    } catch (error: any) {
      console.error("导出失败:", error);
      const errorMsg =
        typeof error === "string" ? error : error.message || JSON.stringify(error);
      ui.message.error({
        message: `导出失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    } finally {
      state.isExporting.value = false;
    }
  };

  return {
    exportCurrentPdf,
  };
};
