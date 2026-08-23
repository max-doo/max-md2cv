import { z } from "zod";
import type {
  ResumeTemplate,
  TemplateValue,
  TemplateValues,
} from "../../../../packages/resume-core/src/domain";
import { resolveTemplateValues } from "../../../../packages/resume-core/src/domain";
import { Md2cvError } from "../node/errors";

const configValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

export const md2cvConfigSchema = z
  .object({
    version: z.literal(1),
    template: z.string().min(1),
    values: z.record(z.string(), configValueSchema).optional(),
    photoPath: z.string().min(1).optional(),
    outputs: z
      .object({
        pdf: z.boolean().optional(),
        images: z.boolean().optional(),
        imageScale: z.number().finite().min(1).max(3).optional(),
      })
      .strict()
      .optional(),
    render: z
      .object({
        maxPages: z.number().int().positive().optional(),
        strictFonts: z.boolean().optional(),
        allowNetwork: z.boolean().optional(),
        timeoutMs: z.number().int().min(5_000).max(120_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type Md2cvConfigV1 = z.infer<typeof md2cvConfigSchema>;

export interface NormalizedTemplateValues {
  values: TemplateValues;
  warnings: Array<{ code: "TEMPLATE_VALUE_CLAMPED"; message: string; details?: Record<string, unknown> }>;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseBoolean = (value: unknown, fromCli: boolean): boolean | null => {
  if (typeof value === "boolean") return value;
  if (!fromCli || typeof value !== "string") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const parseNumber = (value: unknown, fromCli: boolean): number | null => {
  if (isFiniteNumber(value)) return value;
  if (!fromCli || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeValue = (
  template: ResumeTemplate,
  key: string,
  value: unknown,
  fromCli: boolean,
): { value: TemplateValue; clamped: boolean } => {
  const field = template.editorSchema.find((candidate) => candidate.key === key);
  if (!field || !(key in template.defaults)) {
    throw new Md2cvError(
      "TEMPLATE_VALUE_INVALID",
      `Unknown template value key: ${key}`,
      { key, template: template.id },
      ["Run md2cv templates schema <template> --json and use an existing field key."],
    );
  }

  if (field.type === "number") {
    const parsed = parseNumber(value, fromCli);
    if (parsed === null) {
      throw new Md2cvError(
        "TEMPLATE_VALUE_INVALID",
        `Value for ${key} must be a finite number.`,
        { key, value },
      );
    }
    const min = field.min ?? parsed;
    const max = field.max ?? parsed;
    const clamped = Math.min(max, Math.max(min, parsed));
    return { value: clamped, clamped: clamped !== parsed };
  }

  if (field.type === "boolean") {
    const parsed = parseBoolean(value, fromCli);
    if (parsed === null) {
      throw new Md2cvError(
        "TEMPLATE_VALUE_INVALID",
        `Value for ${key} must be boolean${fromCli ? " true or false" : ""}.`,
        { key, value },
      );
    }
    return { value: parsed, clamped: false };
  }

  if (typeof value !== "string") {
    throw new Md2cvError(
      "TEMPLATE_VALUE_INVALID",
      `Value for ${key} must be a string.`,
      { key, value },
    );
  }

  if (field.type === "select" && field.options?.length) {
    const allowed = field.options.some((option) => String(option.value) === value);
    if (!allowed) {
      throw new Md2cvError(
        "TEMPLATE_VALUE_INVALID",
        `Value for ${key} is not one of the template options.`,
        { key, value, options: field.options.map((option) => option.value) },
      );
    }
  }

  return { value, clamped: false };
};

export const normalizeTemplateValuesForCli = (
  template: ResumeTemplate,
  configValues: Record<string, TemplateValue> = {},
  cliValues: Record<string, string> = {},
): NormalizedTemplateValues => {
  const values: TemplateValues = { ...configValues };
  const warnings: Array<{ code: "TEMPLATE_VALUE_CLAMPED"; message: string; details?: Record<string, unknown> }> = [];

  for (const [key, value] of Object.entries(configValues)) {
    const normalized = normalizeValue(template, key, value, false);
    values[key] = normalized.value;
    if (normalized.clamped) {
      warnings.push({ code: "TEMPLATE_VALUE_CLAMPED", message: `Clamped ${key} to the range declared by template schema.`, details: { key } });
    }
  }

  for (const [key, value] of Object.entries(cliValues)) {
    const normalized = normalizeValue(template, key, value, true);
    values[key] = normalized.value;
    if (normalized.clamped) {
      warnings.push({ code: "TEMPLATE_VALUE_CLAMPED", message: `Clamped ${key} to the range declared by template schema.`, details: { key } });
    }
  }

  return {
    values: resolveTemplateValues(template, values),
    warnings,
  };
};

export const parseSetValues = (
  template: ResumeTemplate,
  entries: string[] = [],
): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Md2cvError(
        "INVALID_ARGUMENT",
        `Invalid --set value: ${entry}. Expected key=value.`,
      );
    }
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1);
    if (!key || value === "") {
      throw new Md2cvError(
        "INVALID_ARGUMENT",
        `Invalid --set value: ${entry}. Expected a non-empty key and value.`,
      );
    }
    // Validate in appearance order so later --set entries intentionally win.
    normalizeValue(template, key, value, true);
    values[key] = value;
  }
  return values;
};
