import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeResumeTemplate,
  type ResumeTemplate,
  type TemplateManifest,
} from "../../../../packages/resume-core/src/domain";
import { Md2cvError } from "./errors";

const REQUIRED_TEMPLATE_IDS = ["modern", "classic", "business"] as const;

export interface TemplateAssetReport {
  root: string;
  templates: string[];
  manifestPath: string;
}

const packageDistRoot = (): string => {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  return moduleDirectory.endsWith(`${sep}dist${sep}node`)
    ? resolve(moduleDirectory, "..")
    : resolve(moduleDirectory, "../..", "dist");
};

/** Resolve assets from the built CLI directory, never from the desktop app data directory. */
export const getRuntimeRoot = (): string =>
  process.env.MD2CV_RUNTIME_DIR
    ? resolve(process.env.MD2CV_RUNTIME_DIR)
    : packageDistRoot();

const templateRoot = (): string => join(getRuntimeRoot(), "runtime", "templates");

const readTemplate = async (directory: string): Promise<ResumeTemplate> => {
  const manifestPath = join(directory, "template.json");
  let manifest: TemplateManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as TemplateManifest;
  } catch (error) {
    throw new Md2cvError(
      "TEMPLATE_NOT_FOUND",
      `Unable to read template manifest: ${manifestPath}`,
      { path: manifestPath, cause: error instanceof Error ? error.message : String(error) },
    );
  }

  if (!manifest.id || !manifest.name || !manifest.entryCss) {
    throw new Md2cvError(
      "TEMPLATE_NOT_FOUND",
      `Template manifest is missing id, name, or entryCss: ${manifestPath}`,
      { path: manifestPath },
    );
  }

  const cssPath = join(directory, manifest.entryCss);
  try {
    await access(cssPath);
  } catch {
    throw new Md2cvError(
      "TEMPLATE_NOT_FOUND",
      `Template entry CSS does not exist: ${cssPath}`,
      { path: cssPath, template: manifest.id },
    );
  }

  return normalizeResumeTemplate({
    ...manifest,
    css: await readFile(cssPath, "utf8"),
  });
};

export const loadTemplates = async (): Promise<ResumeTemplate[]> => {
  const root = templateRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new Md2cvError(
      "TEMPLATE_NOT_FOUND",
      `Built-in template assets are missing: ${root}`,
      { root, cause: error instanceof Error ? error.message : String(error) },
      ["Run npm run build:cli before invoking the built CLI."],
    );
  }

  const directories = entries.filter((entry) => entry.isDirectory());
  const templates = await Promise.all(
    directories.map((entry) => readTemplate(join(root, entry.name))),
  );
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) {
      throw new Md2cvError("TEMPLATE_NOT_FOUND", `Duplicate template id: ${template.id}`);
    }
    ids.add(template.id);
  }

  for (const required of REQUIRED_TEMPLATE_IDS) {
    if (!ids.has(required)) {
      throw new Md2cvError(
        "TEMPLATE_NOT_FOUND",
        `Required built-in template is missing: ${required}`,
        { available: [...ids] },
      );
    }
  }

  return templates.sort((left, right) => left.id.localeCompare(right.id));
};

export const findTemplate = async (templateId: string): Promise<ResumeTemplate> => {
  const templates = await loadTemplates();
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template) {
    throw new Md2cvError(
      "TEMPLATE_NOT_FOUND",
      `Unknown template: ${templateId}`,
      { template: templateId, available: templates.map((candidate) => candidate.id) },
      ["Run md2cv templates list --json to see available templates."],
    );
  }
  return template;
};

export const getTemplateAssetReport = async (): Promise<TemplateAssetReport> => ({
  root: templateRoot(),
  templates: (await loadTemplates()).map((template) => template.id),
  manifestPath: join(getRuntimeRoot(), "runtime", "asset-manifest.json"),
});
