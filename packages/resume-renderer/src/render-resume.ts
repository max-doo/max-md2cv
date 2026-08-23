import { Previewer } from "pagedjs";
import {
  enhanceResumeHtml,
  renderMarkdownToHtml,
  resolvePhotoAdjustments,
  resolveResumeStyle,
  resolveSectionType,
  buildRuntimeResumeStyleCss,
  type ResumeTemplate,
  type TemplateValues,
} from "../../resume-core/src/domain";
import { pingFangFontFaceCss } from "../../resume-core/src/utils/fontAssets";
import { applyResumeDocumentLayoutHooks, createPhotoMarkup, type ResumeLayoutConfig } from "./layout-hooks";
import { collectPageDiagnostics, waitForDocumentFonts, waitForImages } from "./diagnostics";
import { RendererError, type RenderRequest, type RenderResult, type RenderWarning } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const waitForStablePages = async (target: HTMLElement, timeoutMs: number) => {
  const startedAt = Date.now();
  let previousSignature = "";
  let stableFrames = 0;

  while (stableFrames < 2) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new RendererError(
        "RENDER_TIMEOUT",
        `Paged.js did not reach a stable layout within ${timeoutMs}ms.`,
      );
    }

    await waitForAnimationFrame();
    const pages = Array.from(target.querySelectorAll<HTMLElement>(".pagedjs_page"));
    const signature = pages
      .map((page) => {
        const rect = page.getBoundingClientRect();
        return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      })
      .join(",");

    if (pages.length > 0 && signature === previousSignature) {
      stableFrames += 1;
    } else {
      previousSignature = signature;
      stableFrames = 0;
    }
  }
};

const normalizeLayoutConfig = (
  template: ResumeTemplate,
  values: TemplateValues,
): ResumeLayoutConfig => ({
  headerLayout: String(values.headerLayout ?? template.layout?.headerLayout ?? "stack") as ResumeLayoutConfig["headerLayout"],
  personalInfoMode: String(values.personalInfoMode ?? template.layout?.personalInfoMode ?? "text") as ResumeLayoutConfig["personalInfoMode"],
  photoPlacement: String(values.photoPlacement ?? template.layout?.photoPlacement ?? "top-right") as ResumeLayoutConfig["photoPlacement"],
  sectionTitlePreset: String(values.sectionTitlePreset ?? template.layout?.sectionTitlePreset ?? "accent-bar") as ResumeLayoutConfig["sectionTitlePreset"],
});

const removePreviousRender = (target: HTMLElement) => {
  target.replaceChildren();
  document
    .querySelectorAll("style[data-md2cv-render-style]")
    .forEach((style) => style.remove());
};

const appendRenderStyle = (cssText: string, kind: string) => {
  const style = document.createElement("style");
  style.dataset.md2cvRenderStyle = kind;
  style.textContent = cssText;
  document.head.appendChild(style);
  return style;
};

const createSourceDocument = (
  html: string,
  photoDataUrl: string | null,
  layoutConfig: ResumeLayoutConfig,
  photoVisible: boolean,
  showPhotoPlaceholder: boolean,
) => {
  const source = document.createElement("div");
  const documentRoot = document.createElement("div");
  documentRoot.className = "resume-document";
  if (photoDataUrl || showPhotoPlaceholder) {
    documentRoot.appendChild(createPhotoMarkup(photoDataUrl));
  }
  documentRoot.insertAdjacentHTML("beforeend", html);
  source.appendChild(documentRoot);

  const headerHooks = applyResumeDocumentLayoutHooks(documentRoot, layoutConfig, photoVisible);
  headerHooks?.photoWrapper?.classList.add(
    photoDataUrl ? "has-photo" : "is-empty",
    `photo-placement-${layoutConfig.photoPlacement}`,
  );

  return { source, documentRoot };
};

