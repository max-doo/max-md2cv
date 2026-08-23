import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromCli = createRequire(resolve(root, "apps/cli/package.json"));
const pdfjs = await import(pathToFileURL(requireFromCli.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const fixture = resolve(root, "apps/cli/tests/fixtures/one-page.md");

const run = async (args, cwd) => {
  const result = await execFileAsync(npmCommand, args, { cwd, windowsHide: true, shell: process.platform === "win32", maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
};

const runInstalled = async (installRoot, args) => {
  const command = process.platform === "win32"
    ? join(installRoot, "node_modules", ".bin", "md2cv.cmd")
    : join(installRoot, "node_modules", ".bin", "md2cv");
  const result = await execFileAsync(command, args, { cwd: installRoot, windowsHide: true, shell: process.platform === "win32", maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
};

const tempRoot = await mkdtemp(join(tmpdir(), "md2cv-pack-test-"));
const packDirectory = join(tempRoot, "pack");
const installDirectory = join(tempRoot, "install");
try {
  await mkdir(packDirectory, { recursive: true });
  await mkdir(installDirectory, { recursive: true });
  await run(["pack", "--workspace", "@max-md2cv/cli", "--pack-destination", packDirectory], root);
  const tarballs = (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  const tarball = join(packDirectory, tarballs[0]);

  await run(["init", "--yes"], installDirectory);
  await run(["install", tarball], installDirectory);

  assert.equal((await runInstalled(installDirectory, ["--version"])).trim(), "0.1.0");
  const templates = JSON.parse(await runInstalled(installDirectory, ["templates", "list", "--json"]));
  assert.deepEqual(templates.templates.map((template) => template.id), ["business", "classic", "modern"]);

  const renderOutput = JSON.parse(await runInstalled(installDirectory, [
    "render",
    fixture,
    "--output-dir",
    "artifacts",
    "--json",
  ]));
  assert.equal(renderOutput.ok, true);
  assert.equal(renderOutput.pageCount, 1);
  const pdfBytes = await readFile(renderOutput.artifacts.pdf.path);
  assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true }).promise;
  try {
    assert.equal(pdfDocument.numPages, 1);
  } finally {
    await pdfDocument.destroy();
  }
  const imageBytes = await readFile(renderOutput.artifacts.images[0].path);
  assert.equal(imageBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  await access(join(installDirectory, "node_modules", "@max-md2cv", "cli", "dist", "runtime", "skills", "md2cv", "SKILL.md"));
  console.log("CLI pack install passed: npm tarball, Windows bin shim, runtime assets, PDF, PNG, and JSON.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
