import defaultResumeMarkdown from "../assets/templates/default-resume.md?raw";
import businessCss from "../assets/templates/business/style.css?raw";
import businessTemplate from "../assets/templates/business/template.json";
import classicCss from "../assets/templates/classic/style.css?raw";
import classicTemplate from "../assets/templates/classic/template.json";
import modernCss from "../assets/templates/modern/style.css?raw";
import modernTemplate from "../assets/templates/modern/template.json";
import type { ResumeTemplate, TemplateManifest } from "../types/resume";
import { normalizeResumeTemplate } from "../utils/templateManifest";

export type BuiltinTemplateId = "modern" | "classic" | "business";

export const DEFAULT_TEMPLATE_ID: BuiltinTemplateId = "modern";
export const DEFAULT_RESUME_MARKDOWN = defaultResumeMarkdown;

const BUILTIN_TEMPLATES: ResumeTemplate[] = [
  normalizeResumeTemplate({
    ...(modernTemplate as TemplateManifest),
    css: modernCss,
  }),
  normalizeResumeTemplate({
    ...(classicTemplate as TemplateManifest),
    css: classicCss,
  }),
  normalizeResumeTemplate({
    ...(businessTemplate as TemplateManifest),
    css: businessCss,
  }),
];

export const getBuiltinTemplates = (): ResumeTemplate[] =>
  BUILTIN_TEMPLATES.map((template) => ({ ...template }));

export const getBuiltinTemplateById = (templateId: string) =>
  BUILTIN_TEMPLATES.find((template) => template.id === templateId) ?? null;