export const renderResume = async (
  request: RenderRequest,
  target: HTMLElement,
): Promise<RenderResult> => {
  const timeoutMs = request.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const warnings: RenderWarning[] = [];
  const effectiveValues = request.template
    ? request.values
    : {};
  const cvStyle = resolveResumeStyle(request.template, effectiveValues);
  const photoAdjustments = resolvePhotoAdjustments(effectiveValues);
  const layoutConfig = normalizeLayoutConfig(request.template, effectiveValues);
  let rendered = false;

  removePreviousRender(target);

  try {
    const htmlContent = await renderMarkdownToHtml(request.markdown);
    const enhancedHtml = enhanceResumeHtml(
      htmlContent,
      { ...cvStyle, personalInfoMode: layoutConfig.personalInfoMode },
      request.template.id,
    );
    const { source } = createSourceDocument(
      enhancedHtml,
      request.photoDataUrl,
      layoutConfig,
      photoAdjustments.visible && Boolean(request.photoDataUrl || request.options.showPhotoPlaceholder),
      request.options.showPhotoPlaceholder === true,
    );

    appendRenderStyle(
      `html, body { margin: 0; padding: 0; background: #fff; }\n` +
        `.pagedjs_pages { display: flex; flex-direction: column; align-items: center; }\n` +
        `.pagedjs_page { box-shadow: none !important; background: #fff; }\n` +
        `@media print { .pagedjs_page { break-after: page; page-break-after: always; } .pagedjs_page:last-child { break-after: auto; page-break-after: auto; } }`,
      "shell",
    );
    appendRenderStyle(
      `@page { size: A4; margin: 0; }\n${request.template.css}`,
      "template",
    );
    appendRenderStyle(
      `@font-face { font-family: 'Manrope'; src: local('Arial'); }\n${buildRuntimeStyle(cvStyle, photoAdjustments)}`,
      "runtime",
    );

    const fontReport = await waitForDocumentFonts(cvStyle, request.options.strictFonts).catch((error) => {
      if (request.options.strictFonts) {
        throw new RendererError("FONT_NOT_LOADED", String(error));
      }
      return { report: [], warnings: [{ code: "FONT_NOT_LOADED" as const, message: String(error) }] };
    });
    warnings.push(...fontReport.warnings);
    warnings.push(...(await waitForImages(source)));

    const previousPagedStyles = new Set(
      Array.from(document.querySelectorAll("style[data-pagedjs-inserted-styles]")),
    );
    const paged = new Previewer();
    const suppressPagedjsErrors = (event: ErrorEvent) => {
      const sourceName = event.filename ?? "";
      if (sourceName.includes("dom.js") || sourceName.includes("layout.js") || sourceName.includes("page.js")) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", suppressPagedjsErrors);

    try {
      await paged.preview(
        source,
        [
          { [`${window.location.href}#template-${request.template.id}`]: request.template.css },
          { [`${window.location.href}#runtime-md2cv`]: buildRuntimeStyle(cvStyle, photoAdjustments) },
        ],
        target,
      );
    } finally {
      window.removeEventListener("error", suppressPagedjsErrors);
      Array.from(document.querySelectorAll("style[data-pagedjs-inserted-styles]"))
        .filter((style) => !previousPagedStyles.has(style))
        .forEach((style) => style.setAttribute("data-md2cv-render-style", "paged"));
    }

    const pageElements = Array.from(target.querySelectorAll(".pagedjs_page"));
    if (pageElements.length === 0) {
      throw new RendererError("RENDER_FAILED", "Paged.js completed without producing a page.");
    }

    await waitForStablePages(target, timeoutMs);

    target.querySelectorAll<HTMLElement>(".resume-document h2").forEach((h2) => {
      if (Array.from(h2.classList).some((className) => className.startsWith("section-"))) return;
      const section = resolveSectionType(h2.textContent ?? "");
      h2.classList.add(section ? `section-${section.key}` : "section-default");
    });

    const pageDiagnostics = collectPageDiagnostics(
      Array.from(target.querySelectorAll(".pagedjs_page")),
      request.options.maxPages,
    );
    warnings.push(...pageDiagnostics.warnings);
    rendered = true;
    return {
      pageCount: pageDiagnostics.pages.length,
      effectiveValues,
      pages: pageDiagnostics.pages,
      warnings,
      fontReport: fontReport.report,
    };
  } catch (error) {
    if (error instanceof RendererError) throw error;
    throw new RendererError(
      "RENDER_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    if (!rendered) {
      target.replaceChildren();
    }
  }
};

const buildRuntimeStyle = (
  cvStyle: ReturnType<typeof resolveResumeStyle>,
  photoAdjustments: ReturnType<typeof resolvePhotoAdjustments>,
) => {
  const extraCss = pingFangFontFaceCss;
  return `
${extraCss}
.resume-document {
  --cv-photo-size-factor: ${photoAdjustments.size / 100};
}
${buildRuntimeResumeStyleCss(cvStyle, { extraCss: "", photoAdjustments })}`;
};
