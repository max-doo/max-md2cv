export type Md2cvErrorCode =
  | "INVALID_ARGUMENT"
  | "INPUT_NOT_FOUND"
  | "INPUT_READ_FAILED"
  | "INVALID_CONFIG"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_VALUE_INVALID"
  | "PHOTO_NOT_FOUND"
  | "OUTPUT_EXISTS"
  | "OUTPUT_NOT_WRITABLE"
  | "BROWSER_NOT_FOUND"
  | "BROWSER_LAUNCH_FAILED"
  | "RENDER_TIMEOUT"
  | "RENDER_FAILED"
  | "PDF_EXPORT_FAILED"
  | "SCREENSHOT_EXPORT_FAILED"
  | "INTERNAL_ERROR";

export const EXIT_CODE_BY_ERROR: Record<Md2cvErrorCode, number> = {
  INVALID_ARGUMENT: 2,
  INPUT_NOT_FOUND: 3,
  INPUT_READ_FAILED: 3,
  INVALID_CONFIG: 3,
  TEMPLATE_NOT_FOUND: 3,
  TEMPLATE_VALUE_INVALID: 3,
  PHOTO_NOT_FOUND: 3,
  OUTPUT_EXISTS: 6,
  OUTPUT_NOT_WRITABLE: 6,
  BROWSER_NOT_FOUND: 4,
  BROWSER_LAUNCH_FAILED: 4,
  RENDER_TIMEOUT: 5,
  RENDER_FAILED: 5,
  PDF_EXPORT_FAILED: 5,
  SCREENSHOT_EXPORT_FAILED: 5,
  INTERNAL_ERROR: 1,
};

export class Md2cvError extends Error {
  readonly code: Md2cvErrorCode;
  readonly details?: Record<string, unknown>;
  readonly suggestions: string[];

  constructor(
    code: Md2cvErrorCode,
    message: string,
    details?: Record<string, unknown>,
    suggestions: string[] = [],
  ) {
    super(message);
    this.name = "Md2cvError";
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
  }
}

export const asMd2cvError = (error: unknown): Md2cvError => {
  if (error instanceof Md2cvError) return error;
  return new Md2cvError(
    "INTERNAL_ERROR",
    error instanceof Error ? error.message : String(error),
  );
};

export const errorFromRenderer = (error: unknown): Md2cvError => {
  const candidate = error as { code?: string; message?: string; details?: Record<string, unknown> };
  const code = candidate.code;
  if (
    code === "RENDER_TIMEOUT" ||
    code === "RENDER_FAILED" ||
    code === "FONT_NOT_LOADED"
  ) {
    return new Md2cvError(
      code === "FONT_NOT_LOADED" ? "RENDER_FAILED" : code,
      candidate.message ?? "Renderer failed.",
      candidate.details,
    );
  }
  return asMd2cvError(error);
};
