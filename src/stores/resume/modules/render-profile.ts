import {
  cloneResumeStyle,
  createDefaultResumeStyle,
} from "../../../utils/templateStyle";
import { resolveTemplateManifest } from "@resume-core";
import { DEFAULT_TEMPLATE_ID, RENDER_STATE_VERSION } from "../constants";
import type { ResumeStoreBaseContext } from "../context";
import type {
  PhotoItem,
  ResumeRenderProfile,
  ResumeTemplate,
  WorkspaceRenderState,
} from "../types";

interface RenderProfileModuleContext extends ResumeStoreBaseContext {
  getWorkspaceRelativePath: (path: string | null | undefined) => string | null;
  loadPhoto: (path: string | null) => Promise<void>;
  resolveNextPhotoPath: (entries: PhotoItem[]) => string | null;
}

export const createRenderProfileModule = (
  context: RenderProfileModuleContext,
) => {
  const { state, platform, ui } = context;

  const resolveAvailableTemplateId = (templateId?: string | null) => {
    if (
      templateId &&
      state.availableTemplates.value.some((template) => template.id === templateId)
    ) {
      return templateId;
    }

    const defaultTemplate = state.availableTemplates.value.find(
      (template) => template.id === DEFAULT_TEMPLATE_ID,
    );

    return (
      defaultTemplate?.id ??
      state.availableTemplates.value[0]?.id ??
      DEFAULT_TEMPLATE_ID
    );
  };

  const getTemplateDefaultStyle = (templateId?: string | null) => {
    const resolvedTemplateId = resolveAvailableTemplateId(templateId);
    const template = state.availableTemplates.value.find(
      (item) => item.id === resolvedTemplateId,
    );

    if (!template) {
      return createDefaultResumeStyle();
    }

    return cloneResumeStyle(
      resolveTemplateManifest(template).defaults ?? createDefaultResumeStyle(),
    );
  };

  const applyRenderProfile = (profile?: ResumeRenderProfile | null) => {
    const templateId = resolveAvailableTemplateId(profile?.templateId);
    const baseStyle = getTemplateDefaultStyle(templateId);

    state.activeTemplate.value = templateId;
    state.resumeStyle.value = cloneResumeStyle(
      profile ? { ...baseStyle, ...profile.style } : baseStyle,
    );
  };

  const syncActiveFilePhoto = () => {
    const fileKey = context.getWorkspaceRelativePath(state.activeFilePath.value);
    const profile = fileKey ? state.renderProfilesByFile.value[fileKey] : null;
    const boundPath = profile?.photoPath ?? null;

    if (boundPath) {
      if (boundPath !== state.currentPhotoPath.value) {
        void context.loadPhoto(boundPath);
      }
      return;
    }

    const fallback = context.resolveNextPhotoPath(state.photoFileList.value);
    if (fallback !== state.currentPhotoPath.value) {
      void context.loadPhoto(fallback);
    }
  };

  const syncActiveFileRenderProfile = () => {
    const fileKey = context.getWorkspaceRelativePath(state.activeFilePath.value);
    applyRenderProfile(
      fileKey ? state.renderProfilesByFile.value[fileKey] : null,
    );
    syncActiveFilePhoto();
  };

  const loadWorkspaceRenderState = async (dirPath: string) => {
    try {
      const stateFromDisk = await platform.invoke<WorkspaceRenderState>(
        "read_workspace_render_state",
        {
          workspacePath: dirPath,
        },
      );
      const files = stateFromDisk?.files ?? {};

      state.renderProfilesByFile.value = Object.fromEntries(
        Object.entries(files).map(([path, profile]) => [
          path.replace(/\\/g, "/"),
          {
            templateId: profile?.templateId ?? DEFAULT_TEMPLATE_ID,
            style: cloneResumeStyle(profile?.style),
            photoPath: profile?.photoPath,
          },
        ]),
      );
    } catch (error) {
      console.error("Failed to load workspace render state:", error);
      state.renderProfilesByFile.value = {};
    }
  };

  const persistWorkspaceRenderState = async () => {
    if (!state.workspacePath.value) {
      return;
    }

    const nextState: WorkspaceRenderState = {
      version: RENDER_STATE_VERSION,
      files: state.renderProfilesByFile.value,
    };

    await platform.invoke("write_workspace_render_state", {
      workspacePath: state.workspacePath.value,
      state: nextState,
    });
  };

  const persistActiveFileRenderState = async () => {
    const fileKey = context.getWorkspaceRelativePath(state.activeFilePath.value);
    if (!fileKey) {
      return;
    }

    state.renderProfilesByFile.value = {
      ...state.renderProfilesByFile.value,
      [fileKey]: {
        templateId: state.activeTemplate.value,
        style: cloneResumeStyle(state.resumeStyle.value),
        photoPath: state.currentPhotoPath.value ?? undefined,
      },
    };

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to persist active render state:", error);
    }
  };

  const resetActiveFileRenderSettings = () => {
    applyRenderProfile({
      templateId: state.activeTemplate.value,
      style: getTemplateDefaultStyle(state.activeTemplate.value),
    });
  };

  const setActiveTemplateForCurrentFile = (templateId: string) => {
    applyRenderProfile({
      templateId,
      style: getTemplateDefaultStyle(templateId),
    });
  };

  const updateRenderProfilePath = async (
    oldPath: string,
    newPath: string,
    mode: "move" | "copy",
  ) => {
    const oldKey = context.getWorkspaceRelativePath(oldPath);
    const newKey = context.getWorkspaceRelativePath(newPath);

    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    const profile = state.renderProfilesByFile.value[oldKey];
    if (!profile) {
      return;
    }

    const nextProfiles = { ...state.renderProfilesByFile.value };
    nextProfiles[newKey] = {
      templateId: profile.templateId,
      style: cloneResumeStyle(profile.style),
      photoPath: profile.photoPath,
    };

    if (mode === "move") {
      delete nextProfiles[oldKey];
    }

    state.renderProfilesByFile.value = nextProfiles;

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to update render profile path:", error);
    }
  };

  const deleteRenderProfile = async (path: string) => {
    const fileKey = context.getWorkspaceRelativePath(path);
    if (!fileKey || !state.renderProfilesByFile.value[fileKey]) {
      return;
    }

    const nextProfiles = { ...state.renderProfilesByFile.value };
    delete nextProfiles[fileKey];
    state.renderProfilesByFile.value = nextProfiles;

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to delete render profile:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const templates = await platform.invoke<ResumeTemplate[]>("list_templates");
      state.availableTemplates.value = templates;

      if (
        templates.length > 0 &&
        !templates.some((template) => template.id === state.activeTemplate.value)
      ) {
        state.activeTemplate.value = templates[0].id;
      }

      state.templatesLoaded.value = true;
      syncActiveFileRenderProfile();
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const saveCurrentTemplate = async () => {
    const template = state.availableTemplates.value.find(
      (item) => item.id === state.activeTemplate.value,
    );

    if (!template) {
      ui.message.error("当前模板不存在");
      return;
    }

    const style = state.resumeStyle.value;
    const marker = "/* @user-overrides */";
    const baseCss = template.css.split(marker)[0].trimEnd();
    const patchCss = `\n\n${marker}\n.resume-document {\n  font-family: ${style.fontFamily};\n  font-size: ${style.fontSize}px;\n  line-height: ${style.lineHeight};\n  --cv-theme-color: ${style.themeColor};\n  --cv-font-size: ${style.fontSize}px;\n  --cv-paragraph-spacing: ${style.paragraphSpacing}px;\n  --cv-h2-margin-top: ${style.h2MarginTop}px;\n  --cv-h2-margin-bottom: ${style.h2MarginBottom}px;\n  --cv-h3-margin-top: ${style.h3MarginTop}px;\n  --cv-h3-margin-bottom: ${style.h3MarginBottom}px;\n  --cv-personal-header-spacing: ${style.personalHeaderSpacing}px;\n  --cv-contact-render: ${style.personalInfoMode || "text"};\n}\n.resume-document h1 { font-size: ${style.h1Size}px; }\n.resume-document h2 { font-size: ${style.h2Size}px; margin-top: var(--cv-h2-margin-top); margin-bottom: var(--cv-h2-margin-bottom); }\n.resume-document h3 { font-size: ${style.h3Size}px; margin-top: var(--cv-h3-margin-top); margin-bottom: var(--cv-h3-margin-bottom); }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document .job-intention + p,\n.resume-document .contact-info--text,\n.resume-document .contact-info-text-line,\n.resume-document .contact-info--icon,\n.resume-document .contact-info-item { font-size: var(--cv-font-size); }\n.resume-document blockquote { font-size: calc(var(--cv-font-size) * 0.9); }\n.resume-document p,\n.resume-document ul,\n.resume-document ol,\n.resume-document blockquote { margin-top: 0; margin-bottom: var(--cv-paragraph-spacing); }\n.resume-document li { margin-bottom: calc(var(--cv-paragraph-spacing) * 0.5); }\n.resume-document .personal-header { margin-bottom: 0; padding-bottom: var(--cv-personal-header-spacing); }\n.resume-document .job-intention + p,\n.resume-document .contact-info--text,\n.resume-document .contact-info--icon { margin-bottom: 0; }\n@page { margin: ${style.marginV}mm ${style.marginH}mm; }\n.resume-document h2 { border-left-color: var(--cv-theme-color); border-bottom-color: var(--cv-theme-color); background-color: color-mix(in srgb, var(--cv-theme-color) 10%, transparent); }\n`;
    const newCss = baseCss + patchCss;
    const nextManifest = resolveTemplateManifest({
      css: newCss,
      manifest: template.manifest,
    });
    nextManifest.defaults = cloneResumeStyle(style);
    nextManifest.layout = {
      ...nextManifest.layout,
      personalInfoMode:
        style.personalInfoMode ?? nextManifest.layout?.personalInfoMode ?? "text",
    };

    try {
      await platform.invoke("save_template", {
        id: template.id,
        css: newCss,
        manifest: nextManifest,
      });
      template.css = newCss;
      template.manifest = nextManifest;
      ui.message.success("模板已保存");
    } catch (error) {
      console.error("Failed to save template:", error);
      ui.message.error("保存模板失败");
    }
  };

  return {
    resolveAvailableTemplateId,
    getTemplateDefaultStyle,
    applyRenderProfile,
    syncActiveFilePhoto,
    syncActiveFileRenderProfile,
    loadWorkspaceRenderState,
    persistWorkspaceRenderState,
    persistActiveFileRenderState,
    resetActiveFileRenderSettings,
    setActiveTemplateForCurrentFile,
    updateRenderProfilePath,
    deleteRenderProfile,
    loadTemplates,
    saveCurrentTemplate,
  };
};
