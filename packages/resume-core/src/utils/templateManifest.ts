import type {
  ResumeTemplate,
  TemplateEditableField,
  TemplateLayoutConfig,
  TemplateManifest,
} from "../types/resume";
import { createDefaultResumeStyle, parseResumeStyleFromTemplateCss } from "./templateStyle";

export const DEFAULT_TEMPLATE_LAYOUT: TemplateLayoutConfig = {
  headerLayout: "stack",
  personalInfoMode: "text",
  photoPlacement: "top-right",
  sectionTitlePreset: "accent-bar",
};

export const DEFAULT_TEMPLATE_EDITABLE_FIELDS: TemplateEditableField[] = [
  "fontFamily",
  "themeColor",
  "fontSize",
  "lineHeight",
  "spacing",
  "headerLayout",
  "personalInfoMode",
  "photoPlacement",
  "sectionTitlePreset",
];

export const normalizeTemplateManifest = (
  manifest?: TemplateManifest | null,
): TemplateManifest => ({
  version: 1,
  defaults: manifest?.defaults ? { ...manifest.defaults } : undefined,
  layout: {
    ...DEFAULT_TEMPLATE_LAYOUT,
    ...manifest?.layout,
  },
  editable: manifest?.editable?.length
    ? [...manifest.editable]
    : [...DEFAULT_TEMPLATE_EDITABLE_FIELDS],
});

export const resolveTemplateManifest = (
  template: Pick<ResumeTemplate, "css" | "manifest">,
): TemplateManifest => {
  const styleDefaults = template.css
    ? parseResumeStyleFromTemplateCss(template.css)
    : createDefaultResumeStyle();
  const normalized = normalizeTemplateManifest(template.manifest);

  return {
    ...normalized,
    defaults: {
      ...styleDefaults,
      ...normalized.defaults,
    },
    layout: {
      ...DEFAULT_TEMPLATE_LAYOUT,
      personalInfoMode:
        normalized.layout?.personalInfoMode ??
        normalized.defaults?.personalInfoMode ??
        styleDefaults.personalInfoMode ??
        DEFAULT_TEMPLATE_LAYOUT.personalInfoMode,
      ...normalized.layout,
    },
  };
};
