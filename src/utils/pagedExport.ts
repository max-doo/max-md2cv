import { buildSelfContainedExportStyles } from "./exportStyles";
import { getInlinePingFangFontFaceCss } from "./fontAssets";
import { buildRuntimeResumeStyleCss } from "./runtimeResumeStyle";
import type { PhotoAdjustments, ResumeStyle } from "@resume-core";

interface PagedExportDocumentOptions {
  documentTitle: string;
  pagesContainer: HTMLElement;
  cvStyle: ResumeStyle;
  photoAdjustments: PhotoAdjustments;
}

export const buildPagedExportDocumentHtml = async ({
  documentTitle,
  pagesContainer,
  cvStyle,
  photoAdjustments,
}: PagedExportDocumentOptions) => {
  const styles = await buildSelfContainedExportStyles();
  const inlinePingFangFontFaceCss = await getInlinePingFangFontFaceCss();
  const exportedPagesContainer = pagesContainer.cloneNode(true) as HTMLElement;

  if (!exportedPagesContainer.style.getPropertyValue("--pagedjs-page-count")) {
    exportedPagesContainer.style.setProperty(
      "--pagedjs-page-count",
      String(exportedPagesContainer.querySelectorAll(".pagedjs_page").length),
    );
  }

  return `
    <!DOCTYPE html>
    <html class="light" lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="max-md2cv-export-document" content="true">
      <title>${documentTitle}</title>
      ${styles}
      <style>
        ${inlinePingFangFontFaceCss}
        ${buildRuntimeResumeStyleCss(cvStyle, {
          includePageRule: false,
          photoAdjustments,
        })}
        @page {
          size: A4;
          margin: 0 !important;
        }
        html,
        body {
          background: white !important;
          margin: 0;
          padding: 0;
        }
        body {
          width: auto !important;
          height: auto !important;
        }
        .pagedjs-wrapper {
          width: 100% !important;
          align-items: flex-start !important;
        }
        .pagedjs_pages {
          display: block !important;
        }
        .pagedjs_page {
          box-shadow: none !important;
        }
        @media print {
          html,
          body {
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .pagedjs_pages {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .pagedjs_page {
            width: var(--pagedjs-width) !important;
            height: var(--pagedjs-height) !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            break-after: page;
            page-break-after: always;
          }
          .pagedjs_page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .pagedjs_sheet {
            width: var(--pagedjs-width) !important;
            height: var(--pagedjs-height) !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: hidden !important;
          }
        }
      </style>
    </head>
    <body data-max-md2cv-export-document="true">
      <div class="pagedjs-wrapper">
        ${exportedPagesContainer.outerHTML}
      </div>
    </body>
    </html>
  `;
};
