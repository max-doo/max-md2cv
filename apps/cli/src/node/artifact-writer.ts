import { createHash } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Md2cvError } from "./errors";
import type { CapturedRender } from "./render-service";
import type { OutputPlan } from "./output-paths";

export interface ArtifactFile {
  path: string;
  bytes: number;
  sha256: string;
  width?: number;
  height?: number;
}

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const validatePdf = (bytes: Buffer, expectedPageCount: number) => {
  if (bytes.length < 1_024 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Md2cvError("PDF_EXPORT_FAILED", "Chromium returned an invalid PDF artifact.");
  }
  const pageMarkers = (bytes.toString("latin1").match(/\/Type\s*\/Page(?:\s|\/|>)/g) ?? []).length;
  if (pageMarkers > 0 && pageMarkers !== expectedPageCount) {
    throw new Md2cvError("PDF_EXPORT_FAILED", "PDF page count does not match renderer page count.", {
      expected: expectedPageCount,
      actual: pageMarkers,
    });
  }
};

const validatePng = (bytes: Buffer) => {
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.readUInt32BE(12) !== 0x49484452
  ) {
    throw new Md2cvError("SCREENSHOT_EXPORT_FAILED", "Chromium returned an invalid PNG artifact.");
  }
};

const writeTemporary = async (target: string, bytes: Buffer, token: string): Promise<string> => {
  const tempPath = join(dirname(target), `.${target.split(/[\\/]/).pop()}.${token}.tmp`);
  await writeFile(tempPath, bytes, { flag: "wx" });
  return tempPath;
};

const commitFiles = async (files: Array<{ temporary: string; target: string }>, force: boolean) => {
  const committed: string[] = [];
  try {
    for (const file of files) {
      if (force) await rm(file.target, { force: true });
      await rename(file.temporary, file.target);
      committed.push(file.target);
    }
  } catch (error) {
    throw new Md2cvError("OUTPUT_NOT_WRITABLE", "Unable to commit rendered artifacts.", {
      committed,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await Promise.all(files.map((file) => rm(file.temporary, { force: true }).catch(() => undefined)));
  }
};

export interface WrittenArtifacts {
  pdf: ArtifactFile | null;
  images: ArtifactFile[];
}

export const writeArtifacts = async (
  plan: OutputPlan,
  captured: CapturedRender,
  force: boolean,
): Promise<WrittenArtifacts> => {
  const token = randomUUID();
  const files: Array<{ temporary: string; target: string }> = [];
  const pdf = captured.pdf;
  const images = captured.images;

  validatePdf(pdf, captured.result.pageCount);
  images.forEach((image) => validatePng(image.bytes));
  if (plan.imagesDir && images.length !== captured.result.pageCount) {
    throw new Md2cvError("SCREENSHOT_EXPORT_FAILED", "PNG count does not match renderer page count.", {
      expected: captured.result.pageCount,
      actual: images.length,
    });
  }

  try {
    if (plan.pdfPath) {
      files.push({ temporary: await writeTemporary(plan.pdfPath, pdf, token), target: plan.pdfPath });
    }
    if (plan.imagesDir) {
      for (const image of images) {
        const target = plan.imagePath(image.page);
        files.push({ temporary: await writeTemporary(target, image.bytes, token), target });
      }
    }
    await commitFiles(files, force);
  } catch (error) {
    await Promise.all(files.map((file) => rm(file.temporary, { force: true }).catch(() => undefined)));
    if (error instanceof Md2cvError) throw error;
    throw new Md2cvError("OUTPUT_NOT_WRITABLE", "Unable to write rendered artifacts.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    pdf: plan.pdfPath ? { path: plan.pdfPath, bytes: pdf.length, sha256: digest(pdf) } : null,
    images: plan.imagesDir ? images.map((image) => ({
      path: plan.imagePath(image.page),
      bytes: image.bytes.length,
      sha256: digest(image.bytes),
      width: image.width,
      height: image.height,
    })) : [],
  };
};
