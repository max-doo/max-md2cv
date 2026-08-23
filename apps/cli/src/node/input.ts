import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { Md2cvError } from "./errors";

export interface InputDocument {
  markdown: string;
  inputPath: string | null;
  sourceDirectory: string | null;
  documentTitle: string;
}

export const readMarkdownInput = async (
  inputPath: string | undefined,
  useStdin: boolean,
  name?: string,
): Promise<InputDocument> => {
  if (useStdin) {
    if (inputPath) {
      throw new Md2cvError("INVALID_ARGUMENT", "Do not provide an input path together with --stdin.");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return {
      markdown: Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, ""),
      inputPath: null,
      sourceDirectory: null,
      documentTitle: sanitizeDocumentTitle(name || "resume"),
    };
  }

  if (!inputPath) {
    throw new Md2cvError("INVALID_ARGUMENT", "An input Markdown path is required unless --stdin is used.");
  }

  const path = resolve(process.cwd(), inputPath);
  let markdown: string;
  try {
    markdown = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === "ENOENT" ? "INPUT_NOT_FOUND" : "INPUT_READ_FAILED";
    throw new Md2cvError(code, `Unable to read Markdown input: ${path}`, {
      path,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const baseName = name || (extname(path).toLowerCase() === ".md" ? path.slice(0, -3) : path);
  return {
    markdown,
    inputPath: path,
    sourceDirectory: resolve(path, ".."),
    documentTitle: sanitizeDocumentTitle(baseName.split(/[\\/]/).pop() || "resume"),
  };
};

export const sanitizeDocumentTitle = (value: string): string =>
  value.replace(/\.md$/i, "").trim() || "resume";

export const readDataUrl = async (pathInput: string, errorCode: "PHOTO_NOT_FOUND" | "INPUT_READ_FAILED" = "PHOTO_NOT_FOUND") => {
  const path = resolve(process.cwd(), pathInput);
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (error) {
    throw new Md2cvError(errorCode, `Unable to read file: ${path}`, {
      path,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  const extension = extname(path).toLowerCase();
  const mime = extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : extension === ".gif"
        ? "image/gif"
        : "image/jpeg";
  return { path, dataUrl: `data:${mime};base64,${bytes.toString("base64")}` };
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const isWithinDirectory = (candidate: string, directory: string) => {
  const relativePath = relative(resolve(directory), resolve(candidate));
  return relativePath === ""
    || (relativePath !== ".."
      && !relativePath.startsWith(`..${sep}`)
      && !isAbsolute(relativePath));
};

/** Inline local Markdown images so the browser never receives arbitrary file URLs. */
export const inlineLocalMarkdownImages = async (
  markdown: string,
  sourceDirectory: string | null,
  allowNetwork: boolean,
): Promise<{ markdown: string; warnings: Array<{ code: "RESOURCE_LOAD_FAILED"; message: string; details?: Record<string, unknown> }> }> => {
  const warnings: Array<{ code: "RESOURCE_LOAD_FAILED"; message: string; details?: Record<string, unknown> }> = [];
  const imagePattern = /!\[([^\]]*)\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\)/g;
  const replacements: Array<{ original: string; replacement: string }> = [];

  for (const match of markdown.matchAll(imagePattern)) {
    const original = match[0];
    const rawSource = (match[2] ?? "").replace(/^<|>$/g, "");
    if (rawSource.startsWith("data:") || (/^https?:\/\//i.test(rawSource) && allowNetwork)) continue;
    if (/^https?:\/\//i.test(rawSource)) {
      warnings.push({ code: "RESOURCE_LOAD_FAILED", message: `Network image blocked by default: ${rawSource}`, details: { source: rawSource } });
      replacements.push({ original, replacement: `![${match[1] ?? ""}](data:,)` });
      continue;
    }
    if (!sourceDirectory) {
      warnings.push({ code: "RESOURCE_LOAD_FAILED", message: `Relative image cannot be resolved from stdin: ${rawSource}`, details: { source: rawSource } });
      replacements.push({ original, replacement: `![${match[1] ?? ""}](data:,)` });
      continue;
    }
    const imagePath = resolve(sourceDirectory, rawSource);
    if (!isWithinDirectory(imagePath, sourceDirectory)) {
      warnings.push({ code: "RESOURCE_LOAD_FAILED", message: `Relative image path escapes the input directory: ${rawSource}`, details: { source: rawSource } });
      replacements.push({ original, replacement: `![${match[1] ?? ""}](data:,)` });
      continue;
    }
    try {
      const bytes = await readFile(imagePath);
      const mime = MIME_BY_EXTENSION[extname(imagePath).toLowerCase()] ?? "application/octet-stream";
      replacements.push({ original, replacement: `![${match[1] ?? ""}](data:${mime};base64,${bytes.toString("base64")})` });
    } catch {
      warnings.push({ code: "RESOURCE_LOAD_FAILED", message: `Unable to load local image: ${rawSource}`, details: { source: rawSource, path: imagePath } });
      replacements.push({ original, replacement: `![${match[1] ?? ""}](data:,)` });
    }
  }

  return {
    markdown: replacements.reduce((current, replacement) => current.split(replacement.original).join(replacement.replacement), markdown),
    warnings,
  };
};
