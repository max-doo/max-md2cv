import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = resolve(root, "apps/cli/dist/node/cli.js");
const rendererRoot = resolve(root, "apps/cli/dist/renderer");
const modernManifestPath = resolve(root, "apps/cli/dist/runtime/templates/modern/template.json");
const modernStylePath = resolve(root, "apps/cli/dist/runtime/templates/modern/style.css");
const photoPath = resolve(root, "public/favicon.png");

const runJson = (args) => new Promise((resolveResult, rejectResult) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: root, windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", rejectResult);
  child.on("close", (code) => {
    if (code !== 0) {
      rejectResult(new Error(`CLI command failed (${code}): ${stderr || stdout}`));
      return;
    }
    try {
      resolveResult(JSON.parse(stdout));
    } catch (error) {
      rejectResult(new Error(`CLI command did not return JSON: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
  child.stdin.end();
});

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};

const startStaticServer = async (rootDirectory) => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      const requested = resolve(rootDirectory, `.${pathname === "/" ? "/index.html" : pathname}`);
      const relativePath = relative(rootDirectory, requested);
      if (relativePath === ".." || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const bytes = await readFile(requested);
      response.writeHead(200, { "content-type": mimeTypes[extname(requested).toLowerCase()] ?? "application/octet-stream" });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", resolveServer);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Renderer test server did not expose a port.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  };
};

const evaluateRender = (page, request) => page.evaluate(async (renderRequest) => {
  try {
    return { ok: true, result: await window.md2cvRenderer.render(renderRequest) };
  } catch (error) {
    const candidate = error;
    return {
      ok: false,
      error: {
        code: candidate?.code ?? "RENDER_FAILED",
        message: candidate?.message ?? String(error),
      },
    };
  }
}, request);

const assertWarning = (result, code) => {
  assert.equal(result.ok, true);
  assert.ok(result.result.warnings.some((warning) => warning.code === code), `Expected warning ${code}`);
};

const schemaPayload = await runJson(["templates", "schema", "modern", "--json"]);
const manifest = JSON.parse(await readFile(modernManifestPath, "utf8"));
const template = {
  ...schemaPayload.template,
  entryCss: manifest.entryCss,
  css: await readFile(modernStylePath, "utf8"),
};
const photoDataUrl = `data:image/png;base64,${(await readFile(photoPath)).toString("base64")}`;
const doctor = await runJson(["doctor", "--json"]);
const browserPath = doctor.checks.browser.candidate?.executablePath;
assert.ok(browserPath, "Renderer integration test requires a discovered Chromium browser.");

const server = await startStaticServer(rendererRoot);
const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: process.platform === "win32" ? ["--disable-gpu"] : ["--disable-gpu", "--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();

try {
  await page.goto(server.url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.md2cvRenderer));

  const baseRequest = {
    markdown: "# Renderer 集成测试\n\n**求职意向：工程师**\n\n上海 | render@example.com\n\n## 能力\n\n- 中文和 English mixed content\n- Shared renderer continuity check",
    documentTitle: "renderer-integration",
    template,
    values: template.defaults,
    photoDataUrl: null,
    sourceDirectory: null,
    options: { strictFonts: false, allowNetwork: false, timeoutMs: 30_000 },
  };

  const first = await evaluateRender(page, baseRequest);
  assert.equal(first.ok, true);
  assert.equal(first.result.pageCount, 1);
  assert.ok(first.result.pages[0].widthPx > 0 && first.result.pages[0].heightPx > 0);

  const second = await evaluateRender(page, { ...baseRequest, values: { ...template.defaults, fontSize: 16 } });
  assert.equal(second.ok, true);
  assert.equal(second.result.effectiveValues.fontSize, 16);
  assert.equal(await page.locator(".pagedjs_page").count(), second.result.pageCount);

  const brokenImage = await evaluateRender(page, { ...baseRequest, markdown: "# 图片诊断\n\n![broken](data:,)" });
  assertWarning(brokenImage, "RESOURCE_LOAD_FAILED");

  const photoRender = await evaluateRender(page, { ...baseRequest, photoDataUrl });
  assert.equal(photoRender.ok, true);
  const visiblePhoto = await page.evaluate(() => {
    const wrapper = document.querySelector(".pagedjs_page .resume-photo-wrapper");
    const image = wrapper?.querySelector("img");
    return { display: wrapper ? getComputedStyle(wrapper).display : "missing", naturalWidth: image?.naturalWidth ?? 0 };
  });
  assert.equal(visiblePhoto.display, "flex");
  assert.ok(visiblePhoto.naturalWidth > 0);

  const hiddenPhoto = await evaluateRender(page, { ...baseRequest, values: { ...template.defaults, photoVisible: false }, photoDataUrl });
  assert.equal(hiddenPhoto.ok, true);
  const hiddenDisplay = await page.evaluate(() => getComputedStyle(document.querySelector(".pagedjs_page .resume-photo-wrapper")).display);
  assert.equal(hiddenDisplay, "none");

  const missingFontTemplate = {
    ...template,
    defaults: { ...template.defaults, fontFamily: '"MD2CV Missing Font"' },
    editorSchema: template.editorSchema.filter((field) => field.key !== "fontFamily"),
  };
  const missingFontRequest = { ...baseRequest, template: missingFontTemplate, values: missingFontTemplate.defaults };
  const missingFont = await evaluateRender(page, missingFontRequest);
  assertWarning(missingFont, "FONT_NOT_LOADED");

  const strictFont = await evaluateRender(page, { ...missingFontRequest, options: { ...missingFontRequest.options, strictFonts: true } });
  assert.equal(strictFont.ok, false);
  assert.equal(strictFont.error.code, "FONT_NOT_LOADED");

  const exceeded = await evaluateRender(page, { ...baseRequest, options: { ...baseRequest.options, maxPages: 0 } });
  assertWarning(exceeded, "PAGE_COUNT_EXCEEDED");

  const overflowTemplate = {
    ...template,
    css: `${template.css}\n.resume-document .overflow-test { width: 2000px !important; max-width: none !important; }`,
  };
  const overflow = await evaluateRender(page, {
    ...baseRequest,
    template: overflowTemplate,
    markdown: "# Overflow test\n\n<div class=\"overflow-test\">This element intentionally exceeds the page content box.</div>",
  });
  assertWarning(overflow, "PAGE_OVERFLOW");

  const timeout = await evaluateRender(page, { ...baseRequest, options: { ...baseRequest.options, timeoutMs: 1 } });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.error.code, "RENDER_TIMEOUT");
  assert.equal(await page.locator(".pagedjs_page").count(), 0);

  console.log("Renderer integration passed: continuity, photo visibility, font diagnostics, broken images, overflow, max-pages, and timeout.");
} finally {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  await server.close();
}
