import type { ResumeStyle } from "../../resume-core/src/domain";
import type {
  RenderFontReport,
  RenderPageMetrics,
  RenderWarning,
} from "./types";

const uniqueFontFamilies = (fontFamily: string): string[] =>
  fontFamily
    .split(",")
    .map((family) => family.trim().replace(/^['"]|['"]$/g, ""))
    .filter((family) => family && !["sans-serif", "serif", "monospace"].includes(family));

const measureFont = (family: string, fallback: string, fontSize: number): number => {
  const probe = document.createElement("span");
  probe.textContent = "mmmmmmmmmmlliWWWW1234567890中文";
  probe.style.cssText = `position:absolute;left:-10000px;top:-10000px;visibility:hidden;white-space:nowrap;font:${fontSize}px sans-serif;font-family:"${family}",${fallback};`;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
};

/** FontFaceSet.check() may report true for a fallback font, so compare real text metrics too. */
const hasDistinctFontMetrics = (family: string, fontSize: number): boolean =>
  ["sans-serif", "serif", "monospace"].some((fallback) =>
    Math.abs(measureFont(family, fallback, fontSize) - measureFont(fallback, fallback, fontSize)) > 0.5,
  );

export const waitForDocumentFonts = async (
  style: ResumeStyle,
  strictFonts: boolean,
): Promise<{ report: RenderFontReport[]; warnings: RenderWarning[] }> => {
  const warnings: RenderWarning[] = [];

  if (!("fonts" in document)) {
    return { report: [], warnings };
  }

  const families = uniqueFontFamilies(style.fontFamily);
  const report = await Promise.all(
    families.map(async (family) => {
      let loaded = false;
      try {
        await document.fonts.load(`${style.fontSize}px "${family}"`);
        loaded = document.fonts.check(`${style.fontSize}px "${family}"`)
          && hasDistinctFontMetrics(family, style.fontSize);
      } catch {
        loaded = false;
      }
      if (!loaded) {
        warnings.push({
          code: "FONT_NOT_LOADED",
          message: `Font family was not reported as available: ${family}`,
          details: { requested: family },
        });
      }
      return { requested: family, loaded };
    }),
  );

  try {
    await document.fonts.ready;
  } catch {
    // The report above is still useful when a browser rejects fonts.ready.
  }

  if (strictFonts && warnings.some((warning) => warning.code === "FONT_NOT_LOADED")) {
    throw new Error("One or more requested font families are not available.");
  }

  return { report, warnings };
};

const visibleContentLength = (page: Element): number =>
  (page.querySelector(".pagedjs_page_content")?.textContent ?? "").replace(/\s/g, "").length;

export const collectPageDiagnostics = (
  pageElements: Element[],
  maxPages?: number,
): { pages: RenderPageMetrics[]; warnings: RenderWarning[] } => {
  const warnings: RenderWarning[] = [];
  const isPagedLayoutWrapper = (element: HTMLElement) =>
    element.tagName === "DIV" &&
    !element.className &&
    Boolean(element.querySelector(".resume-document"));
  const pages = pageElements.map((pageElement, index) => {
    const page = pageElement as HTMLElement;
    const content = page.querySelector(".pagedjs_page_content") as HTMLElement | null;
    const pageRect = page.getBoundingClientRect();
    const contentRect = content?.getBoundingClientRect();
    const contentWidthPx = Math.round(contentRect?.width ?? 0);
    const contentHeightPx = Math.round(contentRect?.height ?? 0);

    const contentBounds = content
      ? Array.from(content.querySelectorAll<HTMLElement>("*"))
          .filter((element) => !isPagedLayoutWrapper(element))
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .reduce(
            (bounds, rect) => ({
              left: Math.min(bounds.left, rect.left),
              right: Math.max(bounds.right, rect.right),
              bottom: Math.max(bounds.bottom, rect.bottom),
            }),
            { left: contentRect?.left ?? 0, right: contentRect?.right ?? 0, bottom: contentRect?.bottom ?? 0 },
          )
      : null;
    const overflowElements = content && contentRect
      ? Array.from(content.querySelectorAll<HTMLElement>("*"))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ element, rect }) => !isPagedLayoutWrapper(element) && rect.width > 0 && rect.height > 0 && rect.right > contentRect.right + 2)
          .sort((left, right) => right.rect.right - left.rect.right)
          .slice(0, 3)
          .map(({ element, rect }) => ({
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: (element.textContent ?? "").trim().slice(0, 120),
            right: rect.right,
          }))
      : [];
    if (
      content &&
      contentRect &&
      contentBounds &&
      (contentBounds.left < contentRect.left - 2 ||
        contentBounds.right > contentRect.right + 2 ||
        contentBounds.bottom > contentRect.bottom + 2)
    ) {
      warnings.push({
        code: "PAGE_OVERFLOW",
        message: `Page ${index + 1} contains content outside its page box.`,
        details: {
          page: index + 1,
          contentLeft: contentRect.left,
          contentRight: contentRect.right,
          contentBottom: contentRect.bottom,
          actualLeft: contentBounds.left,
          actualRight: contentBounds.right,
          actualBottom: contentBounds.bottom,
          overflowElements,
        },
      });
    }

    if (
      visibleContentLength(page) === 0 &&
      page.querySelectorAll("img, svg, canvas").length === 0
    ) {
      warnings.push({
        code: "EMPTY_PAGE",
        message: `Page ${index + 1} has no visible text or media.`,
        details: { page: index + 1 },
      });
    }

    return {
      page: index + 1,
      widthPx: Math.round(pageRect.width),
      heightPx: Math.round(pageRect.height),
      contentWidthPx,
      contentHeightPx,
    };
  });

  if (maxPages !== undefined && pages.length > maxPages) {
    warnings.push({
      code: "PAGE_COUNT_EXCEEDED",
      message: `Rendered ${pages.length} pages, exceeding the configured maximum of ${maxPages}.`,
      details: { pageCount: pages.length, maxPages },
    });
  }

  return { pages, warnings };
};

export const waitForImages = async (root: ParentNode = document): Promise<RenderWarning[]> => {
  const images = Array.from(root.querySelectorAll(".resume-document img"));
  if (images.length === 0) return [];

  await Promise.all(
    images.map(async (image) => {
      const element = image as HTMLImageElement;
      if (!element.complete) {
        try {
          await element.decode();
        } catch {
          // The naturalWidth check below emits the stable diagnostic.
        }
      }
    }),
  );

  return images
    .filter((image) => (image as HTMLImageElement).naturalWidth <= 0)
    .map((image, index) => ({
      code: "RESOURCE_LOAD_FAILED" as const,
      message: `Image ${index + 1} could not be loaded.`,
      details: { src: (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src },
    }));
};
