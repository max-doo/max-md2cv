import {
  createLegacyTemplateManifest,
  DEFAULT_TEMPLATE_EDITOR_SCHEMA,
  createDefaultTemplateValues,
  extractTemplateValueOverrides,
  migrateLegacyResumeStyle,
  normalizeResumeTemplate,
  resolveResumeStyle,
  resolveTemplateValues,
} from "../../../utils/templateStyle";
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

  const getTemplateDefinition = (templateId?: string | null) =>
    state.availableTemplates.value.find(
      (item) => item.id === resolveAvailableTemplateId(templateId),
    ) ?? {
      id: resolveAvailableTemplateId(templateId),
      name: resolveAvailableTemplateId(templateId),
      version: "1.0.0",
      entryCss: "style.css",
      css: "",
      defaults: createDefaultTemplateValues(),
      editorSchema: DEFAULT_TEMPLATE_EDITOR_SCHEMA,
      features: undefined,
      description: undefined,
      layout: undefined,
    };

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

  const getTemplateDefaultValues = (templateId?: string | null) =>
    resolveTemplateValues(getTemplateDefinition(templateId));

  const normalizeProfileValues = (
    templateId: string,
    profile?:
      | ResumeRenderProfile
      | { templateId?: string | null; values?: unknown; style?: unknown }
      | null,
  ) => {
    const template = getTemplateDefinition(templateId);

    if (profile && typeof profile === "object" && profile.values && typeof profile.values === "object") {
      return extractTemplateValueOverrides(
        template,
        profile.values as Record<string, string | number | boolean>,
      );
    }

    if (
      profile &&
      typeof profile === "object" &&
      "style" in profile &&
      profile.style &&
      typeof profile.style === "object"
    ) {
      return migrateLegacyResumeStyle(
        template,
        profile.style as Record<string, unknown>,
      );
    }

    return {};
  };

  const applyRenderProfile = (
    profile?:
      | ResumeRenderProfile
      | { templateId?: string | null; values?: unknown; style?: unknown }
      | null,
  ) => {
    const templateId = resolveAvailableTemplateId(profile?.templateId);

    state.activeTemplate.value = templateId;
    state.templateValues.value = normalizeProfileValues(templateId, profile);
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
            values: normalizeProfileValues(
              profile?.templateId ?? DEFAULT_TEMPLATE_ID,
              profile,
            ),
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
        values: extractTemplateValueOverrides(
          getTemplateDefinition(state.activeTemplate.value),
          state.templateValues.value,
        ),
        photoPath: state.currentPhotoPath.value ?? undefined,
      },
    };

    try {
      await persistWorkspaceRenderState();
    } catch (error) {
      console.error("Failed to persist active render state:", error);
    }
  };

  const updateCurrentFileRenderProfile = (
    templateId: string,
    values: ResumeRenderProfile["values"],
  ) => {
    const fileKey = context.getWorkspaceRelativePath(state.activeFilePath.value);
    if (!fileKey) {
      return false;
    }

    const currentProfile = state.renderProfilesByFile.value[fileKey];
    state.renderProfilesByFile.value = {
      ...state.renderProfilesByFile.value,
      [fileKey]: {
        templateId,
        values,
        photoPath: currentProfile?.photoPath ?? state.currentPhotoPath.value ?? undefined,
      },
    };

    return true;
  };

  const resetActiveFileRenderSettings = () => {
    state.templateValues.value = {};
    if (!updateCurrentFileRenderProfile(state.activeTemplate.value, {})) {
      return;
    }

    void persistWorkspaceRenderState().catch((error) => {
      console.error("Failed to reset active render state:", error);
    });
  };

  const setActiveTemplateForCurrentFile = (templateId: string) => {
    state.activeTemplate.value = resolveAvailableTemplateId(templateId);
    state.templateValues.value = {};

    if (!updateCurrentFileRenderProfile(state.activeTemplate.value, {})) {
      return;
    }

    void persistWorkspaceRenderState().catch((error) => {
      console.error("Failed to update active template render state:", error);
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
      values: { ...profile.values },
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
      state.availableTemplates.value = templates.map((template) => {
        const hasDefaults =
          !!template.defaults &&
          typeof template.defaults === "object" &&
          Object.keys(template.defaults).length > 0;
        const hasStructuredManifest =
          hasDefaults ||
          !!template.schemaPreset ||
          !!template.layout ||
          !!template.features ||
          !!template.editorSchema?.length;

        if (!hasStructuredManifest) {
          return normalizeResumeTemplate({
            ...createLegacyTemplateManifest(
              template.id,
              template.name,
              template.css,
            ),
            css: template.css,
          });
        }

        return normalizeResumeTemplate(template);
      });

      if (
        state.availableTemplates.value.length > 0 &&
        !state.availableTemplates.value.some(
          (template) => template.id === state.activeTemplate.value,
        )
      ) {
        state.activeTemplate.value = state.availableTemplates.value[0].id;
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

    const resolvedValues = resolveTemplateValues(
      template,
      state.templateValues.value,
    );
    const resolvedStyle = resolveResumeStyle(template, resolvedValues);
    const nextTemplate = {
      ...template,
      defaults: resolveTemplateValues(template, resolvedValues),
      layout: {
        ...template.layout,
        headerLayout: String(
          resolvedValues.headerLayout ?? template.layout?.headerLayout ?? "stack",
        ) as "stack" | "split" | "inline",
        personalInfoMode: String(
          resolvedValues.personalInfoMode ??
            template.layout?.personalInfoMode ??
            resolvedStyle.personalInfoMode ??
            "text",
        ) as "text" | "icon" | "chips",
        photoPlacement: String(
          resolvedValues.photoPlacement ??
            template.layout?.photoPlacement ??
            "top-right",
        ) as "hidden" | "top-right" | "top-left" | "header-right",
        sectionTitlePreset: String(
          resolvedValues.sectionTitlePreset ??
            template.layout?.sectionTitlePreset ??
            "accent-bar",
        ) as "accent-bar" | "underline" | "plain",
      },
    };

    try {
      await platform.invoke("save_template_package", {
        template: nextTemplate,
      });
      Object.assign(template, nextTemplate);
      ui.message.success("模板已保存");
    } catch (error) {
      console.error("Failed to save template:", error);
      ui.message.error("保存模板失败");
    }
  };

  return {
    resolveAvailableTemplateId,
    getTemplateDefaultValues,
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
