import { buildSelfContainedExportStyles } from "./exportStyles";
import { getInlinePingFangFontFaceCss } from "./fontAssets";

interface PagedExportDocumentOptions {
  documentTitle: string;
  pagesContainer: HTMLElement;
}

export const buildPagedExportDocumentHtml = async ({
  documentTitle,
  pagesContainer,
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
      <title>${documentTitle}</title>
      ${styles}
      <style>
        ${inlinePingFangFontFaceCss}
        body {
          background: white !important;
          margin: 0;
          padding: 0;
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
      </style>
    </head>
    <body class="resume-document">
      <div class="pagedjs-wrapper">
        ${exportedPagesContainer.outerHTML}
      </div>
    </body>
    </html>
  `;
};
