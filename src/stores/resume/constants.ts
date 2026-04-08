const IS_WINDOWS =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

export const DEFAULT_MARKDOWN = "";
export const DEFAULT_FILE_NAME = "未命名.md";
export const DEFAULT_TEMPLATE_ID = "modern";
export const WATCH_REFRESH_DELAY = 160;
export const LOCAL_MUTATION_TTL = 4000;
export const RENDER_STATE_VERSION = 2;
export const IS_WINDOWS_PLATFORM = IS_WINDOWS;

export const STORAGE_KEYS = {
  workspacePath: "resume-workspace-path",
  lastOpenedPath: "resume-last-opened-path",
  lastPhotoPath: "resume-last-photo-path",
} as const;

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
