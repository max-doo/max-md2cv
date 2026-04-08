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

export type TemplateEditableField =
  | "fontFamily"
  | "themeColor"
  | "fontSize"
  | "lineHeight"
  | "spacing"
  | "headerLayout"
  | "personalInfoMode"
  | "photoPlacement"
  | "sectionTitlePreset";

export interface TemplateLayoutConfig {
  headerLayout: TemplateHeaderLayout;
  personalInfoMode: PersonalInfoMode;
  photoPlacement: TemplatePhotoPlacement;
  sectionTitlePreset: TemplateSectionTitlePreset;
}

export interface TemplateManifest {
  version: 1;
  defaults?: Partial<ResumeStyle>;
  layout?: Partial<TemplateLayoutConfig>;
  editable?: TemplateEditableField[];
}

export interface ResumeTemplate {
  id: string;
  name: string;
  css: string;
  manifest?: TemplateManifest;
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

export interface WebPlaygroundDraft {
  version: 1;
  markdown: string;
  templateId: string;
  resumeStyle: ResumeStyle;
  photoBase64: string | null;
  updatedAt: string;
}
