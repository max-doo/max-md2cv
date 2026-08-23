import { access, constants, mkdir, stat, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { Md2cvError } from "./errors";

export interface OutputOptions {
  pdf: boolean;
  images: boolean;
  imageScale: number;
  outputDir?: string;
  pdfPath?: string;
  imagesDir?: string;
  force: boolean;
}

export interface OutputPlan {
  pdfPath: string | null;
  imagesDir: string | null;
  imagePath: (page: number) => string;
  expectedPaths: () => string[];
  baseName: string;
}

const WINDOWS_ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

export const sanitizeOutputBaseName = (value: string): string => {
  let sanitized = value.replace(/\.md$/i, "").replace(WINDOWS_ILLEGAL_CHARS, "_").replace(/[ .]+$/g, "").trim();
  if (!sanitized) sanitized = "resume";
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized;
};

export const createOutputPlan = (
  inputName: string,
  options: OutputOptions,
): OutputPlan => {
  if (!options.pdf && !options.images) {
    throw new Md2cvError("INVALID_ARGUMENT", "--no-pdf and --no-images cannot be used together.");
  }
  if (options.pdfPath && extname(options.pdfPath).toLowerCase() !== ".pdf") {
    throw new Md2cvError("INVALID_ARGUMENT", "--pdf must point to a .pdf file.", { path: options.pdfPath });
  }
  const baseName = sanitizeOutputBaseName(inputName.replace(/\.md$/i, ""));
  const cwd = process.cwd();
  const outputDir = options.outputDir ? resolve(cwd, options.outputDir) : cwd;
  const pdfPath = options.pdf
    ? resolve(cwd, options.pdfPath ?? join(outputDir, `${baseName}.pdf`))
    : null;
  const imagesDir = options.images
    ? resolve(cwd, options.imagesDir ?? outputDir)
    : null;
  const imagePath = (page: number) => join(imagesDir ?? outputDir, `${baseName}.page-${page}.png`);

  return {
    pdfPath,
    imagesDir,
    imagePath,
    expectedPaths: () => [
      ...(pdfPath ? [pdfPath] : []),
      ...(imagesDir ? [imagePath(1)] : []),
    ],
    baseName,
  };
};

export const ensureOutputDirectories = async (plan: OutputPlan): Promise<void> => {
  const directories = new Set<string>();
  if (plan.pdfPath) directories.add(dirname(plan.pdfPath));
  if (plan.imagesDir) directories.add(plan.imagesDir);
  for (const directory of directories) {
    try {
      const existing = await stat(directory).catch(() => null);
      if (existing && !existing.isDirectory()) {
        throw new Md2cvError("OUTPUT_NOT_WRITABLE", `Output path is not a directory: ${directory}`, { path: directory });
      }
      if (!existing) await mkdir(directory, { recursive: true });
      await access(directory, constants.W_OK);
    } catch (error) {
      if (error instanceof Md2cvError) throw error;
      throw new Md2cvError("OUTPUT_NOT_WRITABLE", `Output directory is not writable: ${directory}`, {
        path: directory,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const assertOutputsAvailable = async (paths: string[], force: boolean): Promise<void> => {
  if (force) return;
  const existing: string[] = [];
  for (const path of paths) {
    try {
      await access(path);
      existing.push(path);
    } catch {
      // Missing is expected.
    }
  }
  if (existing.length > 0) {
    throw new Md2cvError(
      "OUTPUT_EXISTS",
      "One or more output files already exist.",
      { paths: existing },
      ["Choose a different output path or pass --force when overwriting is authorized."],
    );
  }
};

export const assertOutputPlanAvailable = async (plan: OutputPlan, force: boolean): Promise<void> => {
  if (force) return;
  const paths = [...(plan.pdfPath ? [plan.pdfPath] : [])];
  if (plan.imagesDir) {
    try {
      const existingImages = (await readdir(plan.imagesDir)).filter((name) =>
        name.startsWith(`${plan.baseName}.page-`) && name.toLowerCase().endsWith(".png"),
      );
      paths.push(...existingImages.map((name) => join(plan.imagesDir as string, name)));
    } catch {
      // The directory may not exist yet; ensureOutputDirectories handles creation.
    }
  }
  await assertOutputsAvailable(paths, false);
};

export const expectedArtifactPaths = (plan: OutputPlan, pageCount: number): string[] => [
  ...(plan.pdfPath ? [plan.pdfPath] : []),
  ...(plan.imagesDir ? Array.from({ length: pageCount }, (_, index) => plan.imagePath(index + 1)) : []),
];
