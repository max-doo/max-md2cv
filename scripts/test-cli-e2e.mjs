import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromCli = createRequire(resolve(root, "apps/cli/package.json"));
const pdfjs = await import(pathToFileURL(requireFromCli.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const cli = resolve(root, "apps/cli/dist/node/cli.js");
const onePage = resolve(root, "apps/cli/tests/fixtures/one-page.md");
const twoPage = resolve(root, "apps/cli/tests/fixtures/two-page.md");
const brokenImage = resolve(root, "apps/cli/tests/fixtures/broken-image.md");
const config = resolve(root, "apps/cli/tests/fixtures/resume.render.json");
const cliOverridesConfig = resolve(root, "apps/cli/tests/fixtures/cli-overrides.render.json");
const photo = resolve(root, "public/favicon.png");

const run = (args, cwd, input) => new Promise((resolveResult) => {
  const child = spawn(process.execPath, [cli, ...args], { cwd, windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", (error) => resolveResult({ code: error.code ?? 1, stdout, stderr: `${stderr}${error.message}` }));
  child.on("close", (code) => resolveResult({ code: code ?? 1, stdout, stderr }));
  if (input !== undefined) child.stdin.end(input);
  else child.stdin.end();
});

const parseJson = (result) => {
  assert.equal(result.stdout.trim().split(/\r?\n/).length, 1, `stdout was not a single JSON object: ${result.stdout}`);
  return JSON.parse(result.stdout);
};

const assertPng = async (path) => {
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const decoded = PNG.sync.read(bytes);
  let nonWhitePixels = 0;
  for (let offset = 0; offset < decoded.data.length; offset += 16) {
    const alpha = decoded.data[offset + 3];
    if (alpha > 0 && (decoded.data[offset] < 245 || decoded.data[offset + 1] < 245 || decoded.data[offset + 2] < 245)) {
      nonWhitePixels += 1;
    }
  }
  assert.ok(nonWhitePixels > 10, `PNG appears blank: ${path}`);
  return { width: decoded.width, height: decoded.height, bytes: bytes.length };
};

const assertPdf = async (path, expectedPageCount, expectedText = "张三") => {
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(bytes.length > 1024);
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  try {
    assert.equal(document.numPages, expectedPageCount);
    const text = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      text.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    assert.match(text.join("\n"), new RegExp(expectedText));
  } finally {
    await document.destroy();
  }
  return bytes;
};

const tempRoot = await mkdtemp(join(tmpdir(), "md2cv-e2e-"));
const cwd = join(tempRoot, "空格 目录");
await mkdir(cwd, { recursive: true });

try {
  const version = await run(["--version"], cwd);
  assert.equal(version.code, 0);
  assert.match(version.stdout.trim(), /^0\.1\.0$/);

  const list = parseJson(await run(["templates", "list", "--json"], cwd));
  assert.deepEqual(list.templates.map((template) => template.id), ["business", "classic", "modern"]);

  const schema = parseJson(await run(["templates", "schema", "modern", "--json"], cwd));
  assert.ok(schema.template.editorSchema.some((field) => field.key === "fontSize"));

  const doctor = parseJson(await run(["doctor", "--json"], cwd));
  assert.equal(doctor.checks.rendererHost.ok, true);
  assert.equal(doctor.checks.templates.ok, true);
  assert.equal(doctor.checks.browser.ok, true);

  const validate = parseJson(await run(["validate", onePage, "--template", "modern", "--json"], cwd));
  assert.equal(validate.ok, true);

  const defaultRender = parseJson(await run(["render", onePage, "--json"], cwd));
  assert.equal(defaultRender.ok, true);
  assert.equal(defaultRender.pageCount, 1);
  assert.equal(defaultRender.artifacts.images.length, 1);
  assert.equal(resolve(defaultRender.artifacts.pdf.path), defaultRender.artifacts.pdf.path);
  await assertPdf(defaultRender.artifacts.pdf.path, 1);
  const defaultPng = await assertPng(defaultRender.artifacts.images[0].path);
  assert.ok(defaultPng.bytes > 1000 && defaultPng.width > 500 && defaultPng.height > 500);

  const brokenImageDir = join(tempRoot, "broken-image-output");
  const brokenImageRender = parseJson(await run(["render", brokenImage, "--output-dir", brokenImageDir, "--json"], cwd));
  assert.ok(brokenImageRender.warnings.some((warning) => warning.code === "RESOURCE_LOAD_FAILED"));
  await assertPdf(brokenImageRender.artifacts.pdf.path, 1, "破损图片测试");
  await assertPng(brokenImageRender.artifacts.images[0].path);

  const businessDir = join(tempRoot, "business-output");
  const business = parseJson(await run(["render", onePage, "--template", "business", "--output-dir", businessDir, "--json"], cwd));
  assert.equal(business.template.id, "business");
  assert.equal(business.pageCount, 1);
  await assertPdf(business.artifacts.pdf.path, 1);
  await assertPng(business.artifacts.images[0].path);

  const classicDir = join(tempRoot, "classic-output");
  const classic = parseJson(await run(["render", twoPage, "--template", "classic", "--output-dir", classicDir, "--json"], cwd));
  assert.equal(classic.pageCount, 2);
  assert.equal(classic.artifacts.images.length, 2);
  assert.equal(classic.artifacts.images[0].height, classic.artifacts.images[1].height);
  await assertPdf(classic.artifacts.pdf.path, 2, "李四");
  await Promise.all(classic.artifacts.images.map((image) => assertPng(image.path)));

  const maxPagesDir = join(tempRoot, "max-pages-output");
  const maxPages = parseJson(await run(["render", twoPage, "--template", "classic", "--max-pages", "1", "--output-dir", maxPagesDir, "--json"], cwd));
  assert.ok(maxPages.warnings.some((warning) => warning.code === "PAGE_COUNT_EXCEEDED"));

  const photoDir = join(tempRoot, "photo-output");
  const photoRender = parseJson(await run(["render", onePage, "--photo", photo, "--output-dir", photoDir, "--json"], cwd));
  assert.equal(photoRender.pageCount, 1);
  await assertPdf(photoRender.artifacts.pdf.path, 1);
  await assertPng(photoRender.artifacts.images[0].path);

  const customPdf = join(tempRoot, "custom.pdf");
  const customPages = join(tempRoot, "page images");
  const configured = parseJson(await run(["render", onePage, "--config", config, "--set", "themeColor=#16a34a", "--pdf", customPdf, "--images-dir", customPages, "--json"], cwd));
  assert.equal(configured.artifacts.pdf.path, customPdf);
  assert.equal(configured.artifacts.images.length, 1);
  assert.equal(configured.effectiveValues.themeColor, "#16a34a");
  await assertPdf(configured.artifacts.pdf.path, 1);
  await assertPng(configured.artifacts.images[0].path);

  const overridePdf = join(tempRoot, "config-disabled.pdf");
  const overridePages = join(tempRoot, "config-disabled-pages");
  const cliOverrides = parseJson(await run(["render", onePage, "--config", cliOverridesConfig, "--pdf", overridePdf, "--images-dir", overridePages, "--json"], cwd));
  assert.equal(cliOverrides.artifacts.pdf.path, overridePdf);
  assert.equal(cliOverrides.artifacts.images.length, 1);
  await assertPdf(cliOverrides.artifacts.pdf.path, 1);
  await assertPng(cliOverrides.artifacts.images[0].path);

  const noImagesCwd = join(tempRoot, "no-images");
  await mkdir(noImagesCwd, { recursive: true });
  const noImages = parseJson(await run(["render", onePage, "--no-images", "--json"], noImagesCwd));
  assert.equal(noImages.artifacts.pdf !== null, true);
  assert.deepEqual(noImages.artifacts.images, []);
  await assertPdf(noImages.artifacts.pdf.path, 1);
  assert.equal((await readdir(join(tempRoot, "no-images"))).filter((name) => name.endsWith(".png")).length, 0);

  const noPdfCwd = join(tempRoot, "no-pdf");
  await mkdir(noPdfCwd, { recursive: true });
  const noPdf = parseJson(await run(["render", onePage, "--no-pdf", "--json"], noPdfCwd));
  assert.equal(noPdf.artifacts.pdf, null);
  assert.equal(noPdf.artifacts.images.length, 1);
  await assertPng(noPdf.artifacts.images[0].path);

  const bothDisabled = await run(["render", onePage, "--no-pdf", "--no-images", "--json"], cwd);
  assert.equal(bothDisabled.code, 2);
  assert.equal(parseJson(bothDisabled).error.code, "INVALID_ARGUMENT");

  const invalidNumber = await run(["render", onePage, "--image-scale", "not-a-number", "--json"], cwd);
  assert.equal(invalidNumber.code, 2);
  assert.equal(parseJson(invalidNumber).error.code, "INVALID_ARGUMENT");

  const conflict = await run(["render", onePage, "--json"], cwd);
  const conflictPayload = parseJson(conflict);
  assert.equal(conflict.code, 6);
  assert.equal(conflictPayload.error.code, "OUTPUT_EXISTS");
  const forced = parseJson(await run(["render", onePage, "--force", "--json"], cwd));
  assert.equal(forced.ok, true);

  const stdinResult = parseJson(await run(["render", "--stdin", "--name", "stdin 简历", "--output-dir", join(tempRoot, "stdin"), "--json"], cwd, await readFile(onePage, "utf8")));
  assert.equal(stdinResult.ok, true);
  assert.match(basename(stdinResult.artifacts.pdf.path), /^stdin 简历\.pdf$/);
  await assertPdf(stdinResult.artifacts.pdf.path, 1);

  const invalid = await run(["render", onePage, "--config", resolve(root, "apps/cli/tests/fixtures/invalid-config.json"), "--json"], cwd);
  assert.equal(invalid.code, 3);
  assert.equal(parseJson(invalid).error.code, "INVALID_CONFIG");

  const missingBrowserCwd = join(tempRoot, "missing-browser");
  await mkdir(missingBrowserCwd, { recursive: true });
  const missingBrowser = await run(["render", onePage, "--browser-path", join(tempRoot, "missing-browser.exe"), "--json"], missingBrowserCwd);
  assert.equal(missingBrowser.code, 4);
  assert.equal(parseJson(missingBrowser).error.code, "BROWSER_NOT_FOUND");

  const smoke = parseJson(await run(["doctor", "--render-smoke", "--json"], cwd));
  assert.equal(smoke.checks.smokeRender.ok, true);

  console.log("CLI E2E passed: real Edge render, PDF/PNG artifacts, config, paths, stdin, errors, and doctor smoke.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
