import type { ResumeTemplate, TemplateValues } from "../../resume-core/src/domain";

export type RenderWarningCode =
  | "FONT_NOT_LOADED"
  | "RESOURCE_LOAD_FAILED"
  | "PAGE_OVERFLOW"
  | "EMPTY_PAGE"
  | "PAGE_COUNT_EXCEEDED"
  | "TEMPLATE_VALUE_CLAMPED";

export interface RenderWarning {
  code: RenderWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface RenderRequest {
  markdown: string;
  documentTitle: string;
  template: ResumeTemplate;
  values: TemplateValues;
  photoDataUrl: string | null;
  sourceDirectory: string | null;
  options: {
    maxPages?: number;
    strictFonts: boolean;
    allowNetwork: boolean;
    timeoutMs?: number;
    showPhotoPlaceholder?: boolean;
  };
}

export interface RenderPageMetrics {
  page: number;
  widthPx: number;
  heightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
}

export interface RenderFontReport {
  requested: string;
  loaded: boolean;
}

export interface RenderResult {
  pageCount: number;
  effectiveValues: TemplateValues;
  pages: RenderPageMetrics[];
  warnings: RenderWarning[];
  fontReport: RenderFontReport[];
}

export class RendererError extends Error {
  readonly code:
    | "RENDER_TIMEOUT"
    | "RENDER_FAILED"
    | "FONT_NOT_LOADED";

  readonly details?: Record<string, unknown>;

  constructor(
    code: RendererError["code"],
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RendererError";
    this.code = code;
    this.details = details;
  }
}
