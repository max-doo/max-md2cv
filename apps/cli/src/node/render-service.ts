import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import type { Browser, Page } from "playwright-core";
import { launchDiscoveredBrowser, type BrowserName } from "./browser-discovery";
import { errorFromRenderer, Md2cvError } from "./errors";
import { startRendererServer } from "./renderer-server";
import type { RenderRequest, RenderResult } from "../../../../packages/resume-renderer/src/types";

export interface BrowserRenderOptions {
  browser: BrowserName;
  browserPath?: string;
  imageScale: number;
  timeoutMs: number;
}

export interface BrowserRuntimeInfo {
  browser: string;
  browserVersion: string;
  platform: NodeJS.Platform;
}

export interface CapturedRender {
  result: RenderResult;
  pdf: Buffer;
  images: Array<{ page: number; width: number; height: number; bytes: Buffer }>;
  runtime: BrowserRuntimeInfo;
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Md2cvError("RENDER_TIMEOUT", message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const installPrintCaptureStyles = async (page: Page) => {
  await page.emulateMedia({ media: "print" });
  await page.addStyleTag({
    content: `
      @page { size: A4; margin: 0 !important; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .pagedjs_pages { display: block !important; margin: 0 !important; }
      .pagedjs_page { width: var(--pagedjs-width) !important; height: var(--pagedjs-height) !important; min-height: 0 !important; max-height: none !important; overflow: hidden !important; box-shadow: none !important; margin: 0 !important; background: #fff !important; break-after: page; page-break-after: always; }
      .pagedjs_page:last-child { break-after: auto; page-break-after: auto; }
      .pagedjs_sheet { width: var(--pagedjs-width) !important; height: var(--pagedjs-height) !important; min-height: 0 !important; max-height: none !important; overflow: hidden !important; box-shadow: none !important; }
    `,
  });
};

const captureArtifacts = async (page: Page, result: RenderResult, imageScale: number) => {
  const pages = page.locator(".pagedjs_page");
  const count = await pages.count();
  if (count !== result.pageCount) {
    throw new Md2cvError(
      "RENDER_FAILED",
      `Renderer page count changed before export: ${result.pageCount} -> ${count}.`,
    );
  }

  let pdf: Buffer;
  try {
    pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    });
  } catch (error) {
    throw new Md2cvError("PDF_EXPORT_FAILED", "Chromium failed to create the PDF.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const images: Array<{ page: number; width: number; height: number; bytes: Buffer }> = [];
  for (let index = 0; index < count; index += 1) {
    try {
      const rawBytes = await pages.nth(index).screenshot({ type: "png", animations: "disabled" });
      const decoded = PNG.sync.read(rawBytes);
      let bytes = rawBytes;
      const targetSize = images[0] ? { width: images[0].width, height: images[0].height } : { width: decoded.width, height: decoded.height };
      if (decoded.width !== targetSize.width || decoded.height !== targetSize.height) {
        const normalized = new PNG({ width: targetSize.width, height: targetSize.height });
        normalized.data.fill(255);
        const copyWidth = Math.min(decoded.width, targetSize.width);
        const copyHeight = Math.min(decoded.height, targetSize.height);
        for (let y = 0; y < copyHeight; y += 1) {
          const sourceStart = y * decoded.width * 4;
          const targetStart = y * targetSize.width * 4;
          decoded.data.copy(normalized.data, targetStart, sourceStart, sourceStart + copyWidth * 4);
        }
        bytes = PNG.sync.write(normalized);
      }
      const width = targetSize.width;
      const height = targetSize.height;
      if (width <= 0 || height <= 0) throw new Error("PNG has invalid dimensions");
      images.push({ page: index + 1, width, height, bytes });
    } catch (error) {
      throw new Md2cvError("SCREENSHOT_EXPORT_FAILED", `Failed to capture page ${index + 1} as PNG.`, {
        page: index + 1,
        imageScale,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { pdf, images };
};

export const renderInBrowser = async (
  request: RenderRequest,
  options: BrowserRenderOptions,
): Promise<CapturedRender> => {
  const rendererRoot = resolve(fileURLToPath(new URL("../../dist/renderer", import.meta.url)));
  const server = await startRendererServer(rendererRoot).catch((error) => {
    throw new Md2cvError("RENDER_FAILED", "Unable to start the local renderer host.", {
      root: rendererRoot,
      cause: error instanceof Error ? error.message : String(error),
    });
  });
  let browser: Browser | null = null;

  try {
    const launched = await launchDiscoveredBrowser(options.browser, options.browserPath);
    browser = launched.browser;
    const context = await browser.newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: options.imageScale,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const failedRequests: string[] = [];
    page.on("requestfailed", (requestEvent) => {
      const failure = requestEvent.failure()?.errorText ?? "resource request failed";
      failedRequests.push(`${requestEvent.url()} (${failure})`);
    });
    page.on("pageerror", (error) => {
      failedRequests.push(`pageerror: ${error.message}`);
    });
    if (!request.options.allowNetwork) {
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (url.startsWith(server.url) || url.startsWith("data:") || url.startsWith("about:")) {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
      });
    }

    await page.goto(server.url, { waitUntil: "load", timeout: options.timeoutMs });
    await page.waitForFunction(() => Boolean((window as Window & { md2cvRenderer?: unknown }).md2cvRenderer), undefined, { timeout: options.timeoutMs });

    const envelope = await withTimeout(
      page.evaluate(async (renderRequest) => {
        const renderer = (window as Window & {
          md2cvRenderer?: {
            render: (request: unknown) => Promise<unknown>;
          };
        }).md2cvRenderer;
        if (!renderer) throw new Error("Renderer host API is unavailable.");
        try {
          return { ok: true, result: await renderer.render(renderRequest) };
        } catch (error) {
          const candidate = error as { code?: string; message?: string; details?: Record<string, unknown> };
          return {
            ok: false,
            error: {
              code: candidate.code ?? "RENDER_FAILED",
              message: candidate.message ?? "Renderer failed.",
              details: candidate.details,
            },
          };
        }
      }, request),
      options.timeoutMs,
      `Renderer did not complete within ${options.timeoutMs}ms.`,
    ) as { ok: true; result: RenderResult } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

    if (!envelope.ok) throw errorFromRenderer(envelope.error);
    const result = envelope.result;
    if (failedRequests.length > 0) {
      result.warnings.push({
        code: "RESOURCE_LOAD_FAILED",
        message: "One or more browser resources failed or were blocked.",
        details: { resources: failedRequests.slice(0, 20) },
      });
    }

    await installPrintCaptureStyles(page);
    const artifacts = await captureArtifacts(page, result, options.imageScale);
    await context.close();
    return {
      result,
      pdf: artifacts.pdf,
      images: artifacts.images,
      runtime: { browser: launched.candidate.label, browserVersion: launched.version, platform: process.platform },
    };
  } catch (error) {
    if (error instanceof Md2cvError) throw error;
    throw new Md2cvError("RENDER_FAILED", error instanceof Error ? error.message : String(error));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
};
