import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appDirectory, "../..");
const runtimeRoot = resolve(appDirectory, "dist/runtime");
const templatesSource = resolve(repositoryRoot, "packages/resume-core/src/assets/templates");
const fontsSource = resolve(repositoryRoot, "packages/resume-core/src/assets/fonts");
const skillSource = resolve(repositoryRoot, "skills/md2cv");

const assertSafeRuntimeTarget = (target) => {
  const absolute = resolve(target);
  if (absolute === resolve(appDirectory) || !absolute.startsWith(`${resolve(appDirectory)}${sep}`)) {
    throw new Error(`Refusing to clean an unsafe runtime target: ${absolute}`);
  }
  return absolute;
};

const hashFile = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const collectFiles = async (root) => {
  const entries = await readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(path));
    else result.push(path);
  }
  return result;
};

const target = assertSafeRuntimeTarget(runtimeRoot);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(templatesSource, join(target, "templates"), { recursive: true });
await cp(fontsSource, join(target, "fonts"), { recursive: true });
if (await stat(skillSource).then(() => true).catch(() => false)) {
  await cp(skillSource, join(target, "skills/md2cv"), { recursive: true });
}

const templateIds = ["modern", "classic", "business"];
for (const id of templateIds) {
  const manifestPath = join(target, "templates", id, "template.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const cssPath = join(target, "templates", id, manifest.entryCss);
  if (!manifest.entryCss || !(await stat(cssPath).then(() => true).catch(() => false))) {
    throw new Error(`Template ${id} has a missing entryCss asset.`);
  }
}

const files = await collectFiles(target);
const hashes = {};
for (const path of files) {
  hashes[relative(target, path).replaceAll("\\", "/")] = await hashFile(path);
}
await writeFile(join(target, "asset-manifest.json"), JSON.stringify({ version: 1, files: hashes }, null, 2) + "\n");
console.log(`Copied ${Object.keys(hashes).length} CLI runtime assets.`);
