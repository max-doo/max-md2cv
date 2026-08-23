import { resolve } from "node:path";
import { loadConfig } from "../config/load-config";
import { normalizeTemplateValuesForCli, parseSetValues } from "../config/schema";
import { printJson } from "../node/json-output";
import { inlineLocalMarkdownImages, readDataUrl, readMarkdownInput } from "../node/input";
import { findTemplate } from "../node/template-loader";

export interface ValidateCommandOptions {
  stdin?: boolean;
  name?: string;
  template?: string;
  config?: string;
  set?: string[];
  photo?: string;
  allowNetwork?: boolean;
  json?: boolean;
}

export const runValidateCommand = async (
  inputPath: string | undefined,
  options: ValidateCommandOptions,
): Promise<void> => {
  const config = options.config ? await loadConfig(options.config) : null;
  const template = await findTemplate(options.template ?? config?.value.template ?? "modern");
  const input = await readMarkdownInput(inputPath, options.stdin === true, options.name);
  const values = normalizeTemplateValuesForCli(
    template,
    config?.value.values ?? {},
    parseSetValues(template, options.set ?? []),
  );
  const allowNetwork = options.allowNetwork ?? config?.value.render?.allowNetwork ?? false;
  const inlined = await inlineLocalMarkdownImages(input.markdown, input.sourceDirectory, allowNetwork);
  const photoInput = options.photo ?? config?.value.photoPath;
  if (photoInput) {
    await readDataUrl(
      config && !options.photo ? resolve(config.directory, photoInput) : photoInput,
      "PHOTO_NOT_FOUND",
    );
  }
  const result = {
    ok: true,
    input: input.inputPath,
    template: { id: template.id, name: template.name, version: template.version },
    effectiveValues: values.values,
    warnings: [...values.warnings, ...inlined.warnings],
  };
  if (options.json) printJson(result);
  else process.stderr.write(`Valid: ${template.id} (${input.inputPath ?? "stdin"})\n`);
};
