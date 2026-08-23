import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { md2cvConfigSchema, type Md2cvConfigV1 } from "./schema";
import { Md2cvError } from "../node/errors";

export interface LoadedConfig {
  path: string;
  directory: string;
  value: Md2cvConfigV1;
}

export const loadConfig = async (inputPath: string): Promise<LoadedConfig> => {
  const path = resolve(process.cwd(), inputPath);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new Md2cvError(
      "INVALID_CONFIG",
      `Unable to read config file: ${path}`,
      { path, cause: error instanceof Error ? error.message : String(error) },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Md2cvError(
      "INVALID_CONFIG",
      `Config file is not valid JSON: ${path}`,
      { path, cause: error instanceof Error ? error.message : String(error) },
    );
  }

  const result = md2cvConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Md2cvError(
      "INVALID_CONFIG",
      `Config file does not match version 1 schema: ${path}`,
      { path, issues: result.error.issues },
      ["Set version to 1 and check the fields with the documented resume.render.json schema."],
    );
  }

  return { path, directory: dirname(path), value: result.data };
};
