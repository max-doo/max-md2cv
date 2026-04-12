export type PersonalInfoMode = "text" | "icon" | "chips";

export type TemplateHeaderLayout = "stack" | "split" | "inline";

export type TemplatePhotoPlacement =
  | "hidden"
  | "top-right"
  | "top-left"
  | "header-right";

export type TemplateSectionTitlePreset =
  | "accent-bar"
  | "underline"
  | "plain";

export type TemplateValue = string | number | boolean;
export type TemplateValues = Record<string, TemplateValue>;

export type TemplateFieldType =
  | "color"
  | "number"
  | "select"
  | "boolean"
  | "text";

export type TemplateSchemaPreset = "standard";

export interface TemplateOption {
  label: string;
  value: TemplateValue;
}

export interface TemplateFieldSchema {
  key: string;
  type: TemplateFieldType;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  group?: string;
  placeholder?: string;
  options?: TemplateOption[];
}

export interface TemplateLayoutConfig {
  headerLayout: TemplateHeaderLayout;
  personalInfoMode: PersonalInfoMode;
  photoPlacement: TemplatePhotoPlacement;
  sectionTitlePreset: TemplateSectionTitlePreset;
}

export interface TemplateFeatures {
  photo?: boolean;
  pageFooter?: boolean;
  contactModes?: PersonalInfoMode[];
  [key: string]: unknown;
}

export interface TemplateManifest {
  id: string;
  name: string;
  version: string;
  entryCss: string;
  description?: string;
  defaults: TemplateValues;
  schemaPreset?: TemplateSchemaPreset;
  editorSchema?: TemplateFieldSchema[];
  editorSchemaOverrides?: TemplateFieldSchema[];
  features?: TemplateFeatures;
  layout?: Partial<TemplateLayoutConfig>;
}

export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  fontSize: number;
  paragraphSpacing: number;
  h2MarginTop: number;
  h2MarginBottom: number;
  h3MarginTop: number;
  h3MarginBottom: number;
  personalHeaderSpacing: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  dateSize?: number;
  dateWeight?: string;
  lineHeight: number;
  marginV: number;
  marginH: number;
  personalInfoMode?: PersonalInfoMode;
}

export interface PhotoAdjustments {
  visible: boolean;
  size: number;
  offsetX: number;
  offsetY: number;
}

export interface ResumeTemplate extends Omit<TemplateManifest, "editorSchema"> {
  editorSchema: TemplateFieldSchema[];
  css: string;
}

export interface WebPlaygroundDraft {
  version: 2;
  markdown: string;
  templateId: string;
  values: TemplateValues;
  photoBase64: string | null;
  updatedAt: string;
}
