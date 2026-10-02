import { DEFAULT_FILE_NAME, IS_WINDOWS_PLATFORM } from "./constants";

export const ensureMarkdownFileName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_FILE_NAME;
  }

  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
};

export const ensurePdfFileName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "resume.pdf";
  }

  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
};

export const removeStorageItem = (key: string) => {
  localStorage.removeItem(key);
};

export const normalizePathKey = (path: string) => {
  const normalized = path.replace(/\\/g, "/");
  return IS_WINDOWS_PLATFORM ? normalized.toLowerCase() : normalized;
};
