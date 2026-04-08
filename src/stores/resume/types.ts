import type {
  ResumeStyle,
  ResumeTemplate,
  TemplateFieldSchema,
  TemplateValue,
  TemplateValues,
} from "@resume-core";

export type {
  ResumeStyle,
  ResumeTemplate,
  TemplateFieldSchema,
  TemplateValue,
  TemplateValues,
};

export interface FileItem {
  name: string;
  path: string;
}

export interface PhotoItem extends FileItem {
  isIdPhoto: boolean;
}

export type SidebarPrimaryView = "library" | "outline";
export type ActiveFileStatus = "ready" | "missing" | "conflict";

export interface EditorJumpRequest {
  line: number;
  token: number;
}

export interface WorkspaceChangedEvent {
  workspacePath: string;
  paths: string[];
}

export interface ResumeRenderProfile {
  templateId: string;
  values: TemplateValues;
  photoPath?: string;
}

export interface WorkspaceRenderState {
  version: number;
  files: Record<string, ResumeRenderProfile>;
}
