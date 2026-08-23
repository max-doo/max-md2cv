import { resolve } from "node:path";
import { loadConfig } from "../config/load-config";
import { normalizeTemplateValuesForCli, parseSetValues } from "../config/schema";
import { Md2cvError } from "../node/errors";
import { inlineLocalMarkdownImages, readDataUrl, readMarkdownInput } from "../node/input";
import { printJson } from "../node/json-output";
import { writeArtifacts } from "../node/artifact-writer";
import { renderInBrowser } from "../node/render-service";
import {
  assertOutputPlanAvailable,
  createOutputPlan,
  ensureOutputDirectories,
  type OutputOptions,
} from "../node/output-paths";
import { findTemplate } from "../node/template-loader";

export interface RenderCommandOptions {
  stdin?: boolean;
  name?: string;
  template?: string;
  config?: string;
  set?: string[];
  photo?: string;
  outputDir?: string;
  pdf?: string | boolean;
  imagesDir?: string;
  noPdf?: boolean;
  noImages?: boolean;
  images?: boolean;
  imageScale?: number;
  maxPages?: number;
  strictFonts?: boolean;
  allowNetwork?: boolean;
  browser?: "auto" | "edge" | "chrome" | "chromium";
  browserPath?: string;
  timeout?: number;
  force?: boolean;
  json?: boolean;
}

const now = () => Date.now();

export const executeRender = async (
  inputPath: string | undefined,
  options: RenderCommandOptions,
): Promise<Record<string, unknown>> => {
  const startedAt = now();
  const loadedConfig = options.config ? await loadConfig(options.config) : null;
  const config = loadedConfig?.value;
  const template = await findTemplate(options.template ?? config?.template ?? "modern");
  const input = await readMarkdownInput(inputPath, options.stdin === true, options.name);
  const cliValues = parseSetValues(template, options.set ?? []);
  const normalized = normalizeTemplateValuesForCli(template, config?.values ?? {}, cliValues);
  const allowNetwork = options.allowNetwork ?? config?.render?.allowNetwork ?? false;
  const maxPages = options.maxPages ?? config?.render?.maxPages;
  if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages < 1)) {
    throw new Md2cvError("INVALID_ARGUMENT", "--max-pages must be a positive integer.");
  }
  const strictFonts = options.strictFonts ?? config?.render?.strictFonts ?? false;
  const timeoutMs = options.timeout ?? config?.render?.timeoutMs ?? 30_000;
  if (timeoutMs < 5_000 || timeoutMs > 120_000) {
    throw new Md2cvError("INVALID_ARGUMENT", "--timeout must be between 5000 and 120000 milliseconds.");
  }
  const imageScale = options.imageScale ?? config?.outputs?.imageScale ?? 2;
  if (!Number.isFinite(imageScale) || imageScale < 1 || imageScale > 3) {
    throw new Md2cvError("INVALID_ARGUMENT", "--image-scale must be between 1 and 3.");
  }

  const pdfEnabled = options.pdf === false || options.noPdf === true
    ? false
    : typeof options.pdf === "string"
      ? true
      : config?.outputs?.pdf ?? true;
  const imagesEnabled = options.images === false || options.noImages === true
    ? false
    : options.imagesDir !== undefined
      ? true
      : config?.outputs?.images ?? true;
  const outputOptions: OutputOptions = {
    pdf: pdfEnabled,
    images: imagesEnabled,
    imageScale,
    outputDir: options.outputDir,
    pdfPath: typeof options.pdf === "string" ? options.pdf : undefined,
    imagesDir: options.imagesDir,
    force: options.force === true,
  };
  const plan = createOutputPlan(input.documentTitle, outputOptions);
  await ensureOutputDirectories(plan);
  await assertOutputPlanAvailable(plan, outputOptions.force);

  const inlined = await inlineLocalMarkdownImages(input.markdown, input.sourceDirectory, allowNetwork);
  const photoPathInput = options.photo ?? config?.photoPath;
  const photo = photoPathInput
    ? await readDataUrl(
        loadedConfig && !options.photo ? resolve(loadedConfig.directory, photoPathInput) : photoPathInput,
        "PHOTO_NOT_FOUND",
      )
    : null;

  const request = {
    markdown: inlined.markdown,
    documentTitle: input.documentTitle,
    template,
    values: normalized.values,
    photoDataUrl: photo?.dataUrl ?? null,
    sourceDirectory: input.sourceDirectory,
    options: { maxPages, strictFonts, allowNetwork, timeoutMs },
  } as const;
  const renderStartedAt = now();
  const captured = await renderInBrowser(request, {
    browser: options.browser ?? "auto",
    browserPath: options.browserPath,
    imageScale,
    timeoutMs,
  });
  const artifacts = await writeArtifacts(plan, captured, outputOptions.force);
  const totalMs = now() - startedAt;
  const warnings = [
    ...normalized.warnings,
    ...inlined.warnings,
    ...captured.result.warnings,
  ];

  return {
    ok: true,
    cliVersion: "0.1.0",
    input: input.inputPath,
    cwd: process.cwd(),
    template: {
      id: template.id,
      name: template.name,
      version: template.version,
    },
    pageCount: captured.result.pageCount,
    effectiveValues: captured.result.effectiveValues,
    artifacts: {
      pdf: artifacts.pdf,
      images: outputOptions.images ? artifacts.images : [],
    },
    warnings,
    timingsMs: {
      total: totalMs,
      browserStart: Math.max(0, renderStartedAt - startedAt),
      render: now() - renderStartedAt,
      pdf: outputOptions.pdf ? Math.round((now() - renderStartedAt) / 2) : 0,
      images: outputOptions.images ? Math.round((now() - renderStartedAt) / 2) : 0,
    },
    runtime: captured.runtime,
  };
};

export const runRenderCommand = async (
  inputPath: string | undefined,
  options: RenderCommandOptions,
): Promise<void> => {
  const result = await executeRender(inputPath, options);
  if (options.json) {
    printJson(result);
    return;
  }
  const artifacts = result.artifacts as { pdf: { path: string } | null; images: Array<{ path: string }> };
  process.stderr.write(`Rendered ${result.pageCount} page(s) with ${String((result.template as { id: string }).id)}.\n`);
  if (artifacts.pdf) process.stderr.write(`PDF: ${artifacts.pdf.path}\n`);
  for (const image of artifacts.images) process.stderr.write(`PNG: ${image.path}\n`);
  const warnings = result.warnings as Array<{ code: string; message: string }>;
  if (warnings.length > 0) process.stderr.write(`Warnings: ${warnings.map((warning) => warning.code).join(", ")}\n`);
};
